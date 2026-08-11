import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiListCheck3,
  RiSettings3Line,
  RiUserAddLine,
  RiUserVoiceLine,
} from "@remixicon/react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WORKFLOW_OPTIONS } from "@/components/dashboard/speaker-workflow-select"
import { useCurrentEvent } from "@/lib/current-event"
import {
  SpeakersTable,
  SpeakersTableSkeleton,
} from "@/components/dashboard/speakers-table"
import type { SpeakerRosterRow } from "@/components/dashboard/speakers-table"
import { AddSpeakerDialog } from "@/components/dashboard/add-speaker-dialog"
import { SpeakerProfileDrawer } from "@/components/dashboard/speaker-profile-drawer"
import { AssignTaskDialog } from "@/components/dashboard/assign-task-dialog"
import { RemindIncompleteButton } from "@/components/dashboard/remind-incomplete-button"
import { APP_ROUTES } from "@/components/dashboard/app-routes"

export const Route = createFileRoute("/app/speakers/")({
  component: SpeakersPage,
})

type FilterTab = "all" | "attention" | "ready"

/** Sentinel for "don't filter by workflow status" (sbek SPK-04 filterable). */
const ALL_WORKFLOW = "all"

const WORKFLOW_FILTER_OPTIONS = [
  { value: ALL_WORKFLOW, label: "Any status" },
  ...WORKFLOW_OPTIONS,
]

const TAB_LABELS: Record<FilterTab, string> = {
  all: "All speakers",
  attention: "Needs attention",
  ready: "All set",
}

/**
 * Speakers roster (docs/SPEC.md §4.8) — every accepted speaker, what they still
 * owe you, and the actions that chase them: copy their portal link, assign a
 * task, or remind everyone who is behind. Reactive: the table updates the
 * instant a speaker uploads a headshot or ticks off a task.
 */
function SpeakersPage() {
  const { event, isEmpty } = useCurrentEvent()
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<FilterTab>("all")
  const [workflow, setWorkflow] = useState<string>(ALL_WORKFLOW)
  const [selected, setSelected] = useState<Array<string>>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTo, setAssignTo] = useState<Array<Id<"people">>>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<SpeakerRosterRow | null>(null)

  const { data: rows } = useQuery(
    convexQuery(
      api.dashboard.speakersRoster,
      event ? { eventId: event._id } : "skip",
    ),
  )

  const counts = useMemo(() => {
    const all = rows ?? []
    const attention = all.filter(
      (row) =>
        row.missing.length > 0 || row.tasks.done < row.tasks.total,
    ).length
    return { all: all.length, attention, ready: all.length - attention }
  }, [rows])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((row) => {
      const needsAttention =
        row.missing.length > 0 || row.tasks.done < row.tasks.total
      if (tab === "attention" && !needsAttention) return false
      if (tab === "ready" && needsAttention) return false
      if (workflow !== ALL_WORKFLOW && row.workflowStatus !== workflow) {
        return false
      }
      if (!term) return true
      return (
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        (row.company ?? "").toLowerCase().includes(term) ||
        row.sessions.some((session) =>
          session.title.toLowerCase().includes(term),
        )
      )
    })
  }, [rows, search, tab, workflow])

  const speakerOptions = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        personId: row.personId,
        name: row.name,
        email: row.email,
        company: row.company,
      })),
    [rows],
  )

  function openAssign(personIds: Array<Id<"people">>) {
    setAssignTo(personIds)
    setAssignOpen(true)
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Speakers"
          description="Everyone speaking at your event, and what they still owe you."
        />
        <EmptyState
          icon={RiSettings3Line}
          title="Create your event first"
          description="Speakers appear here once you've set up an event and accepted your first submission."
          action={
            <Link to={APP_ROUTES.settings} className={buttonVariants()}>
              Go to settings
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Speakers"
        description="Everyone speaking at your event, and what they still owe you."
        actions={
          event ? (
            <>
              <RemindIncompleteButton
                eventId={event._id}
                incompleteCount={counts.attention}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAssign([])}
                disabled={speakerOptions.length === 0}
              >
                <RiListCheck3 aria-hidden />
                Assign task
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <RiUserAddLine aria-hidden />
                Add speaker
              </Button>
            </>
          ) : null
        }
      />

      <DataToolbar
        value={search}
        onValueChange={setSearch}
        placeholder="Search by name, email, company or session…"
        searchLabel="Search speakers"
        filters={
          <>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as FilterTab)}
            >
              <TabsList>
                {(Object.keys(TAB_LABELS) as Array<FilterTab>).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {TAB_LABELS[key]}
                    <span className="ml-1.5 tabular-nums opacity-60">
                      {counts[key]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select
              items={WORKFLOW_FILTER_OPTIONS}
              value={workflow}
              onValueChange={(value) => setWorkflow(String(value))}
            >
              <SelectTrigger
                size="sm"
                aria-label="Filter by speaker status"
                className="w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {selected.length > 0 ? (
        <Card
          size="sm"
          className="flex-row flex-wrap items-center gap-3 border border-primary/20 bg-accent px-4"
        >
          <p className="text-sm font-medium text-foreground">
            {selected.length} speaker{selected.length === 1 ? "" : "s"} selected
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openAssign(selected as Array<Id<"people">>)}
            >
              <RiListCheck3 aria-hidden />
              Assign task to selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
          </div>
        </Card>
      ) : null}

      {rows === undefined ? (
        <SpeakersTableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RiUserVoiceLine}
          title="No speakers yet"
          description="Speakers land here automatically the moment you accept a submission — or add a keynote, sponsor or moderator by hand. Then you can assign them tasks, copy their portal link, and track what's missing."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setAddOpen(true)}>
                <RiUserAddLine aria-hidden />
                Add speaker
              </Button>
              <Link
                to={APP_ROUTES.submissions}
                className={buttonVariants({ variant: "outline" })}
              >
                Review submissions
              </Link>
            </div>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={RiUserVoiceLine}
          title="No speaker matches this view"
          description="Try a different search term, or switch back to All speakers."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setTab("all")
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <SpeakersTable
          rows={visible}
          selected={selected}
          onSelectedChange={setSelected}
          onAssignTask={(personId) => openAssign([personId])}
          onEditProfile={setEditing}
        />
      )}

      {event ? (
        <>
          <AssignTaskDialog
            eventId={event._id}
            speakers={speakerOptions}
            open={assignOpen}
            onOpenChange={setAssignOpen}
            initialPersonIds={assignTo}
          />
          <AddSpeakerDialog
            eventId={event._id}
            open={addOpen}
            onOpenChange={setAddOpen}
          />
        </>
      ) : null}

      <SpeakerProfileDrawer
        speaker={editing}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
      />
    </div>
  )
}

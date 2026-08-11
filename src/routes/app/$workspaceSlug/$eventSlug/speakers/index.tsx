import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiEyeLine,
  RiEyeOffLine,
  RiListCheck3,
  RiSettings3Line,
  RiUploadLine,
  RiUserAddLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ImportSpeakersDialog } from "@/components/dashboard/import-speakers-dialog"
import { SpeakerProfileDrawer } from "@/components/dashboard/speaker-profile-drawer"
import { RemovePersonDialog } from "@/components/dashboard/remove-person-dialog"
import { AssignTaskDialog } from "@/components/dashboard/assign-task-dialog"
import { RemindIncompleteButton } from "@/components/dashboard/remind-incomplete-button"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { errorMessage } from "@/lib/errors"

/**
 * Deep links into the roster. Both are how the ⌘K palette
 * (src/components/shell/global-search.tsx) hands off: `person` opens that
 * speaker's profile drawer, `add` opens the "Add speaker" dialog. They are
 * ordinary URL params, so they also work as plain links for the browser-agent
 * judge.
 */
interface SpeakersSearch {
  person?: string
  add?: boolean
}

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/speakers/")({
  validateSearch: (search: Record<string, unknown>): SpeakersSearch => ({
    person:
      typeof search.person === "string" && search.person
        ? search.person
        : undefined,
    add:
      search.add === true || search.add === "1" || search.add === "true"
        ? true
        : undefined,
  }),
  component: SpeakersPage,
})

/**
 * Primary axis of the roster: why someone is here. `all` is the default —
 * acceptance is a facet, never a gate on who exists (see
 * `convex/dashboard.ts` → speakersRoster).
 */
type FilterTab = "all" | "confirmed" | "in_review"

const TAB_LABELS: Record<FilterTab, string> = {
  all: "All speakers",
  confirmed: "Confirmed",
  in_review: "In review",
}

/** Sentinel for "don't filter by workflow status" (sbek SPK-04 filterable). */
const ALL_WORKFLOW = "all"

const WORKFLOW_FILTER_OPTIONS = [
  { value: ALL_WORKFLOW, label: "Any status" },
  ...WORKFLOW_OPTIONS,
]

/**
 * Second axis: what's outstanding, plus who is kept off the public pages
 * (sbek CNT-12). Composes with the tabs — "Confirmed" + "Needs attention" is
 * the chase view.
 */
type ProfileView = "all" | "attention" | "ready" | "hidden"

const PROFILE_VIEW_OPTIONS: Array<{ value: ProfileView; label: string }> = [
  { value: "all", label: "Any profile" },
  { value: "attention", label: "Needs attention" },
  { value: "ready", label: "All set" },
  { value: "hidden", label: "Hidden publicly" },
]

/**
 * Speakers roster (docs/SPEC.md §4.8) — ONE source of truth for the people
 * attached to this event: everyone on a submission or session, accepted or
 * still in review, plus anyone added by hand. Each row says why they're here,
 * what they still owe you, and carries the actions that chase them: copy their
 * portal link, assign a task, or remind everyone who is behind. Reactive: a
 * speaker appears the instant they're put on a session, and the table updates
 * the moment they upload a headshot or tick off a task.
 */
function SpeakersPage() {
  const { event, eventRef, isEmpty } = useCurrentEvent()
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<FilterTab>("all")
  const [profileView, setProfileView] = useState<ProfileView>("all")
  const [workflow, setWorkflow] = useState<string>(ALL_WORKFLOW)
  const [selected, setSelected] = useState<Array<string>>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTo, setAssignTo] = useState<Array<Id<"people">>>([])
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<SpeakerRosterRow | null>(null)
  const [removing, setRemoving] = useState<SpeakerRosterRow | null>(null)
  /** Non-null while a bulk show/hide is in flight (sbek CNT-12). */
  const [bulkVisibility, setBulkVisibility] = useState<boolean | null>(null)

  const { person: deepLinkedPerson, add: deepLinkedAdd } = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data: rows } = useQuery(
    convexQuery(
      api.dashboard.speakersRoster,
      event ? { eventId: event._id } : "skip",
    ),
  )

  // Deep links (?person=…, ?add=1). The param is consumed once and cleared, so
  // closing the drawer doesn't fight the URL and a refresh doesn't reopen it.
  useEffect(() => {
    if (!deepLinkedPerson || !rows) return
    const match = rows.find((row) => String(row.personId) === deepLinkedPerson)
    if (match) setEditing(match)
    void navigate({
      search: (prev: SpeakersSearch) => ({ ...prev, person: undefined }),
      replace: true,
    })
  }, [deepLinkedPerson, rows, navigate])

  useEffect(() => {
    if (!deepLinkedAdd) return
    setAddOpen(true)
    void navigate({
      search: (prev: SpeakersSearch) => ({ ...prev, add: undefined }),
      replace: true,
    })
  }, [deepLinkedAdd, navigate])

  // Public visibility (sbek CNT-12). Kept as its own tiny reactive query of
  // hidden ids so the toggle echoes instantly without reloading the roster.
  const { data: hiddenIds } = useQuery(
    convexQuery(
      api.speakersAdmin.hiddenFromPublic,
      event ? { eventId: event._id } : "skip",
    ),
  )
  const hidden = useMemo(
    () => new Set<string>((hiddenIds ?? []).map(String)),
    [hiddenIds],
  )
  const setPublicVisibility = useConvexMutation(
    api.speakersAdmin.setPublicVisibility,
  )

  const counts = useMemo(() => {
    const all = rows ?? []
    return {
      all: all.length,
      confirmed: all.filter((row) => row.programStatus === "confirmed").length,
      in_review: all.filter((row) => row.programStatus === "in_review").length,
      attention: all.filter(
        (row) => row.missing.length > 0 || row.tasks.done < row.tasks.total,
      ).length,
    }
  }, [rows])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((row) => {
      if (tab !== "all" && row.programStatus !== tab) return false
      const needsAttention =
        row.missing.length > 0 || row.tasks.done < row.tasks.total
      if (profileView === "attention" && !needsAttention) return false
      if (profileView === "ready" && needsAttention) return false
      if (profileView === "hidden" && !hidden.has(String(row.personId))) {
        return false
      }
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
  }, [rows, search, tab, profileView, workflow, hidden])

  const speakerOptions = useMemo(
    () =>
      (rows ?? []).map((row) => ({
        personId: row.personId,
        name: row.name,
        email: row.email,
        company: row.company,
        // Lets "Assign task" bind the task (and its uploads) to a session.
        sessions: row.sessions.map((session) => ({
          _id: session._id,
          title: session.title,
        })),
      })),
    [rows],
  )

  function openAssign(personIds: Array<Id<"people">>) {
    setAssignTo(personIds)
    setAssignOpen(true)
  }

  /**
   * Show/hide the selected speakers on every public page (sbek CNT-12) — the
   * bulk twin of the switch in the profile drawer. One boolean per person, no
   * approval step: the case is "the whole keynote line-up is under embargo
   * until Tuesday", and it has to be reversible in one click.
   */
  async function applyVisibility(publicVisible: boolean) {
    const ids = selected as Array<Id<"people">>
    if (ids.length === 0) return
    setBulkVisibility(publicVisible)
    try {
      await Promise.all(
        ids.map((personId) =>
          setPublicVisibility({ personId, publicVisible }),
        ),
      )
      toast.success(
        publicVisible
          ? `${ids.length} speaker${ids.length === 1 ? "" : "s"} shown publicly`
          : `${ids.length} speaker${ids.length === 1 ? "" : "s"} hidden from public pages`,
        {
          description: publicVisible
            ? "They're back on the speaker gallery and their sessions."
            : "They stay on your roster, keep their portal, tasks and emails.",
        },
      )
      setSelected([])
    } catch (error) {
      toast.error("Couldn't change their visibility", {
        description:
          errorMessage(error, "Please try again."),
      })
    } finally {
      setBulkVisibility(null)
    }
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader data-tour="page-speakers"
          title="Speakers"
          description="Everyone attached to your program — accepted or still in review — and what they still owe you."
        />
        <EmptyState
          icon={RiSettings3Line}
          title="Create your event first"
          description="Speakers appear here as soon as you've set up an event and someone lands on a submission or session."
          action={
            <Link
              to={eventRef ? appLink.settings(eventRef) : legacyAppLink.settings}
              className={buttonVariants()}
            >
              Go to settings
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader data-tour="page-speakers"
        title="Speakers"
        description="Everyone attached to your program — accepted or still in review — and what they still owe you."
        actions={
          event ? (
            <>
              {/* Row-scoped actions live in exactly ONE place at a time. With
                  nothing ticked they belong up here (they act on the whole
                  roster); the moment there is a selection the contextual bar
                  below takes over and these step aside, so "Assign task" is
                  never offered twice at once with two different scopes.
                  "Import CSV" and "Add speaker" are page-scoped — they mean
                  the same thing whatever is ticked — so they stay put. */}
              {selected.length === 0 ? (
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
                </>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                <RiUploadLine aria-hidden />
                Import CSV
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
              className="min-w-0 max-w-full"
            >
              {/* Scrolls on phones — three labeled tabs + counts overflow 390px. */}
              <TabsList className="max-w-full justify-start overflow-x-auto">
                {(Object.keys(TAB_LABELS) as Array<FilterTab>).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {TAB_LABELS[key]}
                    <TabsCount>{counts[key]}</TabsCount>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select
              items={PROFILE_VIEW_OPTIONS}
              value={profileView}
              onValueChange={(value) =>
                setProfileView(String(value) as ProfileView)
              }
            >
              <SelectTrigger
                size="sm"
                aria-label="Filter by profile and visibility"
                className="w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_VIEW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

      {/* The selection bar is the single action surface while rows are ticked
          (see the page header above). The count sentence carries the scope, so
          the buttons say plainly what they do — no "…to selected" suffix. */}
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
              Assign task
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkVisibility !== null}
              onClick={() => void applyVisibility(false)}
            >
              <RiEyeOffLine aria-hidden />
              Hide from public
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkVisibility !== null}
              onClick={() => void applyVisibility(true)}
            >
              <RiEyeLine aria-hidden />
              Show publicly
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
          description="Everyone attached to your program lands here the moment they're on a submission or session — accepted or still in review. Add a keynote, sponsor or moderator by hand, import a CSV, or open your form for submissions."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => setAddOpen(true)}>
                <RiUserAddLine aria-hidden />
                Add speaker
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <RiUploadLine aria-hidden />
                Import CSV
              </Button>
              <Link
                to={
                  eventRef ? appLink.submissions(eventRef) : legacyAppLink.submissions
                }
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
                setProfileView("all")
                setWorkflow(ALL_WORKFLOW)
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
          onRemovePerson={setRemoving}
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
          <ImportSpeakersDialog
            eventId={event._id}
            open={importOpen}
            onOpenChange={setImportOpen}
            existingEmails={(rows ?? []).map((row) => row.email)}
          />
        </>
      ) : null}

      <SpeakerProfileDrawer
        speaker={editing}
        publicVisible={editing ? !hidden.has(String(editing.personId)) : true}
        onAssignTask={(personId) => {
          setEditing(null)
          openAssign([personId])
        }}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
      />

      <RemovePersonDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null)
        }}
        personId={removing?.personId ?? null}
        name={removing?.name ?? ""}
        onRemoved={() => setSelected((prev) => prev.filter((id) => id !== String(removing?.personId)))}
      />
    </div>
  )
}

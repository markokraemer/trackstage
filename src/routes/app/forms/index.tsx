import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiAddLine, RiSettings3Line, RiSurveyLine } from "@remixicon/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentEvent } from "@/components/dashboard/use-current-event"
import { FormCard } from "@/components/forms-builder/form-card"
import { friendlyError } from "@/components/forms-builder/model"

export const Route = createFileRoute("/app/forms/")({
  component: FormsListPage,
})

type StatusFilter = "all" | "open" | "closed"

/**
 * Submission forms list (docs/SPEC.md §4.2, docs/ux/02 image15).
 *
 * Every card carries the public link, so an organizer never has to hunt for it
 * — the single loudest complaint in swyx's walkthrough.
 */
function FormsListPage() {
  const { event, isEmpty } = useCurrentEvent()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: forms } = useQuery(
    convexQuery(api.forms.list, event ? { eventId: event._id } : "skip"),
  )

  const duplicateForm = useConvexMutation(api.forms.duplicate)
  const removeForm = useConvexMutation(api.forms.remove)
  const updateForm = useConvexMutation(api.forms.update)

  async function run(id: string, action: () => Promise<unknown>, fallback: string) {
    setBusyId(id)
    try {
      await action()
    } catch (error) {
      toast.error(friendlyError(error, fallback))
    } finally {
      setBusyId(null)
    }
  }

  const newFormLink = (
    <Link to="/app/forms/new" className={buttonVariants({ size: "sm" })}>
      <RiAddLine aria-hidden />
      New form
    </Link>
  )

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Submission forms"
          description="Collect talk proposals and speaker details in one place."
        />
        <EmptyState
          icon={RiSettings3Line}
          title="Create your event first"
          description="A form belongs to an event — it holds your deadline, tracks and speakers. Setting one up takes under two minutes."
          action={
            <Link to="/app/settings" className={buttonVariants()}>
              Go to settings
            </Link>
          }
        />
      </div>
    )
  }

  const counts = {
    all: forms?.length ?? 0,
    open: forms?.filter((form) => form.status === "open").length ?? 0,
    closed: forms?.filter((form) => form.status === "closed").length ?? 0,
  }

  const visible = (forms ?? [])
    .filter((form) => (status === "all" ? true : form.status === status))
    .filter((form) => {
      const needle = search.trim().toLowerCase()
      if (needle.length === 0) return true
      return (
        form.internalName.toLowerCase().includes(needle) ||
        form.externalTitle.toLowerCase().includes(needle) ||
        form.slug.toLowerCase().includes(needle)
      )
    })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Submission forms"
        description="Collect talk proposals and speaker details, then share one link."
        actions={newFormLink}
      />

      <DataToolbar
        value={search}
        onValueChange={setSearch}
        placeholder="Search forms…"
        searchLabel="Search forms"
        filters={
          <Tabs
            value={status}
            onValueChange={(value) => setStatus(String(value) as StatusFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All {counts.all}</TabsTrigger>
              <TabsTrigger value="open">Open {counts.open}</TabsTrigger>
              <TabsTrigger value="closed">Closed {counts.closed}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {forms === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <Card key={index} className="gap-3 p-5">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-72" />
            </Card>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <EmptyState
          icon={RiSurveyLine}
          title="No submission forms yet"
          description="A submission form is your call for papers: you choose the questions, share one public link, and proposals land in your Submissions list ready to review."
          action={
            <Link to="/app/forms/new" className={buttonVariants()}>
              <RiAddLine aria-hidden />
              Create your first form
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={RiSurveyLine}
          title="No forms match that"
          description="Try a different search, or switch back to the All tab."
          action={newFormLink}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((form) => (
            <FormCard
              key={form._id}
              busy={busyId === form._id}
              form={{
                _id: form._id,
                internalName: form.internalName,
                externalTitle: form.externalTitle,
                slug: form.slug,
                kind: form.kind,
                status: form.status,
                closeAt: form.closeAt,
                submissionCount: form.submissionCount,
                draftCount: form.draftCount,
              }}
              onDuplicate={() =>
                void run(
                  form._id,
                  async () => {
                    await duplicateForm({ formId: form._id })
                    toast.success(`“${form.internalName}” duplicated.`)
                  },
                  "We couldn't duplicate that form.",
                )
              }
              onDelete={() =>
                void run(
                  form._id,
                  async () => {
                    await removeForm({ formId: form._id })
                    toast.success(`“${form.internalName}” deleted.`)
                  },
                  "We couldn't delete that form.",
                )
              }
              onToggleStatus={() =>
                void run(
                  form._id,
                  async () => {
                    const next = form.status === "closed" ? "open" : "closed"
                    await updateForm({
                      formId: form._id,
                      patch: { status: next },
                    })
                    toast.success(
                      next === "closed"
                        ? "Form closed — the public link now shows a closed message."
                        : "Form reopened — people can submit again.",
                    )
                  },
                  "We couldn't change that form's status.",
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

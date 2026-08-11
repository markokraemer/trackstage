import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { RiCalendarEventLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { SubmissionCard } from "@/components/portal/submission-card"
import { SubmissionDrawer } from "@/components/portal/submission-drawer"
import { usePortal } from "@/components/portal/portal-context"
import { submissionCode } from "@/components/portal/portal-utils"

export const Route = createFileRoute("/portal/submissions")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { open?: string } => ({
    open: typeof search.open === "string" ? search.open : undefined,
  }),
  component: PortalSubmissionsPage,
})

/**
 * Submissions tab: every talk this speaker submitted or is a participant on.
 * Opening one is a real URL (`?open=<id>`), so links from Home and the browser
 * back button both land in the right place.
 */
function PortalSubmissionsPage() {
  const { home } = usePortal()
  const navigate = useNavigate()
  const { open } = Route.useSearch()

  const submissions = home.submissions
  const total = submissions.length
  const activeIndex = submissions.findIndex((item) => item.id === open)
  const active = activeIndex >= 0 ? submissions[activeIndex] : null

  function setOpen(id: string | undefined) {
    void navigate({
      to: "/portal/submissions",
      search: id ? { open: id } : {},
      replace: true,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Submissions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total === 0
            ? "Talks you submit to this event show up here."
            : "Your talks and their current status. Open one to read it in full — and to edit it, for as long as this event allows changes."}
        </p>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={RiCalendarEventLine}
          title="No submissions yet"
          description="A submission is a talk you've proposed for this event. Once you send one through the event's call for speakers, it appears here with its review status."
        />
      ) : (
        <div className="grid gap-3">
          {submissions.map((submission, index) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              code={submissionCode(index, total)}
              detailed
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(submission.id)}
                >
                  View details
                </Button>
              }
            />
          ))}
        </div>
      )}

      {active ? (
        <SubmissionDrawer
          key={active.id}
          submission={active}
          code={submissionCode(activeIndex, total)}
          open
          onOpenChange={(next) => {
            if (!next) setOpen(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

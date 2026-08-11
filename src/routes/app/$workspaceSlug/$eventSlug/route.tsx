import { useEffect } from "react"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { RiCalendarEventLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { appLink } from "@/lib/app-links"
import { setCurrentEventId, useCurrentEvent } from "@/lib/current-event"

/**
 * The EVENT SCOPE of the organizer app —
 * `/app/:workspaceSlug/:eventSlug/{…section}` (docs/memory/DECISIONS.md,
 * "URL architecture is fully hierarchical").
 *
 * The address IS the context: every screen below reads the event through
 * `useCurrentEvent`, which resolves these two params against the
 * access-filtered `events.list`, so two tabs on two events stay on two
 * events — no shared-pointer bleed. This layout only has to do three things:
 *
 *   1. Hold the skeleton while the lists load (never flash "not found").
 *   2. Render "Event not found." when the address doesn't resolve — which by
 *      construction covers BOTH a nonexistent event and one this member is
 *      scoped out of (docs/memory/RULES.md 23: the two must be
 *      indistinguishable, down to the words).
 *   3. Keep the localStorage pointer in step, so bare legacy paths
 *      (`/app/submissions`) keep resolving to "the event I last touched".
 */
export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug")({
  component: EventScopeLayout,
})

function EventScopeLayout() {
  const { event, workspace, urlEventMissing } = useCurrentEvent()

  // The store survives as the fallback for bare legacy paths and for global
  // pages (/app/account) — visiting a canonical address is what "touching an
  // event" means now.
  useEffect(() => {
    if (event) setCurrentEventId(event._id, event.organizationId)
  }, [event])

  if (urlEventMissing) {
    return (
      <EmptyState
        icon={RiCalendarEventLine}
        title="Event not found."
        description="There's no event at this address in a workspace you have access to. Pick an event from the switcher in the sidebar, or check the link."
        action={
          <Link
            to={workspace ? appLink.workspaceHub(workspace.slug) : appLink.app}
            className={buttonVariants({ variant: "outline" })}
          >
            Go to your workspace
          </Link>
        }
        className="mx-auto mt-16 max-w-lg"
      />
    )
  }

  if (!event) {
    // Lists still loading — a content-shaped skeleton, never a spinner.
    return (
      <div aria-busy="true" className="flex flex-col gap-6">
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
        <p className="sr-only">Loading…</p>
      </div>
    )
  }

  return <Outlet />
}

import { useEffect } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { appLink } from "@/lib/app-links"
import type { EventRef, EventSection } from "@/lib/app-links"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import {
  EmptyEventState,
  FirstRunDashboard,
} from "@/components/shell/empty-event-state"

/**
 * Resolver for BARE legacy organizer paths (`/app/submissions`, `/app`,
 * `/app/forms/123`, …) — every bookmark, muscle-memory URL and pre-hierarchy
 * link from before `/app/:workspaceSlug/:eventSlug/…` existed
 * (docs/memory/DECISIONS.md, "URL architecture is fully hierarchical").
 *
 * These are ALSO where the sidebar points while no event exists yet, so the
 * no-event case must render a real screen, not bounce away: a workspace with
 * zero events used to redirect every section to the workspace hub, which made
 * the whole sidebar read as dead nav (regression fixed 2026-08-11). Fallback
 * ladder:
 *
 *   event in context      → its canonical address for this section
 *   no event, resolved    → the section's own empty state, rendered in place
 *                           (`section`), or the workspace hub when this route
 *                           has no section identity (`/app/workspace`)
 *   nothing yet           → hold the skeleton; `workspaces.ensure` is already
 *                           creating the first workspace, and this re-renders
 *                           the moment it lands.
 */
export function LegacyAppRedirect({
  to,
  section,
}: {
  /** Canonical target for the event in context; omitted ⇒ the workspace hub. */
  to?: (ref: EventRef) => string
  /**
   * Which section's empty state to render when there is no event to redirect
   * to. `"dashboard"` gets the first-run hero. Omitted ⇒ fall back to the
   * workspace hub (only `/app/workspace` does this — it IS the hub's alias).
   */
  section?: EventSection | "dashboard"
}) {
  const navigate = useNavigate()
  const searchStr = useRouterState({
    select: (state) => state.location.searchStr,
  })
  // A navigation already in flight outranks this fallback redirect. Concretely:
  // creating an event from a section's empty state updates the reactive event
  // list while the create dialog is navigating to the new event's dashboard —
  // without this check, the redirect below preempts that navigation and the
  // organizer lands wherever this section points instead.
  const navStatus = useRouterState({ select: (state) => state.status })
  const { event, workspace, isEmpty } = useCurrentEvent()

  const target =
    to && event
      ? to(eventRefOf(event))
      : !section && workspace
        ? appLink.workspaceHub(workspace.slug)
        : undefined

  useEffect(() => {
    if (!target || navStatus !== "idle") return
    void navigate({ href: `${target}${searchStr}`, replace: true })
  }, [target, searchStr, navigate, navStatus])

  // No event anywhere in context, lists resolved: this section renders in the
  // shell with its purposeful empty state — the sidebar must never dead-end.
  if (section && isEmpty) {
    return section === "dashboard" ? (
      <FirstRunDashboard />
    ) : (
      <EmptyEventState section={section} />
    )
  }

  // A content-shaped skeleton, never a spinner (rule 26). Visible only for
  // the redirect's single frame — or while a brand-new account's first
  // workspace is still being created.
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
      <p className="sr-only">Taking you to your event…</p>
    </div>
  )
}

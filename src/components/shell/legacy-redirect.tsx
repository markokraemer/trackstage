import { useEffect } from "react"
import { useNavigate, useRouterState } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { appLink } from "@/lib/app-links"
import type { EventRef } from "@/lib/app-links"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"

/**
 * Resolver for BARE legacy organizer paths (`/app/submissions`, `/app`,
 * `/app/forms/123`, …) — every bookmark, muscle-memory URL and pre-hierarchy
 * link from before `/app/:workspaceSlug/:eventSlug/…` existed
 * (docs/memory/DECISIONS.md, "URL architecture is fully hierarchical").
 *
 * The stored event pointer (src/lib/current-event.ts) answers "which event
 * did this person mean?" — the event they last touched — and the redirect
 * replaces the bare path with that event's canonical address, so the URL bar
 * always ends up telling the truth. Fallback ladder:
 *
 *   event in context      → its canonical address for this section
 *   only a workspace      → the workspace hub (create an event is next)
 *   nothing yet           → hold the skeleton; `workspaces.ensure` is already
 *                           creating the first workspace, and this re-renders
 *                           the moment it lands.
 */
export function LegacyAppRedirect({
  to,
}: {
  /** Canonical target for the event in context; omitted ⇒ the workspace hub. */
  to?: (ref: EventRef) => string
}) {
  const navigate = useNavigate()
  const searchStr = useRouterState({
    select: (state) => state.location.searchStr,
  })
  const { event, workspace, isLoading } = useCurrentEvent()

  const target =
    to && event
      ? to(eventRefOf(event))
      : workspace
        ? appLink.workspaceHub(workspace.slug)
        : undefined

  useEffect(() => {
    if (!target) return
    void navigate({ href: `${target}${searchStr}`, replace: true })
  }, [target, searchStr, navigate])

  // A content-shaped skeleton, never a spinner (rule 26). Visible only for
  // the redirect's single frame — or while a brand-new account's first
  // workspace is still being created.
  void isLoading
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

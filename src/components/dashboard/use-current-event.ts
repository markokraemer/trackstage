import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { useSession } from "@/lib/session"

/**
 * The event the organizer is working on.
 *
 * The app shell is single-event by design (docs/SPEC.md §3 — the sidebar is
 * event-scoped), so every organizer screen resolves "the current event" the
 * same way: the first event across the workspaces the signed-in user belongs
 * to. Auth is ambient — `api.events.list` takes no token.
 */
export function useCurrentEvent() {
  const { status } = useSession()
  const { data } = useQuery(
    convexQuery(api.events.list, status === "authenticated" ? {} : "skip"),
  )

  return {
    event: data?.[0],
    /** True until the event list has resolved — render skeletons, not spinners. */
    isLoading: data === undefined,
    /** Resolved, and the organizer has no event yet. */
    isEmpty: data !== undefined && data.length === 0,
  }
}

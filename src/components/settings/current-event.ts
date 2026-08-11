import { useCallback, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { FunctionReturnType } from "convex/server"

/**
 * Current-event context (docs/reference/sbek-rubric.md CFP-17 / CFP-18).
 *
 * One organizer can run several events, and every event's data is isolated.
 * The app shell is event-scoped, so "which event am I looking at?" is app-wide
 * state. It lives in `localStorage` (survives reloads, no round-trip, zero
 * flicker) behind a tiny external store so every component that reads it
 * re-renders the moment it changes.
 *
 * INTEGRATOR NOTE: `src/routes/app/route.tsx` currently hardcodes
 * `events?.[0]`. Swapping those two lines for `useCurrentEvent()` makes the
 * sidebar follow the switcher. This module is deliberately dependency-free so
 * it can move to `src/lib/` verbatim.
 */

export type EventSummary = FunctionReturnType<typeof api.events.list>[number]

const STORAGE_KEY = "sessionboard.currentEventId"

const listeners = new Set<() => void>()

function readStored(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener)
  }
  return () => {
    listeners.delete(listener)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener)
    }
  }
}

/** Remember the event the organizer is working on. Notifies every reader. */
export function selectEvent(eventId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, eventId)
  } catch {
    /* private mode — fall back to first-event behaviour */
  }
  for (const listener of listeners) listener()
}

/** The stored id, or `null` on the server / before a choice is made. */
export function useSelectedEventId(): string | null {
  return useSyncExternalStore(
    subscribe,
    readStored,
    () => null,
  )
}

export interface CurrentEventResult {
  /** Every event across every workspace the organizer belongs to. */
  events: Array<EventSummary>
  /** The event in context — the stored one, else the first one. */
  event: EventSummary | undefined
  isLoading: boolean
  selectEvent: (eventId: string) => void
}

/**
 * The event the organizer is working on, plus the full list for switchers.
 * Falls back to the first event so a brand-new account is never stuck.
 */
export function useCurrentEvent(): CurrentEventResult {
  const { data, isPending } = useQuery(convexQuery(api.events.list, {}))
  const selectedId = useSelectedEventId()
  const events = data ?? []
  const event = events.find((row) => row._id === selectedId) ?? events[0]

  return {
    events,
    event,
    isLoading: isPending,
    selectEvent: useCallback((eventId: string) => selectEvent(eventId), []),
  }
}

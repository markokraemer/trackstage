import { useCallback, useEffect, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { FunctionReturnType } from "convex/server"

import { useSession } from "@/lib/session"

/**
 * The hierarchy (docs/memory/RULES.md 23):
 *
 *     User → member of → Workspace (organization) → owns → Events → everything
 *
 * One organizer can run several events, and every event's data is isolated, so
 * "which event am I looking at?" is app-wide state that every organizer screen
 * must resolve the same way. It lives in `localStorage` (survives reloads, no
 * round-trip, zero flicker) behind a tiny external store, so every reader
 * re-renders the moment the switcher changes it.
 *
 * This module is the single source of truth for event context. Nothing in the
 * app may reach for `api.events.list[0]` directly.
 */

export type EventSummary = FunctionReturnType<typeof api.events.list>[number]
export type WorkspaceSummary = FunctionReturnType<
  typeof api.workspaces.mine
>[number]

const STORAGE_KEY = "sb.currentEventId"
/** Pre-rule-23 key — read once so open tabs keep their context. */
const LEGACY_STORAGE_KEY = "sessionboard.currentEventId"

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function readStored(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      window.localStorage.setItem(STORAGE_KEY, legacy)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      return legacy
    }
    return null
  } catch {
    return null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (typeof window !== "undefined") {
    // Other tabs switching event should move this one too.
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
export function setCurrentEventId(eventId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, eventId)
  } catch {
    /* private mode — fall back to first-event behaviour */
  }
  notify()
}

/** Forget the stored choice (e.g. after deleting the event in context). */
export function clearCurrentEventId(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  notify()
}

/** The stored id, or `null` on the server / before a choice is made. */
export function useCurrentEventId(): string | null {
  return useSyncExternalStore(subscribe, readStored, () => null)
}

export interface CurrentEventResult {
  /** Every event across every workspace the organizer belongs to. */
  events: Array<EventSummary>
  /** The event in context — the stored one, else the first one. */
  event: EventSummary | undefined
  /** Every workspace the organizer belongs to (for the workspace switcher). */
  workspaces: Array<WorkspaceSummary>
  /** The workspace that owns the current event. */
  workspace: WorkspaceSummary | undefined
  /** True until the event list has resolved — render skeletons, not spinners. */
  isLoading: boolean
  /** Resolved, and the organizer has no event yet. */
  isEmpty: boolean
  /** Switch the whole app to another event. */
  setCurrentEventId: (eventId: string) => void
  /** Alias kept for call sites that read better as "select". */
  selectEvent: (eventId: string) => void
  /**
   * Switch workspace by moving context to that workspace's first event.
   * Returns false when the workspace has no events yet (send them to
   * `/app/events` to create one).
   */
  selectWorkspace: (workspaceId: string) => boolean
}

/**
 * The event the organizer is working on, plus everything a switcher needs.
 * Falls back to the first event so a brand-new account is never stuck, and
 * clears a stored id that no longer resolves (deleted event, signed out of
 * that workspace, another user on the same browser).
 */
export function useCurrentEvent(): CurrentEventResult {
  const { status } = useSession()
  const authedArgs = status === "authenticated" ? {} : "skip"

  const { data: eventData, isPending: eventsPending } = useQuery(
    convexQuery(api.events.list, authedArgs),
  )
  const { data: workspaceData, isPending: workspacesPending } = useQuery(
    convexQuery(api.workspaces.mine, authedArgs),
  )

  const storedId = useCurrentEventId()
  const events = eventData ?? []
  const workspaces = workspaceData ?? []

  const stored = events.find((row) => row._id === storedId)
  const event = stored ?? events.at(0)
  const workspace = event
    ? workspaces.find((row) => row.id === event.organizationId)
    : undefined

  // Stale pointer: the id survived but the event didn't. Drop it so the
  // fallback becomes the real, persisted choice on the next switch.
  useEffect(() => {
    if (!storedId) return
    if (eventData === undefined) return
    if (events.some((row) => row._id === storedId)) return
    clearCurrentEventId()
  }, [storedId, eventData, events])

  const select = useCallback((eventId: string) => {
    setCurrentEventId(eventId)
  }, [])

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      const first = events.find((row) => row.organizationId === workspaceId)
      if (!first) return false
      setCurrentEventId(first._id)
      return true
    },
    [events],
  )

  return {
    events,
    event,
    workspaces,
    workspace,
    isLoading: status === "loading" || eventsPending || workspacesPending,
    isEmpty: eventData !== undefined && events.length === 0,
    setCurrentEventId: select,
    selectEvent: select,
    selectWorkspace,
  }
}

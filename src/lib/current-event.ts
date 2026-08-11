import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
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
 * One organizer can belong to several workspaces and run several events in
 * each, and every event's data is isolated, so "which workspace / which event
 * am I looking at?" is app-wide state that every organizer screen must resolve
 * the same way. It lives in `localStorage` (survives reloads, no round-trip,
 * zero flicker) behind a tiny external store, so every reader re-renders the
 * moment the switcher changes it.
 *
 * Two pointers, one rule: **the event pointer wins.** The workspace in context
 * is normally derived from the current event — the only thing that can't be
 * derived is an EMPTY workspace (one you belong to that owns no event you can
 * reach), so a second pointer carries exactly that case. Switching workspace
 * writes both pointers at once, clearing the event when the target is empty,
 * so the two can never disagree.
 *
 * This module is the single source of truth for event + workspace context.
 * Nothing in the app may reach for `api.events.list[0]` directly.
 */

export type EventSummary = FunctionReturnType<typeof api.events.list>[number]
export type WorkspaceSummary = FunctionReturnType<
  typeof api.workspaces.mine
>[number]

const STORAGE_KEY = "sb.currentEventId"
const WORKSPACE_STORAGE_KEY = "sb.currentWorkspaceId"
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

function readStoredWorkspace(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
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

/**
 * Write both pointers in one go and notify once — a workspace switch must
 * never render an intermediate state where the new workspace is in context
 * but the old event still is (that is the "flash" the switcher must not have).
 */
function writeContext(eventId: string | null, workspaceId: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (eventId) window.localStorage.setItem(STORAGE_KEY, eventId)
    else window.localStorage.removeItem(STORAGE_KEY)
    if (workspaceId) {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId)
    } else {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    }
  } catch {
    /* private mode — fall back to first-event behaviour */
  }
  notify()
}

/**
 * Remember the event the organizer is working on. Notifies every reader.
 * Pass the owning workspace when it is known so the workspace pointer follows
 * along (it only matters for empty workspaces, but keeping it in step means a
 * later event deletion still leaves the right workspace in context).
 */
export function setCurrentEventId(eventId: string, workspaceId?: string): void {
  writeContext(eventId, workspaceId ?? readStoredWorkspace())
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

/** The stored workspace pointer — only authoritative for empty workspaces. */
export function useStoredWorkspaceId(): string | null {
  return useSyncExternalStore(subscribe, readStoredWorkspace, () => null)
}

/** A workspace you belong to, with everything a switcher row needs to show. */
export interface WorkspaceOption extends WorkspaceSummary {
  /** Events in this workspace you can actually reach (members.eventIds). */
  events: Array<EventSummary>
  /** True when this is the workspace in context. */
  isCurrent: boolean
}

export interface CurrentEventResult {
  /** Every event across every workspace the organizer belongs to. */
  events: Array<EventSummary>
  /** Events owned by the workspace in context — the switcher's second level. */
  workspaceEvents: Array<EventSummary>
  /** The event in context — the stored one, else the workspace's first. */
  event: EventSummary | undefined
  /** Every workspace the organizer belongs to (for the workspace switcher). */
  workspaces: Array<WorkspaceSummary>
  /** The same list, enriched with per-workspace events + current flag. */
  workspaceOptions: Array<WorkspaceOption>
  /** The workspace in context. */
  workspace: WorkspaceSummary | undefined
  /** True until the event list has resolved — render skeletons, not spinners. */
  isLoading: boolean
  /** Resolved, and there is no event in context (new account, or an empty workspace). */
  isEmpty: boolean
  /** Resolved, and the workspace in context owns no event you can reach. */
  isWorkspaceEmpty: boolean
  /** Switch the whole app to another event. */
  setCurrentEventId: (eventId: string) => void
  /** Alias kept for call sites that read better as "select". */
  selectEvent: (eventId: string) => void
  /**
   * Switch the whole app to another workspace, landing on its first reachable
   * event. Returns false when the workspace has no events yet — context still
   * moves (the workspace pointer holds it), and the caller should send the
   * organizer to the workspace hub to create one.
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
  const storedWorkspaceId = useStoredWorkspaceId()
  const events = useMemo(() => eventData ?? [], [eventData])
  const workspaces = useMemo(() => workspaceData ?? [], [workspaceData])

  // Resolution order — the event pointer wins, the workspace pointer covers
  // the one case it can't express (a workspace with no events).
  const storedEvent = events.find((row) => row._id === storedId)
  const workspace =
    (storedEvent
      ? workspaces.find((row) => row.id === storedEvent.organizationId)
      : undefined) ??
    workspaces.find((row) => row.id === storedWorkspaceId) ??
    workspaces.find((row) => events.some((e) => e.organizationId === row.id)) ??
    workspaces.at(0)

  const workspaceEvents = useMemo(
    () =>
      workspace
        ? events.filter((row) => row.organizationId === workspace.id)
        : events,
    [events, workspace],
  )
  const event = storedEvent ?? workspaceEvents.at(0)

  const workspaceOptions = useMemo<Array<WorkspaceOption>>(
    () =>
      workspaces.map((row) => ({
        ...row,
        events: events.filter((e) => e.organizationId === row.id),
        isCurrent: row.id === workspace?.id,
      })),
    [workspaces, events, workspace],
  )

  // A stale EVENT pointer is dropped so the fallback becomes the real,
  // persisted choice on the next switch. The workspace pointer needs no such
  // cleanup — an id that no longer resolves simply falls through the chain
  // above, and clearing it would race a workspace created a moment ago.
  useEffect(() => {
    if (!storedId) return
    if (eventData === undefined) return
    if (events.some((row) => row._id === storedId)) return
    clearCurrentEventId()
  }, [storedId, eventData, events])

  const select = useCallback(
    (eventId: string) => {
      const row = events.find((candidate) => candidate._id === eventId)
      setCurrentEventId(eventId, row?.organizationId)
    },
    [events],
  )

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      const first = events.find((row) => row.organizationId === workspaceId)
      // One write, one render: the event pointer moves with the workspace (or
      // is cleared for an empty workspace) so nothing renders in between.
      writeContext(first?._id ?? null, workspaceId)
      return Boolean(first)
    },
    [events],
  )

  const resolved = eventData !== undefined && workspaceData !== undefined

  return {
    events,
    workspaceEvents,
    event,
    workspaces,
    workspaceOptions,
    workspace,
    isLoading: status === "loading" || eventsPending || workspacesPending,
    isEmpty: resolved && event === undefined,
    isWorkspaceEmpty: resolved && workspaceEvents.length === 0,
    setCurrentEventId: select,
    selectEvent: select,
    selectWorkspace,
  }
}

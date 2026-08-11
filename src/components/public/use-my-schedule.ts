import { useCallback, useSyncExternalStore } from "react"

/**
 * "My schedule" — the attendee's personal session picks.
 *
 * Deliberately anonymous: no account, no login wall, no server round trip. The
 * picks live in `localStorage` under an event-scoped key so they survive
 * reloads and stay isolated per event. A tiny external store keeps every star
 * button, the nav counter and the my-schedule page in sync within the tab, and
 * the `storage` event keeps other tabs honest.
 */

const EMPTY: ReadonlyArray<string> = []
const listeners = new Set<() => void>()
/** Cached parse keyed by the raw string, so snapshots stay referentially stable. */
const snapshots = new Map<string, { raw: string | null; value: Array<string> }>()

function storageKey(slug: string): string {
  return `sessionboard:my-schedule:${slug}`
}

function readRaw(slug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(slug))
  } catch {
    return null
  }
}

function parse(raw: string | null): Array<string> {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : []
  } catch {
    return []
  }
}

function getSnapshot(slug: string): ReadonlyArray<string> {
  if (typeof window === "undefined") return EMPTY
  const raw = readRaw(slug)
  const cached = snapshots.get(slug)
  if (cached && cached.raw === raw) return cached.value
  const value = parse(raw)
  snapshots.set(slug, { raw, value })
  return value
}

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onChange)
  }
  return () => {
    listeners.delete(onChange)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onChange)
    }
  }
}

function write(slug: string, ids: Array<string>) {
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(ids))
  } catch {
    // Private mode / quota — the UI still updates for this page view.
  }
  snapshots.set(slug, { raw: readRaw(slug), value: ids })
  emit()
}

export interface MySchedule {
  /** Session ids the visitor saved, in the order they saved them. */
  ids: ReadonlyArray<string>
  count: number
  has: (id: string) => boolean
  toggle: (id: string) => void
  remove: (id: string) => void
  clear: () => void
}

export function useMySchedule(slug: string): MySchedule {
  const ids = useSyncExternalStore(
    subscribe,
    () => getSnapshot(slug),
    () => EMPTY,
  )

  const has = useCallback((id: string) => ids.includes(id), [ids])

  const toggle = useCallback(
    (id: string) => {
      const next = ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id]
      write(slug, next)
    },
    [ids, slug],
  )

  const remove = useCallback(
    (id: string) => write(slug, ids.filter((value) => value !== id)),
    [ids, slug],
  )

  const clear = useCallback(() => write(slug, []), [slug])

  return { ids, count: ids.length, has, toggle, remove, clear }
}

/**
 * The one bit of onboarding state that must be readable OUTSIDE the app
 * shell: the login page sets this at signup so the very first paint of `/app`
 * is the full-screen onboarding takeover
 * (src/components/onboarding/onboarding-takeover.tsx), never a flash of the
 * shell. Kept in its own module so the login chunk doesn't pull the takeover
 * component in just for a string.
 */
export const FRESH_SIGNUP_KEY = "ts-fresh-signup"

export function markFreshSignup(): void {
  try {
    sessionStorage.setItem(FRESH_SIGNUP_KEY, "1")
  } catch {
    /* private mode — the takeover still appears once queries resolve */
  }
}

/**
 * The guided dashboard tour's position, surviving the navigations the tour
 * itself causes (dashboard → create dialog → event settings). Shared between
 * the takeover (which hands off into "welcome"), the new-event dialog (which
 * advances "create" → "details" and redirects accordingly) and the tour
 * component that runs the driver.js highlights.
 *
 * The tour can ONLY begin via this explicit handoff — existing accounts,
 * demo/seeded data and e2e sign-ins never see it because nothing ever writes
 * the key for them.
 */
export type TourPhase = "welcome" | "create" | "details"

const TOUR_PHASE_KEY = "ts-tour-phase"

/** Same-tab subscribers (sessionStorage fires no event in its own tab) —
 *  lets `?onboarding-redo` re-arm the tour without a navigation. */
const tourListeners = new Set<() => void>()

function notifyTour(): void {
  for (const listener of tourListeners) listener()
}

export function subscribeTourPhase(listener: () => void): () => void {
  tourListeners.add(listener)
  return () => tourListeners.delete(listener)
}

export function readTourPhase(): TourPhase | null {
  if (typeof window === "undefined") return null
  try {
    const value = sessionStorage.getItem(TOUR_PHASE_KEY)
    return value === "welcome" || value === "create" || value === "details"
      ? value
      : null
  } catch {
    return null
  }
}

export function writeTourPhase(phase: TourPhase): void {
  try {
    sessionStorage.setItem(TOUR_PHASE_KEY, phase)
  } catch {
    /* private mode — the tour simply won't run */
  }
  notifyTour()
}

export function clearTourPhase(): void {
  try {
    sessionStorage.removeItem(TOUR_PHASE_KEY)
    sessionStorage.removeItem(TOUR_INDEX_KEY)
  } catch {
    /* ignore */
  }
}

/** Position within the guided journey ("details" phase) — the tour spans
 *  several pages, and its own navigations must not reset it. */
const TOUR_INDEX_KEY = "ts-tour-index"

export function readTourIndex(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = sessionStorage.getItem(TOUR_INDEX_KEY)
    const value = raw === null ? 0 : Number.parseInt(raw, 10)
    return Number.isFinite(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export function writeTourIndex(index: number): void {
  try {
    sessionStorage.setItem(TOUR_INDEX_KEY, String(index))
  } catch {
    /* private mode — the tour simply restarts its page segment */
  }
}

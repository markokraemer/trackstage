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
 * The post-wizard WELCOME moment (confetti + one card —
 * src/components/onboarding/dashboard-tour.tsx). The step-by-step tour that
 * used to follow was removed end to end (Marko, final call); "welcome" is
 * the only phase left.
 *
 * It can ONLY appear via this explicit handoff — existing accounts,
 * demo/seeded data and e2e sign-ins never see it because nothing ever writes
 * the key for them.
 */
export type TourPhase = "welcome"

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
    return sessionStorage.getItem(TOUR_PHASE_KEY) === "welcome"
      ? "welcome"
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
    // Leftover from the removed step-by-step tour; clear it for old tabs.
    sessionStorage.removeItem("ts-tour-index")
  } catch {
    /* ignore */
  }
}

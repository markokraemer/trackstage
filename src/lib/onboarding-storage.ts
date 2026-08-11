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
}

export function clearTourPhase(): void {
  try {
    sessionStorage.removeItem(TOUR_PHASE_KEY)
  } catch {
    /* ignore */
  }
}

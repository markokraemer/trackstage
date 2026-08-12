/**
 * The one bit of onboarding state that must be readable OUTSIDE the app
 * shell: the login page sets this at signup so the very first paint of `/app`
 * is the full-screen onboarding takeover
 * (src/components/onboarding/onboarding-takeover.tsx), never a flash of the
 * shell. Kept in its own module so the login chunk doesn't pull the takeover
 * component in just for a string.
 */
export const FRESH_SIGNUP_KEY = "ts-fresh-signup"

/**
 * `/app?welcome=1` — "this arrival is a brand-new account", said in the URL.
 *
 * The only first-run hint that survives a trip through an email client. Signup
 * mints its confirmation link with this as the callback
 * (`…/api/auth/verify-email?token=…&callbackURL=%2Fapp%3Fwelcome%3D1`), so the
 * tab the link opens declares what it is in its own address — which means the
 * SERVER knows it too, and the first painted frame is the onboarding screen
 * rather than an organizer shell that has to be taken back a moment later.
 * Web storage cannot do this: `sessionStorage` never crosses tabs, and nothing
 * in storage is visible during SSR.
 */
export const WELCOME_PARAM = "welcome"
export const WELCOME_CALLBACK_URL = `/app?${WELCOME_PARAM}=1`

/**
 * The CROSS-TAB twin of the key above, and the reason there are two.
 *
 * `sessionStorage` is per-tab, and the single most important first-run arrival
 * happens in a tab that never saw the signup: the confirmation email's link
 * opens a NEW tab (which is what `WELCOME_CALLBACK_URL` above now covers, and
 * this backs up). The hint was always missing exactly where it mattered, so
 * before both of these existed the gate fell through
 * to "hide" and painted the ORGANIZER SHELL — sidebar, event switcher, dashboard
 * skeletons — at a brand-new account, until (or if) the queries that prove it is
 * first-run came back. `localStorage` crosses tabs, so the arrival paints the
 * onboarding frame from its first frame instead.
 *
 * Stamped with a time so a hint can never outlive its usefulness; cleared the
 * moment onboarding resolves either way (`clearFreshSignup`).
 */
const FRESH_SIGNUP_AT_KEY = "ts-fresh-signup-at"
const FRESH_SIGNUP_TTL_MS = 6 * 60 * 60 * 1000

export function markFreshSignup(): void {
  try {
    sessionStorage.setItem(FRESH_SIGNUP_KEY, "1")
    localStorage.setItem(FRESH_SIGNUP_AT_KEY, String(Date.now()))
  } catch {
    /* private mode — the takeover still appears once queries resolve */
  }
}

/** "This browser signed up moments ago" — either tab-local or cross-tab. */
export function isFreshSignup(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (sessionStorage.getItem(FRESH_SIGNUP_KEY) === "1") return true
    const at = Number(localStorage.getItem(FRESH_SIGNUP_AT_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < FRESH_SIGNUP_TTL_MS
  } catch {
    return false
  }
}

export function clearFreshSignup(): void {
  try {
    sessionStorage.removeItem(FRESH_SIGNUP_KEY)
    localStorage.removeItem(FRESH_SIGNUP_AT_KEY)
  } catch {
    /* private mode */
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

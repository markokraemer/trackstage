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

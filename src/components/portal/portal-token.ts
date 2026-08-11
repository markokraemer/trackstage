/**
 * Speaker portal access token (the magic link).
 *
 * Speakers never get a password — the organizer emails them a link that ends
 * in their personal token (`/portal/t/<token>`). We keep the token in
 * `localStorage` so the portal stays open on that device, exactly like a
 * "remember me" session, and so the tab bar can be ordinary links.
 */

export const PORTAL_TOKEN_KEY = "sb.portal"

/** A token that always exists in the seeded demo — used for the demo hint. */
export const DEMO_PORTAL_TOKEN = "demo-ava-nakamura"

export function readPortalToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(PORTAL_TOKEN_KEY)
    return value && value.trim().length > 0 ? value.trim() : null
  } catch {
    return null
  }
}

/** Fired whenever the stored token changes, so the shell can react instantly. */
export const PORTAL_TOKEN_EVENT = "sb:portal-token"

function announce(): void {
  window.dispatchEvent(new Event(PORTAL_TOKEN_EVENT))
}

export function writePortalToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PORTAL_TOKEN_KEY, token.trim())
  } catch {
    /* private mode — the portal still works for this page view */
  }
  announce()
}

export function clearPortalToken(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(PORTAL_TOKEN_KEY)
  } catch {
    /* ignore */
  }
  announce()
}

/**
 * Accepts whatever a speaker pastes: the full magic link, the `/portal/t/…`
 * path, or the bare code. Returns null when nothing usable is in there.
 */
export function parsePortalToken(input: string): string | null {
  const raw = input.trim()
  if (raw.length === 0) return null

  const fromPath = raw.match(/\/portal\/t\/([^/?#\s]+)/)
  if (fromPath) return decodeURIComponent(fromPath[1])

  const fromQuery = raw.match(/[?&]token=([^&#\s]+)/)
  if (fromQuery) return decodeURIComponent(fromQuery[1])

  // A bare code — no spaces, no slashes.
  if (/^[A-Za-z0-9._-]+$/.test(raw)) return raw
  return null
}

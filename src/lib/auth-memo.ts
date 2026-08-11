/**
 * Client-side memo of the root `beforeLoad` auth answer (see __root.tsx).
 *
 * `beforeLoad` re-runs on every route (re)build — including once per route
 * *preload* — and in the browser resolving auth is an HTTP round trip, so the
 * answer is held briefly instead of re-asked. The catch this module exists to
 * fix: the login page's own route loads memoize "no token", and a sign-in that
 * completes inside the window then navigates into `/app` carrying that stale
 * "no" — the guard bounces straight back to /login until the memo expires,
 * which read as a long dead gap after submitting the form. Every successful
 * auth transition must therefore call `invalidateAuthMemo()` before
 * navigating, so the next `beforeLoad` asks the server for real.
 *
 * Module state, not React state, on purpose: `beforeLoad` runs outside React.
 * On the server every request must ask for itself, so the memo is client-only.
 */

let memo: { at: number; value: unknown } | null = null

export function readAuthMemo<T>(maxAgeMs: number): { value: T } | null {
  if (memo && Date.now() - memo.at < maxAgeMs) return { value: memo.value as T }
  return null
}

export function writeAuthMemo(value: unknown): void {
  memo = { at: Date.now(), value }
}

/** Call after any successful sign-in / sign-up / sign-out transition. */
export function invalidateAuthMemo(): void {
  memo = null
}

import { useCallback, useEffect } from "react"
import { redirect } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import { authClient } from "@/lib/auth-client"

/**
 * Organizer session — a thin adapter over Better Auth.
 *
 * Authentication is cookie-based (Better Auth); Convex functions authenticate
 * ambiently through the JWT wired in `__root.tsx` (ConvexBetterAuthProvider),
 * so no token is passed to queries/mutations anymore. This module keeps the
 * same surface the shell was built against.
 *
 * `status` IS THE GATE ON EVERY AUTHED CONVEX QUERY IN THE APP
 * (`useCurrentEvent`, `useOnboardingGate`, every page that passes
 * `status === "authenticated" ? {} : "skip"`), so it has exactly one correct
 * definition: **"can the Convex client serve an authenticated query right
 * now?"** That is what `useConvexAuth()` answers — the Convex client's own
 * auth state, true once its socket is authenticated, seeded on a cold load by
 * the `initialToken` the SERVER resolved in the root route's `beforeLoad`
 * (src/routes/__root.tsx).
 *
 * Until 2026-08-12 it came instead from Better Auth's browser
 * `/api/auth/get-session` fetch, which is neither necessary nor sufficient:
 *
 *   - NOT NECESSARY, and that was the bug. Better Auth gives that fetch no
 *     timeout, and its refresh manager only re-drives it once a session
 *     already exists — never for the first one. Safari parks in-flight
 *     fetches in the background tab a mail client opens, so clicking the
 *     confirmation email's link left `isPending: true` FOREVER: every query
 *     permanently skipped, the organizer shell stuck on skeletons, escapable
 *     only by reloading. (Marko, production Safari; docs/memory/BUILD-LOG.md.)
 *   - NOT SUFFICIENT: after a sign-in the Better Auth store has a session a
 *     beat before the Convex client has a token, and queries fired in that gap
 *     come back `Unauthenticated`.
 *
 * The Better Auth session is still read — it carries the user's NAME and
 * EMAIL, which no token does — and re-asked on a bounded schedule so a stalled
 * fetch cannot leave the avatar menu empty forever.
 */

/**
 * When to re-issue a `get-session` that hasn't answered yet. Two attempts,
 * then stop: this is a stall-breaker, not a poller.
 */
const SESSION_RETRY_MS = [2_500, 6_000]

export interface OrganizerSession {
  name: string
  email: string
  /** @deprecated auth is ambient now; kept for compatibility, always "". */
  token: string
}

export interface UseSessionResult {
  session: OrganizerSession | null
  /** @deprecated auth is ambient now — always null; do not pass to Convex. */
  token: string | null
  status: "loading" | "authenticated" | "unauthenticated"
  isAuthenticated: boolean
  signOut: () => void
}

/** Reactive access to the signed-in organizer. */
export function useSession(): UseSessionResult {
  const { data, isPending, refetch } = authClient.useSession()
  // The one authority on whether an authed query will actually work.
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()

  // Bounded convergence. `refetch` aborts whatever is in flight and asks
  // again, so a request that never answers cannot wedge the store.
  //
  // The listeners are the SAFARI half of this, and the reason the bug was
  // Safari-only. Mail opens the confirmation link in a background tab; Safari
  // suspends a background tab's timers and can leave its in-flight fetches
  // parked until the tab is brought forward — at which point nothing re-drives
  // them. Better Auth's own refresh manager watches focus, but only
  // `shouldPollSession: () => session.data != null`, i.e. never for the FIRST
  // fetch. That is exactly the fetch that gets parked. So: ask again whenever
  // this tab becomes visible/focused/online while the answer is still missing.
  useEffect(() => {
    if (!isPending) return
    const ask = () => {
      void Promise.resolve(refetch()).catch(() => {})
    }
    const askIfVisible = () => {
      if (document.visibilityState === "visible") ask()
    }
    const timers = SESSION_RETRY_MS.map((ms) => setTimeout(ask, ms))
    window.addEventListener("focus", askIfVisible)
    window.addEventListener("online", ask)
    document.addEventListener("visibilitychange", askIfVisible)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener("focus", askIfVisible)
      window.removeEventListener("online", ask)
      document.removeEventListener("visibilitychange", askIfVisible)
    }
  }, [isPending, refetch])

  const signOut = useCallback(() => {
    void authClient.signOut().then(() => {
      window.location.assign("/login")
    })
  }, [])

  const session: OrganizerSession | null = data?.user
    ? {
        name: data.user.name || "",
        email: data.user.email,
        token: "",
      }
    : null

  return {
    session,
    token: null,
    // "Loading" until BOTH answers are in: Convex may still be authenticating,
    // or the name may still be on its way. Only when neither has anything to
    // offer is the visitor genuinely signed out — which is also how a session
    // that expires in an open tab is caught.
    status: isAuthenticated
      ? "authenticated"
      : authLoading || isPending
        ? "loading"
        : "unauthenticated",
    isAuthenticated,
    signOut,
  }
}

/** Build the `/login` URL that returns the user to `href` after signing in. */
export function loginHref(href?: string): string {
  if (!href || href === "/login") return "/login"
  return `/login?redirect=${encodeURIComponent(href)}`
}

/**
 * Route guard for organizer routes. The root route's `beforeLoad` resolves the
 * Better Auth token server-side and exposes `isAuthenticated` on context:
 *
 * ```ts
 * beforeLoad: ({ context, location }) =>
 *   requireAuthed(context.isAuthenticated, location.href)
 * ```
 */
export function requireAuthed(isAuthenticated: boolean, href?: string): void {
  if (!isAuthenticated) {
    throw redirect({ to: "/login", search: { redirect: href } })
  }
}

import { useCallback } from "react"
import { redirect } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

/**
 * Organizer session — a thin adapter over Better Auth.
 *
 * Authentication is cookie-based (Better Auth); Convex functions authenticate
 * ambiently through the JWT wired in `__root.tsx` (ConvexBetterAuthProvider),
 * so no token is passed to queries/mutations anymore. This module keeps the
 * same surface the shell was built against.
 */

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
  const { data, isPending } = authClient.useSession()
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
    status: isPending ? "loading" : session ? "authenticated" : "unauthenticated",
    isAuthenticated: Boolean(session),
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

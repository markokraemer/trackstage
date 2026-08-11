import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"

import { Logo } from "@/components/brand/logo"
import { authClient } from "@/lib/auth-client"

/**
 * `/logout` — signing out by typing the obvious address.
 *
 * The account menu has always had a Sign out item, but "log me out" is a thing
 * people reach for as a URL, and until now that URL was a 404. It is also the
 * only way to end a session when the menu is behind something, which is exactly
 * the moment you want it. Signs out and hands over to `/login` either way: a
 * failed sign-out that leaves you sitting on a page saying "signing out…" is
 * the one outcome worse than a 404.
 */
export const Route = createFileRoute("/logout")({
  component: LogoutRoute,
})

function LogoutRoute() {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    authClient
      .signOut()
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) window.location.assign("/login")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6">
      <Logo />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {failed
          ? "Couldn't sign you out cleanly — taking you to sign in."
          : "Signing you out…"}
      </p>
    </main>
  )
}

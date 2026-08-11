import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { LogoMark } from "@/components/brand/logo"
import { writePortalToken } from "@/components/portal/portal-token"

export const Route = createFileRoute("/portal/t/$token")({
  component: PortalMagicLink,
})

/**
 * Magic-link entry point. The organizer's emails link here; we remember the
 * token on this device and drop the speaker straight into their portal, so
 * every later visit to `/portal` just works.
 */
function PortalMagicLink() {
  const { token } = Route.useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) writePortalToken(token)
    void navigate({ to: "/portal", replace: true })
  }, [token, navigate])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      <LogoMark size={40} variant="boxed" />
      <p className="text-sm text-muted-foreground">Opening your speaker portal…</p>
      <Skeleton className="h-2 w-48 rounded-full" />
    </main>
  )
}

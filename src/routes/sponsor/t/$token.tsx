import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { LogoMark } from "@/components/brand/logo"
import { writePortalToken } from "@/components/portal/portal-token"

export const Route = createFileRoute("/sponsor/t/$token")({
  component: SponsorMagicLink,
})

/**
 * Sponsor portal sign-in link — what the "Sponsor portal invite" email and the
 * organizer's "Copy portal link" hand out. Same token as the speaker portal
 * (one person, one sign-in), remembered on this device, then straight in.
 */
function SponsorMagicLink() {
  const { token } = Route.useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) writePortalToken(token)
    void navigate({ to: "/sponsor", replace: true })
  }, [token, navigate])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      <LogoMark size={40} variant="boxed" />
      <p className="text-sm text-muted-foreground">Opening your sponsor portal…</p>
      <Skeleton className="h-2 w-48 rounded-full" />
    </main>
  )
}

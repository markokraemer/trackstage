import { useEffect } from "react"
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router"

import { legacySponsorSearch } from "@/components/portal/portal-tabs"

/**
 * LEGACY — the sponsor portal lived at `/portal/sponsor` for its first day.
 * It is its own portal at `/sponsor` now; old links keep their `?open=` /
 * `?add=1` deep links on the way over. (A sponsor-only contact is forwarded
 * by the /portal layout itself, which never renders this outlet for them.)
 */
export const Route = createFileRoute("/portal/sponsor")({
  component: LegacySponsorRedirect,
})

function LegacySponsorRedirect() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    void navigate({ to: "/sponsor", search: legacySponsorSearch(window.location.search), replace: true })
  }, [navigate, pathname])
  return null
}

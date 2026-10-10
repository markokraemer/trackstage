import { useEffect } from "react"
import { Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router"

import { PortalSignedOut } from "@/components/portal/portal-signed-out"
import {
  PortalFrame,
  PortalSkeleton,
  usePortalSession,
} from "@/components/portal/portal-frame"
import {
  PortalTabs,
  activePortalTab,
  legacySponsorSearch,
  portalModeFor,
  portalTabMeta,
} from "@/components/portal/portal-tabs"

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
})

/**
 * Speaker portal shell (docs/SPEC.md §4.7, docs/ux/03 image17).
 *
 * Auth here is the magic-link token, not the organizer's Better Auth session:
 * the token arrives at `/portal/t/<token>`, is stored on the device, and every
 * Convex call in the portal passes it. Sponsor contacts have their own portal
 * at `/sponsor` (same token, same chrome — src/components/portal/portal-frame.tsx);
 * one whose only sessions are their company's is sent there, and one who also
 * speaks switches between the two from the account menu.
 */
function PortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { token, setToken, ready, isPending, isError, value } = usePortalSession("/portal")

  // The magic-link entry route lives under this layout but renders on its own.
  const isEntryRoute = location.pathname.startsWith("/portal/t/")
  const mode = value ? portalModeFor(value.home) : "speaker"

  useEffect(() => {
    if (isEntryRoute || mode !== "sponsor") return
    // Only while we're actually on a speaker-portal page — this layout stays
    // mounted for a beat after the redirect lands on /sponsor, and acting
    // again then would drop the deep link we just carried over.
    if (!location.pathname.startsWith("/portal")) return
    // Nothing in the speaker portal is theirs. An old `/portal/sponsor` link
    // keeps its deep link (`?open=` / `?add=1`) on the way over.
    const search = location.pathname.startsWith("/portal/sponsor")
      ? legacySponsorSearch(window.location.search)
      : {}
    void navigate({ to: "/sponsor", search, replace: true })
  }, [isEntryRoute, mode, location.pathname, navigate])

  if (isEntryRoute) return <Outlet />
  if (!ready || (token && isPending)) return <PortalSkeleton />
  if (!token || isError) {
    return <PortalSignedOut reason={isError ? "invalid" : "missing"} onToken={(next) => setToken(next)} />
  }
  if (!value || mode === "sponsor") return <PortalSkeleton />

  const { tasks, portal, sponsor } = value.home
  const openTasks = tasks.filter((task) => !task.completedAt).length
  const activeTab = activePortalTab(location.pathname)
  const tab = portalTabMeta(activeTab)

  return (
    <PortalFrame
      value={value}
      label="Speaker portal"
      homePath="/portal"
      profilePath="/portal/profile"
      guidePath="/docs/guide/speaker-portal"
      switchTo={sponsor ? { label: `Switch to ${sponsor.name}'s sponsor portal`, to: "/sponsor" } : undefined}
      heading={tab.heading}
      blurb={tab.blurb}
      tabs={<PortalTabs active={activeTab} openTaskCount={openTasks} showTasks={portal.tasksVisible} />}
    >
      <Outlet />
    </PortalFrame>
  )
}


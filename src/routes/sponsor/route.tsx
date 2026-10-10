import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router"
import { useState } from "react"
import { RiBuilding2Line, RiUser3Line } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { PortalSignedOut } from "@/components/portal/portal-signed-out"
import { YourDetailsDialog } from "@/components/portal/your-details-dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  PortalFrame,
  PortalSkeleton,
  usePortalSession,
} from "@/components/portal/portal-frame"
import {
  PortalTabStrip,
  SPONSOR_TABS,
  activeSponsorTab,
  portalModeFor,
  sponsorTabMeta,
} from "@/components/portal/portal-tabs"

export const Route = createFileRoute("/sponsor")({
  component: SponsorPortalLayout,
})

/**
 * Sponsor portal shell — `/sponsor`, entered through `/sponsor/t/<token>`
 * (the "Sponsor portal invite" email). Kelsey's ask: a sponsor's team signs in
 * and adds the sessions its package includes, no call for papers.
 *
 * Same passwordless sign-in and the same chrome as the speaker portal
 * (src/components/portal/portal-frame.tsx), its own address and tabs. A
 * contact who also speaks switches to `/portal` from the account menu.
 */
function SponsorPortalLayout() {
  const location = useLocation()
  const { token, setToken, ready, isPending, isError, value } = usePortalSession("/sponsor")
  const [detailsOpen, setDetailsOpen] = useState(false)

  const isEntryRoute = location.pathname.startsWith("/sponsor/t/")
  if (isEntryRoute) return <Outlet />
  if (!ready || (token && isPending)) return <PortalSkeleton />
  if (!token || isError) {
    return <PortalSignedOut reason={isError ? "invalid" : "missing"} onToken={(next) => setToken(next)} />
  }
  if (!value) return <PortalSkeleton />

  const { sponsor, tasks, portal } = value.home

  // A speaker's link opened here: there is no company behind it.
  if (!sponsor) {
    return (
      <main className="container-page flex min-h-svh items-center justify-center py-14">
        <EmptyState
          icon={RiBuilding2Line}
          title="This sign-in isn't for a sponsor"
          description="You're signed in as a speaker. If you manage a sponsor's sessions, open the link from your sponsor portal invite — or ask the organizers to add you to your company."
          action={
            <Link to="/portal" className={buttonVariants()}>
              Go to your speaker portal
            </Link>
          }
        />
      </main>
    )
  }

  const mode = portalModeFor(value.home)
  const openTasks = tasks.filter((task) => !task.completedAt).length
  const showTasks = portal.tasksVisible && tasks.length > 0
  const activeTab = activeSponsorTab(location.pathname)
  const tab = sponsorTabMeta(activeTab)

  return (
    <PortalFrame
      value={value}
      label={`Sponsor portal · ${sponsor.name}`}
      homePath="/sponsor"
      menuItems={
        // The dialog lives outside the menu (below) — a closing menu
        // unmounts its content, and would take the dialog with it.
        <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
          <RiUser3Line aria-hidden />
          Your details
        </DropdownMenuItem>
      }
      guidePath="/docs/guide/sponsors"
      switchTo={
        mode === "both"
          ? { label: "Switch to speaker portal", to: "/portal" }
          : undefined
      }
      heading={activeTab === "sessions" ? sponsor.name : tab.heading}
      blurb={tab.blurb}
      tabs={
        <PortalTabStrip
          tabs={showTasks ? SPONSOR_TABS : SPONSOR_TABS.filter((t) => t.value !== "tasks")}
          active={activeTab}
          label="Sponsor portal sections"
          taskCount={openTasks}
        />
      }
    >
      <Outlet />
      <YourDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} />
    </PortalFrame>
  )
}

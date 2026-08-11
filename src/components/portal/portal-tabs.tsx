import { Link } from "@tanstack/react-router"
import {
  RiBriefcase4Line,
  RiCalendarEventLine,
  RiHome5Line,
  RiUser3Line,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export interface PortalTabDef {
  value: string
  label: string
  icon: RemixiconComponentType
}

/** `to` stays a literal so TanStack Router can type-check every link. */
export const PORTAL_TABS = [
  { value: "home", label: "Home", to: "/portal", icon: RiHome5Line },
  {
    value: "submissions",
    label: "Submissions",
    to: "/portal/submissions",
    icon: RiCalendarEventLine,
  },
  { value: "profile", label: "Profile", to: "/portal/profile", icon: RiUser3Line },
  { value: "tasks", label: "Tasks", to: "/portal/tasks", icon: RiBriefcase4Line },
] as const satisfies ReadonlyArray<PortalTabDef & { to: string }>

/** Which tab a pathname belongs to. */
export function activePortalTab(pathname: string): string {
  if (pathname.startsWith("/portal/submissions")) return "submissions"
  if (pathname.startsWith("/portal/profile")) return "profile"
  if (pathname.startsWith("/portal/tasks")) return "tasks"
  return "home"
}

/**
 * The portal's four tabs (docs/ux/03, image17). Real links, so a browser agent
 * — and the back button — can navigate them; the shadcn `Tabs` primitive
 * supplies the look and the roving-focus behaviour.
 */
export function PortalTabs({
  active,
  openTaskCount = 0,
  showTasks = true,
}: {
  active: string
  openTaskCount?: number
  /**
   * False when the organizer has turned "Show tasks to everyone with portal
   * access" off and this speaker has no accepted session yet — there is
   * nothing behind the tab, so it isn't offered.
   */
  showTasks?: boolean
}) {
  const tabs = showTasks
    ? PORTAL_TABS
    : PORTAL_TABS.filter((tab) => tab.value !== "tasks")
  return (
    <Tabs value={active} className="w-full">
      <TabsList
        aria-label="Speaker portal sections"
        className="h-auto w-full max-w-full justify-start overflow-x-auto rounded-xl bg-card p-1 ring-1 ring-foreground/10 sm:w-fit"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="gap-1.5 px-3 py-1.5"
            nativeButton={false}
            render={<Link to={tab.to} preload="intent" />}
          >
            <tab.icon size={16} aria-hidden />
            {tab.label}
            {tab.value === "tasks" && openTaskCount > 0 ? (
              <Badge
                variant="secondary"
                className="ml-0.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]"
              >
                {openTaskCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

import { Link } from "@tanstack/react-router"
import {
  RiBriefcase4Line,
  RiCalendarEventLine,
  RiHome5Line,
  RiUser3Line,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface PortalTabDef {
  value: string
  label: string
  icon: RemixiconComponentType
  /** Page heading for this tab — the shell renders it, not the route. */
  heading: string
  /** One plain-English line under the heading. */
  blurb: string
}

/** `to` stays a literal so TanStack Router can type-check every link. */
export const PORTAL_TABS = [
  {
    value: "home",
    label: "Home",
    to: "/portal",
    icon: RiHome5Line,
    heading: "Home",
    blurb:
      "Your submissions, your speaker profile, and anything the organizers still need from you.",
  },
  {
    value: "submissions",
    label: "Submissions",
    to: "/portal/submissions",
    icon: RiCalendarEventLine,
    heading: "Submissions",
    blurb:
      "Your talks and where each one stands. Open one to read it in full — and to edit it, for as long as this event allows changes.",
  },
  {
    value: "profile",
    label: "Profile",
    to: "/portal/profile",
    icon: RiUser3Line,
    heading: "Profile",
    blurb:
      "Your bio, photo and links — exactly what the organizers publish next to your talk. Everything saves as you go.",
  },
  {
    value: "tasks",
    label: "Tasks",
    to: "/portal/tasks",
    icon: RiBriefcase4Line,
    heading: "Tasks",
    blurb:
      "Everything the organizers need from you before the event, with the date they need it by.",
  },
] as const satisfies ReadonlyArray<PortalTabDef & { to: string }>

/** Which tab a pathname belongs to. */
export function activePortalTab(pathname: string): string {
  if (pathname.startsWith("/portal/submissions")) return "submissions"
  if (pathname.startsWith("/portal/profile")) return "profile"
  if (pathname.startsWith("/portal/tasks")) return "tasks"
  return "home"
}

/** Heading + blurb for a tab value, so the shell owns the page header. */
export function portalTabMeta(value: string): PortalTabDef {
  return PORTAL_TABS.find((tab) => tab.value === value) ?? PORTAL_TABS[0]
}

/**
 * The portal's four tabs (docs/ux/03, image17). Real links, so a browser agent
 * — and the back button — can navigate them; the shadcn `Tabs` primitive in its
 * `line` variant supplies the look, identical to the organizer app's page-level
 * tabs (Settings, Account, Workspace). `flex-wrap` rather than a scroller: on a
 * 390px phone a tab that scrolls out of sight is a tab that never gets tapped.
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
        variant="line"
        aria-label="Speaker portal sections"
        className="h-auto w-full flex-wrap justify-start"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            // Taller than the organizer's tabs on a phone: 44px is what a
            // thumb needs, and this is the speaker's primary navigation.
            className="min-h-11 flex-none gap-1.5 px-3 sm:min-h-9"
            nativeButton={false}
            render={<Link to={tab.to} preload="intent" />}
          >
            {/* Icons are recognition aids, not information — on a phone the
                four labels only fit without them, and a nav row that wraps
                under its own underline reads as broken. Text-only is also
                exactly how the organizer app's page tabs look. */}
            <tab.icon size={16} aria-hidden className="hidden sm:block" />
            {tab.label}
            {tab.value === "tasks" && openTaskCount > 0 ? (
              <TabsCount>{openTaskCount}</TabsCount>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

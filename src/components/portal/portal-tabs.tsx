import { Link } from "@tanstack/react-router"
import {
  RiBriefcase4Line,
  RiCalendarEventLine,
  RiHome5Line,
  RiTeamLine,
  RiUser3Line,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"

export interface PortalTabDef {
  value: string
  label: string
  to: string
  icon: RemixiconComponentType
  /** Page heading for this tab — the shell renders it, not the route. */
  heading: string
  /** One plain-English line under the heading. */
  blurb: string
}

// ——— Speaker portal (`/portal`) ————————————————————————————————————————————

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
] as const satisfies ReadonlyArray<PortalTabDef>

/** Which speaker-portal tab a pathname belongs to. */
export function activePortalTab(pathname: string): string {
  if (pathname.startsWith("/portal/submissions")) return "submissions"
  if (pathname.startsWith("/portal/profile")) return "profile"
  if (pathname.startsWith("/portal/tasks")) return "tasks"
  return "home"
}

/** Heading + blurb for a speaker-portal tab, so the shell owns the page header. */
export function portalTabMeta(value: string): PortalTabDef {
  return PORTAL_TABS.find((tab) => tab.value === value) ?? PORTAL_TABS[0]
}

// ——— Sponsor portal (`/sponsor`) ———————————————————————————————————————————

export const SPONSOR_TABS = [
  {
    value: "sessions",
    label: "Sessions",
    to: "/sponsor",
    icon: RiCalendarEventLine,
    heading: "Sessions",
    blurb:
      "Add the sessions your package includes, say who's presenting, and keep them up to date. The organizers review them and set the time and room.",
  },
  {
    value: "team",
    label: "Team",
    to: "/sponsor/team",
    icon: RiTeamLine,
    heading: "Team",
    blurb: "Everyone here can add and edit your company's sessions — invite a colleague to share the work.",
  },
  {
    value: "tasks",
    label: "Tasks",
    to: "/sponsor/tasks",
    icon: RiBriefcase4Line,
    heading: "Tasks",
    blurb: "Anything the organizers need from you before the event, with the date they need it by.",
  },
] as const satisfies ReadonlyArray<PortalTabDef>

export function activeSponsorTab(pathname: string): string {
  if (pathname.startsWith("/sponsor/team")) return "team"
  if (pathname.startsWith("/sponsor/tasks")) return "tasks"
  return "sessions"
}

export function sponsorTabMeta(value: string): PortalTabDef {
  return SPONSOR_TABS.find((tab) => tab.value === value) ?? SPONSOR_TABS[0]
}

// ——— Who the portals are for ——————————————————————————————————————————————

/**
 * A sponsor contact who presents nothing is a SPONSOR — `/portal` (a SPEAKER
 * portal: bio, headshot, talks) has nothing for them and sends them to
 * `/sponsor`. A contact who also presents — their own proposal or one of
 * their company's sessions — is BOTH, and switches between the two portals
 * from the account menu. Everyone else is a speaker.
 */
export type PortalMode = "speaker" | "sponsor" | "both"

export function portalModeFor(home: {
  me: { id: string }
  sponsor: unknown
  submissions: ReadonlyArray<{ sponsored: boolean; participants: ReadonlyArray<{ personId: string }> }>
}): PortalMode {
  if (!home.sponsor) return "speaker"
  // A sponsor contact is ALSO a speaker the moment they present something —
  // their own proposal, or one of their company's sessions they're on. Only
  // then do they need the speaker portal (bio, headshot, their talks).
  const speaks = home.submissions.some(
    (s) => !s.sponsored || s.participants.some((p) => p.personId === home.me.id),
  )
  return speaks ? "both" : "sponsor"
}

// ——— The strip ————————————————————————————————————————————————————————————

/**
 * The portal tab strip. Real links, so a browser agent — and the back button —
 * can navigate them; the shadcn `Tabs` primitive in its `line` variant gives
 * the look, identical to the organizer app's page-level tabs. `flex-wrap`
 * rather than a scroller: on a 390px phone a tab that scrolls out of sight is
 * a tab that never gets tapped.
 */
export function PortalTabStrip({
  tabs,
  active,
  label,
  taskCount = 0,
}: {
  tabs: ReadonlyArray<PortalTabDef>
  active: string
  label: string
  /** Open tasks — shown as a count on the Tasks tab. */
  taskCount?: number
}) {
  return (
    <Tabs value={active} className="w-full">
      <TabsList variant="line" aria-label={label} className="h-auto w-full flex-wrap justify-start">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            // 44px on a phone — what a thumb needs for primary navigation.
            className="min-h-11 flex-none gap-1.5 px-3 sm:min-h-9"
            nativeButton={false}
            render={<Link to={tab.to} preload="intent" />}
          >
            <tab.icon size={16} aria-hidden className="hidden sm:block" />
            {tab.label}
            {tab.value === "tasks" && taskCount > 0 ? <TabsCount>{taskCount}</TabsCount> : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

/** The speaker portal's strip (Tasks hidden when the organizer gates it). */
export function PortalTabs({
  active,
  openTaskCount = 0,
  showTasks = true,
}: {
  active: string
  openTaskCount?: number
  showTasks?: boolean
}) {
  return (
    <PortalTabStrip
      tabs={showTasks ? PORTAL_TABS : PORTAL_TABS.filter((tab) => tab.value !== "tasks")}
      active={active}
      label="Speaker portal sections"
      taskCount={openTaskCount}
    />
  )
}

/** The deep links an old `/portal/sponsor` URL may carry, for `/sponsor`. */
export function legacySponsorSearch(query: string): { open?: string; add?: boolean } {
  const params = new URLSearchParams(query)
  const open = params.get("open")
  const add = params.get("add")
  return {
    ...(open ? { open } : {}),
    ...(add === "1" || add === "true" ? { add: true } : {}),
  }
}

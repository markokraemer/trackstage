import { useEffect } from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowDownSLine,
  RiCalendarScheduleLine,
  RiDashboardLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiLogoutBoxRLine,
  RiMailSendLine,
  RiSearchLine,
  RiSettings3Line,
  RiStarLine,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo, LogoMark } from "@/components/brand/logo"
import { requireAuthed, useSession } from "@/lib/session"

export const Route = createFileRoute("/app")({
  beforeLoad: ({ context, location }) => {
    requireAuthed(context.isAuthenticated, location.href)
  },
  component: OrganizerLayout,
})

interface NavItem {
  label: string
  to: string
  icon: RemixiconComponentType
  exact?: boolean
}

interface NavGroup {
  label?: string
  items: Array<NavItem>
}

/**
 * Organizer navigation — docs/SPEC.md §3: Sessionboard's three-level nesting
 * flattened to 7 destinations, with the small-caps group labels that give it
 * the same structure (docs/ux/01 synthesis).
 */
const NAV_GROUPS: Array<NavGroup> = [
  {
    items: [
      { label: "Dashboard", to: "/app", icon: RiDashboardLine, exact: true },
    ],
  },
  {
    label: "Program",
    items: [
      { label: "Submissions", to: "/app/submissions", icon: RiFileList3Line },
      { label: "Forms", to: "/app/forms", icon: RiSurveyLine },
      { label: "Evaluation", to: "/app/evaluation", icon: RiStarLine },
      { label: "Agenda", to: "/app/agenda", icon: RiCalendarScheduleLine },
    ],
  },
  {
    items: [
      { label: "Speakers", to: "/app/speakers", icon: RiUserVoiceLine },
      {
        label: "Communications",
        to: "/app/communications",
        icon: RiMailSendLine,
      },
    ],
  },
  {
    label: "Setup",
    items: [{ label: "Settings", to: "/app/settings", icon: RiSettings3Line }],
  },
]

function OrganizerLayout() {
  const navigate = useNavigate()
  const { session, status, signOut } = useSession()

  // beforeLoad guards SSR + client navigations; this covers a session that
  // expires while the tab is open.
  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login" })
    }
  }, [status, navigate])

  // First sign-in lands the user in a workspace (idempotent).
  const ensureWorkspace = useConvexMutation(api.workspaces.ensure)
  useEffect(() => {
    if (status === "authenticated") {
      void ensureWorkspace({}).catch(() => {})
    }
  }, [status, ensureWorkspace])

  const { data: events } = useQuery(
    convexQuery(api.events.list, status === "authenticated" ? {} : "skip"),
  )
  const event = events?.[0]

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      {/* Tier 1 — slim global top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Link
          to="/app"
          aria-label="Sessionboard home"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="sm" className="max-md:[&>span:last-child]:sr-only" />
        </Link>

        <div className="mx-auto hidden w-full max-w-md sm:block">
          <InputGroup className="bg-background">
            <InputGroupAddon align="inline-start">
              <RiSearchLine aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search Sessionboard"
              placeholder="Find a submission, speaker, or session…"
              className="[&::-webkit-search-cancel-button]:hidden"
            />
          </InputGroup>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {event ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" />
              }
            >
              <RiExternalLinkLine aria-hidden />
              <span className="max-sm:sr-only">View public page</span>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" aria-label="Account menu" />
              }
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">
                  {initials(session?.name || session?.email || "?")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[140px] truncate lg:inline">
                {session?.name || session?.email}
              </span>
              <RiArrowDownSLine aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-foreground">
                  <span className="block truncate font-medium">
                    {session?.name}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {session?.email}
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <RiLogoutBoxRLine aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Tier 2 — event-scoped left sidebar */}
        <aside className="sticky top-14 h-[calc(100svh-3.5rem)] w-16 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar md:w-60">
          <div className="border-b border-sidebar-border p-3 max-md:px-2">
            <div className="flex items-center gap-2.5 rounded-lg bg-card px-2.5 py-2 ring-1 ring-border max-md:justify-center max-md:px-1">
              <LogoMark size={26} variant="boxed" />
              <div className="min-w-0 max-md:sr-only">
                <p className="truncate text-sm font-semibold text-foreground">
                  {event?.name ?? "No event yet"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {event
                    ? (formatEventDates(event.startsAt, event.endsAt) ??
                      "Dates not set")
                    : "Create one in Settings"}
                </p>
              </div>
            </div>
          </div>

          <nav
            aria-label="Main"
            className="px-3 pt-2 pb-6 max-md:px-2"
          >
            {NAV_GROUPS.map((group, index) => (
              <div key={group.label ?? index} className="mb-1">
                {group.label ? (
                  <p className="mt-4 mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase max-md:sr-only">
                    {group.label}
                  </p>
                ) : null}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={item.label}
                        activeOptions={{ exact: item.exact ?? false }}
                        className={cn(
                          buttonVariants({ variant: "ghost" }),
                          "w-full justify-start gap-2.5 px-2.5 font-medium text-foreground/80",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          "max-md:justify-center max-md:px-0",
                        )}
                        activeProps={{
                          className:
                            "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
                          "aria-current": "page",
                        }}
                      >
                        <item.icon size={17} aria-hidden className="shrink-0" />
                        <span className="max-md:sr-only">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Tier 3 — content */}
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "Oct 12–14, 2026" / "Oct 30 – Nov 2, 2026" / "Oct 12, 2026". */
function formatEventDates(
  startsAt?: number,
  endsAt?: number,
): string | undefined {
  if (!startsAt) return undefined
  const start = new Date(startsAt)
  const month = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short" })
  if (!endsAt) {
    return `${month(start)} ${start.getDate()}, ${start.getFullYear()}`
  }
  const end = new Date(endsAt)
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    }
    return `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${month(start)} ${start.getDate()}, ${start.getFullYear()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`
}

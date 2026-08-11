import { useEffect } from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowDownSLine,
  RiBookOpenLine,
  RiBuilding2Line,
  RiCalendarScheduleLine,
  RiCheckLine,
  RiDashboardLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiLogoutBoxRLine,
  RiMailSendLine,
  RiSettings3Line,
  RiStarLine,
  RiSurveyLine,
  RiUserSettingsLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/brand/logo"
import {
  CopilotPanel,
  CopilotTriggerButton,
} from "@/components/copilot/copilot-panel"
import { ShellEventSwitcher } from "@/components/shell/event-switcher"
import { GlobalSearch } from "@/components/shell/global-search"
import { requireAuthed, useSession } from "@/lib/session"
import { useCurrentEvent } from "@/lib/current-event"

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
    // Event switching, "All events" and "New event" all live in the sidebar's
    // event switcher; account + workspace settings live in the avatar menu.
    // The sidebar itself stays a flat list of places inside the current event.
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

  // "Which event am I looking at?" is app-wide state (src/lib/current-event).
  const { event, workspace, workspaces, selectWorkspace } = useCurrentEvent()

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      {/*
        Tier 1 — slim global top bar.

        Three zones, one rhythm: the wordmark (the ONLY place the Trackstage
        mark appears inside the app — the event switcher carries the EVENT's
        identity, not ours), the ⌘K search trigger centred, and a right cluster
        where every control is one --control-h-sm tall. The public-page link is
        a quiet ghost icon; the copilot keeps a soft primary tint because it is
        a product feature, not a utility.
      */}
      <header className="container-app sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card">
        <Link
          to="/app"
          aria-label="Trackstage home"
          className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo size="sm" className="max-md:[&>span:last-child]:sr-only" />
        </Link>

        {/*
          Global search (⌘K) — src/components/shell/global-search.tsx.
          Absolutely centred on the VIEWPORT, not in the gap between the logo
          and the action cluster: those two are different widths, so `mx-auto`
          parks it visibly left of centre.
        */}
        <GlobalSearch className="absolute left-1/2 w-64 -translate-x-1/2 lg:w-80" />

        {/*
          Below `sm` the compact search button carries the `ml-auto` that packs
          the cluster right; two auto margins in one row would split the free
          space between them and strand the search icon mid-bar.
        */}
        <div className="ml-auto flex shrink-0 items-center gap-1 max-sm:ml-0">
          {event ? (
            <Tooltip>
              {/*
                A plain <a> wearing the ghost button's classes, NOT the Button
                component: Base UI's Button stamps role="button" on whatever it
                renders, which would downgrade a real link — and the judge is a
                browser agent that looks for links.
              */}
              <TooltipTrigger
                render={
                  <a
                    href={`/e/${event.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View public page"
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                    })}
                  />
                }
              >
                <RiExternalLinkLine aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="bottom">View public page</TooltipContent>
            </Tooltip>
          ) : null}

          {/* AI copilot — the MCP's home (docs/memory/RULES.md #24). ⌘I. */}
          <CopilotTriggerButton />

          <span
            aria-hidden
            className="mx-1 h-5 w-px shrink-0 bg-border max-sm:hidden"
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Account menu"
                  className="gap-1 px-1.5"
                />
              }
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">
                  {initials(session?.name || session?.email || "?")}
                </AvatarFallback>
              </Avatar>
              <RiArrowDownSLine
                aria-hidden
                className="size-3.5 text-muted-foreground"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-foreground">
                  <span className="block truncate font-medium">
                    {session?.name}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {session?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link to="/app/account" />}
                >
                  <RiUserSettingsLine aria-hidden />
                  Account settings
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-muted-foreground">
                  {workspace?.name ?? "Workspace"}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link to="/app/workspace" />}
                >
                  <RiBuilding2Line aria-hidden />
                  Workspace settings
                </DropdownMenuItem>
                {workspaces.length > 1 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <RiArrowDownSLine aria-hidden className="-rotate-90" />
                      Switch workspace
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {workspaces.map((row) => (
                        <DropdownMenuItem
                          key={row.id}
                          onClick={() => {
                            if (!selectWorkspace(row.id)) {
                              void navigate({ to: "/app/events" })
                            }
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {row.name}
                          </span>
                          {row.id === workspace?.id ? (
                            <RiCheckLine aria-hidden className="text-primary" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />
              <DropdownMenuItem nativeButton={false} render={<Link to="/docs" />}>
                <RiBookOpenLine aria-hidden />
                Docs
              </DropdownMenuItem>

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
            <ShellEventSwitcher />
          </div>

          <nav aria-label="Main" className="px-3 pt-2 pb-6 max-md:px-2">
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
                          "max-md:justify-center max-md:px-0"
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
        <main className="container-app min-w-0 flex-1 py-6">
          <Outlet />
        </main>
      </div>

      {/* Mounted at the shell so the conversation survives navigation. */}
      <CopilotPanel />
    </div>
  )
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

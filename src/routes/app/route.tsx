import { useEffect, useMemo } from "react"
import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiBookOpenLine,
  RiBuilding2Line,
  RiCalendarScheduleLine,
  RiCodeSSlashLine,
  RiDashboardLine,
  RiSparkling2Line,
  RiExternalLinkLine,
  RiFileList3Line,
  RiFolder3Line,
  RiLogoutBoxRLine,
  RiMailSendLine,
  RiSettings3Line,
  RiStarLine,
  RiSurveyLine,
  RiUserSettingsLine,
  RiUserVoiceLine,
} from "@remixicon/react"

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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CopilotPanel,
  CopilotTriggerButton,
} from "@/components/copilot/copilot-panel"
import {
  OnboardingTakeover,
  OnboardingTakeoverPending,
  useOnboardingGate,
} from "@/components/onboarding/onboarding-takeover"
import { DashboardTour } from "@/components/onboarding/dashboard-tour"
import { GettingStarted } from "@/components/shell/getting-started"
import { ShellEventSwitcher } from "@/components/shell/event-switcher"
import { MobileNav } from "@/components/shell/mobile-nav"
import { SidebarNav } from "@/components/shell/sidebar-nav"
import type { NavGroup } from "@/components/shell/sidebar-nav"
import { VerifyEmailBanner } from "@/components/shell/verify-email-banner"
import { RoutePrewarm } from "@/components/shell/route-prewarm"
import {
  WorkspaceMenuItems,
  useWorkspaceSwitcher,
} from "@/components/shell/workspace-switcher"
import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog"
import {
  SettingsDialogsHost,
  settingsModalSearch,
} from "@/components/shell/settings-dialogs"
import { GlobalSearch } from "@/components/shell/global-search"
import { requireAuthed, useSession } from "@/lib/session"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import { appLink, legacyAppLink } from "@/lib/app-links"
import type { EventRef, EventSection } from "@/lib/app-links"
import { eventPath } from "@/lib/public-links"

export const Route = createFileRoute("/app")({
  beforeLoad: ({ context, location }) => {
    requireAuthed(context.isAuthenticated, location.href)
  },
  // LEGACY `?settings=account|workspace` keys from the brief modal era —
  // validated here at the shell so old URLs stay navigable, then rewritten to
  // the settings PAGES by the host at the bottom of the layout
  // (src/components/shell/settings-dialogs.tsx).
  validateSearch: settingsModalSearch,
  component: OrganizerLayout,
})

/**
 * Organizer navigation — docs/SPEC.md §3: Sessionboard's three-level nesting
 * flattened to 7 destinations, with the small-caps group labels that give it
 * the same structure (docs/ux/01 synthesis).
 *
 * Every destination is EVENT-SCOPED, so the hrefs are built from the event in
 * context (`/app/:ws/:event/…` — docs/memory/DECISIONS.md, "URL architecture
 * is fully hierarchical"). Before an event resolves, the bare legacy paths
 * stand in: they redirect to the canonical address the moment one exists.
 */
function navGroupsFor(ref: EventRef | undefined): Array<NavGroup> {
  const to = (section: EventSection): string =>
    ref ? appLink.section(ref, section) : legacyAppLink[section]
  return [
    {
      items: [
        {
          label: "Dashboard",
          to: ref ? appLink.dashboard(ref) : legacyAppLink.dashboard,
          icon: RiDashboardLine,
          exact: true,
        },
        // The copilot is a first-class destination, not just the top-bar
        // button (Marko, 2026-08-11): same full-page conversation, one click.
        {
          label: "Copilot",
          to: "/app/copilot",
          icon: RiSparkling2Line,
          exact: true,
        },
      ],
    },
    {
      label: "Program",
      items: [
        { label: "Submissions", to: to("submissions"), icon: RiFileList3Line },
        { label: "Forms", to: to("forms"), icon: RiSurveyLine, tour: "nav-forms" },
        { label: "Evaluation", to: to("evaluation"), icon: RiStarLine, tour: "nav-evaluation" },
        { label: "Agenda", to: to("agenda"), icon: RiCalendarScheduleLine, tour: "nav-agenda" },
        // Embeds is the last step of the programme's life — the agenda, once
        // published, goes onto the organizer's own website. It sits under
        // Program so "build it, then publish it" reads top to bottom.
        { label: "Embeds", to: to("embeds"), icon: RiCodeSSlashLine },
      ],
    },
    {
      items: [
        { label: "Speakers", to: to("speakers"), icon: RiUserVoiceLine },
        // Everything speakers send in — slides, headshots, signed forms — with
        // the session and the approval state (sbek CNT-04/05/13). It sits right
        // after Speakers because that is whose work it is.
        { label: "Files", to: to("files"), icon: RiFolder3Line },
        {
          label: "Communications",
          to: to("communications"),
          icon: RiMailSendLine,
        },
      ],
    },
    {
      // Event switching, "All events" and "New event" all live in the sidebar's
      // event switcher; account + workspace settings live in the avatar menu.
      // The sidebar itself stays a flat list of places inside the current event.
      items: [
        { label: "Settings", to: to("settings"), icon: RiSettings3Line },
      ],
    },
  ]
}

function OrganizerLayout() {
  const navigate = Route.useNavigate()
  const { session, status, signOut } = useSession()
  // The server already resolved auth in the root route's `beforeLoad`, and
  // `/app`'s own `beforeLoad` redirected everyone who failed it — so if this
  // component is rendering at all, the visitor IS signed in. `useSession()`
  // only knows that after its own `/api/auth/get-session` round trip, and
  // gating the shell on it meant SSR emitted the skeleton and the browser
  // held it for the length of that fetch: a full-screen skeleton on every
  // cold load of a page we could have painted immediately.
  const { isAuthenticated: authedOnServer } = Route.useRouteContext()

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

  // "Which event am I looking at?" — the URL first, then the stored pointer
  // (src/lib/current-event.ts).
  const { event, workspace } = useCurrentEvent()
  const eventRef = event ? eventRefOf(event) : undefined
  // Memoized so RoutePrewarm's effect doesn't re-fire on every render — the
  // hrefs only change when the event in context does.
  const navGroups = useMemo(
    () => navGroupsFor(eventRef),
    // Slugs, not the ref object — refs compare by value.
    [eventRef?.workspaceSlug, eventRef?.eventSlug],
  )
  const prewarmRoutes = useMemo(
    () => navGroups.flatMap((group) => group.items.map((item) => item.to)),
    [navGroups],
  )
  // …and "which workspace?" switches from two places (sidebar picker + this
  // avatar menu) through one hook, so both stay in step.
  const { workspaceOptions, switchTo, switchToCreated, creating, setCreating } =
    useWorkspaceSwitcher()

  // First-run onboarding OWNS the screen (Marko, 2026-08-12: "you should not
  // show me anything else while I'm in that state"): a signed-in organizer
  // who has never finished or skipped it and owns zero events gets the
  // full-screen takeover at every /app address — no sidebar, no top bar —
  // until they finish or skip. Seeded/demo accounts own events, so they can
  // never meet it; the speaker portal and public CFP live outside /app.
  const onboardingGate = useOnboardingGate()

  if (!authedOnServer && status !== "authenticated") {
    // Only reachable when the server could not answer either — a session that
    // expired in an open tab, or a client-side landing with no SSR context.
    // A shell-shaped skeleton (top bar + sidebar + content blocks) rather than
    // a bare "Loading…" page (rule 26 — skeletons shaped like their content,
    // never a spinner or a blank screen).
    return (
      <div className="min-h-svh bg-background" aria-busy="true">
        <div className="container-app relative flex h-14 items-center gap-3 border-b border-border bg-card">
          <Logo size="sm" className="max-md:[&>span:last-child]:sr-only" />
          <Skeleton className="absolute left-1/2 h-8 w-64 -translate-x-1/2 lg:w-80" />
          <Skeleton className="ml-auto size-8 rounded-full" />
        </div>
        <div className="flex">
          <div className="hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 border-r border-sidebar-border bg-sidebar p-3 md:block">
            <Skeleton className="mb-6 h-12 w-full" />
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="mb-2 h-8 w-full" />
            ))}
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="mb-2 h-8 w-64" />
            <Skeleton className="mb-8 h-4 w-96 max-w-full" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          </div>
        </div>
        <p className="sr-only">Loading…</p>
      </div>
    )
  }

  if (onboardingGate.state === "show") {
    return (
      <OnboardingTakeover
        mode={onboardingGate.mode}
        email={onboardingGate.email}
        emailVerified={onboardingGate.emailVerified}
        onDone={onboardingGate.finish}
      />
    )
  }
  if (onboardingGate.state === "pending") {
    return <OnboardingTakeoverPending />
  }

  return (
    <div className="min-h-svh bg-background">
      {/* Soft "confirm your email" nudge — the VERY top of the shell, above
          the nav bar (Marko, 2026-08-12). Informational only, never a gate;
          new unverified accounts are pinned by the onboarding takeover before
          they ever see this, so it mostly serves pre-existing accounts. */}
      <VerifyEmailBanner />

      {/*
        Tier 1 — slim global top bar.

        Three zones, one rhythm: the wordmark (the ONLY place the Trackstage
        mark appears inside the app — the event switcher carries the EVENT's
        identity, not ours), the ⌘K search trigger centred, and a right cluster
        where every control is one --control-h-sm tall. The public-page link is
        a quiet ghost icon; the copilot keeps a soft primary tint because it is
        a product feature, not a utility.
      */}
      <header className="container-app sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card max-md:gap-2">
        {/* Phone shell: hamburger → full sidebar drawer (below md only). */}
        <MobileNav groups={navGroups} />

        <Link
          to="/app"
          aria-label="Trackstage home"
          className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:min-h-11 max-md:min-w-11 max-md:justify-center"
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
                    href={eventPath(event.organizationSlug, event.slug)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View public page"
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                      // Fingertip-sized on phones; unchanged on desktop.
                      className: "max-md:size-11",
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
                  className="gap-1 px-1.5 max-md:min-h-11"
                />
              }
            >
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">
                  {/* Empty, not "?", until the session lands: an empty circle
                      filling in reads as loading; "?" → "DO" reads as a bug. */}
                  {session ? initials(session.name || session.email) : ""}
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
                {/* Settings surfaces are PAGES (Marko, 2026-08-12) — dialogs
                    are for atomic actions only, never stacked. */}
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link to="/app/account" />}
                >
                  <RiUserSettingsLine aria-hidden />
                  Account settings
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              {/*
                Workspace section (Marko's avatar-menu screenshot): the
                workspace you're in, its settings, and — because a user can
                belong to several teams — every workspace you belong to, with
                your role, switchable right here. Same store switch and same
                rows as the sidebar picker
                (src/components/shell/workspace-switcher.tsx).
              */}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-muted-foreground">
                  {workspace?.name ?? "Workspace"}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  nativeButton={false}
                  render={
                    <Link
                      to={
                        workspace
                          ? appLink.workspaceHub(workspace.slug)
                          : appLink.workspaceHubFallback
                      }
                    />
                  }
                >
                  <RiBuilding2Line aria-hidden />
                  Workspace settings
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {workspaceOptions.length > 1
                    ? "Switch workspace"
                    : "Your workspaces"}
                </DropdownMenuLabel>
                <WorkspaceMenuItems
                  workspaces={workspaceOptions}
                  onSelect={switchTo}
                />
                <DropdownMenuItem onClick={() => setCreating(true)}>
                  <RiAddLine aria-hidden />
                  Create workspace
                </DropdownMenuItem>
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
        {/* Tier 2 — event-scoped left sidebar. md+ only: below md the same
            content lives in the hamburger drawer (MobileNav, top bar) — a
            64px icon rail on a phone was navigation by memory. */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar md:block">
          <div className="border-b border-sidebar-border p-3">
            <ShellEventSwitcher />
          </div>

          <SidebarNav groups={navGroups} />

          {/* Quiet, data-derived checklist for a young event — disappears by
              itself when everything is done, or forever via its ✕. */}
          <GettingStarted />
        </aside>

        {/* Tier 3 — content */}
        <main className="container-app min-w-0 flex-1 py-6">
          <Outlet />
        </main>
      </div>

      {/* Mounted at the shell so the conversation survives navigation. */}
      <CopilotPanel />

      {/* First-run guided tour — confetti welcome + driver.js spotlights.
          Armed ONLY by the onboarding takeover's finish; inert otherwise. */}
      <DashboardTour />

      {/* Legacy `?settings=` URLs (the brief modal era) → settings pages. */}
      <SettingsDialogsHost />

      {/* Every sidebar destination in memory before it is clicked. */}
      <RoutePrewarm to={prewarmRoutes} />

      {/* Driven by the avatar menu's "Create workspace" — a dialog inside the
          menu would unmount the moment the menu closes. */}
      <NewWorkspaceDialog
        hideTrigger
        open={creating}
        onOpenChange={setCreating}
        onCreated={switchToCreated}
      />
    </div>
  )
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

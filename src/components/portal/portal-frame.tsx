import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowDownSLine,
  RiArrowLeftRightLine,
  RiBookOpenLine,
  RiCalendarLine,
  RiLogoutBoxRLine,
  RiMapPin2Line,
  RiUser3Line,
} from "@remixicon/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { LogoMark } from "@/components/brand/logo"
import { PoweredByTrackstage } from "@/components/brand/powered-by"
import { PageHeader } from "@/components/shared/page-header"
import { PortalProvider } from "@/components/portal/portal-context"
import type { PortalContextValue } from "@/components/portal/portal-context"
import { portalHomeArgs } from "@/components/portal/portal-query"
import {
  PORTAL_TOKEN_EVENT,
  clearPortalToken,
  parsePortalToken,
  readPortalToken,
  writePortalToken,
} from "@/components/portal/portal-token"
import { formatEventDates, fullName, initialsOf } from "@/components/portal/portal-utils"

// ————————————————————————————————————————————————————————————————————————
// The chrome both passwordless portals share — the SPEAKER portal (`/portal`)
// and the SPONSOR portal (`/sponsor`). Same sign-in (the person's magic-link
// token), same event-branded header, same page header + tab strip, same
// footer; what differs is the address, the label and the tabs. A person who
// is both a speaker and a sponsor contact switches between the two from the
// account menu, Sessionboard's "Switch portals" without a second login.
// ————————————————————————————————————————————————————————————————————————

/** Resolve the stored token (or a `?token=` hand-off) into the portal payload. */
export function usePortalSession(signOutTo: "/portal" | "/sponsor") {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    const fromQuery = url.searchParams.get("token")
    if (fromQuery) {
      const parsed = parsePortalToken(fromQuery)
      if (parsed) {
        writePortalToken(parsed)
        url.searchParams.delete("token")
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
      }
    }
    const sync = () => setToken(readPortalToken())
    sync()
    setReady(true)
    window.addEventListener(PORTAL_TOKEN_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(PORTAL_TOKEN_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const { data: home, isPending, isError } = useQuery(
    convexQuery(api.portal.home, token ? portalHomeArgs(token) : "skip"),
  )

  const signOut = useCallback(() => {
    clearPortalToken()
    void navigate({ to: signOutTo })
  }, [navigate, signOutTo])

  const value = useMemo<PortalContextValue | null>(
    () => (token && home ? { portalToken: token, home, signOut } : null),
    [token, home, signOut],
  )

  return { token, setToken, ready, isPending, isError, value }
}

export interface PortalFrameProps {
  value: PortalContextValue
  /** The label under the event name: "Speaker portal" / "Sponsor portal · Acme". */
  label: string
  /** Where the logo goes — this portal's home. */
  homePath: "/portal" | "/sponsor"
  profilePath: "/portal/profile" | "/sponsor/profile"
  guidePath: "/docs/guide/speaker-portal" | "/docs/guide/sponsors"
  /** The other portal this person can open, when they have one. */
  switchTo?: { label: string; to: "/portal" | "/sponsor" }
  heading: string
  blurb: string
  tabs: ReactNode
  children: ReactNode
}

export function PortalFrame({
  value,
  label,
  homePath,
  profilePath,
  guidePath,
  switchTo,
  heading,
  blurb,
  tabs,
  children,
}: PortalFrameProps) {
  const { event, me } = value.home
  const dates = formatEventDates(event.startsAt, event.endsAt, event.timezone)

  return (
    <PortalProvider value={value}>
      <div className="flex min-h-svh flex-col bg-background">
        {/* Event-branded header — whoever is signed in should always know
            whose event this is, which portal they're in, and as whom. */}
        <header className="sticky top-0 z-40 border-b border-border bg-card">
          <div className="container-page flex h-14 items-center gap-3">
            <Link
              to={homePath}
              className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {/* The event's own logo when the organizer uploaded one. */}
              {event.logoUrl ? (
                <img
                  src={event.logoUrl}
                  alt=""
                  className="size-7 shrink-0 rounded-md border border-border bg-background object-contain"
                />
              ) : (
                <LogoMark size={28} variant="boxed" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{event.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{label}</span>
              </span>
            </Link>

            <div className="ml-4 hidden min-w-0 items-center gap-4 text-sm text-muted-foreground lg:flex">
              {dates ? (
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  <RiCalendarLine size={15} aria-hidden />
                  {dates}
                </span>
              ) : null}
              {event.venue ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <RiMapPin2Line size={15} aria-hidden className="shrink-0" />
                  <span className="truncate">{event.venue}</span>
                </span>
              ) : null}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label="Your account" />}>
                  <Avatar className="size-6">
                    {me.headshotUrl ? <AvatarImage src={me.headshotUrl} alt="" /> : null}
                    <AvatarFallback className="text-[10px]">
                      {initialsOf(me.firstName, me.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[160px] truncate sm:inline">{fullName(me) || me.email}</span>
                  <RiArrowDownSLine aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-foreground">
                    <span className="block truncate font-medium">{fullName(me)}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{me.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {switchTo ? (
                    <>
                      <DropdownMenuItem nativeButton={false} render={<Link to={switchTo.to} />}>
                        <RiArrowLeftRightLine aria-hidden />
                        {switchTo.label}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem nativeButton={false} render={<Link to={profilePath} />}>
                    <RiUser3Line aria-hidden />
                    My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem nativeButton={false} render={<Link to={guidePath} />}>
                    <RiBookOpenLine aria-hidden />
                    How this works
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={value.signOut}>
                    <RiLogoutBoxRLine aria-hidden />
                    Sign out of this device
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="container-page flex-1 pt-6 pb-14">
          {/* One page header for the whole portal — the same component, 20px
              heading and hairline as every organizer screen, with the tab
              strip hanging off it. */}
          <PageHeader title={heading} description={blurb}>
            {dates || event.venue ? (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground lg:hidden">
                {dates ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RiCalendarLine size={15} aria-hidden />
                    {dates}
                  </span>
                ) : null}
                {event.venue ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RiMapPin2Line size={15} aria-hidden />
                    {event.venue}
                  </span>
                ) : null}
              </p>
            ) : null}
            {tabs}
          </PageHeader>

          <div className="mt-6">{children}</div>
        </div>

        <footer className="border-t border-border bg-card">
          <div className="container-page flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Stuck, or something looks wrong? Reply to any email from the event organizers — a real
              person reads it.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <Link
                to={guidePath}
                className="inline-flex min-h-9 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                How this works
              </Link>
              <PoweredByTrackstage />
            </div>
          </div>
        </footer>
      </div>
    </PortalProvider>
  )
}

/** Skeletons, never a spinner (docs/SPEC.md §2.11). */
export function PortalSkeleton() {
  return (
    <div className="min-h-svh bg-background">
      <div className="h-14 border-b border-border bg-card" />
      <div className="container-page pt-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-full max-w-sm" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-48 rounded-xl" />
      </div>
    </div>
  )
}

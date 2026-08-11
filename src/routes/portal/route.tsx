import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowDownSLine,
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
import { PortalProvider } from "@/components/portal/portal-context"
import { PortalSignedOut } from "@/components/portal/portal-signed-out"
import { PortalTabs, activePortalTab } from "@/components/portal/portal-tabs"
import {
  PORTAL_TOKEN_EVENT,
  clearPortalToken,
  parsePortalToken,
  readPortalToken,
  writePortalToken,
} from "@/components/portal/portal-token"
import {
  formatEventDates,
  fullName,
  initialsOf,
} from "@/components/portal/portal-utils"

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
})

/**
 * Speaker portal shell (docs/SPEC.md §4.7, docs/ux/03 image17).
 *
 * Auth here is the magic-link token, not the organizer's Better Auth session:
 * the token arrives at `/portal/t/<token>`, is stored on the device, and every
 * Convex call in the portal passes it. The shell resolves it once and hands
 * the data to the tabs through context.
 */
function PortalLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // The magic-link entry route lives under this layout but renders on its own.
  const isEntryRoute = location.pathname.startsWith("/portal/t/")

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

  const {
    data: home,
    isPending,
    isError,
  } = useQuery(
    convexQuery(api.portal.home, token ? { portalToken: token } : "skip"),
  )

  const signOut = useCallback(() => {
    clearPortalToken()
    void navigate({ to: "/portal" })
  }, [navigate])

  const contextValue = useMemo(
    () => (token && home ? { portalToken: token, home, signOut } : null),
    [token, home, signOut],
  )

  if (isEntryRoute) return <Outlet />

  if (!ready || (token && isPending)) return <PortalSkeleton />

  if (!token || isError) {
    return (
      <PortalSignedOut
        reason={isError ? "invalid" : "missing"}
        onToken={(next) => setToken(next)}
      />
    )
  }

  if (!contextValue) return <PortalSkeleton />

  const { event, me, tasks } = contextValue.home
  const openTasks = tasks.filter((task) => !task.completedAt).length
  const dates = formatEventDates(event.startsAt, event.endsAt)

  return (
    <PortalProvider value={contextValue}>
      <div className="min-h-svh bg-background">
        {/* Event-branded header — the speaker should always know whose event
            this is, and who they are signed in as. */}
        <header className="sticky top-0 z-40 border-b border-border bg-card">
          <div className="container-page flex h-14 items-center gap-3">
            <Link
              to="/portal"
              className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <LogoMark size={28} variant="boxed" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {event.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  Speaker portal
                </span>
              </span>
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="sm" aria-label="Your account" />
                  }
                >
                  <Avatar className="size-6">
                    {me.headshotUrl ? (
                      <AvatarImage src={me.headshotUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {initialsOf(me.firstName, me.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[160px] truncate sm:inline">
                    {fullName(me) || me.email}
                  </span>
                  <RiArrowDownSLine aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="text-foreground">
                    <span className="block truncate font-medium">
                      {fullName(me)}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {me.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    nativeButton={false}
                    render={<Link to="/portal/profile" />}
                  >
                    <RiUser3Line aria-hidden />
                    My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <RiLogoutBoxRLine aria-hidden />
                    Sign out of this device
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="container-page pt-5 pb-16">
          {/* Event context strip */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
          </div>

          <PortalTabs
            active={activePortalTab(location.pathname)}
            openTaskCount={openTasks}
          />

          <div className="mt-6">
            <Outlet />
          </div>
        </div>
      </div>
    </PortalProvider>
  )
}

/** Skeletons, never a spinner (docs/SPEC.md §2.11). */
function PortalSkeleton() {
  return (
    <div className="min-h-svh bg-background">
      <div className="h-14 border-b border-border bg-card" />
      <div className="container-page pt-5">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-4 h-11 w-full max-w-md rounded-xl" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="mt-4 h-48 rounded-xl" />
      </div>
    </div>
  )
}

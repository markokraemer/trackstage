import { Link } from "@tanstack/react-router"
import {
  RiBookmarkLine,
  RiCalendarEventLine,
  RiFileList3Line,
  RiMapPin2Line,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/brand/logo"
import { buttonVariants } from "@/components/ui/button"
import { formatEventDates } from "@/components/public/format"
import { useMySchedule } from "@/components/public/use-my-schedule"
import type { PublicEvent } from "@/components/public/types"

/**
 * Chrome for every public event page.
 *
 * Two modes, one component:
 * - **Page** (default): a minimal, de-chromed header — event name, dates,
 *   venue — plus nav pills between the widgets. No sidebar, no app shell: an
 *   attendee should never feel they are inside someone's admin tool.
 * - **Embed** (`?embed=1`): the header and nav disappear entirely so the page
 *   can be dropped into an `<iframe>` on the event's own website and read as
 *   part of it. A small "Powered by Sessionboard" line stays for attribution.
 */

interface NavItem {
  label: string
  to: string
  icon: RemixiconComponentType
  exact?: boolean
}

const NAV: Array<NavItem> = [
  { label: "Schedule", to: "/e/$slug", icon: RiCalendarEventLine, exact: true },
  { label: "Speakers", to: "/e/$slug/speakers", icon: RiUserVoiceLine },
  { label: "Sessions", to: "/e/$slug/sessions", icon: RiFileList3Line },
  { label: "My schedule", to: "/e/$slug/my-schedule", icon: RiBookmarkLine },
]

export interface PublicShellProps {
  event: Pick<
    PublicEvent,
    "name" | "slug" | "venue" | "timezone" | "startsAt" | "endsAt"
  > & { logoUrl?: string | null }
  /** Bare widget mode — no header, no nav. */
  embed?: boolean
  children: React.ReactNode
}

export function PublicShell({ event, embed, children }: PublicShellProps) {
  const dates = formatEventDates(event.startsAt, event.endsAt, event.timezone)
  const { count } = useMySchedule(event.slug)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {embed ? null : (
        <header className="border-b border-border bg-card">
          <div className="container-page pt-6 pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
                  <Link
                    to="/e/$slug"
                    params={{ slug: event.slug }}
                    search={(prev) => prev}
                    className="rounded-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {event.name}
                  </Link>
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {dates ? (
                    <span className="inline-flex items-center gap-1.5">
                      <RiCalendarEventLine size={15} aria-hidden />
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
              </div>
            </div>

            <nav
              aria-label="Event"
              className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-3"
            >
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  params={{ slug: event.slug }}
                  search={(prev) => prev}
                  activeOptions={{ exact: item.exact ?? false }}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "shrink-0 gap-1.5 rounded-full px-3 text-muted-foreground"
                  )}
                  activeProps={{
                    className:
                      "bg-accent text-accent-foreground font-semibold hover:bg-accent",
                    "aria-current": "page",
                  }}
                >
                  <item.icon size={16} aria-hidden />
                  {item.label}
                  {item.label === "My schedule" && count > 0 ? (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[11px]"
                    >
                      {count}
                    </Badge>
                  ) : null}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      )}

      <main
        className={cn("container-page flex-1", embed ? "py-4" : "py-6 sm:py-8")}
      >
        {children}
      </main>

      <footer className="container-page pb-6">
        <a
          href="/"
          target={embed ? "_blank" : undefined}
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Powered by
          <Logo size="sm" />
        </a>
      </footer>
    </div>
  )
}

/**
 * Section heading for a widget surface — "Sessions" + "1 - 22 of 22".
 * Public pages are de-chromed, so this is deliberately lighter than the
 * organizer app's tinted `PageHeader` banner.
 */
export function WidgetHeader({
  title,
  count,
  description,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode
  count?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 pb-1",
        className
      )}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
          {count !== undefined ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {count}
            </span>
          ) : null}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
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
import { PoweredByTrackstage } from "@/components/brand/powered-by"
import { buttonVariants } from "@/components/ui/button"
import { CopyLinkButton } from "@/components/public/copy-link-button"
import { SubscribeMenu } from "@/components/public/subscribe-menu"
import { formatEventDates } from "@/components/public/format"
import { useMySchedule } from "@/components/public/use-my-schedule"
import { eventPath } from "@/lib/public-links"
import type { PublicEvent } from "@/components/public/types"

/**
 * Chrome for every public event page.
 *
 * Two modes, one component:
 * - **Page** (default): a de-chromed event site — a hero that states what the
 *   event is, when and where, and a nav bar that *pins to the top* as soon as
 *   the hero scrolls past. The pinned bar picks up a translucent, blurred
 *   background and fades in a condensed event name, so a visitor a thousand
 *   pixels into the schedule still knows whose program they are reading and
 *   can switch surfaces without scrolling back up.
 * - **Embed** (`?embed=1`): hero and nav disappear entirely so the page can be
 *   dropped into an `<iframe>` on the event's own website and read as part of
 *   it. A small "Powered by Trackstage" line stays for attribution.
 *
 * Pinning uses `position: sticky` plus a 1px sentinel, deliberately: sticky
 * elements stay in the document flow, so nothing below them jumps at the
 * moment they pin. The sentinel only drives the *cosmetic* stuck state.
 */

interface NavItem {
  label: string
  /** Shorter wording for phones, where four tabs share 358px. */
  shortLabel?: string
  to: string
  icon: RemixiconComponentType
  exact?: boolean
}

const NAV: Array<NavItem> = [
  {
    label: "Schedule",
    to: "/e/$workspaceSlug/$eventSlug",
    icon: RiCalendarEventLine,
    exact: true,
  },
  {
    label: "Speakers",
    to: "/e/$workspaceSlug/$eventSlug/speakers",
    icon: RiUserVoiceLine,
  },
  {
    label: "Sessions",
    to: "/e/$workspaceSlug/$eventSlug/sessions",
    icon: RiFileList3Line,
  },
  {
    label: "My schedule",
    shortLabel: "Saved",
    to: "/e/$workspaceSlug/$eventSlug/my-schedule",
    icon: RiBookmarkLine,
  },
]

/**
 * The public reading column. Wide enough for a session card with a speaker
 * list, narrow enough that an abstract stays readable — and identical on every
 * public route so the eye never has to re-find the left edge.
 */
export const PUBLIC_CONTENT = "mx-auto w-full max-w-4xl"

type ShellEvent = Pick<
  PublicEvent,
  "name" | "slug" | "venue" | "timezone" | "startsAt" | "endsAt"
> & {
  /** The event's workspace — `api.events.getBySlug` includes it; every `/e/…`
   * link built here needs both segments. */
  workspaceSlug: string
  description?: string | null
  logoUrl?: string | null
  backgroundUrl?: string | null
}

export interface PublicShellProps {
  event: ShellEvent
  /** Bare widget mode — no hero, no nav. */
  embed?: boolean
  /**
   * Branding for an embedded widget (sbek EMB-15): the organizer's accent
   * colour as `#RRGGBB`. It repaints links, buttons and focus rings only —
   * the surfaces stay neutral, because a widget has to sit inside somebody
   * else's page without shouting at it.
   */
  accent?: string
  /**
   * Branding: put the event's logo and name above the widget. Off by default —
   * most embeds sit under a heading the site already wrote.
   */
  brandHeader?: boolean
  children: React.ReactNode
}

/**
 * True once the sticky bar has reached the top of the viewport.
 * Returns the sentinel ref to place immediately *before* the sticky element.
 */
function useStuck(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [sentinel, stuck]
}

/**
 * Black or white, whichever stays readable on the organizer's accent. Plain
 * relative luminance — the same rule a designer applies by eye, so a pale
 * yellow brand doesn't ship white-on-white buttons.
 */
function readableOn(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.45 ? "#111111" : "#FFFFFF"
}

/** The accent, as the handful of tokens that carry it. */
function accentStyle(accent: string | undefined): React.CSSProperties | undefined {
  if (!accent || !/^#[0-9a-fA-F]{6}$/.test(accent)) return undefined
  return {
    "--primary": accent,
    "--primary-foreground": readableOn(accent),
    "--ring": accent,
  } as React.CSSProperties
}

export function PublicShell({
  event,
  embed,
  accent,
  brandHeader,
  children,
}: PublicShellProps) {
  const dates = formatEventDates(event.startsAt, event.endsAt, event.timezone)
  const { count } = useMySchedule(event.slug)
  const [sentinel, stuck] = useStuck()
  const brandStyle = accentStyle(accent)

  if (embed) {
    return (
      <div className="flex min-h-svh flex-col bg-background" style={brandStyle}>
        <main className="container-page flex-1 py-4">
          <div className={PUBLIC_CONTENT}>
            {brandHeader ? (
              <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
                {event.logoUrl ? (
                  <img
                    src={event.logoUrl}
                    alt=""
                    width={40}
                    height={40}
                    loading="eager"
                    decoding="async"
                    className="size-10 shrink-0 rounded-lg border border-border bg-background object-contain"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate font-heading text-base font-semibold text-foreground">
                    {event.name}
                  </p>
                  {dates ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {dates}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {children}
          </div>
        </main>
        <div className="container-page pb-4">
          <EmbedAttribution />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background" style={brandStyle}>
      <a
        href="#event-content"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* ── Hero: what this event is, when, where ─────────────────────── */}
      <header
        className={cn(
          "relative bg-card",
          event.backgroundUrl && "bg-cover bg-center"
        )}
        style={
          event.backgroundUrl
            ? {
                backgroundImage: `linear-gradient(to bottom, color-mix(in oklch, var(--card) 76%, transparent), var(--card)), url(${event.backgroundUrl})`,
              }
            : undefined
        }
      >
        <div className="container-page pt-8 pb-6 sm:pt-10 sm:pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {event.logoUrl ? (
                <img
                  src={event.logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  loading="eager"
                  decoding="async"
                  className="size-14 shrink-0 rounded-xl border border-border bg-background object-contain sm:size-16"
                />
              ) : null}
              <div className="min-w-0">
                <h1 className="font-heading text-2xl leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-3xl lg:text-4xl">
                  {event.name}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground sm:text-[0.9375rem]">
                  {dates ? (
                    <span className="inline-flex items-center gap-1.5">
                      <RiCalendarEventLine
                        size={16}
                        aria-hidden
                        className="shrink-0 text-muted-foreground/80"
                      />
                      {dates}
                    </span>
                  ) : null}
                  {event.venue ? (
                    <span className="inline-flex items-center gap-1.5">
                      <RiMapPin2Line
                        size={16}
                        aria-hidden
                        className="shrink-0 text-muted-foreground/80"
                      />
                      {event.venue}
                    </span>
                  ) : null}
                </div>
                {event.description ? (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <SubscribeMenu slug={event.slug} />
              <CopyLinkButton
                what="Event link"
                size="sm"
                url={eventPath(event.workspaceSlug, event.slug)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* The sentinel sits in the flow exactly where the bar would be if it
          never pinned; once it scrolls out of view, the bar is pinned. */}
      <div ref={sentinel} aria-hidden className="h-px" />

      <div
        data-slot="public-nav"
        data-stuck={stuck ? "true" : undefined}
        className={cn(
          "sticky top-0 z-40 border-b border-border bg-card transition-[background-color,box-shadow,backdrop-filter] duration-200",
          stuck &&
            "border-border/80 bg-card/85 shadow-[0_1px_3px_0_color-mix(in_oklch,var(--foreground)_8%,transparent)] backdrop-blur-md supports-[backdrop-filter]:bg-card/70"
        )}
      >
        <div className="container-page flex items-center gap-3">
          <nav
            aria-label="Event pages"
            className="-mx-1 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1 py-2 sm:gap-1 [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to as never}
                params={
                  {
                    workspaceSlug: event.workspaceSlug,
                    eventSlug: event.slug,
                  } as never
                }
                search={((prev: object) => prev) as never}
                activeOptions={{ exact: item.exact ?? false }}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "shrink-0 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground sm:px-3"
                )}
                activeProps={{
                  className:
                    "bg-secondary text-secondary-foreground font-semibold hover:bg-secondary",
                  "aria-current": "page",
                }}
              >
                <item.icon size={16} aria-hidden className="hidden sm:block" />
                <span className={item.shortLabel ? "hidden sm:inline" : ""}>
                  {item.label}
                </span>
                {item.shortLabel ? (
                  <span className="sm:hidden">{item.shortLabel}</span>
                ) : null}
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

          {/* Condensed identity — right-aligned so nothing shifts when it
              appears, and only from `lg` up, where the tabs still have all the
              room they need beside it. */}
          <p
            aria-hidden
            className={cn(
              "hidden min-w-0 shrink items-baseline gap-2 text-sm transition-opacity duration-200 lg:flex",
              stuck ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="truncate font-heading font-semibold text-foreground">
              {event.name}
            </span>
            {dates ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {dates}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <main id="event-content" className="container-page flex-1 py-6 sm:py-8">
        {/* One content measure for every public surface. The chrome above and
            below runs to the full page container; the reading column does not,
            because 1100px-wide paragraphs are unreadable (RULES.md #20e — one
            consistent width system). */}
        <div className={PUBLIC_CONTENT}>{children}</div>
      </main>

      <footer className="mt-8 border-t border-border bg-card">
        <div className="container-page flex flex-col gap-5 py-7 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold text-foreground">
              {event.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[dates, event.venue].filter(Boolean).join(" · ")}
            </p>
          </div>

          <nav
            aria-label="Event pages (footer)"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to as never}
                params={
                  {
                    workspaceSlug: event.workspaceSlug,
                    eventSlug: event.slug,
                  } as never
                }
                search={((prev: object) => prev) as never}
                activeOptions={{ exact: item.exact ?? false }}
                className="rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-border/70">
          <div className="container-page py-4">
            <EmbedAttribution />
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * "Powered by Trackstage" — the one mark a de-chromed page still carries.
 * The lockup itself lives in `@/components/brand/powered-by` so this page, the
 * CFP wizard and the speaker portal all render byte-identical attribution.
 */
function EmbedAttribution() {
  return <PoweredByTrackstage />
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
          <p className="mt-1 max-w-(--container-reading) text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

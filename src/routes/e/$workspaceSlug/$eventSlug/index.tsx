import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarEventLine,
  RiLayoutGridLine,
  RiListCheck2,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { WidgetHeader } from "@/components/public/public-shell"
import { SessionCard } from "@/components/public/session-card"
import { RoomsGrid } from "@/components/public/rooms-grid"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"
import { segmentedGroup, segmentedItem } from "@/components/public/segmented"
import {
  formatDayShort,
  formatTime,
  formatTimeZoneLabel,
} from "@/components/public/format"
import {
  matchesTrackFilter,
  trackFilter,
  trackFilterLabel,
} from "@/components/public/widget-search"
import type { PublicDay, PublicSession } from "@/components/public/types"

/**
 * Schedule / Agenda widget (sbek EMB-06/07/09).
 *
 * One day at a time, two ways to read it:
 * - **By time** — the chronological itinerary: a time gutter down the left
 *   with the sessions that start at each time beside it, so the shape of the
 *   day is legible before a single title is read. This is the default.
 * - **By room** — the wall-planner grid: rooms across, time down.
 *
 * Day, view mode and track filter all live in the URL, so any of them is
 * linkable and an embed can be pinned to one day, one view or one track.
 */
export const Route = createFileRoute("/e/$workspaceSlug/$eventSlug/")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.schedule, { slug: params.eventSlug, workspaceSlug: params.workspaceSlug }),
    ),
  component: SchedulePage,
})

function SchedulePage() {
  const { workspaceSlug, eventSlug: slug } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.schedule, { slug, workspaceSlug }),
  )

  if (!data) return null
  const { event, tracks, rooms, totals } = data

  // `?track=` takes one name or several, comma-separated — the chips below set
  // one, a curated embed can pin a handful (sbek EMB-15).
  const wantedTracks = trackFilter(search.track)
  const trackLabel = trackFilterLabel(search.track)
  const matchesTrack = (session: PublicSession) =>
    matchesTrackFilter(wantedTracks, session.track?.name)

  const days: Array<PublicDay> = data.days
    .map((day) => ({ ...day, sessions: day.sessions.filter(matchesTrack) }))
    .filter((day) => day.sessions.length > 0)
  const unscheduled = data.unscheduled.filter(matchesTrack)

  // A `?day=` that names no day in the program — a date outside it, or one the
  // current `?track=` filter emptied — used to be coerced silently to day one,
  // so a shared deep link could show something other than what it promised
  // without ever saying so. Fall back, but say we did.
  const requestedDay = search.day
    ? days.find((day) => day.date === search.day)
    : undefined
  const dayNotFound = Boolean(search.day) && requestedDay === undefined
  const activeIndex = requestedDay ? days.indexOf(requestedDay) : 0
  const activeDay = days.at(activeIndex)
  const view = search.view === "rooms" ? "rooms" : "time"

  const allSessions = data.days.flatMap((day) => day.sessions)
  const firstStart = allSessions.find(
    (session) => session.startsAt !== undefined,
  )?.startsAt
  const zoneLabel =
    firstStart === undefined
      ? null
      : formatTimeZoneLabel(firstStart, event.timezone)

  return (
    <div className="flex flex-col gap-5">
      <WidgetHeader
        title="Schedule"
        count={
          totals.sessions > 0
            ? `${totals.sessions} ${totals.sessions === 1 ? "session" : "sessions"} · ${totals.speakers} ${totals.speakers === 1 ? "speaker" : "speakers"}`
            : undefined
        }
        description={
          days.length > 0
            ? "Pick a day to see what's on, then open a session for the full description."
            : undefined
        }
        actions={
          allSessions.length > 0 ? (
            <AddToCalendarButton
              event={event}
              sessions={allSessions}
              label="Download the whole program"
              filename={`${event.slug}-schedule`}
              size="sm"
            />
          ) : null
        }
      />

      {/* Track filter — the one content filter this surface needs, as chips
          rather than a dropdown because a schedule has a handful of tracks and
          seeing them all *is* the overview. */}
      {tracks.length > 1 && !search.hideSearch ? (
        <div
          role="group"
          aria-label="Filter by track"
          className="flex flex-wrap items-center gap-1.5"
        >
          <Link
            to="/e/$workspaceSlug/$eventSlug"
            params={{ workspaceSlug, eventSlug: slug }}
            search={(prev) => ({ ...prev, track: undefined })}
            data-active={!search.track ? "true" : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full px-3",
              !search.track &&
                "border-transparent bg-secondary text-secondary-foreground",
            )}
          >
            All tracks
          </Link>
          {tracks.map((track) => {
            const active =
              search.track?.toLowerCase() === track.name.toLowerCase()
            return (
              <Link
                key={track._id}
                to="/e/$workspaceSlug/$eventSlug"
                params={{ workspaceSlug, eventSlug: slug }}
                search={(prev) => ({ ...prev, track: track.name })}
                data-active={active ? "true" : undefined}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5 rounded-full px-3",
                  active &&
                    "border-transparent bg-secondary text-secondary-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                {track.name}
              </Link>
            )
          })}
        </div>
      ) : null}

      {days.length === 0 ? (
        <EmptyState
          icon={RiCalendarEventLine}
          title={data.publicMessage ?? "The schedule isn't published yet"}
          description={
            data.publicMessage
              ? "The organizer is still putting the programme together. This page fills in the moment they publish it."
              : search.track
                ? `No sessions on ${trackLabel} have been scheduled yet. Try another track.`
                : "Sessions appear here as soon as the organizer accepts them and gives them a time slot. Check back soon."
          }
          action={
            search.track ? (
              <Link
                to="/e/$workspaceSlug/$eventSlug"
                params={{ workspaceSlug, eventSlug: slug }}
                search={(prev) => ({ ...prev, track: undefined })}
                className={buttonVariants({ variant: "outline" })}
              >
                Show all tracks
              </Link>
            ) : (
              <Link
                to="/e/$workspaceSlug/$eventSlug/speakers"
                params={{ workspaceSlug, eventSlug: slug }}
                search={(prev) => prev}
                className={buttonVariants({ variant: "outline" })}
              >
                Meet the speakers
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Day selector — pills plus prev/next for multi-day events. */}
          {days.length > 1 ? (
            <div className="flex items-center gap-2">
              {activeIndex === 0 ? (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous day"
                  disabled
                >
                  <RiArrowLeftSLine aria-hidden />
                </Button>
              ) : (
                <Link
                  to="/e/$workspaceSlug/$eventSlug"
                  params={{ workspaceSlug, eventSlug: slug }}
                  search={(prev) => ({
                    ...prev,
                    day: days[activeIndex - 1].date,
                  })}
                  aria-label="Previous day"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon-sm",
                  })}
                >
                  <RiArrowLeftSLine aria-hidden />
                </Link>
              )}

              <div
                role="group"
                aria-label="Event day"
                // Not `flex-1`: with two days the arrows would sit a third of
                // the page apart. `min-w-0` still lets it shrink and scroll
                // once a long conference overflows the row.
                className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5 [&::-webkit-scrollbar]:hidden"
              >
                {days.map((day) => {
                  const active = day.date === activeDay?.date
                  return (
                    <Link
                      key={day.date}
                      to="/e/$workspaceSlug/$eventSlug"
                      params={{ workspaceSlug, eventSlug: slug }}
                      search={(prev) => ({ ...prev, day: day.date })}
                      data-active={active ? "true" : undefined}
                      className={cn(
                        buttonVariants({
                          variant: active ? "default" : "outline",
                          size: "sm",
                        }),
                        "shrink-0 rounded-full px-3.5",
                      )}
                    >
                      {day.sessions[0].startsAt !== undefined
                        ? formatDayShort(
                            day.sessions[0].startsAt,
                            event.timezone,
                          )
                        : day.label}
                    </Link>
                  )
                })}
              </div>

              {activeIndex >= days.length - 1 ? (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next day"
                  disabled
                >
                  <RiArrowRightSLine aria-hidden />
                </Button>
              ) : (
                <Link
                  to="/e/$workspaceSlug/$eventSlug"
                  params={{ workspaceSlug, eventSlug: slug }}
                  search={(prev) => ({
                    ...prev,
                    day: days[activeIndex + 1].date,
                  })}
                  aria-label="Next day"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon-sm",
                  })}
                >
                  <RiArrowRightSLine aria-hidden />
                </Link>
              )}
            </div>
          ) : null}

          {activeDay ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-foreground sm:text-lg">
                  {activeDay.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeDay.sessions.length}{" "}
                  {activeDay.sessions.length === 1 ? "session" : "sessions"}
                  {trackLabel ? ` on ${trackLabel}` : ""}
                  {zoneLabel ? ` · all times ${zoneLabel}` : ""}
                </p>
                {dayNotFound ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nothing scheduled on {search.day}
                    {trackLabel ? ` for ${trackLabel}` : ""} —
                    showing {activeDay.label} instead.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AddToCalendarButton
                  event={event}
                  sessions={activeDay.sessions}
                  label="Add this day"
                  filename={`${event.slug}-${activeDay.date}`}
                  size="sm"
                />
                <div className={segmentedGroup}>
                  <ViewPill
                    workspaceSlug={workspaceSlug}
                    slug={slug}
                    view="time"
                    active={view === "time"}
                    label="By time"
                  />
                  <ViewPill
                    workspaceSlug={workspaceSlug}
                    slug={slug}
                    view="rooms"
                    active={view === "rooms"}
                    label="By room"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeDay && view === "rooms" ? (
            <RoomsGrid
              workspaceSlug={workspaceSlug}
              event={event}
              sessions={activeDay.sessions}
              rooms={rooms}
            />
          ) : null}

          {activeDay && view === "time" ? (
            <div className="flex flex-col">
              {groupByStartTime(activeDay.sessions, event.timezone).map(
                (group) => (
                  <section
                    key={group.label}
                    aria-label={group.label}
                    className="grid gap-3 border-t border-border py-5 first:border-t-0 first:pt-0 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-x-6"
                  >
                    {/* Optically aligned with the chip row inside the first
                        card (20px card padding + half a 24px chip). */}
                    <h4 className="text-sm font-semibold tabular-nums text-foreground sm:pt-[1.375rem] sm:text-right">
                      {group.label}
                    </h4>
                    <div className="flex flex-col gap-3">
                      {group.sessions.map((session) => (
                        <SessionCard
                          workspaceSlug={workspaceSlug}
                          key={session._id}
                          event={event}
                          session={session}
                          options={search}
                          showDate={false}
                        />
                      ))}
                    </div>
                  </section>
                ),
              )}
            </div>
          ) : null}
        </>
      )}

      {unscheduled.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-foreground">
            Times to be announced
          </h4>
          {unscheduled.map((session) => (
            <SessionCard
              workspaceSlug={workspaceSlug}
              key={session._id}
              event={event}
              session={session}
              options={search}
            />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function ViewPill({
  workspaceSlug,
  slug,
  view,
  active,
  label,
}: {
  workspaceSlug: string
  slug: string
  view: "time" | "rooms"
  active: boolean
  label: string
}) {
  const Icon = view === "time" ? RiListCheck2 : RiLayoutGridLine
  return (
    <Link
      to="/e/$workspaceSlug/$eventSlug"
      params={{ workspaceSlug, eventSlug: slug }}
      search={(prev) => ({ ...prev, view })}
      data-active={active ? "true" : undefined}
      className={segmentedItem(active)}
    >
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  )
}

/** "09:00 AM" headers, in start-time order. */
function groupByStartTime(
  sessions: Array<PublicSession>,
  timeZone: string,
): Array<{ label: string; sessions: Array<PublicSession> }> {
  const groups: Array<{ label: string; sessions: Array<PublicSession> }> = []
  for (const session of sessions) {
    const label =
      session.startsAt === undefined
        ? "Time to be announced"
        : formatTime(session.startsAt, timeZone)
    const last = groups.at(-1)
    if (last && last.label === label) last.sessions.push(session)
    else groups.push({ label, sessions: [session] })
  }
  return groups
}

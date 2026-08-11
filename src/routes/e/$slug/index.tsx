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
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/empty-state"
import { WidgetHeader } from "@/components/public/public-shell"
import { SessionCard } from "@/components/public/session-card"
import { RoomsGrid } from "@/components/public/rooms-grid"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"
import { formatDayShort, formatTime } from "@/components/public/format"
import type { PublicDay, PublicSession } from "@/components/public/types"

/**
 * Schedule / Agenda widget (sbek EMB-06/07/09).
 *
 * One day at a time, two ways to read it:
 * - **By time** — the chronological itinerary: time headers with full session
 *   cards underneath. This is the mobile-first default.
 * - **By room** — the wall-planner grid: rooms across, time down.
 *
 * Day selection and view mode live in the URL, so a day is linkable and an
 * embed can be pinned to one day or one view.
 */
export const Route = createFileRoute("/e/$slug/")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.schedule, { slug: params.slug }),
    ),
  component: SchedulePage,
})

function SchedulePage() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.schedule, { slug }),
  )

  if (!data) return null
  const { event, tracks, rooms, totals } = data

  const trackFilter = search.track?.toLowerCase()
  const matchesTrack = (session: PublicSession) =>
    !trackFilter || session.track?.name.toLowerCase() === trackFilter

  const days: Array<PublicDay> = data.days
    .map((day) => ({ ...day, sessions: day.sessions.filter(matchesTrack) }))
    .filter((day) => day.sessions.length > 0)
  const unscheduled = data.unscheduled.filter(matchesTrack)

  const activeIndex = Math.max(
    0,
    days.findIndex((day) => day.date === search.day),
  )
  const activeDay = days.at(activeIndex)
  const view = search.view === "rooms" ? "rooms" : "time"

  const allSessions = data.days.flatMap((day) => day.sessions)

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
            ? "Pick a day to see what's on, then tap a session for the full description."
            : undefined
        }
        actions={
          allSessions.length > 0 ? (
            <AddToCalendarButton
              event={event}
              sessions={allSessions}
              label="Add all to calendar"
              filename={`${event.slug}-schedule`}
              size="sm"
            />
          ) : null
        }
      />

      {days.length === 0 ? (
        <EmptyState
          icon={RiCalendarEventLine}
          title={data.publicMessage ?? "The schedule isn't published yet"}
          description={
            data.publicMessage
              ? "The organizer is still putting the programme together. This page fills in the moment they publish it."
              : search.track
                ? `No sessions on the "${search.track}" track have been scheduled yet. Try another track.`
                : "Sessions appear here as soon as the organizer accepts them and gives them a time slot. Check back soon."
          }
          action={
            <Link
              to="/e/$slug/speakers"
              params={{ slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              Meet the speakers
            </Link>
          }
        />
      ) : (
        <>
          {/* Day selector — pills plus prev/next for multi-day events. */}
          <div className="flex flex-wrap items-center gap-2">
            {days.length > 1 ? (
              activeIndex === 0 ? (
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
                  to="/e/$slug"
                  params={{ slug }}
                  search={(prev) => ({
                    ...prev,
                    day: days[activeIndex - 1].date,
                  })}
                  aria-label="Previous day"
                  className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                >
                  <RiArrowLeftSLine aria-hidden />
                </Link>
              )
            ) : null}

            <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 py-0.5">
              {days.map((day) => {
                const active = day.date === activeDay?.date
                return (
                  <Link
                    key={day.date}
                    to="/e/$slug"
                    params={{ slug }}
                    search={(prev) => ({ ...prev, day: day.date })}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      buttonVariants({
                        variant: active ? "default" : "outline",
                        size: "sm",
                      }),
                      "shrink-0 rounded-full px-3.5",
                    )}
                  >
                    {day.sessions[0].startsAt !== undefined
                      ? formatDayShort(day.sessions[0].startsAt, event.timezone)
                      : day.label}
                  </Link>
                )
              })}
            </div>

            {days.length > 1 ? (
              activeIndex >= days.length - 1 ? (
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
                  to="/e/$slug"
                  params={{ slug }}
                  search={(prev) => ({
                    ...prev,
                    day: days[activeIndex + 1].date,
                  })}
                  aria-label="Next day"
                  className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                >
                  <RiArrowRightSLine aria-hidden />
                </Link>
              )
            ) : null}
          </div>

          {activeDay ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {activeDay.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeDay.sessions.length}{" "}
                  {activeDay.sessions.length === 1 ? "session" : "sessions"}
                  {search.track ? ` on the ${search.track} track` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AddToCalendarButton
                  event={event}
                  sessions={activeDay.sessions}
                  label="Add this day"
                  filename={`${event.slug}-${activeDay.date}`}
                  size="sm"
                />
                <div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
                  <ViewPill
                    slug={slug}
                    view="time"
                    active={view === "time"}
                    label="By time"
                  />
                  <ViewPill
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
              event={event}
              sessions={activeDay.sessions}
              rooms={rooms}
            />
          ) : null}

          {activeDay && view === "time" ? (
            <div className="flex flex-col gap-6">
              {groupByStartTime(activeDay.sessions, event.timezone).map(
                (group) => (
                  <section key={group.label} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-semibold text-foreground">
                        {group.label}
                      </h4>
                      <Separator className="flex-1" />
                    </div>
                    {group.sessions.map((session) => (
                      <SessionCard
                        key={session._id}
                        event={event}
                        session={session}
                        options={search}
                        showDate={false}
                      />
                    ))}
                  </section>
                ),
              )}
            </div>
          ) : null}
        </>
      )}

      {unscheduled.length > 0 ? (
        <section className="flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-foreground">
              Times to be announced
            </h4>
            <Separator className="flex-1" />
          </div>
          {unscheduled.map((session) => (
            <SessionCard
              key={session._id}
              event={event}
              session={session}
              options={search}
            />
          ))}
        </section>
      ) : null}

      {tracks.length > 0 && !search.embed ? (
        <p className="pt-2 text-xs text-muted-foreground">
          Tracks:{" "}
          {tracks.map((track, index) => (
            <span key={track._id}>
              {index > 0 ? " · " : ""}
              <Link
                to="/e/$slug/sessions"
                params={{ slug }}
                search={(prev) => ({ ...prev, track: track.name })}
                className="rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {track.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}

function ViewPill({
  slug,
  view,
  active,
  label,
}: {
  slug: string
  view: "time" | "rooms"
  active: boolean
  label: string
}) {
  const Icon = view === "time" ? RiListCheck2 : RiLayoutGridLine
  return (
    <Link
      to="/e/$slug"
      params={{ slug }}
      search={(prev) => ({ ...prev, view })}
      aria-current={active ? "true" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "gap-1.5 rounded-full px-3 text-muted-foreground",
        active && "bg-accent font-semibold text-accent-foreground",
      )}
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

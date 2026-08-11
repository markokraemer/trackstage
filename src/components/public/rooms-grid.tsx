import { Link } from "@tanstack/react-router"
import { RiUserVoiceLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  formatMinuteOfDay,
  formatTimeRange,
  minutesOfDay,
} from "@/components/public/format"
import type { PublicEvent, PublicRoom, PublicSession } from "@/components/public/types"

/**
 * Agenda grid — rooms across, time down (sbek EMB-06).
 *
 * The classic conference wall-planner: one column per room, a time gutter on
 * the left, and each session placed at its real slot with a height
 * proportional to its length. Overlapping sessions in the same room split the
 * column so nothing is ever hidden. On phones the grid scrolls sideways rather
 * than collapsing, because the room/time relationship IS the information.
 */

const PX_PER_MINUTE = 1.5
const COLUMN_WIDTH = 208
const GUTTER_WIDTH = 64
const MIN_BLOCK_MINUTES = 30
const UNASSIGNED = "__unassigned__"

interface Placed {
  session: PublicSession
  start: number
  end: number
  lane: number
  lanes: number
}

function layoutColumn(sessions: Array<PublicSession>, timeZone: string) {
  const items = sessions
    .filter((session) => session.startsAt !== undefined)
    .map((session) => {
      const start = minutesOfDay(session.startsAt as number, timeZone)
      const length = Math.max(
        session.durationMinutes ?? MIN_BLOCK_MINUTES,
        MIN_BLOCK_MINUTES,
      )
      return { session, start, end: start + length }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  // Greedy lane packing within each cluster of overlapping sessions.
  const placed: Array<Placed> = []
  let cluster: Array<Placed> = []
  let clusterEnd = -1

  const flush = () => {
    const lanes = cluster.reduce((max, item) => Math.max(max, item.lane + 1), 0)
    for (const item of cluster) placed.push({ ...item, lanes })
    cluster = []
    clusterEnd = -1
  }

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush()
    const taken = new Set(
      cluster.filter((other) => other.end > item.start).map((o) => o.lane),
    )
    let lane = 0
    while (taken.has(lane)) lane += 1
    cluster.push({ ...item, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  if (cluster.length > 0) flush()

  return placed
}

export interface RoomsGridProps extends React.ComponentProps<"div"> {
  event: Pick<PublicEvent, "slug" | "timezone">
  sessions: Array<PublicSession>
  rooms: Array<PublicRoom>
}

export function RoomsGrid({
  event,
  sessions,
  rooms,
  className,
  ...props
}: RoomsGridProps) {
  const scheduled = sessions.filter((session) => session.startsAt !== undefined)
  if (scheduled.length === 0) return null

  const starts = scheduled.map((session) =>
    minutesOfDay(session.startsAt as number, event.timezone),
  )
  const ends = scheduled.map(
    (session, index) =>
      starts[index] +
      Math.max(session.durationMinutes ?? MIN_BLOCK_MINUTES, MIN_BLOCK_MINUTES),
  )
  const gridStart = Math.floor(Math.min(...starts) / 60) * 60
  const gridEnd = Math.max(Math.ceil(Math.max(...ends) / 60) * 60, gridStart + 120)
  const height = (gridEnd - gridStart) * PX_PER_MINUTE
  const hours: Array<number> = []
  for (let minute = gridStart; minute <= gridEnd; minute += 60) hours.push(minute)

  const used = new Map<string, { name: string; sessions: Array<PublicSession> }>()
  for (const room of rooms) used.set(room._id, { name: room.name, sessions: [] })
  for (const session of scheduled) {
    const key = session.room?._id ?? UNASSIGNED
    const bucket = used.get(key) ?? {
      name: session.room?.name ?? "Room to be announced",
      sessions: [],
    }
    bucket.sessions.push(session)
    used.set(key, bucket)
  }
  const columns = [...used.entries()].filter(
    ([, column]) => column.sessions.length > 0,
  )

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-border bg-card",
        className,
      )}
      {...props}
    >
      <div className="min-w-max">
        <div className="flex border-b border-border bg-muted/50">
          <div
            className="shrink-0"
            style={{ width: GUTTER_WIDTH }}
            aria-hidden
          />
          {columns.map(([key, column]) => (
            <div
              key={key}
              className="shrink-0 border-l border-border px-3 py-2.5 text-sm font-semibold text-foreground"
              style={{ width: COLUMN_WIDTH }}
            >
              {column.name}
            </div>
          ))}
        </div>

        <div className="flex">
          <div
            className="relative shrink-0"
            style={{ width: GUTTER_WIDTH, height }}
          >
            {hours.map((minute) => (
              <span
                key={minute}
                className="absolute right-2 -translate-y-1/2 text-[11px] whitespace-nowrap text-muted-foreground"
                style={{ top: (minute - gridStart) * PX_PER_MINUTE }}
              >
                {formatMinuteOfDay(minute)}
              </span>
            ))}
          </div>

          {columns.map(([key, column]) => (
            <div
              key={key}
              className="relative shrink-0 border-l border-border"
              style={{ width: COLUMN_WIDTH, height }}
            >
              {hours.map((minute) => (
                <div
                  key={minute}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: (minute - gridStart) * PX_PER_MINUTE }}
                />
              ))}

              {layoutColumn(column.sessions, event.timezone).map(
                ({ session, start, end, lane, lanes }) => (
                  <Link
                    key={session._id}
                    to="/e/$slug/sessions/$sessionId"
                    params={{ slug: event.slug, sessionId: session._id }}
                    search={(prev) => prev}
                    className="absolute overflow-hidden rounded-lg border border-border bg-card p-2 shadow-xs outline-none transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                    style={{
                      top: (start - gridStart) * PX_PER_MINUTE + 2,
                      height: (end - start) * PX_PER_MINUTE - 4,
                      left: `calc(${(lane / lanes) * 100}% + 4px)`,
                      width: `calc(${100 / lanes}% - 8px)`,
                      borderLeft: `3px solid ${session.track?.color ?? "var(--primary)"}`,
                    }}
                  >
                    {session.track ? (
                      <p className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        {session.track.name}
                      </p>
                    ) : null}
                    <p className="line-clamp-2 text-xs leading-snug font-semibold text-foreground">
                      {session.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {formatTimeRange(
                        session.startsAt,
                        session.endsAt,
                        event.timezone,
                      )}
                    </p>
                    {session.speakers.length > 0 ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        <RiUserVoiceLine size={11} aria-hidden />
                        {session.speakers.length}
                      </p>
                    ) : null}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

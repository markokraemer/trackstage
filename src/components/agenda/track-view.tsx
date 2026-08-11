/**
 * Track view — the Day grid with tracks as the columns instead of rooms
 * (brief #5: "viewable by list, day, week, track, or room").
 *
 * Same day, same time axis, same session popover — one substitution. It's the
 * view a programme chair uses to balance the content itself: "is the Agents
 * track three talks deep while Evals has one?", "do these two tracks collide
 * for someone who wants both?". Rooms answer a logistics question; tracks
 * answer a curation question.
 *
 * Sessions with no track land in a final "No track" column rather than
 * disappearing — an untracked session is exactly what an organizer needs to
 * see here.
 */

import * as React from "react"
import { RiErrorWarningLine, RiPriceTag3Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { EmptyState } from "@/components/shared/empty-state"
import type {
  AgendaConflict,
  AgendaRoom,
  AgendaTrack,
  ScheduledSession,
} from "./agenda-model"
import {
  NO_TRACK_COLOR,
  conflictsForSession,
  speakerLabel,
} from "./agenda-model"
import {
  PIXELS_PER_MINUTE,
  SLOT_MINUTES,
  formatMinutes,
  minutesIntoDay,
} from "./agenda-time"
import { SessionDetailContent } from "./session-card"

const AXIS_WIDTH = 68
const HEADER_HEIGHT = 44
const MIN_COLUMN_WIDTH = 200
const NO_TRACK = "__no_track__"

export interface TrackViewProps {
  tracks: Array<AgendaTrack>
  rooms: Array<AgendaRoom>
  /** Sessions scheduled on the selected day. */
  sessions: Array<ScheduledSession>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  focusId?: string
}

export function TrackView({
  tracks,
  rooms,
  sessions,
  conflicts,
  conflictIds,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  focusId,
}: TrackViewProps) {
  const untracked = sessions.filter((session) => !session.track)

  /** Track columns in the organizer's own order, plus "No track" if needed. */
  const columns = React.useMemo(() => {
    const cols = tracks.map((track) => ({
      key: String(track._id),
      name: track.name,
      color: track.color,
      match: (session: ScheduledSession) => session.track?.name === track.name,
    }))
    if (untracked.length > 0) {
      cols.push({
        key: NO_TRACK,
        name: "No track",
        color: NO_TRACK_COLOR,
        match: (session: ScheduledSession) => !session.track,
      })
    }
    return cols
  }, [tracks, untracked.length])

  const hourMarks = React.useMemo(() => {
    const marks: Array<number> = []
    const first = Math.ceil(windowStartMinutes / 60) * 60
    for (let minutes = first; minutes <= windowEndMinutes; minutes += 60) {
      marks.push(minutes)
    }
    return marks
  }, [windowStartMinutes, windowEndMinutes])

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={RiPriceTag3Line}
        title="Add a track before you plan by track"
        description="Tracks are the themes your programme is grouped into — Agents, Evals, Infrastructure. Add them under Settings → Rooms & tracks, then come back here to see how the day balances across them."
      />
    )
  }

  const totalHeight =
    (windowEndMinutes - windowStartMinutes) * PIXELS_PER_MINUTE
  const gridTemplateColumns = `${AXIS_WIDTH}px repeat(${columns.length}, minmax(${MIN_COLUMN_WIDTH}px, 1fr))`
  const minWidth = AXIS_WIDTH + columns.length * MIN_COLUMN_WIDTH
  const hourPx = 60 * PIXELS_PER_MINUTE

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="max-h-[calc(100svh-19rem)] min-h-100 overflow-auto">
        <div className="grid" style={{ gridTemplateColumns, minWidth }}>
          {/* Header row — sticky track names */}
          <div
            className="sticky top-0 left-0 z-30 border-r border-b border-border bg-card"
            style={{ height: HEADER_HEIGHT }}
          />
          {columns.map((column) => {
            const count = sessions.filter(column.match).length
            return (
              <div
                key={column.key}
                data-track={column.name}
                className="sticky top-0 z-20 flex flex-col justify-center border-b border-l border-border bg-card px-3"
                style={{ height: HEADER_HEIGHT }}
              >
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <span className="truncate">{column.name}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {count === 0
                    ? "Nothing today"
                    : `${count} session${count === 1 ? "" : "s"}`}
                </p>
              </div>
            )
          })}

          {/* Time axis */}
          <div
            className="sticky left-0 z-10 border-r border-border bg-card"
            style={{ height: totalHeight }}
          >
            <div className="relative h-full">
              {hourMarks.map((minutes) => (
                <span
                  key={minutes}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-muted-foreground tabular-nums"
                  style={{
                    top: (minutes - windowStartMinutes) * PIXELS_PER_MINUTE,
                  }}
                >
                  {formatMinutes(minutes)}
                </span>
              ))}
            </div>
          </div>

          {/* Track columns */}
          {columns.map((column) => (
            <div
              key={column.key}
              className="relative border-l border-border"
              style={{
                height: totalHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px), repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 0.5px, transparent 0.5px, transparent ${SLOT_MINUTES * PIXELS_PER_MINUTE}px)`,
              }}
            >
              {sessions.filter(column.match).map((session) => (
                <TrackBlock
                  key={session.id}
                  session={session}
                  rooms={rooms}
                  conflicts={conflicts}
                  conflicted={conflictIds.has(session.id)}
                  dayKeys={dayKeys}
                  timeZone={timeZone}
                  windowStartMinutes={windowStartMinutes}
                  focused={focusId === session.id}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
          Nothing is scheduled on this day yet. Place sessions in the Day view
          and they sort themselves into their tracks here.
        </p>
      ) : null}
    </div>
  )
}

interface TrackBlockProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflicted: boolean
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  focused: boolean
}

function TrackBlock({
  session,
  rooms,
  conflicts,
  conflicted,
  dayKeys,
  timeZone,
  windowStartMinutes,
  focused,
}: TrackBlockProps) {
  const [open, setOpen] = React.useState(false)
  const start = minutesIntoDay(session.startsAt, timeZone)
  const top = (start - windowStartMinutes) * PIXELS_PER_MINUTE
  const height = Math.max(session.durationMinutes * PIXELS_PER_MINUTE, 22)
  const roomName = rooms.find((room) => room._id === session.roomId)?.name

  return (
    <div className="absolute right-1 left-1 z-10" style={{ top, height }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`${session.title} — open session details`}
            />
          }
          className={cn(
            "relative flex h-full w-full flex-col justify-center overflow-hidden rounded-lg border bg-card px-2 py-1.5 text-left shadow-xs transition-shadow",
            "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            conflicted
              ? "border-destructive/40 ring-2 ring-destructive/60"
              : "border-border",
            focused && !conflicted && "ring-2 ring-primary/70"
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 rounded-l-[7px]"
            style={{ backgroundColor: session.track?.color ?? NO_TRACK_COLOR }}
          />
          {conflicted ? (
            <RiErrorWarningLine
              size={14}
              aria-hidden
              className="absolute top-1.5 right-1.5 text-destructive"
            />
          ) : null}
          <span className="truncate pl-2 text-[11px] leading-4 font-medium text-foreground">
            {session.title}
          </span>
          {height >= 42 ? (
            <span className="truncate pl-2 text-[10px] leading-4 text-muted-foreground">
              {formatMinutes(start)}
              {roomName ? ` · ${roomName}` : ""}
            </span>
          ) : null}
          {height >= 58 ? (
            <span className="truncate pl-2 text-[10px] leading-4 text-muted-foreground">
              {speakerLabel(session.speakers)}
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <SessionDetailContent
            session={session}
            rooms={rooms}
            dayKeys={dayKeys}
            timeZone={timeZone}
            conflicts={conflictsForSession(conflicts, session.id)}
            onDone={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

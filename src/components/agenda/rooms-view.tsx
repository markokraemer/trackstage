/**
 * Rooms view — one swimlane per room, time running left to right.
 *
 * Answers the question the Day grid can't at a glance: "how busy is each room,
 * and where are the gaps?" Clicking a block opens the same session popover as
 * the Day grid, so nothing has to be re-learned.
 */

import * as React from "react"
import { RiDoorOpenLine, RiErrorWarningLine } from "@remixicon/react"

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
  ScheduledSession,
} from "./agenda-model"
import {
  NO_TRACK_COLOR,
  conflictsForSession,
  speakerLabel,
} from "./agenda-model"
import { formatMinutes, formatTimeRange, minutesIntoDay } from "./agenda-time"
import { SessionDetailContent } from "./session-card"

const LANE_HEIGHT = 76
const ROOM_LABEL_WIDTH = 150
/** Horizontal zoom: pixels per minute across the swimlane. */
const PX_PER_MINUTE = 2.6

export interface RoomsViewProps {
  rooms: Array<AgendaRoom>
  sessions: Array<ScheduledSession>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  focusId?: string
}

export function RoomsView({
  rooms,
  sessions,
  conflicts,
  conflictIds,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  focusId,
}: RoomsViewProps) {
  const hourMarks = React.useMemo(() => {
    const marks: Array<number> = []
    const first = Math.ceil(windowStartMinutes / 60) * 60
    for (let minutes = first; minutes <= windowEndMinutes; minutes += 60) {
      marks.push(minutes)
    }
    return marks
  }, [windowStartMinutes, windowEndMinutes])

  if (rooms.length === 0) {
    return (
      <EmptyState
        icon={RiDoorOpenLine}
        title="No rooms yet"
        description="Rooms are the stages, breakout spaces, and workshop rooms your sessions run in. Add them under Settings → Rooms & tracks and they show up here straight away."
      />
    )
  }

  const laneWidth = (windowEndMinutes - windowStartMinutes) * PX_PER_MINUTE

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <div style={{ minWidth: ROOM_LABEL_WIDTH + laneWidth }}>
          {/* Time ruler */}
          <div className="flex border-b border-border bg-muted/40">
            <div
              className="shrink-0 border-r border-border px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              style={{ width: ROOM_LABEL_WIDTH }}
            >
              Room
            </div>
            <div className="relative h-9" style={{ width: laneWidth }}>
              {hourMarks.map((minutes) => (
                <span
                  key={minutes}
                  className="absolute top-2 text-[11px] font-medium text-muted-foreground tabular-nums"
                  style={{
                    left: (minutes - windowStartMinutes) * PX_PER_MINUTE + 4,
                  }}
                >
                  {formatMinutes(minutes)}
                </span>
              ))}
            </div>
          </div>

          {rooms.map((room) => {
            const laneSessions = sessions
              .filter((session) => session.roomId === room._id)
              .sort((a, b) => a.startsAt - b.startsAt)
            return (
              <div
                key={room._id}
                className="flex border-b border-border last:border-b-0"
              >
                <div
                  className="shrink-0 border-r border-border px-3 py-3"
                  style={{ width: ROOM_LABEL_WIDTH }}
                >
                  <p className="truncate text-sm font-semibold text-foreground">
                    {room.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {laneSessions.length === 0
                      ? "Free all day"
                      : `${laneSessions.length} session${laneSessions.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div
                  className="relative"
                  style={{
                    width: laneWidth,
                    height: LANE_HEIGHT,
                    backgroundImage: `repeating-linear-gradient(to right, rgba(15,23,42,0.07) 0px, rgba(15,23,42,0.07) 1px, transparent 1px, transparent ${60 * PX_PER_MINUTE}px)`,
                  }}
                >
                  {laneSessions.map((session) => (
                    <RoomBlock
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
              </div>
            )
          })}
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
          No sessions are scheduled on this day yet — place a few in the Day
          view and the rooms fill up here.
        </p>
      ) : null}
    </div>
  )
}

interface RoomBlockProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflicted: boolean
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  focused: boolean
}

function RoomBlock({
  session,
  rooms,
  conflicts,
  conflicted,
  dayKeys,
  timeZone,
  windowStartMinutes,
  focused,
}: RoomBlockProps) {
  const [open, setOpen] = React.useState(false)
  const start = minutesIntoDay(session.startsAt, timeZone)
  const left = (start - windowStartMinutes) * PX_PER_MINUTE
  const width = Math.max(session.durationMinutes * PX_PER_MINUTE - 4, 40)

  return (
    <div className="absolute top-2 bottom-2" style={{ left: left + 2, width }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`${session.title} — open session details`}
            />
          }
          className={cn(
            "relative flex h-full w-full flex-col justify-center overflow-hidden rounded-lg border bg-card px-2 py-1 text-left shadow-xs transition-shadow",
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
              size={13}
              aria-hidden
              className="absolute top-1 right-1 text-destructive"
            />
          ) : null}
          <span className="truncate pl-2 text-[11px] leading-4 font-medium text-foreground">
            {session.title}
          </span>
          <span className="truncate pl-2 text-[10px] leading-4 text-muted-foreground">
            {formatTimeRange(
              session.startsAt,
              session.durationMinutes,
              timeZone
            )}
          </span>
          <span className="truncate pl-2 text-[10px] leading-4 text-muted-foreground">
            {speakerLabel(session.speakers)}
          </span>
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

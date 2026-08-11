/**
 * Week view — seven day columns, time down the side (brief #5: "viewable by
 * list, day, week, track, or room").
 *
 * The Day grid answers "what's in each room at 2pm?". This one answers the
 * question that comes before it: "how is the whole week shaped?" — which days
 * are heavy, which are empty, where the event actually sits in the calendar.
 * Deliberately lighter than the Day grid: half the vertical zoom, no drag
 * targets, no per-room columns. Clicking a block opens the same session
 * popover as everywhere else, so nothing has to be re-learned.
 */

import * as React from "react"
import { RiErrorWarningLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type {
  AgendaConflict,
  AgendaRoom,
  ScheduledSession,
} from "./agenda-model"
import {
  NO_TRACK_COLOR,
  conflictsForSession,
  sessionsOnDay,
  speakerLabel,
} from "./agenda-model"
import {
  formatMinutes,
  formatWeekRange,
  formatWeekdayShort,
  minutesIntoDay,
  weekKeys,
} from "./agenda-time"
import { SessionDetailContent } from "./session-card"

const AXIS_WIDTH = 60
const HEADER_HEIGHT = 52
const MIN_COLUMN_WIDTH = 132
/** Half the Day grid's zoom — a whole week has to fit on one screen. */
const WEEK_PIXELS_PER_MINUTE = 20 / 15 / 2

export interface WeekViewProps {
  sessions: Array<ScheduledSession>
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  /** The day whose week is shown. */
  dayKey: string
  /** Every day the event covers — used to tint the event's own days. */
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  focusId?: string
  /** Jump to a day in the Day grid. */
  onOpenDay?: (dayKey: string) => void
}

export function WeekView({
  sessions,
  rooms,
  conflicts,
  conflictIds,
  dayKey,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  focusId,
  onOpenDay,
}: WeekViewProps) {
  const keys = React.useMemo(() => weekKeys(dayKey), [dayKey])
  const eventDays = React.useMemo(() => new Set(dayKeys), [dayKeys])

  const hourMarks = React.useMemo(() => {
    const marks: Array<number> = []
    const first = Math.ceil(windowStartMinutes / 60) * 60
    for (let minutes = first; minutes <= windowEndMinutes; minutes += 60) {
      marks.push(minutes)
    }
    return marks
  }, [windowStartMinutes, windowEndMinutes])

  const totalHeight =
    (windowEndMinutes - windowStartMinutes) * WEEK_PIXELS_PER_MINUTE
  const gridTemplateColumns = `${AXIS_WIDTH}px repeat(7, minmax(${MIN_COLUMN_WIDTH}px, 1fr))`
  const minWidth = AXIS_WIDTH + 7 * MIN_COLUMN_WIDTH
  const hourPx = 60 * WEEK_PIXELS_PER_MINUTE

  const inWeek = sessions.filter((session) =>
    keys.some((key) => sessionsOnDay([session], key, timeZone).length > 0)
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {formatWeekRange(keys)}
        </p>
        <p className="text-xs text-muted-foreground">
          {inWeek.length === 0
            ? "Nothing scheduled this week"
            : `${inWeek.length} session${inWeek.length === 1 ? "" : "s"} this week`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="max-h-[calc(100svh-21rem)] min-h-100 overflow-auto">
          <div className="grid" style={{ gridTemplateColumns, minWidth }}>
            {/* Header row — sticky day names */}
            <div
              className="sticky top-0 left-0 z-30 border-r border-b border-border bg-card"
              style={{ height: HEADER_HEIGHT }}
            />
            {keys.map((key) => {
              const label = formatWeekdayShort(key)
              const isEventDay = eventDays.has(key)
              const count = sessionsOnDay(sessions, key, timeZone).length
              return (
                <div
                  key={key}
                  className={cn(
                    "sticky top-0 z-20 flex flex-col justify-center gap-0.5 border-b border-l border-border px-3",
                    isEventDay ? "bg-accent/40" : "bg-card"
                  )}
                  style={{ height: HEADER_HEIGHT }}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {label.weekday}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isEventDay ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label.day}
                    </span>
                  </span>
                  {count > 0 && onOpenDay ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto justify-start p-0 text-[11px]"
                      onClick={() => onOpenDay(key)}
                    >
                      {count} session{count === 1 ? "" : "s"}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {count > 0 ? `${count} sessions` : "—"}
                    </span>
                  )}
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
                      top:
                        (minutes - windowStartMinutes) * WEEK_PIXELS_PER_MINUTE,
                    }}
                  >
                    {formatMinutes(minutes)}
                  </span>
                ))}
              </div>
            </div>

            {/* Day columns */}
            {keys.map((key) => (
              <div
                key={key}
                data-day={key}
                className={cn(
                  "relative border-l border-border",
                  eventDays.has(key) ? "bg-accent/10" : undefined
                )}
                style={{
                  height: totalHeight,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px)`,
                }}
              >
                {sessionsOnDay(sessions, key, timeZone).map(
                  (session, index, all) => (
                    <WeekBlock
                      key={session.id}
                      session={session}
                      rooms={rooms}
                      conflicts={conflicts}
                      conflicted={conflictIds.has(session.id)}
                      dayKeys={dayKeys}
                      timeZone={timeZone}
                      windowStartMinutes={windowStartMinutes}
                      focused={focusId === session.id}
                      lane={laneOf(session, all.slice(0, index), timeZone)}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {inWeek.length === 0 ? (
          <p className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
            No sessions land in this week yet. Place a few in the Day view and
            the week fills in here.
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Rough side-by-side placement: a session that overlaps one already drawn is
 * nudged into the next lane. Two lanes is plenty at this zoom — beyond that the
 * Day grid is the right tool, and the header links straight to it.
 */
function laneOf(
  session: ScheduledSession,
  earlier: Array<ScheduledSession>,
  timeZone: string
): number {
  const start = minutesIntoDay(session.startsAt, timeZone)
  const overlapping = earlier.filter((other) => {
    const otherStart = minutesIntoDay(other.startsAt, timeZone)
    return (
      otherStart < start + session.durationMinutes &&
      start < otherStart + other.durationMinutes
    )
  })
  return Math.min(overlapping.length, 1)
}

interface WeekBlockProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflicted: boolean
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  focused: boolean
  lane: number
}

function WeekBlock({
  session,
  rooms,
  conflicts,
  conflicted,
  dayKeys,
  timeZone,
  windowStartMinutes,
  focused,
  lane,
}: WeekBlockProps) {
  const [open, setOpen] = React.useState(false)
  const start = minutesIntoDay(session.startsAt, timeZone)
  const top = (start - windowStartMinutes) * WEEK_PIXELS_PER_MINUTE
  const height = Math.max(session.durationMinutes * WEEK_PIXELS_PER_MINUTE, 18)

  return (
    <div
      className="absolute z-10"
      style={{
        top,
        height,
        left: lane === 0 ? 4 : "50%",
        right: 4,
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`${session.title} — open session details`}
            />
          }
          className={cn(
            "relative flex h-full w-full flex-col justify-center overflow-hidden rounded-md border bg-card px-1.5 py-1 text-left shadow-xs transition-shadow",
            "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            conflicted
              ? "border-destructive/40 ring-2 ring-destructive/60"
              : "border-border",
            focused && !conflicted && "ring-2 ring-primary/70"
          )}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 rounded-l-[5px]"
            style={{ backgroundColor: session.track?.color ?? NO_TRACK_COLOR }}
          />
          {conflicted ? (
            <RiErrorWarningLine
              size={12}
              aria-hidden
              className="absolute top-0.5 right-0.5 text-destructive"
            />
          ) : null}
          <span className="truncate pl-1.5 text-[11px] leading-4 font-medium text-foreground">
            {session.title}
          </span>
          {height >= 34 ? (
            <span className="truncate pl-1.5 text-[10px] leading-4 text-muted-foreground">
              {formatMinutes(start)} · {speakerLabel(session.speakers)}
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

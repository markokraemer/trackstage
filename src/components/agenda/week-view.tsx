/**
 * Week view — seven day columns, time down the side (brief #5: "viewable by
 * list, day, week, track, or room").
 *
 * The Day grid answers "what's in each room at 2pm?". This one answers the
 * question that comes before it: "how is the whole week shaped?" — which days
 * are heavy, which are empty, where the event actually sits in the calendar.
 * Deliberately lighter than the Day grid: half the vertical zoom, no per-room
 * columns, no edge resizing at this size.
 *
 * It is, however, fully draggable, because moving a session to another *day* is
 * the one thing only this view can do in a single gesture. Columns are days, so
 * a drop keeps the room and changes the date and time — with the same ghost,
 * chip, conflict pre-warning and keyboard path as everywhere else.
 */

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type {
  AgendaConflict,
  AgendaRoom,
  AgendaSession,
  ScheduledSession,
} from "./agenda-model"
import { sessionsOnDay, shingle, windowForDay } from "./agenda-model"
import {
  dayKeyOf,
  formatMinutes,
  formatWeekRange,
  formatWeekdayShort,
  weekKeys,
} from "./agenda-time"
import {
  DragAnnouncer,
  DropGhost,
  KeyboardDragHint,
  PointerDragChip,
} from "./drag-layer"
import { GridBlock } from "./grid-block"
import { SessionCardBody, sessionBlockStyle } from "./session-card"
import { useAgendaActions } from "./use-agenda-actions"
import type { AgendaColumn, AgendaDragMachine } from "./use-drag-machine"
import {
  AGENDA_AUTO_SCROLL,
  columnDroppableId,
  useDragMachine,
} from "./use-drag-machine"

const AXIS_WIDTH = 60
const HEADER_HEIGHT = 52
const MIN_COLUMN_WIDTH = 132
/** Half the Day grid's zoom — a whole week has to fit on one screen. */
const WEEK_PIXELS_PER_MINUTE = 20 / 15 / 2
const HINT_ID = "agenda-week-drag-hint"

export interface WeekViewProps {
  sessions: Array<ScheduledSession>
  /** Every scheduled session on the board — the conflict pre-warning pool. */
  boardSessions: Array<AgendaSession>
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  /** The day whose week is shown. */
  dayKey: string
  /** Every day the event covers — used to tint the event's own days. */
  dayKeys: Array<string>
  timeZone: string
  /** Default window; widened here to fit everything anywhere in the week. */
  windowStartMinutes: number
  windowEndMinutes: number
  focusId?: string
  /** Jump to a day in the Day grid. */
  onOpenDay?: (dayKey: string) => void
}

export function WeekView({
  sessions,
  boardSessions,
  rooms,
  conflicts,
  conflictIds,
  dayKey,
  dayKeys,
  timeZone,
  windowStartMinutes: defaultStartMinutes,
  windowEndMinutes: defaultEndMinutes,
  focusId,
  onOpenDay,
}: WeekViewProps) {
  const { place } = useAgendaActions()
  const [justPlacedId, setJustPlacedId] = React.useState<string | null>(null)
  const [overlaySize, setOverlaySize] = React.useState({
    width: MIN_COLUMN_WIDTH - 12,
    height: 40,
  })
  const draggedRef = React.useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const keys = React.useMemo(() => weekKeys(dayKey), [dayKey])
  const eventDays = React.useMemo(() => new Set(dayKeys), [dayKeys])

  const inWeek = React.useMemo(
    () => keys.flatMap((key) => sessionsOnDay(sessions, key, timeZone)),
    [keys, sessions, timeZone]
  )

  // One shared window across all seven columns, widened so an early or late
  // session on any day of the week stays visible.
  const { startMinutes: windowStartMinutes, endMinutes: windowEndMinutes } =
    React.useMemo(
      () =>
        windowForDay(
          inWeek,
          timeZone,
          defaultStartMinutes / 60,
          defaultEndMinutes / 60
        ),
      [inWeek, timeZone, defaultStartMinutes, defaultEndMinutes]
    )

  const columns = React.useMemo<Array<AgendaColumn>>(
    () =>
      keys.map((key) => ({
        key,
        name: formatWeekdayShort(key).weekday + " " + formatWeekdayShort(key).day,
        dayKey: key,
      })),
    [keys]
  )

  const machine = useDragMachine({
    columns,
    sessions,
    boardSessions,
    rooms,
    timeZone,
    windowStartMinutes,
    windowEndMinutes,
    pixelsPerMinute: WEEK_PIXELS_PER_MINUTE,
    columnOf: (session) =>
      typeof session.startsAt === "number"
        ? dayKeyOf(session.startsAt, timeZone)
        : undefined,
    onCommit: (placement) => {
      if (placement.blockedReason || !placement.roomId) return
      if (placement.session.startsAt === placement.startsAt) return
      setJustPlacedId(placement.session.id)
      window.setTimeout(() => setJustPlacedId(null), 700)
      void place({
        submissionId: placement.session.id,
        roomId: placement.roomId,
        startsAt: placement.startsAt,
        durationMinutes: placement.durationMinutes,
        title: placement.session.title,
        roomName: rooms.find((room) => room._id === placement.roomId)?.name,
        timeZone,
        silent: true,
      })
    },
  })

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
  const activeSession = machine.activeSession

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={AGENDA_AUTO_SCROLL}
      onDragStart={(event) => {
        draggedRef.current = false
        const rect = event.active.rect.current.initial
        if (rect) setOverlaySize({ width: rect.width, height: rect.height })
        machine.dndHandlers.onDragStart(event)
      }}
      onDragMove={(event) => {
        draggedRef.current = true
        machine.dndHandlers.onDragMove(event)
      }}
      onDragCancel={machine.dndHandlers.onDragCancel}
      onDragEnd={(event) => {
        window.setTimeout(() => {
          draggedRef.current = false
        }, 0)
        machine.dndHandlers.onDragEnd(event)
      }}
    >
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
                const targeted = machine.placement?.column.key === key
                return (
                  <div
                    key={key}
                    className={cn(
                      "sticky top-0 z-20 flex flex-col justify-center gap-0.5 border-b border-l border-border px-3 transition-colors",
                      targeted
                        ? "bg-primary/8"
                        : isEventDay
                          ? "bg-accent/40"
                          : "bg-card"
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
                          isEventDay
                            ? "text-foreground"
                            : "text-muted-foreground"
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
                          (minutes - windowStartMinutes) *
                          WEEK_PIXELS_PER_MINUTE,
                      }}
                    >
                      {formatMinutes(minutes)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Day columns */}
              {keys.map((key) => (
                <DayColumn
                  key={key}
                  dayKey={key}
                  isEventDay={eventDays.has(key)}
                  height={totalHeight}
                  sessions={sessionsOnDay(sessions, key, timeZone)}
                  rooms={rooms}
                  conflicts={conflicts}
                  conflictIds={conflictIds}
                  dayKeys={dayKeys}
                  timeZone={timeZone}
                  windowStartMinutes={windowStartMinutes}
                  windowEndMinutes={windowEndMinutes}
                  draggedRef={draggedRef}
                  focusId={focusId}
                  machine={machine}
                  justPlacedId={justPlacedId}
                />
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

      <KeyboardDragHint id={HINT_ID} />
      <DragAnnouncer message={machine.announcement} />

      {machine.source === "pointer" && activeSession ? (
        <PointerDragChip
          placement={machine.placement}
          title={activeSession.title}
        />
      ) : null}

      <DragOverlay dropAnimation={null}>
        {activeSession ? (
          <div
            className="relative flex cursor-grabbing items-start overflow-hidden rounded-md border px-1.5 py-1 opacity-90 shadow-xl"
            style={{
              width: overlaySize.width,
              height: overlaySize.height,
              ...sessionBlockStyle(activeSession, { solid: true }),
            }}
          >
            <SessionCardBody
              session={activeSession}
              timeZone={timeZone}
              density="tight"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface DayColumnProps {
  dayKey: string
  isEventDay: boolean
  height: number
  sessions: Array<ScheduledSession>
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  draggedRef: React.RefObject<boolean>
  focusId?: string
  machine: AgendaDragMachine
  justPlacedId: string | null
}

function DayColumn({
  dayKey,
  isEventDay,
  height,
  sessions,
  rooms,
  conflicts,
  conflictIds,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  draggedRef,
  focusId,
  machine,
  justPlacedId,
}: DayColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: columnDroppableId(dayKey),
  })
  const ghost = machine.ghostFor(dayKey)
  const hourPx = 60 * WEEK_PIXELS_PER_MINUTE

  return (
    <div
      ref={setNodeRef}
      data-day={dayKey}
      className={cn(
        "relative border-l border-border transition-colors",
        isEventDay && "bg-accent/10",
        isOver && "bg-primary/4"
      )}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px)`,
      }}
    >
      {shingle(sessions).map(({ session, depth }) => (
        <GridBlock
          key={session.id}
          session={session}
          rooms={rooms}
          conflicts={conflicts}
          conflicted={conflictIds.has(session.id)}
          dayKeys={dayKeys}
          timeZone={timeZone}
          windowStartMinutes={windowStartMinutes}
          windowEndMinutes={windowEndMinutes}
          pixelsPerMinute={WEEK_PIXELS_PER_MINUTE}
          depth={depth}
          machine={machine}
          draggedRef={draggedRef}
          focused={focusId === session.id}
          justPlaced={justPlacedId === session.id}
          resizable={false}
          keyboardHintId={HINT_ID}
        />
      ))}

      {ghost ? (
        <DropGhost
          placement={ghost}
          pixelsPerMinute={WEEK_PIXELS_PER_MINUTE}
          windowStartMinutes={windowStartMinutes}
          keyboard={machine.isKeyboard}
        />
      ) : null}
    </div>
  )
}

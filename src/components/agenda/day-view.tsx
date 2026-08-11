/**
 * Day view — the hero of the agenda builder (docs/SPEC.md §4.6).
 *
 * A CSS-grid time axis (15-minute rows) with one column per room. Accepted
 * sessions sit on the grid as absolutely-positioned cards you can drag between
 * slots and rooms, resize by the bottom edge, or edit through the popover.
 *
 * The drag itself is defined in `use-drag-machine.ts` and rendered by
 * `drag-layer.tsx`, so Week, Track and Rooms behave identically: a ghost lands
 * in the exact snapped slot, a chip names the time and the column, and a
 * would-be double-booking turns both of them red *before* the drop — without
 * ever preventing it. Everything drag does is also reachable by keyboard
 * (Enter to pick up, arrows to move, Enter to drop) and by plain selects in the
 * popover, so the flow works for keyboard users and for the browser agent that
 * judges us.
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
import { RiDoorOpenLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/empty-state"
import type {
  AgendaConflict,
  AgendaRoom,
  AgendaSession,
  ScheduledSession,
} from "./agenda-model"
import { shingle } from "./agenda-model"
import {
  PIXELS_PER_MINUTE,
  SLOT_MINUTES,
  formatMinutes,
} from "./agenda-time"
import { DragAnnouncer, DropGhost, KeyboardDragHint, PointerDragChip } from "./drag-layer"
import { GridBlock } from "./grid-block"
import { SessionCardBody, sessionBlockStyle } from "./session-card"
import { UnscheduledTray } from "./unscheduled-tray"
import { useAgendaActions } from "./use-agenda-actions"
import type { AgendaColumn, AgendaDragMachine } from "./use-drag-machine"
import {
  AGENDA_AUTO_SCROLL,
  columnDroppableId,
  useDragMachine,
} from "./use-drag-machine"

const AXIS_WIDTH = 68
const HEADER_HEIGHT = 44
const MIN_COLUMN_WIDTH = 190
const HINT_ID = "agenda-day-drag-hint"

export interface DayViewProps {
  rooms: Array<AgendaRoom>
  /** Sessions scheduled on the selected day. */
  sessions: Array<ScheduledSession>
  unscheduled: Array<AgendaSession>
  /** Every scheduled session on the board — the conflict pre-warning pool. */
  boardSessions: Array<AgendaSession>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  dayKey: string
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  /** Session id to highlight + scroll to (from the Conflicts view jump). */
  focusId?: string
}

export function DayView({
  rooms,
  sessions,
  unscheduled,
  boardSessions,
  conflicts,
  conflictIds,
  dayKey,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  focusId,
}: DayViewProps) {
  const { place } = useAgendaActions()
  const [overlaySize, setOverlaySize] = React.useState({
    width: MIN_COLUMN_WIDTH - 12,
    height: 60,
  })
  const [justPlacedId, setJustPlacedId] = React.useState<string | null>(null)
  /** True once a pointer drag actually moved — stops the click popover firing. */
  const draggedRef = React.useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const allSessions = React.useMemo(
    () => [...sessions, ...unscheduled],
    [sessions, unscheduled]
  )

  const columns = React.useMemo<Array<AgendaColumn>>(
    () =>
      rooms.map((room) => ({
        key: String(room._id),
        name: room.name,
        dayKey,
        roomId: String(room._id),
      })),
    [rooms, dayKey]
  )

  const machine = useDragMachine({
    columns,
    sessions: allSessions,
    boardSessions,
    rooms,
    timeZone,
    windowStartMinutes,
    windowEndMinutes,
    pixelsPerMinute: PIXELS_PER_MINUTE,
    columnOf: (session) => session.roomId,
    onCommit: (placement) => {
      if (placement.blockedReason || !placement.roomId) return
      const unchanged =
        placement.session.roomId === placement.roomId &&
        placement.session.startsAt === placement.startsAt
      if (unchanged) return
      setJustPlacedId(placement.session.id)
      window.setTimeout(() => setJustPlacedId(null), 700)
      void place({
        submissionId: placement.session.id,
        roomId: placement.roomId,
        startsAt: placement.startsAt,
        durationMinutes: placement.durationMinutes,
        title: placement.session.title,
        roomName: placement.column.name,
        timeZone,
        silent: true,
      })
    },
  })

  const totalHeight =
    (windowEndMinutes - windowStartMinutes) * PIXELS_PER_MINUTE

  /** Scheduled but room-less — they have no column, so say so out loud. */
  const roomlessSessions = sessions.filter((session) => !session.roomId)

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
        title="Add a room before you build the agenda"
        description="Rooms become the columns of your day grid. Add your stages, breakout rooms, and workshop spaces under Settings → Rooms & tracks, then come back here to place sessions."
      />
    )
  }

  const gridTemplateColumns = `${AXIS_WIDTH}px repeat(${rooms.length}, minmax(${MIN_COLUMN_WIDTH}px, 1fr))`
  const minWidth = AXIS_WIDTH + rooms.length * MIN_COLUMN_WIDTH
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="max-h-[calc(100svh-19rem)] min-h-100 overflow-auto">
            <div className="grid" style={{ gridTemplateColumns, minWidth }}>
              {/* Header row — sticky room names */}
              <div
                className="sticky top-0 left-0 z-30 border-r border-b border-border bg-card"
                style={{ height: HEADER_HEIGHT }}
              />
              {rooms.map((room) => {
                const targeted =
                  machine.placement?.column.key === String(room._id)
                return (
                  <div
                    key={room._id}
                    className={cn(
                      "sticky top-0 z-20 flex flex-col justify-center border-b border-l border-border px-3 transition-colors",
                      targeted ? "bg-primary/8" : "bg-card"
                    )}
                    style={{ height: HEADER_HEIGHT }}
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {room.name}
                    </p>
                    {room.capacity ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        Seats {room.capacity}
                      </p>
                    ) : null}
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

              {/* Room columns */}
              {rooms.map((room) => (
                <RoomColumn
                  key={room._id}
                  room={room}
                  height={totalHeight}
                  sessions={sessions.filter(
                    (session) => session.roomId === room._id
                  )}
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

          {roomlessSessions.length > 0 ? (
            <p className="border-t border-border bg-status-amber-bg/50 px-4 py-2.5 text-center text-xs text-status-amber-fg">
              {roomlessSessions.length} session
              {roomlessSessions.length === 1 ? " has" : "s have"} a time but no
              room yet, so{" "}
              {roomlessSessions.length === 1 ? "it isn't" : "they aren't"} on
              the grid. Give {roomlessSessions.length === 1 ? "it" : "them"} a
              room in the List view.
            </p>
          ) : null}

          {sessions.length === 0 ? (
            <p className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
              Nothing scheduled on this day yet. Drag a session out of{" "}
              <span className="font-medium text-foreground">Not scheduled</span>{" "}
              onto the grid, or open a session and use{" "}
              <span className="font-medium text-foreground">
                Schedule session
              </span>
              .
            </p>
          ) : null}
        </div>

        <UnscheduledTray
          sessions={unscheduled}
          rooms={rooms}
          dayKeys={dayKeys}
          defaultDayKey={dayKey}
          timeZone={timeZone}
          draggedRef={draggedRef}
          machine={machine}
          keyboardHintId={HINT_ID}
        />
      </div>

      <KeyboardDragHint id={HINT_ID} />
      <DragAnnouncer message={machine.announcement} />

      {machine.source === "pointer" && machine.placement ? (
        <PointerDragChip placement={machine.placement} />
      ) : null}

      <DragOverlay dropAnimation={null}>
        {activeSession ? (
          <div
            className="relative flex cursor-grabbing items-start overflow-hidden rounded-lg border px-2 py-1.5 opacity-90 shadow-xl"
            style={{
              width: overlaySize.width,
              height: overlaySize.height,
              ...sessionBlockStyle(activeSession, { solid: true }),
            }}
          >
            <SessionCardBody
              session={activeSession}
              timeZone={timeZone}
              density={overlaySize.height < 56 ? "tight" : "roomy"}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface RoomColumnProps {
  room: AgendaRoom
  rooms: Array<AgendaRoom>
  height: number
  sessions: Array<ScheduledSession>
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

function RoomColumn({
  room,
  rooms,
  height,
  sessions,
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
}: RoomColumnProps) {
  const columnKey = String(room._id)
  const { isOver, setNodeRef } = useDroppable({
    id: columnDroppableId(columnKey),
  })
  const ghost = machine.ghostFor(columnKey)
  const hourPx = 60 * PIXELS_PER_MINUTE
  const slotPx = SLOT_MINUTES * PIXELS_PER_MINUTE
  const dragging = machine.activeId !== null

  return (
    <div
      ref={setNodeRef}
      data-room={room.name}
      className={cn(
        "relative border-l border-border transition-colors",
        isOver && "bg-primary/4"
      )}
      style={{
        height,
        /*
         * Hour-only rules at rest (Notion Calendar shows no half-hour lines —
         * docs/reference/design-references.md §4a). The 15-minute snap lines
         * fade in only while something is in the air, when they stop being
         * clutter and start being a ruler.
         */
        backgroundImage: dragging
          ? `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px), repeating-linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 0px, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px, transparent ${slotPx}px)`
          : `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px)`,
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
          pixelsPerMinute={PIXELS_PER_MINUTE}
          depth={depth}
          machine={machine}
          draggedRef={draggedRef}
          focused={focusId === session.id}
          justPlaced={justPlacedId === session.id}
          keyboardHintId={HINT_ID}
        />
      ))}

      {ghost ? (
        <DropGhost
          placement={ghost}
          pixelsPerMinute={PIXELS_PER_MINUTE}
          windowStartMinutes={windowStartMinutes}
          keyboard={machine.isKeyboard}
        />
      ) : null}
    </div>
  )
}

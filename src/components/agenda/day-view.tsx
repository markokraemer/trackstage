/**
 * Day view — the hero of the agenda builder (docs/SPEC.md §4.6).
 *
 * A CSS-grid time axis (15-minute rows) with one column per room. Accepted
 * sessions sit on the grid as absolutely-positioned cards you can drag between
 * slots and rooms, resize by the bottom edge, or edit through the popover.
 * Everything that drag-and-drop does is also reachable with plain selects, so
 * the flow works for keyboard users and for the browser agent that judges us.
 */

import * as React from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
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
  AgendaSession,
  ScheduledSession,
} from "./agenda-model"
import { conflictsForSession } from "./agenda-model"
import {
  PIXELS_PER_MINUTE,
  SLOT_MINUTES,
  clamp,
  formatMinutes,
  minutesIntoDay,
  snapMinutes,
  timeAt,
} from "./agenda-time"
import { SessionCardBody, SessionDetailContent } from "./session-card"
import { UnscheduledTray } from "./unscheduled-tray"
import { useAgendaActions } from "./use-agenda-actions"

const AXIS_WIDTH = 68
const HEADER_HEIGHT = 44
const MIN_COLUMN_WIDTH = 190
const COLUMN_PREFIX = "room:"

export interface DayViewProps {
  rooms: Array<AgendaRoom>
  /** Sessions scheduled on the selected day. */
  sessions: Array<ScheduledSession>
  unscheduled: Array<AgendaSession>
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
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [overlaySize, setOverlaySize] = React.useState({
    width: MIN_COLUMN_WIDTH - 12,
    height: 60,
  })
  /** True once a pointer drag actually moved — stops the click popover firing. */
  const draggedRef = React.useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const allSessions = React.useMemo(
    () => [...sessions, ...unscheduled],
    [sessions, unscheduled]
  )
  const activeSession = allSessions.find((session) => session.id === activeId)

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

  function handleDragStart(event: DragStartEvent) {
    draggedRef.current = false
    setActiveId(String(event.active.id))
    const rect = event.active.rect.current.initial
    if (rect) {
      setOverlaySize({ width: rect.width, height: rect.height })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    // Let the click that follows pointerup know a drag happened.
    window.setTimeout(() => {
      draggedRef.current = false
    }, 0)

    const overId = String(event.over?.id ?? "")
    if (!overId.startsWith(COLUMN_PREFIX)) return
    const roomId = overId.slice(COLUMN_PREFIX.length)
    const activeRect = event.active.rect.current.translated
    const overRect = event.over?.rect
    if (!activeRect || !overRect) return

    const session = allSessions.find(
      (candidate) => candidate.id === String(event.active.id)
    )
    if (!session) return

    const offsetMinutes =
      (activeRect.top - overRect.top) / PIXELS_PER_MINUTE + windowStartMinutes
    const minutes = clamp(
      snapMinutes(offsetMinutes),
      windowStartMinutes,
      Math.max(windowStartMinutes, windowEndMinutes - session.durationMinutes)
    )

    const alreadyThere =
      session.roomId === roomId &&
      typeof session.startsAt === "number" &&
      session.startsAt === timeAt(dayKey, minutes, timeZone)
    if (alreadyThere) return

    void place({
      submissionId: session.id,
      roomId,
      startsAt: timeAt(dayKey, minutes, timeZone),
      durationMinutes: session.durationMinutes,
      title: session.title,
      roomName: rooms.find((room) => room._id === roomId)?.name,
      timeZone,
    })
  }

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={() => {
        draggedRef.current = true
      }}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
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
              {rooms.map((room) => (
                <div
                  key={room._id}
                  className="sticky top-0 z-20 flex flex-col justify-center border-b border-l border-border bg-card px-3"
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
              ))}

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
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSession ? (
          <div
            className="relative flex cursor-grabbing overflow-hidden rounded-lg border border-primary/40 bg-card px-2 py-1.5 shadow-lg ring-2 ring-primary/30"
            style={{ width: overlaySize.width, height: overlaySize.height }}
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
}: RoomColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${COLUMN_PREFIX}${room._id}`,
  })
  const hourPx = 60 * PIXELS_PER_MINUTE

  return (
    <div
      ref={setNodeRef}
      data-room={room.name}
      className={cn(
        "relative border-l border-border transition-colors",
        isOver && "bg-primary/5"
      )}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, rgba(15,23,42,0.07) 0px, rgba(15,23,42,0.07) 1px, transparent 1px, transparent ${hourPx}px), repeating-linear-gradient(to bottom, rgba(15,23,42,0.03) 0px, rgba(15,23,42,0.03) 1px, transparent 1px, transparent ${SLOT_MINUTES * PIXELS_PER_MINUTE}px)`,
      }}
    >
      {sessions.map((session) => (
        <GridCard
          key={session.id}
          session={session}
          rooms={rooms}
          conflicts={conflicts}
          conflicted={conflictIds.has(session.id)}
          dayKeys={dayKeys}
          timeZone={timeZone}
          windowStartMinutes={windowStartMinutes}
          windowEndMinutes={windowEndMinutes}
          draggedRef={draggedRef}
          focused={focusId === session.id}
        />
      ))}
    </div>
  )
}

interface GridCardProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflicted: boolean
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  draggedRef: React.RefObject<boolean>
  focused: boolean
}

function GridCard({
  session,
  rooms,
  conflicts,
  conflicted,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  draggedRef,
  focused,
}: GridCardProps) {
  const { place } = useAgendaActions()
  const [open, setOpen] = React.useState(false)
  const [draftDuration, setDraftDuration] = React.useState<number | null>(null)
  const resizeRef = React.useRef<{
    startY: number
    startDuration: number
  } | null>(null)
  const cardRef = React.useRef<HTMLDivElement | null>(null)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: session.id,
  })

  const startMinutes = minutesIntoDay(session.startsAt, timeZone)
  const duration = draftDuration ?? session.durationMinutes
  const top = (startMinutes - windowStartMinutes) * PIXELS_PER_MINUTE
  const height = Math.max(duration * PIXELS_PER_MINUTE, 22)
  const maxDuration = Math.max(SLOT_MINUTES, windowEndMinutes - startMinutes)

  React.useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [focused])

  function beginResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      startY: event.clientY,
      startDuration: session.durationMinutes,
    }
    setDraftDuration(session.durationMinutes)
  }

  function durationFromPointer(clientY: number): number {
    const state = resizeRef.current
    if (!state) return session.durationMinutes
    const deltaMinutes = (clientY - state.startY) / PIXELS_PER_MINUTE
    return clamp(
      snapMinutes(state.startDuration + deltaMinutes),
      SLOT_MINUTES,
      maxDuration
    )
  }

  function moveResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return
    setDraftDuration(durationFromPointer(event.clientY))
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>) {
    const state = resizeRef.current
    if (!state) return
    resizeRef.current = null
    const next = durationFromPointer(event.clientY)
    setDraftDuration(null)
    if (next !== state.startDuration && session.roomId) {
      void place({
        submissionId: session.id,
        roomId: session.roomId,
        startsAt: session.startsAt,
        durationMinutes: next,
        title: session.title,
        roomName: rooms.find((room) => room._id === session.roomId)?.name,
        timeZone,
      })
    }
  }

  return (
    <div
      ref={(node) => {
        cardRef.current = node
        setNodeRef(node)
      }}
      className="absolute right-1 left-1 z-10"
      style={{ top, height }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next && draggedRef.current) return
          setOpen(next)
        }}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`${session.title} — open session details`}
            />
          }
          className={cn(
            "relative flex h-full w-full cursor-grab touch-none items-start overflow-hidden rounded-lg border bg-card px-2 py-1.5 text-left shadow-xs transition-shadow",
            "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            conflicted
              ? "border-destructive/40 ring-2 ring-destructive/60"
              : "border-border",
            isDragging && "opacity-40",
            focused && !conflicted && "ring-2 ring-primary/70"
          )}
          {...listeners}
          {...attributes}
        >
          {conflicted ? (
            <RiErrorWarningLine
              size={14}
              aria-hidden
              className="absolute top-1.5 right-1.5 text-destructive"
            />
          ) : null}
          <SessionCardBody
            session={{ ...session, durationMinutes: duration }}
            timeZone={timeZone}
            density={height < 56 ? "tight" : "roomy"}
          />
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

      {/* Resize handle — drag the bottom edge to change the length. */}
      <div
        role="presentation"
        title="Drag to change the session length"
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className="absolute inset-x-2 -bottom-0.5 z-20 h-2 cursor-ns-resize touch-none rounded-full opacity-0 transition-opacity hover:bg-primary/40 hover:opacity-100"
      />
      {draftDuration !== null ? (
        <span className="pointer-events-none absolute -bottom-5 left-1 z-30 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
          {draftDuration} min
        </span>
      ) : null}
    </div>
  )
}

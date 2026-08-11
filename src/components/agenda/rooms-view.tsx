/**
 * Rooms view — one swimlane per room, time running left to right.
 *
 * Answers the question the Day grid can't at a glance: "how busy is each room,
 * and where are the gaps?" It is the transpose of the Day grid, and it shares
 * the same drag machine turned on its side: lanes are the columns, the time
 * axis is horizontal, and dropping a block into another lane moves the session
 * to that room. Ghost, chip, conflict pre-warning and the keyboard path are
 * identical — only the geometry changes.
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
import { motion, useReducedMotion } from "motion/react"
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
import { conflictsForSession, shingle, speakerLabel } from "./agenda-model"
import {
  SLOT_MINUTES,
  clamp,
  formatDuration,
  formatMinutes,
  formatTimeRange,
  minutesIntoDay,
  snapMinutes,
} from "./agenda-time"
import {
  DragAnnouncer,
  DropGhost,
  KeyboardDragHint,
  PointerDragChip,
} from "./drag-layer"
import {
  SessionCardBody,
  SessionDetailContent,
  sessionBlockStyle,
} from "./session-card"
import { useAgendaActions } from "./use-agenda-actions"
import type { AgendaColumn, AgendaDragMachine } from "./use-drag-machine"
import {
  AGENDA_AUTO_SCROLL,
  columnDroppableId,
  useDragMachine,
} from "./use-drag-machine"

const LANE_HEIGHT = 76
const ROOM_LABEL_WIDTH = 150
/** Horizontal zoom: pixels per minute across the swimlane. */
const PX_PER_MINUTE = 2.6
const HINT_ID = "agenda-rooms-drag-hint"

export interface RoomsViewProps {
  rooms: Array<AgendaRoom>
  sessions: Array<ScheduledSession>
  /** Every scheduled session on the board — the conflict pre-warning pool. */
  boardSessions: Array<AgendaSession>
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
  dayKey: string
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  focusId?: string
}

export function RoomsView({
  rooms,
  sessions,
  boardSessions,
  conflicts,
  conflictIds,
  dayKey,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  focusId,
}: RoomsViewProps) {
  const { place } = useAgendaActions()
  const [justPlacedId, setJustPlacedId] = React.useState<string | null>(null)
  const [overlaySize, setOverlaySize] = React.useState({
    width: 140,
    height: 56,
  })
  const draggedRef = React.useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
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
    sessions,
    boardSessions,
    rooms,
    timeZone,
    windowStartMinutes,
    windowEndMinutes,
    pixelsPerMinute: PX_PER_MINUTE,
    orientation: "horizontal",
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

            {rooms.map((room) => (
              <RoomLane
                key={room._id}
                room={room}
                rooms={rooms}
                laneWidth={laneWidth}
                sessions={sessions.filter(
                  (session) => session.roomId === room._id
                )}
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

        {sessions.length === 0 ? (
          <p className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
            No sessions are scheduled on this day yet — place a few in the Day
            view and the rooms fill up here.
          </p>
        ) : null}
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
            className="relative flex cursor-grabbing flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 opacity-90 shadow-xl"
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

interface RoomLaneProps {
  room: AgendaRoom
  rooms: Array<AgendaRoom>
  laneWidth: number
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

function RoomLane({
  room,
  rooms,
  laneWidth,
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
}: RoomLaneProps) {
  const columnKey = String(room._id)
  const { isOver, setNodeRef } = useDroppable({
    id: columnDroppableId(columnKey),
  })
  const ghost = machine.ghostFor(columnKey)

  return (
    <div className="flex border-b border-border last:border-b-0">
      <div
        className={cn(
          "shrink-0 border-r border-border px-3 py-3 transition-colors",
          machine.placement?.column.key === columnKey && "bg-primary/8"
        )}
        style={{ width: ROOM_LABEL_WIDTH }}
      >
        <p className="truncate text-sm font-semibold text-foreground">
          {room.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {sessions.length === 0
            ? "Free all day"
            : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn("relative transition-colors", isOver && "bg-primary/4")}
        style={{
          width: laneWidth,
          height: LANE_HEIGHT,
          backgroundImage: `repeating-linear-gradient(to right, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${60 * PX_PER_MINUTE}px)`,
        }}
      >
        {shingle(sessions).map(({ session, depth }) => (
          <LaneBlock
            key={session.id}
            session={session}
            rooms={rooms}
            conflicts={conflicts}
            conflicted={conflictIds.has(session.id)}
            dayKeys={dayKeys}
            timeZone={timeZone}
            windowStartMinutes={windowStartMinutes}
            windowEndMinutes={windowEndMinutes}
            depth={depth}
            draggedRef={draggedRef}
            focused={focusId === session.id}
            justPlaced={justPlacedId === session.id}
            machine={machine}
          />
        ))}

        {ghost ? (
          <DropGhost
            placement={ghost}
            pixelsPerMinute={PX_PER_MINUTE}
            windowStartMinutes={windowStartMinutes}
            orientation="horizontal"
            keyboard={machine.isKeyboard}
          />
        ) : null}
      </div>
    </div>
  )
}

interface LaneBlockProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflicted: boolean
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  depth: number
  draggedRef: React.RefObject<boolean>
  focused: boolean
  justPlaced: boolean
  machine: AgendaDragMachine
}

function LaneBlock({
  session,
  rooms,
  conflicts,
  conflicted,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  depth,
  draggedRef,
  focused,
  justPlaced,
  machine,
}: LaneBlockProps) {
  const { place } = useAgendaActions()
  const reduced = useReducedMotion()
  const [open, setOpen] = React.useState(false)
  const [draftDuration, setDraftDuration] = React.useState<number | null>(null)
  const resizeRef = React.useRef<{
    startX: number
    startDuration: number
  } | null>(null)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: session.id,
  })
  const grabbed = machine.isGrabbed(session.id)

  const start = minutesIntoDay(session.startsAt, timeZone)
  const duration = draftDuration ?? session.durationMinutes
  const left = (start - windowStartMinutes) * PX_PER_MINUTE + 2
  const width = Math.max(duration * PX_PER_MINUTE - 4, 40)
  const top = 8 + depth * 10
  const maxDuration = Math.max(SLOT_MINUTES, windowEndMinutes - start)
  const roomName = rooms.find((room) => room._id === session.roomId)?.name

  // ——— Resize ————————————————————————————————————————————————————————————
  // Time runs left → right here, so the grab handle is the *right* edge. Same
  // 15-minute snap and same duration chip as the vertical grids — the gesture
  // is the block's trailing edge either way.

  function durationFromPointer(clientX: number): number {
    const state = resizeRef.current
    if (!state) return session.durationMinutes
    const deltaMinutes = (clientX - state.startX) / PX_PER_MINUTE
    return clamp(
      snapMinutes(state.startDuration + deltaMinutes),
      SLOT_MINUTES,
      maxDuration
    )
  }

  function beginResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = {
      startX: event.clientX,
      startDuration: session.durationMinutes,
    }
    setDraftDuration(session.durationMinutes)
  }

  function commitDuration(next: number) {
    if (!session.roomId || next === session.durationMinutes) return
    void place({
      submissionId: session.id,
      roomId: session.roomId,
      startsAt: session.startsAt,
      durationMinutes: next,
      title: session.title,
      roomName,
      timeZone,
      silent: true,
    })
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return
    resizeRef.current = null
    const next = durationFromPointer(event.clientX)
    setDraftDuration(null)
    commitDuration(next)
  }

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 700, damping: 42, mass: 0.7 }

  return (
    <motion.div
      data-slot="agenda-lane-block"
      data-session-title={session.title}
      className="absolute"
      style={{ zIndex: 10 + depth }}
      initial={
        justPlaced && !reduced
          ? { opacity: 0, scale: 0.94, left, width, top, bottom: 8 }
          : false
      }
      animate={{ opacity: 1, scale: 1, left, width, top, bottom: 8 }}
      transition={spring}
    >
      <div ref={setNodeRef} className="h-full w-full">
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
                aria-roledescription="Draggable session"
                aria-grabbed={grabbed || undefined}
              />
            }
            className={cn(
              "relative flex h-full w-full cursor-grab touch-none flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 text-left shadow-xs transition-shadow",
              "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              conflicted && "ring-2 ring-destructive/60",
              isDragging && "opacity-35",
              grabbed &&
                "ring-3 shadow-lg ring-primary ring-offset-1 ring-offset-background",
              focused && !conflicted && "ring-2 ring-primary/70"
            )}
            style={sessionBlockStyle(session, { conflicted })}
            onKeyDown={(event: React.KeyboardEvent) => {
              // Shift+arrows resize without ever leaving the keyboard.
              if (
                event.shiftKey &&
                !grabbed &&
                (event.key === "ArrowRight" || event.key === "ArrowLeft")
              ) {
                event.preventDefault()
                commitDuration(
                  clamp(
                    session.durationMinutes +
                      (event.key === "ArrowRight" ? SLOT_MINUTES : -SLOT_MINUTES),
                    SLOT_MINUTES,
                    maxDuration
                  )
                )
                return
              }
              machine.onCardKeyDown(session)(event)
            }}
            {...listeners}
            {...attributes}
            aria-describedby={HINT_ID}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1 rounded-l-[7px]"
              style={{ backgroundColor: "var(--sb-bar)" }}
            />
            {conflicted ? (
              <RiErrorWarningLine
                size={13}
                aria-hidden
                className="absolute top-1 right-1 text-destructive"
              />
            ) : null}
            <span
              className="truncate pl-2 text-[11px] leading-4 font-semibold"
              style={{ color: "var(--sb-title)" }}
            >
              {session.title}
            </span>
            <span
              className="truncate pl-2 text-[10px] leading-4 tabular-nums"
              style={{ color: "var(--sb-meta)" }}
            >
              {formatTimeRange(
                session.startsAt,
                session.durationMinutes,
                timeZone
              )}
            </span>
            <span
              className="truncate pl-2 text-[10px] leading-4"
              style={{ color: "var(--sb-meta)" }}
            >
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

      <div
        role="presentation"
        title="Drag to change the session length"
        onPointerDown={beginResize}
        onPointerMove={(event) => {
          if (!resizeRef.current) return
          setDraftDuration(durationFromPointer(event.clientX))
        }}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className="absolute inset-y-2 -right-0.5 z-20 w-2 cursor-ew-resize touch-none rounded-full opacity-0 transition-opacity hover:bg-primary/40 hover:opacity-100"
      />

      {draftDuration !== null ? (
        <span
          data-slot="agenda-resize-chip"
          className="pointer-events-none absolute top-0 -right-2 z-50 translate-x-full rounded-lg bg-foreground px-2 py-1 text-[11px] font-semibold text-background tabular-nums shadow-lg"
        >
          {formatDuration(draftDuration)}
        </span>
      ) : null}
    </motion.div>
  )
}

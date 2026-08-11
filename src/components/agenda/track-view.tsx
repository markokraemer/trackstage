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
 * Because the columns *are* the tracks, dragging across them means what it
 * looks like it means: the session is re-filed into that track (and keeps its
 * room). Dragging up and down re-times it, exactly as in the Day grid — same
 * ghost, same chip, same conflict pre-warning, same keyboard path.
 *
 * Sessions with no track land in a final "No track" column rather than
 * disappearing — an untracked session is exactly what an organizer needs to
 * see here.
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
import { RiPriceTag3Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/empty-state"
import type {
  AgendaConflict,
  AgendaRoom,
  AgendaSession,
  AgendaTrack,
  ScheduledSession,
} from "./agenda-model"
import { NO_TRACK_COLOR, shingle } from "./agenda-model"
import {
  PIXELS_PER_MINUTE,
  SLOT_MINUTES,
  formatMinutes,
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

const AXIS_WIDTH = 68
const HEADER_HEIGHT = 44
const MIN_COLUMN_WIDTH = 200
const NO_TRACK = "__no_track__"
const HINT_ID = "agenda-track-drag-hint"

export interface TrackViewProps {
  tracks: Array<AgendaTrack>
  rooms: Array<AgendaRoom>
  /** Sessions scheduled on the selected day. */
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

export function TrackView({
  tracks,
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
}: TrackViewProps) {
  const { place, setTrack } = useAgendaActions()
  const [justPlacedId, setJustPlacedId] = React.useState<string | null>(null)
  const [overlaySize, setOverlaySize] = React.useState({
    width: MIN_COLUMN_WIDTH - 12,
    height: 60,
  })
  const draggedRef = React.useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const untracked = sessions.filter((session) => !session.track)

  /** Track columns in the organizer's own order, plus "No track" if needed. */
  const columns = React.useMemo<Array<AgendaColumn>>(() => {
    const cols: Array<AgendaColumn> = tracks.map((track) => ({
      key: String(track._id),
      name: track.name,
      dayKey,
      trackId: String(track._id),
      color: track.color,
    }))
    if (untracked.length > 0) {
      cols.push({
        key: NO_TRACK,
        name: "No track",
        dayKey,
        trackId: null,
        color: NO_TRACK_COLOR,
      })
    }
    return cols
  }, [tracks, untracked.length, dayKey])

  /** A session's column, matched the way the board reports tracks: by name. */
  const columnOf = React.useCallback(
    (session: AgendaSession) => {
      if (!session.track) return NO_TRACK
      const track = tracks.find((one) => one.name === session.track?.name)
      return track ? String(track._id) : NO_TRACK
    },
    [tracks]
  )

  const machine = useDragMachine({
    columns,
    sessions,
    boardSessions,
    rooms,
    timeZone,
    windowStartMinutes,
    windowEndMinutes,
    pixelsPerMinute: PIXELS_PER_MINUTE,
    columnOf,
    onCommit: (placement) => {
      if (placement.blockedReason || !placement.roomId) return
      setJustPlacedId(placement.session.id)
      window.setTimeout(() => setJustPlacedId(null), 700)
      if (placement.session.startsAt !== placement.startsAt) {
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
      }
      // Dropping in a different column re-files the session's track.
      if (columnOf(placement.session) !== placement.column.key) {
        void setTrack(
          placement.session.id,
          placement.column.trackId ?? null,
          placement.session.title
        )
      }
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
        <div className="max-h-[calc(100svh-19rem)] min-h-100 overflow-auto">
          <div className="grid" style={{ gridTemplateColumns, minWidth }}>
            {/* Header row — sticky track names */}
            <div
              className="sticky top-0 left-0 z-30 border-r border-b border-border bg-card"
              style={{ height: HEADER_HEIGHT }}
            />
            {columns.map((column) => {
              const count = sessions.filter(
                (session) => columnOf(session) === column.key
              ).length
              const targeted = machine.placement?.column.key === column.key
              return (
                <div
                  key={column.key}
                  data-track={column.name}
                  className={cn(
                    "sticky top-0 z-20 flex flex-col justify-center border-b border-l border-border px-3 transition-colors",
                    targeted ? "bg-primary/8" : "bg-card"
                  )}
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
              <TrackColumn
                key={column.key}
                column={column}
                height={totalHeight}
                sessions={sessions.filter(
                  (session) => columnOf(session) === column.key
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

        {sessions.length === 0 ? (
          <p className="border-t border-border bg-muted/40 px-4 py-3 text-center text-xs text-muted-foreground">
            Nothing is scheduled on this day yet. Place sessions in the Day view
            and they sort themselves into their tracks here.
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

interface TrackColumnProps {
  column: AgendaColumn
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

function TrackColumn({
  column,
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
}: TrackColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: columnDroppableId(column.key),
  })
  const ghost = machine.ghostFor(column.key)
  const hourPx = 60 * PIXELS_PER_MINUTE
  const slotPx = SLOT_MINUTES * PIXELS_PER_MINUTE
  const dragging = machine.activeId !== null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-l border-border transition-colors",
        isOver && "bg-primary/4"
      )}
      style={{
        height,
        backgroundImage: dragging
          ? `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px), repeating-linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 0px, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px, transparent ${slotPx}px)`
          : `repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${hourPx}px)`,
      }}
    >
      {/*
       * Two talks on the same track can legitimately run at once in different
       * rooms, so overlaps must stay visible — they shingle (offset + stacked)
       * rather than hide behind each other, the same language the Day grid uses
       * for a genuine double-booking.
       */}
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
          roomNameInBody
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

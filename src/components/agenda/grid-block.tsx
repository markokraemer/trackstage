/**
 * One scheduled session sitting on a vertical time grid.
 *
 * Day, Track and Week all draw the same object — a block pinned to a column at
 * `top = (start − windowStart) × pixelsPerMinute` — so it is built once here,
 * with every interaction attached: pointer drag, keyboard drag, bottom-edge
 * resize, the detail popover, the shingle offset for overlaps, and the spring
 * that settles it into a new slot.
 *
 * The settle is the point of the motion: because `agenda.schedule` is
 * optimistic (see use-agenda-actions.ts), the block's `top` changes on the same
 * frame the pointer is released, and animating that change springs the card
 * from where it was into where it landed. Nothing waits for the server; the
 * server just confirms.
 */

import * as React from "react"
import { useDraggable } from "@dnd-kit/core"
import { motion, useReducedMotion } from "motion/react"
import { RiErrorWarningLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
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
import { SHINGLE_STEP, conflictsForSession } from "./agenda-model"
import {
  SLOT_MINUTES,
  clamp,
  formatDuration,
  minutesIntoDay,
  snapMinutes,
} from "./agenda-time"
import {
  SessionCardBody,
  SessionDetailContent,
  sessionBlockStyle,
} from "./session-card"
import type { AgendaDragMachine } from "./use-drag-machine"
import { useAgendaActions } from "./use-agenda-actions"

export interface GridBlockProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  conflicts: Array<AgendaConflict>
  conflicted: boolean
  dayKeys: Array<string>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  pixelsPerMinute: number
  /** Shingle depth: 0 = front of the stack, 1+ = offset right and above. */
  depth?: number
  machine: AgendaDragMachine
  draggedRef: React.RefObject<boolean>
  focused?: boolean
  /** Just landed here — pop in rather than blink in. */
  justPlaced?: boolean
  /** Week's half-zoom blocks are too short to grab an edge on. */
  resizable?: boolean
  keyboardHintId: string
  /** Extra contents under the title, e.g. the Track view's room name. */
  roomNameInBody?: boolean
}

export function GridBlock({
  session,
  rooms,
  conflicts,
  conflicted,
  dayKeys,
  timeZone,
  windowStartMinutes,
  windowEndMinutes,
  pixelsPerMinute,
  depth = 0,
  machine,
  draggedRef,
  focused = false,
  justPlaced = false,
  resizable = true,
  keyboardHintId,
  roomNameInBody = false,
}: GridBlockProps) {
  const { place } = useAgendaActions()
  const reduced = useReducedMotion()
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

  const grabbed = machine.isGrabbed(session.id)
  const startMinutes = minutesIntoDay(session.startsAt, timeZone)
  const duration = draftDuration ?? session.durationMinutes
  const top = (startMinutes - windowStartMinutes) * pixelsPerMinute
  const height = Math.max(duration * pixelsPerMinute, 22)
  const maxDuration = Math.max(SLOT_MINUTES, windowEndMinutes - startMinutes)
  const roomName = rooms.find((room) => room._id === session.roomId)?.name

  React.useEffect(() => {
    if (focused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [focused])

  // ——— Resize ————————————————————————————————————————————————————————————

  function durationFromPointer(clientY: number): number {
    const state = resizeRef.current
    if (!state) return session.durationMinutes
    const deltaMinutes = (clientY - state.startY) / pixelsPerMinute
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
      startY: event.clientY,
      startDuration: session.durationMinutes,
    }
    setDraftDuration(session.durationMinutes)
  }

  function moveResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return
    setDraftDuration(durationFromPointer(event.clientY))
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
    const state = resizeRef.current
    if (!state) return
    resizeRef.current = null
    const next = durationFromPointer(event.clientY)
    setDraftDuration(null)
    commitDuration(next)
  }

  // ——— Motion ————————————————————————————————————————————————————————————

  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 700, damping: 42, mass: 0.7 }

  const left = 4 + depth * SHINGLE_STEP

  return (
    <motion.div
      ref={cardRef}
      data-slot="agenda-grid-block"
      data-session-title={session.title}
      className="absolute"
      style={{ zIndex: 10 + depth }}
      initial={
        justPlaced && !reduced
          ? { opacity: 0, scale: 0.94, top, height, left, right: 4 }
          : false
      }
      animate={{ opacity: 1, scale: 1, top, height, left, right: 4 }}
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
              "relative flex h-full w-full cursor-grab touch-none items-start overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-xs transition-shadow",
              "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              conflicted && "ring-2 ring-destructive/60",
              isDragging && "opacity-35",
              grabbed &&
                "ring-3 ring-primary shadow-lg ring-offset-1 ring-offset-background",
              focused && !conflicted && "ring-2 ring-primary/70"
            )}
            style={sessionBlockStyle(session, { conflicted })}
            onKeyDown={(event: React.KeyboardEvent) => {
              // Shift+arrows resize without ever leaving the keyboard.
              if (event.shiftKey && !grabbed) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault()
                  commitDuration(
                    clamp(
                      session.durationMinutes +
                        (event.key === "ArrowDown" ? SLOT_MINUTES : -SLOT_MINUTES),
                      SLOT_MINUTES,
                      maxDuration
                    )
                  )
                  return
                }
              }
              machine.onCardKeyDown(session)(event)
            }}
            {...listeners}
            {...attributes}
            aria-describedby={keyboardHintId}
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
              roomName={roomNameInBody ? roomName : undefined}
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
      </div>

      {resizable ? (
        <div
          role="presentation"
          title="Drag to change the session length"
          onPointerDown={beginResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className="absolute inset-x-2 -bottom-0.5 z-20 h-2 cursor-ns-resize touch-none rounded-full opacity-0 transition-opacity hover:bg-primary/40 hover:opacity-100"
        />
      ) : null}

      {draftDuration !== null ? (
        <span
          data-slot="agenda-resize-chip"
          className="pointer-events-none absolute -bottom-6 left-0 z-50 rounded-lg bg-foreground px-2 py-1 text-[11px] font-semibold text-background tabular-nums shadow-lg"
        >
          {formatDuration(draftDuration)}
        </span>
      ) : null}
    </motion.div>
  )
}

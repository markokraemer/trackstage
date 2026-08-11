/**
 * One drag machine for the whole agenda.
 *
 * Day, Week, Track and Rooms are the same interaction wearing four different
 * column mappings, so the *feel* is defined exactly once here and the views only
 * describe their geometry:
 *
 *   Day    columns = rooms   (a drop assigns the room)
 *   Track  columns = tracks  (a drop re-files the session's track)
 *   Week   columns = days    (a drop moves the day, keeps the room)
 *   Rooms  lanes   = rooms, laid out horizontally (time runs left → right)
 *
 * What it owns:
 *
 * - **The live drop preview.** While a drag is in flight the machine resolves
 *   the pointer to an exact snapped placement — column, 15-minute start, real
 *   duration — which the views render as a ghost block. The card under the
 *   pointer shows *what you're moving*; the ghost shows *where it lands*.
 * - **The conflict pre-warning.** Every target is checked against the whole
 *   board (`warningsForPlacement`) before the drop, so the ghost can turn red
 *   and say why. It never blocks: convex/agenda.ts flags conflicts, it doesn't
 *   forbid them, and the organizer stays in control.
 * - **Keyboard drag-and-drop.** Enter/Space grabs, arrows move by one slot or
 *   one column, Enter drops, Escape cancels — driving the identical preview,
 *   chip and warnings, and narrating each step into an aria-live region. That
 *   is both the accessible path and a deterministic path for a browser agent.
 */

import * as React from "react"
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core"

import type {
  AgendaRoom,
  AgendaSession,
  PlacementWarning,
} from "./agenda-model"
import { isScheduled, warningsForPlacement } from "./agenda-model"
import {
  SLOT_MINUTES,
  clamp,
  dayKeyOf,
  formatMinutes,
  minutesIntoDay,
  snapMinutes,
  timeAt,
} from "./agenda-time"

const COLUMN_ID_PREFIX = "agenda-column:"

export function columnDroppableId(key: string): string {
  return `${COLUMN_ID_PREFIX}${key}`
}

function columnKeyFromDroppableId(id: string): string | null {
  return id.startsWith(COLUMN_ID_PREFIX)
    ? id.slice(COLUMN_ID_PREFIX.length)
    : null
}

/** One column (or, in the Rooms view, one horizontal lane) of a grid. */
export interface AgendaColumn {
  /** Unique within the view; also the droppable id. */
  key: string
  /** Organizer-facing name — this is what the drag chip reads out. */
  name: string
  /** The event-local day a drop into this column lands on. */
  dayKey: string
  /** Room a drop assigns. Omitted → the session keeps the room it has. */
  roomId?: string
  /** Track a drop re-files the session into (Track view only). */
  trackId?: string | null
  color?: string
}

export interface DragPlacement {
  session: AgendaSession
  column: AgendaColumn
  /** Minutes past event-local midnight, snapped to the 15-minute grid. */
  minutes: number
  durationMinutes: number
  startsAt: number
  roomId?: string
  trackId?: string | null
  warnings: Array<PlacementWarning>
  /** Set when the placement can't be written — never because of a conflict. */
  blockedReason?: string
}

export interface DragMachineOptions {
  columns: Array<AgendaColumn>
  /** Everything draggable in this view — grid cards plus the tray. */
  sessions: Array<AgendaSession>
  /** The whole board's scheduled sessions — the conflict pre-warning pool. */
  boardSessions: Array<AgendaSession>
  rooms: Array<AgendaRoom>
  timeZone: string
  windowStartMinutes: number
  windowEndMinutes: number
  pixelsPerMinute: number
  /** Rooms view runs the time axis horizontally. */
  orientation?: "vertical" | "horizontal"
  /** Which column a session currently sits in — the view's whole difference. */
  columnOf: (session: AgendaSession) => string | undefined
  onCommit: (placement: DragPlacement) => void
}

interface DragState {
  sessionId: string
  source: "pointer" | "keyboard"
  columnKey: string
  minutes: number
}

export interface AgendaDragMachine {
  activeSession: AgendaSession | null
  activeId: string | null
  source: "pointer" | "keyboard" | null
  isKeyboard: boolean
  placement: DragPlacement | null
  /** The ghost for one column — null unless the drop would land there. */
  ghostFor: (columnKey: string) => DragPlacement | null
  announcement: string
  /** Wire onto DndContext. */
  dndHandlers: {
    onDragStart: (event: DragStartEvent) => void
    onDragMove: (event: DragMoveEvent) => void
    onDragEnd: (event: DragEndEvent) => void
    onDragCancel: () => void
  }
  /** Wire onto every draggable card; starts and drives a keyboard move. */
  onCardKeyDown: (session: AgendaSession) => (event: React.KeyboardEvent) => void
  /** True while this session is the one being moved by keyboard. */
  isGrabbed: (sessionId: string) => boolean
  cancel: () => void
}

/** Auto-scroll tuned for a tall time grid: gentle, wide, on both axes. */
export const AGENDA_AUTO_SCROLL = {
  threshold: { x: 0.18, y: 0.2 },
  acceleration: 16,
  interval: 5,
} as const

export function useDragMachine(
  options: DragMachineOptions
): AgendaDragMachine {
  const {
    columns,
    sessions,
    boardSessions,
    rooms,
    timeZone,
    windowStartMinutes,
    windowEndMinutes,
    pixelsPerMinute,
    orientation = "vertical",
    columnOf,
    onCommit,
  } = options

  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [announcement, setAnnouncement] = React.useState("")

  // Handlers read the freshest inputs without re-subscribing every render.
  const latest = React.useRef(options)
  latest.current = options

  const activeSession =
    sessions.find((session) => session.id === drag?.sessionId) ?? null

  const clampMinutes = React.useCallback(
    (minutes: number, durationMinutes: number) =>
      clamp(
        snapMinutes(minutes),
        windowStartMinutes,
        Math.max(windowStartMinutes, windowEndMinutes - durationMinutes)
      ),
    [windowStartMinutes, windowEndMinutes]
  )

  /** Resolve a (column, minutes) pair into everything a drop needs to know. */
  const resolve = React.useCallback(
    (state: DragState | null): DragPlacement | null => {
      if (!state) return null
      const session = latest.current.sessions.find(
        (candidate) => candidate.id === state.sessionId
      )
      const column = latest.current.columns.find(
        (candidate) => candidate.key === state.columnKey
      )
      if (!session || !column) return null

      const durationMinutes = session.durationMinutes
      const minutes = clampMinutes(state.minutes, durationMinutes)
      const startsAt = timeAt(column.dayKey, minutes, timeZone)
      const roomId = column.roomId ?? session.roomId
      const trackId = column.trackId

      return {
        session,
        column,
        minutes,
        durationMinutes,
        startsAt,
        roomId,
        trackId,
        warnings: roomId
          ? warningsForPlacement(
              {
                sessionId: session.id,
                roomId,
                startsAt,
                durationMinutes,
                speakers: session.speakers,
              },
              latest.current.boardSessions,
              latest.current.rooms
            )
          : [],
        blockedReason: roomId
          ? undefined
          : "Give this session a room before placing it here",
      }
    },
    [clampMinutes, timeZone]
  )

  const placement = React.useMemo(() => resolve(drag), [drag, resolve])

  /** Where a session sits right now, in this view's coordinates. */
  const locate = React.useCallback(
    (session: AgendaSession): { columnKey: string; minutes: number } | null => {
      const columnKey =
        columnOf(session) ?? latest.current.columns[0]?.key ?? null
      if (!columnKey) return null
      const minutes = isScheduled(session)
        ? minutesIntoDay(session.startsAt, timeZone)
        : windowStartMinutes
      return { columnKey, minutes }
    },
    [columnOf, timeZone, windowStartMinutes]
  )

  const describe = React.useCallback(
    (next: DragPlacement | null): string => {
      if (!next) return ""
      const range = `${formatMinutes(next.minutes)} – ${formatMinutes(next.minutes + next.durationMinutes)}`
      const reason =
        next.blockedReason ??
        (next.warnings.length > 0 ? next.warnings[0].label : "No conflicts")
      return `${range}, ${next.column.name}. ${reason}.`
    },
    []
  )

  // ——— Pointer ————————————————————————————————————————————————————————————

  const minutesFromRects = React.useCallback(
    (
      activeRect: { top: number; left: number } | null | undefined,
      overRect: { top: number; left: number } | null | undefined
    ): number | null => {
      if (!activeRect || !overRect) return null
      const offsetPx =
        orientation === "vertical"
          ? activeRect.top - overRect.top
          : activeRect.left - overRect.left
      return offsetPx / pixelsPerMinute + windowStartMinutes
    },
    [orientation, pixelsPerMinute, windowStartMinutes]
  )

  const targetFromEvent = React.useCallback(
    (event: DragMoveEvent | DragEndEvent): DragState | null => {
      const columnKey = columnKeyFromDroppableId(String(event.over?.id ?? ""))
      if (!columnKey) return null
      const minutes = minutesFromRects(
        event.active.rect.current.translated,
        event.over?.rect
      )
      if (minutes === null) return null
      return {
        sessionId: String(event.active.id),
        source: "pointer",
        columnKey,
        minutes,
      }
    },
    [minutesFromRects]
  )

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const session = latest.current.sessions.find(
        (candidate) => candidate.id === String(event.active.id)
      )
      if (!session) return
      const here = locate(session)
      setDrag(
        here
          ? {
              sessionId: session.id,
              source: "pointer",
              columnKey: here.columnKey,
              minutes: here.minutes,
            }
          : null
      )
    },
    [locate]
  )

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const next = targetFromEvent(event)
      // Off the grid entirely (over the tray, say) → no ghost, honestly.
      setDrag(next)
    },
    [targetFromEvent]
  )

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const next = resolve(targetFromEvent(event))
      setDrag(null)
      if (!next) return
      latest.current.onCommit(next)
    },
    [resolve, targetFromEvent]
  )

  const onDragCancel = React.useCallback(() => setDrag(null), [])

  // ——— Keyboard ———————————————————————————————————————————————————————————

  const nudge = React.useCallback(
    (columnStep: number, slotStep: number) => {
      setDrag((current) => {
        if (!current) return current
        const list = latest.current.columns
        const index = list.findIndex((column) => column.key === current.columnKey)
        const nextIndex = clamp(index + columnStep, 0, list.length - 1)
        return {
          ...current,
          columnKey: list[nextIndex]?.key ?? current.columnKey,
          minutes: current.minutes + slotStep * SLOT_MINUTES,
        }
      })
    },
    []
  )

  const commitKeyboard = React.useCallback(() => {
    setDrag((current) => {
      const next = resolve(current)
      if (next) {
        latest.current.onCommit(next)
        setAnnouncement(
          `Dropped ${next.session.title} at ${formatMinutes(next.minutes)}, ${next.column.name}.`
        )
      }
      return null
    })
  }, [resolve])

  const cancel = React.useCallback(() => {
    setDrag((current) => {
      if (current) setAnnouncement("Move cancelled. The session stayed put.")
      return null
    })
  }, [])

  const grab = React.useCallback(
    (session: AgendaSession) => {
      const here = locate(session)
      if (!here) return
      setDrag({
        sessionId: session.id,
        source: "keyboard",
        columnKey: here.columnKey,
        minutes: here.minutes,
      })
      setAnnouncement(
        `Picked up ${session.title}. Use the arrow keys to move it, Enter to drop, Escape to cancel.`
      )
    },
    [locate]
  )

  const onCardKeyDown = React.useCallback(
    (session: AgendaSession) => (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return
      // Only the pick-up gesture; once grabbed the window listener takes over.
      if (drag) return
      event.preventDefault()
      event.stopPropagation()
      grab(session)
    },
    [drag, grab]
  )

  const grabbedByKeyboard = drag?.source === "keyboard"

  React.useEffect(() => {
    if (!grabbedByKeyboard) return
    function onKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          nudge(0, -1)
          break
        case "ArrowDown":
          event.preventDefault()
          nudge(0, 1)
          break
        case "ArrowLeft":
          event.preventDefault()
          nudge(-1, 0)
          break
        case "ArrowRight":
          event.preventDefault()
          nudge(1, 0)
          break
        case "PageUp":
          event.preventDefault()
          nudge(0, -4)
          break
        case "PageDown":
          event.preventDefault()
          nudge(0, 4)
          break
        case "Enter":
        case " ":
          event.preventDefault()
          commitKeyboard()
          break
        case "Escape":
          event.preventDefault()
          cancel()
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [grabbedByKeyboard, nudge, commitKeyboard, cancel])

  // Narrate every keyboard move — the aria-live region reads this out, and a
  // browser agent can assert on it.
  const keyboardDescription = grabbedByKeyboard ? describe(placement) : ""
  React.useEffect(() => {
    if (keyboardDescription) setAnnouncement(keyboardDescription)
  }, [keyboardDescription])

  const ghostFor = React.useCallback(
    (columnKey: string) =>
      placement && placement.column.key === columnKey ? placement : null,
    [placement]
  )

  const isGrabbed = React.useCallback(
    (sessionId: string) =>
      drag?.source === "keyboard" && drag.sessionId === sessionId,
    [drag]
  )

  return {
    activeSession,
    activeId: drag?.sessionId ?? null,
    source: drag?.source ?? null,
    isKeyboard: grabbedByKeyboard,
    placement,
    ghostFor,
    announcement,
    dndHandlers: { onDragStart, onDragMove, onDragEnd, onDragCancel },
    onCardKeyDown,
    isGrabbed,
    cancel,
  }
}

/** "10:15 AM – 11:00 AM" — the chip's headline, in event-local time. */
export function placementRangeLabel(placement: DragPlacement): string {
  return `${formatMinutes(placement.minutes)} – ${formatMinutes(placement.minutes + placement.durationMinutes)}`
}

/** Which column a session sits in, by room — Day and Rooms views. */
export function columnByRoom(session: AgendaSession): string | undefined {
  return session.roomId
}

/** Which column a session sits in, by day — Week view. */
export function columnByDay(
  session: AgendaSession,
  timeZone: string
): string | undefined {
  return isScheduled(session) ? dayKeyOf(session.startsAt, timeZone) : undefined
}

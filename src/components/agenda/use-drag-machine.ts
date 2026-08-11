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
 *
 * The one structural decision worth stating out loud: **what you are holding
 * and where it would land are two different pieces of state**. The grab lives
 * for the whole gesture; the target is null whenever the pointer is off the
 * grid. Collapsing them into one — which is the obvious first draft — makes the
 * card in your hand, the dimmed original and the 15-minute rules all blink out
 * the instant you cross the tray, which reads as "the drag broke" even though
 * it hasn't. Keeping them apart is what makes the gesture feel continuous.
 */

import * as React from "react"
import { TraversalOrder } from "@dnd-kit/core"
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

/**
 * What is in the organizer's hand. Lives for the whole gesture — deliberately
 * separate from the target, so a pointer excursion off the grid never looks
 * like the drag ended.
 */
interface GrabState {
  sessionId: string
  source: "pointer" | "keyboard"
}

/** Where it would land right now. Null while the pointer is off the grid. */
interface TargetState {
  columnKey: string
  minutes: number
}

export interface AgendaDragMachine {
  activeSession: AgendaSession | null
  activeId: string | null
  source: "pointer" | "keyboard" | null
  isKeyboard: boolean
  placement: DragPlacement | null
  /**
   * Something is in the air, but the pointer is nowhere droppable. The card
   * still follows the cursor and the original stays dimmed; the ghost is
   * honestly absent and the chip says to come back to the grid.
   */
  isOffGrid: boolean
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

/**
 * Auto-scroll tuned for a tall time grid: gentle, wide, on both axes.
 *
 * `ReversedTreeOrder` is the load-bearing part. dnd-kit's default walks the
 * scroll ancestors outermost-first, so carrying a session to the bottom of the
 * screen scrolls the *page* — the toolbar slides away and the grid stays put.
 * Reversed makes the time grid itself scroll first, which is what every
 * calendar does and what an organizer reaching for 6 PM expects.
 */
export const AGENDA_AUTO_SCROLL = {
  threshold: { x: 0.18, y: 0.2 },
  acceleration: 16,
  interval: 5,
  order: TraversalOrder.ReversedTreeOrder,
} as const

export function useDragMachine(
  options: DragMachineOptions
): AgendaDragMachine {
  const {
    columns,
    sessions,
    boardSessions,
    timeZone,
    windowStartMinutes,
    windowEndMinutes,
    pixelsPerMinute,
    orientation = "vertical",
    columnOf,
  } = options

  const [held, setHeld] = React.useState<GrabState | null>(null)
  const [target, setTarget] = React.useState<TargetState | null>(null)
  const [announcement, setAnnouncement] = React.useState("")

  // Handlers read the freshest inputs without re-subscribing every render.
  const latest = React.useRef(options)
  latest.current = options

  const activeSession =
    sessions.find((session) => session.id === held?.sessionId) ?? null

  const clampMinutes = React.useCallback(
    (minutes: number, durationMinutes: number) =>
      clamp(
        snapMinutes(minutes),
        windowStartMinutes,
        Math.max(windowStartMinutes, windowEndMinutes - durationMinutes)
      ),
    [windowStartMinutes, windowEndMinutes]
  )

  /** Resolve a (session, column, minutes) triple into what a drop needs. */
  const resolve = React.useCallback(
    (
      grab: GrabState | null,
      state: TargetState | null
    ): DragPlacement | null => {
      if (!grab || !state) return null
      const session = latest.current.sessions.find(
        (candidate) => candidate.id === grab.sessionId
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

  // `columns` and `boardSessions` are read through the ref, but they belong in
  // the deps: an optimistic board update mid-drag must move the ghost and
  // re-check the warnings on the very next render.
  const placement = React.useMemo(
    () => resolve(held, target),
    [held, target, resolve, columns, boardSessions]
  )

  /** Where a session sits right now, in this view's coordinates. */
  const locate = React.useCallback(
    (session: AgendaSession): TargetState | null => {
      const list = latest.current.columns
      // A tray session belongs to no column yet — start it in the first one.
      const columnKey =
        columnOf(session) ?? (list.length > 0 ? list[0].key : undefined)
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
    (event: DragMoveEvent | DragEndEvent): TargetState | null => {
      const columnKey = columnKeyFromDroppableId(String(event.over?.id ?? ""))
      if (!columnKey) return null
      const minutes = minutesFromRects(
        event.active.rect.current.translated,
        event.over?.rect
      )
      if (minutes === null) return null
      return { columnKey, minutes }
    },
    [minutesFromRects]
  )

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const session = latest.current.sessions.find(
        (candidate) => candidate.id === String(event.active.id)
      )
      if (!session) return
      setHeld({ sessionId: session.id, source: "pointer" })
      setTarget(locate(session))
    },
    [locate]
  )

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      // Off the grid entirely (over the tray, say) → no ghost, honestly. The
      // grab itself survives, so the card stays in your hand.
      setTarget(targetFromEvent(event))
    },
    [targetFromEvent]
  )

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const next = resolve(
        { sessionId: String(event.active.id), source: "pointer" },
        targetFromEvent(event)
      )
      setHeld(null)
      setTarget(null)
      if (!next) return
      latest.current.onCommit(next)
    },
    [resolve, targetFromEvent]
  )

  const onDragCancel = React.useCallback(() => {
    setHeld(null)
    setTarget(null)
  }, [])

  // ——— Keyboard ———————————————————————————————————————————————————————————

  // Read inside the state updaters below, which must stay free of stale
  // closures without re-creating the window key listener on every move.
  const heldRef = React.useRef<GrabState | null>(null)
  heldRef.current = held
  const targetRef = React.useRef<TargetState | null>(null)
  targetRef.current = target

  /**
   * Move the target by whole columns and whole 15-minute slots.
   *
   * The clamp happens *here*, not only when the placement is resolved: let the
   * stored minutes run past the end of the day and the next few ArrowUps go
   * nowhere while the number unwinds, which feels like the keys stopped
   * working. Clamping the state keeps every press worth exactly one slot.
   */
  const nudge = React.useCallback(
    (columnStep: number, slotStep: number) => {
      setTarget((current) => {
        if (!current) return current
        const list = latest.current.columns
        const index = list.findIndex((column) => column.key === current.columnKey)
        const nextIndex = clamp(index + columnStep, 0, list.length - 1)
        const duration =
          latest.current.sessions.find(
            (session) => session.id === heldRef.current?.sessionId
          )?.durationMinutes ?? SLOT_MINUTES
        return {
          columnKey: list[nextIndex]?.key ?? current.columnKey,
          minutes: clampMinutes(
            current.minutes + slotStep * SLOT_MINUTES,
            duration
          ),
        }
      })
    },
    [clampMinutes]
  )

  const commitKeyboard = React.useCallback(() => {
    const next = resolve(heldRef.current, targetRef.current)
    setHeld(null)
    setTarget(null)
    if (!next) return
    latest.current.onCommit(next)
    setAnnouncement(
      `Dropped ${next.session.title} at ${formatMinutes(next.minutes)}, ${next.column.name}.`
    )
  }, [resolve])

  const cancel = React.useCallback(() => {
    if (heldRef.current) {
      setAnnouncement("Move cancelled. The session stayed put.")
    }
    setHeld(null)
    setTarget(null)
  }, [])

  const grab = React.useCallback(
    (session: AgendaSession) => {
      const here = locate(session)
      if (!here) return
      setHeld({ sessionId: session.id, source: "keyboard" })
      setTarget(here)
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
      if (held) return
      event.preventDefault()
      event.stopPropagation()
      grab(session)
    },
    [held, grab]
  )

  const grabbedByKeyboard = held?.source === "keyboard"

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
      held?.source === "keyboard" && held.sessionId === sessionId,
    [held]
  )

  return {
    activeSession,
    activeId: held?.sessionId ?? null,
    source: held?.source ?? null,
    isKeyboard: Boolean(grabbedByKeyboard),
    placement,
    isOffGrid: held !== null && placement === null,
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

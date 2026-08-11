/**
 * Shared shapes + derivations for the agenda builder.
 *
 * Everything the four views need is derived from the single reactive
 * `api.agenda.board` query, so a scheduling change in any view updates the
 * grid, the tray, the conflict badge, and the conflicts list at the same time
 * (docs/SPEC.md §4.6 — "conflict appears in <1s").
 */

import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"
import { dayKeyOf, minutesIntoDay } from "./agenda-time"

export type AgendaBoard = FunctionReturnType<typeof api.agenda.board>
export type AgendaSession = AgendaBoard["scheduled"][number]
export type AgendaRoom = AgendaBoard["rooms"][number]
export type AgendaTrack = AgendaBoard["tracks"][number]
export type AgendaConflict = AgendaBoard["conflicts"][number]

/** A session that actually sits on the grid. */
export type ScheduledSession = AgendaSession & { startsAt: number }

export const DEFAULT_DURATION_MINUTES = 45

/** Track colour, with a neutral fallback for sessions with no track. */
export const NO_TRACK_COLOR = "#94A3B8"

export function isScheduled(
  session: AgendaSession
): session is ScheduledSession {
  return typeof session.startsAt === "number"
}

export function sessionEnd(session: ScheduledSession): number {
  return session.startsAt + session.durationMinutes * 60_000
}

/** Free-text filter over title, speakers, and track — used by every view. */
export function matchesSearch(session: AgendaSession, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true
  const haystack = [
    session.title,
    session.track?.name ?? "",
    ...session.speakers,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(term)
}

/** Ids of every session involved in at least one conflict. */
export function conflictedSessionIds(
  conflicts: Array<AgendaConflict>
): Set<string> {
  const ids = new Set<string>()
  for (const conflict of conflicts) {
    ids.add(conflict.a.id)
    ids.add(conflict.b.id)
  }
  return ids
}

/** Plain-English reasons a given session is flagged. */
export function conflictsForSession(
  conflicts: Array<AgendaConflict>,
  sessionId: string
): Array<AgendaConflict> {
  return conflicts.filter(
    (conflict) => conflict.a.id === sessionId || conflict.b.id === sessionId
  )
}

/** Sessions on one event-local day, earliest first. */
export function sessionsOnDay(
  sessions: Array<ScheduledSession>,
  dayKey: string,
  timeZone: string
): Array<ScheduledSession> {
  return sessions
    .filter((session) => dayKeyOf(session.startsAt, timeZone) === dayKey)
    .sort((a, b) => a.startsAt - b.startsAt)
}

/**
 * The visible time window for a day: the default 08:00–20:00 window, widened
 * so a session placed outside it can never become invisible.
 */
export function windowForDay(
  sessions: Array<ScheduledSession>,
  timeZone: string,
  defaultStartHour: number,
  defaultEndHour: number
): { startMinutes: number; endMinutes: number } {
  let startMinutes = defaultStartHour * 60
  let endMinutes = defaultEndHour * 60
  for (const session of sessions) {
    const start = minutesIntoDay(session.startsAt, timeZone)
    startMinutes = Math.min(startMinutes, Math.floor(start / 60) * 60)
    endMinutes = Math.max(
      endMinutes,
      Math.ceil((start + session.durationMinutes) / 60) * 60
    )
  }
  return {
    startMinutes: Math.max(0, startMinutes),
    endMinutes: Math.min(24 * 60, Math.max(endMinutes, startMinutes + 60)),
  }
}

/** Start-time options for the pickers: every 15 minutes across the window. */
export function timeOptions(
  startMinutes: number,
  endMinutes: number
): Array<number> {
  const options: Array<number> = []
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 15) {
    options.push(minutes)
  }
  return options
}

/** Durations organizers actually use. */
export const DURATION_OPTIONS = [
  15, 20, 30, 45, 60, 75, 90, 120, 180, 240,
] as const

export function speakerLabel(speakers: Array<string>): string {
  if (speakers.length === 0) return "No speaker yet"
  if (speakers.length <= 2) return speakers.join(", ")
  return `${speakers[0]}, ${speakers[1]} +${speakers.length - 2}`
}

/** Human name for a conflict kind, used in the badge and the list. */
export function conflictKindLabel(kind: string): string {
  return kind === "room" ? "Room double-booked" : "Speaker double-booked"
}

// ——— Client-side conflict math ————————————————————————————————————————————
// `convex/agenda.ts` computes the authoritative conflicts, but two things need
// the same answer *before* the server has one: the drag preview (warn while the
// ghost is still hovering) and the optimistic update (the badge must move with
// the card, rule 26). Both call the helpers below, so the pre-warning, the
// optimistic board and the server's own result always phrase things identically
// — the labels here are byte-for-byte the ones `computeConflicts` returns.
//
// The one deliberate difference: the server matches speakers by person id, we
// only have their display names. For a warning shown mid-drag and an optimistic
// state that the server overwrites ~100ms later, matching on name is exact
// enough — and a duplicate name is itself worth flagging to an organizer.

/** Do two [start, start+duration) intervals intersect? */
export function overlapsRange(
  aStart: number,
  aMinutes: number,
  bStart: number,
  bMinutes: number
): boolean {
  return aStart < bStart + bMinutes * 60_000 && bStart < aStart + aMinutes * 60_000
}

function sessionsOverlap(a: ScheduledSession, b: ScheduledSession): boolean {
  return overlapsRange(
    a.startsAt,
    a.durationMinutes,
    b.startsAt,
    b.durationMinutes
  )
}

/**
 * The whole board's conflicts, recomputed on the client.
 *
 * Mirrors `computeConflicts` in convex/agenda.ts — room double-bookings first,
 * then speaker double-bookings — so an optimistic board and the server's board
 * render the same list in the same order and nothing flickers on reconcile.
 */
export function computeBoardConflicts(
  sessions: Array<AgendaSession>,
  rooms: Array<AgendaRoom>
): Array<AgendaConflict> {
  const scheduled = sessions.filter(isScheduled)
  const conflicts: Array<AgendaConflict> = []
  const roomName = (roomId: string | undefined) =>
    rooms.find((room) => room._id === roomId)?.name

  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i]
      const b = scheduled[j]
      if (!sessionsOverlap(a, b)) continue
      if (a.roomId && a.roomId === b.roomId) {
        conflicts.push({
          kind: "room",
          label: `Both booked in ${roomName(a.roomId) ?? "the same room"} at the same time`,
          a: { id: a.id, title: a.title },
          b: { id: b.id, title: b.title },
        })
      }
    }
  }

  const bySpeaker = new Map<string, Array<ScheduledSession>>()
  for (const session of scheduled) {
    for (const speaker of session.speakers) {
      const list = bySpeaker.get(speaker) ?? []
      list.push(session)
      bySpeaker.set(speaker, list)
    }
  }
  for (const [speaker, list] of bySpeaker) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!sessionsOverlap(list[i], list[j])) continue
        conflicts.push({
          kind: "speaker",
          label: `${speaker} is booked in two overlapping sessions`,
          a: { id: list[i].id, title: list[i].title },
          b: { id: list[j].id, title: list[j].title },
        })
      }
    }
  }
  return conflicts
}

/** A placement being considered — the ghost's coordinates, in board terms. */
export interface ProspectivePlacement {
  sessionId: string
  roomId?: string
  startsAt: number
  durationMinutes: number
  speakers: Array<string>
}

export interface PlacementWarning {
  kind: "room" | "speaker"
  /** Short, chip-sized: "Overlaps Opening Keynote". */
  label: string
}

/**
 * What would go wrong if the dragged session landed here — the text on the
 * drag chip. Never blocks the drop (convex/agenda.ts §schedule: "scheduling is
 * never blocked, only flagged"); the organizer stays in control.
 */
export function warningsForPlacement(
  placement: ProspectivePlacement,
  sessions: Array<AgendaSession>,
  rooms: Array<AgendaRoom>
): Array<PlacementWarning> {
  const warnings: Array<PlacementWarning> = []
  const roomName = rooms.find((room) => room._id === placement.roomId)?.name
  for (const other of sessions) {
    if (other.id === placement.sessionId) continue
    if (!isScheduled(other)) continue
    if (
      !overlapsRange(
        placement.startsAt,
        placement.durationMinutes,
        other.startsAt,
        other.durationMinutes
      )
    ) {
      continue
    }
    if (placement.roomId && other.roomId === placement.roomId) {
      warnings.push({
        kind: "room",
        label: `Overlaps ${other.title}${roomName ? ` in ${roomName}` : ""}`,
      })
    }
    const shared = other.speakers.find((speaker) =>
      placement.speakers.includes(speaker)
    )
    if (shared) {
      warnings.push({
        kind: "speaker",
        label: `${shared} is speaking in ${other.title}`,
      })
    }
  }
  return warnings
}

// ——— Shingled overlaps (docs/reference/design-references.md §4) ——————————————
// Notion Calendar cascades overlapping blocks instead of splitting the column
// into equal halves: the first block keeps almost the full width, the next one
// is narrower and offset right, stacked on top. A genuine double-booking then
// looks like an anomaly piling onto a legitimate session rather than like two
// equal peers — which is exactly the reading an organizer needs.

/** Pixels each shingled block is pushed right of the one it covers. */
export const SHINGLE_STEP = 14
/** Past this depth the offset stops growing — the stub is already visible. */
const MAX_SHINGLE_DEPTH = 4

export interface ShingledSession {
  session: ScheduledSession
  /** 0 = front of the column, 1+ = offset right and stacked above. */
  depth: number
}

export function shingle(
  sessions: Array<ScheduledSession>
): Array<ShingledSession> {
  const ordered = [...sessions].sort(
    (a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id)
  )
  const placed: Array<ShingledSession> = []
  for (const session of ordered) {
    const overlapping = placed.filter((other) =>
      sessionsOverlap(other.session, session)
    )
    const taken = new Set(overlapping.map((other) => other.depth))
    let depth = 0
    while (taken.has(depth)) depth += 1
    placed.push({ session, depth: Math.min(depth, MAX_SHINGLE_DEPTH) })
  }
  return placed
}

// ——— The Notion block recipe (docs/reference/design-references.md §4a) ————————
// Not a filled colour box: a very pale tint of the track hue, a solid 4px
// saturated bar down the left edge, and — the part that makes a dense grid read
// as calm — the *title text* in the hue rather than in black. Active/dragging
// inverts it to a solid saturated fill with white text.

export interface TrackTint {
  /** Pale surface, ~9% of the track hue over white. */
  surface: string
  /** Fully saturated left bar and, on drag, the whole fill. */
  bar: string
  /** Saturated title text, darkened enough to stay AA on the tint. */
  title: string
  /** Same hue, quieter — the time/speaker lines. */
  meta: string
}

export function trackTint(color: string | null | undefined): TrackTint {
  const hue = color ?? NO_TRACK_COLOR
  return {
    surface: `color-mix(in oklab, ${hue} 9%, #ffffff)`,
    bar: hue,
    title: `color-mix(in oklab, ${hue} 70%, #101014)`,
    meta: `color-mix(in oklab, ${hue} 42%, #52525b)`,
  }
}

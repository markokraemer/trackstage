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

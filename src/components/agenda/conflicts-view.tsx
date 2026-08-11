/**
 * Conflicts view — every clash in the schedule, in plain English, with a jump
 * back into the Day grid (docs/SPEC.md §4.6; sbek AIA-04 / AIA-05 / AIA-06).
 *
 * Conflicts are computed by the reactive `agenda.board` query, so creating an
 * overlap anywhere in the app lights this list up immediately — no refresh, no
 * "check for conflicts" button.
 */

import {
  RiArrowRightUpLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
} from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import type {
  AgendaConflict,
  AgendaRoom,
  ScheduledSession,
} from "./agenda-model"
import { conflictKindLabel, speakerLabel } from "./agenda-model"
import { dayKeyOf, formatDayLabel, formatTimeRange } from "./agenda-time"
import { useAgendaActions } from "./use-agenda-actions"

export interface ConflictsViewProps {
  conflicts: Array<AgendaConflict>
  scheduled: Array<ScheduledSession>
  rooms: Array<AgendaRoom>
  timeZone: string
  /** Switch to the Day view, on that session's day, highlighting it. */
  onShowInDay: (session: ScheduledSession) => void
}

export function ConflictsView({
  conflicts,
  scheduled,
  rooms,
  timeZone,
  onShowInDay,
}: ConflictsViewProps) {
  const byId = new Map(scheduled.map((session) => [session.id, session]))

  if (conflicts.length === 0) {
    return (
      <EmptyState
        icon={RiCheckboxCircleLine}
        title="No conflicts — your schedule is clean"
        description="We watch for two things: two sessions booked in the same room at the same time, and a speaker booked in two overlapping sessions. If either happens, it shows up here the moment it does."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {conflicts.length === 1
          ? "1 conflict needs your attention."
          : `${conflicts.length} conflicts need your attention.`}{" "}
        Move one of the two sessions to a different time or room to clear each
        one.
      </p>

      <ul className="flex flex-col gap-3">
        {conflicts.map((conflict, index) => (
          <li
            key={`${conflict.kind}-${conflict.a.id}-${conflict.b.id}-${index}`}
            className="overflow-hidden rounded-xl border border-destructive/30 bg-card shadow-xs"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-destructive/5 px-4 py-2.5">
              <RiErrorWarningLine
                size={16}
                aria-hidden
                className="text-destructive"
              />
              <Badge variant="destructive">
                {conflictKindLabel(conflict.kind)}
              </Badge>
              <p className="text-sm text-foreground">{conflict.label}</p>
            </div>

            <div className="grid gap-px bg-border sm:grid-cols-2">
              {[conflict.a, conflict.b].map((side) => {
                const session = byId.get(side.id)
                return (
                  <ConflictSide
                    key={side.id}
                    title={side.title}
                    session={session}
                    rooms={rooms}
                    timeZone={timeZone}
                    onShowInDay={onShowInDay}
                  />
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConflictSide({
  title,
  session,
  rooms,
  timeZone,
  onShowInDay,
}: {
  title: string
  session?: ScheduledSession
  rooms: Array<AgendaRoom>
  timeZone: string
  onShowInDay: (session: ScheduledSession) => void
}) {
  const { remove } = useAgendaActions()
  const room = rooms.find((candidate) => candidate._id === session?.roomId)

  return (
    <div className="flex flex-col gap-2 bg-card p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {session ? (
        <>
          <p className="text-xs text-muted-foreground">
            {formatDayLabel(dayKeyOf(session.startsAt, timeZone))} ·{" "}
            {formatTimeRange(
              session.startsAt,
              session.durationMinutes,
              timeZone
            )}
            {room ? ` · ${room.name}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {speakerLabel(session.speakers)}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowInDay(session)}
            >
              <RiArrowRightUpLine aria-hidden />
              Show in Day view
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void remove(session.id, session.title)}
            >
              Unschedule
            </Button>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          This session is no longer on the grid.
        </p>
      )}
    </div>
  )
}

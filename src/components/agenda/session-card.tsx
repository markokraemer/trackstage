/**
 * The session card and its detail popover — shared by the Day grid, the Rooms
 * swimlanes, and the Not scheduled tray so a session looks and behaves the
 * same wherever an organizer meets it.
 */

import { RiErrorWarningLine, RiTimeLine, RiUser3Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { StatusPill } from "@/components/shared/status-pill"
import type { AgendaConflict, AgendaRoom, AgendaSession } from "./agenda-model"
import { NO_TRACK_COLOR, conflictKindLabel, speakerLabel } from "./agenda-model"
import {
  formatDuration,
  formatTimeRange,
  formatDayLabel,
  dayKeyOf,
} from "./agenda-time"
import { ScheduleFields } from "./schedule-fields"
import { useAgendaActions } from "./use-agenda-actions"

export interface SessionCardBodyProps {
  session: AgendaSession
  timeZone: string
  roomName?: string
  /** Very short cards hide the secondary lines rather than overflow. */
  density?: "roomy" | "tight"
  showTime?: boolean
}

/** Card contents: track colour edge, title, time, room, speakers. */
export function SessionCardBody({
  session,
  timeZone,
  roomName,
  density = "roomy",
  showTime = true,
}: SessionCardBodyProps) {
  const color = session.track?.color ?? NO_TRACK_COLOR
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 rounded-l-[7px]"
        style={{ backgroundColor: color }}
      />
      <div className="flex min-w-0 flex-col gap-0.5 pl-2 text-left">
        <p
          className={cn(
            "font-medium text-foreground",
            density === "tight"
              ? "truncate text-[11px] leading-4"
              : "line-clamp-2 text-xs leading-4"
          )}
        >
          {session.title}
        </p>
        {showTime && typeof session.startsAt === "number" ? (
          <p className="truncate text-[11px] leading-4 text-muted-foreground">
            {formatTimeRange(
              session.startsAt,
              session.durationMinutes,
              timeZone
            )}
          </p>
        ) : null}
        {density === "roomy" ? (
          <>
            {roomName ? (
              <p className="truncate text-[11px] leading-4 text-muted-foreground">
                {roomName}
              </p>
            ) : null}
            <p className="truncate text-[11px] leading-4 text-muted-foreground">
              {speakerLabel(session.speakers)}
            </p>
          </>
        ) : null}
      </div>
    </>
  )
}

export interface SessionDetailContentProps {
  session: AgendaSession
  rooms: Array<AgendaRoom>
  dayKeys: Array<string>
  timeZone: string
  conflicts: Array<AgendaConflict>
  onDone?: () => void
}

/** Popover body for a scheduled session: what it is, what's wrong, how to fix. */
export function SessionDetailContent({
  session,
  rooms,
  dayKeys,
  timeZone,
  conflicts,
  onDone,
}: SessionDetailContentProps) {
  const { remove } = useAgendaActions()
  const room = rooms.find((candidate) => candidate._id === session.roomId)
  const scheduled = typeof session.startsAt === "number"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="font-heading text-sm leading-snug font-semibold text-foreground">
          {session.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {session.track ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
              data-slot="track-chip"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: session.track.color }}
              />
              {session.track.name}
            </span>
          ) : null}
          <StatusPill status="accepted" size="sm" />
        </div>
      </div>

      <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Time</dt>
          <RiTimeLine size={14} aria-hidden className="mt-0.5 shrink-0" />
          <dd>
            {scheduled
              ? `${formatDayLabel(dayKeyOf(session.startsAt as number, timeZone))} · ${formatTimeRange(session.startsAt as number, session.durationMinutes, timeZone)} (${formatDuration(session.durationMinutes)})`
              : "Not scheduled yet"}
          </dd>
        </div>
        <div className="flex items-start gap-1.5">
          <dt className="sr-only">Speakers</dt>
          <RiUser3Line size={14} aria-hidden className="mt-0.5 shrink-0" />
          <dd>
            {session.speakers.length > 0
              ? session.speakers.join(", ")
              : "No speaker listed"}
          </dd>
        </div>
      </dl>

      {conflicts.length > 0 ? (
        <Alert variant="destructive" className="py-2">
          <RiErrorWarningLine aria-hidden />
          <AlertTitle className="text-xs font-semibold">
            {conflicts.length === 1
              ? conflictKindLabel(conflicts[0].kind)
              : `${conflicts.length} scheduling conflicts`}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {conflicts.map((conflict, index) => (
              <span key={`${conflict.kind}-${index}`} className="block">
                {conflict.label}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      <ScheduleFields
        session={session}
        rooms={rooms}
        dayKeys={dayKeys}
        timeZone={timeZone}
        defaultDayKey={
          scheduled
            ? dayKeyOf(session.startsAt as number, timeZone)
            : (dayKeys[0] ?? "")
        }
        mode="instant"
      />

      {scheduled ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            void remove(session.id, session.title).then((ok) => {
              if (ok) onDone?.()
            })
          }}
        >
          Unschedule
          {room ? ` from ${room.name}` : ""}
        </Button>
      ) : null}
    </div>
  )
}

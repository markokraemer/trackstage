/**
 * The session card and its detail popover — shared by the Day grid, the Rooms
 * swimlanes, and the Not scheduled tray so a session looks and behaves the
 * same wherever an organizer meets it.
 */

import type * as React from "react"
import { RiErrorWarningLine, RiTimeLine, RiUser3Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { StatusPill } from "@/components/shared/status-pill"
import type { AgendaConflict, AgendaRoom, AgendaSession } from "./agenda-model"
import {
  NO_TRACK_COLOR,
  conflictKindLabel,
  speakerLabel,
  trackTint,
} from "./agenda-model"
import {
  formatDuration,
  formatTimeRange,
  formatDayLabel,
  dayKeyOf,
} from "./agenda-time"
import { ScheduleFields } from "./schedule-fields"
import { useAgendaActions } from "./use-agenda-actions"

/**
 * The Notion Calendar block recipe (docs/reference/design-references.md §4a).
 *
 * A session block is **not** a filled colour box: the surface is a ~9% tint of
 * the track hue, a solid 4px bar runs down the left edge, and the title is set
 * in the hue rather than in black. That is what lets a packed conference day
 * stay calm while every block is still colour-coded by track.
 *
 * Active/dragging inverts it — solid saturated fill, white text — so "quiet
 * tint = resting, solid fill = the one in your hand" reads without a legend.
 *
 * The colours travel to the contents as CSS custom properties so every view can
 * put `sessionBlockStyle()` on whatever element it already had and drop
 * `<SessionCardBody>` inside it unchanged.
 */
export interface SessionBlockState {
  /** Flagged by the conflict pass — border/ring handled by the caller. */
  conflicted?: boolean
  /** The card in your hand: solid fill, white text. */
  solid?: boolean
}

export function sessionBlockStyle(
  session: Pick<AgendaSession, "track">,
  state: SessionBlockState = {}
): React.CSSProperties {
  const hue = session.track?.color ?? NO_TRACK_COLOR
  const tint = trackTint(hue)
  if (state.solid) {
    return {
      backgroundColor: hue,
      borderColor: hue,
      "--sb-bar": "rgba(255,255,255,0.55)",
      "--sb-title": "#ffffff",
      "--sb-meta": "rgba(255,255,255,0.86)",
    } as React.CSSProperties
  }
  return {
    backgroundColor: tint.surface,
    borderColor: state.conflicted
      ? "var(--destructive)"
      : `color-mix(in oklab, ${hue} var(--track-edge-amount), var(--track-tint-base))`,
    "--sb-bar": hue,
    "--sb-title": tint.title,
    "--sb-meta": tint.meta,
  } as React.CSSProperties
}

export interface SessionCardBodyProps {
  session: AgendaSession
  timeZone: string
  roomName?: string
  /** Very short cards collapse to one line rather than overflow. */
  density?: "roomy" | "tight"
  showTime?: boolean
}

/** Card contents: 4px track bar, saturated title, time, room, speakers. */
export function SessionCardBody({
  session,
  timeZone,
  roomName,
  density = "roomy",
  showTime = true,
}: SessionCardBodyProps) {
  const time =
    typeof session.startsAt === "number"
      ? formatTimeRange(session.startsAt, session.durationMinutes, timeZone)
      : null

  return (
    <>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 rounded-l-[7px]"
        style={{
          backgroundColor: "var(--sb-bar, var(--muted-foreground))",
        }}
      />
      <div className="flex min-w-0 flex-col gap-0.5 pl-2 text-left">
        {/*
         * Under ~30 minutes there is no room for a second line, so the time
         * moves inline behind the title in the quieter tone — Notion's
         * "OR Team Lunch 1PM" collapse.
         */}
        <p
          className={cn(
            "font-semibold",
            density === "tight"
              ? "truncate text-[11px] leading-4"
              : "line-clamp-2 text-xs leading-4"
          )}
          style={{ color: "var(--sb-title, var(--foreground))" }}
        >
          {session.title}
          {density === "tight" && showTime && time ? (
            <span
              className="ml-1.5 font-medium tabular-nums"
              style={{ color: "var(--sb-meta, var(--muted-foreground))" }}
            >
              {time}
            </span>
          ) : null}
        </p>
        {density !== "tight" && showTime && time ? (
          <p
            className="truncate text-[11px] leading-4 tabular-nums"
            style={{ color: "var(--sb-meta, var(--muted-foreground))" }}
          >
            {time}
          </p>
        ) : null}
        {density === "roomy" ? (
          <>
            {roomName ? (
              <p
                className="truncate text-[11px] leading-4"
                style={{ color: "var(--sb-meta, var(--muted-foreground))" }}
              >
                {roomName}
              </p>
            ) : null}
            <p
              className="truncate text-[11px] leading-4"
              style={{ color: "var(--sb-meta, var(--muted-foreground))" }}
            >
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

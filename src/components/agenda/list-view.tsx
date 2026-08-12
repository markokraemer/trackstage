/**
 * List view — the whole programme as one table, earliest first, editable in
 * place (docs/SPEC.md §4.6 "List view: table with time, title, room, track,
 * speakers; inline edit").
 *
 * This is the view that works everywhere: no drag, no canvas, just selects and
 * a time field. It is the fastest path for a keyboard organizer and the path a
 * browser agent will take.
 */

import * as React from "react"
import { RiCalendarScheduleLine, RiErrorWarningLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  AgendaConflict,
  AgendaRoom,
  AgendaSession,
  ScheduledSession,
} from "./agenda-model"
import {
  DURATION_OPTIONS,
  NO_TRACK_COLOR,
  conflictsForSession,
  speakerLabel,
} from "./agenda-model"
import {
  dayKeyOf,
  formatDayLabel,
  formatDuration,
  minutesIntoDay,
  timeAt,
} from "./agenda-time"
import { ScheduleFields } from "./schedule-fields"
import { AgendaCalendarButton } from "./agenda-calendar-button"
import { useAgendaActions } from "./use-agenda-actions"

export interface ListViewProps {
  scheduled: Array<ScheduledSession>
  unscheduled: Array<AgendaSession>
  rooms: Array<AgendaRoom>
  dayKeys: Array<string>
  defaultDayKey: string
  timeZone: string
  conflicts: Array<AgendaConflict>
  conflictIds: Set<string>
}

export function ListView({
  scheduled,
  unscheduled,
  rooms,
  dayKeys,
  defaultDayKey,
  timeZone,
  conflicts,
  conflictIds,
}: ListViewProps) {
  const multiDay = dayKeys.length > 1
  const rows = [...scheduled].sort((a, b) => a.startsAt - b.startsAt)

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {multiDay ? <TableHead className="w-40">Day</TableHead> : null}
                <TableHead className="w-32">Start time</TableHead>
                <TableHead className="min-w-56">Session</TableHead>
                <TableHead className="w-44">Room</TableHead>
                <TableHead className="w-32">Length</TableHead>
                <TableHead className="min-w-40">Speakers</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={multiDay ? 7 : 6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nothing is scheduled yet. Give an accepted session a room
                    and a time below and it appears here, sorted by start time.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((session) => (
                  <ScheduledRow
                    key={session.id}
                    session={session}
                    rooms={rooms}
                    dayKeys={dayKeys}
                    timeZone={timeZone}
                    multiDay={multiDay}
                    conflicts={conflictsForSession(conflicts, session.id)}
                    conflicted={conflictIds.has(session.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Not scheduled ({unscheduled.length})
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Accepted sessions that still need a room and a time.
            </p>
          </div>
        </header>
        {unscheduled.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Every accepted session has a slot. Nice work.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Session</TableHead>
                  <TableHead className="w-44">Track</TableHead>
                  <TableHead className="min-w-40">Speakers</TableHead>
                  <TableHead className="w-32">Length</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unscheduled.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium text-foreground">
                      {session.title}
                    </TableCell>
                    <TableCell>
                      <TrackChip session={session} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {speakerLabel(session.speakers)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDuration(session.durationMinutes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <SchedulePopover
                        session={session}
                        rooms={rooms}
                        dayKeys={dayKeys}
                        defaultDayKey={defaultDayKey}
                        timeZone={timeZone}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function TrackChip({ session }: { session: AgendaSession }) {
  if (!session.track) {
    return <span className="text-muted-foreground">No track</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ backgroundColor: session.track.color || NO_TRACK_COLOR }}
      />
      {session.track.name}
    </span>
  )
}

interface ScheduledRowProps {
  session: ScheduledSession
  rooms: Array<AgendaRoom>
  dayKeys: Array<string>
  timeZone: string
  multiDay: boolean
  conflicts: Array<AgendaConflict>
  conflicted: boolean
}

function ScheduledRow({
  session,
  rooms,
  dayKeys,
  timeZone,
  multiDay,
  conflicts,
  conflicted,
}: ScheduledRowProps) {
  const { place, remove } = useAgendaActions()
  const dayKey = dayKeyOf(session.startsAt, timeZone)
  const startMinutes = minutesIntoDay(session.startsAt, timeZone)

  const save = (patch: {
    dayKey?: string
    startMinutes?: number
    roomId?: string
    durationMinutes?: number
  }) => {
    const nextRoom = patch.roomId ?? session.roomId
    if (!nextRoom) return
    void place({
      submissionId: session.id,
      roomId: nextRoom,
      startsAt: timeAt(
        patch.dayKey ?? dayKey,
        patch.startMinutes ?? startMinutes,
        timeZone
      ),
      durationMinutes: patch.durationMinutes ?? session.durationMinutes,
      title: session.title,
      roomName: rooms.find((room) => room._id === nextRoom)?.name,
      timeZone,
    })
  }

  const durations = [
    ...new Set([...DURATION_OPTIONS, session.durationMinutes]),
  ].sort((a, b) => a - b)

  return (
    <TableRow className={cn(conflicted && "bg-destructive/5")}>
      {multiDay ? (
        <TableCell>
          <Select
            value={dayKey}
            onValueChange={(value) => save({ dayKey: String(value) })}
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={`Day for ${session.title}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dayKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {formatDayLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
      ) : null}

      <TableCell>
        <InlineTimeInput
          label={`Start time for ${session.title}`}
          minutes={startMinutes}
          onCommit={(minutes) => save({ startMinutes: minutes })}
        />
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{
              backgroundColor: session.track?.color ?? NO_TRACK_COLOR,
            }}
          />
          <span className="font-medium text-foreground">{session.title}</span>
          {conflicted ? (
            <Tooltip>
              <TooltipTrigger
                render={<span className="inline-flex text-destructive" />}
                aria-label="Scheduling conflict"
              >
                <RiErrorWarningLine size={15} aria-hidden />
              </TooltipTrigger>
              <TooltipContent>
                {conflicts.map((conflict, index) => (
                  <span key={index} className="block">
                    {conflict.label}
                  </span>
                ))}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {session.track?.name ?? "No track"}
        </span>
      </TableCell>

      <TableCell>
        <Select
          value={session.roomId ?? ""}
          onValueChange={(value) => save({ roomId: String(value) })}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={`Room for ${session.title}`}
          >
            {/* Base UI's SelectValue prints the raw value (a Convex id) when
                the popup's item list hasn't rendered — resolve the label
                ourselves so a room id can never appear on screen. */}
            <SelectValue placeholder="Pick a room…">
              {() =>
                rooms.find((room) => room._id === session.roomId)?.name ??
                "Pick a room…"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {rooms.map((room) => (
              <SelectItem key={room._id} value={room._id}>
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <Select
          value={String(session.durationMinutes)}
          onValueChange={(value) => save({ durationMinutes: Number(value) })}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={`Length of ${session.title}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durations.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                {formatDuration(minutes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="text-muted-foreground">
        {speakerLabel(session.speakers)}
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <AgendaCalendarButton
            session={session}
            roomName={rooms.find((room) => room._id === session.roomId)?.name}
            timeZone={timeZone}
            variant="ghost"
            iconOnly
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void remove(session.id, session.title)}
          >
            Unschedule
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

/** A real `<input type="time">` — 15-minute steps, commits on valid input. */
function InlineTimeInput({
  minutes,
  onCommit,
  label,
}: {
  minutes: number
  onCommit: (minutes: number) => void
  label: string
}) {
  const toValue = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
  const [value, setValue] = React.useState(() => toValue(minutes))

  React.useEffect(() => {
    setValue(toValue(minutes))
  }, [minutes])

  return (
    <Input
      type="time"
      step={900}
      aria-label={label}
      value={value}
      className="h-8 w-full px-2 text-sm"
      onChange={(event) => {
        const next = event.target.value
        setValue(next)
        const match = /^(\d{2}):(\d{2})$/.exec(next)
        if (!match) return
        const parsed = Number(match[1]) * 60 + Number(match[2])
        if (parsed !== minutes) onCommit(parsed)
      }}
    />
  )
}

function SchedulePopover({
  session,
  rooms,
  dayKeys,
  defaultDayKey,
  timeZone,
}: {
  session: AgendaSession
  rooms: Array<AgendaRoom>
  dayKeys: Array<string>
  defaultDayKey: string
  timeZone: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <RiCalendarScheduleLine aria-hidden />
        Schedule
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-sm leading-snug font-semibold text-foreground">
            {session.title}
          </p>
          <ScheduleFields
            session={session}
            rooms={rooms}
            dayKeys={dayKeys}
            timeZone={timeZone}
            defaultDayKey={defaultDayKey}
            mode="confirm"
            onDone={() => setOpen(false)}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

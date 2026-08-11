/**
 * Not scheduled tray — accepted sessions that don't have a slot yet
 * (docs/SPEC.md §4.6 "Unscheduled tray").
 *
 * Drag a card onto the grid, or open it and use the pickers. Both paths hit
 * the same `agenda.schedule` mutation.
 */

import * as React from "react"
import { useDraggable } from "@dnd-kit/core"
import { RiCheckDoubleLine, RiDraggable } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AgendaRoom, AgendaSession } from "./agenda-model"
import { speakerLabel } from "./agenda-model"
import { formatDuration } from "./agenda-time"
import { ScheduleFields } from "./schedule-fields"
import { sessionBlockStyle } from "./session-card"
import type { AgendaDragMachine } from "./use-drag-machine"

export interface UnscheduledTrayProps {
  sessions: Array<AgendaSession>
  rooms: Array<AgendaRoom>
  dayKeys: Array<string>
  defaultDayKey: string
  timeZone: string
  draggedRef: React.RefObject<boolean>
  /** Tray cards are keyboard-grabbable too — same machine as the grid. */
  machine?: AgendaDragMachine
  keyboardHintId?: string
  className?: string
}

export function UnscheduledTray({
  sessions,
  rooms,
  dayKeys,
  defaultDayKey,
  timeZone,
  draggedRef,
  machine,
  keyboardHintId,
  className,
}: UnscheduledTrayProps) {
  return (
    <aside
      aria-label="Sessions that are not scheduled yet"
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card shadow-xs xl:w-76 xl:shrink-0",
        className
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Not scheduled
          </h2>
          <Badge variant="secondary">{sessions.length}</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Accepted sessions waiting for a room and a time. Drag one onto the
          grid — or focus it and press{" "}
          <kbd className="rounded border border-border bg-muted px-1 font-sans text-[10px]">
            Enter
          </kbd>{" "}
          to place it with the arrow keys.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-status-green-bg text-status-green-fg">
            <RiCheckDoubleLine size={18} aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">
            Every accepted session has a slot
          </p>
          <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
            Accept more submissions and they will land here, ready to place.
          </p>
        </div>
      ) : (
        <div className="max-h-[calc(100svh-24rem)] min-h-40 overflow-y-auto">
          <ul className="flex flex-col gap-2 p-3">
            {sessions.map((session) => (
              <li key={session.id}>
                <TrayCard
                  session={session}
                  rooms={rooms}
                  dayKeys={dayKeys}
                  defaultDayKey={defaultDayKey}
                  timeZone={timeZone}
                  draggedRef={draggedRef}
                  machine={machine}
                  keyboardHintId={keyboardHintId}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}

interface TrayCardProps {
  session: AgendaSession
  rooms: Array<AgendaRoom>
  dayKeys: Array<string>
  defaultDayKey: string
  timeZone: string
  draggedRef: React.RefObject<boolean>
  machine?: AgendaDragMachine
  keyboardHintId?: string
}

function TrayCard({
  session,
  rooms,
  dayKeys,
  defaultDayKey,
  timeZone,
  draggedRef,
  machine,
  keyboardHintId,
}: TrayCardProps) {
  const [open, setOpen] = React.useState(false)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: session.id,
  })
  const grabbed = machine?.isGrabbed(session.id) ?? false

  return (
    <div ref={setNodeRef}>
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
              aria-label={`${session.title} — schedule this session`}
              aria-roledescription="Draggable session"
              aria-grabbed={grabbed || undefined}
            />
          }
          className={cn(
            "relative flex w-full cursor-grab touch-none items-start gap-1 overflow-hidden rounded-lg border px-2 py-2 text-left shadow-xs transition-shadow",
            "hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            isDragging && "opacity-40",
            grabbed &&
              "ring-3 shadow-lg ring-primary ring-offset-1 ring-offset-background"
          )}
          style={sessionBlockStyle(session)}
          onKeyDown={(event: React.KeyboardEvent) => {
            machine?.onCardKeyDown(session)(event)
          }}
          {...listeners}
          {...attributes}
          aria-describedby={keyboardHintId}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 rounded-l-[7px]"
            style={{ backgroundColor: "var(--sb-bar)" }}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-2">
            <span
              className="line-clamp-2 text-xs leading-4 font-semibold"
              style={{ color: "var(--sb-title)" }}
            >
              {session.title}
            </span>
            <span
              className="truncate text-[11px] leading-4"
              style={{ color: "var(--sb-meta)" }}
            >
              {speakerLabel(session.speakers)}
            </span>
            <span
              className="truncate text-[11px] leading-4"
              style={{ color: "var(--sb-meta)" }}
            >
              {formatDuration(session.durationMinutes)}
              {session.track ? ` · ${session.track.name}` : ""}
            </span>
          </span>
          <RiDraggable
            size={14}
            aria-hidden
            className="mt-0.5 shrink-0"
            style={{ color: "var(--sb-meta)" }}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-heading text-sm leading-snug font-semibold text-foreground">
                {session.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {speakerLabel(session.speakers)}
              </p>
            </div>
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
    </div>
  )
}

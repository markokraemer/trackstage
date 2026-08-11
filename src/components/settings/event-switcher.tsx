import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiCalendarEventLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import type { EventSummary } from "@/lib/current-event"

/**
 * Event switcher — the multi-event control (sbek CFP-17: "app supports ≥2
 * coexisting events via a list/switcher"). Choosing an event changes what the
 * whole organizer app is scoped to.
 */
export function EventSwitcher({
  events,
  current,
  onSelect,
  className,
}: {
  events: Array<EventSummary>
  current: EventSummary | undefined
  onSelect: (eventId: string) => void
  className?: string
}) {
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label="Switch event"
              className={cn("max-w-64", className)}
            />
          }
        >
          <RiCalendarEventLine size={15} aria-hidden />
          <span className="truncate">{current?.name ?? "No event yet"}</span>
          <RiArrowDownSLine size={15} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-muted-foreground">
            Your events
          </DropdownMenuLabel>
          {events.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              You haven't created an event yet.
            </p>
          ) : (
            events.map((event) => (
              <DropdownMenuItem
                key={event._id}
                onClick={() => onSelect(event._id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {event.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatZonedDateRange(
                      event.startsAt,
                      event.endsAt,
                      event.timezone,
                    ) ?? "Dates not set"}
                  </span>
                </span>
                {event._id === current?._id ? (
                  <RiCheckLine size={15} aria-hidden className="text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link to="/app/events" />}>
            <RiCalendarEventLine size={15} aria-hidden />
            All events
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <RiAddLine size={15} aria-hidden />
            New event
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewEventDialog hideTrigger open={creating} onOpenChange={setCreating} />
    </>
  )
}

import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiArrowRightSLine, RiCalendarEventLine } from "@remixicon/react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import { eventRefOf } from "@/lib/current-event"
import type { EventSummary } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"

/**
 * The events this workspace owns, each one a click away from its own settings
 * (docs/memory/RULES.md 23, refinement 2). Lives in the workspace-settings
 * dialog (src/components/shell/settings-dialogs.tsx). Opening a row also
 * switches the whole app to that event — the same `sb.currentEventId` store
 * the sidebar's event switcher writes to — and, because the link carries no
 * search params, closes the dialog on the way.
 */
export function WorkspaceEventsCard({
  events,
  onOpen,
}: {
  events: Array<EventSummary>
  onOpen: (eventId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          Events{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {events.length}
          </span>
        </CardTitle>
        <CardDescription>
          Each event keeps its own dates, rooms, tracks, submissions and agenda.
          Open one to manage its settings.
        </CardDescription>
        <CardAction>
          <NewEventDialog label="New event" variant="outline" size="sm" />
        </CardAction>
      </CardHeader>
      <CardContent className="gap-2 pt-2">
        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No events in this workspace yet. Create one to open a call for
            speakers and start collecting submissions.
          </p>
        ) : (
          events.map((row) => <EventRow key={row._id} event={row} onOpen={onOpen} />)
        )}
      </CardContent>
    </Card>
  )
}

function EventRow({
  event,
  onOpen,
}: {
  event: EventSummary
  onOpen: (eventId: string) => void
}) {
  const { data: counts } = useQuery(
    convexQuery(api.submissions.counts, { eventId: event._id }),
  )
  const dates = formatZonedDateRange(
    event.startsAt,
    event.endsAt,
    event.timezone,
  )

  return (
    <Link
      to={appLink.settings(eventRefOf(event))}
      onClick={() => onOpen(event._id)}
      aria-label={`${event.name} settings`}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <RiCalendarEventLine
        size={17}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {event.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {dates ?? "Dates not set"}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {counts ? (
          <>
            {counts.all} submission{counts.all === 1 ? "" : "s"}
          </>
        ) : (
          <Skeleton className="h-4 w-24" />
        )}
      </span>
      <RiArrowRightSLine
        size={17}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
    </Link>
  )
}

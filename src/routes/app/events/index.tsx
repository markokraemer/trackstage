import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiArrowRightLine,
  RiBuilding2Line,
  RiCalendarEventLine,
  RiGlobalLine,
  RiMapPin2Line,
  RiSettings3Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { CopyLinkButton } from "@/components/settings/copy-link-button"
import { publicEventUrl } from "@/components/settings/slug"
import { useCurrentEvent } from "@/components/settings/current-event"
import type { EventSummary } from "@/components/settings/current-event"
import {
  formatZonedDateRange,
  timezoneAbbreviation,
} from "@/components/settings/timezone"

export const Route = createFileRoute("/app/events/")({
  component: EventsPage,
})

/**
 * Events — the multi-event surface (sbek CFP-17 / CFP-18). Every event owns
 * its own submissions, speakers and agenda; "Open" switches what the whole
 * organizer app is scoped to.
 */
function EventsPage() {
  const { events, event: current, isLoading, selectEvent } = useCurrentEvent()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        description="Every conference, summit and meetup you run. Each one keeps its own submissions, speakers and agenda — nothing is shared between them."
        actions={<NewEventDialog />}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="gap-3 pt-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={RiCalendarEventLine}
          title="No events yet"
          description="An event is one conference, summit or meetup. Create one to open your call for speakers, collect submissions and build the agenda."
          action={<NewEventDialog label="Create your first event" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((row) => (
            <EventCard
              key={row._id}
              event={row}
              isCurrent={row._id === current?._id}
              onOpen={selectEvent}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({
  event,
  isCurrent,
  onOpen,
}: {
  event: EventSummary
  isCurrent: boolean
  onOpen: (eventId: string) => void
}) {
  const navigate = useNavigate()
  const dates = formatZonedDateRange(
    event.startsAt,
    event.endsAt,
    event.timezone,
  )

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        isCurrent && "ring-2 ring-primary/40",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate">{event.name}</span>
          {isCurrent ? (
            <Badge className="shrink-0 bg-primary/10 text-primary">
              Current
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>

      <CardContent className="gap-2 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <RiCalendarEventLine size={15} aria-hidden className="shrink-0" />
          <span className="truncate">{dates ?? "Dates not set yet"}</span>
        </p>
        <p className="flex items-center gap-2">
          <RiGlobalLine size={15} aria-hidden className="shrink-0" />
          <span className="truncate">
            {event.timezone.replace(/_/g, " ")}
            {timezoneAbbreviation(event.timezone)
              ? ` (${timezoneAbbreviation(event.timezone)})`
              : ""}
          </span>
        </p>
        {event.venue ? (
          <p className="flex items-center gap-2">
            <RiMapPin2Line size={15} aria-hidden className="shrink-0" />
            <span className="truncate">{event.venue}</span>
          </p>
        ) : null}
        {event.organizationName ? (
          <p className="flex items-center gap-2">
            <RiBuilding2Line size={15} aria-hidden className="shrink-0" />
            <span className="truncate">{event.organizationName}</span>
          </p>
        ) : null}
        <SubmissionCount eventId={event._id} />
      </CardContent>

      <CardFooter className="mt-auto flex-wrap gap-2 border-t">
        <Button
          size="sm"
          variant={isCurrent ? "outline" : "default"}
          onClick={() => {
            onOpen(event._id)
            void navigate({ to: "/app" })
          }}
        >
          {isCurrent ? "Go to dashboard" : "Open event"}
          <RiArrowRightLine size={15} aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onOpen(event._id)
            void navigate({ to: "/app/settings" })
          }}
        >
          <RiSettings3Line size={15} aria-hidden />
          Settings
        </Button>
        <CopyLinkButton
          url={publicEventUrl(event.slug)}
          label="Copy link"
          size="sm"
          className="ml-auto"
        />
      </CardFooter>
    </Card>
  )
}

/** Cheap per-event volume signal — one indexed read per card. */
function SubmissionCount({ eventId }: { eventId: string }) {
  const { data } = useQuery(
    convexQuery(api.submissions.counts, {
      eventId: eventId as Id<"events">,
    }),
  )
  if (!data) return null
  return (
    <p className="flex items-center gap-2">
      <Link
        to="/app/submissions"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {data.all} {data.all === 1 ? "submission" : "submissions"}
      </Link>
      {data.accepted ? <span>· {data.accepted} accepted</span> : null}
    </p>
  )
}

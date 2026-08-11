import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiArrowLeftLine, RiCalendarEventLine } from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/empty-state"
import { WidgetHeader } from "@/components/public/public-shell"
import { SessionCard } from "@/components/public/session-card"
import { SpeakerAvatar } from "@/components/public/speaker-avatar"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"

/**
 * Schedule itinerary for one person (sbek EMB-09).
 *
 * A speaker's personal run-of-show: every session they're on, in time order,
 * grouped by day with rooms — plus a single `.ics` download so they (or an
 * attendee following them) can drop the whole thing into a calendar.
 */
export const Route = createFileRoute("/e/$slug/itinerary/$personId")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.speakerItinerary, {
        slug: params.slug,
        personId: params.personId,
      }),
    ),
  component: ItineraryPage,
})

function ItineraryPage() {
  const { slug, personId } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.speakerItinerary, { slug, personId }),
  )

  if (!data) return null
  const { event, speaker, days, unscheduled } = data

  const backLink = (
    <Button nativeButton={false}
      variant="ghost"
      size="sm"
      className="-ml-2 w-fit text-muted-foreground"
      render={
        <Link
          to="/e/$slug/speakers"
          params={{ slug }}
          search={(prev) => prev}
        />
      }
    >
      <RiArrowLeftLine aria-hidden />
      Back to speakers
    </Button>
  )

  if (!speaker) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <EmptyState
          icon={RiCalendarEventLine}
          title="We couldn't find that speaker"
          description="They may not be part of the published program. Browse everyone who is speaking instead."
        />
      </div>
    )
  }

  const sessions = [...days.flatMap((day) => day.sessions), ...unscheduled]

  return (
    <div className="flex flex-col gap-5">
      {backLink}

      <Card className="gap-4 p-5">
        <div className="flex items-start gap-4">
          <SpeakerAvatar
            name={speaker.name}
            headshotUrl={speaker.headshotUrl}
            className="size-16 sm:size-20"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {speaker.name}
            </h2>
            {speaker.jobTitle ? (
              <p className="text-sm text-muted-foreground">
                {speaker.jobTitle}
              </p>
            ) : null}
            {speaker.company ? (
              <p className="text-sm font-medium text-foreground/80">
                {speaker.company}
              </p>
            ) : null}
          </div>
        </div>
        {speaker.bio ? (
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {speaker.bio}
          </p>
        ) : null}
      </Card>

      <WidgetHeader
        title="Their schedule"
        count={`${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
        actions={
          sessions.length > 0 ? (
            <AddToCalendarButton
              event={event}
              sessions={sessions}
              label="Add all to calendar"
              filename={`${event.slug}-${speaker.name}`}
              size="sm"
            />
          ) : null
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={RiCalendarEventLine}
          title={data.publicMessage ?? "No sessions scheduled yet"}
          description={
            data.publicMessage
              ? `The organizer hasn't published the programme yet, so ${speaker.name}'s times aren't public. Check back soon.`
              : `${speaker.name} doesn't have a published session time yet. Check the full schedule for what's already announced.`
          }
          action={
            <Button nativeButton={false}
              variant="outline"
              render={
                <Link to="/e/$slug" params={{ slug }} search={(prev) => prev} />
              }
            >
              View the schedule
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.date} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {day.label}
                </h3>
                <Separator className="flex-1" />
              </div>
              {day.sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  event={event}
                  session={session}
                  options={search}
                  showDate={false}
                />
              ))}
            </section>
          ))}

          {unscheduled.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Times to be announced
                </h3>
                <Separator className="flex-1" />
              </div>
              {unscheduled.map((session) => (
                <SessionCard
                  key={session._id}
                  event={event}
                  session={session}
                  options={search}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

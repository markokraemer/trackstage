import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiArrowLeftLine, RiCalendarEventLine } from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { WidgetHeader } from "@/components/public/public-shell"
import { SessionCard } from "@/components/public/session-card"
import { SpeakerAvatar } from "@/components/public/speaker-avatar"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"
import { CopyLinkButton } from "@/components/public/copy-link-button"

/**
 * A speaker's public page (sbek EMB-09).
 *
 * Who they are plus their personal run-of-show: every session they're on, in
 * time order, grouped by day with rooms — and a single `.ics` so they (or an
 * attendee following them around the venue) can drop the lot into a calendar.
 * This is the drill-down target from the gallery, the directory, every session
 * card and every session detail page, which is why it is a real URL.
 */
export const Route = createFileRoute("/e/$workspaceSlug/$eventSlug/itinerary/$personId")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.speakerItinerary, {
        slug: params.eventSlug,
        workspaceSlug: params.workspaceSlug,
        personId: params.personId,
      }),
    ),
  head: ({ loaderData }) => {
    const speaker = loaderData?.speaker
    if (!speaker) return {}
    const role = [speaker.jobTitle, speaker.company].filter(Boolean).join(", ")
    return {
      meta: [
        { title: `${speaker.name} — ${loaderData.event.name}` },
        {
          name: "description",
          content:
            speaker.bio?.slice(0, 200) ||
            role ||
            `Speaking at ${loaderData.event.name}.`,
        },
      ],
    }
  },
  component: ItineraryPage,
})

function ItineraryPage() {
  const { workspaceSlug, eventSlug: slug, personId } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.speakerItinerary, { slug, workspaceSlug, personId }),
  )

  if (!data) return null
  const { event, speaker, days, unscheduled } = data

  const backLink = (
    <Link
      to="/e/$workspaceSlug/$eventSlug/speakers"
      params={{ workspaceSlug, eventSlug: slug }}
      search={(prev) => prev}
      className={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "-ml-2 w-fit text-muted-foreground",
      })}
    >
      <RiArrowLeftLine aria-hidden />
      Back to speakers
    </Link>
  )

  if (!speaker) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <EmptyState
          icon={RiCalendarEventLine}
          title="We couldn't find that speaker"
          description="They may not be part of the published program. Browse everyone who is speaking instead."
          action={
            <Link
              to="/e/$workspaceSlug/$eventSlug/speakers"
              params={{ workspaceSlug, eventSlug: slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              See all speakers
            </Link>
          }
        />
      </div>
    )
  }

  const sessions = [...days.flatMap((day) => day.sessions), ...unscheduled]

  return (
    <div className="flex flex-col gap-5">
      {backLink}

      <Card className="gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <SpeakerAvatar
              name={speaker.name}
              headshotUrl={speaker.headshotUrl}
              size="lg"
              eager
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
                {speaker.name}
              </h2>
              {speaker.jobTitle ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
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
          <CopyLinkButton
            what="Link to this speaker"
            size="sm"
            className="shrink-0"
          />
        </div>
        {speaker.bio ? (
          <p className="max-w-(--container-reading) text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {speaker.bio}
          </p>
        ) : null}
      </Card>

      <WidgetHeader
        title={sessions.length === 1 ? "Their session" : "Their sessions"}
        count={`${sessions.length}`}
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
            <Link
              to="/e/$workspaceSlug/$eventSlug"
              params={{ workspaceSlug, eventSlug: slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              View the schedule
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col">
          {days.map((day) => (
            <section
              key={day.date}
              className="flex flex-col gap-3 border-t border-border py-5 first:border-t-0 first:pt-0"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {day.label}
              </h3>
              {day.sessions.map((session) => (
                <SessionCard
                  workspaceSlug={workspaceSlug}
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
            <section className="flex flex-col gap-3 border-t border-border py-5 first:border-t-0 first:pt-0">
              <h3 className="text-sm font-semibold text-foreground">
                Times to be announced
              </h3>
              {unscheduled.map((session) => (
                <SessionCard
                  workspaceSlug={workspaceSlug}
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

import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowLeftLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiMapPin2Line,
  RiTimeLine,
} from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/empty-state"
import { SpeakerAvatar } from "@/components/public/speaker-avatar"
import { MetaChip, TrackChip } from "@/components/public/track-chip"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"
import { SaveSessionButton } from "@/components/public/save-session-button"
import { formatTimeRange } from "@/components/public/format"

/**
 * Session detail (sbek EMB-08).
 *
 * The drill-down from every widget: full description, the complete speaker
 * line-up with bios and headshots, the exact time range and room, and a
 * one-click calendar file generated in the browser. "Back to all sessions"
 * always returns the visitor to the catalog.
 */
export const Route = createFileRoute("/e/$slug/sessions/$sessionId")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.sessionDetail, {
        slug: params.slug,
        submissionId: params.sessionId,
      }),
    ),
  component: SessionDetailPage,
})

function SessionDetailPage() {
  const { slug, sessionId } = Route.useParams()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.sessionDetail, {
      slug,
      submissionId: sessionId,
    }),
  )

  if (!data) return null
  const { event, session } = data

  const backLink = (
    <Link
      to="/e/$slug/sessions"
      params={{ slug }}
      search={(prev) => prev}
      className={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "-ml-2 w-fit text-muted-foreground",
      })}
    >
      <RiArrowLeftLine aria-hidden />
      Back to all sessions
    </Link>
  )

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <EmptyState
          icon={RiFileList3Line}
          title="This session isn't available"
          description="It may have been withdrawn or isn't part of the published program. Browse the full schedule to find what you're looking for."
          action={
            <Link
              to="/e/$slug"
              params={{ slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              View the schedule
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-5">
      {backLink}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {session.track ? (
            <TrackChip name={session.track.name} color={session.track.color} />
          ) : null}
          {session.format ? (
            <Badge variant="secondary" className="h-6 px-2 text-xs font-medium">
              {session.format}
            </Badge>
          ) : null}
        </div>

        <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          {session.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <RiTimeLine size={16} aria-hidden className="text-muted-foreground" />
            {session.dayLabel ? `${session.dayLabel}: ` : ""}
            {formatTimeRange(session.startsAt, session.endsAt, event.timezone)}
          </span>
          {session.room ? (
            <span className="inline-flex items-center gap-1.5">
              <RiMapPin2Line
                size={16}
                aria-hidden
                className="text-muted-foreground"
              />
              {session.room.name}
              {session.room.capacity
                ? ` · seats ${session.room.capacity}`
                : ""}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AddToCalendarButton
            event={event}
            sessions={[session]}
            filename={session.title}
          />
          <SaveSessionButton
            eventSlug={event.slug}
            sessionId={session._id}
            display="full"
          />
        </div>
      </div>

      {session.description ? (
        <Card className="gap-2 p-5">
          <h3 className="text-sm font-semibold text-foreground">
            About this session
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
            {session.description}
          </p>
        </Card>
      ) : null}

      {session.speakers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-base font-semibold text-foreground">
            {session.speakers.length === 1 ? "Speaker" : "Speakers"}
          </h3>
          {session.speakers.map((speaker) => (
            <Card key={speaker._id} className="gap-3 p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <SpeakerAvatar
                  name={speaker.name}
                  headshotUrl={speaker.headshotUrl}
                  className="size-14 sm:size-16"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-base font-semibold text-foreground">
                    {speaker.name}
                  </p>
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

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/e/$slug/itinerary/$personId"
                  params={{ slug, personId: speaker._id }}
                  search={(prev) => prev}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View their schedule
                </Link>
                {speaker.links?.linkedin ? (
                  <SpeakerLink href={speaker.links.linkedin} label="LinkedIn" />
                ) : null}
                {speaker.links?.twitter ? (
                  <SpeakerLink href={speaker.links.twitter} label="X" />
                ) : null}
                {speaker.links?.website ? (
                  <SpeakerLink href={speaker.links.website} label="Website" />
                ) : null}
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {session.format ? (
          <MetaChip label="Format" value={session.format} />
        ) : null}
        {session.track ? (
          <MetaChip label="Track" value={session.track.name} />
        ) : null}
        {session.level ? <MetaChip label="Level" value={session.level} /> : null}
        {session.language ? (
          <MetaChip label="Language" value={session.language} />
        ) : null}
        {session.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="h-6 px-2 text-xs">
            {tag}
          </Badge>
        ))}
      </div>

      {data.prev || data.next ? (
        <>
          <Separator />
          <nav
            aria-label="Session"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            {data.prev ? (
              <Link
                to="/e/$slug/sessions/$sessionId"
                params={{ slug, sessionId: data.prev._id }}
                search={(prev) => prev}
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "max-w-[45%] text-muted-foreground",
                })}
              >
                <RiArrowLeftSLine aria-hidden />
                <span className="truncate">{data.prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {data.next ? (
              <Link
                to="/e/$slug/sessions/$sessionId"
                params={{ slug, sessionId: data.next._id }}
                search={(prev) => prev}
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "ml-auto max-w-[45%] text-muted-foreground",
                })}
              >
                <span className="truncate">{data.next.title}</span>
                <RiArrowRightSLine aria-hidden />
              </Link>
            ) : null}
          </nav>
        </>
      ) : null}
    </article>
  )
}

function SpeakerLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" })}
    >
      <RiExternalLinkLine aria-hidden />
      {label}
    </a>
  )
}

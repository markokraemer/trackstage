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
import { TrackChip } from "@/components/public/track-chip"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"
import { SaveSessionButton } from "@/components/public/save-session-button"
import { CopyLinkButton } from "@/components/public/copy-link-button"
import {
  formatDayLong,
  formatTimeRange,
  formatTimeZoneLabel,
} from "@/components/public/format"

/**
 * Session detail (sbek EMB-08).
 *
 * The drill-down from every widget. Two columns on a wide screen: the reading
 * material (abstract, speaker line-up with bios and headshots) on the left,
 * and everything actionable — time, room, calendar file, save, share, the
 * classification chips — in a panel on the right that stays put while the
 * abstract scrolls. On a phone the panel simply comes first, because "when and
 * where" is the question a visitor standing in a corridor is asking.
 */
export const Route = createFileRoute("/e/$slug/sessions/$sessionId")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.sessionDetail, {
        slug: params.slug,
        submissionId: params.sessionId,
      }),
    ),
  head: ({ loaderData }) => {
    const session = loaderData?.session
    if (!session) return {}
    const speakers = session.speakers.map((speaker) => speaker.name).join(", ")
    return {
      meta: [
        { title: `${session.title} — ${loaderData.event.name}` },
        {
          name: "description",
          content:
            session.description?.slice(0, 200) ??
            (speakers ? `With ${speakers}.` : `A session at ${loaderData.event.name}.`),
        },
      ],
    }
  },
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

  const zoneLabel =
    session.startsAt === undefined
      ? null
      : formatTimeZoneLabel(session.startsAt, event.timezone)

  return (
    <article className="flex flex-col gap-5">
      {backLink}

      <header className="flex flex-col gap-3">
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
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-8">
        {/* ── When / where / actions ─────────────────────────────────── */}
        <Card
          data-slot="session-facts"
          className="gap-4 p-5 lg:order-2 lg:sticky lg:top-20"
        >
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex gap-2.5">
              <RiTimeLine
                size={17}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0">
                <dt className="sr-only">When</dt>
                <dd>
                  {session.startsAt !== undefined ? (
                    <>
                      <span className="font-medium text-foreground">
                        {formatDayLong(session.startsAt, event.timezone)}
                      </span>
                      <span className="block text-muted-foreground">
                        {formatTimeRange(
                          session.startsAt,
                          session.endsAt,
                          event.timezone,
                        )}
                        {zoneLabel ? ` ${zoneLabel}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Date and time to be announced
                    </span>
                  )}
                </dd>
              </div>
            </div>

            {session.room ? (
              <div className="flex gap-2.5">
                <RiMapPin2Line
                  size={17}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <dt className="sr-only">Where</dt>
                  <dd>
                    <span className="font-medium text-foreground">
                      {session.room.name}
                    </span>
                    {session.room.capacity ? (
                      <span className="block text-muted-foreground">
                        Seats {session.room.capacity}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-col gap-2">
            <SaveSessionButton
              eventSlug={event.slug}
              sessionId={session._id}
              display="full"
              className="w-full"
            />
            <AddToCalendarButton
              event={event}
              sessions={[session]}
              filename={session.title}
              className="w-full"
            />
            <CopyLinkButton
              what="Link to this session"
              variant="ghost"
              className="w-full text-muted-foreground"
            />
          </div>

          {session.level ||
          session.language ||
          session.format ||
          session.track ||
          session.tags.length > 0 ? (
            <>
              <Separator />
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                <Fact label="Format" value={session.format} />
                <Fact label="Track" value={session.track?.name} />
                <Fact label="Level" value={session.level} />
                <Fact label="Language" value={session.language} />
              </dl>
              {session.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {session.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="h-6 px-2 text-xs font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </Card>

        {/* ── The reading material ───────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {session.description ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-heading text-base font-semibold text-foreground">
                About this session
              </h3>
              <p className="max-w-(--container-reading) text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground/85">
                {session.description}
              </p>
            </section>
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
                      size="md"
                      eager
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-base font-semibold text-foreground">
                        <Link
                          to="/e/$slug/itinerary/$personId"
                          params={{ slug, personId: speaker._id }}
                          search={(prev) => prev}
                          className="rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {speaker.name}
                        </Link>
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
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      View their schedule
                    </Link>
                    {speaker.links?.linkedin ? (
                      <SpeakerLink
                        href={speaker.links.linkedin}
                        label="LinkedIn"
                      />
                    ) : null}
                    {speaker.links?.twitter ? (
                      <SpeakerLink href={speaker.links.twitter} label="X" />
                    ) : null}
                    {speaker.links?.website ? (
                      <SpeakerLink
                        href={speaker.links.website}
                        label="Website"
                      />
                    ) : null}
                  </div>
                </Card>
              ))}
            </section>
          ) : null}

          {data.prev || data.next ? (
            <nav
              aria-label="Nearby sessions"
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"
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
          ) : null}
        </div>
      </div>
    </article>
  )
}

/** One "Label — value" row in the facts panel; renders nothing when unset. */
function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium text-foreground">{value}</dd>
    </>
  )
}

function SpeakerLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "text-muted-foreground",
      })}
    >
      <RiExternalLinkLine aria-hidden />
      {label}
    </a>
  )
}

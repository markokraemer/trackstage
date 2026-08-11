import { Link } from "@tanstack/react-router"
import { RiArrowRightSLine, RiMapPin2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { SpeakerAvatar } from "@/components/public/speaker-avatar"
import { ShowMore } from "@/components/public/show-more"
import { TrackChip } from "@/components/public/track-chip"
import { formatTimeRange, formatWhen } from "@/components/public/format"
import type { PublicEvent, PublicSpeakerRow } from "@/components/public/types"
import type { WidgetSearch } from "@/components/public/widget-search"

/**
 * Speaker gallery + speaker directory (sbek EMB-04/05/12/13).
 *
 * Two renderings of the same alphabetised data, because the two widgets answer
 * different questions: the **gallery** is a scannable photo grid ("who's
 * speaking?"), the **directory** pairs each speaker with their sessions
 * inline ("what is this person doing and when?").
 *
 * Both drill into the speaker's own page (`/e/:slug/itinerary/:personId`)
 * through an ordinary link rather than a dialog. A speaker is a thing people
 * share — "come see Priya" has to be a URL — and a link is also the only
 * drill-down a keyboard, a crawler or a browsing agent can rely on.
 */

interface SharedProps {
  event: Pick<PublicEvent, "slug" | "timezone">
  speakers: Array<PublicSpeakerRow>
  options?: WidgetSearch
}

/**
 * True when a person's roles say something a reader doesn't already know from
 * the fact that they are on a speakers page (i.e. they chair or moderate).
 */
function isNotableRole(roleLabels: Array<string>): boolean {
  return roleLabels.some((label) => label !== "Speaker")
}

/** "Chairperson · Speaker" — only rendered when it isn't just "Speaker". */
function RoleLine({ roleLabels }: { roleLabels: Array<string> }) {
  if (!isNotableRole(roleLabels)) return null
  return (
    <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] leading-tight font-medium text-primary">
      {roleLabels.join(" · ")}
    </span>
  )
}

export function SpeakerGallery({ event, speakers, options }: SharedProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {speakers.map((speaker) => (
        <li key={speaker._id}>
          <Card
            size="sm"
            className="h-full gap-0 p-0 transition-shadow hover:ring-[color-mix(in_oklch,var(--primary)_28%,var(--border))]"
          >
            <Link
              to="/e/$slug/itinerary/$personId"
              params={{ slug: event.slug, personId: speaker._id }}
              search={(prev) => prev}
              className="flex h-full w-full flex-col items-center gap-1 rounded-xl p-4 text-center outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <SpeakerAvatar
                name={speaker.name}
                headshotUrl={speaker.headshotUrl}
                hideImage={options?.hideImages}
                size="lg"
              />
              <p className="mt-2 text-sm leading-tight font-semibold text-balance text-foreground">
                {speaker.name}
              </p>
              {speaker.jobTitle ? (
                <p className="text-xs leading-tight text-balance text-muted-foreground">
                  {speaker.jobTitle}
                </p>
              ) : null}
              {speaker.company ? (
                <p className="text-xs leading-tight font-medium text-balance text-foreground/70">
                  {speaker.company}
                </p>
              ) : null}
              <RoleLine roleLabels={speaker.roleLabels} />
              <span className="mt-auto pt-3 text-[11px] text-muted-foreground">
                {speaker.sessionCount}{" "}
                {speaker.sessionCount === 1 ? "session" : "sessions"}
              </span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function SpeakerDirectory({ event, speakers, options }: SharedProps) {
  return (
    <ul className="flex flex-col gap-3">
      {speakers.map((speaker) => (
        <li key={speaker._id}>
          <Card className="gap-4 p-4 transition-shadow hover:ring-[color-mix(in_oklch,var(--primary)_28%,var(--border))] sm:p-5">
            <div className="flex items-start gap-4">
              <SpeakerAvatar
                name={speaker.name}
                headshotUrl={speaker.headshotUrl}
                hideImage={options?.hideImages}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-semibold text-foreground">
                  <Link
                    to="/e/$slug/itinerary/$personId"
                    params={{ slug: event.slug, personId: speaker._id }}
                    search={(prev) => prev}
                    className="rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {speaker.name}
                  </Link>
                </h3>
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
                <RoleLine roleLabels={speaker.roleLabels} />
              </div>
              <Link
                to="/e/$slug/itinerary/$personId"
                params={{ slug: event.slug, personId: speaker._id }}
                search={(prev) => prev}
                aria-label={`${speaker.name}'s schedule`}
                className="hidden shrink-0 items-center gap-0.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
              >
                Schedule
                <RiArrowRightSLine size={16} aria-hidden />
              </Link>
            </div>

            {options?.hideDescriptions ? null : (
              <ShowMore text={speaker.bio} lines={3} />
            )}

            {speaker.sessions.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Sessions ({speaker.sessions.length})
                </p>
                <ul className="flex flex-col gap-2.5">
                  {speaker.sessions.map((session) => (
                    <li key={session._id} className="text-sm">
                      <Link
                        to="/e/$slug/sessions/$sessionId"
                        params={{
                          slug: event.slug,
                          sessionId: session._id,
                        }}
                        search={(prev) => prev}
                        className="rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {session.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(
                          session.startsAt,
                          session.endsAt,
                          event.timezone,
                        )}
                        {session.roomName ? ` · ${session.roomName}` : ""}
                        {session.roleLabel !== "Speaker"
                          ? ` · ${session.roleLabel}`
                          : ""}
                      </p>
                      {session.track ? (
                        <TrackChip
                          name={session.track.name}
                          color={session.track.color}
                          className="mt-1"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** Compact session line used by itinerary pages. */
export function SessionTimeLine({
  startsAt,
  endsAt,
  timeZone,
  roomName,
  className,
}: {
  startsAt?: number
  endsAt?: number
  timeZone: string
  roomName?: string | null
  className?: string
}) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>{formatTimeRange(startsAt, endsAt, timeZone)}</span>
      {roomName ? (
        <span className="inline-flex items-center gap-1">
          <RiMapPin2Line size={13} aria-hidden />
          {roomName}
        </span>
      ) : null}
    </p>
  )
}

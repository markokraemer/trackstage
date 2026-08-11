import { Link } from "@tanstack/react-router"
import { RiMapPin2Line, RiTimeLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SpeakerAvatar } from "@/components/public/speaker-avatar"
import { ShowMore } from "@/components/public/show-more"
import { TrackChip } from "@/components/public/track-chip"
import { SaveSessionButton } from "@/components/public/save-session-button"
import { CopyLinkButton } from "@/components/public/copy-link-button"
import { formatTimeRange, formatWhen } from "@/components/public/format"
import { ROLE_LABELS } from "@/components/submit/types"
import type { PublicEvent, PublicSession } from "@/components/public/types"
import type { WidgetSearch } from "@/components/public/widget-search"

const MAX_SPEAKERS = 8

/**
 * The session card — one component, used by the sessions catalog, the
 * chronological schedule/itinerary and a speaker's personal schedule, so the
 * same session always shows the same fields everywhere (sbek EMB-16).
 *
 * Field anatomy per sbek EMB-01: title, truncated abstract + Show more, full
 * date/time, room, speakers (name / job title / company), Format + Track chips.
 * Built on the shadcn `Card` + `Badge` primitives.
 */
export interface SessionCardProps extends React.ComponentProps<typeof Card> {
  event: Pick<PublicEvent, "slug" | "timezone">
  /** The event's workspace — `/e/:workspaceSlug/:eventSlug` needs both segments. */
  workspaceSlug: string
  session: PublicSession
  /** Display options coming from the embed URL (`?hideDescriptions=1`…). */
  options?: WidgetSearch
  /** `false` inside a day-grouped list, where the day is already a header. */
  showDate?: boolean
}

export function SessionCard({
  event,
  workspaceSlug,
  session,
  options,
  showDate = true,
  className,
  ...props
}: SessionCardProps) {
  const speakers = session.speakers.slice(0, MAX_SPEAKERS)
  const overflow = session.speakers.length - speakers.length
  const when = showDate
    ? formatWhen(session.startsAt, session.endsAt, event.timezone)
    : formatTimeRange(session.startsAt, session.endsAt, event.timezone)

  return (
    <Card
      data-slot="session-card"
      className={cn(
        "gap-3 p-4 transition-shadow hover:ring-[color-mix(in_oklch,var(--primary)_28%,var(--border))] sm:p-5",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {session.track ? (
            <TrackChip
              name={session.track.name}
              color={session.track.color}
            />
          ) : null}
          {session.format ? (
            <Badge
              variant="secondary"
              className="h-6 px-2 text-xs font-medium"
            >
              {session.format}
            </Badge>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyLinkButton
            display="icon"
            variant="ghost"
            what="Link to this session"
            label="Copy link to this session"
            url={`/e/${workspaceSlug}/${event.slug}/sessions/${session._id}`}
          />
          <SaveSessionButton eventSlug={event.slug} sessionId={session._id} />
        </div>
      </div>

      <h3 className="font-heading text-base leading-snug font-semibold text-balance text-foreground sm:text-lg">
        <Link
          to="/e/$workspaceSlug/$eventSlug/sessions/$sessionId"
          params={{ workspaceSlug, eventSlug: event.slug, sessionId: session._id }}
          search={(prev) => prev}
          className="rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {session.title}
        </Link>
      </h3>

      {options?.hideDescriptions ? null : (
        <ShowMore text={session.description} lines={3} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/80">
        <span className="inline-flex items-center gap-1.5">
          <RiTimeLine size={15} aria-hidden className="text-muted-foreground" />
          {when}
        </span>
        {session.room ? (
          <span className="inline-flex items-center gap-1.5">
            <RiMapPin2Line
              size={15}
              aria-hidden
              className="text-muted-foreground"
            />
            {session.room.name}
          </span>
        ) : null}
      </div>

      {options?.hideSpeakers || speakers.length === 0 ? null : (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {speakers.length === 1 ? "Speaker" : "Speakers"}
          </p>
          <ul className="flex flex-col gap-2">
            {speakers.map((speaker) => (
              <li key={speaker._id} className="flex items-center gap-2.5">
                <SpeakerAvatar
                  name={speaker.name}
                  headshotUrl={speaker.headshotUrl}
                  hideImage={options?.hideImages}
                  size="xs"
                />
                <div className="min-w-0 text-sm leading-tight">
                  <Link
                    to="/e/$workspaceSlug/$eventSlug/itinerary/$personId"
                    params={{ workspaceSlug, eventSlug: event.slug, personId: speaker._id }}
                    search={(prev) => prev}
                    className="rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {speaker.name}
                  </Link>
                  {/* A chairperson or moderator is doing a different job on
                      this session than the speakers around them — say so. */}
                  {speaker.role && speaker.role !== "speaker" ? (
                    <span className="ml-1.5 align-middle text-[11px] font-medium text-primary">
                      {ROLE_LABELS[speaker.role] ?? speaker.role}
                    </span>
                  ) : null}
                  {speaker.jobTitle || speaker.company ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {[speaker.jobTitle, speaker.company]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {overflow > 0 ? (
            <p className="text-xs text-muted-foreground">
              + {overflow} more {overflow === 1 ? "speaker" : "speakers"}
            </p>
          ) : null}
        </div>
      )}
    </Card>
  )
}

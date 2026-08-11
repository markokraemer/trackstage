import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  RiCalendarEventLine,
  RiMapPin2Line,
  RiUserVoiceLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
 * inline ("what is this person doing and when?"). Clicking any speaker opens
 * the same detail dialog — bio, company, and their sessions with time + room.
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

export function SpeakerGallery({ event, speakers, options }: SharedProps) {
  const [selected, setSelected] = useState<PublicSpeakerRow | null>(null)

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {speakers.map((speaker) => (
          <li key={speaker._id}>
            <Card size="sm" className="h-full gap-0 p-0">
              <button
                type="button"
                onClick={() => setSelected(speaker)}
                className="flex h-full w-full flex-col items-center gap-2 rounded-xl p-4 text-center outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <SpeakerAvatar
                  name={speaker.name}
                  headshotUrl={speaker.headshotUrl}
                  hideImage={options?.hideImages}
                  className="size-20 sm:size-24"
                />
                <p className="mt-1 text-sm leading-tight font-semibold text-foreground">
                  {speaker.name}
                </p>
                {speaker.jobTitle ? (
                  <p className="text-xs leading-tight text-muted-foreground">
                    {speaker.jobTitle}
                  </p>
                ) : null}
                {speaker.company ? (
                  <p className="text-xs leading-tight font-medium text-foreground/70">
                    {speaker.company}
                  </p>
                ) : null}
                {/* Only worth the pixels when it isn't the obvious "Speaker" —
                    a chairperson or moderator on a speaker page is news. */}
                {isNotableRole(speaker.roleLabels) ? (
                  <p className="text-[11px] leading-tight font-medium text-primary">
                    {speaker.roleLabels.join(" · ")}
                  </p>
                ) : null}
                <span className="mt-auto pt-2 text-[11px] text-muted-foreground">
                  {speaker.sessionCount}{" "}
                  {speaker.sessionCount === 1 ? "session" : "sessions"}
                </span>
              </button>
            </Card>
          </li>
        ))}
      </ul>

      <SpeakerDetailDialog
        event={event}
        speaker={selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

export function SpeakerDirectory({ event, speakers, options }: SharedProps) {
  const [selected, setSelected] = useState<PublicSpeakerRow | null>(null)

  return (
    <>
      <ul className="flex flex-col gap-3">
        {speakers.map((speaker) => (
          <li key={speaker._id}>
            <Card className="gap-4 p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <SpeakerAvatar
                  name={speaker.name}
                  headshotUrl={speaker.headshotUrl}
                  hideImage={options?.hideImages}
                  className="size-14 sm:size-16"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-base font-semibold text-foreground">
                    <button
                      type="button"
                      onClick={() => setSelected(speaker)}
                      className="rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {speaker.name}
                    </button>
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
                </div>
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
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Role: {session.roleLabel}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      <SpeakerDetailDialog
        event={event}
        speaker={selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}

export interface SpeakerDetailDialogProps {
  event: Pick<PublicEvent, "slug" | "timezone">
  speaker: PublicSpeakerRow | null
  onClose: () => void
}

/** Gallery/directory drill-down: bio, company, and "Sessions (N)". */
export function SpeakerDetailDialog({
  event,
  speaker,
  onClose,
}: SpeakerDetailDialogProps) {
  return (
    <Dialog
      open={speaker !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85svh] gap-4 overflow-y-auto sm:max-w-lg">
        {speaker ? (
          <>
            <DialogHeader className="flex-row items-center gap-4 pr-8 text-left">
              <SpeakerAvatar
                name={speaker.name}
                headshotUrl={speaker.headshotUrl}
                className="size-16"
              />
              <div className="min-w-0">
                <DialogTitle className="text-lg">{speaker.name}</DialogTitle>
                {speaker.jobTitle ? (
                  <DialogDescription>{speaker.jobTitle}</DialogDescription>
                ) : null}
              </div>
            </DialogHeader>

            {speaker.company ? (
              <p className="text-sm text-foreground">
                <span className="font-medium">Company Name:</span>{" "}
                {speaker.company}
              </p>
            ) : null}

            <ShowMore text={speaker.bio} lines={4} threshold={280} />

            <Separator />

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-foreground">
                Sessions ({speaker.sessions.length})
              </p>
              {speaker.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sessions published for this speaker yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {speaker.sessions.map((session) => (
                    <li key={session._id} className="flex flex-col gap-1">
                      <Link
                        to="/e/$slug/sessions/$sessionId"
                        params={{ slug: event.slug, sessionId: session._id }}
                        search={(prev) => prev}
                        onClick={onClose}
                        className="rounded-sm text-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {session.title}
                      </Link>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <RiCalendarEventLine size={13} aria-hidden />
                          {formatWhen(
                            session.startsAt,
                            session.endsAt,
                            event.timezone,
                          )}
                        </span>
                        {session.roomName ? (
                          <span className="inline-flex items-center gap-1">
                            <RiMapPin2Line size={13} aria-hidden />
                            {session.roomName}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <RiUserVoiceLine size={13} aria-hidden />
                          {session.roleLabel}
                        </span>
                      </p>
                      {session.track ? (
                        <TrackChip
                          name={session.track.name}
                          color={session.track.color}
                          className="w-fit"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose render={<Button variant="outline" />}>
                Close
              </DialogClose>
              <Link
                to="/e/$slug/itinerary/$personId"
                params={{ slug: event.slug, personId: speaker._id }}
                search={(prev) => prev}
                onClick={onClose}
                className={buttonVariants({})}
              >
                <RiUserVoiceLine aria-hidden />
                View full schedule
              </Link>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
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
      <span className="inline-flex items-center gap-1">
        <RiCalendarEventLine size={13} aria-hidden />
        {formatTimeRange(startsAt, endsAt, timeZone)}
      </span>
      {roomName ? (
        <span className="inline-flex items-center gap-1">
          <RiMapPin2Line size={13} aria-hidden />
          {roomName}
        </span>
      ) : null}
    </p>
  )
}

import { RiCalendarCheckLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { buildIcs, downloadIcs, slugifyFilename } from "@/components/public/ics"
import { formatWhen } from "@/components/public/format"
import type { IcsEvent } from "@/components/public/ics"
import type { PublicEvent, PublicSession } from "@/components/public/types"

/**
 * "Add to calendar" — downloads a real `.ics` built in the browser from the
 * sessions already on screen (no server round trip, works on every widget).
 * Extends the shadcn `Button`.
 */
export interface AddToCalendarButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children" | "onClick"> {
  event: Pick<PublicEvent, "name" | "slug" | "timezone" | "venue">
  sessions: Array<PublicSession>
  /** Button label. */
  label?: string
  /** Download filename (without extension). */
  filename?: string
}

/** Turn public sessions into calendar events (unscheduled ones are skipped). */
export function sessionsToIcsEvents(
  event: Pick<PublicEvent, "name" | "slug" | "timezone" | "venue">,
  sessions: Array<PublicSession>,
): Array<IcsEvent> {
  return sessions
    .filter((session) => session.startsAt !== undefined)
    .map((session) => {
      const speakers = session.speakers.map((speaker) => speaker.name)
      const descriptionParts = [
        session.description?.trim(),
        speakers.length > 0 ? `Speakers: ${speakers.join(", ")}` : undefined,
        session.track ? `Track: ${session.track.name}` : undefined,
      ].filter((part): part is string => Boolean(part))

      return {
        uid: `${session._id}@${event.slug}.trackstage`,
        title: session.title,
        description: descriptionParts.join("\n\n"),
        location: session.room?.name ?? event.venue ?? undefined,
        startsAt: session.startsAt as number,
        endsAt: session.endsAt,
      }
    })
}

export function AddToCalendarButton({
  event,
  sessions,
  label = "Add to calendar",
  filename,
  variant = "outline",
  ...props
}: AddToCalendarButtonProps) {
  const icsEvents = sessionsToIcsEvents(event, sessions)
  const disabled = icsEvents.length === 0

  return (
    <Button
      variant={variant}
      disabled={disabled}
      title={
        disabled
          ? "This session doesn't have a time yet"
          : `Downloads a calendar file you can open in Google Calendar, Apple Calendar or Outlook`
      }
      onClick={() => {
        const name =
          sessions.length === 1 ? sessions[0].title : `${event.name} schedule`
        downloadIcs(
          `${slugifyFilename(filename ?? name)}.ics`,
          buildIcs(name, icsEvents),
        )
        toast.success(
          icsEvents.length === 1
            ? `"${sessions[0].title}" downloaded`
            : `${icsEvents.length} sessions downloaded`,
          {
            description:
              sessions.length === 1 && sessions[0].startsAt !== undefined
                ? formatWhen(
                    sessions[0].startsAt,
                    sessions[0].endsAt,
                    event.timezone,
                  )
                : "Open the .ics file to add it to your calendar.",
          },
        )
      }}
      {...props}
    >
      <RiCalendarCheckLine aria-hidden />
      {label}
    </Button>
  )
}

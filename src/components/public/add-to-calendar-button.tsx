import { eventUrl } from "@/lib/public-links"

import { AddToCalendar } from "@/components/shared/add-to-calendar"
import type { CalendarItem } from "@/components/shared/calendar-links"
import type { PublicEvent, PublicSession } from "@/components/public/types"

/**
 * "Add to calendar" for the public pages — the shared control
 * (`components/shared/add-to-calendar.tsx`) with the public session payload
 * mapped onto it, so every public surface offers the same one-click Google /
 * Outlook / Apple choice and the same `.ics`.
 */
/**
 * Only `slug` and `timezone` are required: the dense card in a widget knows
 * those two and nothing else, while the page-level controls pass the whole
 * event and get a venue fallback and a link back to the session for free.
 */
export type CalendarEventContext = Pick<PublicEvent, "slug" | "timezone"> &
  Partial<Pick<PublicEvent, "name" | "venue">> & { workspaceSlug?: string }

export interface AddToCalendarButtonProps
  extends Omit<React.ComponentProps<typeof AddToCalendar>, "items"> {
  event: CalendarEventContext
  sessions: Array<PublicSession>
}

/** Turn public sessions into calendar items (unscheduled ones are skipped). */
export function sessionsToCalendarItems(
  event: CalendarEventContext,
  sessions: Array<PublicSession>,
): Array<CalendarItem> {
  return sessions
    .filter((session) => session.startsAt !== undefined)
    .map((session) => {
      const speakers = session.speakers.map((speaker) => speaker.name)
      const description = [
        session.description?.trim(),
        speakers.length > 0 ? `Speakers: ${speakers.join(", ")}` : undefined,
        session.track ? `Track: ${session.track.name}` : undefined,
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n")

      return {
        uid: `${session._id}@${event.slug}.trackstage`,
        title: session.title,
        description,
        location: session.room?.name ?? event.venue ?? undefined,
        url: event.workspaceSlug
          ? `${eventUrl(event.workspaceSlug, event.slug)}/sessions/${session._id}`
          : undefined,
        startsAt: session.startsAt as number,
        endsAt: session.endsAt,
      }
    })
}

export function AddToCalendarButton({
  event,
  sessions,
  calendarName,
  timezone,
  ...props
}: AddToCalendarButtonProps) {
  return (
    <AddToCalendar
      items={sessionsToCalendarItems(event, sessions)}
      calendarName={
        calendarName ??
        (sessions.length === 1
          ? sessions[0].title
          : `${event.name ?? "Event"} schedule`)
      }
      timezone={timezone ?? event.timezone}
      {...props}
    />
  )
}

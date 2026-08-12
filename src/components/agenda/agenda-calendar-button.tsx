import { AddToCalendar } from "@/components/shared/add-to-calendar"
import type { CalendarItem } from "@/components/shared/calendar-links"
import type { AgendaSession } from "@/components/agenda/agenda-model"

/**
 * "Add to calendar" on the organizer's agenda.
 *
 * The board payload (`convex/agenda.ts`) is the leanest session shape in the
 * app — a duration, a room *id*, speaker names, no description — so the caller
 * resolves the room and this maps the rest onto the shared control. Organizers
 * live out of their own calendars on show days as much as speakers do.
 */
export interface AgendaCalendarButtonProps
  extends Omit<
    React.ComponentProps<typeof AddToCalendar>,
    "items" | "calendarName"
  > {
  session: AgendaSession
  roomName?: string
  timeZone: string
}

export function AgendaCalendarButton({
  session,
  roomName,
  timeZone,
  label = "Add to calendar",
  ...props
}: AgendaCalendarButtonProps) {
  if (typeof session.startsAt !== "number") return null

  const item: CalendarItem = {
    uid: `${session.id}@trackstage`,
    title: session.title,
    description:
      session.speakers.length > 0
        ? `Speakers: ${session.speakers.join(", ")}`
        : undefined,
    location: roomName,
    startsAt: session.startsAt,
    endsAt: session.startsAt + session.durationMinutes * 60_000,
  }

  return (
    <AddToCalendar
      items={[item]}
      calendarName={session.title}
      timezone={timeZone}
      filename={session.title}
      label={label}
      {...props}
    />
  )
}

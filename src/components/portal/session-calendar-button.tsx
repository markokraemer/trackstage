import { AddToCalendar } from "@/components/shared/add-to-calendar"
import type { CalendarItem } from "@/components/shared/calendar-links"

/**
 * "Add to calendar" in the speaker portal.
 *
 * The portal payload (`convex/portal.ts::submissionSummary`) carries a
 * `scheduled` object rather than the public session shape — a duration instead
 * of an end time, and the room already resolved to its name — so this maps it
 * onto the shared control. A speaker who has just been told when they are on
 * should be one click from having it in their own calendar.
 */
export interface PortalScheduledSubmission {
  id: string
  title: string
  description?: string
  scheduled: {
    startsAt: number
    durationMinutes: number
    room?: string
  } | null
}

export interface SessionCalendarButtonProps
  extends Omit<
    React.ComponentProps<typeof AddToCalendar>,
    "items" | "calendarName"
  > {
  submission: PortalScheduledSubmission
  event: { name?: string; venue?: string | null; timezone: string }
}

export function SessionCalendarButton({
  submission,
  event,
  label = "Add to calendar",
  ...props
}: SessionCalendarButtonProps) {
  if (!submission.scheduled) return null

  const item: CalendarItem = {
    uid: `${submission.id}@trackstage`,
    title: submission.title,
    description: [submission.description?.trim(), event.name]
      .filter((part): part is string => Boolean(part))
      .join("\n\n"),
    location:
      [submission.scheduled.room, event.venue]
        .filter((part): part is string => Boolean(part))
        .join(" · ") || undefined,
    startsAt: submission.scheduled.startsAt,
    endsAt:
      submission.scheduled.startsAt +
      submission.scheduled.durationMinutes * 60_000,
  }

  return (
    <AddToCalendar
      items={[item]}
      calendarName={submission.title}
      timezone={event.timezone}
      filename={submission.title}
      label={label}
      {...props}
    />
  )
}

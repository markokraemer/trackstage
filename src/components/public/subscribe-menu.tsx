import { AddToCalendar } from "@/components/shared/add-to-calendar"
import { icsFeedUrl } from "@/components/public/ics"

/**
 * "Add to calendar" for the *whole event* — the live `.ics` feed.
 *
 * The same shared control as everywhere else, given a feed instead of a list of
 * sessions: subscribing beats downloading here, because the visitor's calendar
 * then follows every room and time change the organizer makes afterwards.
 */
export interface SubscribeMenuProps
  extends Omit<
    React.ComponentProps<typeof AddToCalendar>,
    "items" | "feedUrl"
  > {
  slug: string
  /** Shown as the calendar's name once subscribed. */
  eventName?: string
}

export function SubscribeMenu({
  slug,
  eventName,
  label = "Add to calendar",
  ...props
}: SubscribeMenuProps) {
  const feed = icsFeedUrl(slug)
  if (!feed) return null

  return (
    <AddToCalendar
      feedUrl={feed}
      calendarName={eventName ?? slug}
      label={label}
      {...props}
    />
  )
}

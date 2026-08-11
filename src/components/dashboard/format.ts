import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
} from "date-fns"

/** "Ada Lovelace" → "AL"; "ada@x.com" → "AD". */
export function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "Good morning" / "Good afternoon" / "Good evening" for a local timestamp. */
export function greetingFor(now: number): string {
  const hour = new Date(now).getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/** First name only — the greeting reads better ("Good morning, Marko"). */
export function firstNameOf(value: string): string {
  const first = value.trim().split(/\s+/)[0]
  if (!first) return "there"
  // Fall back to the local-part of an email address.
  return first.includes("@") ? first.split("@")[0] : first
}

/** "Tuesday, August 11" — the context line above the greeting. */
export function longDate(now: number): string {
  return format(new Date(now), "EEEE, MMMM d")
}

/**
 * "62 days to event" / "Event starts today" / "Event has started".
 * Returns undefined when the event has no start date yet.
 */
export function countdownLabel(
  now: number,
  startsAt?: number,
): string | undefined {
  if (!startsAt) return undefined
  const days = differenceInCalendarDays(new Date(startsAt), new Date(now))
  if (days > 1) return `${days} days to event`
  if (days === 1) return "1 day to event"
  if (days === 0) return "Event starts today"
  return "Event under way"
}

/** "Aug 11" for a `yyyy-MM-dd` key from `dashboard.overview.pacing`. */
export function shortDayLabel(dateKey: string): string {
  const parsed = parseISO(dateKey)
  return isValid(parsed) ? format(parsed, "MMM d") : dateKey
}

/** "Due Aug 20" / "Due today" / "Overdue by 3 days". */
export function dueLabel(now: number, dueAt?: number): string | undefined {
  if (!dueAt) return undefined
  const days = differenceInCalendarDays(new Date(dueAt), new Date(now))
  if (days === 0) return "Due today"
  if (days < 0) {
    const overdue = Math.abs(days)
    return `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`
  }
  return `Due ${format(new Date(dueAt), "MMM d")}`
}

/** "Closes Aug 30" for a form close date. */
export function closesLabel(closeAt?: number): string | undefined {
  if (!closeAt) return undefined
  return `Closes ${format(new Date(closeAt), "MMM d, yyyy")}`
}

/**
 * "3 minutes ago" / "2 days ago" — how recent something is, which is the only
 * thing an organizer scanning a list of uploads actually wants to know. The
 * exact timestamp goes in a `title` tooltip next to it.
 */
export function relativeTime(at: number): string {
  return formatDistanceToNow(new Date(at), { addSuffix: true })
}

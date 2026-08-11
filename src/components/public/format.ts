/**
 * Date/time formatting for the public event pages.
 *
 * Everything is rendered in the *event's* timezone (not the visitor's), because
 * an attendee reading "09:00 AM" on a conference agenda means 9am at the venue.
 * `Intl.DateTimeFormat` instances are memoised — these run in tight list loops.
 */

const formatters = new Map<string, Intl.DateTimeFormat>()

function dtf(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let formatter = formatters.get(key)
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", { timeZone, ...options })
    } catch {
      // An unknown/invalid timezone must never blank the page.
      formatter = new Intl.DateTimeFormat("en-US", options)
    }
    formatters.set(key, formatter)
  }
  return formatter
}

/** "04:00 PM" */
export function formatTime(ms: number, timeZone: string): string {
  return dtf(timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms))
}

/** "04:00 PM - 05:00 PM" (start only when the end is unknown). */
export function formatTimeRange(
  startsAt: number | undefined,
  endsAt: number | undefined,
  timeZone: string,
): string {
  if (startsAt === undefined) return "Time to be announced"
  if (endsAt === undefined) return formatTime(startsAt, timeZone)
  return `${formatTime(startsAt, timeZone)} - ${formatTime(endsAt, timeZone)}`
}

/** "Friday, December 15" */
export function formatDayLong(ms: number, timeZone: string): string {
  return dtf(timeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(ms))
}

/** "Fri, Dec 15" — day pills and compact headers. */
export function formatDayShort(ms: number, timeZone: string): string {
  return dtf(timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(ms))
}

/**
 * "PDT" — the event's timezone abbreviation at a given instant.
 *
 * Public pages render every time in the *event's* zone, so the abbreviation
 * has to be stated once, visibly, or a remote attendee reads "09:00 AM" as
 * their own morning. Returns `null` when the runtime can't name the zone.
 */
export function formatTimeZoneLabel(
  ms: number,
  timeZone: string,
): string | null {
  const parts = dtf(timeZone, { timeZoneName: "short" }).formatToParts(
    new Date(ms),
  )
  return parts.find((part) => part.type === "timeZoneName")?.value ?? null
}

/** "Friday, December 15: 04:00 PM - 05:00 PM" — the canonical session line. */
export function formatWhen(
  startsAt: number | undefined,
  endsAt: number | undefined,
  timeZone: string,
): string {
  if (startsAt === undefined) return "Date and time to be announced"
  return `${formatDayLong(startsAt, timeZone)}: ${formatTimeRange(startsAt, endsAt, timeZone)}`
}

/** "Oct 12–14, 2026" / "Oct 30 – Nov 2, 2026" / "Oct 12, 2026". */
export function formatEventDates(
  startsAt: number | undefined,
  endsAt: number | undefined,
  timeZone: string,
): string | null {
  if (startsAt === undefined) return null
  const month = (ms: number) => dtf(timeZone, { month: "short" }).format(ms)
  const day = (ms: number) => dtf(timeZone, { day: "numeric" }).format(ms)
  const year = (ms: number) => dtf(timeZone, { year: "numeric" }).format(ms)

  if (endsAt === undefined) {
    return `${month(startsAt)} ${day(startsAt)}, ${year(startsAt)}`
  }
  if (year(startsAt) === year(endsAt)) {
    if (month(startsAt) === month(endsAt)) {
      // A one-day event stores a start and an end on the same date; printing
      // it as "Nov 5–5" is nonsense, so collapse the range.
      if (day(startsAt) === day(endsAt)) {
        return `${month(startsAt)} ${day(startsAt)}, ${year(startsAt)}`
      }
      return `${month(startsAt)} ${day(startsAt)}–${day(endsAt)}, ${year(endsAt)}`
    }
    return `${month(startsAt)} ${day(startsAt)} – ${month(endsAt)} ${day(endsAt)}, ${year(endsAt)}`
  }
  return `${month(startsAt)} ${day(startsAt)}, ${year(startsAt)} – ${month(endsAt)} ${day(endsAt)}, ${year(endsAt)}`
}

/** Minutes past midnight in the event timezone — the agenda grid's Y axis. */
export function minutesOfDay(ms: number, timeZone: string): number {
  const parts = dtf(timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms))
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  // Some locales render midnight as "24".
  return (hour % 24) * 60 + minute
}

/** "09:00 AM" label for an arbitrary minute-of-day (grid gutter). */
export function formatMinuteOfDay(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(total / 60)
  const minute = total % 60
  const suffix = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`
}

/** "1 - 22 of 22" — the result-count line the widgets show above a list. */
export function formatRange(shown: number, total: number): string {
  if (total === 0) return "0 of 0"
  return `1 - ${shown} of ${total}`
}

/** "AC" — avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

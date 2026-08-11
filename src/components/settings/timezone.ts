/**
 * Timezone + zoned date-time helpers.
 *
 * Event dates are stored as epoch milliseconds (`convex/schema.ts`) but an
 * organizer always thinks in the event's own timezone: "doors open at 9:00 AM
 * in New York" must stay 9:00 AM in New York whoever is looking at it. These
 * helpers convert both ways using `Intl` only — no extra dependency.
 */

/** Used only if `Intl.supportedValuesOf` is unavailable (very old runtimes). */
const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Athens",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
]

/** Every IANA timezone the browser knows about. */
export function allTimezones(): Array<string> {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("timeZone")
      if (values.length > 0) return [...values]
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_TIMEZONES
}

/** The viewer's own timezone — the right default for a new event. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
}

function partsInZone(timezone: string, date: Date): ZonedParts & { second: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // Some engines emit hour "24" for midnight under hour12: false.
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  }
}

/** Offset of `timezone` from UTC, in ms, at the given instant (DST-aware). */
export function zoneOffsetMs(timezone: string, date: Date = new Date()): number {
  try {
    const parts = partsInZone(timezone, date)
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    return asUtc - (date.getTime() - date.getMilliseconds())
  } catch {
    return 0
  }
}

/** Wall-clock time in `timezone` → epoch ms. */
export function zonedToUtcMs(
  timezone: string,
  parts: ZonedParts,
): number {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  )
  const firstGuess = naive - zoneOffsetMs(timezone, new Date(naive))
  // Re-check across a DST boundary: the offset at the guessed instant wins.
  return naive - zoneOffsetMs(timezone, new Date(firstGuess))
}

/** Epoch ms → wall-clock time in `timezone`. */
export function utcMsToZoned(timezone: string, ms: number): ZonedParts {
  const parts = partsInZone(timezone, new Date(ms))
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

/** "GMT-07:00" for the given instant. */
export function timezoneOffsetLabel(
  timezone: string,
  at: number = Date.now(),
): string {
  const offset = zoneOffsetMs(timezone, new Date(at))
  const sign = offset < 0 ? "-" : "+"
  const abs = Math.abs(offset)
  const hours = Math.floor(abs / 3_600_000)
  const minutes = Math.floor((abs % 3_600_000) / 60_000)
  return `GMT${sign}${pad(hours)}:${pad(minutes)}`
}

/** "PDT" — the chip shown next to a date-time field. */
export function timezoneAbbreviation(
  timezone: string,
  at: number = Date.now(),
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date(at))
    return parts.find((part) => part.type === "timeZoneName")?.value ?? ""
  } catch {
    return ""
  }
}

/** "(GMT-07:00) America/Los Angeles" — how a timezone reads in a picker. */
export function timezoneLabel(
  timezone: string,
  at: number = Date.now(),
): string {
  return `(${timezoneOffsetLabel(timezone, at)}) ${timezone.replace(/_/g, " ")}`
}

/** "October 12, 2026 at 9:00 AM" in the event's timezone. */
export function formatZonedDateTime(ms: number, timezone: string): string {
  try {
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms))
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms))
    return `${date} at ${time}`
  } catch {
    return new Date(ms).toLocaleString()
  }
}

/** "Oct 12 – 14, 2026" / "Oct 30 – Nov 2, 2026" in the event's timezone. */
export function formatZonedDateRange(
  startsAt: number | undefined,
  endsAt: number | undefined,
  timezone: string,
): string | undefined {
  if (!startsAt) return undefined
  const short = (ms: number, withYear: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" as const } : {}),
    }).format(new Date(ms))
  if (!endsAt) return short(startsAt, true)
  const start = utcMsToZoned(timezone, startsAt)
  const end = utcMsToZoned(timezone, endsAt)
  if (start.year === end.year && start.month === end.month) {
    return `${short(startsAt, false)} – ${end.day}, ${end.year}`
  }
  if (start.year === end.year) {
    return `${short(startsAt, false)} – ${short(endsAt, true)}`
  }
  return `${short(startsAt, true)} – ${short(endsAt, true)}`
}

/** "09:00" ⇄ minutes-of-day helpers for the time dropdown. */
export function minutesToTimeValue(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

export function timeValueToParts(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":")
  return { hour: Number(hour), minute: Number(minute) }
}

/** "9:00 AM" for a `HH:MM` value. */
export function formatTimeValue(value: string): string {
  const { hour, minute } = timeValueToParts(value)
  const suffix = hour < 12 ? "AM" : "PM"
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${pad(minute)} ${suffix}`
}

/** Every 15 minutes across the day — the options in the time dropdown. */
export function timeOptions(stepMinutes = 15): Array<{
  value: string
  label: string
}> {
  const options: Array<{ value: string; label: string }> = []
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const value = minutesToTimeValue(Math.floor(minutes / 60), minutes % 60)
    options.push({ value, label: formatTimeValue(value) })
  }
  return options
}

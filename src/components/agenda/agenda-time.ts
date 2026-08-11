/**
 * Timezone-aware time math for the agenda builder.
 *
 * Sessions are stored as absolute epoch milliseconds (`submissions.startsAt`),
 * but organizers think entirely in *event-local* wall-clock time ("the keynote
 * is at 9am"). Every helper here converts between the two using the event's
 * IANA timezone, so the grid reads the same for an organizer in Berlin and one
 * in San Francisco.
 *
 * Labels are formatted by hand (not `toLocaleTimeString`) so the axis, the
 * cards, and the pickers can never disagree because of locale differences.
 */

/** One grid row = 15 minutes (docs/SPEC.md §4.6 "15-min snap"). */
export const SLOT_MINUTES = 15
/** Height of one 15-minute row, in pixels. */
export const SLOT_HEIGHT = 20
export const PIXELS_PER_MINUTE = SLOT_HEIGHT / SLOT_MINUTES
/** Default visible window — widened automatically to fit outlying sessions. */
export const GRID_START_HOUR = 8
export const GRID_END_HOUR = 20

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE

export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

/** Falls back to UTC when an event carries an unknown/invalid timezone. */
export function safeTimeZone(timeZone: string | undefined | null): string {
  if (!timeZone) return "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return timeZone
  } catch {
    return "UTC"
  }
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  formatterCache.set(timeZone, formatter)
  return formatter
}

/** Wall-clock parts of `ts` as seen in `timeZone`. */
export function zonedParts(ts: number, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(new Date(ts))
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  }
}

/** Offset of `timeZone` at `ts`, in milliseconds (positive east of UTC). */
export function zonedOffsetMs(ts: number, timeZone: string): number {
  const parts = zonedParts(ts, timeZone)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUtc - Math.floor(ts / 1000) * 1000
}

/** Whole-hour UTC offset of the event timezone — used for `agenda.autoPlace`. */
export function zonedOffsetHours(ts: number, timeZone: string): number {
  return Math.round(zonedOffsetMs(ts, timeZone) / (60 * MS_PER_MINUTE))
}

/** Event-local wall clock → epoch ms. Handles DST transitions. */
export function zonedTimeToUtc(
  parts: Omit<ZonedParts, "second"> & { second?: number },
  timeZone: string
): number {
  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0
  )
  const firstPass = guess - zonedOffsetMs(guess, timeZone)
  return guess - zonedOffsetMs(firstPass, timeZone)
}

/** `2026-10-12` — the calendar day `ts` falls on, in the event timezone. */
export function dayKeyOf(ts: number, timeZone: string): string {
  const parts = zonedParts(ts, timeZone)
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`
}

export function isDayKey(value: string | undefined): value is string {
  return typeof value === "string" && DAY_KEY_PATTERN.test(value)
}

function splitDayKey(dayKey: string): {
  year: number
  month: number
  day: number
} {
  const [yearPart, monthPart, dayPart] = dayKey.split("-")
  return {
    year: Number(yearPart) || 1970,
    month: Number(monthPart) || 1,
    day: Number(dayPart) || 1,
  }
}

/** Epoch ms of 00:00 event-local on `dayKey`. */
export function dayKeyToMidnight(dayKey: string, timeZone: string): number {
  const { year, month, day } = splitDayKey(dayKey)
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone)
}

/** Minutes since event-local midnight. */
export function minutesIntoDay(ts: number, timeZone: string): number {
  const parts = zonedParts(ts, timeZone)
  return parts.hour * 60 + parts.minute
}

/** Epoch ms for `minutes` past midnight on `dayKey`, event-local. */
export function timeAt(
  dayKey: string,
  minutes: number,
  timeZone: string
): number {
  const { year, month, day } = splitDayKey(dayKey)
  return zonedTimeToUtc(
    { year, month, day, hour: 0, minute: Math.round(minutes) },
    timeZone
  )
}

/** `2026-10-12` + 1 → `2026-10-13`. */
export function shiftDayKey(dayKey: string, days: number): string {
  const { year, month, day } = splitDayKey(dayKey)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY)
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(shifted.getUTCDate(), 2)}`
}

/** Inclusive list of day keys between two epochs, in the event timezone. */
export function dayKeysBetween(
  startsAt: number,
  endsAt: number,
  timeZone: string
): Array<string> {
  const keys: Array<string> = []
  let key = dayKeyOf(startsAt, timeZone)
  const last = dayKeyOf(Math.max(startsAt, endsAt), timeZone)
  // Guard against pathological ranges — an agenda never needs 400 tabs.
  for (let i = 0; i < 400; i++) {
    keys.push(key)
    if (key === last) break
    key = shiftDayKey(key, 1)
  }
  return keys
}

/** "9:00 AM" from minutes past midnight. */
export function formatMinutes(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440
  const hour24 = Math.floor(total / 60)
  const minute = total % 60
  const suffix = hour24 < 12 ? "AM" : "PM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${pad(minute, 2)} ${suffix}`
}

/** "9:00 AM" for an absolute timestamp, in the event timezone. */
export function formatTime(ts: number, timeZone: string): string {
  return formatMinutes(minutesIntoDay(ts, timeZone))
}

/** "9:00 AM – 9:45 AM". */
export function formatTimeRange(
  ts: number,
  durationMinutes: number,
  timeZone: string
): string {
  const start = minutesIntoDay(ts, timeZone)
  return `${formatMinutes(start)} – ${formatMinutes(start + durationMinutes)}`
}

/** "45 min" · "1 hr" · "1 hr 30 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hourLabel = `${hours} hr`
  return rest === 0 ? hourLabel : `${hourLabel} ${rest} min`
}

/** "Mon, Oct 12" from a day key. */
export function formatDayLabel(dayKey: string): string {
  const { year, month, day } = splitDayKey(dayKey)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/** "Monday, October 12, 2026" — used for the day switcher's accessible name. */
export function formatDayLabelLong(dayKey: string): string {
  const { year, month, day } = splitDayKey(dayKey)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Short timezone label ("PDT") for the header chip. */
export function timeZoneAbbreviation(timeZone: string, ts: number): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date(ts))
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone
  } catch {
    return timeZone
  }
}

/** Snap a minute value to the 15-minute grid. */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0")
}

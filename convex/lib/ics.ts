// RFC 5545 iCalendar generation.
//
// Sessionboard attaches a calendar invite to acceptance emails once a session
// has a slot on the agenda (see docs/SPEC.md §4.9). The output must import
// cleanly into Google Calendar, Apple Calendar and Outlook, which in practice
// means: CRLF line endings, folding at 75 octets, escaped TEXT values, and
// UTC-stamped DTSTART/DTEND so no VTIMEZONE component is required.
//
// This module is pure (no Convex imports) so it can be used from queries,
// mutations, actions and HTTP endpoints alike, and unit-tested in isolation.

export type BuildIcsArgs = {
  /** Globally unique, stable id for the event. Usually `${submissionId}@host`. */
  uid: string
  title: string
  description?: string
  /** Epoch milliseconds. */
  startsAt: number
  durationMinutes: number
  /** IANA zone of the event — emitted as X-WR-TIMEZONE for nicer imports. */
  timezone?: string
  /** Room / venue. Omitted entirely when not assigned. */
  location?: string
  organizerEmail?: string
  attendeeEmail?: string
  /** Conference name — used for CALNAME and appended to the description. */
  eventName?: string
  /** Bump when re-sending an updated invite for the same UID. */
  sequence?: number
  /** Epoch ms for DTSTAMP; defaults to `Date.now()`. Injectable for tests. */
  now?: number
}

const CRLF = "\r\n"
const PRODID = "-//Sessionboard OSS//Sessionboard//EN"

/** `20261012T160000Z` — the UTC form, valid everywhere without a VTIMEZONE. */
export function toIcsUtc(epochMs: number): string {
  const d = new Date(epochMs)
  const p = (n: number, width = 2) => String(n).padStart(width, "0")
  return (
    `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/**
 * Escape a TEXT value per RFC 5545 §3.3.11: backslash, semicolon and comma are
 * escaped; newlines become the literal `\n` sequence. Colons are NOT escaped.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

/**
 * Fold a content line to 75 octets per RFC 5545 §3.1. Continuation lines start
 * with a single space. Folding is octet-based but must never split a UTF-8
 * multi-byte sequence, so we measure encoded width per code point.
 */
export function foldLine(line: string): string {
  const MAX = 75
  const out: string[] = []
  let current = ""
  let currentOctets = 0
  // First line gets 75 octets; continuations lose one to the leading space.
  let limit = MAX

  for (const char of line) {
    const octets = utf8Length(char)
    if (currentOctets + octets > limit) {
      out.push(current)
      current = ""
      currentOctets = 0
      limit = MAX - 1
    }
    current += char
    currentOctets += octets
  }
  out.push(current)

  return out.map((chunk, i) => (i === 0 ? chunk : ` ${chunk}`)).join(CRLF)
}

function utf8Length(char: string): number {
  const code = char.codePointAt(0) ?? 0
  if (code <= 0x7f) return 1
  if (code <= 0x7ff) return 2
  if (code <= 0xffff) return 3
  return 4
}

function mailto(email: string): string {
  return `mailto:${email.trim()}`
}

/**
 * Build a single-event VCALENDAR with `METHOD:REQUEST` — the form mail clients
 * recognise as an invitation (Accept / Decline buttons) rather than a plain
 * calendar file.
 */
export function buildIcs(args: BuildIcsArgs): string {
  const {
    uid,
    title,
    description,
    startsAt,
    durationMinutes,
    timezone,
    location,
    organizerEmail,
    attendeeEmail,
    eventName,
    sequence = 0,
    now = Date.now(),
  } = args

  const safeDuration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? Math.round(durationMinutes)
      : 60
  const endsAt = startsAt + safeDuration * 60_000

  const descriptionParts: string[] = []
  if (description && description.trim()) descriptionParts.push(description.trim())
  if (eventName) descriptionParts.push(eventName)
  const fullDescription = descriptionParts.join("\n\n")

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
  ]
  if (eventName) lines.push(`X-WR-CALNAME:${escapeText(eventName)}`)
  if (timezone) lines.push(`X-WR-TIMEZONE:${timezone}`)

  lines.push(
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(startsAt)}`,
    `DTEND:${toIcsUtc(endsAt)}`,
    `SUMMARY:${escapeText(title)}`,
  )
  if (fullDescription) lines.push(`DESCRIPTION:${escapeText(fullDescription)}`)
  // LOCATION is emitted only when a room is actually assigned (SPEC §4.9).
  if (location && location.trim()) {
    lines.push(`LOCATION:${escapeText(location.trim())}`)
  }
  if (organizerEmail) {
    const cn = eventName ? `;CN=${escapeText(eventName)}` : ""
    lines.push(`ORGANIZER${cn}:${mailto(organizerEmail)}`)
  }
  if (attendeeEmail) {
    lines.push(
      "ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;" +
        `RSVP=TRUE:${mailto(attendeeEmail)}`,
    )
  }
  lines.push(
    `SEQUENCE:${sequence}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  )

  return lines.map(foldLine).join(CRLF) + CRLF
}

/** Wrap several VEVENTs in one calendar — used by the whole-event feed. */
export function buildIcsCalendar(
  events: Array<Omit<BuildIcsArgs, "eventName" | "timezone">>,
  calendar: { name?: string; timezone?: string; now?: number } = {},
): string {
  const now = calendar.now ?? Date.now()
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]
  if (calendar.name) lines.push(`X-WR-CALNAME:${escapeText(calendar.name)}`)
  if (calendar.timezone) lines.push(`X-WR-TIMEZONE:${calendar.timezone}`)

  for (const e of events) {
    const single = buildIcs({ ...e, now }).split(CRLF)
    const start = single.indexOf("BEGIN:VEVENT")
    const end = single.lastIndexOf("END:VEVENT")
    if (start === -1 || end === -1) continue
    lines.push(...single.slice(start, end + 1))
  }

  lines.push("END:VCALENDAR")
  // `buildIcs` already folded the VEVENT lines; folding an already-folded
  // continuation line is a no-op because it is under 75 octets.
  return lines.join(CRLF) + CRLF
}

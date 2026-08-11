/**
 * Client-side iCalendar (.ics) generation.
 *
 * The public pages never need a round trip to add a session to a calendar:
 * everything required is already in the rendered payload, so the file is built
 * in the browser and handed to the user as a download. RFC 5545 essentials that
 * actually matter for Google/Apple/Outlook imports:
 *
 * - CRLF line endings, including a trailing one.
 * - UTC timestamps in `YYYYMMDDTHHMMSSZ` form (no VTIMEZONE needed).
 * - `\` `;` `,` and newlines escaped in text values.
 * - Content lines folded at 75 octets with a leading space on continuations.
 */

export interface IcsEvent {
  /** Stable per session so re-importing updates instead of duplicating. */
  uid: string
  title: string
  description?: string
  location?: string
  url?: string
  startsAt: number
  endsAt?: number
}

const CRLF = "\r\n"

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/** Fold to 75 octets per RFC 5545 §3.1 (continuations start with a space). */
function fold(line: string): string {
  if (line.length <= 75) return line
  const chunks: Array<string> = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest.length > 0) chunks.push(` ${rest}`)
  return chunks.join(CRLF)
}

/** Build a complete VCALENDAR document for one or more sessions. */
export function buildIcs(calendarName: string, events: Array<IcsEvent>): string {
  const now = stamp(Date.now())
  const lines: Array<string> = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trackstage//Public Program//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  for (const event of events) {
    const end = event.endsAt ?? event.startsAt + 60 * 60_000
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(event.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeText(event.title)}`,
    )
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`)
    }
    if (event.url) {
      lines.push(`URL:${escapeText(event.url)}`)
    }
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.map(fold).join(CRLF) + CRLF
}

/**
 * The event's live calendar feed — the same public endpoint the Embeds
 * settings screen hands organizers (`convex/apiHttp.ts`,
 * `/v1/event/{slug}/schedule.ics`).
 * Unlike the browser-built file above this one keeps updating: a visitor who
 * subscribes sees room and time changes without doing anything.
 */
export function icsFeedUrl(slug: string): string | null {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (!convexUrl || !slug) return null
  return `${convexUrl.replace(".convex.cloud", ".convex.site")}/v1/event/${slug}/schedule.ics`
}

/** `webcal://` form — one click subscribes in Apple/Outlook/Google Calendar. */
export function webcalFeedUrl(slug: string): string | null {
  const url = icsFeedUrl(slug)
  return url ? url.replace(/^https?:/, "webcal:") : null
}

/** "keynote-opening-remarks" — safe, readable download filenames. */
export function slugifyFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || "schedule"
}

/** Trigger a browser download of an .ics file. */
export function downloadIcs(filename: string, content: string): void {
  if (typeof document === "undefined") return
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Give Safari a tick before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

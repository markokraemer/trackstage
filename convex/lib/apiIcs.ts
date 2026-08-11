// ————————————————————————————————————————————————————————————————————————
// Minimal RFC 5545 writer for the public calendar feed
// (`GET /v1/event/{slug}/schedule.ics`).
//
// Lifted verbatim out of convex/http.ts when the REST API grew into its own
// module, so the feed is byte-for-byte what it has always been. Deliberately
// separate from convex/lib/ics.ts (which builds the single-session invites
// attached to speaker emails): a whole-event subscription feed and a one-shot
// VEVENT attachment have different requirements, and coupling them would make
// both harder to change.
// ————————————————————————————————————————————————————————————————————————

import { foldLine } from "./ics"

export function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

export function icsStamp(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/**
 * RFC 5545 §3.1: content lines SHOULD be folded at 75 OCTETS.
 *
 * This used to slice by `line.length`, which counts UTF-16 code units, not
 * octets — so a line carrying an em dash (one character, three octets) came out
 * at 76 and a line carrying an emoji could be cut through the middle of a
 * surrogate pair, emitting invalid UTF-8 into a subscribed calendar. Measured
 * on the live feed: two 76-octet lines in a six-session programme.
 *
 * The whole-event feed and the single-session invite are separate for good
 * reasons (see the header), but folding is not one of them — it is the same
 * paragraph of the same RFC. So this defers to the octet-aware implementation
 * that already exists and is unit-tested, rather than keeping a second, subtly
 * wrong copy of it.
 */
export function icsFold(line: string): string {
  return foldLine(line)
}

export type IcsEvent = {
  id: string
  title: string
  description: string
  startsAt: number
  endsAt: number
  location: string
  track: string
  speakers: Array<string>
}

export function buildCalendar(
  eventName: string,
  slug: string,
  events: Array<IcsEvent>,
  stampedAt: number,
): string {
  const lines: Array<string> = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trackstage//Event Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(eventName)}`,
  ]
  for (const item of events) {
    const details = [
      item.speakers.length > 0 ? `Speakers: ${item.speakers.join(", ")}` : "",
      item.track ? `Track: ${item.track}` : "",
      item.description,
    ]
      .filter((part) => part.length > 0)
      .join("\n\n")
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@${slug || "trackstage"}.trackstage`,
      `DTSTAMP:${icsStamp(stampedAt)}`,
      `DTSTART:${icsStamp(item.startsAt)}`,
      `DTEND:${icsStamp(item.endsAt)}`,
      `SUMMARY:${icsEscape(item.title)}`,
    )
    if (item.location) lines.push(`LOCATION:${icsEscape(item.location)}`)
    if (details) lines.push(`DESCRIPTION:${icsEscape(details)}`)
    if (item.track) lines.push(`CATEGORIES:${icsEscape(item.track)}`)
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return `${lines.map(icsFold).join("\r\n")}\r\n`
}

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

/** RFC 5545 §3.1: content lines SHOULD be folded at 75 octets. */
export function icsFold(line: string): string {
  if (line.length <= 74) return line
  const parts: Array<string> = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 73) {
    parts.push(` ${rest.slice(0, 73)}`)
    rest = rest.slice(73)
  }
  if (rest.length > 0) parts.push(` ${rest}`)
  return parts.join("\r\n")
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

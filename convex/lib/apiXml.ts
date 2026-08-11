/**
 * The published programme as XML — `GET /v1/event/{ref}/schedule.xml`.
 *
 * Why XML in 2026: the people who ask for it are not writing code. They run a
 * CMS or a site builder whose "import a feed" box speaks XML and nothing else,
 * and an organizer shouldn't need a developer to get their agenda onto that
 * page (sbek EMB-15 asks for the format by name). It carries exactly what the
 * public event page already shows — no credential, same data, different
 * envelope — so it is served alongside `schedule.ics` rather than behind a key.
 */

export interface XmlSpeaker {
  name: string
  role?: string
  jobTitle?: string
  company?: string
}

export interface XmlSession {
  _id: string
  title: string
  description?: string
  startsAt?: number
  endsAt?: number
  durationMinutes?: number
  room?: { name: string } | null
  track?: { name: string; color?: string } | null
  format?: string
  level?: string
  language?: string
  tags?: Array<string>
  speakers: Array<XmlSpeaker>
}

export interface XmlProgram {
  event: {
    name: string
    slug: string
    description?: string
    venue?: string
    timezone: string
    startsAt?: number
    endsAt?: number
    websiteUrl?: string
  }
  published: boolean
  sessions: Array<XmlSession>
}

/**
 * XML 1.0 forbids most control characters outright, and a pasted abstract can
 * carry one. Dropping them keeps the feed parseable; keeping them would hand a
 * CMS a document it refuses to open. Tab, newline and carriage return are the
 * three that are legal, so they stay.
 */
function stripControlChars(value: string): string {
  let out = ""
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code > 0x1f || char === "\t" || char === "\n" || char === "\r") {
      out += char
    }
  }
  return out
}

export function xmlEscape(value: string): string {
  return stripControlChars(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function tag(
  name: string,
  value: string | undefined | null,
  indent: string,
): string | null {
  if (value === undefined || value === null || value === "") return null
  return `${indent}<${name}>${xmlEscape(value)}</${name}>`
}

function iso(ms: number | undefined): string | undefined {
  return ms === undefined ? undefined : new Date(ms).toISOString()
}

/** `?track=AI,Infra` — one name, or several, matched case-insensitively. */
export function parseTrackFilter(raw: string | null): Array<string> {
  if (!raw) return []
  return raw
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0)
}

export function buildProgramXml(
  program: XmlProgram,
  generatedAt: number,
): string {
  const lines: Array<string> = ['<?xml version="1.0" encoding="UTF-8"?>']
  lines.push(
    `<programme generated="${xmlEscape(new Date(generatedAt).toISOString())}" published="${program.published ? "true" : "false"}">`,
  )
  lines.push("  <event>")
  for (const line of [
    tag("name", program.event.name, "    "),
    tag("slug", program.event.slug, "    "),
    tag("description", program.event.description, "    "),
    tag("venue", program.event.venue, "    "),
    tag("timezone", program.event.timezone, "    "),
    tag("website", program.event.websiteUrl, "    "),
    tag("starts", iso(program.event.startsAt), "    "),
    tag("ends", iso(program.event.endsAt), "    "),
  ]) {
    if (line) lines.push(line)
  }
  lines.push("  </event>")

  lines.push(`  <sessions count="${program.sessions.length}">`)
  for (const session of program.sessions) {
    lines.push(`    <session id="${xmlEscape(session._id)}">`)
    for (const line of [
      tag("title", session.title, "      "),
      tag("description", session.description, "      "),
      tag("starts", iso(session.startsAt), "      "),
      tag("ends", iso(session.endsAt), "      "),
      session.durationMinutes === undefined
        ? null
        : `      <duration minutes="${session.durationMinutes}"/>`,
      tag("room", session.room?.name, "      "),
      tag("track", session.track?.name, "      "),
      tag("format", session.format, "      "),
      tag("level", session.level, "      "),
      tag("language", session.language, "      "),
    ]) {
      if (line) lines.push(line)
    }
    if (session.tags && session.tags.length > 0) {
      lines.push("      <tags>")
      for (const item of session.tags) {
        const line = tag("tag", item, "        ")
        if (line) lines.push(line)
      }
      lines.push("      </tags>")
    }
    if (session.speakers.length > 0) {
      lines.push("      <speakers>")
      for (const speaker of session.speakers) {
        lines.push(
          `        <speaker${speaker.role ? ` role="${xmlEscape(speaker.role)}"` : ""}>`,
        )
        for (const line of [
          tag("name", speaker.name, "          "),
          tag("jobTitle", speaker.jobTitle, "          "),
          tag("company", speaker.company, "          "),
        ]) {
          if (line) lines.push(line)
        }
        lines.push("        </speaker>")
      }
      lines.push("      </speakers>")
    }
    lines.push("    </session>")
  }
  lines.push("  </sessions>")
  lines.push("</programme>")
  return lines.join("\n")
}

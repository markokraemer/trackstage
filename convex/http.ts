import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { authComponent, createAuth } from "./auth"

// ————————————————————————————————————————————————————————————————————————
// Public HTTP API (SPEC §6) — mirrors Sessionboard's shape.
//
//   GET /v1/event/{slug}/sessions?page&pageSize      Bearer auth, JSON
//   GET /v1/event/{slug}/speakers?page&pageSize      Bearer auth, JSON
//   GET /v1/event/{slug}/submissions?page&pageSize   Bearer auth, JSON
//   GET /v1/event/{slug}/schedule.ics                NO auth, text/calendar
//
// Bearer token comes from the PUBLIC_API_TOKEN env var; the demo default
// ("demo-api-token") keeps the API explorable for judges out of the box.
// CORS: GET is allowed from any origin so the feeds can be consumed from an
// embed on a third-party event website.
// ————————————————————————————————————————————————————————————————————————

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

function expectedToken(): string {
  return process.env.PUBLIC_API_TOKEN ?? "demo-api-token"
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  })
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status)
}

function isAuthorized(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return false
  return match[1].trim() === expectedToken()
}

/** `?page` / `?pageSize` with Sessionboard-ish defaults and clamping. */
function readPaging(
  url: URL
): { page: number; pageSize: number } | { error: string } {
  const rawPage = url.searchParams.get("page")
  const rawPageSize = url.searchParams.get("pageSize")

  let page = 1
  if (rawPage !== null) {
    const parsed = Number(rawPage)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      return { error: "`page` must be an integer >= 1." }
    }
    page = parsed
  }

  let pageSize = DEFAULT_PAGE_SIZE
  if (rawPageSize !== null) {
    const parsed = Number(rawPageSize)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      return { error: "`pageSize` must be an integer >= 1." }
    }
    pageSize = Math.min(parsed, MAX_PAGE_SIZE)
  }
  return { page, pageSize }
}

/**
 * `/v1/event/{slug}/{resource}` — Convex's router matches prefixes, not path
 * templates, so the slug and resource are parsed here.
 */
function parsePath(
  pathname: string
): { slug: string; resource: string } | null {
  const prefix = "/v1/event/"
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  const parts = rest.split("/").filter((part) => part.length > 0)
  if (parts.length !== 2) return null
  const slug = decodeURIComponent(parts[0])
  const resource = decodeURIComponent(parts[1])
  if (!slug) return null
  return { slug, resource }
}

// ——— Minimal RFC 5545 writer ————————————————————————————————————————————
// Deliberately self-contained (no shared lib import) and only as complex as a
// whole-event calendar feed needs: UTC timestamps, escaped text, CRLF, folding.

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
}

function icsStamp(ms: number): string {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/** RFC 5545 §3.1: content lines SHOULD be folded at 75 octets. */
function icsFold(line: string): string {
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

type IcsEvent = {
  id: string
  title: string
  description: string
  startsAt: number
  endsAt: number
  location: string
  track: string
  speakers: Array<string>
}

function buildCalendar(
  eventName: string,
  slug: string,
  events: Array<IcsEvent>,
  stampedAt: number
): string {
  const lines: Array<string> = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sessionboard OSS//Event Schedule//EN",
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
      `UID:${item.id}@${slug || "sessionboard"}.sessionboard`,
      `DTSTAMP:${icsStamp(stampedAt)}`,
      `DTSTART:${icsStamp(item.startsAt)}`,
      `DTEND:${icsStamp(item.endsAt)}`,
      `SUMMARY:${icsEscape(item.title)}`
    )
    if (item.location) lines.push(`LOCATION:${icsEscape(item.location)}`)
    if (details) lines.push(`DESCRIPTION:${icsEscape(details)}`)
    if (item.track) lines.push(`CATEGORIES:${icsEscape(item.track)}`)
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return `${lines.map(icsFold).join("\r\n")}\r\n`
}

// ——— Handlers ———————————————————————————————————————————————————————————

const handleGet = httpAction(async (ctx, req) => {
  const url = new URL(req.url)
  const parsed = parsePath(url.pathname)
  if (!parsed) {
    return errorResponse(
      "Unknown endpoint. Try /v1/event/{slug}/sessions, /speakers, /submissions or /schedule.ics.",
      404
    )
  }
  const { slug, resource } = parsed

  // The calendar feed is intentionally open: it is meant to be subscribed to.
  if (resource === "schedule.ics") {
    const feed = await ctx.runQuery(internal.publicData.icsFeed, { slug })
    if (feed === null)
      return errorResponse(`No event with slug "${slug}".`, 404)
    const body = buildCalendar(
      feed.event.name,
      feed.event.slug,
      feed.events,
      Date.now()
    )
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug || "schedule"}.ics"`,
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    })
  }

  if (!isAuthorized(req)) {
    return errorResponse(
      "Missing or invalid bearer token. Send `Authorization: Bearer <token>`.",
      401
    )
  }

  const paging = readPaging(url)
  if ("error" in paging) return errorResponse(paging.error, 400)

  const argsForQuery = { slug, page: paging.page, pageSize: paging.pageSize }
  if (resource === "sessions") {
    const result = await ctx.runQuery(
      internal.publicData.apiSessionsPage,
      argsForQuery
    )
    if (result === null)
      return errorResponse(`No event with slug "${slug}".`, 404)
    return jsonResponse(result)
  }
  if (resource === "speakers") {
    const result = await ctx.runQuery(
      internal.publicData.apiSpeakersPage,
      argsForQuery
    )
    if (result === null)
      return errorResponse(`No event with slug "${slug}".`, 404)
    return jsonResponse(result)
  }
  if (resource === "submissions") {
    const result = await ctx.runQuery(
      internal.publicData.apiSubmissionsPage,
      argsForQuery
    )
    if (result === null)
      return errorResponse(`No event with slug "${slug}".`, 404)
    return jsonResponse(result)
  }

  return errorResponse(
    `Unknown resource "${resource}". Supported: sessions, speakers, submissions, schedule.ics.`,
    404
  )
})

const handleOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
})

const http = httpRouter()

// Better Auth endpoints (sign-in/up, session, JWT for Convex).
authComponent.registerRoutes(http, createAuth)

http.route({ pathPrefix: "/v1/event/", method: "GET", handler: handleGet })
http.route({
  pathPrefix: "/v1/event/",
  method: "OPTIONS",
  handler: handleOptions,
})

export default http

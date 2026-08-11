import { httpAction } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { hashApiKey, keyPrefix } from "./apiKeys"
import { signPayload } from "./webhooks"
import { buildCalendar } from "./lib/apiIcs"
import {
  API_ROUTES,
  METADATA_WRITE_RESOURCES,
  SETTINGS_READ_RESOURCES,
} from "./apiRoutes"

// ————————————————————————————————————————————————————————————————————————
// Public REST API — routing, authentication, rate limiting, serialization.
// The data layer is convex/apiV1.ts; the endpoint-by-endpoint mapping against
// Sessionboard's API (and every deliberate divergence) is in
// docs/reference/api-parity.md.
//
// Convex's router matches exact paths and prefixes, not templates, so one
// dispatcher owns the whole `/v1/` tree and parses the segments itself.
//
// Compatibility contract: the four endpoints that existed before parity
// (`sessions`, `speakers`, `submissions`, `schedule.ics` under
// `/v1/event/{slug}/…`) keep working with the same auth, the same envelope
// keys and the same field names. Everything new is additive.
// ————————————————————————————————————————————————————————————————————————

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const RATE_LIMIT = 100
/** One multipart request; anything larger uses the two-phase flow. */
const SIMPLE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-access-token, Trackstage-Signature",
  "Access-Control-Expose-Headers":
    "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
}

// ——— Responses ———————————————————————————————————————————————————————————

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  })
}

/**
 * Error bodies carry three keys on purpose:
 *   `error`   — the human message (what our API has always returned here),
 *   `code`    — the machine-readable name Sessionboard puts in `error`,
 *   `message` — the human message again, where their clients look for it.
 * A client written against either API finds what it expects, and nothing
 * that worked before stops working.
 */
function errorResponse(
  message: string,
  status: number,
  code?: string,
  extraHeaders: Record<string, string> = {},
): Response {
  const codes: Record<number, string | undefined> = {
    400: "BadRequestError",
    401: "UnauthorizedError",
    403: "ForbiddenError",
    404: "NotFoundError",
    405: "MethodNotAllowedError",
    409: "ConflictError",
    413: "PayloadTooLargeError",
    429: "TooManyRequestsError",
    500: "InternalServerError",
  }
  return jsonResponse(
    { error: message, code: code ?? codes[status] ?? "Error", message, status },
    status,
    extraHeaders,
  )
}

// ——— Credentials ——————————————————————————————————————————————————————————

type Credential = {
  /** null = the legacy read-only demo token. */
  userId: string | null
  scopes: Array<string> | null
  /** Stable, non-reversible identity for rate-limit bucketing. */
  subject: string
  /** Displayable key head, for audit-log attribution only. */
  prefix: string
}

function legacyToken(): string {
  return process.env.PUBLIC_API_TOKEN ?? "demo-api-token"
}

function presentedToken(req: Request): string | null {
  // Sessionboard's header first, then the Bearer form our own docs, MCP
  // clients and the OpenAPI spec already use. Both are first-class.
  const headerToken = req.headers.get("x-access-token")
  if (headerToken && headerToken.trim()) return headerToken.trim()
  const auth = req.headers.get("Authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim())
  return match ? match[1].trim() : null
}

async function authenticate(
  ctx: ActionCtx,
  req: Request,
): Promise<Credential | null> {
  const token = presentedToken(req)
  if (!token) return null
  if (token === legacyToken()) {
    // Predates scopes and predates multi-tenancy. Read-only forever: it is
    // the token in the public docs so judges can explore without signing up.
    return {
      userId: null,
      scopes: ["read:*"],
      subject: "legacy-demo-token",
      prefix: "legacy-demo-token",
    }
  }
  if (!token.startsWith("sb_live_")) return null
  const keyHash = await hashApiKey(token)
  const resolved = await ctx.runMutation(internal.apiV1.resolveCredential, {
    keyHash,
  })
  if (!resolved) return null
  return {
    userId: resolved.userId,
    scopes: resolved.scopes,
    subject: keyHash,
    // Displayable head of the key ("sb_live_1a2b3c4d") — attribution only,
    // never authorization. It is what Settings → API & MCP already shows.
    prefix: keyPrefix(token),
  }
}

/**
 * Scope check. A key with no scopes set is unrestricted — it acts with
 * exactly what its owner's workspace membership grants, which is the
 * behaviour every existing key (and the MCP server) already relies on.
 * Setting scopes can only ever narrow that.
 */
function hasScope(credential: Credential, required: string): boolean {
  if (credential.scopes === null) return true
  if (credential.scopes.includes(required)) return true
  if (credential.scopes.includes("*")) return true
  // "read:*" is how the legacy demo token says "every read, no writes".
  if (credential.scopes.includes("read:*") && required.startsWith("read:"))
    return true
  return false
}

/**
 * Audit trail for REST writes (sbek CNT-11). Emitted here, after the write has
 * committed, so one call site covers a route rather than reaching into
 * convex/apiV1.ts's mutations. Attribution carries the method, the path and
 * the key prefix, which is what puts API traffic in the Activity feed's
 * "Agents & API" lens alongside the MCP server.
 *
 * Fire-and-forget: history must never turn a successful API write into a 500.
 */
async function auditApiWrite(
  ctx: ActionCtx,
  credential: Credential,
  input: {
    eventRef: string
    method: string
    entity: string
    entityId?: string
    action: string
    summary: string
    meta?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await ctx.runMutation(internal.audit.recordApiWrite, {
      eventRef: input.eventRef,
      method: input.method,
      credentialPrefix: credential.prefix,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      meta: input.meta,
    })
  } catch {
    // Best-effort by design.
  }
}

// ——— Rate limiting ————————————————————————————————————————————————————————

/** Buckets mirror the categories Sessionboard documents. */
type Bucket =
  | "entity_reads"
  | "session_writes"
  | "field_writes"
  | "metadata_writes"
  | "event_writes"
  | null

async function enforceRateLimit(
  ctx: ActionCtx,
  credential: Credential,
  bucket: Bucket,
): Promise<{ headers: Record<string, string>; limited: Response | null }> {
  if (bucket === null) return { headers: {}, limited: null }
  const result = await ctx.runMutation(internal.apiV1.consumeRateLimit, {
    subject: credential.subject,
    bucket,
    limit: RATE_LIMIT,
  })
  const headers = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.reset),
  }
  if (!result.allowed) {
    return {
      headers,
      limited: errorResponse(
        "Too many requests. Retry after the window resets.",
        429,
        "TooManyRequestsError",
        { ...headers, "Retry-After": String(result.retryAfter) },
      ),
    }
  }
  return { headers, limited: null }
}

// ——— Request parsing ——————————————————————————————————————————————————————

function readPaging(
  url: URL,
  body: Record<string, unknown> | null,
): { page: number; pageSize: number } | { error: string } {
  const raw = (...names: Array<string>) => {
    for (const name of names) {
      const fromQuery = url.searchParams.get(name)
      if (fromQuery !== null) return fromQuery
      const fromBody = body?.[name]
      if (fromBody !== undefined && fromBody !== null) return String(fromBody)
    }
    return null
  }
  const rawPage = raw("page")
  const rawPageSize = raw("pageSize", "page_size")

  let page = 1
  if (rawPage !== null) {
    const parsed = Number(rawPage)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1)
      return { error: "`page` must be an integer >= 1." }
    page = parsed
  }
  let pageSize = DEFAULT_PAGE_SIZE
  if (rawPageSize !== null) {
    const parsed = Number(rawPageSize)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1)
      return { error: "`pageSize` must be an integer >= 1." }
    pageSize = Math.min(parsed, MAX_PAGE_SIZE)
  }
  return { page, pageSize }
}

async function readJsonBody(
  req: Request,
): Promise<Record<string, unknown> | null> {
  const type = req.headers.get("Content-Type") ?? ""
  if (!type.includes("application/json")) return null
  try {
    const parsed: unknown = await req.json()
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** ISO-8601 or epoch-ms, both accepted anywhere a time is taken. */
function readTime(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber) && value.trim() !== "") return asNumber
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

function readBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function expandList(
  url: URL,
  body: Record<string, unknown> | null,
): Array<string> {
  const out = new Set<string>()
  for (const value of url.searchParams.getAll("expand"))
    for (const part of value.split(",")) if (part.trim()) out.add(part.trim())
  const fromBody = body?.expand
  if (Array.isArray(fromBody))
    for (const part of fromBody) if (typeof part === "string") out.add(part)
  else if (typeof fromBody === "string") out.add(fromBody)
  return [...out]
}

/** Builds the session filter object from query params and/or a search body. */
function readSessionFilters(
  url: URL,
  body: Record<string, unknown> | null,
): Record<string, unknown> {
  const bodyFilters =
    body?.filters && typeof body.filters === "object"
      ? (body.filters as Record<string, unknown>)
      : {}
  const pick = (queryName: string, bodyName: string): unknown => {
    const fromQuery = url.searchParams.get(queryName)
    if (fromQuery !== null) return fromQuery
    return bodyFilters[bodyName]
  }
  const created =
    (bodyFilters.createdAt as Record<string, unknown> | undefined) ?? {}
  const updated =
    (bodyFilters.updatedAt as Record<string, unknown> | undefined) ?? {}

  const filters: Record<string, unknown> = {}
  const status = pick("status", "status")
  if (typeof status === "string" && status) filters.status = status
  const isAbstract = readBool(pick("is_abstract", "isAbstract"))
  if (isAbstract !== undefined) filters.isAbstract = isAbstract
  const trackId = pick("track_id", "trackId")
  if (typeof trackId === "string" && trackId) filters.trackId = trackId
  const tagId = pick("tag_id", "tagId")
  if (typeof tagId === "string" && tagId) filters.tagId = tagId
  const search = pick("search", "search")
  if (typeof search === "string" && search) filters.search = search
  const includeDeleted = readBool(pick("include_deleted", "includeDeleted"))
  if (includeDeleted !== undefined) filters.includeDeleted = includeDeleted

  const createdBefore = readTime(created.before)
  if (createdBefore !== undefined) filters.createdBefore = createdBefore
  const createdAfter = readTime(created.after)
  if (createdAfter !== undefined) filters.createdAfter = createdAfter
  const updatedBefore = readTime(updated.before)
  if (updatedBefore !== undefined) filters.updatedBefore = updatedBefore
  const updatedAfter = readTime(updated.after)
  if (updatedAfter !== undefined) filters.updatedAfter = updatedAfter
  return filters
}

function readSort(
  url: URL,
  body: Record<string, unknown> | null,
): { sortBy?: string; sortDir?: string } {
  const sort =
    body?.sort && typeof body.sort === "object"
      ? (body.sort as Record<string, unknown>)
      : {}
  const sortBy = str(sort.order) ?? url.searchParams.get("order") ?? undefined
  const sortDir = str(sort.sort) ?? url.searchParams.get("sort") ?? undefined
  return { sortBy: sortBy ?? undefined, sortDir: sortDir ?? undefined }
}

/** Session write payloads accept both snake_case (theirs) and camelCase. */
function readSessionInput(body: Record<string, unknown>): Record<string, unknown> {
  const get = (...names: Array<string>): unknown => {
    for (const name of names)
      if (body[name] !== undefined) return body[name]
    return undefined
  }
  const input: Record<string, unknown> = {}
  const title = str(get("title"))
  if (title !== undefined) input.title = title
  const description = str(get("description"))
  if (description !== undefined) input.description = description
  const status = str(get("status"))
  if (status !== undefined) input.status = status
  const isAbstract = readBool(get("is_abstract", "isAbstract"))
  if (isAbstract !== undefined) input.is_abstract = isAbstract
  const startsAt = readTime(get("starts_at", "startsAt", "startTime"))
  if (startsAt !== undefined) input.starts_at = startsAt
  const endsAt = readTime(get("ends_at", "endsAt", "endTime"))
  if (endsAt !== undefined) input.ends_at = endsAt
  const duration = get("duration_minutes", "durationMinutes")
  if (typeof duration === "number") input.duration_minutes = duration
  const roomId = get("room_id", "roomId")
  if (typeof roomId === "string") input.room_id = roomId
  const trackId = get("track_id", "trackId")
  if (typeof trackId === "string") input.track_id = trackId
  const format = str(get("format"))
  if (format !== undefined) input.format = format
  const level = str(get("level"))
  if (level !== undefined) input.level = level
  const language = str(get("language"))
  if (language !== undefined) input.language = language
  const tags = get("tags", "tag_ids", "tagIds")
  if (Array.isArray(tags))
    input.tags = tags.filter((t): t is string => typeof t === "string")
  const custom = get("custom_fields", "customFields", "answers")
  if (custom && typeof custom === "object") input.custom_fields = custom
  const submitterEmail = str(get("submitter_email", "submitterEmail"))
  if (submitterEmail !== undefined) input.submitter_email = submitterEmail
  const submitterFirst = str(get("submitter_first_name"))
  if (submitterFirst !== undefined) input.submitter_first_name = submitterFirst
  const submitterLast = str(get("submitter_last_name"))
  if (submitterLast !== undefined) input.submitter_last_name = submitterLast
  const speakerIds = get("speaker_ids", "speakerIds")
  if (Array.isArray(speakerIds))
    input.speaker_ids = speakerIds.filter(
      (s): s is string => typeof s === "string",
    )
  return input
}

// ——— Error mapping ————————————————————————————————————————————————————————

/**
 * Product errors are thrown as plain Errors with organizer-readable messages
 * (see convex/lib/auth.ts). Map them onto status codes without ever inventing
 * a new message — the message IS the API's error copy.
 */
function mapThrown(e: unknown): Response {
  const raw = e instanceof Error ? e.message : String(e)
  // Convex prefixes uncaught errors; keep only what we wrote.
  const message = raw.replace(/^\[.*?\]\s*/, "").split("\n")[0].trim()
  const lower = message.toLowerCase()
  if (lower.includes("don't have access") || lower.includes("requires the"))
    return errorResponse(message, 403)
  if (lower.includes("not found")) return errorResponse(message, 404)
  return errorResponse(message || "Request failed.", 400)
}

// ——— Settings resources ——————————————————————————————————————————————————

// Sourced from the route manifest so the dispatcher, the 404 hint and the
// generated OpenAPI spec can never disagree about which resources exist.
const SETTINGS_RESOURCES = new Set<string>(SETTINGS_READ_RESOURCES)
const METADATA_RESOURCES = new Set<string>(METADATA_WRITE_RESOURCES)

function normalizeResource(resource: string): string {
  return resource === "session-statuses" ? "statuses" : resource
}

/**
 * A 404 that actually helps: the closest routes from the manifest, so a
 * mistyped path answers with the real ones instead of a dead end.
 */
function unknownEndpoint(method: string, url: URL): Response {
  const segments = url.pathname.split("/").filter(Boolean)
  const score = (path: string) => {
    const parts = path.split("/").filter(Boolean)
    let shared = 0
    for (let i = 0; i < Math.min(parts.length, segments.length); i++) {
      if (parts[i] === segments[i] || parts[i].startsWith("{")) shared++
      else break
    }
    return shared
  }
  const nearest = API_ROUTES.slice()
    .sort((a, b) => score(b.path) - score(a.path))
    .slice(0, 6)
    .map((route) => `${route.method} ${route.path}`)
  return errorResponse(
    `Unknown endpoint ${method} ${url.pathname}. Did you mean: ${nearest.join(", ")}? Full reference at /docs/api.`,
    404,
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Dispatcher
// ══════════════════════════════════════════════════════════════════════════

export const handleApiRequest = httpAction(async (ctx, req) => {
  const url = new URL(req.url)
  const method = req.method.toUpperCase()
  const segments = url.pathname
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => decodeURIComponent(part))

  // segments[0] === "v1" (the route prefix guarantees it).
  const rest = segments.slice(1)
  if (rest.length === 0)
    return errorResponse(
      "Trackstage API v1. See /docs/api for the full reference.",
      404,
    )

  // ——— Open endpoints (no credential) ———

  // The calendar feed is meant to be subscribed to by calendar clients that
  // cannot present a header. Unchanged from before parity.
  if (rest[0] === "event" && rest.length === 3 && rest[2] === "schedule.ics") {
    if (method !== "GET")
      return errorResponse("Only GET is supported here.", 405)
    const feed = await ctx.runQuery(internal.publicData.icsFeed, {
      slug: rest[1],
    })
    if (feed === null) return errorResponse(`No event with slug "${rest[1]}".`, 404)
    const body = buildCalendar(feed.event.name, feed.event.slug, feed.events, Date.now())
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${rest[1] || "schedule"}.ics"`,
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    })
  }

  // Signature-verifying sink. Used by the backend suite to prove a delivery
  // arrived AND that its HMAC is correct: it only answers 200 when the
  // signature over the exact body verifies against the secret in the query.
  if (rest[0] === "_echo") {
    if (method !== "POST")
      return errorResponse("Only POST is supported here.", 405)
    const secret = url.searchParams.get("secret") ?? ""
    const body = await req.text()
    const header = req.headers.get("Trackstage-Signature") ?? ""
    const parsed = /t=(\d+),v1=([0-9a-f]+)/.exec(header)
    if (!secret) return jsonResponse({ received: true, verified: null })
    if (!parsed)
      return errorResponse("Missing or malformed Trackstage-Signature.", 401)
    const expected = await signPayload(secret, Number(parsed[1]), body)
    if (expected !== parsed[2])
      return errorResponse("Signature does not verify.", 401)
    return jsonResponse({
      received: true,
      verified: true,
      event: req.headers.get("Trackstage-Event"),
      delivery: req.headers.get("Trackstage-Delivery"),
    })
  }

  // ——— Everything else needs a credential ———

  const credential = await authenticate(ctx, req)
  if (!credential)
    return errorResponse(
      "Missing or invalid API token. Send `x-access-token: <token>` or `Authorization: Bearer <token>`.",
      401,
    )

  // POST is overloaded for search on this API, so "write" is decided per route
  // rather than per method; the guard below is only about the demo token.
  const denyDemoWrite = (): Response | null =>
    credential.userId === null
      ? errorResponse(
          "The public demo token is read-only. Create a personal API key in Settings → API & MCP to write.",
          403,
        )
      : null

  try {
    // ——— GET /v1/events ———
    if (rest[0] === "events" && rest.length === 1) {
      if (method !== "GET") return errorResponse("Only GET is supported here.", 405)
      if (!hasScope(credential, "read:events"))
        return errorResponse("This token lacks the `read:events` scope.", 403)
      const paging = readPaging(url, null)
      if ("error" in paging) return errorResponse(paging.error, 400)
      const result = await ctx.runQuery(internal.apiV1.listEvents, {
        userId: credential.userId,
        page: paging.page,
        pageSize: paging.pageSize,
      })
      return jsonResponse(result)
    }

    // ——— /v1/webhooks… ———
    if (rest[0] === "webhooks") {
      return await handleWebhooks(ctx, req, url, method, rest, credential, denyDemoWrite)
    }

    // ——— /v1/event/{ref}/… ———
    if (rest[0] === "event" && rest.length >= 3) {
      return await handleEventScoped(
        ctx,
        req,
        url,
        method,
        rest,
        credential,
        denyDemoWrite,
      )
    }

    return unknownEndpoint(method, url)
  } catch (e) {
    return mapThrown(e)
  }
})

// ——— Webhook management ————————————————————————————————————————————————

async function handleWebhooks(
  ctx: ActionCtx,
  req: Request,
  url: URL,
  method: string,
  rest: Array<string>,
  credential: Credential,
  denyDemoWrite: () => Response | null,
): Promise<Response> {
  if (credential.userId === null && method !== "GET") {
    const denied = denyDemoWrite()
    if (denied) return denied
  }
  if (credential.userId === null)
    return errorResponse(
      "Webhook endpoints belong to a workspace — authenticate with a personal API key.",
      403,
    )
  const userId = credential.userId
  const body = (await readJsonBody(req)) ?? {}

  // /v1/webhooks
  if (rest.length === 1) {
    if (method === "GET") {
      if (!hasScope(credential, "read:events"))
        return errorResponse("This token lacks the `read:events` scope.", 403)
      const eventRef = url.searchParams.get("event") ?? undefined
      const result = await ctx.runQuery(internal.apiV1.listWebhooks, {
        userId,
        eventRef,
      })
      if (result === null) return errorResponse("Event not found.", 404)
      return jsonResponse(result)
    }
    if (method === "POST") {
      if (!hasScope(credential, "write:events"))
        return errorResponse("This token lacks the `write:events` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "event_writes")
      if (gate.limited) return gate.limited
      const events = Array.isArray(body.events)
        ? body.events.filter((e): e is string => typeof e === "string")
        : undefined
      const result = await ctx.runMutation(internal.apiV1.writeWebhook, {
        userId,
        action: "create",
        url: str(body.url),
        events,
        description: str(body.description),
        enabled: readBool(body.enabled),
        eventRef: str(body.event) ?? str(body.event_id),
      })
      if (result.notFound) return errorResponse("Event not found.", 404)
      return jsonResponse(result, 201, gate.headers)
    }
    return errorResponse("Only GET and POST are supported here.", 405)
  }

  const webhookId = rest[1]

  // /v1/webhooks/{id}/deliveries
  if (rest.length === 3 && rest[2] === "deliveries") {
    if (method !== "GET") return errorResponse("Only GET is supported here.", 405)
    const limit = Number(url.searchParams.get("limit") ?? 25)
    const result = await ctx.runQuery(internal.apiV1.webhookDeliveries, {
      userId,
      webhookId,
      limit: Number.isFinite(limit) ? limit : 25,
    })
    if (result.notFound) return errorResponse("Webhook not found.", 404)
    return jsonResponse(result)
  }

  // /v1/webhooks/{id}/{test|rotate}
  if (rest.length === 3 && (rest[2] === "test" || rest[2] === "rotate")) {
    if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
    if (!hasScope(credential, "write:events"))
      return errorResponse("This token lacks the `write:events` scope.", 403)
    const gate = await enforceRateLimit(ctx, credential, "event_writes")
    if (gate.limited) return gate.limited
    const result = await ctx.runMutation(internal.apiV1.writeWebhook, {
      userId,
      action: rest[2],
      webhookId,
    })
    if (result.notFound) return errorResponse("Webhook not found.", 404)
    return jsonResponse(result, 200, gate.headers)
  }

  // /v1/webhooks/{id}
  if (rest.length === 2) {
    if (method === "GET") {
      const result = await ctx.runQuery(internal.apiV1.getWebhook, {
        userId,
        webhookId,
      })
      if (result.notFound) return errorResponse("Webhook not found.", 404)
      return jsonResponse(result)
    }
    if (method === "PUT" || method === "DELETE") {
      if (!hasScope(credential, "write:events"))
        return errorResponse("This token lacks the `write:events` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "event_writes")
      if (gate.limited) return gate.limited
      const events = Array.isArray(body.events)
        ? body.events.filter((e): e is string => typeof e === "string")
        : undefined
      const result = await ctx.runMutation(internal.apiV1.writeWebhook, {
        userId,
        action: method === "DELETE" ? "delete" : "update",
        webhookId,
        url: str(body.url),
        events,
        description: str(body.description),
        enabled: readBool(body.enabled),
      })
      if (result.notFound) return errorResponse("Webhook not found.", 404)
      if (method === "DELETE")
        return new Response(null, { status: 204, headers: CORS_HEADERS })
      return jsonResponse(result, 200, gate.headers)
    }
    return errorResponse("Only GET, PUT and DELETE are supported here.", 405)
  }

  return errorResponse(`Unknown webhook endpoint ${method} ${url.pathname}.`, 404)
}

// ——— Event-scoped routes ——————————————————————————————————————————————

async function handleEventScoped(
  ctx: ActionCtx,
  req: Request,
  url: URL,
  method: string,
  rest: Array<string>,
  credential: Credential,
  denyDemoWrite: () => Response | null,
): Promise<Response> {
  const eventRef = rest[1]
  const resource = rest[2]
  const tail = rest.slice(3)

  // Session files need the raw request (multipart / arbitrary bytes), so they
  // are routed before the JSON body is consumed.
  if (resource === "sessions" && tail.length >= 2 && tail[1] === "files") {
    return await handleSessionFiles(
      ctx,
      req,
      url,
      method,
      eventRef,
      tail[0],
      tail.slice(2),
      credential,
      denyDemoWrite,
    )
  }

  const body = (await readJsonBody(req)) ?? {}
  const paging = readPaging(url, body)
  if ("error" in paging) return errorResponse(paging.error, 400)

  // ——— Sessions ———
  if (resource === "sessions") {
    // POST /sessions  (search) · GET /sessions (list)
    if (tail.length === 0) {
      if (method === "GET" || method === "POST") {
        if (!hasScope(credential, "read:sessions"))
          return errorResponse("This token lacks the `read:sessions` scope.", 403)
        const filters = readSessionFilters(url, method === "POST" ? body : null)
        // The pre-parity GET returned the published programme. Keep that as
        // the default so existing consumers see exactly what they always saw;
        // any explicit filter opts into the full pipeline.
        if (method === "GET" && Object.keys(filters).length === 0)
          filters.status = "accepted"
        const sort = readSort(url, method === "POST" ? body : null)
        const result = await ctx.runQuery(internal.apiV1.searchSessions, {
          eventRef,
          userId: credential.userId,
          filters,
          sortBy: sort.sortBy,
          sortDir: sort.sortDir,
          expand: expandList(url, method === "POST" ? body : null),
          page: paging.page,
          pageSize: paging.pageSize,
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        return jsonResponse(result)
      }
      return errorResponse("Only GET and POST are supported here.", 405)
    }

    // POST /sessions/create
    if (tail.length === 1 && tail[0] === "create") {
      if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:sessions"))
        return errorResponse("This token lacks the `write:sessions` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "session_writes")
      if (gate.limited) return gate.limited
      const result = await ctx.runMutation(internal.apiV1.createSession, {
        eventRef,
        userId: credential.userId as string,
        input: readSessionInput(body),
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      await auditApiWrite(ctx, credential, {
        eventRef,
        method: "POST /sessions/create",
        entity: "session",
        entityId: String((result as { id?: string }).id ?? ""),
        action: "created",
        summary: `Session created via the API · ${String((result as { name?: string; title?: string }).name ?? (result as { title?: string }).title ?? "untitled")}`,
      })
      return jsonResponse(result, 201, gate.headers)
    }

    // POST /sessions/status  (lightweight status search)
    if (tail.length === 1 && tail[0] === "status") {
      if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
      if (!hasScope(credential, "read:sessions"))
        return errorResponse("This token lacks the `read:sessions` scope.", 403)
      const result = await ctx.runQuery(internal.apiV1.sessionStatuses, {
        eventRef,
        userId: credential.userId,
        filters: readSessionFilters(url, body),
        page: paging.page,
        pageSize: paging.pageSize,
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      return jsonResponse(result)
    }

    // POST /sessions/bulk
    if (tail.length === 1 && tail[0] === "bulk") {
      if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:sessions"))
        return errorResponse("This token lacks the `write:sessions` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "session_writes")
      if (gate.limited) return gate.limited
      const raw = Array.isArray(body.operations) ? body.operations : null
      if (!raw)
        return errorResponse("`operations` must be an array of operations.", 400)
      const operations = raw.map((op) => {
        const record = (op ?? {}) as Record<string, unknown>
        return {
          action: String(record.action ?? ""),
          id: str(record.id),
          data:
            record.data && typeof record.data === "object"
              ? readSessionInput(record.data as Record<string, unknown>)
              : undefined,
        }
      })
      const result = await ctx.runMutation(internal.apiV1.bulkSessions, {
        eventRef,
        userId: credential.userId as string,
        operations,
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      return jsonResponse(result, 200, gate.headers)
    }

    const sessionId = tail[0]

    // GET/PUT/DELETE /sessions/{id}
    if (tail.length === 1) {
      if (method === "GET") {
        if (!hasScope(credential, "read:sessions"))
          return errorResponse("This token lacks the `read:sessions` scope.", 403)
        const gate = await enforceRateLimit(ctx, credential, "entity_reads")
        if (gate.limited) return gate.limited
        const result = await ctx.runQuery(internal.apiV1.getSession, {
          eventRef,
          userId: credential.userId,
          sessionId,
          expand: expandList(url, null),
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        if (result.notFound) return errorResponse("Session not found.", 404)
        return jsonResponse(result, 200, gate.headers)
      }
      if (method === "PUT" || method === "DELETE") {
        const denied = denyDemoWrite()
        if (denied) return denied
        if (!hasScope(credential, "write:sessions"))
          return errorResponse("This token lacks the `write:sessions` scope.", 403)
        const gate = await enforceRateLimit(ctx, credential, "session_writes")
        if (gate.limited) return gate.limited
        if (method === "DELETE") {
          const result = await ctx.runMutation(internal.apiV1.deleteSession, {
            eventRef,
            userId: credential.userId as string,
            sessionId,
            restore: false,
          })
          if (result === null)
            return errorResponse(`No event with slug "${eventRef}".`, 404)
          if (result.notFound) return errorResponse("Session not found.", 404)
          await auditApiWrite(ctx, credential, {
            eventRef,
            method: "DELETE /sessions/{id}",
            entity: "session",
            entityId: sessionId,
            action: "deleted",
            summary: "Session deleted via the API (recoverable from Trash)",
          })
          return new Response(null, {
            status: 204,
            headers: { ...CORS_HEADERS, ...gate.headers },
          })
        }
        const result = await ctx.runMutation(internal.apiV1.updateSession, {
          eventRef,
          userId: credential.userId as string,
          sessionId,
          input: readSessionInput(body),
          expectedUpdatedAt: readTime(body.updated_at ?? body.updatedAt),
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        if (result.notFound) return errorResponse("Session not found.", 404)
        if (result.conflict)
          return errorResponse(
            `This session changed since you fetched it (now ${result.updated_at}). Re-fetch and retry.`,
            409,
          )
        await auditApiWrite(ctx, credential, {
          eventRef,
          method: "PUT /sessions/{id}",
          entity: "session",
          entityId: sessionId,
          action: "updated",
          summary: "Session updated via the API",
        })
        return jsonResponse(result, 200, gate.headers)
      }
      return errorResponse("Only GET, PUT and DELETE are supported here.", 405)
    }

    // POST /sessions/{id}/restore
    if (tail.length === 2 && tail[1] === "restore") {
      if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:sessions"))
        return errorResponse("This token lacks the `write:sessions` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "session_writes")
      if (gate.limited) return gate.limited
      const result = await ctx.runMutation(internal.apiV1.deleteSession, {
        eventRef,
        userId: credential.userId as string,
        sessionId,
        restore: true,
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      if (result.notFound) return errorResponse("Session not found.", 404)
      await auditApiWrite(ctx, credential, {
        eventRef,
        method: "POST /sessions/{id}/restore",
        entity: "session",
        entityId: sessionId,
        action: "restored",
        summary: "Session restored from Trash via the API",
      })
      return jsonResponse(result, 200, gate.headers)
    }

    // PUT /sessions/{id}/fields
    if (tail.length === 2 && tail[1] === "fields") {
      if (method !== "PUT") return errorResponse("Only PUT is supported here.", 405)
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:sessions"))
        return errorResponse("This token lacks the `write:sessions` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "session_writes")
      if (gate.limited) return gate.limited
      const custom = body.custom_fields ?? body.customFields ?? body.answers
      if (!custom || typeof custom !== "object")
        return errorResponse(
          "`custom_fields` must be an object of field values keyed by field name.",
          400,
        )
      const result = await ctx.runMutation(internal.apiV1.updateSession, {
        eventRef,
        userId: credential.userId as string,
        sessionId,
        input: { custom_fields: custom },
        fieldsOnly: true,
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      if (result.notFound) return errorResponse("Session not found.", 404)
      await auditApiWrite(ctx, credential, {
        eventRef,
        method: "PUT /sessions/{id}/fields",
        entity: "session",
        entityId: sessionId,
        action: "updated",
        summary: `Custom fields updated via the API (${Object.keys(custom as Record<string, unknown>).join(", ")})`,
      })
      return jsonResponse(result, 200, gate.headers)
    }

    return errorResponse(`Unknown session endpoint ${method} ${url.pathname}.`, 404)
  }

  // ——— Speakers ———
  if (resource === "speakers") {
    if (tail.length === 0) {
      if (method === "GET" || method === "POST") {
        if (!hasScope(credential, "read:contacts"))
          return errorResponse("This token lacks the `read:contacts` scope.", 403)
        const sort = readSort(url, method === "POST" ? body : null)
        const filters =
          body.filters && typeof body.filters === "object"
            ? (body.filters as Record<string, unknown>)
            : {}
        const result = await ctx.runQuery(internal.apiV1.searchSpeakers, {
          eventRef,
          userId: credential.userId,
          search: url.searchParams.get("search") ?? str(filters.search),
          workflowStatus:
            url.searchParams.get("workflow_status") ??
            str(filters.workflowStatus),
          sortDir: sort.sortDir,
          page: paging.page,
          pageSize: paging.pageSize,
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        return jsonResponse(result)
      }
      return errorResponse("Only GET and POST are supported here.", 405)
    }

    if (tail.length === 1 && tail[0] === "create") {
      if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:contacts"))
        return errorResponse("This token lacks the `write:contacts` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "session_writes")
      if (gate.limited) return gate.limited
      const result = await ctx.runMutation(internal.apiV1.writeSpeaker, {
        eventRef,
        userId: credential.userId as string,
        input: readSpeakerInput(body),
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      await auditApiWrite(ctx, credential, {
        eventRef,
        method: "POST /speakers",
        entity: "speaker",
        entityId: String((result as { id?: string }).id ?? ""),
        action: "created",
        summary: `Speaker created via the API · ${String((result as { email?: string }).email ?? "")}`,
      })
      return jsonResponse(result, 201, gate.headers)
    }

    if (tail.length === 1) {
      if (method === "GET") {
        if (!hasScope(credential, "read:contacts"))
          return errorResponse("This token lacks the `read:contacts` scope.", 403)
        const gate = await enforceRateLimit(ctx, credential, "entity_reads")
        if (gate.limited) return gate.limited
        const result = await ctx.runQuery(internal.apiV1.getSpeaker, {
          eventRef,
          userId: credential.userId,
          personId: tail[0],
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        if (result.notFound) return errorResponse("Speaker not found.", 404)
        return jsonResponse(result, 200, gate.headers)
      }
      if (method === "PUT") {
        const denied = denyDemoWrite()
        if (denied) return denied
        if (!hasScope(credential, "write:contacts"))
          return errorResponse("This token lacks the `write:contacts` scope.", 403)
        const gate = await enforceRateLimit(ctx, credential, "session_writes")
        if (gate.limited) return gate.limited
        const result = await ctx.runMutation(internal.apiV1.writeSpeaker, {
          eventRef,
          userId: credential.userId as string,
          personId: tail[0],
          input: readSpeakerInput(body),
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        if (result.notFound) return errorResponse("Speaker not found.", 404)
        await auditApiWrite(ctx, credential, {
          eventRef,
          method: "PUT /speakers/{id}",
          entity: "speaker",
          entityId: tail[0],
          action: "updated",
          summary: "Speaker updated via the API",
        })
        return jsonResponse(result, 200, gate.headers)
      }
      return errorResponse("Only GET and PUT are supported here.", 405)
    }
  }

  // ——— Submissions (our name for abstracts; predates parity) ———
  if (resource === "submissions" && tail.length === 0) {
    if (method !== "GET") return errorResponse("Only GET is supported here.", 405)
    if (!hasScope(credential, "read:sessions"))
      return errorResponse("This token lacks the `read:sessions` scope.", 403)
    const result = await ctx.runQuery(internal.publicData.apiSubmissionsPage, {
      slug: eventRef,
      page: paging.page,
      pageSize: paging.pageSize,
    })
    if (result === null)
      return errorResponse(`No event with slug "${eventRef}".`, 404)
    // `results` mirrors `data` so the envelope matches every other endpoint.
    return jsonResponse({ ...result, results: result.data })
  }

  // ——— Agenda ———
  if (resource === "agenda") {
    if (tail.length === 0) {
      if (method !== "GET") return errorResponse("Only GET is supported here.", 405)
      if (!hasScope(credential, "read:events"))
        return errorResponse("This token lacks the `read:events` scope.", 403)
      const result = await ctx.runQuery(internal.apiV1.agendaSnapshot, {
        eventRef,
        userId: credential.userId,
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      return jsonResponse({ data: result })
    }
    if (tail.length === 1 && (tail[0] === "publish" || tail[0] === "unpublish")) {
      if (method !== "POST") return errorResponse("Only POST is supported here.", 405)
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:events"))
        return errorResponse("This token lacks the `write:events` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "event_writes")
      if (gate.limited) return gate.limited
      const result = await ctx.runMutation(internal.apiV1.setAgendaPublished, {
        eventRef,
        userId: credential.userId as string,
        published: tail[0] === "publish",
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      await auditApiWrite(ctx, credential, {
        eventRef,
        method: `POST /agenda/${tail[0]}`,
        entity: "agenda",
        action: tail[0] === "publish" ? "published" : "unpublished",
        summary: `Agenda ${tail[0] === "publish" ? "published" : "unpublished"} via the API`,
      })
      return jsonResponse(result, 200, gate.headers)
    }
  }

  // ——— Event settings + metadata writes ———
  if (SETTINGS_RESOURCES.has(resource)) {
    const normalized = normalizeResource(resource)

    // GET /{resource}  ·  POST /{resource} (search)
    if (tail.length === 0 && (method === "GET" || method === "POST")) {
      const scope = normalized === "fields" ? "read:events" : "read:events"
      if (!hasScope(credential, scope))
        return errorResponse(`This token lacks the \`${scope}\` scope.`, 403)
      const gate = await enforceRateLimit(ctx, credential, "entity_reads")
      if (gate.limited) return gate.limited
      const filters =
        body.filters && typeof body.filters === "object"
          ? (body.filters as Record<string, unknown>)
          : {}
      const result = await ctx.runQuery(internal.apiV1.listSettings, {
        eventRef,
        userId: credential.userId,
        resource: normalized,
        search: url.searchParams.get("search") ?? str(filters.search),
        page: paging.page,
        pageSize: paging.pageSize,
      })
      if (result === null)
        return errorResponse(`No event with slug "${eventRef}".`, 404)
      if (result.unknownResource)
        return errorResponse(`Unknown resource "${resource}".`, 404)
      return jsonResponse(result, 200, gate.headers)
    }

    // Field (custom-field definition) writes.
    if (normalized === "fields") {
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:fields"))
        return errorResponse("This token lacks the `write:fields` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "field_writes")
      if (gate.limited) return gate.limited
      if (tail.length === 1 && tail[0] === "create" && method === "POST") {
        const result = await ctx.runMutation(internal.apiV1.writeField, {
          eventRef,
          userId: credential.userId as string,
          action: "create",
          formId: str(body.form_id) ?? str(body.module_id),
          label: str(body.label) ?? str(body.name) ?? str(body.public_name),
          type: str(body.type) ?? str(body.field_type),
          required: readBool(body.required),
          enabled: readBool(body.enabled),
          help: str(body.help),
          options: Array.isArray(body.options)
            ? body.options.filter((o): o is string => typeof o === "string")
            : undefined,
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        return jsonResponse(result, 201, gate.headers)
      }
      if (tail.length === 1 && (method === "PUT" || method === "DELETE")) {
        const result = await ctx.runMutation(internal.apiV1.writeField, {
          eventRef,
          userId: credential.userId as string,
          action: method === "DELETE" ? "delete" : "update",
          fieldId: tail[0],
          label: str(body.label) ?? str(body.name) ?? str(body.public_name),
          type: str(body.type) ?? str(body.field_type),
          required: readBool(body.required),
          enabled: readBool(body.enabled),
          help: str(body.help),
          options: Array.isArray(body.options)
            ? body.options.filter((o): o is string => typeof o === "string")
            : undefined,
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        if (result.notFound) return errorResponse("Field not found.", 404)
        if (method === "DELETE")
          return new Response(null, {
            status: 204,
            headers: { ...CORS_HEADERS, ...gate.headers },
          })
        return jsonResponse(result, 200, gate.headers)
      }
    }

    // Metadata writes (rooms, tracks, and the form-backed value lists).
    if (METADATA_RESOURCES.has(normalized)) {
      const denied = denyDemoWrite()
      if (denied) return denied
      if (!hasScope(credential, "write:metadata"))
        return errorResponse("This token lacks the `write:metadata` scope.", 403)
      const gate = await enforceRateLimit(ctx, credential, "metadata_writes")
      if (gate.limited) return gate.limited

      const isCreate = tail.length === 1 && tail[0] === "create" && method === "POST"
      const isMutate =
        tail.length === 1 && (method === "PUT" || method === "DELETE")
      if (isCreate || isMutate) {
        const result = await ctx.runMutation(internal.apiV1.writeMetadata, {
          eventRef,
          userId: credential.userId as string,
          resource: normalized,
          action: isCreate ? "create" : method === "DELETE" ? "delete" : "update",
          id: isCreate ? undefined : tail[0],
          name: str(body.name),
          color: str(body.color),
          capacity:
            typeof body.capacity === "number" ? body.capacity : undefined,
          order: typeof body.order === "number" ? body.order : undefined,
        })
        if (result === null)
          return errorResponse(`No event with slug "${eventRef}".`, 404)
        if (result.unknownResource)
          return errorResponse(`Unknown resource "${resource}".`, 404)
        if (result.notFound)
          return errorResponse(`No ${normalized.replace(/s$/, "")} with that id.`, 404)
        if (method === "DELETE")
          return new Response(null, {
            status: 204,
            headers: { ...CORS_HEADERS, ...gate.headers },
          })
        return jsonResponse(result, isCreate ? 201 : 200, gate.headers)
      }
    }

    return errorResponse(`Unknown endpoint ${method} ${url.pathname}.`, 404)
  }

  return errorResponse(
    `Unknown resource "${resource}". Supported: sessions, speakers, submissions, agenda, fields, tags, tracks, rooms, formats, levels, languages, statuses, schedule.ics.`,
    404,
  )
}

function readSpeakerInput(body: Record<string, unknown>): Record<string, unknown> {
  const get = (...names: Array<string>): unknown => {
    for (const name of names) if (body[name] !== undefined) return body[name]
    return undefined
  }
  const input: Record<string, unknown> = {}
  const map: Array<[string, Array<string>]> = [
    ["email", ["email"]],
    ["first_name", ["first_name", "firstName"]],
    ["last_name", ["last_name", "lastName"]],
    ["title", ["title", "jobTitle", "job_title"]],
    ["company_name", ["company_name", "company", "companyName"]],
    ["about", ["about", "bio"]],
    ["phone_mobile", ["phone_mobile", "phone"]],
    ["pronouns", ["pronouns"]],
    ["salutation", ["salutation"]],
    ["website_url", ["website_url", "website"]],
    ["linkedin_url", ["linkedin_url", "linkedin"]],
    ["twitter_url", ["twitter_url", "twitter"]],
    ["workflow_status", ["workflow_status", "workflowStatus"]],
  ]
  for (const [target, sources] of map) {
    const value = str(get(...sources))
    if (value !== undefined) input[target] = value
  }
  return input
}

// ——— Session files ————————————————————————————————————————————————————————

async function handleSessionFiles(
  ctx: ActionCtx,
  req: Request,
  url: URL,
  method: string,
  eventRef: string,
  sessionId: string,
  tail: Array<string>,
  credential: Credential,
  denyDemoWrite: () => Response | null,
): Promise<Response> {
  // GET …/files
  if (tail.length === 0 && method === "GET") {
    if (!hasScope(credential, "read:sessions"))
      return errorResponse("This token lacks the `read:sessions` scope.", 403)
    const gate = await enforceRateLimit(ctx, credential, "entity_reads")
    if (gate.limited) return gate.limited
    const result = await ctx.runQuery(internal.apiV1.listSessionFiles, {
      eventRef,
      userId: credential.userId,
      sessionId,
    })
    if (result === null)
      return errorResponse(`No event with slug "${eventRef}".`, 404)
    if (result.notFound) return errorResponse("Session not found.", 404)
    return jsonResponse(result, 200, gate.headers)
  }

  // PUT …/files/{id}/bytes is the sink our two-phase upload URL points at.
  // It must run before the write-scope block below reads a JSON body.
  if (tail.length === 2 && tail[1] === "bytes" && method === "PUT") {
    const denied = denyDemoWrite()
    if (denied) return denied
    if (!hasScope(credential, "write:sessions"))
      return errorResponse("This token lacks the `write:sessions` scope.", 403)
    const blob = await req.blob()
    if (blob.size === 0) return errorResponse("Empty request body.", 400)
    const storageId = await ctx.storage.store(blob)
    const bound = await ctx.runMutation(internal.apiV1.bindUploadIntentBytes, {
      intentId: tail[0],
      storageId,
      size: blob.size,
    })
    if (bound.notFound) {
      await ctx.storage.delete(storageId)
      return errorResponse("Upload not found (it may have expired).", 404)
    }
    return jsonResponse({ data: { id: tail[0], size: blob.size, received: true } })
  }

  const denied = denyDemoWrite()
  if (denied) return denied
  if (!hasScope(credential, "write:sessions"))
    return errorResponse("This token lacks the `write:sessions` scope.", 403)
  const gate = await enforceRateLimit(ctx, credential, "session_writes")
  if (gate.limited) return gate.limited
  const userId = credential.userId as string

  // POST …/files/upload — one multipart call, up to the simple-upload ceiling.
  if (tail.length === 1 && tail[0] === "upload" && method === "POST") {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return errorResponse(
        "Expected a multipart/form-data body with a `file` part.",
        400,
      )
    }
    const file = form.get("file")
    if (!(file instanceof Blob))
      return errorResponse("Missing the `file` part of the form.", 400)
    if (file.size > SIMPLE_UPLOAD_MAX_BYTES)
      return errorResponse(
        `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Simple upload accepts up to 50 MB — use POST …/files for larger files.`,
        413,
      )
    const filename =
      (file instanceof File && file.name) || String(form.get("filename") ?? "upload")
    const storageId = await ctx.storage.store(file)
    const result = await ctx.runMutation(internal.apiV1.attachSessionFile, {
      eventRef,
      userId,
      sessionId,
      storageId,
      filename,
      contentType: file.type || undefined,
      size: file.size,
      title: str(form.get("title") ?? undefined),
      assignedParticipantId: str(form.get("assigned_participant_id") ?? undefined),
    })
    if (result === null || result.notFound) {
      await ctx.storage.delete(storageId)
      return errorResponse(
        result === null ? `No event with slug "${eventRef}".` : "Session not found.",
        404,
      )
    }
    return jsonResponse(result, 201, gate.headers)
  }

  const body = (await readJsonBody(req)) ?? {}

  // POST …/files — initiate the two-phase upload.
  if (tail.length === 0 && method === "POST") {
    const filename = str(body.filename)
    if (!filename) return errorResponse("`filename` is required.", 400)
    const sizeBytes =
      typeof body.size_bytes === "number"
        ? body.size_bytes
        : typeof body.sizeBytes === "number"
          ? body.sizeBytes
          : undefined
    const created = await ctx.runMutation(internal.apiV1.createUploadIntent, {
      eventRef,
      userId,
      sessionId,
      filename,
      contentType: str(body.content_type) ?? str(body.mimetype),
      sizeBytes,
      title: str(body.title),
      assignedParticipantId: str(body.assigned_participant_id),
    })
    if (created === null)
      return errorResponse(`No event with slug "${eventRef}".`, 404)
    if (created.notFound) return errorResponse("Session not found.", 404)
    const base = process.env.CONVEX_SITE_URL ?? url.origin
    return jsonResponse(
      {
        data: {
          id: created.intentId,
          filename,
          title: str(body.title) ?? filename,
          upload: {
            url: `${base}/v1/event/${eventRef}/sessions/${sessionId}/files/${created.intentId}/bytes`,
            method: "PUT",
            headers: {
              "Content-Type": str(body.content_type) ?? "application/octet-stream",
              Authorization: "Bearer <your API key>",
            },
          },
        },
      },
      201,
      gate.headers,
    )
  }

  const fileId = tail[0]

  // POST …/files/{id}/complete
  if (tail.length === 2 && tail[1] === "complete" && method === "POST") {
    const result = await ctx.runMutation(internal.apiV1.completeUploadIntent, {
      eventRef,
      userId,
      intentId: fileId,
    })
    if (result === null)
      return errorResponse(`No event with slug "${eventRef}".`, 404)
    if (result.notFound) return errorResponse("Upload not found.", 404)
    return jsonResponse(result, 201, gate.headers)
  }

  // POST …/files/{id}/replace — a new version of an existing file.
  if (tail.length === 2 && tail[1] === "replace" && method === "POST") {
    const filename = str(body.filename)
    if (!filename) return errorResponse("`filename` is required.", 400)
    const created = await ctx.runMutation(internal.apiV1.createUploadIntent, {
      eventRef,
      userId,
      sessionId,
      filename,
      contentType: str(body.content_type) ?? str(body.mimetype),
      sizeBytes:
        typeof body.size_bytes === "number" ? body.size_bytes : undefined,
      title: str(body.title),
      assignedParticipantId: str(body.assigned_participant_id),
      replacesUploadId: fileId,
    })
    if (created === null)
      return errorResponse(`No event with slug "${eventRef}".`, 404)
    if (created.notFound) return errorResponse("Session not found.", 404)
    const base = process.env.CONVEX_SITE_URL ?? url.origin
    return jsonResponse(
      {
        data: {
          id: created.intentId,
          replaces: fileId,
          upload: {
            url: `${base}/v1/event/${eventRef}/sessions/${sessionId}/files/${created.intentId}/bytes`,
            method: "PUT",
            headers: {
              "Content-Type": str(body.content_type) ?? "application/octet-stream",
            },
          },
        },
      },
      201,
      gate.headers,
    )
  }

  // PUT/DELETE …/files/{id}
  if (tail.length === 1 && (method === "PUT" || method === "DELETE")) {
    const result = await ctx.runMutation(internal.apiV1.updateSessionFile, {
      eventRef,
      userId,
      sessionId,
      fileId,
      action: method === "DELETE" ? "delete" : "update",
      title: str(body.title),
      assignedParticipantId: str(body.assigned_participant_id),
    })
    if (result === null)
      return errorResponse(`No event with slug "${eventRef}".`, 404)
    if (result.notFound) return errorResponse("File not found.", 404)
    if (method === "DELETE")
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, ...gate.headers },
      })
    return jsonResponse(result, 200, gate.headers)
  }

  return errorResponse(`Unknown file endpoint ${method} ${url.pathname}.`, 404)
}

export const handleApiOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
})

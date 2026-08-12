import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "./_generated/server"
import {
  httpAction,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { internal } from "./_generated/api"
import { createAuth } from "./auth"
import {
  eventAccessFor,
  memberCanSeeEvent,
  membershipFor,
  randomToken,
} from "./lib/auth"
import { hashApiKey, keyPrefix } from "./apiKeys"
import { autoPlaceCore, computeConflicts } from "./agenda"
import { deleteEventCascade } from "./events"
import { ensureOnboardingTasks, withJoins } from "./submissions"
import { TASK_KINDS } from "./tasksAdmin"
import {
  queueMessage,
  queueTaskReminders,
  resolveBulkRecipients,
} from "./comms"
import { deleteUploadRow } from "./lib/files"
import { personProfileComplete } from "./lib/profileTasks"
import {
  assertReleasable,
  eventTrackNames,
  syncTrackOptions,
} from "./lib/formQuestions"
import { EMBED_FORMATS, EMBED_WIDGETS, validAccent } from "./embeds"
import { humanMessage } from "./lib/errors"
import { formWindow } from "./lib/formWindow"
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  defaultTemplate,
  portalLinkFor,
  siteUrl,
} from "./lib/email"
import {
  eventPath,
  formPath,
  uniqueEventSlug,
  uniqueFormSlug,
  uniqueWorkspaceSlug,
  workspaceSlugForEvent,
} from "./lib/publicLinks"

// ══════════════════════════════════════════════════════════════════════════
// Trackstage MCP server — Model Context Protocol over Streamable HTTP.
//
// One endpoint: POST {CONVEX_SITE_URL}/mcp. JSON-RPC 2.0 in, a single JSON
// response out (the spec allows a server to answer a request with either
// `application/json` or an SSE stream; every tool here is a short request/
// response round trip, so we always answer with JSON and never open a
// stream). Stateless: no Mcp-Session-Id is issued, so any request can be
// served by any Convex instance and clients never have to resume a session.
//
// ── Authentication ────────────────────────────────────────────────────────
// Two tiers, both resolving to a Better Auth user id, after which EVERY tool
// runs through the same membership authorization the web app uses
// (lib/auth.ts membershipFor / eventAccessFor). An MCP caller can never see
// or touch a workspace its user isn't a member of.
//
//  1. Personal API key — `Authorization: Bearer sb_live_…` (convex/apiKeys.ts).
//     The path for headless clients: Claude Code's `--header`, Codex's
//     config.toml, curl, CI. Always available, nothing to configure.
//
//  2. OAuth 2.1 — the Better Auth `mcp` plugin (convex/auth.ts) acting as the
//     authorization server, so "add connector by URL" works in the Claude and
//     ChatGPT connector UIs: dynamic client registration + authorization code
//     + PKCE, with the sign-in page as the consent step. Discovery is served
//     below (`/.well-known/oauth-protected-resource`) and from the app origin
//     (src/routes/[.]well-known.oauth-authorization-server.ts).
//
//     Why the authorization server is the APP origin and not this one: the
//     browser leg (`/mcp/authorize`) needs the Better Auth session cookie,
//     which is set on the app origin because the app proxies /api/auth/* to
//     Convex (src/routes/api/auth/$.ts). Advertising the Convex site as the
//     issuer would send the browser somewhere its cookie doesn't exist and
//     loop forever through the login page. The app origin is therefore the
//     issuer; this deployment is only the protected resource.
//
// ── Why a hand-rolled apiKeys table instead of Better Auth's `api-key`
//    plugin ─────────────────────────────────────────────────────────────────
// The plugin needs an `apikey` table, and @convex-dev/better-auth ships a
// FIXED component schema (user, session, account, verification, twoFactor,
// oauthApplication, oauthAccessToken, oauthConsent, jwks, rateLimit) — no
// `apikey` table, and an app cannot add tables to an installed component
// without vendoring it. The `mcp`/OIDC tables ARE in that list, which is
// exactly why OAuth composes and API keys don't. See convex/apiKeys.ts.
// ══════════════════════════════════════════════════════════════════════════

const SERVER_NAME = "trackstage"
const SERVER_VERSION = "1.0.0"
const LATEST_PROTOCOL = "2025-06-18"
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]

/** JSON-RPC 2.0 reserved codes (https://www.jsonrpc.org/specification). */
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

const MAX_ROWS = 4000

// ── Payload caps ──────────────────────────────────────────────────────────
// The live-fire test's clearest lesson: any tool result over ~2KB gets
// summarised lossily by the model before the user sees it, and rows silently
// disappear. So the verbose tools now cap their detail and SAY they capped it,
// with a named follow-up call for the rest.
const MAX_OPTIONS = 10 // per question, in get_form
const MAX_AGENDA_ROWS = 40 // scheduled/unscheduled rows in get_agenda
const TEMPLATE_PREVIEW_CHARS = 200 // body preview in list_templates

// ——————————————————————————————————————————————————————————————————————————
// Shared helpers (server side, inside queries/mutations)
// ——————————————————————————————————————————————————————————————————————————

/**
 * Resolves an event from either its id or its slug — LLM callers naturally
 * reach for the slug they just saw in `list_events`, and failing on that
 * would be a needless round trip.
 */
async function resolveEvent(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  ref: string,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<Doc<"events">> {
  const trimmed = ref.trim()
  const asId = ctx.db.normalizeId("events", trimmed)
  if (asId) {
    const event = await ctx.db.get(asId)
    if (event) {
      const access = await eventAccessFor(ctx, userId, event._id, minRole)
      return access.event
    }
  }
  // Event slugs are only unique per workspace now, so a slug ref can match
  // several events. The caller's own access narrows it: the oldest event this
  // user can act on wins (mirrors the public oldest-claimant rule), and
  // anything they can't reach is indistinguishable from "does not exist".
  const candidates = await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", trimmed.toLowerCase()))
    .take(20)
  const visible: Array<Doc<"events">> = []
  for (const candidate of candidates) {
    try {
      const access = await eventAccessFor(ctx, userId, candidate._id, minRole)
      visible.push(access.event)
    } catch {
      // Not this caller's event.
    }
  }
  if (visible.length === 0) {
    throw new ConvexError(
      `No event matches "${ref}". Call list_events to see the available event ids and slugs.`,
    )
  }
  return visible.reduce((oldest, candidate) =>
    candidate._creationTime < oldest._creationTime ? candidate : oldest,
  )
}

/** Narrows a caller-supplied string to a real id, with a readable failure. */
function requireId<T extends "submissions" | "forms" | "rooms" | "tracks" | "people" | "tasks">(
  ctx: QueryCtx | MutationCtx,
  table: T,
  value: string,
): Id<T> {
  const id = ctx.db.normalizeId(table, value.trim())
  if (!id) throw new ConvexError(`"${value}" is not a valid ${table} id.`)
  return id
}

function personName(person: Doc<"people"> | null): string {
  if (!person) return "Unknown"
  return `${person.firstName} ${person.lastName}`.trim() || person.email
}

/** ISO-8601 in, epoch ms out — LLMs write dates, not timestamps. */
function parseWhen(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const numeric = Number(trimmed)
  if (Number.isFinite(numeric) && trimmed.length >= 10 && !trimmed.includes("-")) {
    return numeric
  }
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) {
    throw new ConvexError(
      `"${value}" is not a valid date. Use an ISO-8601 string such as "2026-09-14T09:30:00Z".`,
    )
  }
  return parsed
}

function iso(ms: number | undefined | null): string | null {
  return ms === undefined || ms === null ? null : new Date(ms).toISOString()
}

/**
 * The canonical public CFP link, `/submit/:ws/:event/:form` — form slugs are
 * unique per event and event slugs per workspace, so both parent segments are
 * required (docs/memory/DECISIONS.md, "URL architecture is fully
 * hierarchical").
 */
async function eventFormUrl(
  ctx: QueryCtx | MutationCtx,
  event: Doc<"events">,
  formSlug: string,
): Promise<string> {
  const workspaceSlug = await workspaceSlugForEvent(ctx, event)
  return `${siteUrl()}${formPath(workspaceSlug, event.slug, formSlug)}`
}

/** Same link, when the caller holds the form but not its event. */
async function formPublicUrl(
  ctx: QueryCtx | MutationCtx,
  form: Doc<"forms">,
): Promise<string> {
  const event = await ctx.db.get(form.eventId)
  if (!event) return siteUrl()
  return await eventFormUrl(ctx, event, form.slug)
}

/**
 * Every public/portal link this server returns is built from SITE_URL, which
 * falls back to http://localhost:3000 when the deployment never set it. In the
 * live-fire test that meant an MCP client was handed `http://localhost:3000/…`
 * links with nothing marking them as unusable, and the model passed them on.
 *
 * The URL itself is left MACHINE-CLEAN (the copilot renders it as a copy
 * button, and a parenthetical glued onto the href would break that); the
 * warning rides alongside as its own field, which is what the model actually
 * reads before it quotes a link to a human.
 */
const LOOPBACK_HOST =
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i

function linkWarning(): string | undefined {
  const base = siteUrl()
  if (!LOOPBACK_HOST.test(base)) return undefined
  return `${base} is a loopback address (demo URL — set SITE_URL in production). Links below only work on the machine running Trackstage — don't send them to a speaker.`
}

/** Adds `linkWarning` to a payload that carries links, when one applies. */
function withLinkWarning<T extends object>(payload: T): T {
  const warning = linkWarning()
  return warning ? { ...payload, linkWarning: warning } : payload
}

// ══════════════════════════════════════════════════════════════════════════
// Credential resolution
// ══════════════════════════════════════════════════════════════════════════

/**
 * Exchanges a plaintext API key for its owner's user id and stamps
 * `lastUsedAt` so the settings UI can show which keys are actually live.
 * A mutation (not a query) precisely because of that stamp.
 */
export const resolveApiKey = internalMutation({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const keyHash = await hashApiKey(args.key)
    const row = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
      .unique()
    if (!row) return null
    await ctx.db.patch(row._id, { lastUsedAt: Date.now() })
    return row.userId
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Workspaces & events
// ══════════════════════════════════════════════════════════════════════════

export const listWorkspaces = internalQuery({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
    const rows = []
    for (const membership of memberships) {
      const org = await ctx.db.get(membership.organizationId)
      if (!org) continue
      const events = await ctx.db
        .query("events")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", org._id),
        )
        .collect()
      const visible = events.filter((row) =>
        memberCanSeeEvent(membership, row._id),
      )
      rows.push({
        organizationId: org._id,
        name: org.name,
        slug: org.slug,
        yourRole: membership.role,
        eventCount: visible.length,
      })
    }
    return { workspaces: rows }
  },
})

export const listEvents = internalQuery({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
    const rows = []
    for (const membership of memberships) {
      const org = await ctx.db.get(membership.organizationId)
      const events = await ctx.db
        .query("events")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", membership.organizationId),
        )
        .collect()
      for (const event of events) {
        if (!memberCanSeeEvent(membership, event._id)) continue
        rows.push({
          eventId: event._id,
          slug: event.slug,
          name: event.name,
          type: event.type ?? null,
          venue: event.venue ?? null,
          timezone: event.timezone,
          startsAt: iso(event.startsAt),
          endsAt: iso(event.endsAt),
          organizationId: membership.organizationId,
          organizationName: org?.name ?? "",
          yourRole: membership.role,
        })
      }
    }
    rows.sort((a, b) => a.name.localeCompare(b.name))
    return { events: rows }
  },
})

export const createEvent = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    timezone: v.optional(v.string()),
    type: v.optional(v.string()),
    venue: v.optional(v.string()),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const name = args.name.trim()
    if (!name) throw new ConvexError("An event name is required.")

    // With a single workspace the caller shouldn't have to name it.
    let organizationId: Id<"organizations">
    if (args.organizationId) {
      const normalized = ctx.db.normalizeId("organizations", args.organizationId)
      if (!normalized) throw new ConvexError(`"${args.organizationId}" is not a valid workspace id.`)
      organizationId = normalized
    } else {
      const memberships = await ctx.db
        .query("members")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect()
      if (memberships.length === 0) throw new ConvexError("You don't belong to a workspace yet.")
      if (memberships.length > 1) {
        throw new ConvexError(
          "You belong to several workspaces — pass organizationId (see list_workspaces).",
        )
      }
      organizationId = memberships[0].organizationId
    }
    await membershipFor(ctx, args.userId, organizationId, "admin")

    const slug = await uniqueEventSlug(ctx, organizationId, args.slug ?? name)

    const eventId = await ctx.db.insert("events", {
      organizationId,
      name,
      slug,
      timezone: args.timezone ?? "UTC",
      type: args.type,
      venue: args.venue,
      description: args.description,
      websiteUrl: args.websiteUrl,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
    })
    const organization = await ctx.db.get(organizationId)
    // Every public address in this product is `workspace / event / …`, so the
    // workspace slug travels WITH the event id — without it a caller (or a
    // copilot tool view) cannot build a single link to what it just created.
    const workspaceSlug = organization?.slug ?? "workspace"
    return withLinkWarning({
      eventId,
      slug,
      name,
      workspaceSlug,
      organizationId,
      /** The canonical public program page — shareable the moment it exists. */
      publicUrl: `${siteUrl()}${eventPath(workspaceSlug, slug)}`,
      publicSubmitUrlHint: `${siteUrl()}${formPath(workspaceSlug, slug, "<form-slug>")}`,
    })
  },
})

const SUBMISSION_STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
]

/** Status counts + open-work numbers, shared by overview and summary. */
async function eventStats(ctx: QueryCtx, event: Doc<"events">) {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(MAX_ROWS)
  const statusCounts: Record<string, number> = {}
  for (const status of SUBMISSION_STATUSES) statusCounts[status] = 0
  for (const submission of submissions) {
    statusCounts[submission.status] = (statusCounts[submission.status] ?? 0) + 1
  }
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(MAX_ROWS)
  const openTasks = tasks.filter((task) => task.completedAt === undefined)
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .collect()
  const scheduled = submissions.filter(
    (s) => s.status === "accepted" && s.startsAt !== undefined,
  )
  const acceptedCount = statusCounts.accepted
  return {
    submissions,
    statusCounts,
    tasks,
    openTasks,
    forms,
    scheduledCount: scheduled.length,
    unscheduledAccepted: acceptedCount - scheduled.length,
  }
}

/**
 * `get_event_overview` used to be its own tool with its own payload, and the
 * live-fire test showed a model cannot tell "overview" from "summary" from the
 * names alone — it lost a head-to-head with `get_agenda` for "pull the
 * dashboard stats". The two payloads overlapped ~80%, so they are now ONE:
 * every dashboard number the overview carried lives in the summary, and this
 * query exists only to keep the old tool name answering.
 */
export const eventOverview = internalQuery({
  args: { userId: v.string(), event: v.string(), now: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    return {
      ...(await eventSummaryPayload(ctx, event, args.now)),
      deprecated:
        "get_event_overview is a deprecated alias of get_event_summary and returns exactly the same payload. Call get_event_summary instead.",
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Forms
// ══════════════════════════════════════════════════════════════════════════

export const listForms = internalQuery({
  args: { userId: v.string(), event: v.string(), now: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .collect()
    const rows = []
    for (const form of forms) {
      const window = formWindow(form, args.now)
      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_formId", (q) => q.eq("formId", form._id))
        .collect()
      rows.push({
        formId: form._id,
        name: form.internalName,
        externalTitle: form.externalTitle,
        slug: form.slug,
        kind: form.kind,
        status: form.status,
        effectiveStatus: window.open ? "open" : "closed",
        acceptingSubmissions: window.open,
        closeAt: iso(form.closeAt),
        publicUrl: await eventFormUrl(ctx, event, form.slug),
        submissionCount: submissions.filter((s) => s.status !== "draft").length,
        draftCount: submissions.filter((s) => s.status === "draft").length,
      })
    }
    return withLinkWarning({ formCount: rows.length, forms: rows })
  },
})

/**
 * The one form lookup: takes a form id, or a form slug.
 *
 * Form slugs are unique PER EVENT, so a bare slug like "cfp" can legitimately
 * match several events now. We keep the slug shorthand (an LLM caller reaches
 * for the slug it just read out of `list_forms`) but resolve it against the
 * forms this user may actually see, and ask for the id when that is still
 * ambiguous — a silent pick would edit the wrong organizer's form.
 */
async function resolveForm(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  ref: string,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<Doc<"forms">> {
  const trimmed = ref.trim()
  const asId = ctx.db.normalizeId("forms", trimmed)
  const byId = asId ? await ctx.db.get(asId) : null
  if (byId) {
    await eventAccessFor(ctx, userId, byId.eventId, minRole)
    return byId
  }

  const candidates = await ctx.db
    .query("forms")
    .withIndex("by_slug", (q) => q.eq("slug", trimmed.toLowerCase()))
    .take(20)
  const visible: Array<Doc<"forms">> = []
  for (const candidate of candidates) {
    try {
      await eventAccessFor(ctx, userId, candidate.eventId, minRole)
      visible.push(candidate)
    } catch {
      // Not this caller's form — indistinguishable from "does not exist".
    }
  }
  if (visible.length === 1) return visible[0]
  if (visible.length > 1) {
    throw new ConvexError(
      `"${ref}" is the slug of ${visible.length} forms across different events. Pass the formId (see list_forms) so the right one is edited.`,
    )
  }
  throw new ConvexError(
    `No form matches "${ref}". Call list_forms to see the form ids and slugs.`,
  )
}

export const getForm = internalQuery({
  args: { userId: v.string(), form: v.string(), now: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const form = await resolveForm(ctx, args.userId, args.form)
    const window = formWindow(form, args.now)
    return withLinkWarning({
      formId: form._id,
      eventId: form.eventId,
      name: form.internalName,
      externalTitle: form.externalTitle,
      pageHeading: form.pageHeading ?? null,
      welcomeMessage: form.welcomeMessage ?? null,
      slug: form.slug,
      kind: form.kind,
      status: form.status,
      effectiveStatus: window.open ? "open" : "closed",
      acceptingSubmissions: window.open,
      closeAt: iso(form.closeAt),
      publicUrl: await formPublicUrl(ctx, form),
      // Track options are the event's tracks, live (lib/formQuestions.ts).
      questions: syncTrackOptions(
        form.questions,
        await eventTrackNames(ctx, form.eventId),
      ).map((question) => {
        // A tag or country dropdown can carry hundreds of options; the whole
        // payload then gets lossily compressed by the model before the user
        // ever sees it. Ten is enough to characterise the question — the count
        // says how many were held back.
        const options = question.options ?? null
        const held = options === null ? 0 : options.length - MAX_OPTIONS
        return {
          id: question.id,
          label: question.label,
          type: question.type,
          required: question.required,
          enabled: question.enabled,
          locked: question.locked,
          options: options === null ? null : options.slice(0, MAX_OPTIONS),
          ...(options !== null && held > 0
            ? {
                optionCount: options.length,
                optionsTruncated: `…${held} more`,
              }
            : {}),
          showIf: question.showIf ?? null,
          isTrackQuestion: question.isTrackQuestion ?? false,
        }
      }),
      participantConfig: form.participantConfig,
      settings: form.settings,
      notifyEmails: form.notifyEmails,
    })
  },
})

export const createForm = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    name: v.string(),
    kind: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const kind = args.kind ?? "abstract"
    if (kind !== "abstract" && kind !== "session") {
      throw new ConvexError("kind must be 'abstract' or 'session'.")
    }
    const name = args.name.trim()
    if (!name) throw new ConvexError("A form name is required.")

    const tracks = (
      await ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .collect()
    ).sort((a, b) => a.order - b.order)

    const questions = [
      { id: "title", label: "Title", type: "short_text", required: true, enabled: true, locked: true, maxChars: 200 },
      { id: "description", label: "Description", type: "rich_text", required: true, enabled: true, locked: true, maxChars: 5000 },
      { id: "format", label: "Format", type: "dropdown", required: true, enabled: true, locked: false, options: ["Talk", "Workshop", "Lightning Talk"] },
      // Required only once the event has tracks — a required dropdown with no
      // options is a wall on the public form (convex/lib/formQuestions.ts).
      { id: "track", label: "Track", type: "dropdown", required: tracks.length > 0, enabled: true, locked: false, options: tracks.map((t) => t.name), isTrackQuestion: true },
      { id: "level", label: "Level", type: "dropdown", required: false, enabled: true, locked: false, options: ["Introductory", "Intermediate", "Advanced"] },
      { id: "language", label: "Language", type: "dropdown", required: false, enabled: true, locked: false, options: ["English"] },
      { id: "tags", label: "Tags", type: "multi_select", required: false, enabled: true, locked: false, options: ["AI", "Infrastructure", "Product", "Open Source"] },
    ]

    // Unique within this event only — see convex/lib/publicLinks.ts.
    const slug = await uniqueFormSlug(ctx, event._id, name)

    const formId = await ctx.db.insert("forms", {
      eventId: event._id,
      slug,
      kind,
      status: "open",
      internalName: name,
      externalTitle: name,
      pageHeading: "Call for Speakers",
      welcomeMessage:
        "<p>We'd love to hear from you! Tell us about the session you'd like to present.</p>",
      showWelcomeMessage: true,
      questions,
      participantConfig: {
        speakerMin: 1,
        speakerMax: 4,
        chairpersonEnabled: false,
        moderatorEnabled: false,
        sendConfirmationEmail: true,
        fields: [
          { id: "firstName", label: "First Name", required: true, enabled: true, locked: true },
          { id: "lastName", label: "Last Name", required: true, enabled: true, locked: true },
          { id: "email", label: "Email", required: true, enabled: true, locked: true },
          { id: "jobTitle", label: "Job Title", required: false, enabled: true, locked: false },
          { id: "company", label: "Company", required: false, enabled: true, locked: false },
          { id: "phone", label: "Mobile Phone", required: false, enabled: false, locked: false },
          { id: "bio", label: "Biography", required: false, enabled: true, locked: false },
          { id: "headshot", label: "Headshot", required: false, enabled: true, locked: false },
        ],
      },
      settings: {
        allowDrafts: true,
        autoRedirectToPortal: true,
        sendReminderEmail: true,
        successMessage:
          "<p>Thank you for submitting to present at our event! We'll review your submission and get back to you soon.</p>",
      },
      notifyEmails: [],
    })
    // `name` and `kind` are echoed back so a caller that creates two forms in
    // one turn can tell them apart without a second round trip.
    return withLinkWarning({
      formId,
      name,
      kind,
      slug,
      publicUrl: await eventFormUrl(ctx, event, slug),
      status: "open",
    })
  },
})

export const updateFormSettings = internalMutation({
  args: {
    userId: v.string(),
    form: v.string(),
    status: v.optional(v.string()),
    closeAt: v.optional(v.union(v.number(), v.null())),
    externalTitle: v.optional(v.string()),
    limitPerUser: v.optional(v.union(v.number(), v.null())),
    allowDrafts: v.optional(v.boolean()),
    sendReminderEmail: v.optional(v.boolean()),
    successMessage: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const form = await resolveForm(ctx, args.userId, args.form)
    const patch: Record<string, unknown> = {}
    if (args.status !== undefined) {
      if (args.status !== "open" && args.status !== "closed") {
        throw new ConvexError("status must be 'open' or 'closed'.")
      }
      // Opening a form nobody can submit through is refused here exactly as it
      // is in the builder (convex/lib/formQuestions.ts).
      assertReleasable({
        wasOpen: form.status === "open",
        willBeOpen: args.status === "open",
        before: form.questions,
        after: form.questions,
        trackNames: await eventTrackNames(ctx, form.eventId),
      })
      patch.status = args.status
    }
    if (args.closeAt !== undefined) patch.closeAt = args.closeAt ?? undefined
    if (args.externalTitle !== undefined) patch.externalTitle = args.externalTitle
    if (
      args.limitPerUser !== undefined ||
      args.allowDrafts !== undefined ||
      args.sendReminderEmail !== undefined ||
      args.successMessage !== undefined
    ) {
      patch.settings = {
        ...form.settings,
        ...(args.limitPerUser !== undefined
          ? { limitPerUser: args.limitPerUser ?? undefined }
          : {}),
        ...(args.allowDrafts !== undefined ? { allowDrafts: args.allowDrafts } : {}),
        ...(args.sendReminderEmail !== undefined
          ? { sendReminderEmail: args.sendReminderEmail }
          : {}),
        ...(args.successMessage !== undefined
          ? { successMessage: args.successMessage }
          : {}),
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new ConvexError("Nothing to update — pass at least one setting.")
    }
    // Snapshot before the write so callers can show a real before/after — an
    // "updated!" with no previous value is unverifiable by the reader.
    const previous = {
      status: form.status,
      closeAt: iso(form.closeAt),
      settings: form.settings,
    }
    await ctx.db.patch(form._id, patch)
    const updated = await ctx.db.get(form._id)
    return withLinkWarning({
      formId: form._id,
      name: form.internalName,
      status: updated?.status,
      closeAt: iso(updated?.closeAt),
      publicUrl: await formPublicUrl(ctx, form),
      settings: updated?.settings,
      previous,
    })
  },
})

export const publicFormLink = internalQuery({
  args: { userId: v.string(), form: v.string(), now: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const form = await resolveForm(ctx, args.userId, args.form)
    const closed =
      form.status !== "open" ||
      (form.closeAt !== undefined && form.closeAt < args.now)
    return withLinkWarning({
      formId: form._id,
      name: form.internalName,
      publicUrl: await formPublicUrl(ctx, form),
      status: form.status,
      closeAt: iso(form.closeAt),
      acceptingSubmissions: !closed,
      note: closed
        ? "This form is not accepting submissions right now — reopen it with update_form_settings."
        : "Share this link with prospective speakers.",
    })
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Submissions & decisions
// ══════════════════════════════════════════════════════════════════════════

/** Compact projection — MCP results are read by an LLM, so stay terse. */
function submissionRow(joined: Awaited<ReturnType<typeof withJoins>>) {
  return {
    submissionId: joined._id,
    title: joined.title,
    status: joined.status,
    kind: joined.kind,
    track: joined.track?.name ?? null,
    format: joined.format ?? null,
    level: joined.level ?? null,
    tags: joined.tags,
    speakers: joined.participants.map((p) => `${p.name} <${p.email}>`),
    scheduled:
      joined.startsAt !== undefined
        ? {
            startsAt: iso(joined.startsAt),
            durationMinutes: joined.durationMinutes ?? 45,
            room: joined.room?.name ?? null,
          }
        : null,
  }
}

export const listSubmissions = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    status: v.optional(v.string()),
    track: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    if (args.status !== undefined && !SUBMISSION_STATUSES.includes(args.status)) {
      throw new ConvexError(
        `Invalid status "${args.status}". One of: ${SUBMISSION_STATUSES.join(", ")}.`,
      )
    }
    const rows = args.status
      ? await ctx.db
          .query("submissions")
          .withIndex("by_eventId_and_status", (q) =>
            q.eq("eventId", event._id).eq("status", args.status!),
          )
          .order("desc")
          .take(MAX_ROWS)
      : await ctx.db
          .query("submissions")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .order("desc")
          .take(MAX_ROWS)

    // Trashed rows are gone from every organizer listing and the agenda, so
    // they must be gone from here too — an agent that saw them would report
    // counts the organizer's own screen contradicts. list_trash is where they
    // live, and where restore_submission gets its ids.
    let joined = await Promise.all(
      rows
        .filter((row) => row.deletedAt === undefined)
        .map((row) => withJoins(ctx, row)),
    )
    if (args.track) {
      const needle = args.track.trim().toLowerCase()
      joined = joined.filter(
        (row) =>
          row.track?.name.toLowerCase() === needle || row.trackId === args.track,
      )
    }
    if (args.search) {
      const needle = args.search.trim().toLowerCase()
      joined = joined.filter(
        (row) =>
          row.title.toLowerCase().includes(needle) ||
          (row.description ?? "").toLowerCase().includes(needle) ||
          row.participants.some(
            (p) =>
              p.name.toLowerCase().includes(needle) ||
              p.email.toLowerCase().includes(needle),
          ),
      )
    }
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
    return {
      total: joined.length,
      returned: Math.min(joined.length, limit),
      submissions: joined.slice(0, limit).map(submissionRow),
    }
  },
})

/**
 * The trash — mirrors convex/submissions.ts::listDeleted.
 *
 * restore_submission needs an id, and a soft-deleted id is discoverable
 * NOWHERE else through MCP (list_submissions filters trashed rows out, exactly
 * like the organizer's screens). Without this the restore tool is a door with
 * no handle, which is why the adversarial review counted it as a full-proxy
 * gap rather than a nicety.
 */
export const listTrash = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    const deleted = rows
      .filter((row) => row.deletedAt !== undefined)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
    const joined = await Promise.all(
      deleted.slice(0, limit).map((row) => withJoins(ctx, row)),
    )
    return {
      event: event.name,
      total: deleted.length,
      returned: joined.length,
      trashed: joined.map((row, index) => ({
        ...submissionRow(row),
        deletedAt: iso(deleted[index].deletedAt),
      })),
      note:
        deleted.length === 0
          ? "The trash is empty."
          : "Bring any of these back with restore_submission. Nothing here appears in listings, on the agenda, or on public pages.",
    }
  },
})

export const getSubmission = internalQuery({
  args: { userId: v.string(), submissionId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = requireId(ctx, "submissions", args.submissionId)
    const submission = await ctx.db.get(id)
    if (!submission) throw new ConvexError("Submission not found.")
    await eventAccessFor(ctx, args.userId, submission.eventId)
    const joined = await withJoins(ctx, submission)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", id))
      .collect()
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", id))
      .collect()
    const completed = evaluations.filter((e) => e.completedAt !== undefined)
    const allScores = completed.flatMap((e) => Object.values(e.scores))
    return {
      ...submissionRow(joined),
      /** Carried so edit tools can route to the owning event in one hop. */
      eventId: submission.eventId,
      description: joined.description ?? null,
      answers: joined.answers,
      formName: joined.formName ?? null,
      decidedAt: iso(joined.decidedAt),
      notifiedAt: iso(joined.notifiedAt),
      participants: joined.participants,
      uploads: uploads.map((upload) => ({
        filename: upload.filename,
        version: upload.version,
        approvalStatus: upload.approvalStatus,
        reviewNote: upload.reviewNote ?? null,
      })),
      evaluation: {
        completedReviews: completed.length,
        averageScore:
          allScores.length > 0
            ? Math.round(
                (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100,
              ) / 100
            : null,
        comments: completed
          .map((e) => e.comment)
          .filter((c): c is string => Boolean(c)),
      },
    }
  },
})

export const setSubmissionStatus = internalMutation({
  args: { userId: v.string(), submissionId: v.string(), status: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (!SUBMISSION_STATUSES.includes(args.status)) {
      throw new ConvexError(
        `Invalid status "${args.status}". One of: ${SUBMISSION_STATUSES.join(", ")}.`,
      )
    }
    const id = requireId(ctx, "submissions", args.submissionId)
    const submission = await ctx.db.get(id)
    if (!submission) throw new ConvexError("Submission not found.")
    await eventAccessFor(ctx, args.userId, submission.eventId)
    await ctx.db.patch(id, { status: args.status })
    return {
      submissionId: id,
      title: submission.title,
      previousStatus: submission.status,
      status: args.status,
      note:
        args.status === "accept_queue" || args.status === "decline_queue"
          ? "Staged only — no email has been sent. Run commit_decision_queue to notify the speakers."
          : "Status updated. No email was sent.",
    }
  },
})

export const commitDecisionQueue = internalMutation({
  args: { userId: v.string(), event: v.string(), queue: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.queue !== "accept_queue" && args.queue !== "decline_queue") {
      throw new ConvexError("queue must be 'accept_queue' or 'decline_queue'.")
    }
    // Committing a queue mails real speakers — same admin bar as the web app.
    const event = await resolveEvent(ctx, args.userId, args.event, "admin")
    const accepting = args.queue === "accept_queue"
    const staged = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", args.queue),
      )
      .collect()

    const now = Date.now()
    let notified = 0
    const titles: Array<string> = []
    for (const submission of staged) {
      await ctx.db.patch(submission._id, {
        status: accepting ? "accepted" : "declined",
        decidedAt: now,
        notifiedAt: now,
      })
      titles.push(submission.title)
      const participants = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
        .collect()
      const speakerIds = participants
        .filter((p) => p.role === "speaker")
        .map((p) => p.personId)
      const notifyIds = speakerIds.length > 0 ? speakerIds : [submission.submitterId]
      for (const personId of notifyIds) {
        await ctx.runMutation(internal.comms.queueForPerson, {
          eventId: event._id,
          personId,
          templateKey: accepting ? "accepted" : "declined",
          submissionId: submission._id,
        })
        notified++
        if (accepting) await ensureOnboardingTasks(ctx, event._id, personId)
      }
    }
    return {
      queue: args.queue,
      committed: staged.length,
      emailsQueued: notified,
      titles,
      note:
        staged.length === 0
          ? "Nothing was staged in that queue — use set_submission_status first."
          : `Decision emails are queued in the outbox; check them with list_outbox.`,
    }
  },
})

export const addManualSession = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    kind: v.optional(v.string()),
    status: v.optional(v.string()),
    track: v.optional(v.string()),
    format: v.optional(v.string()),
    level: v.optional(v.string()),
    language: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    speakers: v.optional(
      v.array(
        v.object({
          email: v.string(),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          company: v.optional(v.string()),
          jobTitle: v.optional(v.string()),
        }),
      ),
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const member = await membershipFor(
      ctx,
      args.userId,
      event.organizationId!,
    )
    const title = args.title.trim()
    if (!title) throw new ConvexError("A title is required.")

    const kind = args.kind === "abstract" ? "abstract" : "session"
    const status = args.status ?? (kind === "session" ? "accepted" : "pending")
    if (!SUBMISSION_STATUSES.includes(status)) {
      throw new ConvexError(
        `Invalid status "${status}". One of: ${SUBMISSION_STATUSES.join(", ")}.`,
      )
    }

    let trackId: Id<"tracks"> | undefined
    if (args.track) {
      const tracks = await ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .collect()
      const needle = args.track.trim().toLowerCase()
      const match =
        tracks.find((t) => t._id === args.track) ??
        tracks.find((t) => t.name.toLowerCase() === needle)
      if (!match) {
        throw new ConvexError(
          `No track named "${args.track}". Available: ${tracks.map((t) => t.name).join(", ") || "(none)"}.`,
        )
      }
      trackId = match._id
    }

    // Submitter of record is the organizer running the tool.
    let submitter = await ctx.db
      .query("people")
      .withIndex("by_eventId_and_email", (q) =>
        q.eq("eventId", event._id).eq("email", member.email),
      )
      .unique()
    if (!submitter) {
      const submitterId = await ctx.db.insert("people", {
        eventId: event._id,
        email: member.email,
        firstName: "Organizer",
        lastName: "",
        portalToken: randomToken(),
      })
      submitter = await ctx.db.get(submitterId)
    }

    const submissionId = await ctx.db.insert("submissions", {
      eventId: event._id,
      kind,
      title,
      description: args.description,
      answers: {},
      trackId,
      format: args.format,
      level: args.level,
      language: args.language,
      tags: args.tags ?? [],
      status,
      submitterId: submitter!._id,
    })

    const added: Array<string> = []
    for (const [index, speaker] of (args.speakers ?? []).entries()) {
      const email = speaker.email.trim().toLowerCase()
      if (!email) continue
      let person = await ctx.db
        .query("people")
        .withIndex("by_eventId_and_email", (q) =>
          q.eq("eventId", event._id).eq("email", email),
        )
        .unique()
      if (!person) {
        const personId = await ctx.db.insert("people", {
          eventId: event._id,
          email,
          firstName: speaker.firstName ?? email.split("@")[0],
          lastName: speaker.lastName ?? "",
          company: speaker.company,
          jobTitle: speaker.jobTitle,
          portalToken: randomToken(),
        })
        person = await ctx.db.get(personId)
      }
      await ctx.db.insert("submissionParticipants", {
        submissionId,
        eventId: event._id,
        personId: person!._id,
        role: "speaker",
        order: index,
      })
      added.push(email)
    }
    // format/track are echoed back for the same reason create_form echoes its
    // name: two sessions added in one turn have to be tellable apart.
    return {
      submissionId,
      title,
      kind,
      status,
      format: args.format ?? null,
      track: args.track ?? null,
      speakers: added,
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Agenda
// ══════════════════════════════════════════════════════════════════════════

export const getAgenda = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const accepted = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", "accepted"),
      )
      .collect()
    const rooms = (
      await ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .collect()
    ).sort((a, b) => a.order - b.order)
    const roomsById = new Map(rooms.map((room) => [room._id, room]))

    const enrich = async (submission: Doc<"submissions">) => {
      const participants = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
        .collect()
      const speakers: Array<string> = []
      for (const participant of participants) {
        if (participant.role !== "speaker") continue
        speakers.push(personName(await ctx.db.get(participant.personId)))
      }
      const track = submission.trackId ? await ctx.db.get(submission.trackId) : null
      return {
        submissionId: submission._id,
        title: submission.title,
        startsAt: iso(submission.startsAt),
        durationMinutes: submission.durationMinutes ?? 45,
        room: submission.roomId
          ? (roomsById.get(submission.roomId)?.name ?? null)
          : null,
        roomId: submission.roomId ?? null,
        track: track?.name ?? null,
        speakers,
      }
    }

    const scheduled = await Promise.all(
      accepted.filter((s) => s.startsAt !== undefined).map(enrich),
    )
    const unscheduled = await Promise.all(
      accepted.filter((s) => s.startsAt === undefined).map(enrich),
    )
    scheduled.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    const conflicts = await computeConflicts(ctx, event._id)

    // A per-room roll-up first: on a big programme the row detail below is
    // capped, and these totals stay true whatever the cap does. They are also
    // the shape most "how full is each room?" questions actually want.
    const byRoom = rooms.map((room) => {
      const inRoom = scheduled.filter((session) => session.roomId === room._id)
      return {
        room: room.name,
        roomId: room._id,
        capacity: room.capacity ?? null,
        sessionCount: inRoom.length,
        firstStartsAt: inRoom[0]?.startsAt ?? null,
        lastStartsAt: inRoom[inRoom.length - 1]?.startsAt ?? null,
      }
    })

    const truncatedNote = (total: number, kept: number, what: string) =>
      total > kept
        ? `…${total - kept} more ${what} session(s) omitted. Use list_submissions(status: "accepted") or narrow by room with the byRoom totals.`
        : undefined

    return {
      event: {
        name: event.name,
        timezone: event.timezone,
        startsAt: iso(event.startsAt),
        endsAt: iso(event.endsAt),
      },
      rooms: rooms.map((room) => ({
        roomId: room._id,
        name: room.name,
        capacity: room.capacity ?? null,
      })),
      scheduledCount: scheduled.length,
      unscheduledCount: unscheduled.length,
      conflictCount: conflicts.length,
      byRoom,
      scheduled: scheduled.slice(0, MAX_AGENDA_ROWS),
      ...(scheduled.length > MAX_AGENDA_ROWS
        ? { scheduledTruncated: truncatedNote(scheduled.length, MAX_AGENDA_ROWS, "scheduled") }
        : {}),
      unscheduled: unscheduled.slice(0, MAX_AGENDA_ROWS),
      ...(unscheduled.length > MAX_AGENDA_ROWS
        ? { unscheduledTruncated: truncatedNote(unscheduled.length, MAX_AGENDA_ROWS, "unscheduled") }
        : {}),
      conflicts: conflicts.map((conflict) => ({
        kind: conflict.kind,
        problem: conflict.label,
        sessions: [conflict.a.title, conflict.b.title],
        submissionIds: [conflict.a.id, conflict.b.id],
      })),
    }
  },
})

export const scheduleSession = internalMutation({
  args: {
    userId: v.string(),
    submissionId: v.string(),
    room: v.string(),
    startsAt: v.number(),
    durationMinutes: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = requireId(ctx, "submissions", args.submissionId)
    const submission = await ctx.db.get(id)
    if (!submission) throw new ConvexError("Session not found.")
    await eventAccessFor(ctx, args.userId, submission.eventId)
    if (submission.status !== "accepted") {
      throw new ConvexError(
        "Only accepted sessions can be scheduled. Accept it first (set_submission_status + commit_decision_queue).",
      )
    }
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_eventId", (q) => q.eq("eventId", submission.eventId))
      .collect()
    const needle = args.room.trim().toLowerCase()
    const room =
      rooms.find((r) => r._id === args.room.trim()) ??
      rooms.find((r) => r.name.toLowerCase() === needle)
    if (!room) {
      throw new ConvexError(
        `No room named "${args.room}". Available: ${rooms.map((r) => r.name).join(", ") || "(none — add one in Settings)"}.`,
      )
    }
    const durationMinutes = args.durationMinutes ?? submission.durationMinutes ?? 45
    if (durationMinutes < 5 || durationMinutes > 480) {
      throw new ConvexError("Duration must be between 5 minutes and 8 hours.")
    }
    await ctx.db.patch(id, {
      roomId: room._id,
      startsAt: args.startsAt,
      durationMinutes,
    })
    // Scheduling is never blocked by a clash — it is reported instead, exactly
    // like the drag-and-drop agenda board.
    const conflicts = (await computeConflicts(ctx, submission.eventId)).filter(
      (conflict) => conflict.a.id === id || conflict.b.id === id,
    )
    return {
      submissionId: id,
      title: submission.title,
      room: room.name,
      startsAt: iso(args.startsAt),
      durationMinutes,
      conflicts: conflicts.map((conflict) => conflict.label),
    }
  },
})

export const unscheduleSession = internalMutation({
  args: { userId: v.string(), submissionId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = requireId(ctx, "submissions", args.submissionId)
    const submission = await ctx.db.get(id)
    if (!submission) throw new ConvexError("Session not found.")
    await eventAccessFor(ctx, args.userId, submission.eventId)
    await ctx.db.patch(id, { roomId: undefined, startsAt: undefined })
    return {
      submissionId: id,
      title: submission.title,
      note: "Moved back to the unscheduled tray.",
    }
  },
})

export const autoPlaceSessions = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    dayStartHour: v.optional(v.number()),
    dayEndHour: v.optional(v.number()),
    defaultDurationMinutes: v.optional(v.number()),
    gapMinutes: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const result = await autoPlaceCore(ctx, event, args)
    const conflicts = await computeConflicts(ctx, event._id)
    return {
      placed: result.placed,
      couldNotFit: result.remaining,
      conflictsAfterwards: conflicts.length,
      note: "Existing scheduled sessions were left untouched; only the unscheduled tray was filled.",
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Speakers & tasks
// ══════════════════════════════════════════════════════════════════════════

/**
 * The roster, and the one tool where a model gave the operator a WRONG NUMBER
 * in the live-fire test: `onlyWithOutstandingWork` used to mean "open tasks OR
 * an incomplete profile", the model read it as "open tasks", and it reported 8
 * of 11 rows as the chase list.
 *
 * Two changes make that failure impossible. The flag now means EXACTLY "has ≥1
 * incomplete task" — nothing else — and profile gaps are opted into separately
 * with `includeProfileGaps`. And the response states its own arithmetic
 * (`summary`, plus `totalSpeakers` / `withOpenTasks` / `withProfileGaps` /
 * `returned`), so a model that miscounts the rows contradicts a sentence
 * sitting right next to them.
 */
export const listSpeakers = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    onlyWithOutstandingWork: v.optional(v.boolean()),
    includeProfileGaps: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const accepted = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", "accepted"),
      )
      .collect()

    const sessionsByPerson = new Map<string, Array<string>>()
    for (const submission of accepted) {
      const participants = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
        .collect()
      for (const participant of participants) {
        const list = sessionsByPerson.get(participant.personId) ?? []
        list.push(submission.title)
        sessionsByPerson.set(participant.personId, list)
      }
    }

    const rows = []
    for (const [personId, sessions] of sessionsByPerson) {
      const person = await ctx.db.get(personId as Id<"people">)
      if (!person) continue
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_personId", (q) => q.eq("personId", person._id))
        .collect()
      const openTasks = tasks.filter((task) => task.completedAt === undefined)
      const uploads = await ctx.db
        .query("uploads")
        .withIndex("by_personId", (q) => q.eq("personId", person._id))
        .collect()
      const missing: Array<string> = []
      if (!person.bio?.trim()) missing.push("bio")
      if (!person.headshotId) missing.push("headshot")
      if (uploads.length === 0) missing.push("slides")
      // Every speaker is built first and filtered second, so the counts below
      // are over the WHOLE roster and never over the filtered slice.
      const reasons: Array<string> = []
      if (openTasks.length > 0) reasons.push("open_tasks")
      if (missing.length > 0) reasons.push("incomplete_profile")
      rows.push({
        personId: person._id,
        name: personName(person),
        email: person.email,
        company: person.company ?? null,
        jobTitle: person.jobTitle ?? null,
        sessions,
        outstandingTasks: openTasks.map((task) => ({
          taskId: task._id,
          title: task.title,
          kind: task.kind,
          dueAt: iso(task.dueAt),
        })),
        missingProfileItems: missing,
        outstandingReason: reasons,
      })
    }
    rows.sort(
      (a, b) =>
        b.outstandingTasks.length - a.outstandingTasks.length ||
        a.name.localeCompare(b.name),
    )

    const totalSpeakers = rows.length
    const withOpenTasks = rows.filter((r) => r.outstandingTasks.length > 0).length
    const withProfileGaps = rows.filter((r) => r.missingProfileItems.length > 0).length
    const withEither = rows.filter((r) => r.outstandingReason.length > 0).length

    const onlyOpenTasks = args.onlyWithOutstandingWork === true
    const includeGaps = args.includeProfileGaps === true
    const filtered = onlyOpenTasks
      ? rows.filter((r) =>
          includeGaps
            ? r.outstandingReason.length > 0
            : r.outstandingTasks.length > 0,
        )
      : includeGaps
        ? rows.filter((r) => r.missingProfileItems.length > 0)
        : rows

    const filterDescription = onlyOpenTasks
      ? includeGaps
        ? "speakers with ≥1 incomplete task OR an incomplete profile"
        : "speakers with ≥1 incomplete task"
      : includeGaps
        ? "speakers with an incomplete profile"
        : "the whole confirmed roster"

    return {
      // The sentence exists so a model cannot restate the row count wrongly:
      // the arithmetic is already written out next to the rows.
      summary: `${filtered.length} of ${totalSpeakers} confirmed speaker(s) returned — filter: ${filterDescription}. Across the whole roster: ${withOpenTasks} with open tasks, ${withProfileGaps} with an incomplete profile, ${withEither} with either.`,
      filter: {
        onlyWithOutstandingWork: onlyOpenTasks,
        includeProfileGaps: includeGaps,
        means: filterDescription,
      },
      totalSpeakers,
      returned: filtered.length,
      withOpenTasks,
      withProfileGaps,
      withOpenTasksOrProfileGaps: withEither,
      // Kept for callers written against the old shape; it has always meant
      // "rows in this response".
      speakerCount: filtered.length,
      speakers: filtered,
    }
  },
})

async function findPerson(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  ref: string,
): Promise<Doc<"people">> {
  const trimmed = ref.trim()
  const asId = ctx.db.normalizeId("people", trimmed)
  if (asId) {
    const byId = await ctx.db.get(asId)
    if (byId && byId.eventId === eventId) return byId
  }
  const byEmail = await ctx.db
    .query("people")
    .withIndex("by_eventId_and_email", (q) =>
      q.eq("eventId", eventId).eq("email", trimmed.toLowerCase()),
    )
    .unique()
  if (byEmail) return byEmail
  throw new ConvexError(
    `No speaker matching "${ref}" in this event. Use list_speakers to see emails.`,
  )
}

export const speakerPortalLink = internalQuery({
  args: { userId: v.string(), event: v.string(), speaker: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const person = await findPerson(ctx, event._id, args.speaker)
    return withLinkWarning({
      personId: person._id,
      name: personName(person),
      email: person.email,
      portalUrl: portalLinkFor(person.portalToken),
      note: "A private magic link — it signs this speaker straight into their portal. Share it only with them.",
    })
  },
})

export const assignTask = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    speakers: v.array(v.string()),
    title: v.string(),
    kind: v.optional(v.string()),
    instructions: v.optional(v.string()),
    dueAt: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const title = args.title.trim()
    if (!title) throw new ConvexError("A task title is required.")
    const kind = assertTaskKind(args.kind ?? "confirm")
    if (args.speakers.length === 0) {
      throw new ConvexError("Assign the task to at least one speaker.")
    }
    const assigned: Array<string> = []
    for (const ref of args.speakers) {
      const person = await findPerson(ctx, event._id, ref)
      await ctx.db.insert("tasks", {
        eventId: event._id,
        personId: person._id,
        title,
        instructions: args.instructions,
        kind,
        dueAt: args.dueAt,
        // Match the organizer UI: a profile task assigned to somebody whose
        // profile is already complete is born complete, whichever API surface
        // assigned it. Otherwise MCP-created tasks could demand work the
        // speaker has no remaining way to do.
        completedAt:
          kind === "profile" && personProfileComplete(person)
            ? Date.now()
            : undefined,
      })
      assigned.push(person.email)
    }
    return {
      created: assigned.length,
      title,
      kind,
      dueAt: iso(args.dueAt),
      assignedTo: assigned,
      note: "Speakers see this in their portal. Use send_reminders to nudge them by email.",
    }
  },
})

// ——— The task library (convex/tasksAdmin.ts template functions) ——————————
// An organizer writes "Upload your slides" once and assigns it all season.
// These three tools are the MCP half of that: read the library, save wording
// into it, and assign a saved task to a batch of speakers.

/** Every task kind a portal can actually complete. Mirrors tasksAdmin. */
function assertTaskKind(kind: string): string {
  // "form" is intentionally not offered: nothing in the portal ever read it —
  // "answer" (the speaker types a reply) is what replaced it.
  if (!TASK_KINDS.includes(kind)) {
    throw new ConvexError(
      `Invalid task kind "${kind}". One of: ${TASK_KINDS.join(", ")}.`,
    )
  }
  return kind
}

export const listTaskLibrary = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const templates = await ctx.db
      .query("taskTemplates")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(200)
    return {
      event: { eventId: event._id, name: event.name, slug: event.slug },
      templates: templates
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((template) => ({
          templateId: template._id,
          title: template.title,
          alias: template.alias ?? null,
          kind: template.kind,
          instructions: template.instructions ?? null,
        })),
      note:
        templates.length === 0
          ? "The library is empty — save_task_template writes the first entry."
          : "Assign one with assign_task_from_template (the wording is copied onto each speaker's task).",
    }
  },
})

export const saveTaskTemplate = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    title: v.string(),
    kind: v.optional(v.string()),
    instructions: v.optional(v.string()),
    alias: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const title = args.title.trim()
    if (!title) throw new ConvexError("A task title is required.")
    // Idempotent on the title, exactly like the "save to library" tick in the
    // assign-task dialog: saving twice edits the wording instead of piling up
    // near-duplicates a model would then have to disambiguate.
    const existing = await ctx.db
      .query("taskTemplates")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(200)
    const match = existing.find(
      (template) => template.title.toLowerCase() === title.toLowerCase(),
    )
    const kind = assertTaskKind(args.kind ?? match?.kind ?? "confirm")
    const instructions = args.instructions?.trim() || undefined
    const alias = args.alias?.trim() || undefined
    if (match) {
      await ctx.db.patch(match._id, {
        title,
        kind,
        ...(args.instructions !== undefined ? { instructions } : {}),
        ...(args.alias !== undefined ? { alias } : {}),
      })
      return {
        templateId: match._id,
        title,
        kind,
        updated: true,
        note: `"${title}" was already in the library — its wording is updated. Tasks already assigned keep the words they were sent with.`,
      }
    }
    const templateId = await ctx.db.insert("taskTemplates", {
      eventId: event._id,
      title,
      instructions,
      kind,
      alias,
    })
    return {
      templateId,
      title,
      kind,
      updated: false,
      note: "Saved to the library. Assign it with assign_task_from_template.",
    }
  },
})

export const assignTaskFromTemplate = internalMutation({
  args: {
    userId: v.string(),
    template: v.string(),
    speakers: v.array(v.string()),
    dueAt: v.optional(v.number()),
    submissionId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const templateId = ctx.db.normalizeId("taskTemplates", args.template.trim())
    const template = templateId ? await ctx.db.get(templateId) : null
    if (!template) {
      throw new ConvexError(
        `No task template "${args.template}". Call list_task_library for the ids.`,
      )
    }
    await eventAccessFor(ctx, args.userId, template.eventId)
    if (args.speakers.length === 0) {
      throw new ConvexError("Assign the task to at least one speaker.")
    }
    // A task may only point at a session of THIS event, otherwise a stale id
    // would file a speaker's uploads under someone else's programme.
    let submissionId: Id<"submissions"> | undefined
    if (args.submissionId) {
      const id = requireId(ctx, "submissions", args.submissionId)
      const submission = await ctx.db.get(id)
      if (!submission || submission.eventId !== template.eventId) {
        throw new ConvexError("That session doesn't belong to this event.")
      }
      submissionId = submission._id
    }
    // The template's own wording is COPIED onto each task, so editing the
    // library later never rewrites tasks already out in the world.
    const title = template.alias?.trim() || template.title
    const assigned: Array<string> = []
    for (const ref of args.speakers) {
      const person = await findPerson(ctx, template.eventId, ref)
      await ctx.db.insert("tasks", {
        eventId: template.eventId,
        personId: person._id,
        title,
        instructions: template.instructions,
        kind: template.kind,
        submissionId,
        dueAt: args.dueAt,
        completedAt:
          template.kind === "profile" && personProfileComplete(person)
            ? Date.now()
            : undefined,
      })
      assigned.push(person.email)
    }
    return {
      created: assigned.length,
      templateId: template._id,
      title,
      kind: template.kind,
      dueAt: iso(args.dueAt),
      assignedTo: assigned,
      note: "Speakers see this in their portal immediately. Use send_reminders to nudge them by email.",
    }
  },
})

export const sendReminders = internalMutation({
  args: { userId: v.string(), event: v.string(), dueWithinDays: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const result = await queueTaskReminders(ctx, {
      eventId: event._id,
      now: Date.now(),
      dueWithinMs:
        args.dueWithinDays !== undefined
          ? args.dueWithinDays * 24 * 60 * 60 * 1000
          : undefined,
    })
    if (result.queued > 0) {
      await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    }
    return {
      queued: result.queued,
      skipped: result.skipped,
      note: "Skipped speakers were already reminded in the last 20 hours. Check list_outbox for delivery status.",
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Comms
// ══════════════════════════════════════════════════════════════════════════

export const listTemplates = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const stored = await ctx.db
      .query("emailTemplates")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(200)
    const byKey = new Map(stored.map((row) => [row.key, row]))
    // Five full email bodies is several KB of prose the model then compresses
    // lossily. The list carries subjects and a preview; get_template is the
    // named call for the one body a caller actually wants to read or rewrite.
    const preview = (body: string) => ({
      bodyPreview:
        body.length > TEMPLATE_PREVIEW_CHARS
          ? `${body.slice(0, TEMPLATE_PREVIEW_CHARS)}…`
          : body,
      bodyLength: body.length,
      bodyTruncated: body.length > TEMPLATE_PREVIEW_CHARS,
    })
    const rows = stored.map((row) => ({
      key: row.key,
      name: row.name,
      subject: row.subject,
      ...preview(row.body),
      customized: true,
    }))
    for (const template of DEFAULT_TEMPLATES) {
      if (byKey.has(template.key)) continue
      rows.push({
        key: template.key,
        name: template.name,
        subject: template.subject,
        ...preview(template.body),
        customized: false,
      })
    }
    return {
      templateCount: rows.length,
      templates: rows,
      variables: [...TEMPLATE_VARIABLES],
      note: "Bodies are previewed to the first 200 characters — call get_template for the full text of one. Placeholders use {{variable}} syntax and are filled in when the email is queued.",
    }
  },
})

export const getTemplate = internalQuery({
  args: { userId: v.string(), event: v.string(), key: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const key = args.key.trim()
    if (!(TEMPLATE_KEYS as ReadonlyArray<string>).includes(key)) {
      throw new ConvexError(
        `Unknown template key "${args.key}". One of: ${TEMPLATE_KEYS.join(", ")}.`,
      )
    }
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_eventId_and_key", (q) =>
        q.eq("eventId", event._id).eq("key", key),
      )
      .unique()
    const fallback = defaultTemplate(key)
    return {
      key,
      name: existing?.name ?? fallback.name,
      subject: existing?.subject ?? fallback.subject,
      body: existing?.body ?? fallback.body,
      customized: existing !== null,
      variables: [...TEMPLATE_VARIABLES],
      note: "Rewrite it with update_template, then proof it with send_test_email.",
    }
  },
})

export const updateTemplate = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    key: v.string(),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const key = args.key.trim()
    // Templates are a closed set: the Communications screen only renders these
    // five, and anything else would be an invisible row that never sends.
    if (!(TEMPLATE_KEYS as ReadonlyArray<string>).includes(key)) {
      throw new ConvexError(
        `Unknown template key "${args.key}". One of: ${TEMPLATE_KEYS.join(", ")}.`,
      )
    }
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_eventId_and_key", (q) =>
        q.eq("eventId", event._id).eq("key", key),
      )
      .unique()
    const fallback = defaultTemplate(key)
    const next = {
      name: args.name ?? existing?.name ?? fallback.name,
      subject: args.subject ?? existing?.subject ?? fallback.subject,
      body: args.body ?? existing?.body ?? fallback.body,
    }
    if (existing) {
      await ctx.db.patch(existing._id, next)
    } else {
      await ctx.db.insert("emailTemplates", { eventId: event._id, key, ...next })
    }
    return { key, ...next, note: "Preview it with send_test_email before it goes out for real." }
  },
})

export const listOutbox = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
    let rows = await ctx.db
      .query("messages")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .order("desc")
      .take(500)
    if (args.status) rows = rows.filter((row) => row.status === args.status)
    const counts: Record<string, number> = {}
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1
    return {
      counts,
      messages: rows.slice(0, limit).map((row) => ({
        to: row.toEmail,
        subject: row.subject,
        templateKey: row.templateKey ?? null,
        status: row.status,
        calendarInviteAttached: row.icsAttached,
        sentAt: iso(row.sentAt),
        error: row.error ?? null,
      })),
      note: '"preview" means it was rendered but not actually mailed — demo recipients (@example.com) and deployments without RESEND_API_KEY never send.',
    }
  },
})

export const sendTestEmail = internalMutation({
  args: { userId: v.string(), event: v.string(), key: v.string(), to: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    if (!(TEMPLATE_KEYS as ReadonlyArray<string>).includes(args.key.trim())) {
      throw new ConvexError(
        `Unknown template key "${args.key}". One of: ${TEMPLATE_KEYS.join(", ")}.`,
      )
    }
    const member = await membershipFor(ctx, args.userId, event.organizationId!)
    const toEmail = (args.to ?? member.email).trim()

    // Render against a real person so the placeholders resolve to real copy.
    let recipient = await ctx.db
      .query("people")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .first()
    if (!recipient) {
      const personId = await ctx.db.insert("people", {
        eventId: event._id,
        email: member.email,
        firstName: "Organizer",
        lastName: "",
        portalToken: randomToken(),
      })
      recipient = await ctx.db.get(personId)
    }
    const submission = await ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", recipient!._id))
      .first()

    const messageId = await queueMessage(ctx, {
      eventId: event._id,
      personId: recipient!._id,
      templateKey: args.key,
      submissionId: submission?._id,
      extraVars: submission ? undefined : { sessionTitle: "Your session title" },
      toEmailOverride: toEmail,
    })
    await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    const queued = await ctx.db.get(messageId)
    return {
      to: toEmail,
      templateKey: args.key,
      subject: queued?.subject,
      body: queued?.body,
      note: "Queued for delivery. Check list_outbox for the final status.",
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Deletion
//
// The live-fire test's one real gap in "do everything via MCP": an operator
// could create events, forms and tasks and never remove any of them, so
// cleaning up needed a direct Convex call outside MCP. These close that gap
// WITHOUT becoming the thing that lets a confused model wipe a conference —
// each one reuses the same semantics (and, for events, the same code path) as
// the web app's own delete, and the destructive end of the range is guarded
// twice over: admin role, `confirm: true`, and the event's own name echoed
// back.
// ══════════════════════════════════════════════════════════════════════════

export const deleteEvent = internalMutation({
  args: { userId: v.string(), event: v.string(), confirmName: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event, "admin")
    if (args.confirmName.trim() !== event.name.trim()) {
      // Deliberately does NOT quote the correct name back: the whole point of
      // the echo is that the caller already knows which event it is holding.
      throw new ConvexError(
        `confirmName "${args.confirmName}" does not match this event's name. Pass the event's name exactly as list_events returns it — nothing was deleted.`,
      )
    }
    // A receipt: what the cascade is about to destroy, counted before it goes.
    const stats = await eventStats(ctx, event)
    const people = await ctx.db
      .query("people")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    const removed = {
      submissions: stats.submissions.length,
      forms: stats.forms.length,
      people: people.length,
      tasks: stats.tasks.length,
      rooms: rooms.length,
    }
    // The identical cascade the web app runs (convex/events.ts), including the
    // storage sweep — an MCP delete must not leave orphaned blobs behind.
    await deleteEventCascade(ctx, event._id)
    return {
      deleted: true,
      eventId: event._id,
      name: event.name,
      slug: event.slug,
      removed,
      note: "The event and everything belonging to it (submissions, speakers, forms, tasks, uploads, emails) are gone. This cannot be undone.",
    }
  },
})

export const deleteForm = internalMutation({
  args: { userId: v.string(), form: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const form = await resolveForm(ctx, args.userId, args.form, "admin")
    // Same rule as forms.remove: a form that collected anything LIVE is
    // history, not clutter. Drafts count — a speaker is mid-submission behind
    // them. Trashed entries do not: they already left the organizer's view, so
    // they are orphaned (formId cleared) rather than blocking the delete.
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_formId", (q) => q.eq("formId", form._id))
      .take(MAX_ROWS)
    const live = submissions.filter((s) => s.deletedAt === undefined)
    if (live.length > 0) {
      throw new ConvexError(
        `"${form.internalName}" has ${live.length} submission(s) and cannot be deleted — deleting it would destroy them. Close it instead: update_form_settings(form: "${form.slug}", status: "closed").`,
      )
    }
    const orphaned = submissions.filter((s) => s.deletedAt !== undefined)
    for (const submission of orphaned) {
      await ctx.db.patch(submission._id, { formId: undefined })
    }
    await ctx.db.delete(form._id)
    return {
      deleted: true,
      formId: form._id,
      name: form.internalName,
      slug: form.slug,
      orphanedTrashedSubmissions: orphaned.length,
      note: "The form is gone. Its public URL now 404s.",
    }
  },
})

export const removeTask = internalMutation({
  args: { userId: v.string(), taskId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = requireId(ctx, "tasks", args.taskId)
    const task = await ctx.db.get(id)
    if (!task) throw new ConvexError("Task not found — it may already have been removed.")
    // tasksAdmin.remove is admin-only; an MCP caller gets no cheaper bar.
    await eventAccessFor(ctx, args.userId, task.eventId, "admin")
    const person = await ctx.db.get(task.personId)
    await ctx.db.delete(id)
    return {
      removed: true,
      taskId: id,
      title: task.title,
      speaker: person ? person.email : null,
      wasCompleted: task.completedAt !== undefined,
      note: "It has disappeared from that speaker's portal. Re-create it with assign_task if that was a mistake.",
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Meta
// ══════════════════════════════════════════════════════════════════════════

export const eventSummary = internalQuery({
  args: { userId: v.string(), event: v.string(), now: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    return await eventSummaryPayload(ctx, event, args.now)
  },
})

/**
 * THE one event read-model: the narrative summary AND every dashboard number
 * `get_event_overview` used to return on its own (total submissions, open task
 * count, conflict count, outbox counts by status, forms with ids and links).
 *
 * Field names are deliberately normalised against the rest of the surface —
 * `closeAt` (never `closesAt`, which `list_forms`/`get_form` never used) and
 * `acceptedNotScheduled` (never `acceptedNotYetScheduled`) — because a model
 * that meets the same value under two names hedges instead of answering.
 */
async function eventSummaryPayload(
  ctx: QueryCtx,
  event: Doc<"events">,
  now: number,
) {
  const stats = await eventStats(ctx, event)
  const conflicts = await computeConflicts(ctx, event._id)
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(MAX_ROWS)
  const outboxByStatus: Record<string, number> = {}
  for (const message of messages) {
    outboxByStatus[message.status] = (outboxByStatus[message.status] ?? 0) + 1
  }

  const pending = stats.statusCounts.pending
  const acceptQueue = stats.statusCounts.accept_queue
  const declineQueue = stats.statusCounts.decline_queue

  const needsAttention: Array<string> = []
  if (pending > 0) needsAttention.push(`${pending} submission(s) still pending review`)
  if (acceptQueue > 0) {
    needsAttention.push(
      `${acceptQueue} staged in the accept queue — commit_decision_queue sends the acceptance emails`,
    )
  }
  if (declineQueue > 0) {
    needsAttention.push(`${declineQueue} staged in the decline queue`)
  }
  if (stats.unscheduledAccepted > 0) {
    needsAttention.push(
      `${stats.unscheduledAccepted} accepted session(s) not on the agenda yet — try auto_place_sessions`,
    )
  }
  if (conflicts.length > 0) {
    needsAttention.push(`${conflicts.length} agenda conflict(s) to resolve`)
  }
  if (stats.openTasks.length > 0) {
    needsAttention.push(
      `${stats.openTasks.length} outstanding speaker task(s) — send_reminders will nudge them`,
    )
  }

  const deadlines: Array<{ what: string; when: string; daysAway: number }> = []
  for (const form of stats.forms) {
    if (form.closeAt === undefined) continue
    deadlines.push({
      what: `CFP "${form.internalName}" closes`,
      when: new Date(form.closeAt).toISOString(),
      daysAway: Math.round((form.closeAt - now) / 86_400_000),
    })
  }
  for (const task of stats.openTasks) {
    if (task.dueAt === undefined) continue
    deadlines.push({
      what: `Speaker task "${task.title}" due`,
      when: new Date(task.dueAt).toISOString(),
      daysAway: Math.round((task.dueAt - now) / 86_400_000),
    })
  }
  if (event.startsAt !== undefined) {
    deadlines.push({
      what: `${event.name} starts`,
      when: new Date(event.startsAt).toISOString(),
      daysAway: Math.round((event.startsAt - now) / 86_400_000),
    })
  }
  deadlines.sort((a, b) => a.daysAway - b.daysAway)

  const workspaceSlug = await workspaceSlugForEvent(ctx, event)

  const headline =
    `${event.name} — ${stats.submissions.length} submission(s): ` +
    `${stats.statusCounts.accepted} accepted, ${pending} pending, ` +
    `${stats.statusCounts.declined} declined. ` +
    `${stats.scheduledCount} session(s) scheduled across ${stats.forms.length} form(s).`

  return withLinkWarning({
    headline,
    event: {
      eventId: event._id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      startsAt: iso(event.startsAt),
      endsAt: iso(event.endsAt),
      venue: event.venue ?? null,
    },
    totalSubmissions: stats.submissions.length,
    submissions: stats.statusCounts,
    agenda: {
      scheduled: stats.scheduledCount,
      acceptedNotScheduled: stats.unscheduledAccepted,
      conflictCount: conflicts.length,
      conflicts: conflicts.map((c) => c.label),
    },
    speakerTasks: {
      open: stats.openTasks.length,
      completed: stats.tasks.length - stats.openTasks.length,
    },
    outbox: outboxByStatus,
    forms: stats.forms.map((form) => ({
      formId: form._id,
      name: form.internalName,
      slug: form.slug,
      status: form.status,
      closeAt: iso(form.closeAt),
      publicUrl: `${siteUrl()}${formPath(workspaceSlug, event.slug, form.slug)}`,
    })),
    needsAttention:
      needsAttention.length > 0
        ? needsAttention
        : ["Nothing outstanding — you're in good shape."],
    upcomingDeadlines: deadlines.slice(0, 8),
  })
}

// ══════════════════════════════════════════════════════════════════════════
// Full-proxy surfaces the REST data layer doesn't carry
//
// Everything below exists because the organizer app can do it and the MCP
// must too (Marko's full-proxy directive): workspace membership, the files
// review gate, the bulk composer, evaluation distribution/reminders, embeds,
// and the activity feed. Where convex/apiV1.ts already has an internal
// function for a capability, the tool wraps THAT instead — these are only the
// leftovers.
// ══════════════════════════════════════════════════════════════════════════

/** Resolve a workspace the caller belongs to, by id, slug, or uniqueness. */
async function resolveWorkspace(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  ref: string | undefined,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<{ member: Doc<"members">; org: Doc<"organizations"> }> {
  const memberships = await ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()
  const rows: Array<{ member: Doc<"members">; org: Doc<"organizations"> }> = []
  for (const member of memberships) {
    const org = await ctx.db.get(member.organizationId)
    if (org) rows.push({ member, org })
  }
  let picked: { member: Doc<"members">; org: Doc<"organizations"> } | undefined
  if (ref) {
    const needle = ref.trim().toLowerCase()
    picked = rows.find(
      (row) => row.org._id === ref.trim() || row.org.slug === needle,
    )
    if (!picked) {
      throw new ConvexError(
        `No workspace matches "${ref}". Call list_workspaces to see yours.`,
      )
    }
  } else {
    if (rows.length === 0) throw new ConvexError("You don't belong to a workspace yet.")
    if (rows.length > 1) {
      throw new ConvexError(
        "You belong to several workspaces — pass `workspace` (id or slug, see list_workspaces).",
      )
    }
    picked = rows[0]
  }
  const order: Record<string, number> = { member: 0, admin: 1, owner: 2 }
  const has = order[picked.member.role] ?? 0
  if (has < order[minRole]) {
    throw new ConvexError(
      `This needs the ${minRole} role in "${picked.org.name}"; you are a ${picked.member.role}.`,
    )
  }
  return picked
}

export const listWorkspaceMembers = internalQuery({
  args: { userId: v.string(), workspace: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { org } = await resolveWorkspace(ctx, args.userId, args.workspace)
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .collect()
    const rows = []
    for (const member of members) {
      let eventScope: Array<string> | null = null
      if (member.eventIds !== undefined) {
        eventScope = []
        for (const eventId of member.eventIds) {
          const event = await ctx.db.get(eventId)
          if (event) eventScope.push(event.name)
        }
      }
      rows.push({
        memberId: member._id,
        email: member.email,
        role: member.role,
        accepted: member.userId !== "",
        /** null ⇒ every event in the workspace, now and in future. */
        eventScope,
      })
    }
    rows.sort((a, b) => a.email.localeCompare(b.email))
    return {
      workspace: { organizationId: org._id, name: org.name, slug: org.slug },
      memberCount: rows.length,
      members: rows,
    }
  },
})

/** Turn caller-supplied event refs (ids or slugs) into checked event ids. */
async function eventScopeIds(
  ctx: MutationCtx,
  org: Doc<"organizations">,
  refs: Array<string>,
): Promise<Array<Id<"events">>> {
  const ids: Array<Id<"events">> = []
  for (const ref of refs) {
    const asId = ctx.db.normalizeId("events", ref.trim())
    let event = asId ? await ctx.db.get(asId) : null
    if (!event) {
      const candidates = await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", ref.trim().toLowerCase()))
        .take(20)
      event = candidates.find((row) => row.organizationId === org._id) ?? null
    }
    if (!event || event.organizationId !== org._id) {
      throw new ConvexError(`"${ref}" isn't an event of the "${org.name}" workspace.`)
    }
    if (!ids.includes(event._id)) ids.push(event._id)
  }
  return ids
}

export const inviteWorkspaceMember = internalMutation({
  args: {
    userId: v.string(),
    workspace: v.optional(v.string()),
    email: v.string(),
    role: v.string(),
    eventRefs: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { member: inviter, org } = await resolveWorkspace(
      ctx,
      args.userId,
      args.workspace,
      "admin",
    )
    if (!["admin", "member"].includes(args.role)) {
      throw new ConvexError("role must be 'admin' or 'member'.")
    }
    const email = args.email.toLowerCase().trim()
    if (!email.includes("@")) throw new ConvexError("Pass a real email address.")
    const existing = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .collect()
    if (existing.some((m) => m.email === email)) {
      throw new ConvexError(`${email} is already a member of "${org.name}".`)
    }
    // Same rule as the workspace screen: only plain members can be scoped.
    const scoped =
      args.role === "member" && args.eventRefs !== undefined
        ? await eventScopeIds(ctx, org, args.eventRefs)
        : undefined
    if (scoped !== undefined && scoped.length === 0) {
      throw new ConvexError("Pick at least one event, or omit eventRefs for all events.")
    }
    await ctx.db.insert("members", {
      organizationId: org._id,
      userId: "",
      email,
      role: args.role,
      ...(scoped !== undefined ? { eventIds: scoped } : {}),
    })
    let eventScope: string | undefined
    if (scoped !== undefined) {
      eventScope =
        scoped.length === 1
          ? ((await ctx.db.get(scoped[0]))?.name ?? "1 event")
          : `${scoped.length} events`
    }
    await ctx.scheduler.runAfter(0, internal.platformEmails.sendWorkspaceInvite, {
      organizationId: org._id,
      toEmail: email,
      workspaceName: org.name,
      inviterName: inviter.email,
      role: args.role,
      ...(eventScope ? { eventScope } : {}),
    })
    return {
      invited: email,
      role: args.role,
      workspace: org.name,
      eventScope: eventScope ?? "all events",
      note: "An invite email is on its way. Their access starts the moment they sign up with this address.",
    }
  },
})

export const updateWorkspaceMember = internalMutation({
  args: {
    userId: v.string(),
    memberId: v.string(),
    role: v.optional(v.string()),
    /** Event ids/slugs to limit them to; empty array clears the limit. */
    eventRefs: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("members", args.memberId.trim())
    const target = id ? await ctx.db.get(id) : null
    if (!target) throw new ConvexError("Member not found — see list_workspace_members.")
    const org = await ctx.db.get(target.organizationId)
    if (!org) throw new ConvexError("Workspace not found.")

    if (args.role !== undefined) {
      // Role changes are the owner's call, exactly like the workspace screen.
      await resolveWorkspace(ctx, args.userId, org._id, "owner")
      if (!["admin", "member"].includes(args.role)) {
        throw new ConvexError("role must be 'admin' or 'member'.")
      }
      if (target.role === "owner") throw new ConvexError("Owners keep the owner role.")
      await ctx.db.patch(target._id, {
        role: args.role,
        // Admins are never event-scoped.
        ...(args.role === "admin" ? { eventIds: undefined } : {}),
      })
    }
    if (args.eventRefs !== undefined) {
      await resolveWorkspace(ctx, args.userId, org._id, "admin")
      const fresh = await ctx.db.get(target._id)
      if (args.eventRefs.length === 0) {
        await ctx.db.patch(target._id, { eventIds: undefined })
      } else {
        if (fresh && (fresh.role === "owner" || fresh.role === "admin")) {
          throw new ConvexError(
            "Owners and admins always see every event. Change their role to member first.",
          )
        }
        const scoped = await eventScopeIds(ctx, org, args.eventRefs)
        await ctx.db.patch(target._id, { eventIds: scoped })
      }
    }
    if (args.role === undefined && args.eventRefs === undefined) {
      throw new ConvexError("Nothing to change — pass role and/or eventRefs.")
    }
    const updated = await ctx.db.get(target._id)
    return {
      memberId: target._id,
      email: target.email,
      role: updated?.role,
      eventScope:
        updated?.eventIds === undefined ? "all events" : `${updated.eventIds.length} event(s)`,
    }
  },
})

export const removeWorkspaceMember = internalMutation({
  args: { userId: v.string(), memberId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("members", args.memberId.trim())
    const target = id ? await ctx.db.get(id) : null
    if (!target) throw new ConvexError("Member not found — see list_workspace_members.")
    const { member } = await resolveWorkspace(
      ctx,
      args.userId,
      target.organizationId,
      "admin",
    )
    if (target._id === member._id) throw new ConvexError("You can't remove yourself.")
    if (target.role === "owner") throw new ConvexError("Owners can't be removed.")
    await ctx.db.delete(target._id)
    return {
      removed: true,
      email: target.email,
      note: "Their access ended immediately. Invite them again with invite_workspace_member if needed.",
    }
  },
})

/**
 * Rename / re-address a workspace — mirrors convex/workspaces.ts::update.
 *
 * The slug is the FIRST segment of every canonical app and public address, so
 * it follows the same rule as event slugs: a taken or reserved address is
 * auto-suffixed rather than refused, and the caller is told what it actually
 * became (never left guessing at a URL that doesn't exist).
 */
export const updateWorkspace = internalMutation({
  args: {
    userId: v.string(),
    workspace: v.optional(v.string()),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { org } = await resolveWorkspace(
      ctx,
      args.userId,
      args.workspace,
      "admin",
    )
    if (args.name === undefined && args.slug === undefined) {
      throw new ConvexError("Nothing to change — pass name and/or slug.")
    }
    if (args.name !== undefined && !args.name.trim()) {
      throw new ConvexError("Workspace name can't be empty.")
    }

    let slug: string | undefined
    if (args.slug !== undefined) {
      const desired = args.slug.trim().toLowerCase()
      if (!desired) throw new ConvexError("Workspace address can't be empty.")
      slug =
        desired === org.slug
          ? org.slug
          : await uniqueWorkspaceSlug(ctx, desired, org._id)
    }
    const slugAdjusted =
      slug !== undefined && slug !== args.slug!.trim().toLowerCase()

    await ctx.db.patch(org._id, {
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(slug !== undefined ? { slug } : {}),
    })
    const live = slug ?? org.slug
    return {
      organizationId: org._id,
      name: args.name?.trim() ?? org.name,
      slug: live,
      slugAdjusted,
      url: `${siteUrl()}/app/${live}`,
      note: slugAdjusted
        ? `"${args.slug!.trim().toLowerCase()}" was taken, so the workspace now lives at "${live}". Every existing link with the old address stops working.`
        : slug !== undefined && slug !== org.slug
          ? "Every existing link that used the old workspace address stops working."
          : undefined,
    }
  },
})

/**
 * Rotate an evaluator's magic-link token — mirrors
 * convex/evaluationsAdmin.ts::rotateEvaluatorToken.
 *
 * The token IS the evaluator's credential (there is no password), so this is
 * the only way to revoke a leaked or forwarded review link without deleting
 * the evaluator and their scores.
 */
export const rotateEvaluatorToken = internalMutation({
  args: { userId: v.string(), evaluatorId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("evaluators", args.evaluatorId.trim())
    const evaluator = id ? await ctx.db.get(id) : null
    if (!evaluator) {
      throw new ConvexError(
        "That evaluator no longer exists — see get_evaluation_plan for current evaluator ids.",
      )
    }
    await eventAccessFor(ctx, args.userId, evaluator.eventId, "admin")
    const token = randomToken()
    await ctx.db.patch(evaluator._id, { token })
    return {
      evaluatorId: evaluator._id,
      email: evaluator.email,
      name: evaluator.name,
      reviewUrl: `${siteUrl()}/review/${token}`,
      note: "The old link stopped working immediately. Send them this one — their scores so far are untouched.",
    }
  },
})

// ——— Files review (mirrors tasksAdmin.listUploads / reviewUpload) ————————

const APPROVAL_STATUSES = ["pending", "approved", "changes_requested"]

export const listFiles = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    approvalStatus: v.optional(v.string()),
    speaker: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    if (
      args.approvalStatus !== undefined &&
      !APPROVAL_STATUSES.includes(args.approvalStatus)
    ) {
      throw new ConvexError(
        `Invalid approvalStatus. One of: ${APPROVAL_STATUSES.join(", ")}.`,
      )
    }
    let uploads = await ctx.db
      .query("uploads")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    if (args.speaker) {
      const person = await findPerson(ctx, event._id, args.speaker)
      uploads = uploads.filter((u) => u.personId === person._id)
    }
    if (args.approvalStatus) {
      uploads = uploads.filter((u) => u.approvalStatus === args.approvalStatus)
    }
    uploads.sort((a, b) => b._creationTime - a._creationTime)
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200)
    const counts: Record<string, number> = {}
    for (const u of uploads) counts[u.approvalStatus] = (counts[u.approvalStatus] ?? 0) + 1
    const rows = []
    for (const upload of uploads.slice(0, limit)) {
      const person = await ctx.db.get(upload.personId)
      const task = upload.taskId ? await ctx.db.get(upload.taskId) : null
      const submissionId = upload.submissionId ?? task?.submissionId
      const submission = submissionId ? await ctx.db.get(submissionId) : null
      rows.push({
        fileId: upload._id,
        filename: upload.filename,
        version: upload.version,
        approvalStatus: upload.approvalStatus,
        reviewNote: upload.reviewNote ?? null,
        speaker: person ? `${personName(person)} <${person.email}>` : null,
        session: submission?.title ?? null,
        task: task?.title ?? null,
        uploadedAt: iso(upload._creationTime),
      })
    }
    return {
      total: uploads.length,
      returned: rows.length,
      countsByApprovalStatus: counts,
      files: rows,
      note: "Approve or reject one with review_file. Approved files are what public session pages may expose.",
    }
  },
})

export const reviewFile = internalMutation({
  args: {
    userId: v.string(),
    fileId: v.string(),
    approvalStatus: v.string(),
    reviewNote: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (!APPROVAL_STATUSES.includes(args.approvalStatus)) {
      throw new ConvexError(
        `Invalid approvalStatus. One of: ${APPROVAL_STATUSES.join(", ")}.`,
      )
    }
    const id = ctx.db.normalizeId("uploads", args.fileId.trim())
    const upload = id ? await ctx.db.get(id) : null
    if (!upload) throw new ConvexError("File not found — see list_files.")
    await eventAccessFor(ctx, args.userId, upload.eventId)
    await ctx.db.patch(upload._id, {
      approvalStatus: args.approvalStatus,
      reviewNote: args.reviewNote,
    })
    // Requesting changes reopens the task so the speaker sees it again —
    // identical to the organizer UI's review action.
    if (args.approvalStatus === "changes_requested" && upload.taskId) {
      await ctx.db.patch(upload.taskId, { completedAt: undefined })
    }
    const person = await ctx.db.get(upload.personId)
    return {
      fileId: upload._id,
      filename: upload.filename,
      approvalStatus: args.approvalStatus,
      reviewNote: args.reviewNote ?? null,
      speaker: person?.email ?? null,
      taskReopened: args.approvalStatus === "changes_requested" && Boolean(upload.taskId),
    }
  },
})

export const deleteFile = internalMutation({
  args: { userId: v.string(), fileId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("uploads", args.fileId.trim())
    const upload = id ? await ctx.db.get(id) : null
    if (!upload) throw new ConvexError("File not found — it may already be deleted.")
    await eventAccessFor(ctx, args.userId, upload.eventId, "admin")
    await deleteUploadRow(ctx, upload)
    return {
      deleted: true,
      fileId: id,
      filename: upload.filename,
      note: "The file row and its stored bytes are gone. This cannot be undone.",
    }
  },
})

// ——— Bulk composer (mirrors comms.recipientCount / composeBulk) ——————————

const BULK_FILTER_NAMES = ["all_speakers", "accepted", "incomplete_tasks", "manual"]

type BulkFilter = "all_speakers" | "accepted" | "incomplete_tasks" | "manual"

async function bulkAudience(
  ctx: QueryCtx | MutationCtx,
  event: Doc<"events">,
  filter: string,
  personRefs: Array<string> | undefined,
): Promise<Array<Id<"people">>> {
  if (!BULK_FILTER_NAMES.includes(filter)) {
    throw new ConvexError(
      `Invalid audience "${filter}". One of: ${BULK_FILTER_NAMES.join(", ")}.`,
    )
  }
  let personIds: Array<Id<"people">> | undefined
  if (filter === "manual") {
    if (!personRefs || personRefs.length === 0) {
      throw new ConvexError(
        "audience 'manual' needs `speakers` — emails or person ids from list_speakers.",
      )
    }
    personIds = []
    for (const ref of personRefs) {
      personIds.push((await findPerson(ctx, event._id, ref))._id)
    }
  }
  return await resolveBulkRecipients(
    ctx,
    event._id,
    filter as BulkFilter,
    personIds,
  )
}

export const countBulkAudience = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    audience: v.string(),
    speakers: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const ids = await bulkAudience(ctx, event, args.audience, args.speakers)
    const sample: Array<string> = []
    for (const personId of ids.slice(0, 10)) {
      const person = await ctx.db.get(personId)
      if (person) sample.push(person.email)
    }
    return {
      audience: args.audience,
      recipients: ids.length,
      sampleEmails: sample,
      note: "This is exactly who send_bulk_email would email with the same arguments.",
    }
  },
})

export const sendBulkEmail = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    audience: v.string(),
    subject: v.string(),
    body: v.string(),
    speakers: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const subject = args.subject.trim()
    const body = args.body.trim()
    if (!subject) throw new ConvexError("Add a subject line.")
    if (!body) throw new ConvexError("Write a message body before sending.")
    const recipients = await bulkAudience(ctx, event, args.audience, args.speakers)
    if (recipients.length === 0) {
      throw new ConvexError("Nobody matches that audience — pick a different one.")
    }
    let queued = 0
    for (const personId of recipients) {
      await queueMessage(ctx, {
        eventId: event._id,
        personId,
        templateKey: "custom-bulk",
        override: { subject, body },
      })
      queued++
    }
    await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    return {
      queued,
      recipients: recipients.length,
      subject,
      note: "Each recipient gets their own copy with {{firstName}} etc. resolved. Track delivery with list_outbox.",
    }
  },
})

// ——— Evaluation: distribute + remind (mirror evaluationsAdmin) ———————————

async function planFor(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  planRef: string,
): Promise<Doc<"evaluationPlans">> {
  const id = ctx.db.normalizeId("evaluationPlans", planRef.trim())
  const plan = id ? await ctx.db.get(id) : null
  if (!plan) {
    throw new ConvexError("No such evaluation plan — see list_evaluation_plans.")
  }
  await eventAccessFor(ctx, userId, plan.eventId)
  return plan
}

export const distributeEvaluations = internalMutation({
  args: {
    userId: v.string(),
    planId: v.string(),
    perReviewerCap: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const plan = await planFor(ctx, args.userId, args.planId)
    const cap = args.perReviewerCap
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
      throw new ConvexError("perReviewerCap must be a whole number, 1 or more.")
    }
    const evaluators = await ctx.db
      .query("evaluators")
      .withIndex("by_planId", (q) => q.eq("planId", plan._id))
      .take(MAX_ROWS)
    if (evaluators.length === 0) {
      throw new ConvexError("Add at least one evaluator (add_evaluator) before distributing.")
    }
    // Stable order so re-running the same distribution gives the same result —
    // identical to the Evaluation screen's own auto-distribute.
    evaluators.sort((a, b) => a.email.localeCompare(b.email))
    const buckets = new Map<string, Array<Id<"submissions">>>(
      evaluators.map((evaluator) => [evaluator._id, []]),
    )
    let cursor = 0
    let assigned = 0
    for (const submissionId of plan.submissionIds) {
      let placed = false
      for (let step = 0; step < evaluators.length; step++) {
        const evaluator = evaluators[(cursor + step) % evaluators.length]
        const bucket = buckets.get(evaluator._id)
        if (bucket === undefined) continue
        if (cap !== undefined && bucket.length >= cap) continue
        bucket.push(submissionId)
        cursor = (cursor + step + 1) % evaluators.length
        placed = true
        assigned += 1
        break
      }
      if (!placed) break
    }
    for (const evaluator of evaluators) {
      await ctx.db.patch(evaluator._id, {
        assignedSubmissionIds: buckets.get(evaluator._id) ?? [],
      })
    }
    return {
      plan: plan.name,
      assigned,
      unassigned: plan.submissionIds.length - assigned,
      evaluatorCount: evaluators.length,
      note:
        assigned < plan.submissionIds.length
          ? "Some submissions stayed unassigned — add evaluators or raise perReviewerCap, then run again."
          : "Every submission in the pool now has exactly one reviewer.",
    }
  },
})

export const remindEvaluators = internalMutation({
  args: { userId: v.string(), planId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const plan = await planFor(ctx, args.userId, args.planId)
    const event = await ctx.db.get(plan.eventId)
    if (!event?.organizationId) throw new ConvexError("Event not found.")
    const evaluators = await ctx.db
      .query("evaluators")
      .withIndex("by_planId", (q) => q.eq("planId", plan._id))
      .take(MAX_ROWS)
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_planId", (q) => q.eq("planId", plan._id))
      .take(MAX_ROWS)
    const now = Date.now()
    const recipients: Array<string> = []
    let skipped = 0
    for (const evaluator of evaluators) {
      const assigned = new Set<string>(
        evaluator.assignedSubmissionIds ?? plan.submissionIds,
      )
      const done = evaluations.filter(
        (row) =>
          row.evaluatorId === evaluator._id &&
          row.completedAt !== undefined &&
          assigned.has(row.submissionId),
      ).length
      const outstanding = assigned.size - done
      if (outstanding <= 0) {
        skipped += 1
        continue
      }
      await ctx.scheduler.runAfter(
        0,
        internal.platformEmails.sendEvaluatorReminder,
        {
          organizationId: event.organizationId,
          eventId: plan.eventId,
          toEmail: evaluator.email,
          evaluatorName: evaluator.name,
          eventName: event.name,
          planName: plan.name,
          outstanding,
          reviewToken: evaluator.token,
          dueAt: plan.dueAt,
        },
      )
      await ctx.db.patch(evaluator._id, { lastRemindedAt: now })
      recipients.push(evaluator.email)
    }
    return {
      plan: plan.name,
      reminded: recipients.length,
      skipped,
      recipients,
      note: "Each email carries that evaluator's own review link and their own outstanding count. Evaluators with nothing left were skipped.",
    }
  },
})

// ——— Task template deletion (completes the library CRUD) ————————————————

export const deleteTaskTemplate = internalMutation({
  args: { userId: v.string(), template: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("taskTemplates", args.template.trim())
    const template = id ? await ctx.db.get(id) : null
    if (!template) {
      throw new ConvexError(
        `No task template "${args.template}". Call list_task_library for the ids.`,
      )
    }
    await eventAccessFor(ctx, args.userId, template.eventId, "admin")
    await ctx.db.delete(template._id)
    return {
      deleted: true,
      templateId: id,
      title: template.title,
      note: "Removed from the library. Tasks already assigned from it keep their wording.",
    }
  },
})

// ——— Embeds (mirrors convex/embeds.ts) ——————————————————————————————————

export const listEmbedsQ = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const rows = await ctx.db
      .query("embeds")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(200)
    return {
      embedCount: rows.length,
      embeds: rows
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => ({
          embedId: row._id,
          name: row.name,
          widget: row.widget,
          // ABSENT ⇒ ON (convex/schema.ts): an embed saved before the off
          // switch existed is live, and an agent must not read the missing
          // field as "off" and tell the organizer their site is broken.
          enabled: row.enabled !== false,
          options: row.options,
        })),
      widgets: [...EMBED_WIDGETS],
      formats: [...EMBED_FORMATS],
      note: "Saved embed configurations for the event's public widgets. The Embeds page turns one into a copy-paste snippet.",
    }
  },
})

export const saveEmbedM = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    embedId: v.optional(v.string()),
    name: v.string(),
    widget: v.string(),
    format: v.optional(v.string()),
    track: v.optional(v.string()),
    hideDescriptions: v.optional(v.boolean()),
    hideSpeakers: v.optional(v.boolean()),
    hideImages: v.optional(v.boolean()),
    hideSearch: v.optional(v.boolean()),
    height: v.optional(v.number()),
    accent: v.optional(v.string()),
    showHeader: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const name = args.name.trim()
    if (!name) throw new ConvexError("Give this embed a name.")
    if (!(EMBED_WIDGETS as ReadonlyArray<string>).includes(args.widget)) {
      throw new ConvexError(
        `Unknown widget "${args.widget}". One of: ${EMBED_WIDGETS.join(", ")}.`,
      )
    }
    if (
      args.format !== undefined &&
      !(EMBED_FORMATS as ReadonlyArray<string>).includes(args.format)
    ) {
      throw new ConvexError(
        `Unknown format "${args.format}". One of: ${EMBED_FORMATS.join(", ")}.`,
      )
    }
    // Only the keys the caller actually passed. Merged over the saved options
    // on an update, because a model renaming an embed must not silently drop
    // the accent colour or the track pin the organizer set in the UI — every
    // argument here is optional, so a wholesale replace is a data-loss bug.
    const patch: Record<string, unknown> = {}
    for (const [key, value] of [
      ["format", args.format],
      ["track", args.track],
      ["hideDescriptions", args.hideDescriptions],
      ["hideSpeakers", args.hideSpeakers],
      ["hideImages", args.hideImages],
      ["hideSearch", args.hideSearch],
      ["height", args.height],
      ["showHeader", args.showHeader],
    ] as const) {
      if (value !== undefined) patch[key] = value
    }
    // Accent is the one field with a third state. Absent means "leave it"; an
    // EMPTY STRING means "remove the brand colour" — `validAccent` turns that
    // into undefined, and an undefined value in the merged object is how a
    // Convex document field gets dropped. Without this an accent set once
    // could never be cleared over MCP.
    if (args.accent !== undefined) patch.accent = validAccent(args.accent)

    if (args.embedId) {
      const id = ctx.db.normalizeId("embeds", args.embedId.trim())
      const existing = id ? await ctx.db.get(id) : null
      if (!existing || existing.eventId !== event._id) {
        throw new ConvexError("That saved embed belongs to a different event.")
      }
      const merged = { ...existing.options, ...patch }
      await ctx.db.patch(existing._id, {
        name,
        widget: args.widget,
        options: merged,
        // Saving never silently flips the switch (mirrors embeds.save).
        enabled: args.enabled ?? existing.enabled ?? true,
      })
      return {
        embedId: existing._id,
        name,
        widget: args.widget,
        enabled: args.enabled ?? existing.enabled ?? true,
        updated: true,
      }
    }
    const enabled = args.enabled ?? true
    const embedId = await ctx.db.insert("embeds", {
      eventId: event._id,
      name,
      widget: args.widget,
      options: patch,
      enabled,
    })
    return { embedId, name, widget: args.widget, enabled, updated: false }
  },
})

export const deleteEmbedM = internalMutation({
  args: { userId: v.string(), embedId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("embeds", args.embedId.trim())
    const embed = id ? await ctx.db.get(id) : null
    if (!embed) throw new ConvexError("Saved embed not found — see list_embeds.")
    await eventAccessFor(ctx, args.userId, embed.eventId)
    await ctx.db.delete(embed._id)
    return { deleted: true, embedId: id, name: embed.name }
  },
})

// ——— Activity feed (mirrors audit.feed, compact) ————————————————————————

export const listActivity = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    filter: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
    const fetch = Math.min(limit * 4, 400)
    let rows = await ctx.db
      .query("auditLog")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .order("desc")
      .take(fetch)
    if (args.filter === "agents") {
      rows = rows.filter(
        (row) => row.actorType === "mcp" || row.actorType === "api",
      )
    } else if (args.filter) {
      rows = rows.filter((row) => row.entity === args.filter)
    }
    return {
      returned: Math.min(rows.length, limit),
      activity: rows.slice(0, limit).map((row) => ({
        at: iso(row._creationTime),
        actor: row.actorLabel,
        actorType: row.actorType,
        entity: row.entity,
        action: row.action,
        summary: row.summary,
      })),
      note: 'filter: "agents" shows only MCP/API writes — including this session\'s own. Other filter values match an entity kind (submission, form, speaker, session, agenda, settings).',
    }
  },
})

// ——— Bulk speaker import (mirrors speakersAdmin.bulkAdd, compact) ————————

export const bulkAddSpeakers = internalMutation({
  args: {
    userId: v.string(),
    event: v.string(),
    rows: v.array(
      v.object({
        email: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        company: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        bio: v.optional(v.string()),
      }),
    ),
    workflowStatus: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    if (args.rows.length === 0) throw new ConvexError("Pass at least one row.")
    if (args.rows.length > 500) {
      throw new ConvexError("At most 500 rows per call — send the rest in another batch.")
    }
    if (
      args.workflowStatus !== undefined &&
      !["invited", "confirmed", "dropped"].includes(args.workflowStatus)
    ) {
      throw new ConvexError("workflowStatus must be invited, confirmed or dropped.")
    }
    let added = 0
    let updated = 0
    let skipped = 0
    const results: Array<{ email: string; outcome: string }> = []
    for (const row of args.rows) {
      const email = row.email.trim().toLowerCase()
      if (!email.includes("@")) {
        skipped++
        results.push({ email: row.email, outcome: "skipped (not an email)" })
        continue
      }
      const existing = await ctx.db
        .query("people")
        .withIndex("by_eventId_and_email", (q) =>
          q.eq("eventId", event._id).eq("email", email),
        )
        .unique()
      if (existing) {
        // Fill blanks only — an import must never overwrite curated data.
        const patch: Record<string, unknown> = {}
        if (!existing.firstName && row.firstName) patch.firstName = row.firstName
        if (!existing.lastName && row.lastName) patch.lastName = row.lastName
        if (!existing.company && row.company) patch.company = row.company
        if (!existing.jobTitle && row.jobTitle) patch.jobTitle = row.jobTitle
        if (!existing.bio?.trim() && row.bio) patch.bio = row.bio
        if (args.workflowStatus !== undefined) patch.workflowStatus = args.workflowStatus
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch)
          updated++
          results.push({ email, outcome: "updated (blanks filled)" })
        } else {
          skipped++
          results.push({ email, outcome: "skipped (already complete)" })
        }
        continue
      }
      await ctx.db.insert("people", {
        eventId: event._id,
        email,
        firstName: row.firstName ?? email.split("@")[0],
        lastName: row.lastName ?? "",
        company: row.company,
        jobTitle: row.jobTitle,
        bio: row.bio,
        portalToken: randomToken(),
        ...(args.workflowStatus !== undefined
          ? { workflowStatus: args.workflowStatus }
          : {}),
      })
      added++
      results.push({ email, outcome: "added" })
    }
    return {
      added,
      updated,
      skipped,
      total: args.rows.length,
      results: results.slice(0, 50),
      ...(results.length > 50 ? { resultsTruncated: `…${results.length - 50} more` } : {}),
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Tool registry
//
// Descriptions are written for an LLM operator: what the tool does, when to
// reach for it, and what the side effects are (especially "does this email
// real people?"). Every `event` argument accepts an id OR a slug.
// ══════════════════════════════════════════════════════════════════════════

type JsonSchema = {
  type: "object"
  properties: Record<string, unknown>
  required?: Array<string>
  additionalProperties?: boolean
}

type ToolDef = {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  readOnly: boolean
  /**
   * True when the write destroys or irreversibly changes something: deletes,
   * decision emails, bulk rewrites. Maps straight onto the spec's
   * `destructiveHint`; false means the write is additive (a create).
   * Meaningless (and omitted) on read-only tools.
   */
  destructive?: boolean
  /** True when repeating the call with the same arguments changes nothing more. */
  idempotent?: boolean
  run: (
    ctx: ActionCtx,
    userId: string,
    args: Record<string, any>,
  ) => Promise<unknown>
}

const EVENT_ARG = {
  type: "string",
  description:
    "The event's id or slug (both work). Get them from list_events.",
}

function schema(
  properties: Record<string, unknown>,
  required: Array<string> = [],
): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false }
}

/**
 * Validates a tool call's arguments against the tool's own `inputSchema`
 * before anything reaches the database.
 *
 * Without this the first line of defence is Convex's argument validator, whose
 * `ArgumentValidationError` dumps the internal validator shape (and the
 * caller's user id) into the model's context — unreadable for an LLM and a
 * needless leak. A model that gets "Missing required argument `event`" back
 * instead simply fixes the call. Deliberately shallow: the surface is flat
 * strings/numbers/booleans plus two small arrays, so a full JSON Schema
 * implementation would be dead weight.
 */
function validateArgs(
  tool: ToolDef,
  args: Record<string, unknown>,
): string | null {
  const properties = tool.inputSchema.properties as Record<
    string,
    Record<string, any> | undefined
  >
  for (const key of tool.inputSchema.required ?? []) {
    if (args[key] === undefined || args[key] === null) {
      return `Missing required argument \`${key}\` for ${tool.name}.`
    }
  }
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue
    const spec = properties[key]
    if (!spec) {
      return `Unknown argument \`${key}\` for ${tool.name}. Accepted: ${Object.keys(properties).join(", ") || "(none)"}.`
    }
    const expected = spec.type as string | undefined
    const actual = Array.isArray(value) ? "array" : typeof value
    if (
      expected &&
      expected !== actual &&
      // JSON has one number type; "5" for a number is still a mistake worth
      // naming, but an integer sent for a string field is not.
      !(expected === "number" && actual === "number")
    ) {
      return `Argument \`${key}\` of ${tool.name} must be a ${expected}, got ${actual}.`
    }
    const allowed = spec.enum as Array<string> | undefined
    if (allowed && !allowed.includes(value as string)) {
      return `Invalid value ${JSON.stringify(value)} for \`${key}\`. One of: ${allowed.join(", ")}.`
    }
  }
  return null
}

/**
 * Convex wraps a thrown error as "Uncaught ConvexError: <message>" plus a stack
 * of bundled-file frames. The message is the part a model can act on; the
 * frames are noise that costs tokens and points at our source layout.
 *
 * `.data` is read FIRST because it is the only channel that survives a
 * PRODUCTION deployment: Convex replaces the `message` of any thrown exception
 * with "Server Error" out there, so a tool that reported `error.message` would
 * hand the model "[Request ID: …] Server Error" on trackstage.app and a perfect
 * sentence on dev. Every refusal in this file is a ConvexError for that reason.
 */
function toolErrorMessage(error: unknown): string {
  return humanMessage(error, "Something went wrong.")
}

/**
 * The REST data layer (convex/apiV1.ts) answers "no such event" with `null`
 * and "no such record" with `{notFound: true}` because HTTP turns those into
 * status codes. A tool result is read by a model, so both become sentences.
 */
function fromApi<T>(result: T, what = "That record"): T {
  if (result === null || result === undefined) {
    throw new ConvexError(
      "No event matches that reference. Call list_events to see the available ids and slugs.",
    )
  }
  const row = result as Record<string, unknown>
  if (row.notFound === true || row.participantNotFound === true) {
    throw new ConvexError(`${what} was not found — check the id and try again.`)
  }
  if (row.conflict === true) {
    throw new ConvexError(
      "Someone else changed this record since you read it — re-read it and apply your change again.",
    )
  }
  return result
}

export const TOOLS: Array<ToolDef> = [
  // ——— Workspaces & events ———————————————————————————————————————————————
  {
    name: "list_workspaces",
    title: "List workspaces",
    description:
      "Lists every Trackstage workspace (organization) you belong to, your role in each (owner/admin/member), and how many events each one holds. Start here when you don't yet know which workspace or event to operate on.",
    inputSchema: schema({}),
    readOnly: true,
    run: (ctx, userId) => ctx.runQuery(internal.mcp.listWorkspaces, { userId }),
  },
  {
    name: "list_events",
    title: "List events",
    description:
      "Lists every event you can access, across all your workspaces, with each event's id, slug, dates, venue and timezone. Almost every other tool needs an event id or slug from here.",
    inputSchema: schema({}),
    readOnly: true,
    run: (ctx, userId) => ctx.runQuery(internal.mcp.listEvents, { userId }),
  },
  {
    name: "create_event",
    title: "Create an event",
    description:
      "Creates a new event in one of your workspaces. Requires the admin or owner role. If you belong to exactly one workspace you can omit organizationId. Dates are ISO-8601 strings, e.g. \"2026-09-14T09:00:00Z\"; set them if you plan to use auto_place_sessions later. Returns the event id, its slug, the workspace slug and the canonical public URL of the program page.",
    inputSchema: schema(
      {
        name: { type: "string", description: "Display name, e.g. \"AI Summit 2026\"." },
        slug: { type: "string", description: "URL slug. Derived from the name when omitted." },
        organizationId: { type: "string", description: "Workspace id from list_workspaces. Optional when you only have one." },
        timezone: { type: "string", description: "IANA timezone, e.g. \"America/Los_Angeles\". Defaults to UTC." },
        type: { type: "string", description: "Conference | Summit | Meetup | Workshop …" },
        venue: { type: "string" },
        description: { type: "string" },
        websiteUrl: { type: "string" },
        startsAt: { type: "string", description: "ISO-8601 start date/time." },
        endsAt: { type: "string", description: "ISO-8601 end date/time." },
      },
      ["name"],
    ),
    readOnly: false,
    destructive: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.createEvent, {
        userId,
        name: args.name,
        slug: args.slug,
        organizationId: args.organizationId,
        timezone: args.timezone,
        type: args.type,
        venue: args.venue,
        description: args.description,
        websiteUrl: args.websiteUrl,
        startsAt: parseWhen(args.startsAt),
        endsAt: parseWhen(args.endsAt),
      }),
  },
  {
    name: "get_event_overview",
    title: "Event dashboard stats (deprecated — use get_event_summary)",
    description:
      "DEPRECATED ALIAS of get_event_summary, kept so existing scripts keep working; it returns exactly the same payload. Call get_event_summary instead.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.eventOverview, {
        userId,
        event: args.event,
        now: Date.now(),
      }),
  },

  // ——— Forms ——————————————————————————————————————————————————————————————
  {
    name: "list_forms",
    title: "List CFP forms",
    description:
      "Lists the call-for-papers forms on an event with their open/closed status, close date, public submission URL, and how many submissions and drafts each has collected.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listForms, {
        userId,
        event: args.event,
        now: Date.now(),
      }),
  },
  {
    name: "get_form",
    title: "Get a form",
    description:
      "Returns a form in full: every question (type, required/enabled, options, conditional showIf rules, which one routes to tracks), the participant configuration, and the submission settings.",
    inputSchema: schema(
      { form: { type: "string", description: "Form id or slug (see list_forms)." } },
      ["form"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.getForm, {
        userId,
        form: args.form,
        now: Date.now(),
      }),
  },
  {
    name: "create_form",
    title: "Create a CFP form",
    description:
      "Creates a new call-for-papers form on an event, pre-filled with the standard question set (title, description, format, track, level, language, tags) and speaker fields. Track options are seeded from the event's existing tracks. Returns the public submission URL — the form opens immediately.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        name: { type: "string", description: "Internal name, e.g. \"Main CFP 2026\"." },
        kind: {
          type: "string",
          enum: ["abstract", "session"],
          description: "\"abstract\" collects talk proposals to review (default); \"session\" collects already-confirmed programme items.",
        },
      },
      ["event", "name"],
    ),
    readOnly: false,
    destructive: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.createForm, {
        userId,
        event: args.event,
        name: args.name,
        kind: args.kind,
      }),
  },
  {
    name: "update_form_settings",
    title: "Open, close or configure a form",
    description:
      "Opens or closes a CFP form, sets or clears its close date, and updates submission settings (per-user limit, drafts allowed, reminder emails, success message). This is how you extend or end a call for papers.",
    inputSchema: schema(
      {
        form: { type: "string", description: "Form id or slug." },
        status: { type: "string", enum: ["open", "closed"] },
        closeAt: {
          type: "string",
          description: "ISO-8601 deadline after which the form stops accepting submissions. Pass an empty string to clear it.",
        },
        externalTitle: { type: "string", description: "Title shown to submitters." },
        limitPerUser: { type: "number", description: "Max submissions per person." },
        allowDrafts: { type: "boolean" },
        sendReminderEmail: { type: "boolean" },
        successMessage: { type: "string", description: "HTML shown after submitting." },
      },
      ["form"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.updateFormSettings, {
        userId,
        form: args.form,
        status: args.status,
        closeAt:
          args.closeAt === undefined
            ? undefined
            : (parseWhen(args.closeAt) ?? null),
        externalTitle: args.externalTitle,
        limitPerUser: args.limitPerUser,
        allowDrafts: args.allowDrafts,
        sendReminderEmail: args.sendReminderEmail,
        successMessage: args.successMessage,
      }),
  },
  {
    name: "get_public_form_link",
    title: "Get a form's public link",
    description:
      "Returns the shareable public submission URL for a form and whether it is currently accepting submissions. Use this when someone asks \"what's the link to submit a talk?\".",
    inputSchema: schema(
      { form: { type: "string", description: "Form id or slug." } },
      ["form"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.publicFormLink, {
        userId,
        form: args.form,
        now: Date.now(),
      }),
  },

  // ——— Submissions ————————————————————————————————————————————————————————
  {
    name: "list_submissions",
    title: "List submissions",
    description:
      "Lists submissions (abstracts and sessions) for an event, optionally filtered by status, track name, or a free-text search across titles, descriptions and speaker names/emails. Statuses: draft, pending, accept_queue, decline_queue, accepted, declined, withdrawn.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        status: {
          type: "string",
          enum: SUBMISSION_STATUSES,
          description: "Filter to one status. Omit for all.",
        },
        track: { type: "string", description: "Track name to filter by." },
        search: { type: "string", description: "Free-text search." },
        limit: { type: "number", description: "Max rows (default 50, max 200)." },
      },
      ["event"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listSubmissions, {
        userId,
        event: args.event,
        status: args.status,
        track: args.track,
        search: args.search,
        limit: args.limit,
      }),
  },
  {
    name: "get_submission",
    title: "Get a submission",
    description:
      "Returns one submission in full: description, every form answer, participants with roles and emails, uploaded files with their approval state, and review scores (average plus evaluator comments). Use it before making an accept/decline call.",
    inputSchema: schema(
      { submissionId: { type: "string", description: "From list_submissions." } },
      ["submissionId"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.getSubmission, {
        userId,
        submissionId: args.submissionId,
      }),
  },
  {
    name: "set_submission_status",
    title: "Stage a decision",
    description:
      "Moves a submission along the pipeline. Crucially, moving something to accept_queue or decline_queue only STAGES the decision — no speaker is emailed until you run commit_decision_queue. That two-step design is deliberate: stage everything, review the list, then send in one go.",
    inputSchema: schema(
      {
        submissionId: { type: "string" },
        status: { type: "string", enum: SUBMISSION_STATUSES },
      },
      ["submissionId", "status"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.setSubmissionStatus, {
        userId,
        submissionId: args.submissionId,
        status: args.status,
      }),
  },
  {
    name: "commit_decision_queue",
    title: "Commit a decision queue (SENDS EMAIL)",
    description:
      "Commits every submission staged in the accept or decline queue: flips them to accepted/declined and QUEUES REAL DECISION EMAILS to their speakers (accepted speakers also get their onboarding tasks created). This is irreversible from the speaker's point of view, so you must pass confirm: true, and you need the admin or owner role. Preview what will be sent first with list_submissions(status: \"accept_queue\").",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        queue: { type: "string", enum: ["accept_queue", "decline_queue"] },
        confirm: {
          type: "boolean",
          description: "Must be true. Guards against sending decisions by accident.",
        },
      },
      ["event", "queue", "confirm"],
    ),
    readOnly: false,
    run: (ctx, userId, args) => {
      if (args.confirm !== true) {
        throw new ConvexError(
          "Refusing to send decision emails without confirm: true. Review the queue with list_submissions first, then call again with confirm: true.",
        )
      }
      return ctx.runMutation(internal.mcp.commitDecisionQueue, {
        userId,
        event: args.event,
        queue: args.queue,
      })
    },
  },
  {
    name: "add_manual_session",
    title: "Add a session manually",
    description:
      "Adds a programme item that never came through the CFP — a sponsor slot, keynote, break or invited talk. Defaults to kind \"session\" with status \"accepted\", so it is immediately schedulable on the agenda. Speakers are matched or created by email.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        title: { type: "string" },
        description: { type: "string" },
        kind: { type: "string", enum: ["session", "abstract"], description: "Default \"session\"." },
        status: { type: "string", enum: SUBMISSION_STATUSES, description: "Default \"accepted\" for sessions." },
        track: { type: "string", description: "Track name (must already exist on the event)." },
        format: { type: "string", description: "Talk | Workshop | Lightning Talk …" },
        level: { type: "string" },
        language: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        speakers: {
          type: "array",
          description: "Speakers to attach. Existing people are matched by email.",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              company: { type: "string" },
              jobTitle: { type: "string" },
            },
            required: ["email"],
          },
        },
      },
      ["event", "title"],
    ),
    readOnly: false,
    destructive: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.addManualSession, {
        userId,
        event: args.event,
        title: args.title,
        description: args.description,
        kind: args.kind,
        status: args.status,
        track: args.track,
        format: args.format,
        level: args.level,
        language: args.language,
        tags: args.tags,
        speakers: args.speakers,
      }),
  },

  // ——— Agenda —————————————————————————————————————————————————————————————
  {
    name: "get_agenda",
    title: "Get the agenda",
    description:
      "The programme itself — WHICH session is in which room at what time. Scheduled sessions in time order (room, start, duration, track, speakers), the unscheduled tray of accepted sessions still waiting for a slot, a per-room roll-up (byRoom), the room list, and every detected conflict (same room double-booked, or a speaker in two overlapping sessions). Row detail is capped at 40 scheduled and 40 unscheduled; the counts and byRoom totals always cover everything. For status numbers rather than the timetable, use get_event_summary.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.getAgenda, { userId, event: args.event }),
  },
  {
    name: "schedule_session",
    title: "Schedule a session",
    description:
      "Places an accepted session in a room at a time. The room can be named or given by id. Conflicts never block the write — they are reported back in the result so you can decide, exactly like dragging a card on the agenda board.",
    inputSchema: schema(
      {
        submissionId: { type: "string" },
        room: { type: "string", description: "Room name or id (see get_agenda)." },
        startsAt: { type: "string", description: "ISO-8601 start, e.g. \"2026-09-14T14:00:00Z\"." },
        durationMinutes: { type: "number", description: "5–480. Defaults to 45." },
      },
      ["submissionId", "room", "startsAt"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.scheduleSession, {
        userId,
        submissionId: args.submissionId,
        room: args.room,
        startsAt: parseWhen(args.startsAt)!,
        durationMinutes: args.durationMinutes,
      }),
  },
  {
    name: "unschedule_session",
    title: "Unschedule a session",
    description:
      "Removes a session from its agenda slot and returns it to the unscheduled tray. The session stays accepted.",
    inputSchema: schema({ submissionId: { type: "string" } }, ["submissionId"]),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.unscheduleSession, {
        userId,
        submissionId: args.submissionId,
      }),
  },
  {
    name: "auto_place_sessions",
    title: "Auto-fill the agenda",
    description:
      "Greedily fills the agenda with every accepted-but-unscheduled session, skipping any slot that would double-book a room or a speaker. Already-scheduled sessions are left exactly where they are. The event needs start/end dates and at least one room. Reports how many were placed and how many wouldn't fit.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        dayStartHour: { type: "number", description: "First hour of the programme day (default 9)." },
        dayEndHour: { type: "number", description: "Last hour of the programme day (default 18)." },
        defaultDurationMinutes: { type: "number", description: "Slot length (default 45)." },
        gapMinutes: { type: "number", description: "Break between slots (default 15)." },
      },
      ["event"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.autoPlaceSessions, {
        userId,
        event: args.event,
        dayStartHour: args.dayStartHour,
        dayEndHour: args.dayEndHour,
        defaultDurationMinutes: args.defaultDurationMinutes,
        gapMinutes: args.gapMinutes,
      }),
  },

  // ——— Speakers & tasks ———————————————————————————————————————————————————
  {
    name: "list_speakers",
    title: "Speaker roster",
    description:
      "The confirmed speaker roster: everyone attached to an accepted session, their sessions, their outstanding onboarding tasks with due dates, and what's still missing from their profile (bio, headshot, slides). This is the \"who do I need to chase?\" list. The response states its own counts — totalSpeakers, returned, withOpenTasks, withProfileGaps — plus a `summary` sentence; quote those numbers rather than counting rows yourself.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        onlyWithOutstandingWork: {
          type: "boolean",
          description:
            "Return only speakers with at least one INCOMPLETE TASK. Nothing else — an unfinished profile alone does not qualify unless you also pass includeProfileGaps.",
        },
        includeProfileGaps: {
          type: "boolean",
          description:
            "Widen the filter to speakers whose PROFILE is incomplete (missing bio, headshot or slides) even when they have zero open tasks. On its own it returns exactly those speakers; combined with onlyWithOutstandingWork it returns either.",
        },
      },
      ["event"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listSpeakers, {
        userId,
        event: args.event,
        onlyWithOutstandingWork: args.onlyWithOutstandingWork,
        includeProfileGaps: args.includeProfileGaps,
      }),
  },
  {
    name: "get_speaker_portal_link",
    title: "Get a speaker's portal link",
    description:
      "Returns the private magic link that signs one speaker straight into their portal (no password). Use it when a speaker says they can't find their invite. Treat the URL as a credential — only send it to that speaker.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        speaker: { type: "string", description: "The speaker's email address, or their person id." },
      },
      ["event", "speaker"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.speakerPortalLink, {
        userId,
        event: args.event,
        speaker: args.speaker,
      }),
  },
  {
    name: "assign_task",
    title: "Assign a speaker task",
    description:
      "Assigns an onboarding task to one or more speakers — it appears in their portal immediately. Kinds: profile (completes itself once their bio is filled in), headshot (completes on upload), upload (they send a file such as slides, you review it), answer (you ask a question in the instructions and they type a reply — their answer completes it and you can read it back), confirm (one click to acknowledge). Assigning does not email anyone; run send_reminders for that.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        speakers: {
          type: "array",
          items: { type: "string" },
          description: "Speaker emails (or person ids).",
        },
        title: { type: "string", description: "e.g. \"Upload your slides\"." },
        kind: {
          type: "string",
          enum: ["profile", "headshot", "upload", "answer", "confirm"],
          description: "Default \"confirm\".",
        },
        instructions: {
          type: "string",
          description: "What they should do. For kind \"answer\" this is the QUESTION they reply to. Supports {{firstName}} / {{sessionTitle}}.",
        },
        dueAt: { type: "string", description: "ISO-8601 due date." },
      },
      ["event", "speakers", "title"],
    ),
    readOnly: false,
    destructive: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.assignTask, {
        userId,
        event: args.event,
        speakers: args.speakers,
        title: args.title,
        kind: args.kind,
        instructions: args.instructions,
        dueAt: parseWhen(args.dueAt),
      }),
  },
  {
    name: "list_task_library",
    title: "List saved speaker tasks",
    description:
      "Lists the event's reusable task library — the wording an organizer saved once and assigns all season, with each entry's id, title, kind and instructions. Read this before assign_task_from_template, and before writing a new task from scratch: reusing the saved wording keeps every speaker's portal consistent.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listTaskLibrary, {
        userId,
        event: args.event,
      }),
  },
  {
    name: "save_task_template",
    title: "Save a task to the library",
    description:
      "Saves a reusable task into the event's library (or updates it, matching on the title — saving twice edits the wording rather than creating a near-duplicate). Instructions may carry {{firstName}} / {{sessionTitle}}, which resolve per speaker when their portal renders the task. This only writes the library; assign it with assign_task_from_template.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        title: { type: "string", description: "Library name, e.g. \"Upload your slides\"." },
        kind: {
          type: "string",
          enum: ["profile", "headshot", "upload", "answer", "confirm"],
          description: "How it gets ticked off. Default \"confirm\".",
        },
        instructions: {
          type: "string",
          description: "What the speaker should do — the question itself for kind \"answer\".",
        },
        alias: {
          type: "string",
          description: "What the speaker's portal calls it, when that differs from the library name.",
        },
      },
      ["event", "title"],
    ),
    readOnly: false,
    destructive: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.saveTaskTemplate, {
        userId,
        event: args.event,
        title: args.title,
        kind: args.kind,
        instructions: args.instructions,
        alias: args.alias,
      }),
  },
  {
    name: "assign_task_from_template",
    title: "Assign a saved task to speakers",
    description:
      "Assigns a task from the library to one or more speakers without retyping it — the saved wording is copied onto each speaker's task, so editing the library later never rewrites tasks already sent. Optionally bind it to one session, and anything they upload for it is filed against that session. Template ids come from list_task_library. Assigning does not email anyone; run send_reminders for that.",
    inputSchema: schema(
      {
        template: { type: "string", description: "Template id from list_task_library." },
        speakers: {
          type: "array",
          items: { type: "string" },
          description: "Speaker emails (or person ids).",
        },
        dueAt: { type: "string", description: "ISO-8601 due date." },
        submissionId: {
          type: "string",
          description: "Optional session this task is about (see list_submissions).",
        },
      },
      ["template", "speakers"],
    ),
    readOnly: false,
    destructive: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.assignTaskFromTemplate, {
        userId,
        template: args.template,
        speakers: args.speakers,
        dueAt: parseWhen(args.dueAt),
        submissionId: args.submissionId,
      }),
  },
  {
    name: "send_reminders",
    title: "Remind speakers with open tasks (SENDS EMAIL)",
    description:
      "Queues a reminder email to every speaker with incomplete tasks, using the event's reminder template. Anyone already reminded in the last 20 hours is skipped automatically, so calling it twice is safe. Optionally narrow it to tasks due within N days.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        dueWithinDays: {
          type: "number",
          description: "Only remind about tasks due within this many days. Omit to cover all open tasks.",
        },
      },
      ["event"],
    ),
    readOnly: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.sendReminders, {
        userId,
        event: args.event,
        dueWithinDays: args.dueWithinDays,
      }),
  },

  // ——— Comms ——————————————————————————————————————————————————————————————
  {
    name: "list_templates",
    title: "List email templates",
    description:
      "Lists the event's email templates (accepted, declined, waitlisted, reminder, confirmation) with their subject, a 200-character body preview, and whether each has been customised or is still the built-in default. Use get_template for one template's full body. Placeholders such as {{firstName}} and {{sessionTitle}} are filled in at send time.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listTemplates, { userId, event: args.event }),
  },
  {
    name: "get_template",
    title: "Get an email template",
    description:
      "Returns one email template in full — subject and complete body, and whether it is customised for this event or still the built-in default. Read it before rewriting a template with update_template so you edit the copy that is actually in use.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        key: {
          type: "string",
          enum: TEMPLATE_KEYS,
          description: "Which template to read.",
        },
      },
      ["event", "key"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.getTemplate, {
        userId,
        event: args.event,
        key: args.key,
      }),
  },
  {
    name: "update_template",
    title: "Edit an email template",
    description:
      "Rewrites an email template's subject and/or body for this event. Supported placeholders: {{speakerName}}, {{firstName}}, {{sessionTitle}}, {{eventName}}, {{portalLink}}. Editing a template does not send anything — use send_test_email to check it, and it applies to future sends.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        key: {
          type: "string",
          enum: TEMPLATE_KEYS,
          description: "Which template to rewrite.",
        },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text or HTML." },
        name: { type: "string", description: "Display name for the template." },
      },
      ["event", "key"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.updateTemplate, {
        userId,
        event: args.event,
        key: args.key,
        subject: args.subject,
        body: args.body,
        name: args.name,
      }),
  },
  {
    name: "list_outbox",
    title: "List the email outbox",
    description:
      "Shows what Trackstage has emailed (or is about to email) for this event: recipient, subject, template, delivery status and any error. Status \"preview\" means the message was rendered but deliberately not delivered (demo @example.com recipients, or no RESEND_API_KEY configured).",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        status: {
          type: "string",
          enum: ["scheduled", "sending", "sent", "preview", "failed"],
        },
        limit: { type: "number", description: "Max rows (default 25, max 100)." },
      },
      ["event"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listOutbox, {
        userId,
        event: args.event,
        status: args.status,
        limit: args.limit,
      }),
  },
  {
    name: "send_test_email",
    title: "Send yourself a test email",
    description:
      "Renders a template with real event data and sends it to you (or an address you name) so you can proof it before it goes to speakers. Returns the rendered subject and body too, so you can check the copy without leaving the conversation.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        key: {
          type: "string",
          enum: TEMPLATE_KEYS,
          description: "Which template to proof.",
        },
        to: {
          type: "string",
          description:
            "Omit to send to yourself. Only set this if the user named a specific address — never fill it in from your own context.",
        },
      },
      ["event", "key"],
    ),
    readOnly: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.sendTestEmail, {
        userId,
        event: args.event,
        key: args.key,
        to: args.to,
      }),
  },

  // ——— Deletion ———————————————————————————————————————————————————————————
  {
    name: "delete_event",
    title: "Delete an event (IRREVERSIBLE)",
    description:
      "Permanently deletes an event and EVERYTHING belonging to it: every submission, speaker, CFP form, task, uploaded file, email template and outbox row. There is no undo and no trash. It needs the admin or owner role and TWO independent confirmations: confirm: true, and confirmName set to the event's exact name as list_events returns it. Never guess confirmName — if the user has not named the event they want destroyed, ask them, don't infer it.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        confirmName: {
          type: "string",
          description:
            "The event's exact name (case and punctuation), as returned by list_events. A mismatch deletes nothing.",
        },
        confirm: {
          type: "boolean",
          description: "Must be true. Guards against deleting a conference by accident.",
        },
      },
      ["event", "confirmName", "confirm"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) => {
      if (args.confirm !== true) {
        throw new ConvexError(
          "Refusing to delete an event without confirm: true. Check what you are about to destroy with get_event_summary, then call again with confirm: true and confirmName set to the event's exact name.",
        )
      }
      return ctx.runMutation(internal.mcp.deleteEvent, {
        userId,
        event: args.event,
        confirmName: args.confirmName,
      })
    },
  },
  {
    name: "delete_form",
    title: "Delete a CFP form (IRREVERSIBLE)",
    description:
      "Permanently deletes a call-for-papers form. Admin or owner role, and confirm: true. A form that has ANY submissions (drafts included) is refused — closing it with update_form_settings(status: \"closed\") is what you almost always want, because that keeps the submissions and just stops new ones.",
    inputSchema: schema(
      {
        form: { type: "string", description: "Form id or slug (see list_forms)." },
        confirm: {
          type: "boolean",
          description: "Must be true. Guards against deleting a live CFP by accident.",
        },
      },
      ["form", "confirm"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) => {
      if (args.confirm !== true) {
        throw new ConvexError(
          "Refusing to delete a form without confirm: true. If you only want to stop new submissions, call update_form_settings(status: \"closed\") instead; otherwise call again with confirm: true.",
        )
      }
      return ctx.runMutation(internal.mcp.deleteForm, {
        userId,
        form: args.form,
      })
    },
  },
  {
    name: "remove_task",
    title: "Remove a speaker task",
    description:
      "Deletes one onboarding task, retracting it from that speaker's portal — the inverse of assign_task, for a task assigned by mistake or no longer needed. Admin or owner role. Task ids come from list_speakers (each speaker's outstandingTasks). Completing a task is the speaker's job in the portal; this removes it outright, so don't use it to mark work as done.",
    inputSchema: schema(
      {
        taskId: {
          type: "string",
          description: "From list_speakers → speakers[].outstandingTasks[].taskId.",
        },
      },
      ["taskId"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.removeTask, {
        userId,
        taskId: args.taskId,
      }),
  },

  // ——— Meta ———————————————————————————————————————————————————————————————
  {
    name: "get_event_summary",
    title: "Event status & dashboard stats",
    description:
      "THE status call, and the one that used to be split in two (it absorbed get_event_overview). Returns every dashboard number plus the narrative: a headline sentence, submission counts by status, total submissions, agenda health (scheduled, acceptedNotScheduled, conflict count and labels), open vs completed speaker tasks, outbox counts by delivery status, every CFP form with its id, status, closeAt and public link, a prioritised \"needs attention\" list, and the nearest deadlines. Reach for this for \"how is my event doing?\", \"pull the dashboard stats\" or \"what should I do next?\". It does NOT list individual sessions or times — that is get_agenda.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.eventSummary, {
        userId,
        event: args.event,
        now: Date.now(),
      }),
  },

  // ——— Events: update ————————————————————————————————————————————————————
  {
    name: "update_event",
    title: "Update event details & portal toggles",
    description:
      "Updates an event's details (name, dates, venue, timezone, type, description, website) and its speaker-portal toggles: alwaysShowTasks (tasks tab visible even when empty), allowSubmissionEdits (speakers may edit submitted talks), extendTaskDeadlines (overdue tasks stay completable). Only the fields you pass change. Admin or owner role.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        name: { type: "string" },
        timezone: { type: "string", description: "IANA timezone." },
        type: { type: "string" },
        venue: { type: "string" },
        description: { type: "string" },
        websiteUrl: { type: "string" },
        startsAt: { type: "string", description: "ISO-8601 start date/time." },
        endsAt: { type: "string", description: "ISO-8601 end date/time." },
        alwaysShowTasks: { type: "boolean" },
        allowSubmissionEdits: { type: "boolean" },
        extendTaskDeadlines: { type: "boolean" },
      },
      ["event"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvent, {
          userId,
          action: "update",
          eventRef: args.event,
          input: {
            name: args.name,
            timezone: args.timezone,
            type: args.type,
            venue: args.venue,
            description: args.description,
            website_url: args.websiteUrl,
            starts_at: parseWhen(args.startsAt),
            ends_at: parseWhen(args.endsAt),
            always_show_tasks: args.alwaysShowTasks,
            allow_submission_edits: args.allowSubmissionEdits,
            extend_task_deadlines: args.extendTaskDeadlines,
          },
        }),
        "That event",
      ),
  },

  // ——— Workspace membership ——————————————————————————————————————————————
  {
    name: "list_workspace_members",
    title: "List workspace members",
    description:
      "Lists everyone in a workspace: email, role (owner/admin/member), whether they've accepted their invite, and their event scope (null means every event). Omit `workspace` when you belong to exactly one.",
    inputSchema: schema({
      workspace: { type: "string", description: "Workspace id or slug (see list_workspaces)." },
    }),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listWorkspaceMembers, {
        userId,
        workspace: args.workspace,
      }),
  },
  {
    name: "update_workspace",
    title: "Rename a workspace or change its address",
    description:
      "Renames a workspace and/or changes its address (the first segment of every app and public link). A taken address is auto-suffixed rather than refused, and the reply tells you the address that is actually live. Changing the address breaks every existing link that used the old one. Requires the admin or owner role.",
    inputSchema: schema({
      workspace: { type: "string", description: "Workspace id or slug. Optional when you have one." },
      name: { type: "string", description: "The new display name." },
      slug: { type: "string", description: "The new URL address, e.g. \"acme-events\"." },
    }),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.updateWorkspace, {
        userId,
        workspace: args.workspace,
        name: args.name,
        slug: args.slug,
      }),
  },
  {
    name: "invite_workspace_member",
    title: "Invite a teammate (SENDS EMAIL)",
    description:
      "Invites a teammate to the workspace by email — they get an invite email and their access starts the moment they sign up with that address. role \"member\" can optionally be scoped to specific events with eventRefs; admins always see the whole workspace. Requires the admin or owner role.",
    inputSchema: schema(
      {
        workspace: { type: "string", description: "Workspace id or slug. Optional when you have one." },
        email: { type: "string" },
        role: { type: "string", enum: ["admin", "member"] },
        eventRefs: {
          type: "array",
          items: { type: "string" },
          description: "Event ids/slugs to limit a member to. Omit for all events.",
        },
      },
      ["email", "role"],
    ),
    readOnly: false,
    destructive: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.inviteWorkspaceMember, {
        userId,
        workspace: args.workspace,
        email: args.email,
        role: args.role,
        eventRefs: args.eventRefs,
      }),
  },
  {
    name: "update_workspace_member",
    title: "Change a member's role or event scope",
    description:
      "Changes a workspace member's role (owner only) and/or their event scope (admin+; pass an empty eventRefs array to give them every event again). Owners can't be changed, and admins are never event-scoped.",
    inputSchema: schema(
      {
        memberId: { type: "string", description: "From list_workspace_members." },
        role: { type: "string", enum: ["admin", "member"] },
        eventRefs: {
          type: "array",
          items: { type: "string" },
          description: "Event ids/slugs to limit them to; [] clears the limit.",
        },
      },
      ["memberId"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.updateWorkspaceMember, {
        userId,
        memberId: args.memberId,
        role: args.role,
        eventRefs: args.eventRefs,
      }),
  },
  {
    name: "remove_workspace_member",
    title: "Remove a workspace member",
    description:
      "Removes a member from the workspace — their access ends immediately. Owners can't be removed and you can't remove yourself. Admin or owner role.",
    inputSchema: schema(
      { memberId: { type: "string", description: "From list_workspace_members." } },
      ["memberId"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.removeWorkspaceMember, {
        userId,
        memberId: args.memberId,
      }),
  },

  // ——— Forms: content + questions ————————————————————————————————————————
  {
    name: "update_form",
    title: "Edit a form's content & participant rules",
    description:
      "Edits the parts of a CFP form that update_form_settings doesn't: the public title, page heading and welcome message, the addresses notified on each submission, and the participant rules (speaker min/max, chairperson/moderator roles, confirmation email). For open/closed status, deadlines and submission limits use update_form_settings; for the questions themselves use manage_form_question.",
    inputSchema: schema(
      {
        form: { type: "string", description: "Form id or slug." },
        externalTitle: { type: "string", description: "Title submitters see." },
        pageHeading: { type: "string" },
        welcomeMessage: { type: "string", description: "HTML shown on the welcome step." },
        showWelcomeMessage: { type: "boolean" },
        notifyEmails: {
          type: "array",
          items: { type: "string" },
          description: "Organizer addresses emailed on every new submission.",
        },
        speakerMin: { type: "number" },
        speakerMax: { type: "number" },
        chairpersonEnabled: { type: "boolean" },
        moderatorEnabled: { type: "boolean" },
        sendConfirmationEmail: { type: "boolean" },
      },
      ["form"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      const hasParticipantChange =
        args.speakerMin !== undefined ||
        args.speakerMax !== undefined ||
        args.chairpersonEnabled !== undefined ||
        args.moderatorEnabled !== undefined ||
        args.sendConfirmationEmail !== undefined
      // The form's event is resolved inside apiV1 via the form itself.
      const form = await ctx.runQuery(internal.mcp.getForm, {
        userId,
        form: args.form,
        now: Date.now(),
      })
      return fromApi(
        await ctx.runMutation(internal.apiV1.writeForm, {
          userId,
          action: "update",
          eventRef: (form as { eventId: string }).eventId,
          formRef: (form as { formId: string }).formId,
          input: {
            external_title: args.externalTitle,
            page_heading: args.pageHeading,
            welcome_message: args.welcomeMessage,
            show_welcome_message: args.showWelcomeMessage,
            notify_emails: args.notifyEmails,
            ...(hasParticipantChange
              ? {
                  participant_config: {
                    speaker_min: args.speakerMin,
                    speaker_max: args.speakerMax,
                    chairperson_enabled: args.chairpersonEnabled,
                    moderator_enabled: args.moderatorEnabled,
                    send_confirmation_email: args.sendConfirmationEmail,
                  },
                }
              : {}),
          },
        }),
        "That form",
      )
    },
  },
  {
    name: "manage_form_question",
    title: "Add, edit or remove a form question",
    description:
      "Edits the questions on the event's CFP forms — the same custom-field model the form builder uses. action \"create\" appends a question (to the form you name, or the event's first form); \"update\"/\"delete\" find the question by its id across every form. Locked system questions (title, description, first/last name, email) refuse edits. Question types: short_text, long_text, rich_text, dropdown, multi_select, checkbox, date, url, email, number, file.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        action: { type: "string", enum: ["create", "update", "delete"] },
        questionId: { type: "string", description: "Required for update/delete — from get_form." },
        form: { type: "string", description: "Form id to add to (create only; defaults to the first form)." },
        label: { type: "string" },
        type: { type: "string" },
        required: { type: "boolean" },
        enabled: { type: "boolean" },
        help: { type: "string" },
        options: { type: "array", items: { type: "string" } },
      },
      ["event", "action"],
    ),
    readOnly: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeField, {
          userId,
          eventRef: args.event,
          action: args.action,
          fieldId: args.questionId,
          formId: args.form,
          label: args.label,
          type: args.type,
          required: args.required,
          enabled: args.enabled,
          help: args.help,
          options: args.options,
        }),
        "That question",
      ),
  },

  // ——— Submissions: edit, trash, participants ———————————————————————————
  {
    name: "update_submission",
    title: "Edit a submission",
    description:
      "Edits a submission's content and classification: title, description, format, level, language, tags, duration, its answers to custom form questions (answers merge — only the keys you pass change), track (pass a track id from list_field_options resource \"tracks\", or \"\" to clear), and publicVisible (false embargoes it from the public programme without touching its status). For the status itself use set_submission_status.",
    inputSchema: schema(
      {
        submissionId: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        format: { type: "string" },
        level: { type: "string" },
        language: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        durationMinutes: { type: "number" },
        track: { type: "string", description: "Track id (list_field_options resource \"tracks\"), or \"\" to clear." },
        publicVisible: { type: "boolean" },
        answers: {
          type: "object",
          description: "Custom-question answers to merge in, keyed by question id (see get_form).",
        },
      },
      ["submissionId"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      const existing = await ctx.runQuery(internal.mcp.getSubmission, {
        userId,
        submissionId: args.submissionId,
      })
      return fromApi(
        await ctx.runMutation(internal.apiV1.updateSession, {
          userId,
          eventRef: (existing as { eventId?: string }).eventId ?? "",
          sessionId: args.submissionId,
          input: {
            title: args.title,
            description: args.description,
            format: args.format,
            level: args.level,
            language: args.language,
            tags: args.tags,
            duration_minutes: args.durationMinutes,
            track_id: args.track,
            is_public: args.publicVisible,
            custom_fields: args.answers,
          },
        }),
        "That submission",
      )
    },
  },
  {
    name: "delete_submission",
    title: "Trash a submission (recoverable)",
    description:
      "Soft-deletes a submission: it leaves every list, board and public page but sits in the trash and can be brought back with restore_submission. Admin or owner role. This is the right call for spam or duplicates; a talk you merely don't want should be declined instead.",
    inputSchema: schema({ submissionId: { type: "string" } }, ["submissionId"]),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      const existing = await ctx.runQuery(internal.mcp.getSubmission, {
        userId,
        submissionId: args.submissionId,
      })
      return fromApi(
        await ctx.runMutation(internal.apiV1.deleteSession, {
          userId,
          eventRef: (existing as { eventId?: string }).eventId ?? "",
          sessionId: args.submissionId,
          restore: false,
        }),
        "That submission",
      )
    },
  },
  {
    name: "list_trash",
    title: "List trashed submissions",
    description:
      "Everything soft-deleted on the event, newest deletion first, with the date it went. This is the only place a trashed submission is visible — list_submissions hides them exactly as the organizer's screens do — so it is where restore_submission gets its id.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        limit: { type: "number", description: "Max rows (default 50, max 200)." },
      },
      ["event"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listTrash, {
        userId,
        event: args.event,
        limit: args.limit,
      }),
  },
  {
    name: "restore_submission",
    title: "Restore a trashed submission",
    description:
      "Brings a soft-deleted submission back from the trash with its status, participants and files intact. Admin or owner role.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        submissionId: { type: "string" },
      },
      ["event", "submissionId"],
    ),
    readOnly: false,
    destructive: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.deleteSession, {
          userId,
          eventRef: args.event,
          sessionId: args.submissionId,
          restore: true,
        }),
        "That submission",
      ),
  },
  {
    name: "add_participant",
    title: "Add a speaker to a session",
    description:
      "Attaches a person to a submission with a role (speaker, chairperson or moderator). Name them by person id or by email — an email new to the event creates the person. Re-attaching someone who is already on the session moves them to the new role instead of duplicating them.",
    inputSchema: schema(
      {
        submissionId: { type: "string" },
        speaker: { type: "string", description: "Person id or email address." },
        role: { type: "string", enum: ["speaker", "chairperson", "moderator"], description: "Default \"speaker\"." },
        firstName: { type: "string", description: "Used only when the email creates a new person." },
        lastName: { type: "string" },
      },
      ["submissionId", "speaker"],
    ),
    readOnly: false,
    destructive: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      const existing = await ctx.runQuery(internal.mcp.getSubmission, {
        userId,
        submissionId: args.submissionId,
      })
      const speaker = String(args.speaker)
      const isEmail = speaker.includes("@")
      return fromApi(
        await ctx.runMutation(internal.apiV1.writeSessionParticipant, {
          userId,
          eventRef: (existing as { eventId?: string }).eventId ?? "",
          sessionId: args.submissionId,
          action: "add",
          ...(isEmail ? { email: speaker } : { speakerId: speaker }),
          firstName: args.firstName,
          lastName: args.lastName,
          role: args.role,
        }),
        "That session or speaker",
      )
    },
  },
  {
    name: "remove_participant",
    title: "Remove a speaker from a session",
    description:
      "Detaches a person from a submission's line-up. The person themselves stays in the event (their profile, tasks and files are untouched) — remove_speaker is the one that deletes a person outright.",
    inputSchema: schema(
      {
        submissionId: { type: "string" },
        speaker: { type: "string", description: "Person id or email address." },
      },
      ["submissionId", "speaker"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      const existing = await ctx.runQuery(internal.mcp.getSubmission, {
        userId,
        submissionId: args.submissionId,
      })
      const eventRef = (existing as { eventId?: string }).eventId ?? ""
      // The remove path takes a person id only — resolve an email to one.
      let speaker = String(args.speaker)
      if (speaker.includes("@")) {
        const link = await ctx.runQuery(internal.mcp.speakerPortalLink, {
          userId,
          event: eventRef,
          speaker,
        })
        speaker = (link as { personId: string }).personId
      }
      return fromApi(
        await ctx.runMutation(internal.apiV1.writeSessionParticipant, {
          userId,
          eventRef,
          sessionId: args.submissionId,
          action: "remove",
          speakerId: speaker,
        }),
        "That session or participant",
      )
    },
  },

  // ——— Agenda: publish ————————————————————————————————————————————————————
  {
    name: "set_agenda_published",
    title: "Publish or unpublish the public agenda",
    description:
      "The public go-live gate: published: true puts the accepted, scheduled programme on the event's public page (and its .ics feed and embeds); false takes it back down to \"Schedule coming soon\". Nothing else changes — sessions and their times stay exactly as they are. Admin or owner role.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        published: { type: "boolean", description: "true = live, false = hidden." },
      },
      ["event", "published"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.setAgendaPublished, {
          userId,
          eventRef: args.event,
          published: args.published,
        }),
        "That event",
      ),
  },

  // ——— Speakers: CRUD + bulk ——————————————————————————————————————————————
  {
    name: "add_speaker",
    title: "Add a speaker",
    description:
      "Adds a person to the event by hand — a keynote you invited, a panelist someone emailed you about. Matched by email: if they already exist in this event the call is idempotent and returns them. They get a portal identity immediately; attach them to a session with add_participant.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        email: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        jobTitle: { type: "string" },
        company: { type: "string" },
        bio: { type: "string" },
        pronouns: { type: "string" },
        workflowStatus: { type: "string", enum: ["invited", "confirmed", "dropped"] },
      },
      ["event", "email"],
    ),
    readOnly: false,
    destructive: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeSpeaker, {
          userId,
          eventRef: args.event,
          input: {
            email: args.email,
            first_name: args.firstName,
            last_name: args.lastName,
            title: args.jobTitle,
            company_name: args.company,
            about: args.bio,
            pronouns: args.pronouns,
            workflow_status: args.workflowStatus,
          },
        }),
        "That event",
      ),
  },
  {
    name: "update_speaker",
    title: "Update a speaker's profile",
    description:
      "Edits a speaker's profile from the organizer side: name, job title, company, bio, pronouns, links, workflow status (invited/confirmed/dropped) and publicVisible (false hides them from every public surface — the embargo toggle). Only the fields you pass change.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        speaker: { type: "string", description: "Person id or email (see list_speakers)." },
        firstName: { type: "string" },
        lastName: { type: "string" },
        jobTitle: { type: "string" },
        company: { type: "string" },
        bio: { type: "string" },
        pronouns: { type: "string" },
        websiteUrl: { type: "string" },
        linkedinUrl: { type: "string" },
        twitterUrl: { type: "string" },
        workflowStatus: { type: "string", enum: ["invited", "confirmed", "dropped"] },
        publicVisible: { type: "boolean" },
      },
      ["event", "speaker"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      // Resolve email → person id the way every speaker tool does.
      const event = String(args.event)
      const link = await ctx.runQuery(internal.mcp.speakerPortalLink, {
        userId,
        event,
        speaker: args.speaker,
      })
      return fromApi(
        await ctx.runMutation(internal.apiV1.writeSpeaker, {
          userId,
          eventRef: event,
          personId: (link as { personId: string }).personId,
          input: {
            first_name: args.firstName,
            last_name: args.lastName,
            title: args.jobTitle,
            company_name: args.company,
            about: args.bio,
            pronouns: args.pronouns,
            website_url: args.websiteUrl,
            linkedin_url: args.linkedinUrl,
            twitter_url: args.twitterUrl,
            workflow_status: args.workflowStatus,
            is_public: args.publicVisible,
          },
        }),
        "That speaker",
      )
    },
  },
  {
    name: "remove_speaker",
    title: "Remove a speaker from the event",
    description:
      "Deletes a person from the event along with their tasks, uploads and headshot. Refused while they are still on a live session — detach them with remove_participant first, so a delete can never orphan a talk. Their already-sent emails stay in the outbox for the record.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        speaker: { type: "string", description: "Person id or email address." },
      },
      ["event", "speaker"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) => {
      const event = String(args.event)
      const link = await ctx.runQuery(internal.mcp.speakerPortalLink, {
        userId,
        event,
        speaker: args.speaker,
      })
      return fromApi(
        await ctx.runMutation(internal.apiV1.deleteSpeaker, {
          userId,
          eventRef: event,
          personId: (link as { personId: string }).personId,
        }),
        "That speaker",
      )
    },
  },
  {
    name: "bulk_add_speakers",
    title: "Bulk-import speakers",
    description:
      "Imports up to 500 speakers in one call — the CSV-import path. Each row is matched by email; existing people get their BLANK fields filled (an import never overwrites curated data), new people are created. Optionally stamp every row with a workflowStatus. Reports added/updated/skipped per row.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        rows: {
          type: "array",
          description: "The people to import.",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              company: { type: "string" },
              jobTitle: { type: "string" },
              bio: { type: "string" },
            },
            required: ["email"],
          },
        },
        workflowStatus: { type: "string", enum: ["invited", "confirmed", "dropped"] },
      },
      ["event", "rows"],
    ),
    readOnly: false,
    destructive: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.bulkAddSpeakers, {
        userId,
        event: args.event,
        rows: args.rows,
        workflowStatus: args.workflowStatus,
      }),
  },

  // ——— Tasks: dashboard + edit + template removal —————————————————————————
  {
    name: "list_tasks",
    title: "List speaker tasks",
    description:
      "The outstanding-tasks dashboard as a call: every task on the event with its speaker, kind, due date and completion state. Filter by status (open, completed, overdue), by one speaker, or by free text. list_speakers groups the same data per speaker; this is the flat task-first view.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        status: { type: "string", enum: ["open", "completed", "overdue"] },
        speaker: { type: "string", description: "Person id or email to filter by." },
        search: { type: "string" },
      },
      ["event"],
    ),
    readOnly: true,
    run: async (ctx, userId, args) => {
      let speakerId: string | undefined
      if (args.speaker) {
        const link = await ctx.runQuery(internal.mcp.speakerPortalLink, {
          userId,
          event: args.event,
          speaker: args.speaker,
        })
        speakerId = (link as { personId: string }).personId
      }
      return fromApi(
        await ctx.runQuery(internal.apiV1.listTasks, {
          userId,
          eventRef: args.event,
          status: args.status,
          speakerId,
          search: args.search,
          now: Date.now(),
          page: 1,
          pageSize: 100,
        }),
        "That event",
      )
    },
  },
  {
    name: "update_task",
    title: "Edit or complete a task",
    description:
      "Edits one task: retitle it, rewrite its instructions, move its due date, or set completed: true/false to mark it done or reopen it (marking done is normally the speaker's job in the portal — do it here when they confirmed out-of-band). Task ids come from list_tasks or list_speakers.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        taskId: { type: "string" },
        title: { type: "string" },
        instructions: { type: "string" },
        dueAt: { type: "string", description: "ISO-8601 due date." },
        completed: { type: "boolean" },
      },
      ["event", "taskId"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeTask, {
          userId,
          eventRef: args.event,
          action: "update",
          taskId: args.taskId,
          input: {
            title: args.title,
            instructions: args.instructions,
            due_at: parseWhen(args.dueAt),
            completed: args.completed,
          },
        }),
        "That task",
      ),
  },
  {
    name: "delete_task_template",
    title: "Delete a task from the library",
    description:
      "Removes a saved task from the event's reusable library. Tasks already assigned from it keep the wording they were sent with. Admin or owner role. Template ids come from list_task_library.",
    inputSchema: schema(
      { template: { type: "string", description: "Template id from list_task_library." } },
      ["template"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.deleteTaskTemplate, {
        userId,
        template: args.template,
      }),
  },

  // ——— Files: review gate —————————————————————————————————————————————————
  {
    name: "list_files",
    title: "List uploaded files",
    description:
      "The event's files library: everything speakers uploaded (and organizers filed for them), with version, approval status (pending / approved / changes_requested), review note, the speaker, and the session or task it belongs to. Filter by approval status or by one speaker. Approval controls public exposure — review with review_file.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        approvalStatus: { type: "string", enum: ["pending", "approved", "changes_requested"] },
        speaker: { type: "string", description: "Person id or email to filter by." },
        limit: { type: "number", description: "Max rows (default 50, max 200)." },
      },
      ["event"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listFiles, {
        userId,
        event: args.event,
        approvalStatus: args.approvalStatus,
        speaker: args.speaker,
        limit: args.limit,
      }),
  },
  {
    name: "review_file",
    title: "Approve or reject an uploaded file",
    description:
      "The file review gate: sets a file to approved (public surfaces may expose it), changes_requested (the speaker's upload task reopens so they see it needs another pass — add a reviewNote saying what to fix), or back to pending. File ids come from list_files or get_submission.",
    inputSchema: schema(
      {
        fileId: { type: "string", description: "From list_files." },
        approvalStatus: { type: "string", enum: ["approved", "changes_requested", "pending"] },
        reviewNote: { type: "string", description: "What to fix — shown to the speaker." },
      },
      ["fileId", "approvalStatus"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.reviewFile, {
        userId,
        fileId: args.fileId,
        approvalStatus: args.approvalStatus,
        reviewNote: args.reviewNote,
      }),
  },
  {
    name: "delete_file",
    title: "Delete an uploaded file (IRREVERSIBLE)",
    description:
      "Permanently deletes one uploaded file — the row and the stored bytes. The escape hatch for a rejected upload nobody should keep. Admin or owner role; there is no undo.",
    inputSchema: schema(
      { fileId: { type: "string", description: "From list_files." } },
      ["fileId"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.deleteFile, {
        userId,
        fileId: args.fileId,
      }),
  },

  // ——— Comms: bulk composer ———————————————————————————————————————————————
  {
    name: "count_bulk_audience",
    title: "Preview a bulk email's audience",
    description:
      "Counts exactly who a bulk email would reach before anything is sent: audiences are all_speakers, accepted (everyone on an accepted session), incomplete_tasks (speakers with open tasks), or manual (the speakers you name). Returns the count and a sample of addresses — quote these to the user before send_bulk_email.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        audience: { type: "string", enum: ["all_speakers", "accepted", "incomplete_tasks", "manual"] },
        speakers: {
          type: "array",
          items: { type: "string" },
          description: "For audience \"manual\": emails or person ids.",
        },
      },
      ["event", "audience"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.countBulkAudience, {
        userId,
        event: args.event,
        audience: args.audience,
        speakers: args.speakers,
      }),
  },
  {
    name: "send_bulk_email",
    title: "Send a bulk email (SENDS EMAIL)",
    description:
      "Sends a one-off email to an audience — \"the venue changed\", \"here's your green-room time\". One message per recipient, each rendered with their own {{firstName}} / {{speakerName}} / {{sessionTitle}} / {{portalLink}}, dropped into the same outbox as every other email. ALWAYS run count_bulk_audience first and tell the user how many people this reaches.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        audience: { type: "string", enum: ["all_speakers", "accepted", "incomplete_tasks", "manual"] },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text or HTML. Placeholders resolve per recipient." },
        speakers: {
          type: "array",
          items: { type: "string" },
          description: "For audience \"manual\": emails or person ids.",
        },
      },
      ["event", "audience", "subject", "body"],
    ),
    readOnly: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.sendBulkEmail, {
        userId,
        event: args.event,
        audience: args.audience,
        subject: args.subject,
        body: args.body,
        speakers: args.speakers,
      }),
  },

  // ——— Evaluation ————————————————————————————————————————————————————————
  {
    name: "list_evaluation_plans",
    title: "List evaluation plans",
    description:
      "Lists the event's evaluation plans (review rounds): name, round number, status, blind flag, window, submission pool size, evaluator count and completion progress. Plans are how scoring works here — a plan bundles criteria, a submission pool and evaluators.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        status: { type: "string", enum: ["open", "closed"] },
      },
      ["event"],
    ),
    readOnly: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runQuery(internal.apiV1.listEvaluationPlans, {
          userId,
          eventRef: args.event,
          status: args.status,
          page: 1,
          pageSize: 100,
        }),
        "That event",
      ),
  },
  {
    name: "get_evaluation_plan",
    title: "Get an evaluation plan",
    description:
      "One plan in full: its criteria (numeric with weights, select, text), the submission pool, every evaluator with their private review link and progress, and per-submission score tallies.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        planId: { type: "string", description: "From list_evaluation_plans." },
      },
      ["event", "planId"],
    ),
    readOnly: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runQuery(internal.apiV1.getEvaluationPlan, {
          userId,
          eventRef: args.event,
          planId: args.planId,
        }),
        "That plan",
      ),
  },
  {
    name: "create_evaluation_plan",
    title: "Create an evaluation plan",
    description:
      "Creates a review round: a name, a round number, scoring criteria (numeric 1–5 with optional weights, select with options, or free text — default is one unweighted 1–5 \"Overall\" score), the submission pool (omit submissionIds for every pending submission), an optional opens/due window, and blind: true to hide speaker identities from evaluators. Add reviewers afterwards with add_evaluator.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        name: { type: "string", description: "e.g. \"Round 1 — technical review\"." },
        round: { type: "number" },
        blind: { type: "boolean" },
        opensAt: { type: "string", description: "ISO-8601." },
        dueAt: { type: "string", description: "ISO-8601." },
        submissionIds: {
          type: "array",
          items: { type: "string" },
          description: "The pool. Omit for all pending submissions.",
        },
        criteria: {
          type: "array",
          description: "Scoring criteria. Omit for a single 1–5 overall score.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              type: { type: "string", enum: ["numeric", "select", "text"] },
              options: { type: "array", items: { type: "string" } },
              weight: { type: "number" },
            },
            required: ["label"],
          },
        },
      },
      ["event", "name"],
    ),
    readOnly: false,
    destructive: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvaluationPlan, {
          userId,
          eventRef: args.event,
          action: "create",
          input: {
            name: args.name,
            round: args.round,
            blind: args.blind,
            opens_at: parseWhen(args.opensAt),
            due_at: parseWhen(args.dueAt),
            submission_ids: args.submissionIds,
            // The promised default: one unweighted 1–5 overall score.
            criteria: args.criteria ?? [{ label: "Overall" }],
          },
        }),
        "That event",
      ),
  },
  {
    name: "update_evaluation_plan",
    title: "Update or close an evaluation plan",
    description:
      "Edits a plan: rename it, change the round number or window, replace the criteria or the submission pool, toggle blind, or set status \"closed\" / \"open\" to end or reopen the round. Replacing criteria on a round that already collected scores changes what future scorecards ask — existing scores keep their criterion ids.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        planId: { type: "string" },
        name: { type: "string" },
        round: { type: "number" },
        status: { type: "string", enum: ["open", "closed"] },
        blind: { type: "boolean" },
        opensAt: { type: "string", description: "ISO-8601." },
        dueAt: { type: "string", description: "ISO-8601." },
        submissionIds: { type: "array", items: { type: "string" } },
        criteria: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: ["numeric", "select", "text"] },
              options: { type: "array", items: { type: "string" } },
              weight: { type: "number" },
            },
            required: ["label"],
          },
        },
      },
      ["event", "planId"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvaluationPlan, {
          userId,
          eventRef: args.event,
          action: "update",
          planId: args.planId,
          input: {
            name: args.name,
            round: args.round,
            status: args.status,
            blind: args.blind,
            opens_at: parseWhen(args.opensAt),
            due_at: parseWhen(args.dueAt),
            submission_ids: args.submissionIds,
            criteria: args.criteria,
          },
        }),
        "That plan",
      ),
  },
  {
    name: "delete_evaluation_plan",
    title: "Delete an evaluation plan (IRREVERSIBLE)",
    description:
      "Permanently deletes a plan together with its evaluators and every score they entered. Admin or owner role; there is no undo. Closing the plan (update_evaluation_plan status \"closed\") is what you almost always want instead, because it keeps the scores.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        planId: { type: "string" },
      },
      ["event", "planId"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvaluationPlan, {
          userId,
          eventRef: args.event,
          action: "delete",
          planId: args.planId,
          input: {},
        }),
        "That plan",
      ),
  },
  {
    name: "add_evaluator",
    title: "Add an evaluator to a plan",
    description:
      "Adds a reviewer to a plan by email. They review through a private magic link (returned as review_path — share it only with them); no account needed. By default they see the plan's whole pool; narrow it with update_evaluator or spread the pool with distribute_evaluations.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        planId: { type: "string" },
        email: { type: "string" },
        name: { type: "string" },
      },
      ["event", "planId", "email"],
    ),
    readOnly: false,
    destructive: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvaluator, {
          userId,
          eventRef: args.event,
          action: "create",
          input: {
            plan_id: args.planId,
            email: args.email,
            name: args.name,
          },
        }),
        "That plan",
      ),
  },
  {
    name: "update_evaluator",
    title: "Set an evaluator's assignments",
    description:
      "Hand-picks which submissions one evaluator reviews (they must be in the plan's pool). Pass an empty array to put them back on the whole pool. Evaluator ids come from get_evaluation_plan.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        evaluatorId: { type: "string" },
        assignedSubmissionIds: {
          type: "array",
          items: { type: "string" },
          description: "[] restores the whole-pool default.",
        },
        name: { type: "string" },
      },
      ["event", "evaluatorId"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvaluator, {
          userId,
          eventRef: args.event,
          action: "update",
          evaluatorId: args.evaluatorId,
          input: {
            assigned_submission_ids: args.assignedSubmissionIds,
            name: args.name,
          },
        }),
        "That evaluator",
      ),
  },
  {
    name: "rotate_evaluator_token",
    title: "Reissue an evaluator's review link",
    description:
      "Issues a fresh magic link for one evaluator and kills the old one instantly — the fix for a review link that was forwarded, leaked or pasted somewhere public. Their scores so far are kept; only the link changes. The new URL comes back in the reply, so send it to them. Admin or owner role.",
    inputSchema: schema(
      { evaluatorId: { type: "string", description: "From get_evaluation_plan." } },
      ["evaluatorId"],
    ),
    readOnly: false,
    idempotent: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.rotateEvaluatorToken, {
        userId,
        evaluatorId: args.evaluatorId,
      }),
  },
  {
    name: "remove_evaluator",
    title: "Remove an evaluator",
    description:
      "Removes an evaluator from their plan together with the scores they entered. Their magic link stops working immediately. Admin or owner role.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        evaluatorId: { type: "string" },
      },
      ["event", "evaluatorId"],
    ),
    readOnly: false,
    idempotent: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeEvaluator, {
          userId,
          eventRef: args.event,
          action: "delete",
          evaluatorId: args.evaluatorId,
          input: {},
        }),
        "That evaluator",
      ),
  },
  {
    name: "list_evaluations",
    title: "List scorecards",
    description:
      "The raw scorecard data behind every average: each evaluator × submission row with its per-criterion scores, comment, completion time — and recusals (declared conflicts of interest), which are excluded from averages. Filter by plan, submission or evaluator.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        planId: { type: "string" },
        submissionId: { type: "string" },
        evaluatorId: { type: "string" },
      },
      ["event"],
    ),
    readOnly: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runQuery(internal.apiV1.listEvaluations, {
          userId,
          eventRef: args.event,
          planId: args.planId,
          sessionId: args.submissionId,
          evaluatorId: args.evaluatorId,
          page: 1,
          pageSize: 100,
        }),
        "That event",
      ),
  },
  {
    name: "distribute_evaluations",
    title: "Distribute the pool across evaluators",
    description:
      "Splits a plan's submission pool evenly across its evaluators, round-robin, so each submission lands with exactly one reviewer. perReviewerCap stops anyone getting more than they agreed to; whatever doesn't fit stays unassigned and is reported back. Re-running with the same inputs gives the same result — but it REPLACES all existing assignments, including hand-picked ones.",
    inputSchema: schema(
      {
        planId: { type: "string", description: "From list_evaluation_plans." },
        perReviewerCap: { type: "number", description: "Most submissions any one evaluator gets." },
      },
      ["planId"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.distributeEvaluations, {
        userId,
        planId: args.planId,
        perReviewerCap: args.perReviewerCap,
      }),
  },
  {
    name: "remind_evaluators",
    title: "Remind evaluators with open reviews (SENDS EMAIL)",
    description:
      "Emails every evaluator on a plan who still has outstanding reviews — each gets their own review link and their own outstanding count. Evaluators who finished are skipped, never nagged. Check progress first with get_evaluation_plan.",
    inputSchema: schema(
      { planId: { type: "string", description: "From list_evaluation_plans." } },
      ["planId"],
    ),
    readOnly: false,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.remindEvaluators, {
        userId,
        planId: args.planId,
      }),
  },

  // ——— Event setup: rooms, tracks, option lists, statuses —————————————————
  {
    name: "list_field_options",
    title: "List rooms, tracks, or option lists",
    description:
      "Reads the event's setup lists in one call: resource \"rooms\" or \"tracks\" (real records with ids), \"tags\", \"formats\", \"levels\" or \"languages\" (the option sets on the CFP form's questions, unioned with any value actually in use), or \"statuses\" (the submission pipeline, built-ins plus custom labels). This is where the ids for update_submission's track argument and manage_* tools come from.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        resource: {
          type: "string",
          enum: ["rooms", "tracks", "tags", "formats", "levels", "languages", "statuses"],
        },
      },
      ["event", "resource"],
    ),
    readOnly: true,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runQuery(internal.apiV1.listSettings, {
          userId,
          eventRef: args.event,
          resource: args.resource,
          page: 1,
          pageSize: 100,
        }),
        "That event",
      ),
  },
  {
    name: "manage_room",
    title: "Add, rename or delete a room",
    description:
      "Manages the event's rooms: create (name + optional capacity), update (rename, change capacity or order), delete (refused while sessions are scheduled in it). Room ids come from get_agenda or list_field_options.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        action: { type: "string", enum: ["create", "update", "delete"] },
        roomId: { type: "string", description: "Required for update/delete." },
        name: { type: "string" },
        capacity: { type: "number" },
        order: { type: "number" },
      },
      ["event", "action"],
    ),
    readOnly: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeMetadata, {
          userId,
          eventRef: args.event,
          resource: "rooms",
          action: args.action,
          id: args.roomId,
          name: args.name,
          capacity: args.capacity,
          order: args.order,
        }),
        "That room",
      ),
  },
  {
    name: "manage_track",
    title: "Add, rename or delete a track",
    description:
      "Manages the event's tracks — the colored single-select that drives routing and agenda columns. create (name + optional color), update, delete. Track ids come from list_field_options resource \"tracks\".",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        action: { type: "string", enum: ["create", "update", "delete"] },
        trackId: { type: "string", description: "Required for update/delete." },
        name: { type: "string" },
        color: { type: "string", description: "A hex color like \"#0F6E70\"." },
        order: { type: "number" },
      },
      ["event", "action"],
    ),
    readOnly: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeMetadata, {
          userId,
          eventRef: args.event,
          resource: "tracks",
          action: args.action,
          id: args.trackId,
          name: args.name,
          color: args.color,
          order: args.order,
        }),
        "That track",
      ),
  },
  {
    name: "manage_field_option",
    title: "Add, rename or remove a dropdown option",
    description:
      "Edits the option sets behind the CFP form's dropdowns: tags, formats, levels, languages. create adds an option, update renames it (cascading onto every session that used the old value), delete stops offering it (existing sessions keep their value, flagged as no longer offered). The option's id IS its value.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        resource: { type: "string", enum: ["tags", "formats", "levels", "languages"] },
        action: { type: "string", enum: ["create", "update", "delete"] },
        value: { type: "string", description: "The existing option (update/delete)." },
        name: { type: "string", description: "The option to add, or the new name on update." },
      },
      ["event", "resource", "action"],
    ),
    readOnly: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeMetadata, {
          userId,
          eventRef: args.event,
          resource: args.resource,
          action: args.action,
          id: args.value,
          name: args.name,
        }),
        "That option",
      ),
  },
  {
    name: "manage_session_status",
    title: "Add, edit, archive or restore a status label",
    description:
      "Manages the event's status labels. A custom status is a LABEL bound to one of the pipeline categories (draft, pending, accepted, declined, withdrawn) — \"Waitlist\" in category pending keeps every queue, email and portal rule working while the organizer sees their own word. create takes name + category + a color token (green, amber, red, gray, blue); delete archives (submissions still carrying the label must be reassigned via reassignTo); restore un-archives. The seven built-ins can be renamed and recoloured but never deleted or re-categorised.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        action: { type: "string", enum: ["create", "update", "delete", "restore"] },
        statusId: { type: "string", description: "From list_field_options resource \"statuses\" (update/delete/restore)." },
        name: { type: "string" },
        category: { type: "string", enum: ["draft", "pending", "accepted", "declined", "withdrawn"] },
        color: { type: "string", enum: ["green", "amber", "red", "gray", "blue"] },
        reassignTo: { type: "string", description: "Where submissions carrying a deleted label land." },
      },
      ["event", "action"],
    ),
    readOnly: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeMetadata, {
          userId,
          eventRef: args.event,
          resource: "statuses",
          action: args.action,
          id: args.statusId,
          name: args.name,
          category: args.category,
          color: args.color,
          reassignTo: args.reassignTo,
        }),
        "That status",
      ),
  },

  // ——— Integrations: webhooks + embeds ————————————————————————————————————
  {
    name: "list_webhooks",
    title: "List webhooks (and their deliveries)",
    description:
      "Lists the workspace's webhook endpoints — URL, subscribed events, enabled state, delivery stats. Pass webhookId to read ONE endpoint with its recent delivery log (status, attempts, response codes, errors). Signing secrets are never returned after creation.",
    inputSchema: schema({
      event: { type: "string", description: "Optional: only endpoints scoped to this event." },
      webhookId: { type: "string", description: "Optional: one endpoint, with recent deliveries." },
    }),
    readOnly: true,
    run: async (ctx, userId, args) => {
      if (args.webhookId) {
        return fromApi(
          await ctx.runQuery(internal.apiV1.getWebhook, {
            userId,
            webhookId: args.webhookId,
          }),
          "That webhook",
        )
      }
      return fromApi(
        await ctx.runQuery(internal.apiV1.listWebhooks, {
          userId,
          eventRef: args.event,
        }),
        "That event",
      )
    },
  },
  {
    name: "manage_webhook",
    title: "Create, edit, test, rotate or delete a webhook",
    description:
      "Manages webhook endpoints: create (returns the whsec_… signing secret ONCE — relay it to the user immediately, it cannot be read again), update (URL, subscribed events, enabled), test (queues a signed webhook.test delivery), rotate (new secret, shown once), delete. Deliveries are HMAC-SHA256 signed (Trackstage-Signature) and retried five times.",
    inputSchema: schema(
      {
        action: { type: "string", enum: ["create", "update", "delete", "rotate", "test"] },
        webhookId: { type: "string", description: "Required for everything but create." },
        event: { type: "string", description: "create only: scope the endpoint to this event (omit for workspace-wide)." },
        url: { type: "string" },
        events: {
          type: "array",
          items: { type: "string" },
          description: "Event types to subscribe to, e.g. [\"submission.created\", \"decision.committed\"].",
        },
        description: { type: "string" },
        enabled: { type: "boolean" },
      },
      ["action"],
    ),
    readOnly: false,
    run: async (ctx, userId, args) =>
      fromApi(
        await ctx.runMutation(internal.apiV1.writeWebhook, {
          userId,
          action: args.action,
          webhookId: args.webhookId,
          eventRef: args.event,
          url: args.url,
          events: args.events,
          description: args.description,
          enabled: args.enabled,
        }),
        "That webhook",
      ),
  },
  {
    name: "list_embeds",
    title: "List saved embeds",
    description:
      "Lists the event's saved embed configurations — named widget setups (agenda, itinerary, sessions, speaker-gallery, speaker-list) an organizer reuses across their website. The Embeds page in the app turns any of them into a copy-paste snippet.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listEmbedsQ, { userId, event: args.event }),
  },
  {
    name: "save_embed",
    title: "Save an embed configuration",
    description:
      "Creates a named embed configuration (or overwrites one by embedId): which widget, its delivery format (iframe, html, link, json, xml, ics), its branding and display options, and whether it is switched on. On an overwrite, options you don't pass keep the value they already had — renaming an embed never drops the accent colour or the track pin. `enabled: false` turns the widget off EVERYWHERE its snippet was pasted: those pages answer \"this embed is turned off\" instead of the programme. Widgets render the PUBLISHED programme — publish the agenda first or the embed shows \"coming soon\".",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        embedId: { type: "string", description: "Present ⇒ overwrite that saved embed." },
        name: { type: "string" },
        widget: { type: "string", enum: ["agenda", "itinerary", "sessions", "speaker-gallery", "speaker-list"] },
        format: { type: "string", enum: ["iframe", "html", "link", "json", "xml", "ics"] },
        track: { type: "string", description: "Limit the widget to one track, or several as a comma-separated list of track NAMES." },
        hideDescriptions: { type: "boolean" },
        hideSpeakers: { type: "boolean" },
        hideImages: { type: "boolean" },
        hideSearch: { type: "boolean" },
        height: { type: "number", description: "iframe height in px." },
        accent: { type: "string", description: "Brand colour as a hex code, e.g. \"#0F6E70\". Pass an empty string to remove it." },
        showHeader: { type: "boolean", description: "Show the event logo and name above the widget." },
        enabled: { type: "boolean", description: "false switches the embed off wherever it is pasted." },
      },
      ["event", "name", "widget"],
    ),
    readOnly: false,
    destructive: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.saveEmbedM, {
        userId,
        event: args.event,
        embedId: args.embedId,
        name: args.name,
        widget: args.widget,
        format: args.format,
        track: args.track,
        hideDescriptions: args.hideDescriptions,
        hideSpeakers: args.hideSpeakers,
        hideImages: args.hideImages,
        hideSearch: args.hideSearch,
        height: args.height,
        accent: args.accent,
        showHeader: args.showHeader,
        enabled: args.enabled,
      }),
  },
  {
    name: "delete_embed",
    title: "Delete a saved embed",
    description:
      "Deletes a saved embed configuration. Snippets already pasted into websites keep working — this only removes the saved preset.",
    inputSchema: schema(
      { embedId: { type: "string", description: "From list_embeds." } },
      ["embedId"],
    ),
    readOnly: false,
    idempotent: true,
    run: (ctx, userId, args) =>
      ctx.runMutation(internal.mcp.deleteEmbedM, {
        userId,
        embedId: args.embedId,
      }),
  },

  // ——— Activity ———————————————————————————————————————————————————————————
  {
    name: "list_activity",
    title: "Event activity feed",
    description:
      "The event's audit trail, newest first: who changed what, when, with a one-line receipt. filter: \"agents\" narrows it to MCP/API writes (including your own earlier calls this session); other values match an entity kind (submission, form, speaker, session, agenda, settings). This is how an organizer verifies what an agent actually did.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        filter: { type: "string", description: "\"agents\", or an entity kind." },
        limit: { type: "number", description: "Max rows (default 25, max 100)." },
      },
      ["event"],
    ),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listActivity, {
        userId,
        event: args.event,
        filter: args.filter,
        limit: args.limit,
      }),
  },
]

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]))

// ══════════════════════════════════════════════════════════════════════════
// Universal write gating (Marko's directive: anything but a READ is gated)
//
// Every non-read-only tool requires `confirm: true`. Without it the call is
// refused with an instruction to ask the user first — so a model driving this
// server can never write anything a human didn't just approve, whatever its
// client does about annotations. The `confirm` argument is injected here, in
// one place, so a tool added tomorrow is gated by construction; the three
// destructive tools that already declared their own `confirm` (with sharper
// wording) keep it. Clients with native approval UIs (the in-app copilot,
// ChatGPT's write-action confirmation) collect the human "yes" themselves and
// then supply confirm: true — the two layers are the same gate, not two gates.
// ══════════════════════════════════════════════════════════════════════════

const CONFIRM_ARG = {
  type: "boolean",
  description:
    "Must be true. This tool changes data — tell the user exactly what you are about to do and set this only after they approve.",
}

for (const tool of TOOLS) {
  if (tool.readOnly) continue
  const properties = tool.inputSchema.properties
  if (!("confirm" in properties)) properties.confirm = CONFIRM_ARG
  const required = tool.inputSchema.required ?? []
  if (!required.includes("confirm")) {
    tool.inputSchema.required = [...required, "confirm"]
  }
}

/** The refusal a write tool answers when `confirm: true` is missing. */
function confirmRefusal(tool: ToolDef): string {
  const tier =
    (tool.destructive ?? true)
      ? "changes or destroys existing data"
      : "creates new data"
  return (
    `${tool.name} ${tier}, so it will not run without confirm: true. ` +
    `Tell the user precisely what this call will do (${tool.title.replace(/ \(.*\)$/, "").toLowerCase()}), wait for their approval, then call it again with confirm: true. ` +
    `Read-only tools never need confirm. Nothing has been changed.`
  )
}

// ══════════════════════════════════════════════════════════════════════════
// JSON-RPC 2.0 / Streamable HTTP transport
// ══════════════════════════════════════════════════════════════════════════

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Protocol-Version, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers":
    "Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extra,
    },
  })
}

type RpcId = string | number | null

function rpcResult(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result }
}

function rpcError(id: RpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  }
}

function siteBase(): string {
  return (process.env.CONVEX_SITE_URL ?? "").replace(/\/+$/, "")
}

/**
 * 401 in the shape MCP clients expect: RFC 9728's `WWW-Authenticate` pointer
 * at our protected-resource metadata, which is what makes "add connector by
 * URL" kick off the OAuth dance in Claude and ChatGPT instead of giving up.
 */
function unauthorized(message: string) {
  const resourceMetadata = `${siteBase()}/.well-known/oauth-protected-resource`
  return json(
    rpcError(null, INVALID_REQUEST, message),
    401,
    {
      "WWW-Authenticate": `Bearer realm="trackstage", resource_metadata="${resourceMetadata}"`,
    },
  )
}

/**
 * Bearer token → user id. Personal API keys first (cheap, and the documented
 * headless path); anything else is tried as a Better Auth OAuth access token
 * issued by the `mcp` plugin.
 */
async function authenticate(
  ctx: ActionCtx,
  request: Request,
): Promise<string | null> {
  const header = request.headers.get("Authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return null
  const token = match[1].trim()
  if (!token) return null

  if (token.startsWith("sb_live_")) {
    return await ctx.runMutation(internal.mcp.resolveApiKey, { key: token })
  }

  try {
    const auth = createAuth(ctx)
    const session = await auth.api.getMcpSession({ headers: request.headers })
    return session?.userId ?? null
  } catch {
    return null
  }
}

/**
 * The displayable head of the API key on this request ("sb_live_1a2b3c4d"),
 * or null for an OAuth session. Used only for attribution in the audit log —
 * never for authorization, which `authenticate` above has already settled.
 */
function presentedKey(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(
    (request.headers.get("Authorization") ?? "").trim(),
  )
  const token = match?.[1]?.trim()
  if (!token || !token.startsWith("sb_live_")) return null
  return keyPrefix(token)
}

function initializeResult(requested: unknown) {
  const protocolVersion =
    typeof requested === "string" && SUPPORTED_PROTOCOLS.includes(requested)
      ? requested
      : LATEST_PROTOCOL
  return {
    protocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: {
      name: SERVER_NAME,
      title: "Trackstage",
      version: SERVER_VERSION,
    },
    instructions:
      "Trackstage runs conferences: call-for-papers forms, submissions and accept/decline decisions, evaluation rounds, the agenda, the speaker roster and their tasks, files, emails, webhooks and workspace membership. Start with list_events, then get_event_summary for the state of play (it is the whole dashboard — get_agenda is for the timetable itself). Every `event` argument takes an id or a slug. APPROVALS: every tool that writes anything requires confirm: true and refuses without it — tell the user exactly what you are about to do, get their approval, then call again with confirm: true; reads never need it. Decisions are two-step on purpose: set_submission_status stages them, commit_decision_queue is what actually emails the speakers. delete_event additionally needs the event's exact name in confirmName — never infer a deletion the user did not explicitly ask for.",
  }
}

// ——— Audit trail for agent writes (sbek CNT-11) ——————————————————————————
// Marko's directive: agent-driven changes are FIRST-CLASS in the record.
// Every non-read-only tool call that succeeds writes one audit row attributed
// to "MCP · <tool> · <key prefix>", so the Activity feed's "Agents & API"
// lens shows exactly what the robots did — receipts included for the
// destructive ones.
//
// It is emitted HERE, at the dispatcher, rather than inside each tool's
// mutation: the MCP tools carry their own copies of the domain logic, so one
// call site covers every write tool (including ones added later) and cannot
// double-log against the in-app path. Failure is swallowed — a logging
// problem must never turn a successful tool call into an error.

/** Which row a write tool acts on, so the audit row lands on that record. */
const TOOL_SUBJECTS: Record<
  string,
  { entity: string; table?: string; arg?: string }
> = {
  create_event: { entity: "settings" },
  delete_event: { entity: "settings" },
  create_form: { entity: "form" },
  update_form_settings: { entity: "form", table: "forms", arg: "form" },
  delete_form: { entity: "form", table: "forms", arg: "form" },
  set_submission_status: {
    entity: "submission",
    table: "submissions",
    arg: "submissionId",
  },
  commit_decision_queue: { entity: "submission" },
  add_manual_session: { entity: "session" },
  schedule_session: { entity: "session", table: "submissions", arg: "submissionId" },
  unschedule_session: {
    entity: "session",
    table: "submissions",
    arg: "submissionId",
  },
  auto_place_sessions: { entity: "agenda" },
  assign_task: { entity: "speaker", table: "people", arg: "speakerId" },
  remove_task: { entity: "speaker", table: "tasks", arg: "taskId" },
  send_reminders: { entity: "speaker" },
  update_template: { entity: "settings" },
  send_test_email: { entity: "settings" },
  update_event: { entity: "settings" },
  update_form: { entity: "form", table: "forms", arg: "form" },
  manage_form_question: { entity: "form" },
  update_submission: { entity: "submission", table: "submissions", arg: "submissionId" },
  delete_submission: { entity: "submission", table: "submissions", arg: "submissionId" },
  restore_submission: { entity: "submission", table: "submissions", arg: "submissionId" },
  add_participant: { entity: "submission", table: "submissions", arg: "submissionId" },
  remove_participant: { entity: "submission", table: "submissions", arg: "submissionId" },
  set_agenda_published: { entity: "agenda" },
  add_speaker: { entity: "speaker" },
  update_speaker: { entity: "speaker" },
  remove_speaker: { entity: "speaker" },
  bulk_add_speakers: { entity: "speaker" },
  update_task: { entity: "speaker", table: "tasks", arg: "taskId" },
  delete_task_template: { entity: "settings" },
  review_file: { entity: "speaker" },
  delete_file: { entity: "speaker" },
  send_bulk_email: { entity: "speaker" },
  create_evaluation_plan: { entity: "settings" },
  update_evaluation_plan: { entity: "settings" },
  delete_evaluation_plan: { entity: "settings" },
  add_evaluator: { entity: "settings" },
  update_evaluator: { entity: "settings" },
  remove_evaluator: { entity: "settings" },
  distribute_evaluations: { entity: "settings" },
  remind_evaluators: { entity: "settings" },
  manage_room: { entity: "settings" },
  manage_track: { entity: "settings" },
  manage_field_option: { entity: "settings" },
  manage_session_status: { entity: "settings" },
  manage_webhook: { entity: "settings" },
  save_embed: { entity: "settings" },
  delete_embed: { entity: "settings" },
  invite_workspace_member: { entity: "settings" },
  update_workspace_member: { entity: "settings" },
  remove_workspace_member: { entity: "settings" },
}

/** Receipt keys worth putting in the sentence an organizer reads. */
const RECEIPT_KEYS = [
  "title",
  "name",
  "status",
  "committed",
  "emailsQueued",
  "placed",
  "queued",
  "removed",
  "deleted",
  "count",
  "speaker",
]

function receiptText(result: unknown): string {
  if (result === null || typeof result !== "object") return ""
  const row = result as Record<string, unknown>
  const parts: string[] = []
  for (const key of RECEIPT_KEYS) {
    const value = row[key]
    if (value === undefined || value === null || value === "") continue
    if (typeof value === "object") continue
    parts.push(`${key} ${String(value).slice(0, 80)}`)
    if (parts.length >= 3) break
  }
  return parts.join(", ")
}

async function auditToolCall(
  ctx: ActionCtx,
  userId: string,
  credentialPrefix: string | null,
  tool: ToolDef,
  args: Record<string, any>,
  result: unknown,
): Promise<void> {
  const subject = TOOL_SUBJECTS[tool.name] ?? { entity: "settings" }
  const receipt = receiptText(result)
  try {
    await ctx.runMutation(internal.audit.recordMcpToolCall, {
      userId,
      tool: tool.name,
      keyPrefix: credentialPrefix ?? undefined,
      eventRef: typeof args.event === "string" ? args.event : undefined,
      subjectTable: subject.table,
      subjectRef:
        subject.arg && typeof args[subject.arg] === "string"
          ? args[subject.arg]
          : undefined,
      entity: subject.entity,
      summary: `${tool.title}${receipt ? ` — ${receipt}` : ""} (via MCP)`,
      meta: {
        tool: tool.name,
        args: JSON.stringify(args).slice(0, 500),
        ...(receipt ? { receipt } : {}),
      },
    })
  } catch {
    // History is best-effort; the write already succeeded.
  }
}

async function handleRpc(
  ctx: ActionCtx,
  userId: string,
  message: any,
  credentialPrefix: string | null = null,
): Promise<object | null> {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC 2.0 object.")
  }
  const id: RpcId = message.id ?? null
  const isNotification = message.id === undefined
  const method = message.method

  if (typeof method !== "string") {
    return isNotification
      ? null
      : rpcError(id, INVALID_REQUEST, "Missing `method`.")
  }

  switch (method) {
    case "initialize":
      return rpcResult(id, initializeResult(message.params?.protocolVersion))

    // Lifecycle notifications: acknowledged, nothing to return.
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/progress":
      return null

    case "ping":
      return rpcResult(id, {})

    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          // Truthful, per the 2025-06-18 spec: readOnlyHint is what
          // well-behaved clients (ChatGPT honors it explicitly) use to skip
          // approval on reads; destructiveHint false marks purely additive
          // creates; idempotentHint true marks safe-to-repeat writes.
          annotations: {
            title: tool.title,
            readOnlyHint: tool.readOnly,
            destructiveHint: tool.readOnly ? false : (tool.destructive ?? true),
            idempotentHint: tool.readOnly ? true : (tool.idempotent ?? false),
            openWorldHint: false,
          },
        })),
      })

    // Declared-empty capabilities, but answer politely rather than 404 —
    // several clients probe these on connect.
    case "resources/list":
      return rpcResult(id, { resources: [] })
    case "resources/templates/list":
      return rpcResult(id, { resourceTemplates: [] })
    case "prompts/list":
      return rpcResult(id, { prompts: [] })

    case "tools/call": {
      const name = message.params?.name
      const tool = typeof name === "string" ? TOOLS_BY_NAME.get(name) : undefined
      if (!tool) {
        return rpcError(
          id,
          INVALID_PARAMS,
          `Unknown tool "${name}". Call tools/list to see what's available.`,
        )
      }
      const args = message.params?.arguments ?? {}
      if (typeof args !== "object" || args === null || Array.isArray(args)) {
        return rpcError(id, INVALID_PARAMS, "`arguments` must be an object.")
      }
      // THE write gate — checked before schema validation so the model reads
      // this instruction rather than a bare "missing required argument".
      // A tool RESULT with isError (not a protocol error), because that is
      // the channel models actually read and correct from.
      if (
        !tool.readOnly &&
        (args as Record<string, unknown>).confirm !== true
      ) {
        return rpcResult(id, {
          content: [{ type: "text", text: confirmRefusal(tool) }],
          isError: true,
        })
      }
      const invalid = validateArgs(tool, args as Record<string, unknown>)
      if (invalid) return rpcError(id, INVALID_PARAMS, invalid)
      try {
        const result = await tool.run(ctx, userId, args as Record<string, any>)
        if (!tool.readOnly) {
          await auditToolCall(
            ctx,
            userId,
            credentialPrefix,
            tool,
            args as Record<string, any>,
            result,
          )
        }
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: false,
        })
      } catch (error) {
        // Tool failures are RESULTS with isError, not protocol errors — that's
        // what lets the model read the message and correct itself.
        const detail = toolErrorMessage(error)
        return rpcResult(id, {
          content: [{ type: "text", text: detail }],
          isError: true,
        })
      }
    }

    default:
      return isNotification
        ? null
        : rpcError(id, METHOD_NOT_FOUND, `Unsupported method "${method}".`)
  }
}

export const handleMcpPost = httpAction(async (ctx, request) => {
  const version = request.headers.get("mcp-protocol-version")
  if (version && !SUPPORTED_PROTOCOLS.includes(version)) {
    return json(
      rpcError(
        null,
        INVALID_REQUEST,
        `Unsupported MCP-Protocol-Version "${version}". Supported: ${SUPPORTED_PROTOCOLS.join(", ")}.`,
      ),
      400,
    )
  }

  const userId = await authenticate(ctx, request)
  if (!userId) {
    return unauthorized(
      "Missing or invalid credentials. Send `Authorization: Bearer <your Trackstage API key>` (create one in Settings → API & MCP), or connect via OAuth.",
    )
  }
  // Which credential is acting, for the audit trail. Read straight off the
  // header (not from the key row) so nothing sensitive travels further than it
  // already has: `keyPrefix` is the displayable head of the key, exactly what
  // Settings → API & MCP shows. OAuth callers have no key, and log as "MCP".
  const presentedKeyPrefix = presentedKey(request)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json(rpcError(null, PARSE_ERROR, "Request body is not valid JSON."), 400)
  }

  // Batches were dropped in 2025-06-18 but older clients still send them.
  if (Array.isArray(payload)) {
    const responses = []
    for (const message of payload) {
      const response = await handleRpc(ctx, userId, message, presentedKeyPrefix)
      if (response) responses.push(response)
    }
    if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS })
    return json(responses)
  }

  const response = await handleRpc(ctx, userId, payload, presentedKeyPrefix)
  // Notifications and responses get 202 Accepted with no body, per the spec.
  if (response === null) return new Response(null, { status: 202, headers: CORS_HEADERS })
  return json(response)
})

/**
 * GET is the server-initiated SSE stream. This server never pushes anything
 * unprompted, so the spec's answer is 405 — with a body explaining how to
 * actually connect, because a human poking the URL in a browser lands here.
 */
export const handleMcpGet = httpAction(async () => {
  return json(
    {
      error: "method_not_allowed",
      message:
        "This is the Trackstage MCP endpoint. It speaks JSON-RPC 2.0 over HTTP POST (MCP Streamable HTTP); it does not offer a server-initiated SSE stream, so GET is not supported.",
      connect: {
        endpoint: `${siteBase()}/mcp`,
        transport: "http",
        auth: "Authorization: Bearer <API key from Settings → API & MCP>, or OAuth (add by URL in Claude/ChatGPT connectors).",
        claudeCode: `claude mcp add trackstage --transport http ${siteBase()}/mcp --header "Authorization: Bearer sb_live_..."`,
      },
      docs: `${siteUrl()}/app/settings/api-mcp`,
    },
    405,
    { Allow: "POST, OPTIONS" },
  )
})

/** Stateless server: there is no session to delete, but say so politely. */
export const handleMcpDelete = httpAction(async () => {
  return new Response(null, { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } })
})

export const handleMcpOptions = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
})

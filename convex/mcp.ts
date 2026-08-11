import { v } from "convex/values"
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
import { eventAccessFor, membershipFor, randomToken } from "./lib/auth"
import { hashApiKey } from "./apiKeys"
import { autoPlaceCore, computeConflicts } from "./agenda"
import { ensureOnboardingTasks, withJoins } from "./submissions"
import { queueMessage, queueTaskReminders } from "./comms"
import {
  DEFAULT_TEMPLATES,
  defaultTemplate,
  portalLinkFor,
  siteUrl,
} from "./lib/email"

// ══════════════════════════════════════════════════════════════════════════
// Sessionboard MCP server — Model Context Protocol over Streamable HTTP.
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

const SERVER_NAME = "sessionboard"
const SERVER_VERSION = "1.0.0"
const LATEST_PROTOCOL = "2025-06-18"
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]

/** JSON-RPC 2.0 reserved codes (https://www.jsonrpc.org/specification). */
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

const MAX_ROWS = 4000

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
  let event = asId ? await ctx.db.get(asId) : null
  if (!event) {
    event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", trimmed))
      .unique()
  }
  if (!event) {
    throw new Error(
      `No event matches "${ref}". Call list_events to see the available event ids and slugs.`,
    )
  }
  const access = await eventAccessFor(ctx, userId, event._id, minRole)
  return access.event
}

/** Narrows a caller-supplied string to a real id, with a readable failure. */
function requireId<T extends "submissions" | "forms" | "rooms" | "tracks" | "people" | "tasks">(
  ctx: QueryCtx | MutationCtx,
  table: T,
  value: string,
): Id<T> {
  const id = ctx.db.normalizeId(table, value.trim())
  if (!id) throw new Error(`"${value}" is not a valid ${table} id.`)
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
    throw new Error(
      `"${value}" is not a valid date. Use an ISO-8601 string such as "2026-09-14T09:30:00Z".`,
    )
  }
  return parsed
}

function iso(ms: number | undefined | null): string | null {
  return ms === undefined || ms === null ? null : new Date(ms).toISOString()
}

function publicFormUrl(slug: string): string {
  return `${siteUrl()}/submit/${slug}`
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
      rows.push({
        organizationId: org._id,
        name: org.name,
        slug: org.slug,
        yourRole: membership.role,
        eventCount: events.length,
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
    if (!name) throw new Error("An event name is required.")

    // With a single workspace the caller shouldn't have to name it.
    let organizationId: Id<"organizations">
    if (args.organizationId) {
      const normalized = ctx.db.normalizeId("organizations", args.organizationId)
      if (!normalized) throw new Error(`"${args.organizationId}" is not a valid workspace id.`)
      organizationId = normalized
    } else {
      const memberships = await ctx.db
        .query("members")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect()
      if (memberships.length === 0) throw new Error("You don't belong to a workspace yet.")
      if (memberships.length > 1) {
        throw new Error(
          "You belong to several workspaces — pass organizationId (see list_workspaces).",
        )
      }
      organizationId = memberships[0].organizationId
    }
    await membershipFor(ctx, args.userId, organizationId, "admin")

    const base =
      (args.slug ?? name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "event"
    let slug = base
    let n = 2
    while (
      await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      slug = `${base}-${n++}`
    }

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
    return { eventId, slug, name, publicSubmitUrlHint: `${siteUrl()}/submit/<form-slug>` }
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
  const acceptedCount = statusCounts.accepted ?? 0
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

export const eventOverview = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
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
    return {
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
      statusCounts: stats.statusCounts,
      openTaskCount: stats.openTasks.length,
      scheduledSessions: stats.scheduledCount,
      acceptedNotYetScheduled: stats.unscheduledAccepted,
      agendaConflicts: conflicts.length,
      outbox: outboxByStatus,
      forms: stats.forms.map((form) => ({
        formId: form._id,
        name: form.internalName,
        slug: form.slug,
        status: form.status,
        closeAt: iso(form.closeAt),
        publicUrl: publicFormUrl(form.slug),
      })),
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Forms
// ══════════════════════════════════════════════════════════════════════════

export const listForms = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .collect()
    const rows = []
    for (const form of forms) {
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
        closeAt: iso(form.closeAt),
        publicUrl: publicFormUrl(form.slug),
        submissionCount: submissions.filter((s) => s.status !== "draft").length,
        draftCount: submissions.filter((s) => s.status === "draft").length,
      })
    }
    return { forms: rows }
  },
})

/** The one form lookup: takes a form id, or a form slug, or an event ref. */
async function resolveForm(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  ref: string,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<Doc<"forms">> {
  const trimmed = ref.trim()
  const asId = ctx.db.normalizeId("forms", trimmed)
  let form = asId ? await ctx.db.get(asId) : null
  if (!form) {
    form = await ctx.db
      .query("forms")
      .withIndex("by_slug", (q) => q.eq("slug", trimmed))
      .unique()
  }
  if (!form) {
    throw new Error(
      `No form matches "${ref}". Call list_forms to see the form ids and slugs.`,
    )
  }
  await eventAccessFor(ctx, userId, form.eventId, minRole)
  return form
}

export const getForm = internalQuery({
  args: { userId: v.string(), form: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const form = await resolveForm(ctx, args.userId, args.form)
    return {
      formId: form._id,
      eventId: form.eventId,
      name: form.internalName,
      externalTitle: form.externalTitle,
      pageHeading: form.pageHeading ?? null,
      welcomeMessage: form.welcomeMessage ?? null,
      slug: form.slug,
      kind: form.kind,
      status: form.status,
      closeAt: iso(form.closeAt),
      publicUrl: publicFormUrl(form.slug),
      questions: form.questions.map((question) => ({
        id: question.id,
        label: question.label,
        type: question.type,
        required: question.required,
        enabled: question.enabled,
        locked: question.locked,
        options: question.options ?? null,
        showIf: question.showIf ?? null,
        isTrackQuestion: question.isTrackQuestion ?? false,
      })),
      participantConfig: form.participantConfig,
      settings: form.settings,
      notifyEmails: form.notifyEmails,
    }
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
      throw new Error("kind must be 'abstract' or 'session'.")
    }
    const name = args.name.trim()
    if (!name) throw new Error("A form name is required.")

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
      { id: "track", label: "Track", type: "dropdown", required: true, enabled: true, locked: false, options: tracks.map((t) => t.name), isTrackQuestion: true },
      { id: "level", label: "Level", type: "dropdown", required: false, enabled: true, locked: false, options: ["Introductory", "Intermediate", "Advanced"] },
      { id: "language", label: "Language", type: "dropdown", required: false, enabled: true, locked: false, options: ["English"] },
      { id: "tags", label: "Tags", type: "multi_select", required: false, enabled: true, locked: false, options: ["AI", "Infrastructure", "Product", "Open Source"] },
    ]

    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "form"
    let slug = base
    let n = 2
    while (
      await ctx.db
        .query("forms")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      slug = `${base}-${n++}`
    }

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
    return { formId, slug, publicUrl: publicFormUrl(slug), status: "open" }
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
        throw new Error("status must be 'open' or 'closed'.")
      }
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
      throw new Error("Nothing to update — pass at least one setting.")
    }
    await ctx.db.patch(form._id, patch)
    const updated = await ctx.db.get(form._id)
    return {
      formId: form._id,
      status: updated?.status,
      closeAt: iso(updated?.closeAt),
      publicUrl: publicFormUrl(form.slug),
      settings: updated?.settings,
    }
  },
})

export const publicFormLink = internalQuery({
  args: { userId: v.string(), form: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const form = await resolveForm(ctx, args.userId, args.form)
    const now = Date.now()
    const closed =
      form.status !== "open" || (form.closeAt !== undefined && form.closeAt < now)
    return {
      formId: form._id,
      name: form.internalName,
      publicUrl: publicFormUrl(form.slug),
      status: form.status,
      closeAt: iso(form.closeAt),
      acceptingSubmissions: !closed,
      note: closed
        ? "This form is not accepting submissions right now — reopen it with update_form_settings."
        : "Share this link with prospective speakers.",
    }
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
      throw new Error(
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

    let joined = await Promise.all(rows.map((row) => withJoins(ctx, row)))
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

export const getSubmission = internalQuery({
  args: { userId: v.string(), submissionId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = requireId(ctx, "submissions", args.submissionId)
    const submission = await ctx.db.get(id)
    if (!submission) throw new Error("Submission not found.")
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
      throw new Error(
        `Invalid status "${args.status}". One of: ${SUBMISSION_STATUSES.join(", ")}.`,
      )
    }
    const id = requireId(ctx, "submissions", args.submissionId)
    const submission = await ctx.db.get(id)
    if (!submission) throw new Error("Submission not found.")
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
      throw new Error("queue must be 'accept_queue' or 'decline_queue'.")
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
    if (!title) throw new Error("A title is required.")

    const kind = args.kind === "abstract" ? "abstract" : "session"
    const status = args.status ?? (kind === "session" ? "accepted" : "pending")
    if (!SUBMISSION_STATUSES.includes(status)) {
      throw new Error(
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
        throw new Error(
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
    return { submissionId, title, kind, status, speakers: added }
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
      scheduled,
      unscheduled,
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
    if (!submission) throw new Error("Session not found.")
    await eventAccessFor(ctx, args.userId, submission.eventId)
    if (submission.status !== "accepted") {
      throw new Error(
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
      throw new Error(
        `No room named "${args.room}". Available: ${rooms.map((r) => r.name).join(", ") || "(none — add one in Settings)"}.`,
      )
    }
    const durationMinutes = args.durationMinutes ?? submission.durationMinutes ?? 45
    if (durationMinutes < 5 || durationMinutes > 480) {
      throw new Error("Duration must be between 5 minutes and 8 hours.")
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
    if (!submission) throw new Error("Session not found.")
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

export const listSpeakers = internalQuery({
  args: {
    userId: v.string(),
    event: v.string(),
    onlyWithOutstandingWork: v.optional(v.boolean()),
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
      if (
        args.onlyWithOutstandingWork &&
        openTasks.length === 0 &&
        missing.length === 0
      ) {
        continue
      }
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
      })
    }
    rows.sort(
      (a, b) =>
        b.outstandingTasks.length - a.outstandingTasks.length ||
        a.name.localeCompare(b.name),
    )
    return { speakerCount: rows.length, speakers: rows }
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
  throw new Error(
    `No speaker matching "${ref}" in this event. Use list_speakers to see emails.`,
  )
}

export const speakerPortalLink = internalQuery({
  args: { userId: v.string(), event: v.string(), speaker: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const person = await findPerson(ctx, event._id, args.speaker)
    return {
      personId: person._id,
      name: personName(person),
      email: person.email,
      portalUrl: portalLinkFor(person.portalToken),
      note: "A private magic link — it signs this speaker straight into their portal. Share it only with them.",
    }
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
    if (!title) throw new Error("A task title is required.")
    const kind = args.kind ?? "confirm"
    const kinds = ["profile", "headshot", "upload", "form", "confirm"]
    if (!kinds.includes(kind)) {
      throw new Error(`Invalid task kind "${kind}". One of: ${kinds.join(", ")}.`)
    }
    if (args.speakers.length === 0) {
      throw new Error("Assign the task to at least one speaker.")
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
    const rows = stored.map((row) => ({
      key: row.key,
      name: row.name,
      subject: row.subject,
      body: row.body,
      customized: true,
    }))
    for (const template of DEFAULT_TEMPLATES) {
      if (byKey.has(template.key)) continue
      rows.push({
        key: template.key,
        name: template.name,
        subject: template.subject,
        body: template.body,
        customized: false,
      })
    }
    return {
      templates: rows,
      variables: ["speakerName", "firstName", "sessionTitle", "eventName", "portalLink"],
      note: "Placeholders use {{variable}} syntax and are filled in when the email is queued.",
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
    if (!key) throw new Error("A template key is required.")
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
// Meta
// ══════════════════════════════════════════════════════════════════════════

export const eventSummary = internalQuery({
  args: { userId: v.string(), event: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.userId, args.event)
    const stats = await eventStats(ctx, event)
    const conflicts = await computeConflicts(ctx, event._id)
    const now = Date.now()

    const pending = stats.statusCounts.pending ?? 0
    const acceptQueue = stats.statusCounts.accept_queue ?? 0
    const declineQueue = stats.statusCounts.decline_queue ?? 0

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

    const headline =
      `${event.name} — ${stats.submissions.length} submission(s): ` +
      `${stats.statusCounts.accepted ?? 0} accepted, ${pending} pending, ` +
      `${stats.statusCounts.declined ?? 0} declined. ` +
      `${stats.scheduledCount} session(s) scheduled across ${stats.forms.length} form(s).`

    return {
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
      submissions: stats.statusCounts,
      agenda: {
        scheduled: stats.scheduledCount,
        acceptedNotScheduled: stats.unscheduledAccepted,
        conflicts: conflicts.map((c) => c.label),
      },
      speakerTasks: {
        open: stats.openTasks.length,
        completed: stats.tasks.length - stats.openTasks.length,
      },
      forms: stats.forms.map((form) => ({
        name: form.internalName,
        status: form.status,
        publicUrl: publicFormUrl(form.slug),
        closesAt: iso(form.closeAt),
      })),
      needsAttention:
        needsAttention.length > 0 ? needsAttention : ["Nothing outstanding — you're in good shape."],
      upcomingDeadlines: deadlines.slice(0, 8),
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

export const TOOLS: Array<ToolDef> = [
  // ——— Workspaces & events ———————————————————————————————————————————————
  {
    name: "list_workspaces",
    title: "List workspaces",
    description:
      "Lists every Sessionboard workspace (organization) you belong to, your role in each (owner/admin/member), and how many events each one holds. Start here when you don't yet know which workspace or event to operate on.",
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
      "Creates a new event in one of your workspaces. Requires the admin or owner role. If you belong to exactly one workspace you can omit organizationId. Dates are ISO-8601 strings, e.g. \"2026-09-14T09:00:00Z\"; set them if you plan to use auto_place_sessions later.",
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
    title: "Event dashboard stats",
    description:
      "The organizer dashboard as data: submission counts by status, outstanding speaker tasks, how many accepted sessions are still unscheduled, agenda conflict count, outbox counts by delivery status, and every CFP form with its public link. Use it to answer \"how is my event doing?\".",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.eventOverview, { userId, event: args.event }),
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
      ctx.runQuery(internal.mcp.listForms, { userId, event: args.event }),
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
      ctx.runQuery(internal.mcp.getForm, { userId, form: args.form }),
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
      ctx.runQuery(internal.mcp.publicFormLink, { userId, form: args.form }),
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
        throw new Error(
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
      "The full programme: scheduled sessions in time order (room, start, duration, track, speakers), the unscheduled tray of accepted sessions still waiting for a slot, the room list, and every detected conflict (same room double-booked, or a speaker in two overlapping sessions).",
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
      "The confirmed speaker roster: everyone attached to an accepted session, their sessions, their outstanding onboarding tasks with due dates, and what's still missing from their profile (bio, headshot, slides). This is the \"who do I need to chase?\" list.",
    inputSchema: schema(
      {
        event: EVENT_ARG,
        onlyWithOutstandingWork: {
          type: "boolean",
          description: "Return only speakers who still owe you something.",
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
      "Assigns an onboarding task to one or more speakers — it appears in their portal immediately. Kinds: profile (complete bio), headshot, upload (send a file such as slides), form, confirm (acknowledge something). Assigning does not email anyone; run send_reminders for that.",
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
          enum: ["profile", "headshot", "upload", "form", "confirm"],
          description: "Default \"confirm\".",
        },
        instructions: { type: "string" },
        dueAt: { type: "string", description: "ISO-8601 due date." },
      },
      ["event", "speakers", "title"],
    ),
    readOnly: false,
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
      "Lists the event's email templates (accepted, declined, waitlisted, reminder, confirmation) with their subject and body, and whether each has been customised or is still the built-in default. Placeholders such as {{firstName}} and {{sessionTitle}} are filled in at send time.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.listTemplates, { userId, event: args.event }),
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
          description: "Template key, e.g. accepted | declined | waitlisted | reminder | confirmation.",
        },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text or HTML." },
        name: { type: "string", description: "Display name for the template." },
      },
      ["event", "key"],
    ),
    readOnly: false,
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
      "Shows what Sessionboard has emailed (or is about to email) for this event: recipient, subject, template, delivery status and any error. Status \"preview\" means the message was rendered but deliberately not delivered (demo @example.com recipients, or no RESEND_API_KEY configured).",
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
        key: { type: "string", description: "Template key, e.g. \"accepted\"." },
        to: { type: "string", description: "Override recipient. Defaults to your own address." },
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

  // ——— Meta ———————————————————————————————————————————————————————————————
  {
    name: "get_event_summary",
    title: "Summarise an event",
    description:
      "One call for the whole picture: a headline sentence, submission counts by status, agenda health (scheduled vs waiting, conflicts), open speaker tasks, every CFP form with its public link, a prioritised \"needs attention\" list of what to do next, and the nearest deadlines. Reach for this first when someone asks how their event is going or what they should do next.",
    inputSchema: schema({ event: EVENT_ARG }, ["event"]),
    readOnly: true,
    run: (ctx, userId, args) =>
      ctx.runQuery(internal.mcp.eventSummary, { userId, event: args.event }),
  },
]

const TOOLS_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]))

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
      "WWW-Authenticate": `Bearer realm="sessionboard", resource_metadata="${resourceMetadata}"`,
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
      title: "Sessionboard",
      version: SERVER_VERSION,
    },
    instructions:
      "Sessionboard runs conferences: call-for-papers forms, submissions and accept/decline decisions, the agenda, the speaker roster and their tasks, and the emails that go out. Start with list_events, then get_event_summary for the state of play. Every `event` argument takes an id or a slug. Decisions are two-step on purpose: set_submission_status stages them, commit_decision_queue is what actually emails the speakers.",
  }
}

async function handleRpc(
  ctx: ActionCtx,
  userId: string,
  message: any,
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
          annotations: {
            title: tool.title,
            readOnlyHint: tool.readOnly,
            destructiveHint: !tool.readOnly,
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
      try {
        const result = await tool.run(ctx, userId, args as Record<string, any>)
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: false,
        })
      } catch (error) {
        // Tool failures are RESULTS with isError, not protocol errors — that's
        // what lets the model read the message and correct itself.
        const detail =
          error instanceof Error ? error.message : "Something went wrong."
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
      "Missing or invalid credentials. Send `Authorization: Bearer <your Sessionboard API key>` (create one in Settings → API & MCP), or connect via OAuth.",
    )
  }

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
      const response = await handleRpc(ctx, userId, message)
      if (response) responses.push(response)
    }
    if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS })
    return json(responses)
  }

  const response = await handleRpc(ctx, userId, payload)
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
        "This is the Sessionboard MCP endpoint. It speaks JSON-RPC 2.0 over HTTP POST (MCP Streamable HTTP); it does not offer a server-initiated SSE stream, so GET is not supported.",
      connect: {
        endpoint: `${siteBase()}/mcp`,
        transport: "http",
        auth: "Authorization: Bearer <API key from Settings → API & MCP>, or OAuth (add by URL in Claude/ChatGPT connectors).",
        claudeCode: `claude mcp add sessionboard --transport http ${siteBase()}/mcp --header "Authorization: Bearer sb_live_..."`,
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

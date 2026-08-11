import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, internalQuery } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { emitWebhook, generateWebhookSecret, maskSecret } from "./webhooks"
import { membershipFor } from "./lib/auth"
import { recordWorkspace } from "./lib/audit"
import { computeConflicts } from "./agenda"

// ————————————————————————————————————————————————————————————————————————
// Public REST API — data layer (convex/apiHttp.ts is the routing/serialization
// half). Mapped endpoint-for-endpoint against Sessionboard's public API; the
// full matrix with verdicts lives in docs/reference/api-parity.md.
//
// Two rules govern everything here:
//   1. NEVER degrade. Every field the old `/v1/event/{slug}/…` feeds returned
//      is still returned, with the same name and the same type. Parity fields
//      are ADDED alongside (so `startTime` in epoch ms AND `starts_at` in ISO).
//   2. Authorization is the product's, not the API's. A credential resolves to
//      a user id; the same membershipFor() that guards the browser app guards
//      the API. The one exception is the legacy read-only demo token, which
//      predates this file and stays read-only forever.
//
// Their "custom fields" are our CFP form questions: a form's `questions[]` are
// the field DEFINITIONS and a submission's `answers{}` are the VALUES. That
// mapping is what makes `GET /fields`, `PUT /sessions/{id}/fields` and
// `custom_fields[]` on every session real rather than stubbed.
// ————————————————————————————————————————————————————————————————————————

const MAX_ROWS = 4000
const MAX_BULK_OPERATIONS = 100

// ——— Resolution helpers ————————————————————————————————————————————————

/** Events are addressable by slug (public, stable) or by raw Convex id. */
export async function resolveEvent(
  ctx: QueryCtx,
  ref: string,
): Promise<Doc<"events"> | null> {
  const trimmed = ref.trim()
  if (!trimmed) return null
  const asId = ctx.db.normalizeId("events", trimmed)
  if (asId) return await ctx.db.get(asId)
  return await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", trimmed))
    .unique()
}

/**
 * The API's authorization gate. `userId === null` is the legacy demo token:
 * read-only, and only ever reached from a GET path.
 */
async function authorizeEvent(
  ctx: QueryCtx,
  event: Doc<"events">,
  userId: string | null,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<void> {
  if (userId === null) return
  if (!event.organizationId) throw new Error("Event not found.")
  await membershipFor(ctx, userId, event.organizationId, minRole)
}

function iso(ms: number | undefined | null): string | null {
  return ms === undefined || ms === null ? null : new Date(ms).toISOString()
}

function updatedAtMs(doc: { _creationTime: number; updatedAt?: number }): number {
  return doc.updatedAt ?? doc._creationTime
}

function personName(person: Doc<"people">): string {
  return `${person.firstName} ${person.lastName}`.trim() || "Speaker"
}

/**
 * Human-facing short id, mirroring their `friendly_id` / `friendly_id_raw`.
 * Convex ids are opaque strings, so the raw form is a stable numeric hash of
 * the id rather than a sequence — same contract (stable, sortable, short),
 * different derivation.
 */
function friendlyId(prefix: string, id: string): { id: string; raw: number } {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const raw = hash % 100000
  return { id: `${prefix}-${raw}`, raw }
}

// ——— Custom fields: form questions ⇄ submission answers ————————————————

type FieldDef = {
  id: string
  internal_name: string
  public_name: string
  field_type: string
  field_source: "standard" | "custom"
  contains_pii: boolean
  scope: "session" | "contact"
  required: boolean
  enabled: boolean
  options: Array<string> | null
  help: string | null
  form_id: Id<"forms">
  form_slug: string
  createdAt: string | null
  updatedAt: string | null
}

/**
 * The event's field DEFINITIONS, assembled from every form's questions plus
 * the participant fields. Questions with the same id across forms collapse
 * into one definition (they are the same field to an integrator), with the
 * first form that declares it winning the label.
 */
async function fieldDefinitions(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<Array<FieldDef>> {
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)

  const byId = new Map<string, FieldDef>()
  // Locked system questions are "standard" fields in their vocabulary;
  // everything an organizer added is "custom".
  for (const form of forms) {
    for (const question of form.questions) {
      if (byId.has(question.id)) continue
      byId.set(question.id, {
        id: question.id,
        internal_name: question.id,
        public_name: question.label,
        field_type: question.type,
        field_source: question.locked ? "standard" : "custom",
        contains_pii: false,
        scope: "session",
        required: question.required,
        enabled: question.enabled,
        options: question.options ?? null,
        help: question.help ?? null,
        form_id: form._id,
        form_slug: form.slug,
        createdAt: iso(form._creationTime),
        updatedAt: iso(form._creationTime),
      })
    }
    for (const field of form.participantConfig.fields) {
      const key = `participant.${field.id}`
      if (byId.has(key)) continue
      byId.set(key, {
        id: key,
        internal_name: key,
        public_name: field.label,
        field_type: field.id === "headshot" ? "file" : "short_text",
        field_source: field.locked ? "standard" : "custom",
        // First/last name, email, phone on a person: PII by definition.
        contains_pii: ["firstName", "lastName", "email", "phone"].includes(
          field.id,
        ),
        scope: "contact",
        required: field.required,
        enabled: field.enabled,
        options: null,
        help: field.help ?? null,
        form_id: form._id,
        form_slug: form.slug,
        createdAt: iso(form._creationTime),
        updatedAt: iso(form._creationTime),
      })
    }
  }
  return [...byId.values()]
}

/**
 * A submission's answers rendered as their `CustomFieldValue[]`: the label an
 * organizer sees, the machine name an integrator keys on, and the value.
 * Answers with no matching definition still appear (never silently drop data).
 */
function customFieldValues(
  submission: Doc<"submissions">,
  defs: Array<FieldDef>,
): Array<Record<string, unknown>> {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const out: Array<Record<string, unknown>> = []
  for (const [questionId, raw] of Object.entries(submission.answers)) {
    const def = byId.get(questionId)
    out.push({
      id: questionId,
      internal_name: questionId,
      name: def?.public_name ?? questionId,
      type: def?.field_type ?? "short_text",
      // Their `value` is a string; arrays (multi-select) join with ", ".
      // `value_raw` keeps the untouched JSON so nothing is lossy.
      value: Array.isArray(raw)
        ? raw.map((x) => String(x)).join(", ")
        : raw === null || raw === undefined
          ? ""
          : String(raw),
      value_raw: raw,
      created_at: iso(submission._creationTime),
    })
  }
  return out
}

// ——— Resource shapes ——————————————————————————————————————————————————

async function speakerShape(
  ctx: QueryCtx,
  person: Doc<"people">,
  role?: string,
): Promise<Record<string, unknown>> {
  const friendly = friendlyId("SPK", person._id)
  return {
    id: person._id,
    friendly_id: friendly.id,
    friendly_id_raw: friendly.raw,
    full_name: personName(person),
    first_name: person.firstName,
    last_name: person.lastName,
    email: person.email,
    title: person.jobTitle ?? null,
    company_name: person.company ?? null,
    about: person.bio ?? null,
    phone_mobile: person.phone ?? null,
    pronouns: person.pronouns ?? null,
    salutation: person.salutation ?? null,
    photo_url: person.headshotId
      ? await ctx.storage.getUrl(person.headshotId)
      : null,
    website_url: person.links?.website ?? null,
    linkedin_url: person.links?.linkedin ?? null,
    twitter_url: person.links?.twitter ?? null,
    workflow_status: person.workflowStatus ?? null,
    // The per-participant eye toggle (sbek CNT-12). Absent ⇒ visible, exactly
    // like convex/publicData.ts. Reported truthfully on this organizer surface
    // so an integration can honour an embargo instead of announcing it.
    is_public: person.publicVisible !== false,
    created_at: iso(person._creationTime),
    updated_at: iso(updatedAtMs(person)),
    participant_role: role
      ? { slug: role, name: roleLabel(role), name_plural: `${roleLabel(role)}s`, core_role: role }
      : null,
    // Legacy names the pre-parity feed used — kept so nothing breaks.
    name: personName(person),
    firstName: person.firstName,
    lastName: person.lastName,
    jobTitle: person.jobTitle ?? null,
    company: person.company ?? null,
    bio: person.bio ?? null,
    headshotUrl: person.headshotId
      ? await ctx.storage.getUrl(person.headshotId)
      : null,
  }
}

function roleLabel(role: string): string {
  if (role === "chairperson") return "Chairperson"
  if (role === "moderator") return "Moderator"
  return "Speaker"
}

type SessionShapeOptions = {
  defs: Array<FieldDef>
  rooms: Map<Id<"rooms">, Doc<"rooms">>
  tracks: Map<Id<"tracks">, Doc<"tracks">>
  /** `expand` values from the request, e.g. ["files"]. */
  expand: Set<string>
  /**
   * Drop participants the organizer has hidden, the way convex/publicData.ts
   * does. Set only on the public-programme reads — an organizer listing every
   * session still sees every speaker, each carrying its own `is_public`.
   */
  publicSpeakersOnly?: boolean
}

/**
 * The full `Session` resource. Union of Sessionboard's shape and every field
 * our older feeds already returned, so it is a strict superset of both.
 */
async function sessionShape(
  ctx: QueryCtx,
  submission: Doc<"submissions">,
  opts: SessionShapeOptions,
): Promise<Record<string, unknown>> {
  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
    .take(64)
  participants.sort((a, b) => a.order - b.order)

  const speakers: Array<Record<string, unknown>> = []
  const chairpersons: Array<Record<string, unknown>> = []
  const moderators: Array<Record<string, unknown>> = []
  const all: Array<Record<string, unknown>> = []
  for (const participant of participants) {
    const person = await ctx.db.get(participant.personId)
    if (!person) continue
    if (opts.publicSpeakersOnly && person.publicVisible === false) continue
    const shaped = await speakerShape(ctx, person, participant.role)
    all.push(shaped)
    if (participant.role === "chairperson") chairpersons.push(shaped)
    else if (participant.role === "moderator") moderators.push(shaped)
    else speakers.push(shaped)
  }

  const room = submission.roomId ? (opts.rooms.get(submission.roomId) ?? null) : null
  const track = submission.trackId
    ? (opts.tracks.get(submission.trackId) ?? null)
    : null
  const endsAtMs =
    submission.startsAt !== undefined && submission.durationMinutes !== undefined
      ? submission.startsAt + submission.durationMinutes * 60_000
      : undefined

  const submitter = await ctx.db.get(submission.submitterId)
  const friendly = friendlyId("SESS", submission._id)

  const shape: Record<string, unknown> = {
    id: submission._id,
    friendly_id: friendly.id,
    friendly_id_raw: friendly.raw,
    title: submission.title,
    description: submission.description ?? null,
    status: submission.status,
    // Their composition/abstract discriminator maps exactly onto our `kind`.
    is_abstract: submission.kind === "abstract",
    kind: submission.kind,
    // Truthfully "does this session appear on the public programme": accepted
    // AND not hidden by the organizer's Display Session checkbox. Reporting it
    // as public while every web surface hides it (convex/publicData.ts) is how
    // an embargoed keynote leaks through the integration path.
    is_public:
      submission.status === "accepted" && submission.publicVisible !== false,
    // The checkbox on its own, so a client can tell "not announced yet" from
    // "not accepted" without guessing.
    public_visible: submission.publicVisible !== false,
    starts_at: iso(submission.startsAt),
    ends_at: iso(endsAtMs),
    duration_minutes: submission.durationMinutes ?? null,
    capacity: room?.capacity ?? null,
    created_at: iso(submission._creationTime),
    updated_at: iso(updatedAtMs(submission)),
    deleted_at: iso(submission.deletedAt),
    decided_at: iso(submission.decidedAt),
    notified_at: iso(submission.notifiedAt),
    custom_fields: customFieldValues(submission, opts.defs),
    // Ours-better: the untouched answer map, keyed by question id.
    answers: submission.answers,
    speakers,
    chairpersons,
    moderators,
    participants: all,
    submitter: submitter ? await speakerShape(ctx, submitter) : null,
    tags: submission.tags.map((name) => ({ id: name, name })),
    track: track
      ? {
          id: track._id,
          event_id: track.eventId,
          name: track.name,
          color: track.color,
          order: track.order,
          created_at: iso(track._creationTime),
          updated_at: iso(track._creationTime),
        }
      : null,
    room: room
      ? {
          id: room._id,
          name: room.name,
          order: room.order,
          capacity: room.capacity ?? null,
          created_at: iso(room._creationTime),
          updated_at: iso(room._creationTime),
        }
      : null,
    format: submission.format ? { id: submission.format, name: submission.format } : null,
    level: submission.level ? { id: submission.level, name: submission.level } : null,
    language: submission.language
      ? { id: submission.language, name: submission.language }
      : null,
    // We have no parent/child sessions; the key is present and empty so a
    // client written against their API can iterate it without a guard.
    subsessions: [],

    // ——— Legacy field names from the pre-parity feed (never remove) ———
    startTime: submission.startsAt ?? null,
    endTime: endsAtMs ?? null,
    durationMinutes: submission.durationMinutes ?? null,
    location: room?.name ?? null,
    trackColor: track?.color ?? null,
    submittedAt: submission._creationTime,
    decidedAt: submission.decidedAt ?? null,
  }

  if (opts.expand.has("files")) {
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(200)
    shape.files = await Promise.all(
      uploads.filter((u) => !u.deletedAt).map((u) => fileShape(ctx, u)),
    )
  }
  return shape
}

async function fileShape(
  ctx: QueryCtx,
  upload: Doc<"uploads">,
): Promise<Record<string, unknown>> {
  const assigned = upload.assignedPersonId
    ? await ctx.db.get(upload.assignedPersonId)
    : null
  return {
    id: upload._id,
    url: await ctx.storage.getUrl(upload.storageId),
    title: upload.title ?? upload.filename,
    filename: upload.filename,
    size: upload.size ?? null,
    mimetype: upload.contentType ?? null,
    version: upload.version,
    approval_status: upload.approvalStatus,
    review_note: upload.reviewNote ?? null,
    session_id: upload.submissionId ?? null,
    assigned_participant_id: upload.assignedPersonId ?? null,
    assigned_participant_email: assigned?.email ?? null,
    assigned_participant_name: assigned ? personName(assigned) : null,
    created_at: iso(upload._creationTime),
    updated_at: iso(upload._creationTime),
  }
}

async function eventShape(
  ctx: QueryCtx,
  event: Doc<"events">,
): Promise<Record<string, unknown>> {
  return {
    id: event._id,
    name: event.name,
    slug: event.slug,
    type: event.type ?? null,
    description: event.description ?? null,
    venue: event.venue ?? null,
    website_url: event.websiteUrl ?? null,
    timezone: event.timezone,
    starts_at: iso(event.startsAt),
    ends_at: iso(event.endsAt),
    logo_url: event.logoId ? await ctx.storage.getUrl(event.logoId) : null,
    agenda_published_at: iso(event.agendaPublishedAt),
    created_at: iso(event._creationTime),
    features: { translated_fields: false, custom_fields: true, webhooks: true },
    // Legacy names.
    _id: event._id,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    websiteUrl: event.websiteUrl,
  }
}

// ——— Paging ———————————————————————————————————————————————————————————

/**
 * One envelope that satisfies both of their conventions at once: search
 * endpoints read `results`, the CRUD proxy reads `data`, and `pagination`
 * carries camelCase (what our feeds have always returned) *and* snake_case
 * (what their CRUD proxy returns). Nothing has to choose.
 */
function paginate<T>(items: Array<T>, page: number, pageSize: number) {
  const totalResults = items.length
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages)
  const start = (currentPage - 1) * pageSize
  const slice = items.slice(start, start + pageSize)
  return {
    data: slice,
    results: slice,
    pagination: {
      currentPage,
      pageSize,
      totalPages,
      totalResults,
      current_page: currentPage,
      page_size: pageSize,
      total_pages: totalPages,
      total_results: totalResults,
    },
  }
}

const pagingArgs = {
  page: v.number(),
  pageSize: v.number(),
}

// ——— Shared loaders ———————————————————————————————————————————————————

async function loadMaps(ctx: QueryCtx, eventId: Id<"events">) {
  const roomRows = await ctx.db
    .query("rooms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
  const trackRows = await ctx.db
    .query("tracks")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
  return {
    roomRows,
    trackRows,
    rooms: new Map(roomRows.map((r) => [r._id, r])),
    tracks: new Map(trackRows.map((t) => [t._id, t])),
  }
}

type SessionFilters = {
  status?: string
  isAbstract?: boolean
  trackId?: string
  tagId?: string
  search?: string
  createdBefore?: number
  createdAfter?: number
  updatedBefore?: number
  updatedAfter?: number
  includeDeleted?: boolean
  /**
   * `true` ⇒ only rows the public may see (the organizer's Display Session
   * checkbox is on); `false` ⇒ only the hidden ones, which is how an organizer
   * audits what is currently embargoed. Undefined ⇒ everything, flagged.
   */
  publicOnly?: boolean
}

function matchesFilters(
  submission: Doc<"submissions">,
  filters: SessionFilters,
): boolean {
  if (!filters.includeDeleted && submission.deletedAt !== undefined) return false
  if (
    filters.publicOnly !== undefined &&
    (submission.publicVisible !== false) !== filters.publicOnly
  )
    return false
  if (filters.status && submission.status !== filters.status) return false
  if (
    filters.isAbstract !== undefined &&
    (submission.kind === "abstract") !== filters.isAbstract
  )
    return false
  if (filters.trackId && submission.trackId !== filters.trackId) return false
  if (filters.tagId && !submission.tags.includes(filters.tagId)) return false
  if (filters.search) {
    const needle = filters.search.toLowerCase()
    const hay = `${submission.title} ${submission.description ?? ""}`.toLowerCase()
    if (!hay.includes(needle)) return false
  }
  if (filters.createdBefore && submission._creationTime >= filters.createdBefore)
    return false
  if (filters.createdAfter && submission._creationTime <= filters.createdAfter)
    return false
  const updated = updatedAtMs(submission)
  if (filters.updatedBefore && updated >= filters.updatedBefore) return false
  if (filters.updatedAfter && updated <= filters.updatedAfter) return false
  return true
}

const filtersValidator = v.object({
  status: v.optional(v.string()),
  isAbstract: v.optional(v.boolean()),
  trackId: v.optional(v.string()),
  tagId: v.optional(v.string()),
  search: v.optional(v.string()),
  createdBefore: v.optional(v.number()),
  createdAfter: v.optional(v.number()),
  updatedBefore: v.optional(v.number()),
  updatedAfter: v.optional(v.number()),
  includeDeleted: v.optional(v.boolean()),
  publicOnly: v.optional(v.boolean()),
})

// ══════════════════════════════════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════════════════════════════════

export const listEvents = internalQuery({
  args: { userId: v.union(v.string(), v.null()), ...pagingArgs },
  returns: v.any(),
  handler: async (ctx, args) => {
    let events: Array<Doc<"events">>
    if (args.userId === null) {
      // Legacy demo token: every event, read-only. Unchanged behaviour.
      events = await ctx.db.query("events").take(MAX_ROWS)
    } else {
      const memberships = await ctx.db
        .query("members")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId as string))
        .collect()
      events = []
      for (const membership of memberships) {
        const rows = await ctx.db
          .query("events")
          .withIndex("by_organizationId", (q) =>
            q.eq("organizationId", membership.organizationId),
          )
          .take(MAX_ROWS)
        events.push(...rows)
      }
    }
    events.sort((a, b) => (b.startsAt ?? 0) - (a.startsAt ?? 0))
    const shaped = []
    for (const event of events) shaped.push(await eventShape(ctx, event))
    return paginate(shaped, args.page, args.pageSize)
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Sessions — read
// ══════════════════════════════════════════════════════════════════════════

export const searchSessions = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    filters: filtersValidator,
    sortBy: v.optional(v.string()), // createdAt | updatedAt | startsAt | title
    sortDir: v.optional(v.string()), // asc | desc
    expand: v.array(v.string()),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)

    const rows = args.filters.status
      ? await ctx.db
          .query("submissions")
          .withIndex("by_eventId_and_status", (q) =>
            q.eq("eventId", event._id).eq("status", args.filters.status as string),
          )
          .take(MAX_ROWS)
      : await ctx.db
          .query("submissions")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)

    const filtered = rows.filter((row) => matchesFilters(row, args.filters))
    const dir = args.sortDir === "asc" ? 1 : -1
    const key = args.sortBy ?? "createdAt"
    filtered.sort((a, b) => {
      if (key === "title") return a.title.localeCompare(b.title) * dir
      if (key === "startsAt")
        return ((a.startsAt ?? 0) - (b.startsAt ?? 0)) * dir
      if (key === "updatedAt") return (updatedAtMs(a) - updatedAtMs(b)) * dir
      return (a._creationTime - b._creationTime) * dir
    })

    const maps = await loadMaps(ctx, event._id)
    const defs = await fieldDefinitions(ctx, event._id)
    const expand = new Set(args.expand)
    // Shape only the page being returned — the joins are the expensive part.
    const page = paginate(filtered, args.page, args.pageSize)
    const shaped = []
    for (const row of page.data) {
      shaped.push(
        await sessionShape(ctx, row, {
          defs,
          rooms: maps.rooms,
          tracks: maps.tracks,
          expand,
          // Asking for the public programme means asking for it as the public
          // sees it — hidden speakers drop out of the line-up too.
          publicSpeakersOnly: args.filters.publicOnly === true,
        }),
      )
    }
    return {
      event: await eventShape(ctx, event),
      data: shaped,
      results: shaped,
      pagination: page.pagination,
    }
  },
})

export const getSession = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    sessionId: v.string(),
    expand: v.array(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    if (!id) return { notFound: true }
    const submission = await ctx.db.get(id)
    if (!submission || submission.eventId !== event._id) return { notFound: true }
    // A soft-deleted session reads as gone unless the caller opts in, the same
    // way it disappears from search — `expand=deleted` is the undo affordance.
    if (submission.deletedAt !== undefined && !args.expand.includes("deleted"))
      return { notFound: true }
    const maps = await loadMaps(ctx, event._id)
    const defs = await fieldDefinitions(ctx, event._id)
    return {
      data: await sessionShape(ctx, submission, {
        defs,
        rooms: maps.rooms,
        tracks: maps.tracks,
        expand: new Set(args.expand),
      }),
    }
  },
})

/** Their lightweight `POST /sessions/status` — ids + status, nothing joined. */
export const sessionStatuses = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    filters: filtersValidator,
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    const items = rows
      .filter((row) => matchesFilters(row, { ...args.filters, includeDeleted: true }))
      .map((row) => {
        const friendly = friendlyId("SESS", row._id)
        return {
          id: row._id,
          friendly_id: friendly.id,
          friendly_id_raw: friendly.raw,
          status: row.status,
          is_abstract: row.kind === "abstract",
          deleted_at: iso(row.deletedAt),
          created_at: iso(row._creationTime),
          updated_at: iso(updatedAtMs(row)),
          subsessions: [],
        }
      })
    return paginate(items, args.page, args.pageSize)
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Sessions — write
// ══════════════════════════════════════════════════════════════════════════

type SessionWriteInput = {
  title?: string
  description?: string
  status?: string
  is_public?: boolean
  is_abstract?: boolean
  starts_at?: number
  ends_at?: number
  duration_minutes?: number
  room_id?: string
  track_id?: string
  format?: string
  level?: string
  language?: string
  tags?: Array<string>
  custom_fields?: Record<string, unknown>
  submitter_email?: string
  submitter_first_name?: string
  submitter_last_name?: string
  speaker_ids?: Array<string>
}

const VALID_STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
]

const writeInputValidator = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  status: v.optional(v.string()),
  is_public: v.optional(v.boolean()),
  is_abstract: v.optional(v.boolean()),
  starts_at: v.optional(v.number()),
  ends_at: v.optional(v.number()),
  duration_minutes: v.optional(v.number()),
  room_id: v.optional(v.string()),
  track_id: v.optional(v.string()),
  format: v.optional(v.string()),
  level: v.optional(v.string()),
  language: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  custom_fields: v.optional(v.any()),
  submitter_email: v.optional(v.string()),
  submitter_first_name: v.optional(v.string()),
  submitter_last_name: v.optional(v.string()),
  speaker_ids: v.optional(v.array(v.string())),
})

/** Shared by create, update and every bulk operation. */
async function applySessionWrite(
  ctx: MutationCtx,
  event: Doc<"events">,
  input: SessionWriteInput,
  existing: Doc<"submissions"> | null,
): Promise<Id<"submissions">> {
  const patch: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) throw new Error("`title` cannot be empty.")
    patch.title = title
  }
  if (input.description !== undefined) patch.description = input.description
  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status))
      throw new Error(
        `Unknown status "${input.status}". Valid: ${VALID_STATUSES.join(", ")}.`,
      )
    patch.status = input.status
  }
  // Sessionboard's "Display Session" checkbox. Writable so an integration can
  // stage an embargoed keynote and lift the embargo on announcement day.
  if (input.is_public !== undefined) patch.publicVisible = input.is_public
  if (input.is_abstract !== undefined && !existing)
    patch.kind = input.is_abstract ? "abstract" : "session"
  if (input.starts_at !== undefined) patch.startsAt = input.starts_at
  if (input.duration_minutes !== undefined)
    patch.durationMinutes = input.duration_minutes
  else if (input.ends_at !== undefined && input.starts_at !== undefined)
    patch.durationMinutes = Math.max(
      5,
      Math.round((input.ends_at - input.starts_at) / 60_000),
    )
  if (input.format !== undefined) patch.format = input.format
  if (input.level !== undefined) patch.level = input.level
  if (input.language !== undefined) patch.language = input.language
  if (input.tags !== undefined) patch.tags = input.tags

  if (input.room_id !== undefined) {
    if (input.room_id === "") patch.roomId = undefined
    else {
      const roomId = ctx.db.normalizeId("rooms", input.room_id)
      const room = roomId ? await ctx.db.get(roomId) : null
      if (!room || room.eventId !== event._id)
        throw new Error(`No room "${input.room_id}" in this event.`)
      patch.roomId = roomId
    }
  }
  if (input.track_id !== undefined) {
    if (input.track_id === "") patch.trackId = undefined
    else {
      const trackId = ctx.db.normalizeId("tracks", input.track_id)
      const track = trackId ? await ctx.db.get(trackId) : null
      if (!track || track.eventId !== event._id)
        throw new Error(`No track "${input.track_id}" in this event.`)
      patch.trackId = trackId
    }
  }

  if (input.custom_fields && typeof input.custom_fields === "object") {
    const base = existing?.answers ?? {}
    patch.answers = { ...base, ...input.custom_fields }
  }

  patch.updatedAt = Date.now()

  if (existing) {
    await ctx.db.patch(existing._id, patch)
    return existing._id
  }

  // Create needs a submitter; the API can name one, otherwise a synthetic
  // "API" person keeps the invariant (every submission has a submitter).
  const email = (input.submitter_email ?? "api@trackstage.local").toLowerCase()
  let submitter = await ctx.db
    .query("people")
    .withIndex("by_eventId_and_email", (q) =>
      q.eq("eventId", event._id).eq("email", email),
    )
    .unique()
  if (!submitter) {
    const submitterId = await ctx.db.insert("people", {
      eventId: event._id,
      email,
      firstName: input.submitter_first_name ?? "API",
      lastName: input.submitter_last_name ?? "Import",
      portalToken: crypto.randomUUID().replace(/-/g, ""),
    })
    submitter = await ctx.db.get(submitterId)
  }
  if (!submitter) throw new Error("Could not resolve a submitter.")

  const id = await ctx.db.insert("submissions", {
    eventId: event._id,
    kind: (patch.kind as string | undefined) ?? "session",
    title: (patch.title as string | undefined) ?? "Untitled session",
    description: patch.description as string | undefined,
    answers: (patch.answers as Record<string, unknown> | undefined) ?? {},
    trackId: patch.trackId as Id<"tracks"> | undefined,
    format: patch.format as string | undefined,
    level: patch.level as string | undefined,
    language: patch.language as string | undefined,
    tags: (patch.tags as Array<string> | undefined) ?? [],
    status: (patch.status as string | undefined) ?? "pending",
    publicVisible: patch.publicVisible as boolean | undefined,
    submitterId: submitter._id,
    roomId: patch.roomId as Id<"rooms"> | undefined,
    startsAt: patch.startsAt as number | undefined,
    durationMinutes: patch.durationMinutes as number | undefined,
    updatedAt: Date.now(),
  })

  // Attach the submitter as the first speaker so the session is never
  // speakerless (the agenda and every public surface assume at least one).
  await ctx.db.insert("submissionParticipants", {
    submissionId: id,
    eventId: event._id,
    personId: submitter._id,
    role: "speaker",
    order: 0,
  })

  if (input.speaker_ids) {
    let order = 1
    for (const raw of input.speaker_ids) {
      const personId = ctx.db.normalizeId("people", raw)
      const person = personId ? await ctx.db.get(personId) : null
      if (!person || person.eventId !== event._id || person._id === submitter._id)
        continue
      await ctx.db.insert("submissionParticipants", {
        submissionId: id,
        eventId: event._id,
        personId: person._id,
        role: "speaker",
        order: order++,
      })
    }
  }
  return id
}

export const createSession = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    input: writeInputValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    if (!args.input.title || !args.input.title.trim())
      throw new Error("`title` is required.")
    const id = await applySessionWrite(ctx, event, args.input, null)
    const submission = await ctx.db.get(id)
    if (!submission) throw new Error("Create failed.")
    const maps = await loadMaps(ctx, event._id)
    const defs = await fieldDefinitions(ctx, event._id)
    const shaped = await sessionShape(ctx, submission, {
      defs,
      rooms: maps.rooms,
      tracks: maps.tracks,
      expand: new Set(),
    })
    await emitWebhook(
      ctx,
      event._id,
      submission.kind === "abstract" ? "submission.created" : "session.created",
      shaped,
    )
    return { data: shaped }
  },
})

export const updateSession = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    input: writeInputValidator,
    /** Optimistic concurrency token, epoch ms. */
    expectedUpdatedAt: v.optional(v.number()),
    /** `PUT …/fields` only touches answers. */
    fieldsOnly: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    const submission = id ? await ctx.db.get(id) : null
    if (!submission || submission.eventId !== event._id) return { notFound: true }
    if (submission.deletedAt !== undefined) return { notFound: true }

    if (
      args.expectedUpdatedAt !== undefined &&
      Math.abs(updatedAtMs(submission) - args.expectedUpdatedAt) > 1
    ) {
      return { conflict: true, updated_at: iso(updatedAtMs(submission)) }
    }

    const input = args.fieldsOnly
      ? { custom_fields: args.input.custom_fields }
      : args.input
    await applySessionWrite(ctx, event, input, submission)

    const fresh = await ctx.db.get(submission._id)
    if (!fresh) throw new Error("Update failed.")
    const maps = await loadMaps(ctx, event._id)
    const defs = await fieldDefinitions(ctx, event._id)
    const shaped = await sessionShape(ctx, fresh, {
      defs,
      rooms: maps.rooms,
      tracks: maps.tracks,
      expand: new Set(),
    })
    await emitWebhook(
      ctx,
      event._id,
      fresh.kind === "abstract" ? "submission.updated" : "session.updated",
      shaped,
    )
    if (
      args.input.starts_at !== undefined ||
      args.input.room_id !== undefined
    ) {
      await emitWebhook(ctx, event._id, "session.scheduled", shaped)
    }
    return { data: shaped }
  },
})

export const deleteSession = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    restore: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId, "admin")
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    const submission = id ? await ctx.db.get(id) : null
    if (!submission || submission.eventId !== event._id) return { notFound: true }

    await ctx.db.patch(submission._id, {
      deletedAt: args.restore ? undefined : Date.now(),
      updatedAt: Date.now(),
    })
    const fresh = await ctx.db.get(submission._id)
    if (!fresh) throw new Error("Delete failed.")
    const maps = await loadMaps(ctx, event._id)
    const defs = await fieldDefinitions(ctx, event._id)
    const shaped = await sessionShape(ctx, fresh, {
      defs,
      rooms: maps.rooms,
      tracks: maps.tracks,
      expand: new Set(),
    })
    await emitWebhook(
      ctx,
      event._id,
      args.restore ? "session.restored" : "session.deleted",
      shaped,
    )
    return { data: shaped }
  },
})

export const bulkSessions = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    operations: v.array(
      v.object({
        action: v.string(), // create | update | delete
        id: v.optional(v.string()),
        data: v.optional(writeInputValidator),
      }),
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    if (args.operations.length > MAX_BULK_OPERATIONS)
      throw new Error(`At most ${MAX_BULK_OPERATIONS} operations per request.`)

    const results: Array<Record<string, unknown>> = []
    let succeeded = 0
    let failed = 0
    for (let index = 0; index < args.operations.length; index++) {
      const op = args.operations[index]
      try {
        if (op.action === "create") {
          if (!op.data?.title) throw new Error("`data.title` is required.")
          const id = await applySessionWrite(ctx, event, op.data, null)
          results.push({ index, action: "create", status: "success", id })
          succeeded++
        } else if (op.action === "update") {
          if (!op.id) throw new Error("`id` is required for update.")
          const id = ctx.db.normalizeId("submissions", op.id)
          const existing = id ? await ctx.db.get(id) : null
          if (!existing || existing.eventId !== event._id)
            throw new Error("Session not found.")
          await applySessionWrite(ctx, event, op.data ?? {}, existing)
          results.push({ index, action: "update", status: "success", id: existing._id })
          succeeded++
        } else if (op.action === "delete") {
          if (!op.id) throw new Error("`id` is required for delete.")
          const id = ctx.db.normalizeId("submissions", op.id)
          const existing = id ? await ctx.db.get(id) : null
          if (!existing || existing.eventId !== event._id)
            throw new Error("Session not found.")
          await ctx.db.patch(existing._id, {
            deletedAt: Date.now(),
            updatedAt: Date.now(),
          })
          results.push({ index, action: "delete", status: "success", id: existing._id })
          succeeded++
        } else {
          throw new Error(
            `Unknown action "${op.action}". Valid: create, update, delete.`,
          )
        }
      } catch (e) {
        results.push({
          index,
          action: op.action,
          status: "error",
          error: {
            code: "operation_failed",
            message: e instanceof Error ? e.message : String(e),
          },
        })
        failed++
      }
    }
    return {
      batch_id: crypto.randomUUID(),
      results,
      stats: { total: args.operations.length, succeeded, failed },
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Speakers
// ══════════════════════════════════════════════════════════════════════════

export const searchSpeakers = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    search: v.optional(v.string()),
    workflowStatus: v.optional(v.string()),
    /** `?public=true|false` — see SessionFilters.publicOnly. */
    publicOnly: v.optional(v.boolean()),
    sortDir: v.optional(v.string()),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const people = await ctx.db
      .query("people")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)

    const needle = args.search?.toLowerCase()
    const filtered = people.filter((person) => {
      if (
        args.publicOnly !== undefined &&
        (person.publicVisible !== false) !== args.publicOnly
      )
        return false
      if (args.workflowStatus && person.workflowStatus !== args.workflowStatus)
        return false
      if (!needle) return true
      return `${person.firstName} ${person.lastName} ${person.email} ${person.company ?? ""}`
        .toLowerCase()
        .includes(needle)
    })
    filtered.sort(
      (a, b) =>
        (a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName)) *
        (args.sortDir === "desc" ? -1 : 1),
    )

    const page = paginate(filtered, args.page, args.pageSize)
    const shaped = []
    for (const person of page.data) {
      const sessions = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_personId", (q) => q.eq("personId", person._id))
        .take(64)
      const titles = []
      for (const link of sessions) {
        const submission = await ctx.db.get(link.submissionId)
        if (!submission || submission.deletedAt !== undefined) continue
        titles.push({
          id: submission._id,
          title: submission.title,
          status: submission.status,
          role: link.role,
          starts_at: iso(submission.startsAt),
          startTime: submission.startsAt ?? null,
        })
      }
      shaped.push({ ...(await speakerShape(ctx, person)), sessions: titles })
    }
    return {
      event: await eventShape(ctx, event),
      data: shaped,
      results: shaped,
      pagination: page.pagination,
    }
  },
})

export const getSpeaker = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    personId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("people", args.personId)
    const person = id ? await ctx.db.get(id) : null
    if (!person || person.eventId !== event._id) return { notFound: true }
    const links = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .take(64)
    const maps = await loadMaps(ctx, event._id)
    const defs = await fieldDefinitions(ctx, event._id)
    const sessions = []
    for (const link of links) {
      const submission = await ctx.db.get(link.submissionId)
      if (!submission || submission.deletedAt !== undefined) continue
      sessions.push(
        await sessionShape(ctx, submission, {
          defs,
          rooms: maps.rooms,
          tracks: maps.tracks,
          expand: new Set(),
        }),
      )
    }
    return { data: { ...(await speakerShape(ctx, person)), sessions } }
  },
})

export const writeSpeaker = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    personId: v.optional(v.string()),
    input: v.object({
      email: v.optional(v.string()),
      first_name: v.optional(v.string()),
      last_name: v.optional(v.string()),
      title: v.optional(v.string()),
      company_name: v.optional(v.string()),
      about: v.optional(v.string()),
      phone_mobile: v.optional(v.string()),
      pronouns: v.optional(v.string()),
      salutation: v.optional(v.string()),
      website_url: v.optional(v.string()),
      linkedin_url: v.optional(v.string()),
      twitter_url: v.optional(v.string()),
      workflow_status: v.optional(v.string()),
      /** The per-participant eye toggle — `false` embargoes this speaker. */
      is_public: v.optional(v.boolean()),
    }),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const input = args.input

    const links: Record<string, string | undefined> = {}
    if (input.website_url !== undefined) links.website = input.website_url
    if (input.linkedin_url !== undefined) links.linkedin = input.linkedin_url
    if (input.twitter_url !== undefined) links.twitter = input.twitter_url

    if (args.personId) {
      const id = ctx.db.normalizeId("people", args.personId)
      const person = id ? await ctx.db.get(id) : null
      if (!person || person.eventId !== event._id) return { notFound: true }
      const patch: Record<string, unknown> = { updatedAt: Date.now() }
      if (input.first_name !== undefined) patch.firstName = input.first_name
      if (input.last_name !== undefined) patch.lastName = input.last_name
      if (input.title !== undefined) patch.jobTitle = input.title
      if (input.company_name !== undefined) patch.company = input.company_name
      if (input.about !== undefined) patch.bio = input.about
      if (input.phone_mobile !== undefined) patch.phone = input.phone_mobile
      if (input.pronouns !== undefined) patch.pronouns = input.pronouns
      if (input.salutation !== undefined) patch.salutation = input.salutation
      if (input.workflow_status !== undefined)
        patch.workflowStatus = input.workflow_status
      if (input.is_public !== undefined) patch.publicVisible = input.is_public
      if (Object.keys(links).length > 0)
        patch.links = { ...(person.links ?? {}), ...links }
      await ctx.db.patch(person._id, patch)
      const fresh = await ctx.db.get(person._id)
      const shaped = await speakerShape(ctx, fresh as Doc<"people">)
      await emitWebhook(ctx, event._id, "speaker.updated", shaped)
      return { data: shaped }
    }

    const email = (input.email ?? "").trim().toLowerCase()
    if (!email) throw new Error("`email` is required to create a speaker.")
    const existing = await ctx.db
      .query("people")
      .withIndex("by_eventId_and_email", (q) =>
        q.eq("eventId", event._id).eq("email", email),
      )
      .unique()
    if (existing) {
      // Idempotent create — the same behaviour the organizer UI has.
      await ctx.db.patch(existing._id, {
        workflowStatus: input.workflow_status ?? existing.workflowStatus ?? "invited",
        updatedAt: Date.now(),
      })
      const fresh = await ctx.db.get(existing._id)
      return { data: await speakerShape(ctx, fresh as Doc<"people">) }
    }
    const personId = await ctx.db.insert("people", {
      eventId: event._id,
      email,
      firstName: input.first_name ?? "",
      lastName: input.last_name ?? "",
      jobTitle: input.title,
      company: input.company_name,
      bio: input.about,
      phone: input.phone_mobile,
      pronouns: input.pronouns,
      salutation: input.salutation,
      links: Object.keys(links).length > 0 ? links : undefined,
      portalToken: crypto.randomUUID().replace(/-/g, ""),
      workflowStatus: input.workflow_status ?? "invited",
      publicVisible: input.is_public,
      updatedAt: Date.now(),
    })
    const person = await ctx.db.get(personId)
    const shaped = await speakerShape(ctx, person as Doc<"people">)
    await emitWebhook(ctx, event._id, "speaker.created", shaped)
    return { data: shaped }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Event settings — fields, tracks, rooms, tags, formats, levels, languages
// ══════════════════════════════════════════════════════════════════════════

/**
 * The four value-list "metadata" resources (tags, formats, levels, languages)
 * have no table of their own: they ARE the options on the corresponding CFP
 * form question. Reading them means reading those options plus whatever is in
 * use on a submission; writing them means editing the question. That is the
 * honest mapping — it keeps the form builder and the API as one source of
 * truth instead of two that drift.
 */
const VALUE_LIST_QUESTION: Record<string, string> = {
  tags: "tags",
  formats: "format",
  levels: "level",
  languages: "language",
}

async function valueList(
  ctx: QueryCtx,
  eventId: Id<"events">,
  resource: string,
): Promise<Array<Record<string, unknown>>> {
  const questionId = VALUE_LIST_QUESTION[resource]
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
  const values = new Set<string>()
  for (const form of forms) {
    const question = form.questions.find((q) => q.id === questionId)
    for (const option of question?.options ?? []) values.add(option)
  }
  // Also surface values in use that the form no longer offers, so an
  // integrator never sees a session referencing an unknown value.
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
  for (const submission of submissions) {
    if (submission.deletedAt !== undefined) continue
    if (resource === "tags") for (const tag of submission.tags) values.add(tag)
    if (resource === "formats" && submission.format) values.add(submission.format)
    if (resource === "levels" && submission.level) values.add(submission.level)
    if (resource === "languages" && submission.language)
      values.add(submission.language)
  }
  return [...values].sort((a, b) => a.localeCompare(b)).map((name, index) => ({
    id: name,
    name,
    order: index,
    created_at: null,
    updated_at: null,
  }))
}

export const listSettings = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    resource: v.string(),
    search: v.optional(v.string()),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)

    let items: Array<Record<string, unknown>>
    if (args.resource === "fields") {
      items = await fieldDefinitions(ctx, event._id)
    } else if (args.resource === "rooms") {
      const rows = await ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS)
      items = rows
        .sort((a, b) => a.order - b.order)
        .map((room) => ({
          id: room._id,
          name: room.name,
          order: room.order,
          capacity: room.capacity ?? null,
          created_at: iso(room._creationTime),
          updated_at: iso(room._creationTime),
        }))
    } else if (args.resource === "tracks") {
      const rows = await ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS)
      items = rows
        .sort((a, b) => a.order - b.order)
        .map((track) => ({
          id: track._id,
          event_id: track.eventId,
          name: track.name,
          color: track.color,
          order: track.order,
          created_at: iso(track._creationTime),
          updated_at: iso(track._creationTime),
        }))
    } else if (args.resource === "statuses") {
      // Our pipeline is a fixed system enum — see docs/reference/api-parity.md
      // for why custom statuses are deliberately not mirrored.
      items = VALID_STATUSES.map((name, index) => ({
        id: name,
        name,
        order: index,
        system: true,
        created_at: null,
        updated_at: null,
      }))
    } else if (VALUE_LIST_QUESTION[args.resource]) {
      items = await valueList(ctx, event._id, args.resource)
    } else {
      return { ...paginate([], args.page, args.pageSize), unknownResource: true }
    }

    if (args.search) {
      const needle = args.search.toLowerCase()
      items = items.filter((item) =>
        String(item.name ?? item.public_name ?? "")
          .toLowerCase()
          .includes(needle),
      )
    }
    return { ...paginate(items, args.page, args.pageSize), unknownResource: false }
  },
})

export const writeMetadata = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    resource: v.string(),
    action: v.string(), // create | update | delete
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    capacity: v.optional(v.number()),
    order: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)

    if (args.resource === "statuses") {
      throw new Error(
        "Session statuses are system-defined in Trackstage (draft → pending → accept_queue/decline_queue → accepted/declined, plus withdrawn) and cannot be created or renamed.",
      )
    }

    if (args.resource === "rooms") {
      if (args.action === "create") {
        const existing = await ctx.db
          .query("rooms")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)
        const name = (args.name ?? "").trim()
        if (!name) throw new Error("`name` is required.")
        const id = await ctx.db.insert("rooms", {
          eventId: event._id,
          name,
          capacity: args.capacity,
          order: args.order ?? existing.length,
        })
        const room = await ctx.db.get(id)
        return {
          data: {
            id,
            name: room?.name,
            order: room?.order,
            capacity: room?.capacity ?? null,
          },
        }
      }
      const id = args.id ? ctx.db.normalizeId("rooms", args.id) : null
      const room = id ? await ctx.db.get(id) : null
      if (!room || room.eventId !== event._id) return { notFound: true }
      if (args.action === "delete") {
        // Unschedule anything standing in it first, or the agenda would point
        // at a room that no longer exists.
        const scheduled = await ctx.db
          .query("submissions")
          .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
          .take(MAX_ROWS)
        for (const row of scheduled)
          await ctx.db.patch(row._id, { roomId: undefined, startsAt: undefined })
        await ctx.db.delete(room._id)
        return { deleted: true }
      }
      await ctx.db.patch(room._id, {
        name: args.name ?? room.name,
        capacity: args.capacity ?? room.capacity,
        order: args.order ?? room.order,
      })
      const fresh = await ctx.db.get(room._id)
      return {
        data: {
          id: fresh?._id,
          name: fresh?.name,
          order: fresh?.order,
          capacity: fresh?.capacity ?? null,
        },
      }
    }

    if (args.resource === "tracks") {
      if (args.action === "create") {
        const existing = await ctx.db
          .query("tracks")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)
        const name = (args.name ?? "").trim()
        if (!name) throw new Error("`name` is required.")
        const id = await ctx.db.insert("tracks", {
          eventId: event._id,
          name,
          color: args.color ?? "#2F5CE0",
          order: args.order ?? existing.length,
        })
        const track = await ctx.db.get(id)
        return {
          data: {
            id,
            name: track?.name,
            color: track?.color,
            order: track?.order,
          },
        }
      }
      const id = args.id ? ctx.db.normalizeId("tracks", args.id) : null
      const track = id ? await ctx.db.get(id) : null
      if (!track || track.eventId !== event._id) return { notFound: true }
      if (args.action === "delete") {
        const tagged = await ctx.db
          .query("submissions")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)
        for (const row of tagged)
          if (row.trackId === track._id)
            await ctx.db.patch(row._id, { trackId: undefined })
        await ctx.db.delete(track._id)
        return { deleted: true }
      }
      await ctx.db.patch(track._id, {
        name: args.name ?? track.name,
        color: args.color ?? track.color,
        order: args.order ?? track.order,
      })
      const fresh = await ctx.db.get(track._id)
      return {
        data: {
          id: fresh?._id,
          name: fresh?.name,
          color: fresh?.color,
          order: fresh?.order,
        },
      }
    }

    // Value lists: edit the option set on the owning form question.
    const questionId = VALUE_LIST_QUESTION[args.resource]
    if (!questionId) return { unknownResource: true }
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    const target = args.action === "create" ? (args.name ?? "").trim() : (args.id ?? "")
    if (!target) throw new Error("`name` is required.")
    let touched = 0
    for (const form of forms) {
      const index = form.questions.findIndex((q) => q.id === questionId)
      if (index === -1) continue
      const question = form.questions[index]
      const options = [...(question.options ?? [])]
      if (args.action === "create") {
        if (options.includes(target)) continue
        options.push(target)
      } else if (args.action === "delete") {
        const at = options.indexOf(target)
        if (at === -1) continue
        options.splice(at, 1)
      } else {
        const at = options.indexOf(target)
        const next = (args.name ?? "").trim()
        if (at === -1 || !next) continue
        options[at] = next
      }
      const questions = [...form.questions]
      questions[index] = { ...question, options }
      await ctx.db.patch(form._id, { questions })
      touched++
    }
    if (touched === 0 && args.action !== "create")
      return { notFound: true }
    const name = args.action === "delete" ? target : (args.name ?? target)
    return {
      data: args.action === "delete" ? undefined : { id: name, name },
      deleted: args.action === "delete",
      forms_updated: touched,
    }
  },
})

/**
 * Custom-field definitions ARE form questions, so creating one appends a
 * question to the event's form. This is the write side of `GET /fields`.
 */
export const writeField = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    action: v.string(), // create | update | delete
    fieldId: v.optional(v.string()),
    formId: v.optional(v.string()),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
    required: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
    help: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)

    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    if (forms.length === 0)
      throw new Error("This event has no form to hold custom fields yet.")

    const explicitForm = args.formId
      ? forms.find((f) => f._id === ctx.db.normalizeId("forms", args.formId ?? ""))
      : undefined

    if (args.action === "create") {
      const form = explicitForm ?? forms[0]
      const label = (args.label ?? "").trim()
      if (!label) throw new Error("`label` (or `name`) is required.")
      const slug =
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || `field_${Date.now()}`
      if (form.questions.some((q) => q.id === slug))
        throw new Error(`A field named "${label}" already exists.`)
      const question = {
        id: slug,
        label,
        type: args.type ?? "short_text",
        required: args.required ?? false,
        enabled: args.enabled ?? true,
        locked: false,
        help: args.help,
        options: args.options,
      }
      await ctx.db.patch(form._id, { questions: [...form.questions, question] })
      return {
        data: {
          id: slug,
          internal_name: slug,
          public_name: label,
          field_type: question.type,
          field_source: "custom",
          scope: "session",
          form_id: form._id,
        },
      }
    }

    const fieldId = args.fieldId ?? ""
    if (!fieldId) throw new Error("`fieldId` is required.")
    let touched = 0
    let shaped: Record<string, unknown> | null = null
    for (const form of forms) {
      const index = form.questions.findIndex((q) => q.id === fieldId)
      if (index === -1) continue
      const question = form.questions[index]
      if (question.locked)
        throw new Error(
          `"${question.label}" is a system field and cannot be ${args.action === "delete" ? "deleted" : "renamed"}.`,
        )
      const questions = [...form.questions]
      if (args.action === "delete") {
        questions.splice(index, 1)
      } else {
        questions[index] = {
          ...question,
          label: args.label ?? question.label,
          type: args.type ?? question.type,
          required: args.required ?? question.required,
          enabled: args.enabled ?? question.enabled,
          help: args.help ?? question.help,
          options: args.options ?? question.options,
        }
        shaped = {
          id: fieldId,
          internal_name: fieldId,
          public_name: questions[index].label,
          field_type: questions[index].type,
          field_source: "custom",
          scope: "session",
          form_id: form._id,
        }
      }
      await ctx.db.patch(form._id, { questions })
      touched++
    }
    if (touched === 0) return { notFound: true }
    return args.action === "delete"
      ? { deleted: true, forms_updated: touched }
      : { data: shaped, forms_updated: touched }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Session files
// ══════════════════════════════════════════════════════════════════════════

export const listSessionFiles = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    sessionId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    const submission = id ? await ctx.db.get(id) : null
    if (!submission || submission.eventId !== event._id) return { notFound: true }
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(500)
    const live = uploads.filter((u) => !u.deletedAt)
    // Latest version per (personId, taskId) group — their "latest version per
    // file group" rule.
    const latest = new Map<string, Doc<"uploads">>()
    for (const upload of live) {
      const key = `${upload.personId}:${upload.taskId ?? ""}:${upload.filename}`
      const seen = latest.get(key)
      if (!seen || upload.version > seen.version) latest.set(key, upload)
    }
    const data = []
    for (const upload of [...latest.values()].sort(
      (a, b) => b._creationTime - a._creationTime,
    ))
      data.push(await fileShape(ctx, upload))
    return { data }
  },
})

/** Materialises an `uploads` row from bytes already in Convex storage. */
export const attachSessionFile = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    title: v.optional(v.string()),
    assignedParticipantId: v.optional(v.string()),
    replacesUploadId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    const submission = id ? await ctx.db.get(id) : null
    if (!submission || submission.eventId !== event._id) return { notFound: true }

    // Owner: the assigned participant when given, else the submitter.
    let personId = submission.submitterId
    if (args.assignedParticipantId) {
      const candidate = ctx.db.normalizeId("people", args.assignedParticipantId)
      const person = candidate ? await ctx.db.get(candidate) : null
      if (!person || person.eventId !== event._id)
        throw new Error("`assigned_participant_id` is not a person on this event.")
      personId = person._id
    }

    const previous = args.replacesUploadId
      ? await ctx.db.get(
          ctx.db.normalizeId("uploads", args.replacesUploadId) as Id<"uploads">,
        )
      : null
    const version = previous ? previous.version + 1 : 1
    if (previous) await ctx.db.patch(previous._id, { deletedAt: Date.now() })

    const uploadId = await ctx.db.insert("uploads", {
      eventId: event._id,
      personId,
      submissionId: submission._id,
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      version,
      approvalStatus: "pending",
      title: args.title ?? args.filename,
      assignedPersonId: args.assignedParticipantId ? personId : undefined,
    })
    const upload = await ctx.db.get(uploadId)
    const shaped = await fileShape(ctx, upload as Doc<"uploads">)
    await emitWebhook(ctx, event._id, "file.uploaded", shaped)
    return { data: shaped }
  },
})

export const updateSessionFile = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    fileId: v.string(),
    action: v.string(), // update | delete
    title: v.optional(v.string()),
    assignedParticipantId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const uploadId = ctx.db.normalizeId("uploads", args.fileId)
    const upload = uploadId ? await ctx.db.get(uploadId) : null
    if (!upload || upload.eventId !== event._id || upload.deletedAt)
      return { notFound: true }

    if (args.action === "delete") {
      await ctx.db.patch(upload._id, { deletedAt: Date.now() })
      await emitWebhook(ctx, event._id, "file.deleted", {
        id: upload._id,
        session_id: upload.submissionId ?? null,
        filename: upload.filename,
      })
      return { deleted: true }
    }

    const patch: Record<string, unknown> = {}
    if (args.title !== undefined) patch.title = args.title
    if (args.assignedParticipantId !== undefined) {
      if (args.assignedParticipantId === "") patch.assignedPersonId = undefined
      else {
        const candidate = ctx.db.normalizeId("people", args.assignedParticipantId)
        const person = candidate ? await ctx.db.get(candidate) : null
        if (!person || person.eventId !== event._id)
          throw new Error("`assigned_participant_id` is not a person on this event.")
        patch.assignedPersonId = person._id
      }
    }
    await ctx.db.patch(upload._id, patch)
    const fresh = await ctx.db.get(upload._id)
    return { data: await fileShape(ctx, fresh as Doc<"uploads">) }
  },
})

// ——— Two-phase upload intents (files > the simple-upload ceiling) ————————

export const createUploadIntent = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    filename: v.string(),
    contentType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    title: v.optional(v.string()),
    assignedParticipantId: v.optional(v.string()),
    replacesUploadId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    const submission = id ? await ctx.db.get(id) : null
    if (!submission || submission.eventId !== event._id) return { notFound: true }

    let assignedPersonId: Id<"people"> | undefined
    if (args.assignedParticipantId) {
      const candidate = ctx.db.normalizeId("people", args.assignedParticipantId)
      const person = candidate ? await ctx.db.get(candidate) : null
      if (!person || person.eventId !== event._id)
        throw new Error("`assigned_participant_id` is not a person on this event.")
      assignedPersonId = person._id
    }

    const intentId = await ctx.db.insert("fileUploadIntents", {
      eventId: event._id,
      submissionId: submission._id,
      personId: assignedPersonId ?? submission.submitterId,
      filename: args.filename,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      title: args.title,
      assignedPersonId,
      replacesUploadId: args.replacesUploadId
        ? (ctx.db.normalizeId("uploads", args.replacesUploadId) ?? undefined)
        : undefined,
      createdAt: Date.now(),
    })
    return { intentId }
  },
})

export const bindUploadIntentBytes = internalMutation({
  args: { intentId: v.string(), storageId: v.id("_storage"), size: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("fileUploadIntents", args.intentId)
    const intent = id ? await ctx.db.get(id) : null
    if (!intent) return { notFound: true }
    if (intent.storageId) {
      // Re-PUT: drop the superseded blob rather than leaking it.
      try {
        await ctx.storage.delete(intent.storageId)
      } catch {
        /* already gone */
      }
    }
    await ctx.db.patch(intent._id, { storageId: args.storageId, sizeBytes: args.size })
    return { ok: true }
  },
})

export const completeUploadIntent = internalMutation({
  args: { eventRef: v.string(), userId: v.string(), intentId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("fileUploadIntents", args.intentId)
    const intent = id ? await ctx.db.get(id) : null
    if (!intent || intent.eventId !== event._id) return { notFound: true }
    if (!intent.storageId)
      throw new Error(
        "No bytes received yet — PUT the file to the `upload.url` from this file's create response first.",
      )

    const previous = intent.replacesUploadId
      ? await ctx.db.get(intent.replacesUploadId)
      : null
    const version = previous ? previous.version + 1 : 1
    if (previous) await ctx.db.patch(previous._id, { deletedAt: Date.now() })

    const uploadId = await ctx.db.insert("uploads", {
      eventId: intent.eventId,
      personId: intent.personId,
      submissionId: intent.submissionId,
      storageId: intent.storageId,
      filename: intent.filename,
      contentType: intent.contentType,
      size: intent.sizeBytes,
      version,
      approvalStatus: "pending",
      title: intent.title ?? intent.filename,
      assignedPersonId: intent.assignedPersonId,
    })
    await ctx.db.delete(intent._id)
    const upload = await ctx.db.get(uploadId)
    const shaped = await fileShape(ctx, upload as Doc<"uploads">)
    await emitWebhook(ctx, event._id, "file.uploaded", shaped)
    return { data: shaped }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Agenda
// ══════════════════════════════════════════════════════════════════════════

export const agendaSnapshot = internalQuery({
  args: { eventRef: v.string(), userId: v.union(v.string(), v.null()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const maps = await loadMaps(ctx, event._id)
    const conflicts = await computeConflicts(ctx, event._id)
    const accepted = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", "accepted"),
      )
      .take(MAX_ROWS)
    const live = accepted.filter((s) => s.deletedAt === undefined)
    return {
      event: await eventShape(ctx, event),
      published: event.agendaPublishedAt !== undefined,
      published_at: iso(event.agendaPublishedAt),
      rooms: maps.roomRows
        .sort((a, b) => a.order - b.order)
        .map((room) => ({
          id: room._id,
          name: room.name,
          capacity: room.capacity ?? null,
          order: room.order,
        })),
      tracks: maps.trackRows
        .sort((a, b) => a.order - b.order)
        .map((track) => ({
          id: track._id,
          name: track.name,
          color: track.color,
          order: track.order,
        })),
      scheduled: live
        .filter((s) => s.startsAt !== undefined)
        .map((s) => ({
          id: s._id,
          title: s.title,
          starts_at: iso(s.startsAt),
          ends_at: iso(
            s.startsAt !== undefined && s.durationMinutes !== undefined
              ? s.startsAt + s.durationMinutes * 60_000
              : undefined,
          ),
          duration_minutes: s.durationMinutes ?? null,
          room_id: s.roomId ?? null,
          track_id: s.trackId ?? null,
          // On the organizer's agenda a hidden session is still a real slot —
          // it just isn't announced. Flagged, never dropped.
          is_public: s.publicVisible !== false,
        })),
      unscheduled: live
        .filter((s) => s.startsAt === undefined)
        .map((s) => ({
          id: s._id,
          title: s.title,
          is_public: s.publicVisible !== false,
        })),
      conflicts,
      totals: {
        scheduled: live.filter((s) => s.startsAt !== undefined).length,
        unscheduled: live.filter((s) => s.startsAt === undefined).length,
        conflicts: Array.isArray(conflicts) ? conflicts.length : 0,
      },
    }
  },
})

export const setAgendaPublished = internalMutation({
  args: { eventRef: v.string(), userId: v.string(), published: v.boolean() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId, "admin")
    await ctx.db.patch(event._id, {
      agendaPublishedAt: args.published ? Date.now() : undefined,
    })
    const fresh = await ctx.db.get(event._id)
    const shaped = await eventShape(ctx, fresh as Doc<"events">)
    if (args.published)
      await emitWebhook(ctx, event._id, "agenda.published", shaped)
    return { data: shaped }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Webhook endpoints (management)
// ══════════════════════════════════════════════════════════════════════════

function webhookShape(
  hook: Doc<"webhooks">,
  revealSecret = false,
): Record<string, unknown> {
  return {
    id: hook._id,
    url: hook.url,
    events: hook.events,
    description: hook.description ?? null,
    enabled: hook.enabled,
    event_id: hook.eventId ?? null,
    org_id: hook.organizationId,
    secret: revealSecret ? hook.secret : maskSecret(hook.secret),
    created_at: iso(hook.createdAt),
    last_delivery_at: iso(hook.lastDeliveryAt),
    last_status: hook.lastStatus ?? null,
    last_error: hook.lastError ?? null,
    consecutive_failures: hook.consecutiveFailures ?? 0,
  }
}

async function organizationsFor(
  ctx: QueryCtx,
  userId: string,
): Promise<Array<Id<"organizations">>> {
  const memberships = await ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect()
  return memberships.map((m) => m.organizationId)
}

export const listWebhooks = internalQuery({
  args: { userId: v.string(), eventRef: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const orgIds = await organizationsFor(ctx, args.userId)
    const rows: Array<Doc<"webhooks">> = []
    for (const orgId of orgIds) {
      rows.push(
        ...(await ctx.db
          .query("webhooks")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
          .collect()),
      )
    }
    let filtered = rows
    if (args.eventRef) {
      const event = await resolveEvent(ctx, args.eventRef)
      if (!event) return null
      filtered = rows.filter((hook) => hook.eventId === event._id)
    }
    const data = filtered
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((hook) => webhookShape(hook))
    return { data, results: data }
  },
})

export const getWebhook = internalQuery({
  args: { userId: v.string(), webhookId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("webhooks", args.webhookId)
    const hook = id ? await ctx.db.get(id) : null
    if (!hook) return { notFound: true }
    await membershipFor(ctx, args.userId, hook.organizationId)
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhookId", (q) => q.eq("webhookId", hook._id))
      .order("desc")
      .take(25)
    return {
      data: {
        ...webhookShape(hook),
        deliveries: deliveries.map((d) => ({
          id: d._id,
          event_type: d.eventType,
          status: d.status,
          attempts: d.attempts,
          response_status: d.responseStatus ?? null,
          error: d.error ?? null,
          created_at: iso(d.createdAt),
          delivered_at: iso(d.deliveredAt),
        })),
      },
    }
  },
})

export const writeWebhook = internalMutation({
  args: {
    userId: v.string(),
    action: v.string(), // create | update | delete | rotate | test
    webhookId: v.optional(v.string()),
    eventRef: v.optional(v.string()),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.action === "create") {
      const url = (args.url ?? "").trim()
      if (!/^https?:\/\//i.test(url))
        throw new Error("`url` must be an absolute http(s) URL.")
      const event = args.eventRef ? await resolveEvent(ctx, args.eventRef) : null
      if (args.eventRef && !event) return { notFound: true }
      let organizationId: Id<"organizations"> | undefined = event?.organizationId
      if (!organizationId) {
        const orgIds = await organizationsFor(ctx, args.userId)
        organizationId = orgIds[0]
      }
      if (!organizationId) throw new Error("You don't belong to a workspace yet.")
      await membershipFor(ctx, args.userId, organizationId, "admin")

      const secret = generateWebhookSecret()
      const id = await ctx.db.insert("webhooks", {
        organizationId,
        eventId: event?._id,
        url,
        secret,
        events: args.events && args.events.length > 0 ? args.events : ["*"],
        description: args.description,
        enabled: args.enabled ?? true,
        createdAt: Date.now(),
      })
      const hook = await ctx.db.get(id)
      await recordWorkspace(ctx, {
        organizationId,
        entity: "settings",
        entityId: String(id),
        action: "webhook_created",
        summary: `Webhook endpoint created via the API · ${url}`,
        actor: { type: "api", label: "API · POST /webhooks" },
      })
      // The plaintext secret is returned exactly once, like an API key.
      return { data: webhookShape(hook as Doc<"webhooks">, true) }
    }

    const id = args.webhookId ? ctx.db.normalizeId("webhooks", args.webhookId) : null
    const hook = id ? await ctx.db.get(id) : null
    if (!hook) return { notFound: true }
    await membershipFor(ctx, args.userId, hook.organizationId, "admin")

    if (args.action === "delete") {
      const deliveries = await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_webhookId", (q) => q.eq("webhookId", hook._id))
        .take(500)
      for (const delivery of deliveries) await ctx.db.delete(delivery._id)
      await ctx.db.delete(hook._id)
      await recordWorkspace(ctx, {
        organizationId: hook.organizationId,
        entity: "settings",
        entityId: String(hook._id),
        action: "webhook_deleted",
        summary: `Webhook endpoint deleted via the API · ${hook.url}`,
        actor: { type: "api", label: "API · DELETE /webhooks/{id}" },
      })
      return { deleted: true }
    }

    if (args.action === "rotate") {
      const secret = generateWebhookSecret()
      await ctx.db.patch(hook._id, { secret })
      const fresh = await ctx.db.get(hook._id)
      await recordWorkspace(ctx, {
        organizationId: hook.organizationId,
        entity: "settings",
        entityId: String(hook._id),
        action: "webhook_secret_rotated",
        summary: `Webhook signing secret rotated via the API · ${hook.url}`,
        actor: { type: "api", label: "API · POST /webhooks/{id}/rotate" },
      })
      return { data: webhookShape(fresh as Doc<"webhooks">, true) }
    }

    if (args.action === "test") {
      const body = JSON.stringify({
        data: { id: hook._id, sourceOfChange: "user", test: true },
        metadata: {
          action: "webhook.test",
          event_id: hook.eventId ?? null,
          org_id: hook.organizationId,
          resource_url: null,
          version: 1,
          datetime: new Date().toISOString(),
        },
      })
      const deliveryId = await ctx.db.insert("webhookDeliveries", {
        webhookId: hook._id,
        organizationId: hook.organizationId,
        eventType: "webhook.test",
        payload: body,
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      })
      await ctx.scheduler.runAfter(0, internal.webhooks.deliver, {
        deliveryId,
        attempt: 1,
      })
      return { data: { delivery_id: deliveryId, status: "queued" } }
    }

    if (args.url !== undefined && !/^https?:\/\//i.test(args.url))
      throw new Error("`url` must be an absolute http(s) URL.")
    await ctx.db.patch(hook._id, {
      url: args.url ?? hook.url,
      events: args.events ?? hook.events,
      description: args.description ?? hook.description,
      enabled: args.enabled ?? hook.enabled,
    })
    const fresh = await ctx.db.get(hook._id)
    await recordWorkspace(ctx, {
      organizationId: hook.organizationId,
      entity: "settings",
      entityId: String(hook._id),
      action: "webhook_updated",
      summary: `Webhook endpoint updated via the API · ${args.url ?? hook.url}`,
      actor: { type: "api", label: "API · PUT /webhooks/{id}" },
    })
    return { data: webhookShape(fresh as Doc<"webhooks">) }
  },
})

/** Delivery log for the suite and the (future) settings UI. */
export const webhookDeliveries = internalQuery({
  args: { userId: v.string(), webhookId: v.string(), limit: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("webhooks", args.webhookId)
    const hook = id ? await ctx.db.get(id) : null
    if (!hook) return { notFound: true }
    await membershipFor(ctx, args.userId, hook.organizationId)
    const rows = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhookId", (q) => q.eq("webhookId", hook._id))
      .order("desc")
      .take(Math.min(Math.max(args.limit, 1), 100))
    const data = rows.map((d) => ({
      id: d._id,
      event_type: d.eventType,
      status: d.status,
      attempts: d.attempts,
      response_status: d.responseStatus ?? null,
      error: d.error ?? null,
      payload: d.payload,
      created_at: iso(d.createdAt),
      delivered_at: iso(d.deliveredAt),
    }))
    return { data, results: data }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Credentials + rate limiting (used by convex/apiHttp.ts)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Exchanges a plaintext `sb_live_…` key for its owner and scopes, stamping
 * `lastUsedAt`. Mirrors mcp.resolveApiKey and shares the same table, so a key
 * works for the REST API and the MCP server interchangeably.
 */
export const resolveCredential = internalMutation({
  args: { keyHash: v.string() },
  returns: v.union(
    v.object({ userId: v.string(), scopes: v.union(v.array(v.string()), v.null()) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique()
    if (!row) return null
    await ctx.db.patch(row._id, { lastUsedAt: Date.now() })
    return { userId: row.userId, scopes: row.scopes ?? null }
  },
})

/**
 * Fixed-window counter, 100 requests per 15 minutes per (credential, bucket),
 * matching the documented limits. Returns the headers the caller should echo.
 */
export const consumeRateLimit = internalMutation({
  args: { subject: v.string(), bucket: v.string(), limit: v.number() },
  returns: v.object({
    allowed: v.boolean(),
    limit: v.number(),
    remaining: v.number(),
    reset: v.number(),
    retryAfter: v.number(),
  }),
  handler: async (ctx, args) => {
    const WINDOW_MS = 15 * 60 * 1000
    const now = Date.now()
    const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS
    const existing = await ctx.db
      .query("apiRateLimits")
      .withIndex("by_subject_and_bucket", (q) =>
        q.eq("subject", args.subject).eq("bucket", args.bucket),
      )
      .unique()

    let count = 1
    if (!existing) {
      await ctx.db.insert("apiRateLimits", {
        subject: args.subject,
        bucket: args.bucket,
        windowStart,
        count: 1,
      })
    } else if (existing.windowStart !== windowStart) {
      await ctx.db.patch(existing._id, { windowStart, count: 1 })
    } else {
      count = existing.count + 1
      await ctx.db.patch(existing._id, { count })
    }

    const reset = Math.floor((windowStart + WINDOW_MS) / 1000)
    return {
      allowed: count <= args.limit,
      limit: args.limit,
      remaining: Math.max(0, args.limit - count),
      reset,
      retryAfter: Math.max(1, reset - Math.floor(now / 1000)),
    }
  },
})

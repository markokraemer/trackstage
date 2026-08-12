import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, internalQuery } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { emitWebhook, generateWebhookSecret, maskSecret } from "./webhooks"
import { eventAccessFor, memberCanSeeEvent, membershipFor } from "./lib/auth"
import { recordWorkspace } from "./lib/audit"
import { computeConflicts } from "./agenda"
import { deleteEventCascade } from "./events"
import { deleteUploadRow } from "./lib/files"
import {
  assertReleasable,
  eventTrackNames,
  releaseBlockers,
  syncTrackOptions,
} from "./lib/formQuestions"
import { personProfileComplete, syncProfileTasks } from "./lib/profileTasks"
import {
  eventPath,
  formPath,
  oldestEventBySlug,
  uniqueEventSlug,
  uniqueFormSlug,
  workspaceSlugForEvent,
} from "./lib/publicLinks"
import {
  DEFAULT_SESSION_STATUSES,
  STATUS_CATEGORIES,
  ensureDefaultStatuses,
} from "./sessionStatuses"
import type { StatusCategory, StatusColor } from "./sessionStatuses"
import { humanMessage } from "./lib/errors"
import { TASK_KINDS as APP_TASK_KINDS } from "./tasksAdmin"

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
  // Event slugs are unique per workspace, so a bare slug ref can match more
  // than one event; the oldest claimant wins (the event that held the address
  // when the integration was written keeps it). Ids are always unambiguous.
  return await oldestEventBySlug(ctx, trimmed)
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
  // eventAccessFor, not membershipFor: it also enforces per-member event
  // scoping (docs/memory/RULES.md 23), so an API key belonging to a scoped
  // member reaches exactly the events that member's browser session does.
  await eventAccessFor(ctx, userId, event._id, minRole)
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
  // Resolving a storage URL is an async system-table lookup. Reuse the result
  // for the modern and legacy aliases instead of doing the same lookup twice
  // for every participant in a paginated session search.
  const headshotUrl = person.headshotId
    ? await ctx.storage.getUrl(person.headshotId)
    : null
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
    photo_url: headshotUrl,
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
    headshotUrl,
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
  /** Preloaded joins used by paginated searches to avoid sequential N+1 reads. */
  participants?: Array<Doc<"submissionParticipants">>
  people?: Map<Id<"people">, Doc<"people">>
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
  const participants =
    opts.participants ??
    (await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(64))
  participants.sort((a, b) => a.order - b.order)

  const speakers: Array<Record<string, unknown>> = []
  const chairpersons: Array<Record<string, unknown>> = []
  const moderators: Array<Record<string, unknown>> = []
  const all: Array<Record<string, unknown>> = []
  for (const participant of participants) {
    const person = opts.people
      ? (opts.people.get(participant.personId) ?? null)
      : await ctx.db.get(participant.personId)
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

  const submitter = opts.people
    ? (opts.people.get(submission.submitterId) ?? null)
    : await ctx.db.get(submission.submitterId)
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
    background_url: event.backgroundId
      ? await ctx.storage.getUrl(event.backgroundId)
      : null,
    agenda_published_at: iso(event.agendaPublishedAt),
    created_at: iso(event._creationTime),
    // The workspace the event belongs to — what `POST /v1/events` takes as
    // `organization_id`, so a client can round-trip create-from-read.
    organization_id: event.organizationId ?? null,
    public_url: eventPath(await workspaceSlugForEvent(ctx, event), event.slug),
    portal_settings: {
      always_show_tasks: event.portalSettings?.alwaysShowTasks ?? false,
      allow_submission_edits: event.portalSettings?.allowSubmissionEdits ?? true,
      extend_task_deadlines: event.portalSettings?.extendTaskDeadlines ?? true,
    },
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
        events.push(
          ...rows.filter((row) => memberCanSeeEvent(membership, row._id)),
        )
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
    // Preload each page's participant rows concurrently, then fetch each
    // referenced person once. The old shape loop performed these joins
    // serially per session and could exceed Convex's one-second query limit on
    // a normal 22-row abstract page even though the filter itself was correct.
    const participantGroups = await Promise.all(
      page.data.map((row) =>
        ctx.db
          .query("submissionParticipants")
          .withIndex("by_submissionId", (q) => q.eq("submissionId", row._id))
          .take(64),
      ),
    )
    const personIds = new Set<Id<"people">>()
    for (const row of page.data) personIds.add(row.submitterId)
    for (const participants of participantGroups)
      for (const participant of participants) personIds.add(participant.personId)
    const personRows = await Promise.all(
      [...personIds].map((personId) => ctx.db.get(personId)),
    )
    const people = new Map<Id<"people">, Doc<"people">>()
    for (const person of personRows) if (person) people.set(person._id, person)

    const shaped = await Promise.all(
      page.data.map((row, index) =>
        sessionShape(ctx, row, {
          defs,
          rooms: maps.rooms,
          tracks: maps.tracks,
          expand,
          participants: participantGroups[index],
          people,
          // Asking for the public programme means asking for it as the public
          // sees it — hidden speakers drop out of the line-up too.
          publicSpeakersOnly: args.filters.publicOnly === true,
        }),
      ),
    )
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
    if (!title) throw new ConvexError("`title` cannot be empty.")
    patch.title = title
  }
  if (input.description !== undefined) patch.description = input.description
  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status))
      throw new ConvexError(
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
        throw new ConvexError(`No room "${input.room_id}" in this event.`)
      patch.roomId = roomId
    }
  }
  if (input.track_id !== undefined) {
    if (input.track_id === "") patch.trackId = undefined
    else {
      const trackId = ctx.db.normalizeId("tracks", input.track_id)
      const track = trackId ? await ctx.db.get(trackId) : null
      if (!track || track.eventId !== event._id)
        throw new ConvexError(`No track "${input.track_id}" in this event.`)
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
  if (!submitter) throw new ConvexError("Could not resolve a submitter.")

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
      throw new ConvexError("`title` is required.")
    const id = await applySessionWrite(ctx, event, args.input, null)
    const submission = await ctx.db.get(id)
    if (!submission) throw new ConvexError("Create failed.")
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
    if (!fresh) throw new ConvexError("Update failed.")
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
    if (!fresh) throw new ConvexError("Delete failed.")
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
      throw new ConvexError(`At most ${MAX_BULK_OPERATIONS} operations per request.`)

    const results: Array<Record<string, unknown>> = []
    let succeeded = 0
    let failed = 0
    for (let index = 0; index < args.operations.length; index++) {
      const op = args.operations[index]
      try {
        if (op.action === "create") {
          if (!op.data?.title) throw new ConvexError("`data.title` is required.")
          const id = await applySessionWrite(ctx, event, op.data, null)
          results.push({ index, action: "create", status: "success", id })
          succeeded++
        } else if (op.action === "update") {
          if (!op.id) throw new ConvexError("`id` is required for update.")
          const id = ctx.db.normalizeId("submissions", op.id)
          const existing = id ? await ctx.db.get(id) : null
          if (!existing || existing.eventId !== event._id)
            throw new ConvexError("Session not found.")
          await applySessionWrite(ctx, event, op.data ?? {}, existing)
          results.push({ index, action: "update", status: "success", id: existing._id })
          succeeded++
        } else if (op.action === "delete") {
          if (!op.id) throw new ConvexError("`id` is required for delete.")
          const id = ctx.db.normalizeId("submissions", op.id)
          const existing = id ? await ctx.db.get(id) : null
          if (!existing || existing.eventId !== event._id)
            throw new ConvexError("Session not found.")
          await ctx.db.patch(existing._id, {
            deletedAt: Date.now(),
            updatedAt: Date.now(),
          })
          results.push({ index, action: "delete", status: "success", id: existing._id })
          succeeded++
        } else {
          throw new ConvexError(
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
            message: humanMessage(e, "That operation failed."),
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
      // Any profile write can be the one that finishes the profile, and the
      // "update your profile" task ticks itself when it does.
      await syncProfileTasks(ctx, fresh)
      const shaped = await speakerShape(ctx, fresh as Doc<"people">)
      await emitWebhook(ctx, event._id, "speaker.updated", shaped)
      return { data: shaped }
    }

    const email = (input.email ?? "").trim().toLowerCase()
    if (!email) throw new ConvexError("`email` is required to create a speaker.")
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
// ——— Session statuses ————————————————————————————————————————————————————
//
// Sessionboard models statuses as per-event rows with a delete/restore pair;
// so do we (convex/sessionStatuses.ts). The one thing we do NOT do is let a
// custom status invent behaviour: every row is bound to a pipeline value
// (`pipeline_status`), which is what `submissions.status` actually stores and
// what `?status=` filters on. That keeps the organizer and speaker UIs saying
// the same word — an explicit requirement — while still allowing "Waitlist"
// to be the name an organizer sees.

/**
 * `id` stays the pipeline value for the seven built-ins, because that is what
 * this endpoint has always returned and what a client filtering sessions by
 * status needs. Custom rows are addressed by row id. `status_id` is always the
 * row id, so a client that wants one addressing scheme has one.
 */
function statusShape(row: Doc<"sessionStatuses">): Record<string, unknown> {
  return {
    id: row.systemKey ?? row._id,
    status_id: row._id,
    name: row.name,
    value: row.pipelineStatus,
    pipeline_status: row.pipelineStatus,
    category: row.category,
    color: row.color,
    order: row.order,
    system: row.systemKey !== undefined,
    system_key: row.systemKey ?? null,
    created_by: row.createdBy ?? null,
    created_at: row.systemKey ? null : iso(row._creationTime),
    updated_at: null,
    deleted_at: iso(row.deletedAt),
  }
}

async function statusList(
  ctx: QueryCtx,
  eventId: Id<"events">,
  includeDeleted: boolean,
): Promise<Array<Record<string, unknown>>> {
  const rows = await ctx.db
    .query("sessionStatuses")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
  // An event that has never opened Settings → Statuses has no rows yet; the
  // seven built-ins are still its statuses, so report them rather than an
  // empty list a client would read as "this event has no statuses".
  if (rows.length === 0)
    return DEFAULT_SESSION_STATUSES.map((preset) => ({
      id: preset.systemKey,
      status_id: null,
      name: preset.name,
      value: preset.pipelineStatus,
      pipeline_status: preset.pipelineStatus,
      category: preset.category,
      color: preset.color,
      order: preset.order,
      system: true,
      system_key: preset.systemKey,
      created_by: null,
      created_at: null,
      updated_at: null,
      deleted_at: null,
    }))
  return rows
    .filter((row) => includeDeleted || row.deletedAt === undefined)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(statusShape)
}

/** Resolves `{id}` on a status route: a row id, or a built-in's system key. */
async function findStatusRow(
  ctx: QueryCtx,
  eventId: Id<"events">,
  ref: string,
): Promise<Doc<"sessionStatuses"> | null> {
  const rows = await ctx.db
    .query("sessionStatuses")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
  const asId = ctx.db.normalizeId("sessionStatuses", ref)
  if (asId) {
    const row = rows.find((candidate) => candidate._id === asId)
    if (row) return row
  }
  return (
    rows.find((row) => row.systemKey === ref) ??
    rows.find((row) => row.name.toLowerCase() === ref.toLowerCase()) ??
    null
  )
}

const STATUS_COLOR_ALIASES: Record<string, string> = {
  green: "green",
  amber: "amber",
  yellow: "amber",
  orange: "amber",
  red: "red",
  gray: "gray",
  grey: "gray",
  blue: "blue",
}

/** Their `color` is free-form; ours is a design token. Map, or say why not. */
function readStatusColor(value: string | undefined): StatusColor | undefined {
  if (value === undefined) return undefined
  const mapped = STATUS_COLOR_ALIASES[value.trim().toLowerCase()]
  if (!mapped)
    throw new ConvexError(
      `Unknown status colour "${value}". Use one of: green, amber, red, gray, blue.`,
    )
  return mapped as StatusColor
}

function readStatusCategory(value: string | undefined): StatusCategory | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim().toLowerCase()
  if (!(STATUS_CATEGORIES as ReadonlyArray<string>).includes(trimmed))
    throw new ConvexError(
      `Unknown status category "${value}". Use one of: ${STATUS_CATEGORIES.join(", ")}.`,
    )
  return trimmed as StatusCategory
}

const CATEGORY_PIPELINE: Record<StatusCategory, string> = {
  draft: "draft",
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  withdrawn: "withdrawn",
}

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
    includeDeleted: v.optional(v.boolean()),
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
      items = await statusList(ctx, event._id, args.includeDeleted === true)
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
    // `unknownResource` is an internal dispatch sentinel, not API data. Keep
    // it absent on successful reads so it can never leak into REST envelopes.
    return paginate(items, args.page, args.pageSize)
  },
})

export const writeMetadata = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    resource: v.string(),
    action: v.string(), // create | update | delete | restore
    id: v.optional(v.string()),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    capacity: v.optional(v.number()),
    order: v.optional(v.number()),
    /** Statuses only: their behavioural bucket. */
    category: v.optional(v.string()),
    /** Statuses only: where submissions carrying a deleted label should land. */
    reassignTo: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)

    if (args.resource === "statuses") {
      // The seven built-ins must exist before anything can be added beside
      // them, or a custom status would silently orphan the pipeline labels.
      await ensureDefaultStatuses(ctx, event._id)

      if (args.action === "create") {
        const name = (args.name ?? "").trim()
        if (!name) throw new ConvexError("`name` is required.")
        if (name.length > 60)
          throw new ConvexError("Status names are limited to 60 characters.")
        const category = readStatusCategory(args.category) ?? "pending"
        const color = readStatusColor(args.color) ?? "gray"
        const rows = await ctx.db
          .query("sessionStatuses")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)
        const live = rows.filter((row) => row.deletedAt === undefined)
        if (live.some((row) => row.name.toLowerCase() === name.toLowerCase()))
          throw new ConvexError(`You already have a status called “${name}”.`)
        const order =
          args.order ??
          live.reduce((max, row) => Math.max(max, row.order), 0) + 10
        const id = await ctx.db.insert("sessionStatuses", {
          eventId: event._id,
          name,
          category,
          pipelineStatus: CATEGORY_PIPELINE[category] as Doc<"sessionStatuses">["pipelineStatus"],
          color,
          order,
          createdBy: "API",
        })
        const row = await ctx.db.get(id)
        return { data: statusShape(row as Doc<"sessionStatuses">) }
      }

      const row = await findStatusRow(ctx, event._id, args.id ?? "")
      if (!row) return { notFound: true }

      if (args.action === "restore") {
        if (row.deletedAt === undefined)
          return { data: statusShape(row), restored: false }
        const live = (
          await ctx.db
            .query("sessionStatuses")
            .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
            .take(MAX_ROWS)
        ).filter((other) => other.deletedAt === undefined)
        if (live.some((other) => other.name.toLowerCase() === row.name.toLowerCase()))
          throw new ConvexError(
            `A status called “${row.name}” exists again — rename that one before restoring this.`,
          )
        await ctx.db.patch(row._id, { deletedAt: undefined })
        const fresh = await ctx.db.get(row._id)
        return { data: statusShape(fresh as Doc<"sessionStatuses">), restored: true }
      }

      if (args.action === "delete") {
        if (row.systemKey)
          throw new ConvexError(
            `“${row.name}” is a built-in status the pipeline needs. You can rename or recolour it, but not delete it.`,
          )
        if (row.deletedAt !== undefined) return { deleted: true, reassigned: 0 }
        const submissions = await ctx.db
          .query("submissions")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)
        const labelled = submissions.filter((s) => s.statusId === row._id)
        const inUse = labelled.filter((s) => s.status === row.pipelineStatus)
        const stale = labelled.filter((s) => s.status !== row.pipelineStatus)
        let target: Doc<"sessionStatuses"> | null = null
        if (args.reassignTo) {
          target = await findStatusRow(ctx, event._id, args.reassignTo)
          if (!target || target._id === row._id)
            throw new ConvexError("Pick a different status from this event to move them to.")
        }
        if (inUse.length > 0 && !target)
          throw new ConvexError(
            `${inUse.length} submission${inUse.length === 1 ? " is" : "s are"} set to “${row.name}”. Pass \`reassign_to\` with the status to move ${inUse.length === 1 ? "it" : "them"} to.`,
          )
        let reassigned = 0
        for (const submission of inUse) {
          await ctx.db.patch(submission._id, {
            statusId: (target as Doc<"sessionStatuses">)._id,
            status: (target as Doc<"sessionStatuses">).pipelineStatus,
          })
          reassigned++
        }
        for (const submission of stale)
          await ctx.db.patch(submission._id, { statusId: undefined })
        await ctx.db.patch(row._id, { deletedAt: Date.now() })
        return { deleted: true, reassigned }
      }

      // update
      const patch: Record<string, unknown> = {}
      if (args.name !== undefined) {
        const name = args.name.trim()
        if (!name) throw new ConvexError("A status needs a name.")
        if (name.length > 60)
          throw new ConvexError("Status names are limited to 60 characters.")
        const live = (
          await ctx.db
            .query("sessionStatuses")
            .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
            .take(MAX_ROWS)
        ).filter((other) => other.deletedAt === undefined && other._id !== row._id)
        if (live.some((other) => other.name.toLowerCase() === name.toLowerCase()))
          throw new ConvexError(`You already have a status called “${name}”.`)
        patch.name = name
      }
      const color = readStatusColor(args.color)
      if (color !== undefined) patch.color = color
      if (args.order !== undefined) patch.order = args.order
      const category = readStatusCategory(args.category)
      if (category !== undefined && category !== row.category) {
        if (row.systemKey)
          throw new ConvexError(
            "Built-in statuses keep their category — it's what the accept/decline pipeline runs on. Rename or recolour it instead.",
          )
        patch.category = category
        patch.pipelineStatus = CATEGORY_PIPELINE[category]
      }
      await ctx.db.patch(row._id, patch)
      const fresh = await ctx.db.get(row._id)
      return { data: statusShape(fresh as Doc<"sessionStatuses">) }
    }

    if (args.resource === "rooms") {
      if (args.action === "create") {
        const existing = await ctx.db
          .query("rooms")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(MAX_ROWS)
        const name = (args.name ?? "").trim()
        if (!name) throw new ConvexError("`name` is required.")
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
        if (!name) throw new ConvexError("`name` is required.")
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
    if (!target) throw new ConvexError("`name` is required.")
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
      // Emptying the list behind a required question on a LIVE form is the
      // same wall as publishing one — refuse it (lib/formQuestions.ts).
      assertReleasable({
        wasOpen: form.status === "open",
        willBeOpen: form.status === "open",
        before: form.questions,
        after: questions,
        trackNames: await eventTrackNames(ctx, event._id),
      })
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
      throw new ConvexError("This event has no form to hold custom fields yet.")

    const explicitForm = args.formId
      ? forms.find((f) => f._id === ctx.db.normalizeId("forms", args.formId ?? ""))
      : undefined

    if (args.action === "create") {
      const form = explicitForm ?? forms[0]
      const label = (args.label ?? "").trim()
      if (!label) throw new ConvexError("`label` (or `name`) is required.")
      const slug =
        label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || `field_${Date.now()}`
      if (form.questions.some((q) => q.id === slug))
        throw new ConvexError(`A field named "${label}" already exists.`)
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
      const withNew = [...form.questions, question]
      assertReleasable({
        wasOpen: form.status === "open",
        willBeOpen: form.status === "open",
        before: form.questions,
        after: withNew,
        trackNames: await eventTrackNames(ctx, event._id),
      })
      await ctx.db.patch(form._id, { questions: withNew })
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
    if (!fieldId) throw new ConvexError("`fieldId` is required.")
    let touched = 0
    let shaped: Record<string, unknown> | null = null
    for (const form of forms) {
      const index = form.questions.findIndex((q) => q.id === fieldId)
      if (index === -1) continue
      const question = form.questions[index]
      if (question.locked)
        throw new ConvexError(
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
      // Making a question required, or switching it on, must not leave a live
      // form asking for an answer it cannot offer (lib/formQuestions.ts).
      assertReleasable({
        wasOpen: form.status === "open",
        willBeOpen: form.status === "open",
        before: form.questions,
        after: questions,
        trackNames: await eventTrackNames(ctx, event._id),
      })
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
        throw new ConvexError("`assigned_participant_id` is not a person on this event.")
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
          throw new ConvexError("`assigned_participant_id` is not a person on this event.")
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
        throw new ConvexError("`assigned_participant_id` is not a person on this event.")
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
      throw new ConvexError(
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
// Events — full CRUD
//
// Sessionboard's public API reads events and nothing else: no create, no
// update, no delete. An event is the container everything else in this API
// hangs off, so "list only" means an integration can never stand an event up
// end to end. These four complete it, on the product's own authorization:
// creating needs the admin role in the workspace, updating and deleting need
// the admin role on the event, and deleting runs the same cascade the
// organizer's own "Delete event" dialog runs.
// ══════════════════════════════════════════════════════════════════════════

export const getEvent = internalQuery({
  args: { eventRef: v.string(), userId: v.union(v.string(), v.null()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const [rooms, tracks, forms, submissions] = [
      await ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS),
      await ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS),
      await ctx.db
        .query("forms")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS),
      await ctx.db
        .query("submissions")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS),
    ]
    const live = submissions.filter((row) => row.deletedAt === undefined)
    return {
      data: {
        ...(await eventShape(ctx, event)),
        // Counts, so "did my import land?" is one call rather than five.
        totals: {
          rooms: rooms.length,
          tracks: tracks.length,
          forms: forms.length,
          sessions: live.filter((s) => s.kind !== "abstract").length,
          abstracts: live.filter((s) => s.kind === "abstract").length,
          accepted: live.filter((s) => s.status === "accepted").length,
          scheduled: live.filter((s) => s.startsAt !== undefined).length,
        },
      },
    }
  },
})

const eventWriteValidator = v.object({
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  timezone: v.optional(v.string()),
  type: v.optional(v.string()),
  website_url: v.optional(v.string()),
  description: v.optional(v.string()),
  venue: v.optional(v.string()),
  starts_at: v.optional(v.number()),
  ends_at: v.optional(v.number()),
  organization_id: v.optional(v.string()),
  always_show_tasks: v.optional(v.boolean()),
  allow_submission_edits: v.optional(v.boolean()),
  extend_task_deadlines: v.optional(v.boolean()),
})

export const writeEvent = internalMutation({
  args: {
    userId: v.string(),
    action: v.string(), // create | update | delete
    eventRef: v.optional(v.string()),
    input: eventWriteValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const input = args.input

    if (args.action === "create") {
      const name = (input.name ?? "").trim()
      if (!name) throw new ConvexError("`name` is required to create an event.")
      const timezone = (input.timezone ?? "").trim() || "UTC"
      // Which workspace? Named explicitly, or — the common case — the only one
      // this credential's owner is an admin of. Ambiguity is answered with the
      // actual choices rather than a guess.
      const memberships = await ctx.db
        .query("members")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect()
      const admin = memberships.filter(
        (member) => member.role === "admin" || member.role === "owner",
      )
      let organizationId: Id<"organizations">
      if (input.organization_id) {
        const normalized = ctx.db.normalizeId(
          "organizations",
          input.organization_id,
        )
        if (!normalized) throw new ConvexError("That workspace id isn't valid.")
        await membershipFor(ctx, args.userId, normalized, "admin")
        organizationId = normalized
      } else if (admin.length === 1) {
        organizationId = admin[0].organizationId
      } else if (admin.length === 0) {
        throw new ConvexError(
          "You need to be an admin of a workspace to create an event.",
        )
      } else {
        const names: Array<string> = []
        for (const member of admin) {
          const org = await ctx.db.get(member.organizationId)
          names.push(`${member.organizationId} (${org?.name ?? "workspace"})`)
        }
        throw new ConvexError(
          `You belong to more than one workspace — pass \`organization_id\`: ${names.join(", ")}.`,
        )
      }
      const slug = await uniqueEventSlug(ctx, organizationId, input.slug ?? name)
      const eventId = await ctx.db.insert("events", {
        organizationId,
        name,
        slug,
        timezone,
        type: input.type,
        websiteUrl: input.website_url,
        description: input.description,
        venue: input.venue,
        startsAt: input.starts_at,
        endsAt: input.ends_at,
      })
      const fresh = await ctx.db.get(eventId)
      await recordWorkspace(ctx, {
        organizationId,
        entity: "settings",
        entityId: eventId,
        action: "created",
        summary: `Event created via the API · ${name}`,
        meta: { slug },
      })
      return {
        data: await eventShape(ctx, fresh as Doc<"events">),
        // The address that is actually live — `slug` may have been suffixed.
        slug_adjusted: slug !== (input.slug ?? name).trim().toLowerCase(),
      }
    }

    const event = await resolveEvent(ctx, args.eventRef ?? "")
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId, "admin")

    if (args.action === "delete") {
      const name = event.name
      const organizationId = event.organizationId
      await deleteEventCascade(ctx, event._id)
      if (organizationId)
        await recordWorkspace(ctx, {
          organizationId,
          entity: "settings",
          entityId: event._id,
          action: "deleted",
          summary: `Event deleted via the API · ${name}`,
        })
      return { deleted: true }
    }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) throw new ConvexError("`name` cannot be empty.")
      patch.name = name
    }
    let slugAdjusted = false
    if (input.slug !== undefined) {
      const desired = input.slug.trim().toLowerCase()
      const slug =
        desired === event.slug || !event.organizationId
          ? event.slug
          : await uniqueEventSlug(ctx, event.organizationId, desired, event._id)
      slugAdjusted = slug !== desired
      patch.slug = slug
    }
    if (input.timezone !== undefined) patch.timezone = input.timezone
    if (input.type !== undefined) patch.type = input.type
    if (input.website_url !== undefined) patch.websiteUrl = input.website_url
    if (input.description !== undefined) patch.description = input.description
    if (input.venue !== undefined) patch.venue = input.venue
    if (input.starts_at !== undefined) patch.startsAt = input.starts_at
    if (input.ends_at !== undefined) patch.endsAt = input.ends_at
    // `portalSettings` is replaced wholesale by ctx.db.patch, so unspecified
    // flags are carried across rather than silently reset.
    if (
      input.always_show_tasks !== undefined ||
      input.allow_submission_edits !== undefined ||
      input.extend_task_deadlines !== undefined
    ) {
      patch.portalSettings = {
        alwaysShowTasks:
          input.always_show_tasks ?? event.portalSettings?.alwaysShowTasks,
        allowSubmissionEdits:
          input.allow_submission_edits ??
          event.portalSettings?.allowSubmissionEdits,
        extendTaskDeadlines:
          input.extend_task_deadlines ??
          event.portalSettings?.extendTaskDeadlines,
      }
    }
    await ctx.db.patch(event._id, patch)
    const fresh = await ctx.db.get(event._id)
    return {
      data: await eventShape(ctx, fresh as Doc<"events">),
      slug_adjusted: slugAdjusted,
    }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Session participants
//
// Their API fires `session.speaker.attached` / `.detached` webhooks but ships
// no endpoint that causes them — the only way to change a line-up is their UI.
// These three make the line-up writable, and are what finally emit those two
// event types.
// ══════════════════════════════════════════════════════════════════════════

const PARTICIPANT_ROLES = ["speaker", "chairperson", "moderator"]

export const listSessionParticipants = internalQuery({
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
    const rows = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(64)
    rows.sort((a, b) => a.order - b.order)
    const data = []
    for (const row of rows) {
      const person = await ctx.db.get(row.personId)
      if (!person) continue
      data.push({
        ...(await speakerShape(ctx, person, row.role)),
        participant_id: row._id,
        role: row.role,
        order: row.order,
        session_id: submission._id,
      })
    }
    return { data, results: data }
  },
})

export const writeSessionParticipant = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    action: v.string(), // add | remove
    speakerId: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("submissions", args.sessionId)
    const submission = id ? await ctx.db.get(id) : null
    if (!submission || submission.eventId !== event._id) return { notFound: true }

    const rows = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(64)

    if (args.action === "remove") {
      const personId = args.speakerId
        ? ctx.db.normalizeId("people", args.speakerId)
        : null
      const row =
        rows.find((candidate) => candidate._id === ctx.db.normalizeId("submissionParticipants", args.speakerId ?? "")) ??
        rows.find((candidate) => candidate.personId === personId)
      if (!row) return { participantNotFound: true }
      const person = await ctx.db.get(row.personId)
      await ctx.db.delete(row._id)
      await ctx.db.patch(submission._id, { updatedAt: Date.now() })
      await emitWebhook(ctx, event._id, "session.speaker.detached", {
        id: submission._id,
        session_id: submission._id,
        title: submission.title,
        speaker_id: row.personId,
        email: person?.email ?? null,
        role: row.role,
      })
      return { deleted: true }
    }

    const role = (args.role ?? "speaker").trim().toLowerCase()
    if (!PARTICIPANT_ROLES.includes(role))
      throw new ConvexError(
        `Unknown role "${role}". Valid: ${PARTICIPANT_ROLES.join(", ")}.`,
      )

    let person: Doc<"people"> | null = null
    if (args.speakerId) {
      const personId = ctx.db.normalizeId("people", args.speakerId)
      person = personId ? await ctx.db.get(personId) : null
      if (!person || person.eventId !== event._id)
        return { participantNotFound: true }
    } else {
      const email = (args.email ?? "").trim().toLowerCase()
      if (!email)
        throw new ConvexError("Pass `speaker_id`, or an `email` to attach someone new.")
      person = await ctx.db
        .query("people")
        .withIndex("by_eventId_and_email", (q) =>
          q.eq("eventId", event._id).eq("email", email),
        )
        .unique()
      if (!person) {
        const firstName = (args.firstName ?? "").trim()
        if (!firstName)
          throw new ConvexError("Add a `first_name` for someone new to this event.")
        const personId = await ctx.db.insert("people", {
          eventId: event._id,
          email,
          firstName,
          lastName: (args.lastName ?? "").trim(),
          portalToken: crypto.randomUUID().replace(/-/g, ""),
          updatedAt: Date.now(),
        })
        person = await ctx.db.get(personId)
        await emitWebhook(ctx, event._id, "speaker.created", {
          id: personId,
          email,
          first_name: firstName,
          last_name: (args.lastName ?? "").trim(),
          source: "api-participant",
        })
      }
    }
    const target = person as Doc<"people">
    const already = rows.find((row) => row.personId === target._id)
    if (already) {
      // Idempotent: re-adding with a different role moves them to it rather
      // than failing a sync that ran twice.
      if (already.role !== role) await ctx.db.patch(already._id, { role })
      return {
        data: {
          ...(await speakerShape(ctx, target, role)),
          participant_id: already._id,
          role,
          session_id: submission._id,
        },
        created: false,
      }
    }
    const participantId = await ctx.db.insert("submissionParticipants", {
      submissionId: submission._id,
      eventId: event._id,
      personId: target._id,
      role,
      order: rows.reduce((max, row) => Math.max(max, row.order), -1) + 1,
    })
    await ctx.db.patch(submission._id, { updatedAt: Date.now() })
    const shaped = {
      ...(await speakerShape(ctx, target, role)),
      participant_id: participantId,
      role,
      session_id: submission._id,
    }
    await emitWebhook(ctx, event._id, "session.speaker.attached", {
      id: submission._id,
      session_id: submission._id,
      title: submission.title,
      speaker_id: target._id,
      email: target.email,
      role,
    })
    return { data: shaped, created: true }
  },
})

/**
 * Remove someone from the roster outright. Mirrors the organizer UI's rule
 * exactly (convex/speakersAdmin.removePerson): refused while they are still on
 * a live submission, because deleting them there would silently orphan a talk.
 */
export const deleteSpeaker = internalMutation({
  args: { eventRef: v.string(), userId: v.string(), personId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("people", args.personId)
    const person = id ? await ctx.db.get(id) : null
    if (!person || person.eventId !== event._id) return { notFound: true }
    const name = personName(person)

    const participations = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .take(MAX_ROWS)
    const submitted = await ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", person._id))
      .take(MAX_ROWS)
    const live = new Set<Id<"submissions">>()
    for (const submission of submitted)
      if (submission.deletedAt === undefined) live.add(submission._id)
    for (const row of participations) {
      const submission = await ctx.db.get(row.submissionId)
      if (submission && submission.deletedAt === undefined) live.add(submission._id)
    }
    if (live.size > 0)
      throw new ConvexError(
        `${name} is on ${live.size} submission${live.size === 1 ? "" : "s"}. Remove them from those sessions first (DELETE …/sessions/{id}/participants/{speakerId}).`,
      )

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .take(MAX_ROWS)
    for (const task of tasks) await ctx.db.delete(task._id)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .take(MAX_ROWS)
    for (const upload of uploads) await deleteUploadRow(ctx, upload)
    for (const row of participations) await ctx.db.delete(row._id)
    await ctx.db.delete(person._id)
    await emitWebhook(ctx, event._id, "speaker.updated", {
      id: person._id,
      email: person.email,
      deleted: true,
    })
    return { deleted: true }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Forms (the CFP itself)
//
// Sessionboard's API has no forms endpoint at all: its custom fields are
// module definitions, and the form builder is a separate system. Here a form
// IS the field definitions, so reading and writing one is reading and writing
// the public submission page.
// ══════════════════════════════════════════════════════════════════════════

async function formShape(
  ctx: QueryCtx,
  form: Doc<"forms">,
  event: Doc<"events">,
  now: number = Date.now(),
): Promise<Record<string, unknown>> {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_formId", (q) => q.eq("formId", form._id))
    .take(MAX_ROWS)
  const live = submissions.filter((row) => row.deletedAt === undefined)
  // The track question reports the event's tracks, not a snapshot of them.
  const questions = syncTrackOptions(
    form.questions,
    await eventTrackNames(ctx, form.eventId),
  )
  return {
    id: form._id,
    slug: form.slug,
    kind: form.kind,
    status: form.status,
    is_open: form.status === "open" && (form.closeAt ?? Infinity) > now,
    close_at: iso(form.closeAt),
    internal_name: form.internalName,
    external_title: form.externalTitle,
    page_heading: form.pageHeading ?? null,
    welcome_message: form.welcomeMessage ?? null,
    show_welcome_message: form.showWelcomeMessage,
    notify_emails: form.notifyEmails,
    // The canonical public address — the link an organizer actually shares.
    public_url: formPath(await workspaceSlugForEvent(ctx, event), event.slug, form.slug),
    questions: questions.map((question, index) => ({
      id: question.id,
      // Same vocabulary as GET /fields, so one object has one name here.
      internal_name: question.id,
      public_name: question.label,
      label: question.label,
      field_type: question.type,
      type: question.type,
      required: question.required,
      enabled: question.enabled,
      locked: question.locked,
      help: question.help ?? null,
      placeholder: question.placeholder ?? null,
      options: question.options ?? null,
      max_chars: question.maxChars ?? null,
      show_if: question.showIf ?? null,
      is_track_question: question.isTrackQuestion === true,
      order: index,
    })),
    participant_config: {
      speaker_min: form.participantConfig.speakerMin,
      speaker_max: form.participantConfig.speakerMax,
      chairperson_enabled: form.participantConfig.chairpersonEnabled,
      moderator_enabled: form.participantConfig.moderatorEnabled,
      send_confirmation_email: form.participantConfig.sendConfirmationEmail,
      fields: form.participantConfig.fields.map((field) => ({
        id: field.id,
        internal_name: `participant.${field.id}`,
        label: field.label,
        required: field.required,
        enabled: field.enabled,
        locked: field.locked,
        help: field.help ?? null,
      })),
    },
    settings: {
      limit_per_user: form.settings.limitPerUser ?? null,
      allow_drafts: form.settings.allowDrafts,
      success_message: form.settings.successMessage ?? null,
      auto_redirect_to_portal: form.settings.autoRedirectToPortal,
      send_reminder_email: form.settings.sendReminderEmail,
    },
    submission_count: live.filter((row) => row.status !== "draft").length,
    draft_count: live.filter((row) => row.status === "draft").length,
    created_at: iso(form._creationTime),
    updated_at: iso(form._creationTime),
  }
}

export const listForms = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    now: v.number(),
    ...pagingArgs,
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
    let shaped = []
    for (const form of forms.sort((a, b) => a._creationTime - b._creationTime))
      shaped.push(await formShape(ctx, form, event, args.now))
    if (args.status)
      shaped = shaped.filter((form) => form.status === args.status)
    if (args.search) {
      const needle = args.search.toLowerCase()
      shaped = shaped.filter((form) =>
        `${form.internal_name} ${form.external_title} ${form.slug}`
          .toLowerCase()
          .includes(needle),
      )
    }
    return paginate(shaped, args.page, args.pageSize)
  },
})

export const getForm = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    formRef: v.string(),
    now: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const form = await findForm(ctx, event._id, args.formRef)
    if (!form) return { notFound: true }
    return { data: await formShape(ctx, form, event, args.now) }
  },
})

/** Forms are addressable by id or by their public slug, like events. */
async function findForm(
  ctx: QueryCtx,
  eventId: Id<"events">,
  ref: string,
): Promise<Doc<"forms"> | null> {
  const asId = ctx.db.normalizeId("forms", ref)
  if (asId) {
    const form = await ctx.db.get(asId)
    if (form && form.eventId === eventId) return form
  }
  return await ctx.db
    .query("forms")
    .withIndex("by_eventId_slug", (q) => q.eq("eventId", eventId).eq("slug", ref))
    .unique()
}

type IncomingQuestion = {
  id: string
  label: string
  type: string
  required: boolean
  enabled: boolean
  locked: boolean
  help?: string
  placeholder?: string
  options?: Array<string>
  maxChars?: number
  showIf?: { questionId: string; equals: string }
  isTrackQuestion?: boolean
}

const incomingQuestionValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.string(),
  required: v.boolean(),
  enabled: v.boolean(),
  locked: v.boolean(),
  help: v.optional(v.string()),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
  maxChars: v.optional(v.number()),
  showIf: v.optional(v.object({ questionId: v.string(), equals: v.string() })),
  isTrackQuestion: v.optional(v.boolean()),
})

const incomingParticipantFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  required: v.boolean(),
  enabled: v.boolean(),
  locked: v.boolean(),
  help: v.optional(v.string()),
})

export const writeForm = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    action: v.string(), // create | update | delete
    formRef: v.optional(v.string()),
    input: v.object({
      internal_name: v.optional(v.string()),
      external_title: v.optional(v.string()),
      kind: v.optional(v.string()),
      slug: v.optional(v.string()),
      status: v.optional(v.string()),
      close_at: v.optional(v.number()),
      page_heading: v.optional(v.string()),
      welcome_message: v.optional(v.string()),
      show_welcome_message: v.optional(v.boolean()),
      notify_emails: v.optional(v.array(v.string())),
      questions: v.optional(v.array(incomingQuestionValidator)),
      participant_config: v.optional(
        v.object({
          speaker_min: v.optional(v.number()),
          speaker_max: v.optional(v.number()),
          chairperson_enabled: v.optional(v.boolean()),
          moderator_enabled: v.optional(v.boolean()),
          send_confirmation_email: v.optional(v.boolean()),
          fields: v.optional(v.array(incomingParticipantFieldValidator)),
        }),
      ),
      settings: v.optional(
        v.object({
          limit_per_user: v.optional(v.number()),
          allow_drafts: v.optional(v.boolean()),
          success_message: v.optional(v.string()),
          auto_redirect_to_portal: v.optional(v.boolean()),
          send_reminder_email: v.optional(v.boolean()),
        }),
      ),
    }),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    const input = args.input

    if (args.action === "create") {
      await authorizeEvent(ctx, event, args.userId)
      const internalName = (input.internal_name ?? "").trim()
      if (!internalName)
        throw new ConvexError("`internal_name` is required to create a form.")
      const kind = (input.kind ?? "abstract").trim()
      if (!["abstract", "session"].includes(kind))
        throw new ConvexError("`kind` must be `abstract` or `session`.")
      const tracks = await ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS)
      const trackNames = tracks
        .sort((a, b) => a.order - b.order)
        .map((track) => track.name)
      // Track options are the event's tracks, never the caller's copy of them
      // (convex/lib/formQuestions.ts), and a form may not be created open while
      // a required choice question has nothing to offer.
      const questions = syncTrackOptions(
        input.questions ?? defaultFormQuestions(trackNames),
        trackNames,
      )
      const status = input.status === "closed" ? "closed" : "open"
      if (status === "open") {
        const blockers = releaseBlockers(questions, trackNames)
        if (blockers.length > 0) throw new ConvexError(blockers[0].message)
      }
      const slug = await uniqueFormSlug(ctx, event._id, input.slug ?? internalName)
      const formId = await ctx.db.insert("forms", {
        eventId: event._id,
        slug,
        kind,
        status,
        closeAt: input.close_at,
        internalName,
        externalTitle: input.external_title ?? internalName,
        pageHeading: input.page_heading ?? "Call for Speakers",
        welcomeMessage: input.welcome_message,
        showWelcomeMessage: input.show_welcome_message ?? true,
        questions,
        participantConfig: mergeParticipantConfig(
          defaultFormParticipantConfig(),
          input.participant_config,
        ),
        settings: mergeFormSettings(defaultFormSettings(), input.settings),
        notifyEmails: input.notify_emails ?? [],
      })
      const form = await ctx.db.get(formId)
      return { data: await formShape(ctx, form as Doc<"forms">, event) }
    }

    const form = await findForm(ctx, event._id, args.formRef ?? "")
    if (!form) {
      await authorizeEvent(ctx, event, args.userId)
      return { notFound: true }
    }

    if (args.action === "delete") {
      // Deleting configuration a whole event ran on is an admin act — and a
      // form with submissions is never deletable, because the submissions
      // point at it.
      await authorizeEvent(ctx, event, args.userId, "admin")
      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_formId", (q) => q.eq("formId", form._id))
        .first()
      if (existing)
        throw new ConvexError(
          "This form has submissions. Close it instead of deleting it (PUT with `status: \"closed\"`).",
        )
      await ctx.db.delete(form._id)
      return { deleted: true }
    }

    await authorizeEvent(ctx, event, args.userId)
    const formTrackNames = await eventTrackNames(ctx, event._id)
    const patch: Record<string, unknown> = {}
    if (input.internal_name !== undefined) {
      const name = input.internal_name.trim()
      if (!name) throw new ConvexError("`internal_name` cannot be empty.")
      patch.internalName = name
    }
    if (input.external_title !== undefined)
      patch.externalTitle = input.external_title
    if (input.kind !== undefined) {
      if (!["abstract", "session"].includes(input.kind))
        throw new ConvexError("`kind` must be `abstract` or `session`.")
      patch.kind = input.kind
    }
    if (input.slug !== undefined) {
      const desired = input.slug.trim().toLowerCase()
      patch.slug =
        desired === form.slug
          ? form.slug
          : await uniqueFormSlug(ctx, event._id, desired, form._id)
    }
    if (input.status !== undefined) {
      if (!["open", "closed"].includes(input.status))
        throw new ConvexError("`status` must be `open` or `closed`.")
      patch.status = input.status
    }
    if (input.close_at !== undefined) patch.closeAt = input.close_at
    if (input.page_heading !== undefined) patch.pageHeading = input.page_heading
    if (input.welcome_message !== undefined)
      patch.welcomeMessage = input.welcome_message
    if (input.show_welcome_message !== undefined)
      patch.showWelcomeMessage = input.show_welcome_message
    if (input.notify_emails !== undefined) patch.notifyEmails = input.notify_emails
    if (input.questions !== undefined) {
      // The three locked system questions are the contract the submission flow
      // and the speaker portal are written against; dropping one over the API
      // would break the public form silently.
      for (const locked of form.questions.filter((question) => question.locked))
        if (!input.questions.some((question) => question.id === locked.id))
          throw new ConvexError(
            `"${locked.label}" is a system question and has to stay on the form.`,
          )
      patch.questions = syncTrackOptions(input.questions, formTrackNames)
    }
    if (input.participant_config !== undefined)
      patch.participantConfig = mergeParticipantConfig(
        form.participantConfig,
        input.participant_config,
      )
    if (input.settings !== undefined)
      patch.settings = mergeFormSettings(form.settings, input.settings)

    // Same gate as the builder — see convex/lib/formQuestions.ts.
    assertReleasable({
      wasOpen: form.status === "open",
      willBeOpen: ((patch.status as string | undefined) ?? form.status) === "open",
      before: form.questions,
      after:
        (patch.questions as Array<IncomingQuestion> | undefined) ?? form.questions,
      trackNames: formTrackNames,
    })

    await ctx.db.patch(form._id, patch)
    const fresh = await ctx.db.get(form._id)
    return { data: await formShape(ctx, fresh as Doc<"forms">, event) }
  },
})

/** Kept in step with convex/forms.ts — the builder's own starting point. */
function defaultFormQuestions(trackNames: Array<string>): Array<IncomingQuestion> {
  return [
    { id: "title", label: "Title", type: "short_text", required: true, enabled: true, locked: true, maxChars: 200 },
    { id: "description", label: "Description", type: "rich_text", required: true, enabled: true, locked: true, maxChars: 5000 },
    { id: "format", label: "Format", type: "dropdown", required: true, enabled: true, locked: false, options: ["Talk", "Workshop", "Lightning Talk"] },
    // Required only once the event actually has tracks — see convex/forms.ts.
    { id: "track", label: "Track", type: "dropdown", required: trackNames.length > 0, enabled: true, locked: false, options: trackNames, isTrackQuestion: true },
    { id: "level", label: "Level", type: "dropdown", required: false, enabled: true, locked: false, options: ["Introductory", "Intermediate", "Advanced"] },
    { id: "language", label: "Language", type: "dropdown", required: false, enabled: true, locked: false, options: ["English"] },
    { id: "tags", label: "Tags", type: "multi_select", required: false, enabled: true, locked: false, options: ["AI", "Infrastructure", "Product", "Open Source"] },
  ]
}

function defaultFormParticipantConfig(): Doc<"forms">["participantConfig"] {
  return {
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
  }
}

function defaultFormSettings(): Doc<"forms">["settings"] {
  return {
    allowDrafts: true,
    autoRedirectToPortal: true,
    sendReminderEmail: true,
    successMessage:
      "<p>Thank you for submitting to present at our event! We'll review your submission and get back to you soon.</p>",
  }
}

function mergeParticipantConfig(
  base: Doc<"forms">["participantConfig"],
  patch:
    | {
        speaker_min?: number
        speaker_max?: number
        chairperson_enabled?: boolean
        moderator_enabled?: boolean
        send_confirmation_email?: boolean
        fields?: Array<{
          id: string
          label: string
          required: boolean
          enabled: boolean
          locked: boolean
          help?: string
        }>
      }
    | undefined,
): Doc<"forms">["participantConfig"] {
  if (!patch) return base
  return {
    speakerMin: patch.speaker_min ?? base.speakerMin,
    speakerMax: patch.speaker_max ?? base.speakerMax,
    chairpersonEnabled: patch.chairperson_enabled ?? base.chairpersonEnabled,
    moderatorEnabled: patch.moderator_enabled ?? base.moderatorEnabled,
    sendConfirmationEmail:
      patch.send_confirmation_email ?? base.sendConfirmationEmail,
    fields: patch.fields ?? base.fields,
  }
}

function mergeFormSettings(
  base: Doc<"forms">["settings"],
  patch:
    | {
        limit_per_user?: number
        allow_drafts?: boolean
        success_message?: string
        auto_redirect_to_portal?: boolean
        send_reminder_email?: boolean
      }
    | undefined,
): Doc<"forms">["settings"] {
  if (!patch) return base
  return {
    limitPerUser: patch.limit_per_user ?? base.limitPerUser,
    allowDrafts: patch.allow_drafts ?? base.allowDrafts,
    successMessage: patch.success_message ?? base.successMessage,
    autoRedirectToPortal:
      patch.auto_redirect_to_portal ?? base.autoRedirectToPortal,
    sendReminderEmail: patch.send_reminder_email ?? base.sendReminderEmail,
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Speaker tasks
//
// The outstanding-tasks dashboard is a headline requirement of the brief, and
// until now it was reachable only through the browser app. These five make it
// automatable: "everyone with an accepted talk owes me a headshot by Friday"
// is one POST per speaker, and a nightly script can read what is still open.
// ══════════════════════════════════════════════════════════════════════════

// One source of truth with the app (convex/tasksAdmin.ts): a kind the REST API
// accepts but the portal cannot complete would be a task nobody can ever
// finish. `form` is gone — `answer` (the speaker types a reply) replaced it.
const TASK_KINDS = APP_TASK_KINDS

async function taskShape(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  now: number = Date.now(),
): Promise<Record<string, unknown>> {
  const person = await ctx.db.get(task.personId)
  const submission = task.submissionId ? await ctx.db.get(task.submissionId) : null
  return {
    id: task._id,
    title: task.title,
    instructions: task.instructions ?? null,
    kind: task.kind,
    /** Kind `answer` only: what the speaker typed back in their portal. */
    response: task.response ?? null,
    due_at: iso(task.dueAt),
    completed_at: iso(task.completedAt),
    is_complete: task.completedAt !== undefined,
    is_overdue:
      task.completedAt === undefined &&
      task.dueAt !== undefined &&
      task.dueAt < now,
    speaker_id: task.personId,
    speaker: person
      ? {
          id: person._id,
          full_name: personName(person),
          email: person.email,
        }
      : null,
    session_id: task.submissionId ?? null,
    session_title: submission?.title ?? null,
    form_id: task.formId ?? null,
    created_at: iso(task._creationTime),
  }
}

export const listTasks = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    speakerId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    status: v.optional(v.string()), // open | completed | overdue
    search: v.optional(v.string()),
    now: v.number(),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .take(MAX_ROWS)
    let rows = tasks.sort((a, b) => b._creationTime - a._creationTime)
    if (args.speakerId) {
      const personId = ctx.db.normalizeId("people", args.speakerId)
      rows = rows.filter((task) => task.personId === personId)
    }
    if (args.sessionId) {
      const submissionId = ctx.db.normalizeId("submissions", args.sessionId)
      rows = rows.filter((task) => task.submissionId === submissionId)
    }
    if (args.status === "completed")
      rows = rows.filter((task) => task.completedAt !== undefined)
    else if (args.status === "open")
      rows = rows.filter((task) => task.completedAt === undefined)
    else if (args.status === "overdue")
      rows = rows.filter(
        (task) =>
          task.completedAt === undefined &&
          task.dueAt !== undefined &&
          task.dueAt < args.now,
      )
    if (args.search) {
      const needle = args.search.toLowerCase()
      rows = rows.filter((task) =>
        `${task.title} ${task.instructions ?? ""}`.toLowerCase().includes(needle),
      )
    }
    const shaped = []
    for (const task of rows) shaped.push(await taskShape(ctx, task, args.now))
    return paginate(shaped, args.page, args.pageSize)
  },
})

export const getTask = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    taskId: v.string(),
    now: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("tasks", args.taskId)
    const task = id ? await ctx.db.get(id) : null
    if (!task || task.eventId !== event._id) return { notFound: true }
    return { data: await taskShape(ctx, task, args.now) }
  },
})

export const writeTask = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    action: v.string(), // create | update | delete
    taskId: v.optional(v.string()),
    input: v.object({
      title: v.optional(v.string()),
      instructions: v.optional(v.string()),
      kind: v.optional(v.string()),
      due_at: v.optional(v.number()),
      completed: v.optional(v.boolean()),
      session_id: v.optional(v.string()),
      speaker_ids: v.optional(v.array(v.string())),
      speaker_emails: v.optional(v.array(v.string())),
    }),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    const input = args.input

    if (args.action === "create") {
      await authorizeEvent(ctx, event, args.userId)
      const title = (input.title ?? "").trim()
      if (!title) throw new ConvexError("`title` is required.")
      const kind = (input.kind ?? "upload").trim()
      if (!TASK_KINDS.includes(kind))
        throw new ConvexError(
          `Unknown task kind "${kind}". Valid: ${TASK_KINDS.join(", ")}.`,
        )
      let submissionId: Id<"submissions"> | undefined
      if (input.session_id) {
        const normalized = ctx.db.normalizeId("submissions", input.session_id)
        const submission = normalized ? await ctx.db.get(normalized) : null
        if (!submission || submission.eventId !== event._id)
          throw new ConvexError("That session doesn't belong to this event.")
        submissionId = submission._id
      }

      // Who it goes to: ids, emails, or both. Emails are how a script that
      // only knows the speaker's address assigns without a lookup first.
      const people: Array<Doc<"people">> = []
      for (const ref of input.speaker_ids ?? []) {
        const personId = ctx.db.normalizeId("people", ref)
        const person = personId ? await ctx.db.get(personId) : null
        if (!person || person.eventId !== event._id)
          throw new ConvexError(`No speaker "${ref}" in this event.`)
        people.push(person)
      }
      for (const email of input.speaker_emails ?? []) {
        const person = await ctx.db
          .query("people")
          .withIndex("by_eventId_and_email", (q) =>
            q.eq("eventId", event._id).eq("email", email.trim().toLowerCase()),
          )
          .unique()
        if (!person) throw new ConvexError(`Nobody in this event has the email ${email}.`)
        people.push(person)
      }
      if (people.length === 0)
        throw new ConvexError(
          "Assign the task to at least one speaker (`speaker_ids` or `speaker_emails`).",
        )

      const created = []
      const seen = new Set<string>()
      for (const person of people) {
        if (seen.has(person._id)) continue
        seen.add(person._id)
        const taskId = await ctx.db.insert("tasks", {
          eventId: event._id,
          personId: person._id,
          title,
          instructions: input.instructions?.trim() || undefined,
          kind,
          submissionId,
          dueAt: input.due_at,
          // Same rule the app applies (tasksAdmin.insertTasks): a profile task
          // for an already-complete profile is born done rather than sitting
          // open with nothing left for the speaker to do.
          completedAt:
            kind === "profile" && personProfileComplete(person)
              ? Date.now()
              : undefined,
        })
        const task = await ctx.db.get(taskId)
        created.push(await taskShape(ctx, task as Doc<"tasks">))
      }
      // One task per speaker, so the response is a list — `data` is the first
      // for a single-speaker call, which is the common case.
      return { data: created[0], results: created, created: created.length }
    }

    const id = args.taskId ? ctx.db.normalizeId("tasks", args.taskId) : null
    const task = id ? await ctx.db.get(id) : null
    if (!task || task.eventId !== event._id) {
      await authorizeEvent(ctx, event, args.userId)
      return { notFound: true }
    }

    if (args.action === "delete") {
      await authorizeEvent(ctx, event, args.userId, "admin")
      await ctx.db.delete(task._id)
      return { deleted: true }
    }

    await authorizeEvent(ctx, event, args.userId)
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) {
      const title = input.title.trim()
      if (!title) throw new ConvexError("`title` cannot be empty.")
      patch.title = title
    }
    if (input.instructions !== undefined)
      patch.instructions = input.instructions.trim() || undefined
    if (input.kind !== undefined) {
      if (!TASK_KINDS.includes(input.kind))
        throw new ConvexError(
          `Unknown task kind "${input.kind}". Valid: ${TASK_KINDS.join(", ")}.`,
        )
      patch.kind = input.kind
    }
    if (input.due_at !== undefined) patch.dueAt = input.due_at
    if (input.completed !== undefined)
      patch.completedAt = input.completed ? Date.now() : undefined
    await ctx.db.patch(task._id, patch)
    const fresh = await ctx.db.get(task._id)
    return { data: await taskShape(ctx, fresh as Doc<"tasks">) }
  },
})

// ══════════════════════════════════════════════════════════════════════════
// Evaluation — plans, evaluators, scores
//
// Multi-round evaluation with evaluator assignment is a headline requirement
// of the brief and has no counterpart anywhere in Sessionboard's public API.
// Reads let a chair build their own scoring report; writes let a plan be
// stood up from a spreadsheet instead of by hand.
// ══════════════════════════════════════════════════════════════════════════

function planAssignments(
  evaluator: Doc<"evaluators">,
  plan: Doc<"evaluationPlans">,
): Array<Id<"submissions">> {
  return evaluator.assignedSubmissionIds ?? plan.submissionIds
}

function planShape(
  plan: Doc<"evaluationPlans">,
  evaluators: Array<Doc<"evaluators">>,
  evaluations: Array<Doc<"evaluations">>,
): Record<string, unknown> {
  const expected = evaluators.reduce(
    (total, evaluator) => total + planAssignments(evaluator, plan).length,
    0,
  )
  const completed = evaluations.filter((row) => row.completedAt !== undefined)
  // Weighted mean over numeric criteria only — recusals never reach an average.
  const weights = new Map<string, number>()
  for (const criterion of plan.criteria)
    if ((criterion.type ?? "numeric") === "numeric")
      weights.set(criterion.id, criterion.weight ?? 1)
  let weightedTotal = 0
  let weightSum = 0
  let scored = 0
  for (const row of completed) {
    if (row.recusedAt !== undefined) continue
    let rowTotal = 0
    let rowWeight = 0
    for (const [criterionId, weight] of weights) {
      const score = row.scores[criterionId]
      if (typeof score !== "number") continue
      rowTotal += score * weight
      rowWeight += weight
    }
    if (rowWeight === 0) continue
    weightedTotal += rowTotal
    weightSum += rowWeight
    scored++
  }
  return {
    id: plan._id,
    name: plan.name,
    round: plan.round,
    status: plan.status,
    blind: plan.blind === true,
    opens_at: iso(plan.opensAt),
    due_at: iso(plan.dueAt),
    criteria: plan.criteria.map((criterion) => ({
      id: criterion.id,
      label: criterion.label,
      type: criterion.type ?? "numeric",
      options: criterion.options ?? null,
      weight: criterion.weight ?? 1,
    })),
    submission_ids: plan.submissionIds,
    submission_count: plan.submissionIds.length,
    evaluator_count: evaluators.length,
    assigned_count: expected,
    completed_count: completed.length,
    outstanding_count: Math.max(expected - completed.length, 0),
    completion_pct:
      expected === 0 ? 0 : Math.round((completed.length / expected) * 100),
    recused_count: completed.filter((row) => row.recusedAt !== undefined).length,
    scored_count: scored,
    average_score: weightSum === 0 ? null : Math.round((weightedTotal / weightSum) * 100) / 100,
    created_at: iso(plan._creationTime),
  }
}

function evaluatorShape(
  evaluator: Doc<"evaluators">,
  plan: Doc<"evaluationPlans">,
  evaluations: Array<Doc<"evaluations">>,
): Record<string, unknown> {
  const assigned = planAssignments(evaluator, plan)
  const assignedSet = new Set<string>(assigned)
  const mine = evaluations.filter((row) => row.evaluatorId === evaluator._id)
  const done = mine.filter(
    (row) => row.completedAt !== undefined && assignedSet.has(row.submissionId),
  ).length
  return {
    id: evaluator._id,
    plan_id: evaluator.planId,
    email: evaluator.email,
    name: evaluator.name ?? null,
    // The magic review link. Organizer-only surface — the same value the
    // Evaluation drawer shows so a chair can copy it.
    token: evaluator.token,
    review_path: `/review/${evaluator.token}`,
    assigned_submission_ids: assigned,
    custom_assignment: evaluator.assignedSubmissionIds !== undefined,
    completed_count: done,
    assigned_count: assigned.length,
    outstanding_count: Math.max(assigned.length - done, 0),
    recused_count: mine.filter((row) => row.recusedAt !== undefined).length,
    last_reminded_at: iso(evaluator.lastRemindedAt),
    created_at: iso(evaluator._creationTime),
  }
}

async function plansOf(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("evaluationPlans")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
}

async function evaluatorsOf(ctx: QueryCtx, planId: Id<"evaluationPlans">) {
  return await ctx.db
    .query("evaluators")
    .withIndex("by_planId", (q) => q.eq("planId", planId))
    .take(MAX_ROWS)
}

async function evaluationsOf(ctx: QueryCtx, planId: Id<"evaluationPlans">) {
  return await ctx.db
    .query("evaluations")
    .withIndex("by_planId", (q) => q.eq("planId", planId))
    .take(MAX_ROWS)
}

export const listEvaluationPlans = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    status: v.optional(v.string()),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const plans = (await plansOf(ctx, event._id)).sort(
      (a, b) => a.round - b.round || a._creationTime - b._creationTime,
    )
    const shaped = []
    for (const plan of plans) {
      if (args.status && plan.status !== args.status) continue
      shaped.push(
        planShape(
          plan,
          await evaluatorsOf(ctx, plan._id),
          await evaluationsOf(ctx, plan._id),
        ),
      )
    }
    return paginate(shaped, args.page, args.pageSize)
  },
})

export const getEvaluationPlan = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    planId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const id = ctx.db.normalizeId("evaluationPlans", args.planId)
    const plan = id ? await ctx.db.get(id) : null
    if (!plan || plan.eventId !== event._id) return { notFound: true }
    const evaluators = await evaluatorsOf(ctx, plan._id)
    const evaluations = await evaluationsOf(ctx, plan._id)
    const submissions = []
    for (const submissionId of plan.submissionIds) {
      const submission = await ctx.db.get(submissionId)
      if (!submission) continue
      const forSubmission = evaluations.filter(
        (row) => row.submissionId === submissionId && row.completedAt !== undefined,
      )
      const numeric = forSubmission.filter((row) => row.recusedAt === undefined)
      let total = 0
      let count = 0
      for (const row of numeric)
        for (const score of Object.values(row.scores)) {
          total += score
          count++
        }
      submissions.push({
        id: submission._id,
        title: submission.title,
        status: submission.status,
        completed_count: forSubmission.length,
        recused_count: forSubmission.length - numeric.length,
        average_score: count === 0 ? null : Math.round((total / count) * 100) / 100,
      })
    }
    return {
      data: {
        ...planShape(plan, evaluators, evaluations),
        evaluators: evaluators
          .sort((a, b) => a.email.localeCompare(b.email))
          .map((evaluator) => evaluatorShape(evaluator, plan, evaluations)),
        submissions,
      },
    }
  },
})

export const writeEvaluationPlan = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    action: v.string(), // create | update | delete
    planId: v.optional(v.string()),
    input: v.object({
      name: v.optional(v.string()),
      round: v.optional(v.number()),
      status: v.optional(v.string()),
      blind: v.optional(v.boolean()),
      opens_at: v.optional(v.number()),
      due_at: v.optional(v.number()),
      submission_ids: v.optional(v.array(v.string())),
      criteria: v.optional(
        v.array(
          v.object({
            id: v.optional(v.string()),
            label: v.string(),
            type: v.optional(v.string()),
            options: v.optional(v.array(v.string())),
            weight: v.optional(v.number()),
          }),
        ),
      ),
    }),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const input = args.input

    const readCriteria = () =>
      (input.criteria ?? []).map((criterion, index) => {
        const type = criterion.type ?? "numeric"
        if (!["numeric", "select", "text"].includes(type))
          throw new ConvexError(
            `Unknown criterion type "${type}". Valid: numeric, select, text.`,
          )
        const slug =
          criterion.id ??
          criterion.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
        return {
          id: slug || `criterion_${index + 1}`,
          label: criterion.label,
          type: type as "numeric" | "select" | "text",
          options: criterion.options,
          weight: criterion.weight,
        }
      })

    const readSubmissionIds = async () => {
      const ids: Array<Id<"submissions">> = []
      for (const ref of input.submission_ids ?? []) {
        const id = ctx.db.normalizeId("submissions", ref)
        const submission = id ? await ctx.db.get(id) : null
        if (!submission || submission.eventId !== event._id)
          throw new ConvexError(`No session "${ref}" in this event.`)
        if (!ids.includes(submission._id)) ids.push(submission._id)
      }
      return ids
    }

    if (args.action === "create") {
      const name = (input.name ?? "").trim()
      if (!name) throw new ConvexError("`name` is required.")
      const criteria = readCriteria()
      if (criteria.length === 0)
        throw new ConvexError(
          "Give the plan at least one criterion (`criteria: [{ label: \"Relevance\" }]`).",
        )
      const planId = await ctx.db.insert("evaluationPlans", {
        eventId: event._id,
        name,
        round: input.round ?? 1,
        criteria,
        submissionIds: await readSubmissionIds(),
        opensAt: input.opens_at,
        dueAt: input.due_at,
        status: input.status === "closed" ? "closed" : "open",
        blind: input.blind,
      })
      const plan = await ctx.db.get(planId)
      return { data: planShape(plan as Doc<"evaluationPlans">, [], []) }
    }

    const id = args.planId ? ctx.db.normalizeId("evaluationPlans", args.planId) : null
    const plan = id ? await ctx.db.get(id) : null
    if (!plan || plan.eventId !== event._id) return { notFound: true }

    if (args.action === "delete") {
      for (const row of await evaluationsOf(ctx, plan._id))
        await ctx.db.delete(row._id)
      for (const evaluator of await evaluatorsOf(ctx, plan._id))
        await ctx.db.delete(evaluator._id)
      await ctx.db.delete(plan._id)
      return { deleted: true }
    }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) throw new ConvexError("`name` cannot be empty.")
      patch.name = name
    }
    if (input.round !== undefined) patch.round = input.round
    if (input.status !== undefined) {
      if (!["open", "closed"].includes(input.status))
        throw new ConvexError("`status` must be `open` or `closed`.")
      patch.status = input.status
    }
    if (input.blind !== undefined) patch.blind = input.blind
    if (input.opens_at !== undefined) patch.opensAt = input.opens_at
    if (input.due_at !== undefined) patch.dueAt = input.due_at
    if (input.submission_ids !== undefined)
      patch.submissionIds = await readSubmissionIds()
    if (input.criteria !== undefined) patch.criteria = readCriteria()
    await ctx.db.patch(plan._id, patch)
    const fresh = (await ctx.db.get(plan._id)) as Doc<"evaluationPlans">
    return {
      data: planShape(
        fresh,
        await evaluatorsOf(ctx, plan._id),
        await evaluationsOf(ctx, plan._id),
      ),
    }
  },
})

export const listEvaluators = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    planId: v.optional(v.string()),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const wanted = args.planId
      ? ctx.db.normalizeId("evaluationPlans", args.planId)
      : null
    const shaped: Array<Record<string, unknown>> = []
    for (const plan of await plansOf(ctx, event._id)) {
      if (wanted && plan._id !== wanted) continue
      const evaluations = await evaluationsOf(ctx, plan._id)
      for (const evaluator of await evaluatorsOf(ctx, plan._id))
        shaped.push({
          ...evaluatorShape(evaluator, plan, evaluations),
          plan_name: plan.name,
          plan_round: plan.round,
        })
    }
    shaped.sort((a, b) => String(a.email).localeCompare(String(b.email)))
    return paginate(shaped, args.page, args.pageSize)
  },
})

export const writeEvaluator = internalMutation({
  args: {
    eventRef: v.string(),
    userId: v.string(),
    action: v.string(), // create | update | delete
    evaluatorId: v.optional(v.string()),
    input: v.object({
      plan_id: v.optional(v.string()),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      assigned_submission_ids: v.optional(v.array(v.string())),
    }),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const input = args.input

    const readAssignments = async (plan: Doc<"evaluationPlans">) => {
      if (input.assigned_submission_ids === undefined) return undefined
      const ids: Array<Id<"submissions">> = []
      for (const ref of input.assigned_submission_ids) {
        const id = ctx.db.normalizeId("submissions", ref)
        if (!id || !plan.submissionIds.includes(id))
          throw new ConvexError(`Session "${ref}" is not in this plan's pool.`)
        if (!ids.includes(id)) ids.push(id)
      }
      return ids
    }

    if (args.action === "create") {
      const planId = input.plan_id
        ? ctx.db.normalizeId("evaluationPlans", input.plan_id)
        : null
      const plan = planId ? await ctx.db.get(planId) : null
      if (!plan || plan.eventId !== event._id)
        throw new ConvexError("`plan_id` must name an evaluation plan on this event.")
      const email = (input.email ?? "").trim().toLowerCase()
      if (!email) throw new ConvexError("`email` is required.")
      const existing = (await evaluatorsOf(ctx, plan._id)).find(
        (row) => row.email === email,
      )
      if (existing) {
        // Idempotent, like every other create on this API.
        const assignments = await readAssignments(plan)
        await ctx.db.patch(existing._id, {
          name: input.name ?? existing.name,
          ...(assignments !== undefined
            ? { assignedSubmissionIds: assignments }
            : {}),
        })
        const fresh = (await ctx.db.get(existing._id)) as Doc<"evaluators">
        return {
          data: evaluatorShape(fresh, plan, await evaluationsOf(ctx, plan._id)),
          created: false,
        }
      }
      const evaluatorId = await ctx.db.insert("evaluators", {
        planId: plan._id,
        eventId: event._id,
        email,
        name: input.name,
        token: crypto.randomUUID().replace(/-/g, ""),
        assignedSubmissionIds: await readAssignments(plan),
      })
      const evaluator = (await ctx.db.get(evaluatorId)) as Doc<"evaluators">
      return {
        data: evaluatorShape(evaluator, plan, await evaluationsOf(ctx, plan._id)),
        created: true,
      }
    }

    const id = args.evaluatorId
      ? ctx.db.normalizeId("evaluators", args.evaluatorId)
      : null
    const evaluator = id ? await ctx.db.get(id) : null
    if (!evaluator || evaluator.eventId !== event._id) return { notFound: true }
    const plan = await ctx.db.get(evaluator.planId)
    if (!plan) return { notFound: true }

    if (args.action === "delete") {
      // Their scores go with them — an evaluator who was removed by mistake is
      // re-added and re-scores, which is honest; leaving orphan rows in the
      // averages is not.
      for (const row of await evaluationsOf(ctx, plan._id))
        if (row.evaluatorId === evaluator._id) await ctx.db.delete(row._id)
      await ctx.db.delete(evaluator._id)
      return { deleted: true }
    }

    const assignments = await readAssignments(plan)
    await ctx.db.patch(evaluator._id, {
      name: input.name ?? evaluator.name,
      ...(assignments !== undefined ? { assignedSubmissionIds: assignments } : {}),
    })
    const fresh = (await ctx.db.get(evaluator._id)) as Doc<"evaluators">
    return {
      data: evaluatorShape(fresh, plan, await evaluationsOf(ctx, plan._id)),
    }
  },
})

export const listEvaluations = internalQuery({
  args: {
    eventRef: v.string(),
    userId: v.union(v.string(), v.null()),
    planId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    evaluatorId: v.optional(v.string()),
    ...pagingArgs,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const event = await resolveEvent(ctx, args.eventRef)
    if (!event) return null
    await authorizeEvent(ctx, event, args.userId)
    const wantedPlan = args.planId
      ? ctx.db.normalizeId("evaluationPlans", args.planId)
      : null
    const wantedSession = args.sessionId
      ? ctx.db.normalizeId("submissions", args.sessionId)
      : null
    const wantedEvaluator = args.evaluatorId
      ? ctx.db.normalizeId("evaluators", args.evaluatorId)
      : null
    const shaped = []
    for (const plan of await plansOf(ctx, event._id)) {
      if (wantedPlan && plan._id !== wantedPlan) continue
      const evaluators = new Map(
        (await evaluatorsOf(ctx, plan._id)).map((row) => [row._id, row]),
      )
      for (const row of await evaluationsOf(ctx, plan._id)) {
        if (wantedSession && row.submissionId !== wantedSession) continue
        if (wantedEvaluator && row.evaluatorId !== wantedEvaluator) continue
        const evaluator = evaluators.get(row.evaluatorId)
        const submission = await ctx.db.get(row.submissionId)
        shaped.push({
          id: row._id,
          plan_id: row.planId,
          plan_name: plan.name,
          round: plan.round,
          session_id: row.submissionId,
          session_title: submission?.title ?? null,
          evaluator_id: row.evaluatorId,
          evaluator_email: evaluator?.email ?? null,
          scores: row.scores,
          values: row.values ?? {},
          comment: row.comment ?? null,
          recused: row.recusedAt !== undefined,
          recusal_reason: row.recusalReason ?? null,
          completed_at: iso(row.completedAt),
          created_at: iso(row._creationTime),
        })
      }
    }
    shaped.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return paginate(shaped, args.page, args.pageSize)
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
        throw new ConvexError("`url` must be an absolute http(s) URL.")
      const event = args.eventRef ? await resolveEvent(ctx, args.eventRef) : null
      if (args.eventRef && !event) return { notFound: true }
      let organizationId: Id<"organizations"> | undefined = event?.organizationId
      if (!organizationId) {
        const orgIds = await organizationsFor(ctx, args.userId)
        organizationId = orgIds[0]
      }
      if (!organizationId) throw new ConvexError("You don't belong to a workspace yet.")
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
      throw new ConvexError("`url` must be an absolute http(s) URL.")
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

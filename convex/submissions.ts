import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { internalMutation, mutation, query } from "./_generated/server"
import { scheduleAirtableSync } from "./airtable"
import { randomToken, requireEventAccess } from "./lib/auth"
import type { AuditActor } from "./lib/audit"
import { record as recordAudit, statusChangeSummary } from "./lib/audit"
import { emitWebhook } from "./webhooks"
import { enrichUploads } from "./lib/files"
import { personProfileComplete } from "./lib/profileTasks"

export const STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
] as const

export async function withJoins(ctx: QueryCtx, submission: Doc<"submissions">) {
  const [participants, track, room, form] = await Promise.all([
    ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .collect(),
    submission.trackId ? ctx.db.get(submission.trackId) : null,
    submission.roomId ? ctx.db.get(submission.roomId) : null,
    submission.formId ? ctx.db.get(submission.formId) : null,
  ])
  const people = await Promise.all(
    participants
      .sort((a, b) => a.order - b.order)
      .map(async (participant) => {
        const person = await ctx.db.get(participant.personId)
        return person
          ? {
              personId: person._id,
              name: `${person.firstName} ${person.lastName}`.trim() || person.email,
              email: person.email,
              role: participant.role,
              company: person.company,
            }
          : null
      }),
  )
  return {
    ...submission,
    track: track ? { _id: track._id, name: track.name, color: track.color } : null,
    room: room ? { _id: room._id, name: room.name } : null,
    formName: form?.internalName,
    participants: people.filter((p) => p !== null),
  }
}

export const list = query({
  args: {
    eventId: v.id("events"),
    status: v.optional(v.string()), // tab filter; absent = all (excl. drafts? no: all)
    search: v.optional(v.string()),
    trackId: v.optional(v.id("tracks")),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const rows = args.status
      ? await ctx.db
          .query("submissions")
          .withIndex("by_eventId_and_status", (q) =>
            q.eq("eventId", args.eventId).eq("status", args.status!),
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("submissions")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .order("desc")
          .collect()

    // Soft-deleted rows (`remove` below, and DELETE /sessions/{id}) are gone
    // from every organizer listing — they live on only in the Trash view.
    let filtered = rows.filter((s) => s.deletedAt === undefined)
    if (args.trackId) filtered = filtered.filter((s) => s.trackId === args.trackId)
    const joined = await Promise.all(filtered.map((s) => withJoins(ctx, s)))
    if (args.search) {
      const needle = args.search.toLowerCase()
      return joined.filter(
        (s) =>
          s.title.toLowerCase().includes(needle) ||
          (s.description ?? "").toLowerCase().includes(needle) ||
          s.participants.some(
            (p) =>
              p.name.toLowerCase().includes(needle) ||
              p.email.toLowerCase().includes(needle),
          ),
      )
    }
    return joined
  },
})

export const counts = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const all = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    const rows = all.filter((s) => s.deletedAt === undefined)
    const result: Record<string, number> = {
      all: rows.length,
      deleted: all.length - rows.length,
    }
    for (const status of STATUSES) {
      result[status] = rows.filter((s) => s.status === status).length
    }
    return result
  },
})

export const get = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await requireEventAccess(ctx, submission.eventId)
    const joined = await withJoins(ctx, submission)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .collect()
    // Real metadata from `_storage` (size, type, sha256) rather than whatever
    // the browser claimed when the file was attached — see convex/lib/files.ts.
    const enriched = await enrichUploads(
      ctx,
      uploads.sort((a, b) => b._creationTime - a._creationTime),
    )
    return { ...joined, uploads: enriched }
  },
})

/**
 * The one place a submission's status changes outside a queue commit.
 *
 * Everything that stages a decision funnels through here — the table's inline
 * picker, the drawer, bulk actions, and the experimental Airtable pull-back
 * (via `setStatusInternal`) — so the side-effects can never drift apart:
 * the patch, the outbound webhook, and the audit row are written together.
 *
 * `actor` is what makes the history readable: absent it resolves to the
 * signed-in organizer; the Airtable pull passes "Airtable" so a row that
 * moved itself is attributable.
 */
async function applyStatusChange(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
  status: string,
  actor?: AuditActor,
  /**
   * The custom status LABEL the organizer picked, if any
   * (convex/sessionStatuses.ts). Presentation only — `status` above stays the
   * single source of truth for every pipeline rule. Left out (the case for
   * bulk changes, queue commits and integrations) it clears any previous
   * label, so a row can never keep wording that contradicts its status.
   */
  statusId?: Id<"sessionStatuses">,
): Promise<void> {
  await ctx.db.patch(submission._id, { status, statusId })
  // Outbound webhooks (convex/webhooks.ts) — fire-and-forget, never blocks.
  await emitWebhook(ctx, submission.eventId, "submission.updated", {
    id: submission._id,
    title: submission.title,
    status,
    previous_status: submission.status,
  })
  await recordAudit(ctx, {
    eventId: submission.eventId,
    entity: submission.kind === "session" ? "session" : "submission",
    entityId: submission._id,
    action: "status_changed",
    summary: `${statusChangeSummary(submission.status, status)} · ${submission.title}`,
    meta: { from: submission.status, to: status, title: submission.title },
    actor,
  })
}

// Inline status change from the table (staging — no emails fired here).
export const setStatus = mutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.string(),
    // Optional custom status label (convex/sessionStatuses.ts). Must belong to
    // the same event and behave as `status`; anything else is a client bug.
    statusId: v.optional(v.id("sessionStatuses")),
  },
  handler: async (ctx, args) => {
    if (!STATUSES.includes(args.status as (typeof STATUSES)[number])) {
      throw new ConvexError(`Invalid status: ${args.status}`)
    }
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await requireEventAccess(ctx, submission.eventId)
    if (args.statusId) {
      const label = await ctx.db.get(args.statusId)
      if (!label || label.eventId !== submission.eventId) {
        throw new ConvexError("That status belongs to a different event.")
      }
      if (label.pipelineStatus !== args.status) {
        throw new ConvexError(
          `“${label.name}” behaves as ${label.pipelineStatus}, not ${args.status}.`,
        )
      }
    }
    await applyStatusChange(ctx, submission, args.status, undefined, args.statusId)
    return null
  },
})

/**
 * Same semantics, for callers that have already authorized the change and
 * carry their own attribution — today that is the experimental inbound
 * Airtable sync (convex/airtable.ts `applyInbound`). It exists so an
 * integration can never reach past the domain logic with a raw patch and
 * quietly skip the webhook and the audit row.
 */
export const setStatusInternal = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.string(),
    actorType: v.string(),
    actorLabel: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!STATUSES.includes(args.status as (typeof STATUSES)[number])) {
      throw new ConvexError(`Invalid status: ${args.status}`)
    }
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await applyStatusChange(ctx, submission, args.status, {
      type: args.actorType as AuditActor["type"],
      label: args.actorLabel,
    })
    return null
  },
})

export const bulkSetStatus = mutation({
  args: {
    submissionIds: v.array(v.id("submissions")),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (!STATUSES.includes(args.status as (typeof STATUSES)[number])) {
      throw new ConvexError(`Invalid status: ${args.status}`)
    }
    // Every id is authorized on its own event — a bulk call can never straddle
    // an event the caller has no access to.
    for (const id of args.submissionIds) {
      const submission = await ctx.db.get(id)
      if (!submission) continue
      await requireEventAccess(ctx, submission.eventId)
      await applyStatusChange(ctx, submission, args.status)
    }
    return { updated: args.submissionIds.length }
  },
})

// Commit a decision queue: flips statuses, stamps decidedAt/notifiedAt,
// queues templated emails, and (on accept) creates onboarding tasks.
export const commitQueue = mutation({
  args: {
    eventId: v.id("events"),
    queue: v.string(), // accept_queue | decline_queue
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    if (!["accept_queue", "decline_queue"].includes(args.queue)) {
      throw new ConvexError("queue must be accept_queue or decline_queue")
    }
    const accepting = args.queue === "accept_queue"
    const staged = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", args.eventId).eq("status", args.queue),
      )
      .collect()

    const now = Date.now()
    let notified = 0
    for (const submission of staged) {
      await ctx.db.patch(submission._id, {
        status: accepting ? "accepted" : "declined",
        // Committing a queue drops any custom status label: the row is moving
        // to a different pipeline stage, so the old wording no longer applies
        // (convex/sessionStatuses.ts).
        statusId: undefined,
        decidedAt: now,
        notifiedAt: now,
      })
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
          eventId: args.eventId,
          personId,
          templateKey: accepting ? "accepted" : "declined",
          submissionId: submission._id,
        })
        notified++
        if (accepting) {
          await ensureOnboardingTasks(ctx, args.eventId, personId)
        }
      }
      // Per-submission history: committing a queue is the moment a decision
      // becomes real (the email goes out), so it earns its own row on every
      // record rather than one summary line the organizer has to interpret.
      await recordAudit(ctx, {
        eventId: args.eventId,
        entity: submission.kind === "session" ? "session" : "submission",
        entityId: submission._id,
        action: "decision_committed",
        summary: `${statusChangeSummary(submission.status, accepting ? "accepted" : "declined")} and the speaker was emailed · ${submission.title}`,
        meta: {
          from: submission.status,
          to: accepting ? "accepted" : "declined",
          notified: notifyIds.length,
          title: submission.title,
        },
      })
    }
    // Decisions change every mirrored row's Status — one debounced sync.
    await scheduleAirtableSync(ctx, args.eventId)
    await emitWebhook(ctx, args.eventId, "decision.committed", {
      id: args.eventId,
      queue: args.queue,
      decision: accepting ? "accepted" : "declined",
      committed: staged.length,
      notified,
      session_ids: staged.map((submission) => submission._id),
    })
    return { committed: staged.length, notified }
  },
})

export async function ensureOnboardingTasks(
  ctx: MutationCtx,
  eventId: Id<"events">,
  personId: Id<"people">,
) {
  const existing = await ctx.db
    .query("tasks")
    .withIndex("by_personId", (q) => q.eq("personId", personId))
    .collect()
  const person = await ctx.db.get(personId)
  const defaults: Array<{ title: string; kind: string; instructions: string }> = [
    {
      title: "Upload your headshot",
      kind: "headshot",
      instructions:
        "Please upload a high-resolution headshot (at least 800×800px) for the event website.",
    },
    {
      title: "Complete your speaker bio",
      kind: "profile",
      instructions:
        "Add a short third-person biography (50–150 words) to your profile.",
    },
    {
      title: "Upload your slides",
      kind: "upload",
      instructions: "Upload your presentation slides (PDF preferred).",
    },
  ]
  for (const task of defaults) {
    const already = existing.find(
      (t: Doc<"tasks">) => t.kind === task.kind && t.eventId === eventId,
    )
    if (already) continue
    // Born done when the speaker has already supplied what the task asks for.
    // "Profile" means the same four items the speaker's own meter counts, not
    // just a bio (convex/lib/profileCompleteness.ts — adversarial-review F10).
    const completedByProfile =
      (task.kind === "headshot" && person?.headshotId) ||
      (task.kind === "profile" && person && personProfileComplete(person))
    await ctx.db.insert("tasks", {
      eventId,
      personId,
      title: task.title,
      kind: task.kind,
      instructions: task.instructions,
      completedAt: completedByProfile ? Date.now() : undefined,
    })
  }
}

// Manual add (organizer): sessions (sponsors/keynotes) or abstracts.
export const addManual = mutation({
  args: {
    eventId: v.id("events"),
    kind: v.string(), // abstract | session
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    trackId: v.optional(v.id("tracks")),
    format: v.optional(v.string()),
    level: v.optional(v.string()),
    language: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    speakerEmails: v.optional(
      v.array(
        v.object({
          email: v.string(),
          firstName: v.string(),
          lastName: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireEventAccess(ctx, args.eventId)
    if (!args.title.trim()) throw new ConvexError("Title is required.")
    const status = args.status ?? (args.kind === "session" ? "accepted" : "pending")
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      throw new ConvexError(`Invalid status: ${status}`)
    }

    // Manual entries are "submitted" by the organizer's person record.
    const organizerEmail = user.email
    const organizerName = user.name ?? user.email
    let submitter = await ctx.db
      .query("people")
      .withIndex("by_eventId_and_email", (q) =>
        q.eq("eventId", args.eventId).eq("email", organizerEmail),
      )
      .unique()
    if (!submitter) {
      const id = await ctx.db.insert("people", {
        eventId: args.eventId,
        email: organizerEmail,
        firstName: organizerName.split(" ")[0] ?? organizerName,
        lastName: organizerName.split(" ").slice(1).join(" "),
        portalToken: randomToken(),
      })
      submitter = await ctx.db.get(id)
    }
    if (!submitter) throw new Error("Failed to resolve submitter")

    const submissionId = await ctx.db.insert("submissions", {
      eventId: args.eventId,
      kind: args.kind === "session" ? "session" : "abstract",
      title: args.title.trim(),
      description: args.description,
      answers: {},
      trackId: args.trackId,
      format: args.format,
      level: args.level,
      language: args.language,
      tags: args.tags ?? [],
      status,
      submitterId: submitter._id,
    })

    for (const [index, s] of (args.speakerEmails ?? []).entries()) {
      const email = s.email.toLowerCase().trim()
      let person = await ctx.db
        .query("people")
        .withIndex("by_eventId_and_email", (q) =>
          q.eq("eventId", args.eventId).eq("email", email),
        )
        .unique()
      if (!person) {
        const id = await ctx.db.insert("people", {
          eventId: args.eventId,
          email,
          firstName: s.firstName,
          lastName: s.lastName,
          portalToken: randomToken(),
        })
        person = await ctx.db.get(id)
      }
      if (person) {
        await ctx.db.insert("submissionParticipants", {
          submissionId,
          eventId: args.eventId,
          personId: person._id,
          role: "speaker",
          order: index,
        })
      }
    }
    await scheduleAirtableSync(ctx, args.eventId)
    await emitWebhook(
      ctx,
      args.eventId,
      args.kind === "abstract" ? "submission.created" : "session.created",
      { id: submissionId, title: args.title.trim(), status, kind: args.kind },
    )
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: args.kind === "session" ? "session" : "submission",
      entityId: submissionId,
      action: "created",
      summary: `${args.kind === "session" ? "Session" : "Abstract"} added manually · ${args.title.trim()}`,
      meta: { status, kind: args.kind, title: args.title.trim() },
    })
    return submissionId
  },
})

/** Plain-English field names for the History tab (organizers read this). */
const DETAIL_FIELD_LABELS: Record<string, string> = {
  trackId: "track",
  durationMinutes: "duration",
  publicVisible: "public visibility",
  answers: "custom fields",
}

export const updateDetails = mutation({
  args: {
    submissionId: v.id("submissions"),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      trackId: v.optional(v.union(v.id("tracks"), v.null())),
      format: v.optional(v.string()),
      level: v.optional(v.string()),
      language: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      durationMinutes: v.optional(v.number()),
      // "Show on public schedule" (sbek CNT-12 — Sessionboard's "Display
      // Session" checkbox). `false` keeps an accepted session off every public
      // surface; it stays on the organizer's agenda and in the speaker portal.
      publicVisible: v.optional(v.boolean()),
      // Custom-field answers, keyed by form question id. MERGED into the
      // existing map rather than replacing it, so the drawer can autosave one
      // answer at a time without ever having to send the whole blob back.
      // Same values `PUT /v1/…/sessions/{id}/fields` writes.
      answers: v.optional(v.record(v.string(), v.any())),
    }),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await requireEventAccess(ctx, submission.eventId)
    await applyDetailUpdate(ctx, submission, args.patch)
    return null
  },
})

type DetailPatch = {
  title?: string
  description?: string
  trackId?: Id<"tracks"> | null
  format?: string
  level?: string
  language?: string
  tags?: string[]
  durationMinutes?: number
  publicVisible?: boolean
  answers?: Record<string, unknown>
}

/**
 * The edit itself, minus the authorization — shared by the organizer's own
 * mutation above and by the internal twin below, so an integration can never
 * reach past the domain logic with a raw patch and quietly skip the webhook,
 * the audit row or the version snapshot.
 */
async function applyDetailUpdate(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
  patch: DetailPatch,
  actor?: AuditActor,
): Promise<void> {
  const { trackId, answers, ...rest } = patch
  await ctx.db.patch(submission._id, {
    ...rest,
    ...(trackId !== undefined ? { trackId: trackId ?? undefined } : {}),
    ...(answers !== undefined
      ? { answers: { ...submission.answers, ...answers } }
      : {}),
    updatedAt: Date.now(),
  })
  await emitWebhook(
    ctx,
    submission.eventId,
    submission.kind === "abstract" ? "submission.updated" : "session.updated",
    { id: submission._id, title: rest.title ?? submission.title },
  )
  const changed = Object.keys(patch).filter(
    (key) => patch[key as keyof DetailPatch] !== undefined,
  )
  // Field names for everything — the History tab's job is "what was touched,
  // by whom". But when the edit rewrote the wording, the previous wording is
  // kept as a version row, because "Jordan changed the abstract" is only half
  // an answer when what you need is the paragraph back.
  const versionId = await snapshotWording(ctx, submission, patch)
  await recordAudit(ctx, {
    eventId: submission.eventId,
    entity: submission.kind === "session" ? "session" : "submission",
    entityId: submission._id,
    action: "updated",
    summary:
      changed.length > 0
        ? `Updated ${changed.map((key) => DETAIL_FIELD_LABELS[key] ?? key).join(", ")} · ${rest.title ?? submission.title}`
        : `Updated · ${submission.title}`,
    meta: {
      fields: changed,
      title: rest.title ?? submission.title,
      // Strings only. `clampMeta` JSON-stringifies anything nested and trims
      // it to 500 characters — which is exactly how the first attempt at
      // this shipped a Restore button that could never restore anything.
      ...(versionId ? { versionId, previousTitle: submission.title } : {}),
    },
    actor,
  })
}

/**
 * Same semantics for callers that have already authorized the change and carry
 * their own attribution — today that is the Airtable pull-back
 * (convex/airtable.ts). Deliberately narrower than the organizer's mutation:
 * only the fields the inbound registry can write are accepted, so widening
 * write-back stays a decision made in one place.
 */
export const updateDetailsInternal = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      trackId: v.optional(v.union(v.id("tracks"), v.null())),
      format: v.optional(v.string()),
      level: v.optional(v.string()),
      language: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
    actorType: v.string(),
    actorLabel: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await applyDetailUpdate(ctx, submission, args.patch, {
      type: args.actorType as AuditActor["type"],
      label: args.actorLabel,
    })
    return null
  },
})

/** How many previous wordings we keep per submission before dropping the oldest. */
const MAX_VERSIONS_PER_SUBMISSION = 50

/**
 * Keep the wording this patch is about to overwrite, and return the row's id —
 * or `null` when the edit didn't touch the title or the description, so
 * ordinary field changes stay cheap and the History row offers no restore it
 * couldn't honour.
 */
async function snapshotWording(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
  patch: { title?: string; description?: string },
): Promise<Id<"submissionVersions"> | null> {
  const titleChanged =
    patch.title !== undefined && patch.title !== submission.title
  const descriptionChanged =
    patch.description !== undefined &&
    patch.description !== (submission.description ?? "")
  if (!titleChanged && !descriptionChanged) return null

  const versionId = await ctx.db.insert("submissionVersions", {
    eventId: submission.eventId,
    submissionId: submission._id,
    title: submission.title,
    description: submission.description ?? "",
  })

  // History is worth keeping, not hoarding: a heavily-edited abstract would
  // otherwise grow a row per keystroke-batch forever.
  const all = await ctx.db
    .query("submissionVersions")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
    .collect()
  if (all.length > MAX_VERSIONS_PER_SUBMISSION) {
    const oldest = all
      .sort((a, b) => a._creationTime - b._creationTime)
      .slice(0, all.length - MAX_VERSIONS_PER_SUBMISSION)
    for (const row of oldest) await ctx.db.delete("submissionVersions", row._id)
  }
  return versionId
}

/**
 * Put a previous wording back (sbek CNT-11).
 *
 * Restoring is itself an edit, not a rewind: it writes forward and snapshots
 * what it replaced, so the version you just overwrote becomes restorable in
 * turn and the history never loses the fact that somebody undid something.
 */
export const restoreFromHistory = mutation({
  args: {
    submissionId: v.id("submissions"),
    versionId: v.id("submissionVersions"),
  },
  returns: v.object({ restored: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await requireEventAccess(ctx, submission.eventId)

    const version = await ctx.db.get(args.versionId)
    // The version has to belong to this record, or a caller could read any
    // submission's old text by guessing an id.
    if (!version || version.submissionId !== args.submissionId) {
      throw new ConvexError("That version doesn't belong to this record")
    }

    const patch: { title?: string; description?: string } = {}
    if (version.title !== submission.title) patch.title = version.title
    if (version.description !== (submission.description ?? "")) {
      patch.description = version.description
    }
    const restored = Object.keys(patch)
    if (restored.length === 0) {
      throw new ConvexError("That version is already the current one")
    }

    const replacedId = await snapshotWording(ctx, submission, patch)
    await ctx.db.patch(args.submissionId, { ...patch, updatedAt: Date.now() })
    await emitWebhook(
      ctx,
      submission.eventId,
      submission.kind === "abstract" ? "submission.updated" : "session.updated",
      { id: args.submissionId, title: patch.title ?? submission.title },
    )
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: submission.kind === "session" ? "session" : "submission",
      entityId: args.submissionId,
      action: "restored",
      summary: `Restored the earlier ${restored
        .map((key) => DETAIL_FIELD_LABELS[key] ?? key)
        .join(" and ")} · ${patch.title ?? submission.title}`,
      meta: {
        fields: restored,
        title: patch.title ?? submission.title,
        ...(replacedId
          ? { versionId: replacedId, previousTitle: submission.title }
          : {}),
      },
    })
    return { restored }
  },
})

/**
 * Soft delete — the organizer-side twin of `DELETE /v1/…/sessions/{id}`
 * (convex/apiV1.ts `deleteSession`). Same rule, same effect: stamp
 * `deletedAt`, and the row leaves every organizer listing, the agenda, the
 * speaker portal and the public programme, while everything hanging off it
 * (reviews, files, participants, history) is left untouched so a mis-click is
 * undoable via `restore`. Admin-only, exactly like the API path.
 */
export const remove = mutation({
  args: { submissionId: v.id("submissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await requireEventAccess(ctx, submission.eventId, "admin")
    if (submission.deletedAt !== undefined) return null

    await ctx.db.patch(args.submissionId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    })
    await scheduleAirtableSync(ctx, submission.eventId)
    await emitWebhook(ctx, submission.eventId, "session.deleted", {
      id: args.submissionId,
      title: submission.title,
      status: submission.status,
      kind: submission.kind,
    })
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: submission.kind === "session" ? "session" : "submission",
      entityId: args.submissionId,
      action: "deleted",
      summary: `${submission.kind === "session" ? "Session" : "Abstract"} deleted · ${submission.title}`,
      meta: { status: submission.status, title: submission.title },
    })
    return null
  },
})

/** Undo a soft delete — `POST /v1/…/sessions/{id}/restore` from the UI. */
export const restore = mutation({
  args: { submissionId: v.id("submissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new ConvexError("Submission not found")
    await requireEventAccess(ctx, submission.eventId, "admin")
    if (submission.deletedAt === undefined) return null

    await ctx.db.patch(args.submissionId, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    })
    await scheduleAirtableSync(ctx, submission.eventId)
    await emitWebhook(ctx, submission.eventId, "session.restored", {
      id: args.submissionId,
      title: submission.title,
      status: submission.status,
      kind: submission.kind,
    })
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: submission.kind === "session" ? "session" : "submission",
      entityId: args.submissionId,
      action: "restored",
      summary: `${submission.kind === "session" ? "Session" : "Abstract"} restored · ${submission.title}`,
      meta: { status: submission.status, title: submission.title },
    })
    return null
  },
})

/** The trash: everything soft-deleted on this event, newest deletion first. */
export const listDeleted = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    const deleted = rows
      .filter((s) => s.deletedAt !== undefined)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    return await Promise.all(deleted.map((s) => withJoins(ctx, s)))
  },
})

// CSV export data (client turns this into a file).
export const exportData = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return await Promise.all(
      rows.filter((s) => s.deletedAt === undefined).map((s) => withJoins(ctx, s)),
    )
  },
})

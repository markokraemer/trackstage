import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { randomToken, requireEventAccess } from "./lib/auth"

export const STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
] as const

async function withJoins(ctx: QueryCtx, submission: Doc<"submissions">) {
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

    let filtered = rows
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
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    const result: Record<string, number> = { all: rows.length }
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
    if (!submission) throw new Error("Submission not found")
    await requireEventAccess(ctx, submission.eventId)
    const joined = await withJoins(ctx, submission)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .collect()
    const uploadsWithUrls = await Promise.all(
      uploads.map(async (u) => ({
        ...u,
        url: await ctx.storage.getUrl(u.storageId),
      })),
    )
    return { ...joined, uploads: uploadsWithUrls }
  },
})

// Inline status change from the table (staging — no emails fired here).
export const setStatus = mutation({
  args: {
    submissionId: v.id("submissions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (!STATUSES.includes(args.status as (typeof STATUSES)[number])) {
      throw new Error(`Invalid status: ${args.status}`)
    }
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Submission not found")
    await requireEventAccess(ctx, submission.eventId)
    await ctx.db.patch(args.submissionId, { status: args.status })
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
      throw new Error(`Invalid status: ${args.status}`)
    }
    // Every id is authorized on its own event — a bulk call can never straddle
    // an event the caller has no access to.
    for (const id of args.submissionIds) {
      const submission = await ctx.db.get(id)
      if (!submission) continue
      await requireEventAccess(ctx, submission.eventId)
      await ctx.db.patch(id, { status: args.status })
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
      throw new Error("queue must be accept_queue or decline_queue")
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
    }
    return { committed: staged.length, notified }
  },
})

async function ensureOnboardingTasks(
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
    const completedByProfile =
      (task.kind === "headshot" && person?.headshotId) ||
      (task.kind === "profile" && person?.bio)
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
    if (!args.title.trim()) throw new Error("Title is required.")
    const status = args.status ?? (args.kind === "session" ? "accepted" : "pending")
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      throw new Error(`Invalid status: ${status}`)
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
    return submissionId
  },
})

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
    }),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Submission not found")
    await requireEventAccess(ctx, submission.eventId)
    const { trackId, ...rest } = args.patch
    await ctx.db.patch(args.submissionId, {
      ...rest,
      ...(trackId !== undefined ? { trackId: trackId ?? undefined } : {}),
    })
    return null
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
    return await Promise.all(rows.map((s) => withJoins(ctx, s)))
  },
})

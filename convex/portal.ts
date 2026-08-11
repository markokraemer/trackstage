import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requirePerson } from "./lib/auth"
import {
  assertAllowedUpload,
  enrichUploads,
  nextVersion,
  replaceHeadshot,
  storageMeta,
} from "./lib/files"
import { notifySubmissionAdmins } from "./platformEmails"

// ————————————————————————————————————————————————————————————————————————
// Speaker portal. All functions authenticate with the person's portalToken
// (magic link) — no passwords. Scoping: a person only ever sees their own
// event's data and their own submissions/tasks/files.
// ————————————————————————————————————————————————————————————————————————

async function submissionSummary(ctx: QueryCtx, s: Doc<"submissions">) {
  const track = s.trackId ? await ctx.db.get(s.trackId) : null
  const room = s.roomId ? await ctx.db.get(s.roomId) : null
  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", s._id))
    .collect()
  const people = await Promise.all(
    participants
      .sort((a, b) => a.order - b.order)
      .map(async (p) => {
        const person = await ctx.db.get(p.personId)
        return person
          ? {
              name: `${person.firstName} ${person.lastName}`.trim() || person.email,
              role: p.role,
              company: person.company,
            }
          : null
      }),
  )
  return {
    id: s._id,
    title: s.title,
    description: s.description,
    status: s.status,
    kind: s.kind,
    format: s.format,
    level: s.level,
    language: s.language,
    tags: s.tags,
    answers: s.answers,
    track: track ? { name: track.name, color: track.color } : null,
    scheduled:
      s.startsAt !== undefined
        ? { startsAt: s.startsAt, durationMinutes: s.durationMinutes ?? 45, room: room?.name }
        : null,
    participants: people.filter((p) => p !== null),
  }
}

export const home = query({
  args: { portalToken: v.string() },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const event = await ctx.db.get(person.eventId)
    if (!event) throw new Error("Event not found")

    // Submissions where I'm the submitter OR a participant.
    const asSubmitter = await ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", person._id))
      .collect()
    const asParticipant = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .collect()
    const participantSubs = (
      await Promise.all(asParticipant.map((p) => ctx.db.get(p.submissionId)))
    ).filter((s): s is Doc<"submissions"> => s !== null)
    const map = new Map<string, Doc<"submissions">>()
    for (const s of [...asSubmitter, ...participantSubs]) map.set(s._id, s)
    const submissions = await Promise.all(
      [...map.values()]
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((s) => submissionSummary(ctx, s)),
    )

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .collect()

    const headshotUrl = person.headshotId
      ? await ctx.storage.getUrl(person.headshotId)
      : null

    return {
      event: {
        name: event.name,
        slug: event.slug,
        venue: event.venue,
        timezone: event.timezone,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        // The speaker should see the event's own branding, not ours.
        logoUrl: event.logoId ? await ctx.storage.getUrl(event.logoId) : null,
      },
      me: {
        id: person._id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        salutation: person.salutation,
        pronouns: person.pronouns,
        jobTitle: person.jobTitle,
        company: person.company,
        phone: person.phone,
        bio: person.bio,
        links: person.links,
        headshotUrl,
      },
      submissions,
      tasks: tasks
        .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
        .map((t) => ({
          id: t._id,
          title: t.title,
          instructions: t.instructions,
          kind: t.kind,
          dueAt: t.dueAt,
          completedAt: t.completedAt,
        })),
    }
  },
})

export const updateProfile = mutation({
  args: {
    portalToken: v.string(),
    patch: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      salutation: v.optional(v.string()),
      pronouns: v.optional(v.string()),
      jobTitle: v.optional(v.string()),
      company: v.optional(v.string()),
      phone: v.optional(v.string()),
      bio: v.optional(v.string()),
      links: v.optional(
        v.object({
          linkedin: v.optional(v.string()),
          twitter: v.optional(v.string()),
          website: v.optional(v.string()),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    await ctx.db.patch(person._id, args.patch)

    // Completing profile data auto-completes matching tasks.
    const updated = await ctx.db.get(person._id)
    if (updated?.bio && updated.bio.trim().length > 0) {
      await completeTasksOfKind(ctx, person._id, "profile")
    }
    return null
  },
})

async function completeTasksOfKind(
  ctx: MutationCtx,
  personId: Id<"people">,
  kind: string,
) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_personId", (q) => q.eq("personId", personId))
    .collect()
  for (const task of tasks) {
    if (task.kind === kind && !task.completedAt) {
      await ctx.db.patch(task._id, { completedAt: Date.now() })
    }
  }
}

// Speakers may edit their submissions — including after acceptance (swyx
// clarified locking is unused). Editing a draft keeps it draft; editing a
// submitted one keeps its status.
export const updateSubmission = mutation({
  args: {
    portalToken: v.string(),
    submissionId: v.id("submissions"),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      answers: v.optional(v.record(v.string(), v.any())),
    }),
  },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Submission not found")
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", args.submissionId))
      .collect()
    const isMine =
      submission.submitterId === person._id ||
      participants.some((p) => p.personId === person._id)
    if (!isMine) throw new Error("You don't have access to this submission.")
    if (["declined", "withdrawn"].includes(submission.status)) {
      throw new Error("This submission can no longer be edited.")
    }
    const { title, description, answers } = args.patch
    await ctx.db.patch(args.submissionId, {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(answers !== undefined ? { answers } : {}),
    })
    // Tell the form's notify list a speaker changed something under review.
    // Fire-and-forget: a mail problem must never fail the speaker's edit.
    try {
      await notifySubmissionAdmins(ctx, {
        submissionId: args.submissionId,
        kind: "updated",
        submitterName:
          `${person.firstName} ${person.lastName}`.trim() || person.email,
      })
    } catch (error) {
      console.error("submission notification could not be scheduled", error)
    }
    return null
  },
})

export const withdrawSubmission = mutation({
  args: { portalToken: v.string(), submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const submission = await ctx.db.get(args.submissionId)
    if (!submission || submission.submitterId !== person._id) {
      throw new Error("Submission not found.")
    }
    if (submission.status === "accepted") {
      throw new Error(
        "This submission was already accepted — contact the organizers to withdraw.",
      )
    }
    await ctx.db.patch(args.submissionId, { status: "withdrawn" })
    return null
  },
})

export const completeTask = mutation({
  args: { portalToken: v.string(), taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const task = await ctx.db.get(args.taskId)
    if (!task || task.personId !== person._id) throw new Error("Task not found.")
    if (!["confirm", "profile"].includes(task.kind)) {
      throw new Error("Complete this task by uploading the requested file.")
    }
    await ctx.db.patch(args.taskId, { completedAt: Date.now() })
    return null
  },
})

// ——— File uploads (headshot, slides, docs) with versioning ————————————————

export const generateUploadUrl = mutation({
  args: { portalToken: v.string() },
  handler: async (ctx, args) => {
    await requirePerson(ctx, args.portalToken)
    return await ctx.storage.generateUploadUrl()
  },
})

export const attachUpload = mutation({
  args: {
    portalToken: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    // Accepted for compatibility but NOT trusted: size and type are read back
    // from the `_storage` system table, so a hand-rolled client can't claim a
    // 200 MB deck is 2 KB.
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    taskId: v.optional(v.id("tasks")),
    submissionId: v.optional(v.id("submissions")),
    isHeadshot: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)

    const meta = await storageMeta(ctx, args.storageId)
    if (!meta) {
      throw new Error("That upload didn't finish — please try again.")
    }
    assertAllowedUpload(meta, args.filename)

    if (args.isHeadshot) {
      // Replaces the photo AND deletes the one it replaces (convex/lib/files).
      await replaceHeadshot(ctx, person, args.storageId)
      await completeTasksOfKind(ctx, person._id, "headshot")
    }

    // Versioning: next version within the same slot (task or submission).
    const version = await nextVersion(ctx, {
      personId: person._id,
      taskId: args.taskId,
      submissionId: args.submissionId,
    })
    const uploadId = await ctx.db.insert("uploads", {
      eventId: person.eventId,
      personId: person._id,
      submissionId: args.submissionId,
      taskId: args.taskId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: meta.contentType ?? args.contentType,
      size: meta.size,
      version,
      approvalStatus: "pending",
    })

    if (args.taskId) {
      const task = await ctx.db.get(args.taskId)
      if (task && task.personId === person._id && !task.completedAt) {
        await ctx.db.patch(args.taskId, { completedAt: Date.now() })
      }
    }
    return uploadId
  },
})

export const myUploads = query({
  args: { portalToken: v.string() },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .collect()
    // Size, type and the "identical to v2" hint all come from `_storage`.
    return await enrichUploads(
      ctx,
      uploads.sort((a, b) => b._creationTime - a._creationTime),
    )
  },
})

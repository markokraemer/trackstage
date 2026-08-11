import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { enrichUploads } from "./lib/files"

// Organizer-side task management (create/assign onboarding + file-request
// tasks) and content review (approve / request changes on uploads).

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return await Promise.all(
      tasks
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (task) => {
          const person = await ctx.db.get(task.personId)
          return {
            id: task._id,
            title: task.title,
            instructions: task.instructions,
            kind: task.kind,
            dueAt: task.dueAt,
            completedAt: task.completedAt,
            person: person
              ? {
                  id: person._id,
                  name:
                    `${person.firstName} ${person.lastName}`.trim() ||
                    person.email,
                  email: person.email,
                }
              : null,
          }
        }),
    )
  },
})

export const create = mutation({
  args: {
    eventId: v.id("events"),
    personIds: v.array(v.id("people")),
    title: v.string(),
    instructions: v.optional(v.string()),
    kind: v.string(), // profile | headshot | upload | form | confirm
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    if (!args.title.trim()) throw new Error("Task title is required.")
    if (!["profile", "headshot", "upload", "form", "confirm"].includes(args.kind)) {
      throw new Error("Invalid task kind.")
    }
    if (args.personIds.length === 0) {
      throw new Error("Assign the task to at least one speaker.")
    }
    let created = 0
    for (const personId of args.personIds) {
      const person = await ctx.db.get(personId)
      if (!person || person.eventId !== args.eventId) continue
      await ctx.db.insert("tasks", {
        eventId: args.eventId,
        personId,
        title: args.title.trim(),
        instructions: args.instructions,
        kind: args.kind,
        dueAt: args.dueAt,
      })
      created++
    }
    return { created }
  },
})

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    patch: v.object({
      title: v.optional(v.string()),
      instructions: v.optional(v.string()),
      dueAt: v.optional(v.union(v.number(), v.null())),
      completedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error("Task not found.")
    await requireEventAccess(ctx, task.eventId)
    const { dueAt, completedAt, ...rest } = args.patch
    await ctx.db.patch(args.taskId, {
      ...rest,
      ...(dueAt !== undefined ? { dueAt: dueAt ?? undefined } : {}),
      ...(completedAt !== undefined
        ? { completedAt: completedAt ?? undefined }
        : {}),
    })
    return null
  },
})

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) throw new Error("Task not found.")
    await requireEventAccess(ctx, task.eventId, "admin")
    await ctx.db.delete(args.taskId)
    return null
  },
})

// ——— Content review: uploaded files across the event ————————————————————

export const listUploads = query({
  args: {
    eventId: v.id("events"),
    approvalStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    let uploads = await ctx.db
      .query("uploads")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    if (args.approvalStatus) {
      uploads = uploads.filter((u) => u.approvalStatus === args.approvalStatus)
    }
    const rows = uploads.sort((a, b) => b._creationTime - a._creationTime)
    // Real size/type/checksum from the `_storage` system table — plus the
    // "identical to v2" hint, so nobody re-reviews the same bytes twice.
    const files = await enrichUploads(ctx, rows)
    return await Promise.all(
      files.map(async (file, index) => {
        const row = rows[index]
        const [person, submission] = await Promise.all([
          ctx.db.get(row.personId),
          row.submissionId ? ctx.db.get(row.submissionId) : null,
        ])
        return {
          ...file,
          person: person
            ? {
                id: person._id,
                name:
                  `${person.firstName} ${person.lastName}`.trim() ||
                  person.email,
              }
            : null,
          submissionTitle: submission?.title,
        }
      }),
    )
  },
})

// Approval gates what appears publicly (e.g. slides links on the public
// session page) — a rule the eval kit explicitly probes.
export const reviewUpload = mutation({
  args: {
    uploadId: v.id("uploads"),
    approvalStatus: v.string(), // approved | changes_requested | pending
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!["approved", "changes_requested", "pending"].includes(args.approvalStatus)) {
      throw new Error("Invalid approval status.")
    }
    const upload = await ctx.db.get(args.uploadId)
    if (!upload) throw new Error("Upload not found.")
    await requireEventAccess(ctx, upload.eventId)
    await ctx.db.patch(args.uploadId, {
      approvalStatus: args.approvalStatus,
      reviewNote: args.reviewNote,
    })
    // Requesting changes reopens the task so the speaker sees it again.
    if (args.approvalStatus === "changes_requested" && upload.taskId) {
      await ctx.db.patch(upload.taskId, { completedAt: undefined })
    }
    return null
  },
})

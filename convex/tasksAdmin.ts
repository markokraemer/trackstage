import { ConvexError, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { enrichUploads } from "./lib/files"
import { personProfileComplete } from "./lib/profileTasks"
import { makeTaskVarsCache, renderTaskText } from "./lib/taskVars"
import { addComment, threadFor } from "./lib/uploadComments"

// Organizer-side task management (create/assign onboarding + file-request
// tasks), the reusable task library, and content review (approve / request
// changes on uploads, plus the per-file comment thread).

// How a task gets ticked off. `answer` is the "Collect an answer" kind: the
// organizer writes a question in the instructions and the speaker types a
// reply in their portal — the reply IS the completion, and it is stored on the
// task so the organizer reads it where they read the task. It replaces the old
// `form` kind, which nothing in the portal ever rendered.
export const TASK_KINDS = ["profile", "headshot", "upload", "answer", "confirm"]

function assertKind(kind: string) {
  if (!TASK_KINDS.includes(kind)) {
    throw new ConvexError(
      `"${kind}" isn't a task type. Pick one of: ${TASK_KINDS.join(", ")}.`,
    )
  }
}

export const list = query({
  args: {
    eventId: v.id("events"),
    /** One speaker's tasks — the Tasks section of their profile drawer. */
    personId: v.optional(v.id("people")),
  },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const personId = args.personId
    const tasks = personId
      ? (
          await ctx.db
            .query("tasks")
            .withIndex("by_personId", (q) => q.eq("personId", personId))
            .collect()
        ).filter((task) => task.eventId === args.eventId)
      : await ctx.db
          .query("tasks")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .collect()
    // {{firstName}} / {{sessionTitle}} resolve per speaker, so the organizer's
    // list shows exactly the words that speaker reads in their portal.
    const varsFor = makeTaskVarsCache(ctx, event.name)
    return await Promise.all(
      tasks
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (task) => {
          const person = await ctx.db.get(task.personId)
          const vars = person ? await varsFor(person) : null
          return {
            id: task._id,
            title: vars ? renderTaskText(task.title, vars) : task.title,
            instructions: vars
              ? renderTaskText(task.instructions, vars)
              : task.instructions,
            /** The unresolved text, for editing. */
            instructionsTemplate: task.instructions,
            kind: task.kind,
            /** `answer` tasks: what the speaker typed back, once they have. */
            response: task.response,
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

async function insertTasks(
  ctx: MutationCtx,
  args: {
    eventId: Id<"events">
    personIds: Array<Id<"people">>
    title: string
    instructions?: string
    kind: string
    dueAt?: number
    /** Bind the task (and everything uploaded into it) to one session. */
    submissionId?: Id<"submissions">
  },
): Promise<number> {
  // A task can only point at a session of this event — otherwise a stale id
  // from a switched event would file uploads under someone else's programme.
  let submissionId: Id<"submissions"> | undefined
  if (args.submissionId) {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission || submission.eventId !== args.eventId) {
      throw new ConvexError("That session doesn't belong to this event.")
    }
    submissionId = submission._id
  }
  let created = 0
  for (const personId of args.personIds) {
    const person = await ctx.db.get(personId)
    if (!person || person.eventId !== args.eventId) continue
    // A "profile" task handed to a speaker whose profile is ALREADY complete
    // is born done. Otherwise it sits open forever: nothing the speaker can do
    // in their portal would change the profile, so the auto-tick never fires
    // and the organizer chases someone who has nothing left to give
    // (adversarial-review F10). Only `profile` — a headshot or upload task is
    // a request for a NEW file, and "send us a better photo" is a fair thing
    // to ask someone who already has one. convex/lib/profileTasks.ts.
    const bornDone =
      args.kind === "profile" && personProfileComplete(person)
        ? Date.now()
        : undefined
    await ctx.db.insert("tasks", {
      eventId: args.eventId,
      personId,
      title: args.title,
      instructions: args.instructions,
      kind: args.kind,
      submissionId,
      dueAt: args.dueAt,
      completedAt: bornDone,
    })
    created++
  }
  return created
}

export const create = mutation({
  args: {
    eventId: v.id("events"),
    personIds: v.array(v.id("people")),
    title: v.string(),
    instructions: v.optional(v.string()),
    kind: v.string(), // profile | headshot | upload | answer | confirm
    dueAt: v.optional(v.number()),
    /** Optional: the session this task is about (files land on its Files tab). */
    submissionId: v.optional(v.id("submissions")),
    /** Also keep this wording in the event's task library for next time. */
    saveAsTemplate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const title = args.title.trim()
    if (!title) throw new ConvexError("Task title is required.")
    assertKind(args.kind)
    if (args.personIds.length === 0) {
      throw new ConvexError("Assign the task to at least one speaker.")
    }
    const instructions = args.instructions?.trim() || undefined
    const created = await insertTasks(ctx, {
      eventId: args.eventId,
      personIds: args.personIds,
      title,
      instructions,
      kind: args.kind,
      dueAt: args.dueAt,
      submissionId: args.submissionId,
    })

    // Saving to the library is idempotent on the title: ticking the box twice
    // updates the wording instead of piling up near-duplicates.
    let templateId: Id<"taskTemplates"> | null = null
    if (args.saveAsTemplate) {
      const existing = await ctx.db
        .query("taskTemplates")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect()
      const match = existing.find(
        (t) => t.title.toLowerCase() === title.toLowerCase(),
      )
      if (match) {
        await ctx.db.patch(match._id, { instructions, kind: args.kind })
        templateId = match._id
      } else {
        templateId = await ctx.db.insert("taskTemplates", {
          eventId: args.eventId,
          title,
          instructions,
          kind: args.kind,
        })
      }
    }
    return { created, templateId }
  },
})

// ——— Reusable task library (product-map delta #10) ————————————————————————

export const listTemplates = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const templates = await ctx.db
      .query("taskTemplates")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return templates
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((t) => ({
        id: t._id,
        title: t.title,
        instructions: t.instructions,
        kind: t.kind,
        alias: t.alias,
      }))
  },
})

export const createTemplate = mutation({
  args: {
    eventId: v.id("events"),
    title: v.string(),
    instructions: v.optional(v.string()),
    kind: v.string(),
    alias: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const title = args.title.trim()
    if (!title) throw new ConvexError("Give the task a name.")
    assertKind(args.kind)
    return await ctx.db.insert("taskTemplates", {
      eventId: args.eventId,
      title,
      instructions: args.instructions?.trim() || undefined,
      kind: args.kind,
      alias: args.alias?.trim() || undefined,
    })
  },
})

export const updateTemplate = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    patch: v.object({
      title: v.optional(v.string()),
      instructions: v.optional(v.union(v.string(), v.null())),
      kind: v.optional(v.string()),
      alias: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId)
    if (!template) throw new ConvexError("Task template not found.")
    await requireEventAccess(ctx, template.eventId)
    const { title, instructions, kind, alias } = args.patch
    if (kind !== undefined) assertKind(kind)
    if (title !== undefined && !title.trim()) {
      throw new ConvexError("Give the task a name.")
    }
    await ctx.db.patch(args.templateId, {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(instructions !== undefined
        ? { instructions: instructions?.trim() || undefined }
        : {}),
      ...(alias !== undefined ? { alias: alias?.trim() || undefined } : {}),
    })
    return null
  },
})

export const removeTemplate = mutation({
  args: { templateId: v.id("taskTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId)
    if (!template) throw new ConvexError("Task template not found.")
    await requireEventAccess(ctx, template.eventId)
    await ctx.db.delete(args.templateId)
    return null
  },
})

/**
 * Assign a library task to speakers without retyping it. The template's own
 * wording (placeholders and all) is copied onto each task, so editing the
 * library later never rewrites tasks already out in the world.
 */
export const assignFromTemplate = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    personIds: v.array(v.id("people")),
    dueAt: v.optional(v.number()),
    /** Optional: the session this task is about. */
    submissionId: v.optional(v.id("submissions")),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId)
    if (!template) throw new ConvexError("Task template not found.")
    await requireEventAccess(ctx, template.eventId)
    if (args.personIds.length === 0) {
      throw new ConvexError("Assign the task to at least one speaker.")
    }
    const created = await insertTasks(ctx, {
      eventId: template.eventId,
      personIds: args.personIds,
      title: template.alias?.trim() || template.title,
      instructions: template.instructions,
      kind: template.kind,
      dueAt: args.dueAt,
      submissionId: args.submissionId,
    })
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
    if (!task) throw new ConvexError("Task not found.")
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
    if (!task) throw new ConvexError("Task not found.")
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
    /** Only this speaker's files — the Files section of their profile drawer. */
    personId: v.optional(v.id("people")),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const personId = args.personId
    let uploads = personId
      ? (
          await ctx.db
            .query("uploads")
            .withIndex("by_personId", (q) => q.eq("personId", personId))
            .collect()
        ).filter((u) => u.eventId === args.eventId)
      : await ctx.db
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
        const [person, task, comments] = await Promise.all([
          ctx.db.get(row.personId),
          row.taskId ? ctx.db.get(row.taskId) : null,
          threadFor(ctx, row._id),
        ])
        // A file belongs to a session either directly, or through the task it
        // was uploaded into ("Upload the slides for THIS talk").
        const submissionId = row.submissionId ?? task?.submissionId
        const submission = submissionId ? await ctx.db.get(submissionId) : null
        return {
          ...file,
          person: person
            ? {
                id: person._id,
                name:
                  `${person.firstName} ${person.lastName}`.trim() ||
                  person.email,
                email: person.email,
              }
            : null,
          submissionId: submission?._id,
          submissionTitle: submission?.title,
          // What the speaker was asked to do, so the library can be filtered
          // down to "everything that came in against a slides request".
          task: task
            ? { id: task._id, title: task.title, kind: task.kind }
            : null,
          // The files library's `Comments` / `Last Comment At` columns.
          commentCount: comments.length,
          lastCommentAt:
            comments.length > 0
              ? comments[comments.length - 1].createdAt
              : undefined,
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
      throw new ConvexError("Invalid approval status.")
    }
    const upload = await ctx.db.get(args.uploadId)
    if (!upload) throw new ConvexError("Upload not found.")
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

// ——— File comments (sbek CNT-05) ————————————————————————————————————————
// One thread per file, visible to the organizer AND the speaker who owns it.
// Nothing is emailed in v1 — the thread lives where the file lives.

export const listUploadComments = query({
  args: { uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId)
    if (!upload) throw new ConvexError("File not found.")
    await requireEventAccess(ctx, upload.eventId)
    return await threadFor(ctx, args.uploadId)
  },
})

export const addUploadComment = mutation({
  args: { uploadId: v.id("uploads"), body: v.string() },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.uploadId)
    if (!upload) throw new ConvexError("File not found.")
    const { user } = await requireEventAccess(ctx, upload.eventId)
    return await addComment(ctx, {
      uploadId: args.uploadId,
      eventId: upload.eventId,
      authorType: "organizer",
      authorLabel: user.name?.trim() || user.email,
      body: args.body,
    })
  },
})

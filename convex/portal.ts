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
import { record as recordAudit } from "./lib/audit"
import {
  buildTaskVars,
  pickPrimarySubmission,
  renderTaskText,
} from "./lib/taskVars"
import { addComment, threadFor } from "./lib/uploadComments"
import { notifySubmissionAdmins } from "./platformEmails"

// ————————————————————————————————————————————————————————————————————————
// Speaker portal. All functions authenticate with the person's portalToken
// (magic link) — no passwords. Scoping: a person only ever sees their own
// event's data and their own submissions/tasks/files.
// ————————————————————————————————————————————————————————————————————————

// ——— Portal behaviour (Settings → Event → Speaker portal) ————————————————
// The organizer's three switches, resolved once per call. Everything unset
// resolves to the permissive value: an event that never opens that card keeps
// the portal it already had, and each switch is an opt-in restriction rather
// than a surprise. Product map delta #6 (§2.5 "Configuration").

interface PortalBehavior {
  alwaysShowTasks: boolean
  allowSubmissionEdits: boolean
  extendTaskDeadlines: boolean
}

function portalBehavior(event: Doc<"events"> | null): PortalBehavior {
  const settings = event?.portalSettings
  return {
    alwaysShowTasks: settings?.alwaysShowTasks ?? true,
    allowSubmissionEdits: settings?.allowSubmissionEdits ?? true,
    extendTaskDeadlines: settings?.extendTaskDeadlines ?? true,
  }
}

/**
 * A task the speaker can no longer act on: past its due date, not yet done,
 * and the organizer has NOT left the late door open. Locked tasks stay
 * visible — a speaker needs to see what they missed — but the portal shows
 * them as "closed" and the mutations refuse to complete them.
 */
function isTaskLocked(task: Doc<"tasks">, behavior: PortalBehavior): boolean {
  if (behavior.extendTaskDeadlines) return false
  if (task.completedAt) return false
  return task.dueAt !== undefined && task.dueAt < Date.now()
}

const TASK_LOCKED_MESSAGE =
  "The deadline for this task has passed, so it's closed. Email the organizers and they can reopen it for you."

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
    for (const s of [...asSubmitter, ...participantSubs]) {
      // A submission the organizer deleted disappears from the portal too.
      if (s.deletedAt !== undefined) continue
      map.set(s._id, s)
    }
    const submissions = await Promise.all(
      [...map.values()]
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((s) => submissionSummary(ctx, s)),
    )

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .collect()

    // "Always show tasks" off ⇒ the checklist only opens once a session of
    // theirs is accepted, so a portal shared with every submitter doesn't ask
    // people who haven't been accepted yet for slides and headshots.
    const behavior = portalBehavior(event)
    const hasAcceptedSession = [...map.values()].some(
      (s) => s.status === "accepted",
    )
    const tasksVisible = behavior.alwaysShowTasks || hasAcceptedSession

    // Personalisation source for the task text: their accepted session if they
    // have one, otherwise their newest submission.
    const taskVars = buildTaskVars(
      person,
      event.name,
      pickPrimarySubmission([...map.values()]),
    )

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
      // What the organizer's Speaker portal card allows, so the portal shows
      // the same rules the mutations enforce instead of failing on save.
      portal: {
        ...behavior,
        tasksVisible,
      },
      tasks: tasksVisible
        ? tasks
            .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
            .map((t) => ({
              id: t._id,
              // {{firstName}} / {{sessionTitle}} become this speaker's own
              // words here, at read time — one library task, personal wording.
              title: renderTaskText(t.title, taskVars) ?? t.title,
              instructions: renderTaskText(t.instructions, taskVars),
              kind: t.kind,
              dueAt: t.dueAt,
              completedAt: t.completedAt,
              locked: isTaskLocked(t, behavior),
            }))
        : [],
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
    // The organizer can turn portal editing off for the whole event
    // (Settings → Event → Speaker portal). Say who to ask instead.
    const behavior = portalBehavior(await ctx.db.get(submission.eventId))
    if (!behavior.allowSubmissionEdits) {
      throw new Error(
        "The organizers have turned off editing submissions from the portal. Email them with what you'd like changed and they'll update it for you.",
      )
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
    // Attributed to the SPEAKER, not the organizer looking at the drawer —
    // "who changed this abstract under review" is the question the History
    // tab exists to answer.
    const changed = Object.keys(args.patch)
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: submission.kind === "session" ? "session" : "submission",
      entityId: args.submissionId,
      action: "updated",
      summary: `Speaker edited ${changed.join(", ")} · ${title ?? submission.title}`,
      meta: { fields: changed, title: title ?? submission.title },
      actor: {
        type: "speaker",
        label:
          `${person.firstName} ${person.lastName}`.trim() || person.email,
      },
    })
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
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: submission.kind === "session" ? "session" : "submission",
      entityId: args.submissionId,
      action: "status_changed",
      summary: `Withdrawn by the speaker · ${submission.title}`,
      meta: { from: submission.status, to: "withdrawn", title: submission.title },
      actor: {
        type: "speaker",
        label:
          `${person.firstName} ${person.lastName}`.trim() || person.email,
      },
    })
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
    // "Extend task deadlines" off ⇒ a past-due task is closed for good.
    const behavior = portalBehavior(await ctx.db.get(task.eventId))
    if (isTaskLocked(task, behavior)) throw new Error(TASK_LOCKED_MESSAGE)
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

    // A closed task can't be completed by uploading into it either — check
    // before anything is written, so a locked task never gains a file.
    if (args.taskId) {
      const target = await ctx.db.get(args.taskId)
      if (target && target.personId === person._id) {
        const behavior = portalBehavior(await ctx.db.get(target.eventId))
        if (isTaskLocked(target, behavior)) throw new Error(TASK_LOCKED_MESSAGE)
      }
    }

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

// ——— File comments (sbek CNT-05) ————————————————————————————————————————
// The speaker's half of the thread the organizer sees on the same file. One
// conversation, two doors — so "can you re-export this at 16:9?" and the
// answer never live in someone's inbox.

/** A speaker may only read/write the thread on a file that is theirs. */
async function requireOwnUpload(
  ctx: QueryCtx | MutationCtx,
  portalToken: string,
  uploadId: Id<"uploads">,
): Promise<{ person: Doc<"people">; upload: Doc<"uploads"> }> {
  const person = await requirePerson(ctx, portalToken)
  const upload = await ctx.db.get(uploadId)
  if (!upload || upload.eventId !== person.eventId) {
    throw new Error("File not found.")
  }
  let mine = upload.personId === person._id
  if (!mine && upload.submissionId) {
    // A co-speaker on the session can talk about its files too.
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", upload.submissionId as Id<"submissions">),
      )
      .collect()
    const submission = await ctx.db.get(upload.submissionId)
    mine =
      participants.some((p) => p.personId === person._id) ||
      submission?.submitterId === person._id
  }
  if (!mine) throw new Error("You don't have access to this file.")
  return { person, upload }
}

export const uploadComments = query({
  args: { portalToken: v.string(), uploadId: v.id("uploads") },
  handler: async (ctx, args) => {
    await requireOwnUpload(ctx, args.portalToken, args.uploadId)
    return await threadFor(ctx, args.uploadId)
  },
})

export const addUploadComment = mutation({
  args: {
    portalToken: v.string(),
    uploadId: v.id("uploads"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { person, upload } = await requireOwnUpload(
      ctx,
      args.portalToken,
      args.uploadId,
    )
    return await addComment(ctx, {
      uploadId: args.uploadId,
      eventId: upload.eventId,
      authorType: "speaker",
      authorLabel:
        `${person.firstName} ${person.lastName}`.trim() || person.email,
      body: args.body,
    })
  },
})

import { ConvexError, v } from "convex/values"
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
import { completeTasksOfKind, syncProfileTasks } from "./lib/profileTasks"
import { cfpClosedMessage, isFormOpen } from "./lib/formWindow"
import { notifySubmissionAdmins } from "./platformEmails"
import { emitWebhook } from "./webhooks"
import { sponsorPortalLinkFor } from "./lib/email"
import { queueMessage } from "./comms"
import { internal } from "./_generated/api"
import { scheduleAirtableSync } from "./airtable"
import { emitSponsorUpdated } from "./sponsors"
import type { SponsorPortalRules } from "./lib/sponsors"
import {
  MAX_SPONSOR_SESSION_SPEAKERS,
  addSessionBlocker,
  allowanceSentence,
  allowanceUsed,
  linkContact,
  resolveSpeaker,
  sponsorClosedMessage,
  sponsorContacts,
  sponsorPortalRules,
  sponsorSessions,
  sponsorWindowClosed,
} from "./lib/sponsors"

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
function isTaskLocked(
  task: Doc<"tasks">,
  behavior: PortalBehavior,
  now: number,
): boolean {
  if (behavior.extendTaskDeadlines) return false
  if (task.completedAt) return false
  return task.dueAt !== undefined && task.dueAt < now
}

const TASK_LOCKED_MESSAGE =
  "The deadline for this task has passed, so it's closed. Email the organizers and they can reopen it for you."

/**
 * "Collect an answer": the organizer asks a question in the task instructions
 * and the speaker types a reply. `form` is the dead kind this replaced — a few
 * rows may still carry it, and reading them as an answer task is the only
 * shape that lets a speaker ever finish them.
 */
function isAnswerTask(task: Doc<"tasks">): boolean {
  return task.kind === "answer" || task.kind === "form"
}

/** How much prose a portal answer may carry — generous, but not a file dump. */
const MAX_ANSWER_CHARS = 5000

// ——— Staged queues are not speaker-facing —————————————————————————————————
// `accept_queue` / `decline_queue` are the organizer's STAGED decisions: the
// point of the queue is that nothing is announced until they commit it and the
// email goes out. So the portal reads both as "Pending" — same word, same
// amber pill as any other undecided submission — while every organizer surface
// keeps the real queue status. AGENTS.md's "identical wording in organizer and
// speaker UIs" rule was written for COMMITTED statuses; this is the exception.
const SPEAKER_FACING_STATUS: Record<string, string> = {
  accept_queue: "pending",
  decline_queue: "pending",
}

function speakerFacingStatus(status: string): string {
  return SPEAKER_FACING_STATUS[status] ?? status
}

// ——— Why a submission can't be edited ————————————————————————————————————
// Computed once, server-side, so the portal can grey the fields out up front
// AND the mutation can refuse with the very same sentence. `code` only picks
// the icon/tone; the words always come from here.

type EditLockCode =
  | "withdrawn"
  | "declined"
  | "portal_disabled"
  | "cfp_closed"
  | "sponsor_closed"

interface EditLock {
  code: EditLockCode
  title: string
  message: string
}

function editLockFor(
  submission: Doc<"submissions">,
  form: Doc<"forms"> | null,
  behavior: PortalBehavior,
  timezone?: string,
  now: number = Date.now(),
  sponsorRules?: SponsorPortalRules,
): EditLock | null {
  if (submission.status === "withdrawn") {
    return {
      code: "withdrawn",
      title: "This submission is closed",
      message: "You withdrew this submission, so it can no longer be edited.",
    }
  }
  if (submission.status === "declined") {
    return {
      code: "declined",
      title: "This submission is closed",
      message: "This submission was declined, so it can no longer be edited.",
    }
  }
  if (!behavior.allowSubmissionEdits) {
    return {
      code: "portal_disabled",
      title: "Changes go through the organizers",
      message:
        "The organizers have turned off editing submissions from the portal. Email them with what you'd like changed and they'll update it for you.",
    }
  }
  // The CFP's own deadline (sbek CFP-16), and it applies to accepted talks too.
  //
  // This used to exempt `accepted`, reading swyx's "accepted speakers can still
  // edit submissions" as covering the deadline as well. It doesn't: that
  // clarification is about ACCEPTANCE not being a lock, and the deadline is a
  // separate promise the organizer made to everyone — once the window shuts,
  // the text the programme was built from stops moving underneath it. An
  // organizer can still change anything, and the message below says exactly
  // who to ask, so nothing is actually unfixable; it just goes through the
  // person accountable for the programme.
  if (form && !isFormOpen(form, now).open) {
    return {
      code: "cfp_closed",
      title: "The call for speakers has closed",
      message: cfpClosedMessage(form, timezone, now),
    }
  }
  // A sponsor's session follows the SPONSOR window instead (it never came
  // through a CFP): once the organizers freeze sponsor sessions, the text the
  // agenda was built from stops moving — same reasoning as the CFP deadline.
  if (
    submission.sponsorId &&
    sponsorRules?.closeAt != null &&
    sponsorWindowClosed(sponsorRules, now)
  ) {
    return {
      code: "sponsor_closed",
      title: "Sponsor sessions are closed",
      message: sponsorClosedMessage(sponsorRules.closeAt, timezone),
    }
  }
  return null
}

/**
 * The moment editing stops being possible, when there is one — the CFP's close
 * date. Returned so the portal can say "editable until Aug 20" INSTEAD of
 * quietly locking on the day.
 */
function editableUntil(
  submission: Doc<"submissions">,
  form: Doc<"forms"> | null,
  lock: EditLock | null,
  sponsorRules?: SponsorPortalRules,
): number | null {
  if (lock) return null
  if (form) return form.closeAt ?? null
  if (submission.sponsorId) return sponsorRules?.closeAt ?? null
  return null
}

async function submissionSummary(
  ctx: QueryCtx,
  s: Doc<"submissions">,
  opts: {
    behavior: PortalBehavior
    timezone?: string
    now: number
    sponsorRules?: SponsorPortalRules
  },
) {
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
              personId: person._id,
              name: `${person.firstName} ${person.lastName}`.trim() || person.email,
              role: p.role,
              company: person.company,
            }
          : null
      }),
  )
  const form = s.formId ? await ctx.db.get(s.formId) : null
  const lock = editLockFor(
    s,
    form,
    opts.behavior,
    opts.timezone,
    opts.now,
    opts.sponsorRules,
  )
  return {
    id: s._id,
    title: s.title,
    description: s.description,
    // Never the raw pipeline status — see SPEAKER_FACING_STATUS above.
    status: speakerFacingStatus(s.status),
    kind: s.kind,
    // `null` ⇒ the speaker may edit this submission right now.
    editLock: lock,
    editableUntil: editableUntil(s, form, lock, opts.sponsorRules),
    /** True when this session belongs to the reader's sponsor. */
    sponsored: s.sponsorId !== undefined,
    format: s.format,
    durationMinutes: s.durationMinutes ?? null,
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
  args: { portalToken: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const event = await ctx.db.get(person.eventId)
    if (!event) throw new ConvexError("Event not found")

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
    // The organizer's three portal switches, resolved once for the whole
    // payload — the per-submission edit lock needs them too.
    const behavior = portalBehavior(event)
    const sponsorRules = sponsorPortalRules(event)
    const submissions = await Promise.all(
      [...map.values()]
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((s) =>
          submissionSummary(ctx, s, {
            behavior,
            timezone: event.timezone,
            now: args.now,
            sponsorRules,
          }),
        ),
    )

    // A sponsor CONTACT also sees their company: its sessions (whoever added
    // them), the package's allowance, and why "Add session" is or isn't
    // available — the same sentence the mutation refuses with.
    const sponsorDoc = person.sponsorId ? await ctx.db.get(person.sponsorId) : null
    let sponsor = null
    if (sponsorDoc && sponsorDoc.eventId === event._id) {
      const sessions = await sponsorSessions(ctx, sponsorDoc._id)
      const used = allowanceUsed(sessions)
      const colleagues = await sponsorContacts(ctx, sponsorDoc._id)
      sponsor = {
        id: sponsorDoc._id,
        name: sponsorDoc.name,
        tier: sponsorDoc.tier ?? null,
        websiteUrl: sponsorDoc.websiteUrl ?? null,
        sessionLimit: sponsorDoc.sessionLimit,
        sessionsUsed: used,
        closeAt: sponsorRules.closeAt,
        // What a new session starts as, so the form can say so up front.
        newSessionStatus: sponsorRules.newSessionStatus,
        canInviteColleagues: sponsorRules.allowColleagueInvites,
        addBlocker: addSessionBlocker(
          sponsorDoc,
          used,
          sponsorRules,
          event.timezone,
          args.now,
        ),
        // The event's Format list (the CFP's own options), so a sponsor picks
        // from the same words the organizer's program uses.
        formatOptions: await eventFormatOptions(ctx, event._id),
        contacts: colleagues
          .sort((a, b) => a._creationTime - b._creationTime)
          .map((c) => ({
            id: c._id,
            name: `${c.firstName} ${c.lastName}`.trim() || c.email,
            email: c.email,
            isMe: c._id === person._id,
          })),
        sessions: await Promise.all(
          sessions.map((s) =>
            submissionSummary(ctx, s, {
              behavior,
              timezone: event.timezone,
              now: args.now,
              sponsorRules,
            }),
          ),
        ),
      }
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_personId", (q) => q.eq("personId", person._id))
      .collect()

    // "Always show tasks" off ⇒ the checklist only opens once a session of
    // theirs is accepted, so a portal shared with every submitter doesn't ask
    // people who haven't been accepted yet for slides and headshots.
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
      sponsor,
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
              // Legacy `form` rows read as `answer` (see isAnswerTask), so the
              // portal renders one shape and the speaker can finish them.
              kind: isAnswerTask(t) ? "answer" : t.kind,
              /** Their own reply to an "answer" task, so they can re-read it. */
              response: t.response,
              // The session this task is about, when the organizer bound it to
              // one — files uploaded here land on that session's Files tab.
              submissionId: t.submissionId,
              dueAt: t.dueAt,
              completedAt: t.completedAt,
              locked: isTaskLocked(t, behavior, args.now),
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
    const { links, ...fields } = args.patch
    // `links` is MERGED, field by field, never replaced. The portal saves on
    // blur, one field at a time, so two links left in quick succession used to
    // race: each save rebuilt the whole object from the client's last-confirmed
    // snapshot, and the slower one overwrote the URL the faster one had just
    // stored (adversarial-review F9). Merging server-side makes each save
    // independent of what the client believes about the other two links —
    // there is no snapshot to go stale.
    //
    // An empty string is how a link is CLEARED (a key that is simply absent
    // means "leave this one alone"): Convex drops `undefined` on the wire, so
    // absent and "erase it" would otherwise be the same message.
    const patch: Partial<Doc<"people">> = { ...fields }
    if (links) {
      const merged = { ...(person.links ?? {}) }
      for (const key of ["linkedin", "twitter", "website"] as const) {
        const value = links[key]
        if (value === undefined) continue
        if (value.trim() === "") delete merged[key]
        else merged[key] = value.trim()
      }
      patch.links = merged
    }
    await ctx.db.patch(person._id, patch)

    // Completing profile data auto-completes the "update your profile" task —
    // and "complete" means what the speaker's own meter means, all four items,
    // not just a bio (adversarial-review F10). convex/lib/profileTasks.ts.
    await syncProfileTasks(ctx, await ctx.db.get(person._id))
    return null
  },
})

// Speakers may edit their submissions — including after acceptance (swyx
// clarified acceptance-locking is unused). Editing a draft keeps it draft;
// editing a submitted one keeps its status. What DOES close the door is the
// CFP's own deadline (sbek CFP-16), the organizer's portal switch, and a
// decided-against status — all three resolved by editLockFor().
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
    if (!submission) throw new ConvexError("Submission not found")
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", args.submissionId))
      .collect()
    const isMine =
      submission.submitterId === person._id ||
      participants.some((p) => p.personId === person._id) ||
      isSponsorSessionOf(person, submission)
    if (!isMine || submission.deletedAt !== undefined) {
      throw new ConvexError("You don't have access to this submission.")
    }
    // Exactly the rules the portal already showed this speaker — decided
    // status, the event's "allow submission edits" switch, and the CFP's own
    // close date — so a save never fails with a surprise the UI didn't warn
    // about. Same sentence in both places (editLockFor above).
    const event = await ctx.db.get(submission.eventId)
    const form = submission.formId ? await ctx.db.get(submission.formId) : null
    const lock = editLockFor(
      submission,
      form,
      portalBehavior(event),
      event?.timezone,
      Date.now(),
      sponsorPortalRules(event),
    )
    if (lock) throw new ConvexError(lock.message)
    const { title, description, answers } = args.patch
    if (title !== undefined && !title.trim()) {
      throw new ConvexError("A session needs a title.")
    }
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
    if (
      !submission ||
      submission.deletedAt !== undefined ||
      (submission.submitterId !== person._id &&
        !isSponsorSessionOf(person, submission))
    ) {
      throw new ConvexError("Submission not found.")
    }
    if (submission.status === "withdrawn") return null
    if (submission.status === "accepted") {
      throw new ConvexError(
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
    if (!task || task.personId !== person._id) throw new ConvexError("Task not found.")
    if (!["confirm", "profile"].includes(task.kind)) {
      throw new ConvexError(
        isAnswerTask(task)
          ? "Type your answer and send it — that's what completes this task."
          : "Complete this task by uploading the requested file.",
      )
    }
    // "Extend task deadlines" off ⇒ a past-due task is closed for good.
    const behavior = portalBehavior(await ctx.db.get(task.eventId))
    if (isTaskLocked(task, behavior, Date.now())) {
      throw new ConvexError(TASK_LOCKED_MESSAGE)
    }
    await ctx.db.patch(args.taskId, { completedAt: Date.now() })
    return null
  },
})

/**
 * "Collect an answer" (task kind `answer`): the speaker types a reply and
 * sending it IS the completion — the answer is the proof, so it is stored on
 * the task and the organizer reads it on the speaker's profile. Sending again
 * replaces the answer (people re-read a question and improve their reply);
 * an empty reply is refused rather than silently ticking the task off.
 */
export const answerTask = mutation({
  args: {
    portalToken: v.string(),
    taskId: v.id("tasks"),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    const person = await requirePerson(ctx, args.portalToken)
    const task = await ctx.db.get(args.taskId)
    if (!task || task.personId !== person._id) {
      throw new ConvexError("Task not found.")
    }
    if (!isAnswerTask(task)) {
      throw new ConvexError("This task doesn't ask for a written answer.")
    }
    const response = args.response.trim()
    if (!response) throw new ConvexError("Write your answer before sending it.")
    if (response.length > MAX_ANSWER_CHARS) {
      throw new ConvexError(
        `That answer is a bit long — keep it under ${MAX_ANSWER_CHARS.toLocaleString()} characters.`,
      )
    }
    // "Extend task deadlines" off ⇒ a past-due task is closed for good.
    const behavior = portalBehavior(await ctx.db.get(task.eventId))
    if (isTaskLocked(task, behavior, Date.now())) {
      throw new ConvexError(TASK_LOCKED_MESSAGE)
    }
    await ctx.db.patch(args.taskId, {
      response,
      completedAt: task.completedAt ?? Date.now(),
    })
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
      throw new ConvexError("That upload didn't finish — please try again.")
    }
    assertAllowedUpload(meta, args.filename)

    // A closed task can't be completed by uploading into it either — check
    // before anything is written, so a locked task never gains a file.
    const task = args.taskId ? await ctx.db.get(args.taskId) : null
    if (task && task.personId === person._id) {
      const behavior = portalBehavior(await ctx.db.get(task.eventId))
      if (isTaskLocked(task, behavior, Date.now())) {
        throw new ConvexError(TASK_LOCKED_MESSAGE)
      }
    }

    // A task bound to a session files its uploads against that session, so the
    // organizer finds the deck on the session's Files tab rather than having
    // to remember which task it came in through. An explicit `submissionId`
    // from the caller still wins.
    const submissionId = args.submissionId ?? task?.submissionId

    if (args.isHeadshot) {
      // Replaces the photo AND deletes the one it replaces (convex/lib/files).
      await replaceHeadshot(ctx, person, args.storageId)
      await completeTasksOfKind(ctx, person._id, "headshot")
      // A headshot is one of the four things a complete profile needs, so the
      // photo that finishes the profile also finishes the profile task.
      await syncProfileTasks(ctx, await ctx.db.get(person._id))
    }

    // Versioning: next version within the same slot (task or submission).
    const version = await nextVersion(ctx, {
      personId: person._id,
      taskId: args.taskId,
      submissionId,
    })
    const uploadId = await ctx.db.insert("uploads", {
      eventId: person.eventId,
      personId: person._id,
      submissionId,
      taskId: args.taskId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: meta.contentType ?? args.contentType,
      size: meta.size,
      version,
      approvalStatus: "pending",
    })

    if (task && task.personId === person._id && !task.completedAt) {
      await ctx.db.patch(task._id, { completedAt: Date.now() })
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
    throw new ConvexError("File not found.")
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
  if (!mine) throw new ConvexError("You don't have access to this file.")
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

// ——— Sponsor portal ———————————————————————————————————————————————————————
// A sponsor CONTACT (people.sponsorId) manages their company's sessions here:
// add the sessions the package includes, name who presents, edit them while
// the sponsor window is open, and bring colleagues in. No CFP in between —
// that is the whole point (Kelsey: "if OpenAI has a sponsor, OpenAI has a
// main login, then they go in and add the sessions that they want"). The
// limits live in convex/lib/sponsors.ts so the portal's disabled states and
// these refusals say the same sentence.

/** Does this session belong to the company this person is a contact for? */
function isSponsorSessionOf(
  person: Doc<"people">,
  submission: Doc<"submissions">,
): boolean {
  return (
    person.sponsorId !== undefined &&
    submission.sponsorId !== undefined &&
    submission.sponsorId === person.sponsorId
  )
}

function actorFor(person: Doc<"people">) {
  return {
    type: "speaker" as const,
    label: `${person.firstName} ${person.lastName}`.trim() || person.email,
  }
}

async function requireSponsorContact(ctx: MutationCtx, portalToken: string) {
  const person = await requirePerson(ctx, portalToken)
  const sponsor = person.sponsorId ? await ctx.db.get(person.sponsorId) : null
  if (!sponsor || sponsor.eventId !== person.eventId) {
    throw new ConvexError(
      "Only sponsor contacts can do this. Ask the organizers to add you to your company.",
    )
  }
  const event = await ctx.db.get(person.eventId)
  if (!event) throw new ConvexError("Event not found")
  return { person, sponsor, event }
}

/** A sponsor session this contact may change right now — or the reason why not. */
async function requireEditableSponsorSession(
  ctx: MutationCtx,
  portalToken: string,
  submissionId: Id<"submissions">,
) {
  const { person, sponsor, event } = await requireSponsorContact(ctx, portalToken)
  const submission = await ctx.db.get(submissionId)
  if (
    !submission ||
    submission.deletedAt !== undefined ||
    !isSponsorSessionOf(person, submission)
  ) {
    throw new ConvexError("Session not found.")
  }
  const form = submission.formId ? await ctx.db.get(submission.formId) : null
  const lock = editLockFor(
    submission,
    form,
    portalBehavior(event),
    event.timezone,
    Date.now(),
    sponsorPortalRules(event),
  )
  if (lock) throw new ConvexError(lock.message)
  return { person, sponsor, event, submission }
}

const DURATIONS = [10, 15, 20, 25, 30, 40, 45, 50, 60, 90, 120] as const

function cleanDuration(minutes: number | undefined): number | undefined {
  if (minutes === undefined) return undefined
  if (!(DURATIONS as ReadonlyArray<number>).includes(minutes)) {
    throw new ConvexError("Pick one of the session lengths offered.")
  }
  return minutes
}

const speakerArg = v.object({
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
})

export const addSponsorSession = mutation({
  args: {
    portalToken: v.string(),
    title: v.string(),
    description: v.string(),
    format: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    /** The contact is presenting it themselves. */
    includeMe: v.boolean(),
    speakers: v.array(speakerArg),
  },
  returns: v.id("submissions"),
  handler: async (ctx, args) => {
    const { person, sponsor, event } = await requireSponsorContact(
      ctx,
      args.portalToken,
    )
    const rules = sponsorPortalRules(event)
    const used = allowanceUsed(await sponsorSessions(ctx, sponsor._id))
    const blocker = addSessionBlocker(sponsor, used, rules, event.timezone, Date.now())
    if (blocker) throw new ConvexError(blocker)

    const title = args.title.trim()
    const description = args.description.trim()
    if (!title) throw new ConvexError("Give the session a title.")
    if (title.length > 200) {
      throw new ConvexError("That title is long — keep it under 200 characters.")
    }
    if (!description) {
      throw new ConvexError("Add a short description — it's what attendees read.")
    }
    const totalSpeakers = args.speakers.length + (args.includeMe ? 1 : 0)
    if (totalSpeakers === 0) {
      throw new ConvexError("Add at least one speaker — or tick “I'm presenting”.")
    }
    if (totalSpeakers > MAX_SPONSOR_SESSION_SPEAKERS) {
      throw new ConvexError(
        `A session can have at most ${MAX_SPONSOR_SESSION_SPEAKERS} speakers.`,
      )
    }

    const status = rules.newSessionStatus
    const submissionId = await ctx.db.insert("submissions", {
      eventId: event._id,
      kind: "session",
      title,
      description,
      answers: {},
      format: args.format?.trim() || undefined,
      durationMinutes: cleanDuration(args.durationMinutes),
      tags: [],
      status,
      decidedAt: status === "accepted" ? Date.now() : undefined,
      submitterId: person._id,
      sponsorId: sponsor._id,
    })

    const speakerIds: Array<Id<"people">> = []
    if (args.includeMe) speakerIds.push(person._id)
    for (const input of args.speakers) {
      const speaker = await resolveSpeaker(ctx, event._id, sponsor, input)
      if (!speakerIds.includes(speaker._id)) speakerIds.push(speaker._id)
    }
    for (const [order, personId] of speakerIds.entries()) {
      await ctx.db.insert("submissionParticipants", {
        submissionId,
        eventId: event._id,
        personId,
        role: "speaker",
        order,
      })
    }

    await scheduleAirtableSync(ctx, event._id)
    await emitWebhook(ctx, event._id, "session.created", {
      id: submissionId,
      title,
      status,
      kind: "session",
      sponsors: [{ id: sponsor._id, name: sponsor.name }],
    })
    await recordAudit(ctx, {
      eventId: event._id,
      entity: "session",
      entityId: submissionId,
      action: "created",
      summary: `Session added by sponsor ${sponsor.name} · ${title}`,
      meta: { status, sponsor: sponsor.name, speakers: speakerIds.length },
      actor: actorFor(person),
    })
    return submissionId
  },
})

export const updateSponsorSession = mutation({
  args: {
    portalToken: v.string(),
    submissionId: v.id("submissions"),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      format: v.optional(v.string()),
      durationMinutes: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { person, sponsor, submission } = await requireEditableSponsorSession(
      ctx,
      args.portalToken,
      args.submissionId,
    )
    const next: Partial<Doc<"submissions">> = {}
    if (args.patch.title !== undefined) {
      const title = args.patch.title.trim()
      if (!title) throw new ConvexError("A session needs a title.")
      next.title = title
    }
    if (args.patch.description !== undefined) {
      const description = args.patch.description.trim()
      if (!description) throw new ConvexError("A session needs a description.")
      next.description = description
    }
    if (args.patch.format !== undefined) next.format = args.patch.format.trim() || undefined
    if (args.patch.durationMinutes !== undefined) {
      next.durationMinutes = cleanDuration(args.patch.durationMinutes)
    }
    if (Object.keys(next).length === 0) return null
    await ctx.db.patch(submission._id, { ...next, updatedAt: Date.now() })
    await scheduleAirtableSync(ctx, submission.eventId)
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: "session",
      entityId: submission._id,
      action: "updated",
      summary: `Sponsor ${sponsor.name} edited ${Object.keys(next).join(", ")} · ${next.title ?? submission.title}`,
      meta: { fields: Object.keys(next) },
      actor: actorFor(person),
    })
    return null
  },
})

export const addSponsorSessionSpeaker = mutation({
  args: {
    portalToken: v.string(),
    submissionId: v.id("submissions"),
    speaker: speakerArg,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { person, sponsor, event, submission } =
      await requireEditableSponsorSession(ctx, args.portalToken, args.submissionId)
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .collect()
    if (participants.length >= MAX_SPONSOR_SESSION_SPEAKERS) {
      throw new ConvexError(
        `A session can have at most ${MAX_SPONSOR_SESSION_SPEAKERS} speakers.`,
      )
    }
    const speaker = await resolveSpeaker(ctx, event._id, sponsor, args.speaker)
    if (participants.some((p) => p.personId === speaker._id)) {
      throw new ConvexError(`${speaker.email} is already on this session.`)
    }
    await ctx.db.insert("submissionParticipants", {
      submissionId: submission._id,
      eventId: event._id,
      personId: speaker._id,
      role: "speaker",
      order: participants.reduce((max, p) => Math.max(max, p.order), -1) + 1,
    })
    await scheduleAirtableSync(ctx, event._id)
    await recordAudit(ctx, {
      eventId: event._id,
      entity: "session",
      entityId: submission._id,
      action: "updated",
      summary: `Sponsor ${sponsor.name} added speaker ${speaker.email} · ${submission.title}`,
      meta: { email: speaker.email },
      actor: actorFor(person),
    })
    return null
  },
})

export const removeSponsorSessionSpeaker = mutation({
  args: {
    portalToken: v.string(),
    submissionId: v.id("submissions"),
    personId: v.id("people"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { person, sponsor, event, submission } =
      await requireEditableSponsorSession(ctx, args.portalToken, args.submissionId)
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .collect()
    const row = participants.find((p) => p.personId === args.personId)
    if (!row) throw new ConvexError("That person isn't on this session.")
    if (participants.length <= 1) {
      throw new ConvexError(
        "A session needs at least one speaker — add the replacement first, then remove this one.",
      )
    }
    await ctx.db.delete(row._id)
    const removed = await ctx.db.get(args.personId)
    await scheduleAirtableSync(ctx, event._id)
    await recordAudit(ctx, {
      eventId: event._id,
      entity: "session",
      entityId: submission._id,
      action: "updated",
      summary: `Sponsor ${sponsor.name} removed speaker ${removed?.email ?? "a speaker"} · ${submission.title}`,
      meta: { email: removed?.email },
      actor: actorFor(person),
    })
    return null
  },
})

/**
 * Bring a colleague in (Sessionboard's "Add Contacts to Group"). They become a
 * contact of the same sponsor with their own sign-in link, which is emailed to
 * them — the contact adding them never sees it.
 */
export const addSponsorColleague = mutation({
  args: {
    portalToken: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { person, sponsor, event } = await requireSponsorContact(
      ctx,
      args.portalToken,
    )
    if (!sponsorPortalRules(event).allowColleagueInvites) {
      throw new ConvexError(
        "The organizers add contacts for this event — email them who should have access.",
      )
    }
    if (!args.firstName.trim()) throw new ConvexError("Add their first name.")
    const contacts = await sponsorContacts(ctx, sponsor._id)
    if (contacts.length >= 25) {
      throw new ConvexError("Your company already has 25 contacts — ask the organizers to add more.")
    }
    const { person: colleague } = await linkContact(ctx, sponsor, args)
    if (colleague._id === person._id) {
      throw new ConvexError("That's you — you already have access.")
    }
    const sessions = await sponsorSessions(ctx, sponsor._id)
    await queueMessage(ctx, {
      eventId: event._id,
      personId: colleague._id,
      templateKey: "sponsor_invite",
      extraVars: {
        sponsorName: sponsor.name,
        sessionAllowance: allowanceSentence(sponsor, allowanceUsed(sessions)),
        portalLink: sponsorPortalLinkFor(colleague.portalToken),
      },
    })
    await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    await recordAudit(ctx, {
      eventId: event._id,
      entity: "sponsor",
      entityId: sponsor._id,
      action: "contact_added",
      summary: `${actorFor(person).label} added colleague ${colleague.email} to ${sponsor.name}`,
      meta: { email: colleague.email },
      actor: actorFor(person),
    })
    await emitSponsorUpdated(ctx, sponsor._id)
    return null
  },
})

async function eventFormatOptions(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<Array<string>> {
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(50)
  const values: Array<string> = []
  for (const form of forms) {
    const question = form.questions.find((q) => q.id === "format")
    for (const option of question?.options ?? []) {
      if (!values.includes(option)) values.push(option)
    }
  }
  return values
}

/** Session lengths a sponsor can pick — mirrored in the portal's select. */
export const SPONSOR_SESSION_DURATIONS = DURATIONS

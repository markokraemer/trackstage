// Organizer-side speaker management (sbek SPK-02 / SPK-04 / CNT-10).
//
// The roster in convex/dashboard.ts is derived: speakers appear because a
// submission they're on got accepted. That covers the CFP path and nothing
// else — an organizer who books a keynote by email, or who needs to fix a
// speaker's bio before the site goes live, has nowhere to go. This module is
// that missing half:
//
//   addManual     → create a speaker by hand (person + portal token, so the
//                   speaker portal, tasks and comms all work immediately)
//   bulkAdd       → the same thing for a whole CSV (sbek SPK-03)
//   updateProfile → edit the bits an organizer owns: name, company, title,
//                   bio, travel & logistics, and an internal headshot note
//   setHeadshot   → upload/replace the speaker's photo on their behalf
//   setWorkflowStatus → invited | confirmed | dropped
//
// Plus the participant editor for an EXISTING submission (sbek ABS-11):
// co-speakers, chairpersons and moderators are added, re-roled and removed
// long after the form closed — a panel gains a moderator the week of the show.
//
// `workflowStatus` doubles as the marker that keeps a hand-added speaker on
// the roster before they have an accepted session (see dashboard.speakersRoster).

import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { randomToken, requireEventAccess } from "./lib/auth"
import { emitWebhook } from "./webhooks"
import { record as recordAudit } from "./lib/audit"
import {
  assertImageUpload,
  deleteUploadRow,
  nextVersion,
  releaseBlob,
  replaceHeadshot,
  storageMeta,
} from "./lib/files"

/** The three states an organizer tracks a speaker through. */
export const WORKFLOW_STATUSES = ["invited", "confirmed", "dropped"] as const

const workflowStatusValidator = v.union(
  v.literal("invited"),
  v.literal("confirmed"),
  v.literal("dropped"),
)

/** Ceiling on a single event's people scan (matches convex/dashboard.ts). */
const MAX_PEOPLE = 4000
/** Ceiling on the submission/task/upload scans `removePerson` runs. */
const MAX_ROWS = 4000

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(trimmed)) {
    throw new Error("Enter a valid email address.")
  }
  return trimmed
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

/**
 * Add a speaker by hand. Idempotent on email within the event: if the person
 * already exists (they submitted an abstract, or they're a co-speaker), this
 * fills in whatever is still blank and marks them as organizer-managed rather
 * than creating a duplicate.
 */
export const addManual = mutation({
  args: {
    eventId: v.id("events"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    bio: v.optional(v.string()),
    workflowStatus: v.optional(workflowStatusValidator),
  },
  returns: v.object({
    personId: v.id("people"),
    portalToken: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const email = normalizeEmail(args.email)
    const firstName = requireText(args.firstName, "First name")
    const lastName = args.lastName.trim()
    const workflowStatus = args.workflowStatus ?? "confirmed"

    const existing = await ctx.db
      .query("people")
      .withIndex("by_eventId_and_email", (q) =>
        q.eq("eventId", args.eventId).eq("email", email),
      )
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        firstName: existing.firstName || firstName,
        lastName: existing.lastName || lastName,
        company: args.company?.trim() || existing.company,
        jobTitle: args.jobTitle?.trim() || existing.jobTitle,
        bio: args.bio?.trim() || existing.bio,
        workflowStatus,
      })
      await recordAudit(ctx, {
        eventId: args.eventId,
        entity: "speaker",
        entityId: existing._id,
        action: "updated",
        summary: `Speaker details filled in · ${firstName} ${lastName}`.trim(),
        meta: { email, workflowStatus },
      })
      return {
        personId: existing._id,
        portalToken: existing.portalToken,
        created: false,
      }
    }

    const portalToken = randomToken()
    const personId = await ctx.db.insert("people", {
      eventId: args.eventId,
      email,
      firstName,
      lastName,
      company: args.company?.trim() || undefined,
      jobTitle: args.jobTitle?.trim() || undefined,
      bio: args.bio?.trim() || undefined,
      portalToken,
      workflowStatus,
    })
    // Outbound webhooks (convex/webhooks.ts) — fire-and-forget.
    await emitWebhook(ctx, args.eventId, "speaker.created", {
      id: personId,
      email,
      first_name: firstName,
      last_name: lastName,
      workflow_status: workflowStatus,
    })
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "speaker",
      entityId: personId,
      action: "created",
      summary: `Speaker added · ${firstName} ${lastName}`.trim(),
      meta: { email, workflowStatus },
    })
    return { personId, portalToken, created: true }
  },
})

/**
 * Organizer-side profile edit (sbek CNT-10). The speaker can still change the
 * same fields in their portal — last write wins, exactly as an organizer
 * expects when they fix a typo in someone's bio ten minutes before go-live.
 *
 * `headshotNote` is an internal instruction ("crop tighter", "waiting on a
 * higher-res file") kept alongside the bio rather than a second table: it is
 * never shown publicly. The headshot IMAGE itself is uploaded by the speaker
 * in their portal — organizers note what they need instead of impersonating.
 */
export const updateProfile = mutation({
  args: {
    personId: v.id("people"),
    patch: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      jobTitle: v.optional(v.string()),
      company: v.optional(v.string()),
      bio: v.optional(v.string()),
      headshotNote: v.optional(v.string()),
      // Travel & logistics (sbek SPK-15) — arrival, hotel nights, dietary
      // needs, AV asks. Internal, free text, never shown publicly.
      logistics: v.optional(v.string()),
      // "Show in public gallery" (sbek CNT-12). See setPublicVisibility.
      publicVisible: v.optional(v.boolean()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)

    const patch: Partial<Doc<"people">> = {}
    if (args.patch.firstName !== undefined) {
      patch.firstName = requireText(args.patch.firstName, "First name")
    }
    if (args.patch.lastName !== undefined) {
      patch.lastName = args.patch.lastName.trim()
    }
    if (args.patch.jobTitle !== undefined) {
      patch.jobTitle = args.patch.jobTitle.trim() || undefined
    }
    if (args.patch.company !== undefined) {
      patch.company = args.patch.company.trim() || undefined
    }
    if (args.patch.bio !== undefined) {
      patch.bio = args.patch.bio.trim() || undefined
    }
    if (args.patch.headshotNote !== undefined) {
      patch.headshotNote = args.patch.headshotNote.trim() || undefined
    }
    if (args.patch.logistics !== undefined) {
      patch.logistics = args.patch.logistics.trim() || undefined
    }
    if (args.patch.publicVisible !== undefined) {
      patch.publicVisible = args.patch.publicVisible
    }
    await ctx.db.patch(args.personId, { ...patch, updatedAt: Date.now() })
    await emitWebhook(ctx, person.eventId, "speaker.updated", {
      id: args.personId,
      email: person.email,
      first_name: patch.firstName ?? person.firstName,
      last_name: patch.lastName ?? person.lastName,
    })
    const changed = Object.keys(patch)
    await recordAudit(ctx, {
      eventId: person.eventId,
      entity: "speaker",
      entityId: args.personId,
      action: "updated",
      summary: `Profile updated (${changed.join(", ")}) · ${`${patch.firstName ?? person.firstName} ${patch.lastName ?? person.lastName}`.trim() || person.email}`,
      meta: { fields: changed, email: person.email },
    })
    return null
  },
})

/**
 * The eye toggle (sbek CNT-12): show or hide one speaker on every public
 * surface — gallery, speaker list, the speaker lists on their sessions, their
 * itinerary, the JSON API and the .ics feed. It is deliberately a single
 * boolean rather than an approval workflow: the real case is "embargo the
 * keynote until we announce it", and it must be one click to set and one click
 * to undo. Acceptance status, the agenda and the speaker's portal are
 * untouched — the speaker still gets their tasks and emails.
 *
 * Absent on a person ⇒ visible, so every existing speaker stays public.
 */
export const setPublicVisibility = mutation({
  args: {
    personId: v.id("people"),
    publicVisible: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)
    await ctx.db.patch(args.personId, {
      publicVisible: args.publicVisible,
      updatedAt: Date.now(),
    })
    const name = `${person.firstName} ${person.lastName}`.trim() || person.email
    await emitWebhook(ctx, person.eventId, "speaker.updated", {
      id: args.personId,
      email: person.email,
      is_public: args.publicVisible,
    })
    await recordAudit(ctx, {
      eventId: person.eventId,
      entity: "speaker",
      entityId: args.personId,
      action: "updated",
      summary: args.publicVisible
        ? `Shown in the public speaker gallery · ${name}`
        : `Hidden from the public speaker gallery · ${name}`,
      meta: { publicVisible: args.publicVisible, email: person.email },
    })
    return null
  },
})

/**
 * Which speakers are currently hidden from the public surfaces. Kept as its
 * own tiny reactive query (ids only) so the roster can render the eye state
 * and the "Hidden" filter without widening the roster payload, and so the
 * toggle echoes the instant the mutation lands.
 */
export const hiddenFromPublic = query({
  args: { eventId: v.id("events") },
  returns: v.array(v.id("people")),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const people = await ctx.db
      .query("people")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_PEOPLE)
    return people
      .filter((person) => person.publicVisible === false)
      .map((person) => person._id)
  },
})

/**
 * The organizer-side extras the roster query doesn't carry: travel notes and
 * the current photo. Its own tiny reactive query so the profile drawer echoes
 * a headshot upload the instant it lands, without widening the roster payload
 * every table row pays for.
 */
export const profile = query({
  args: { personId: v.id("people") },
  returns: v.object({
    logistics: v.union(v.string(), v.null()),
    headshotUrl: v.union(v.string(), v.null()),
    headshotFilename: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)
    const headshotUrl = person.headshotId
      ? await ctx.storage.getUrl(person.headshotId)
      : null
    // The filename of the row that currently points at the photo, when there
    // is one — organizers recognise "priya-headshot.png" faster than a blob.
    let headshotFilename: string | null = null
    if (person.headshotId) {
      const rows = await ctx.db
        .query("uploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", person.headshotId!))
        .take(1)
      headshotFilename = rows[0]?.filename ?? null
    }
    return {
      logistics: person.logistics ?? null,
      headshotUrl,
      headshotFilename,
    }
  },
})

// ——— Headshot, organizer side (sbek CNT-10) ———————————————————————————————
// Speakers upload their own photo in the portal. But the person shipping the
// site at 6pm has the photo in their inbox and no way to get it in — so the
// organizer can do it for them, through the same storage path, same
// replace-and-clean-up semantics (convex/lib/files.ts → replaceHeadshot).
//
// Bytes arrive via `files.generateUploadUrl` (workspace-authorized); this is
// only the "record it" half.

/** Close any open "upload a headshot" task — the photo now exists. */
async function completeHeadshotTasks(ctx: MutationCtx, personId: Id<"people">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_personId", (q) => q.eq("personId", personId))
    .collect()
  for (const task of tasks) {
    if (task.kind === "headshot" && !task.completedAt) {
      await ctx.db.patch(task._id, { completedAt: Date.now() })
    }
  }
}

export const setHeadshot = mutation({
  args: {
    personId: v.id("people"),
    storageId: v.id("_storage"),
    filename: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)

    const meta = await storageMeta(ctx, args.storageId)
    if (!meta) throw new Error("That upload didn't finish — please try again.")
    assertImageUpload(meta, args.filename)

    // Points the person at the new blob AND drops the loose profile file it
    // replaces: a headshot is a current value, not a version history.
    await replaceHeadshot(ctx, person, args.storageId)

    // Filed like any other file so it shows up in the speaker's own portal.
    // Organizer-attached files start `approved` — the organizer IS the
    // reviewer (same rule as files.attachUploadAsOrganizer).
    const version = await nextVersion(ctx, { personId: args.personId })
    await ctx.db.insert("uploads", {
      eventId: person.eventId,
      personId: args.personId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: meta.contentType,
      size: meta.size,
      version,
      approvalStatus: "approved",
    })
    await completeHeadshotTasks(ctx, args.personId)
    await ctx.db.patch(args.personId, { updatedAt: Date.now() })

    const name = `${person.firstName} ${person.lastName}`.trim() || person.email
    await emitWebhook(ctx, person.eventId, "speaker.updated", {
      id: args.personId,
      email: person.email,
      has_headshot: true,
    })
    await recordAudit(ctx, {
      eventId: person.eventId,
      entity: "speaker",
      entityId: args.personId,
      action: "updated",
      summary: `${person.headshotId ? "Headshot replaced" : "Headshot uploaded"} · ${name}`,
      meta: { filename: args.filename, email: person.email },
    })
    return null
  },
})

/** Remove the photo entirely (wrong person, rights withdrawn, bad crop). */
export const clearHeadshot = mutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)
    const previous = person.headshotId
    if (!previous) return null

    await ctx.db.patch(args.personId, {
      headshotId: undefined,
      updatedAt: Date.now(),
    })
    // Drop the loose profile row that carried it, then the blob if nothing
    // else (a task or submission deliverable) still points at it.
    const rows = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", previous))
      .collect()
    for (const row of rows) {
      if (!row.taskId && !row.submissionId) await ctx.db.delete(row._id)
    }
    await releaseBlob(ctx, previous, { personId: args.personId })

    const name = `${person.firstName} ${person.lastName}`.trim() || person.email
    await recordAudit(ctx, {
      eventId: person.eventId,
      entity: "speaker",
      entityId: args.personId,
      action: "updated",
      summary: `Headshot removed · ${name}`,
      meta: { email: person.email },
    })
    return null
  },
})

// ——— CSV import (sbek SPK-03) ——————————————————————————————————————————————
// The file is parsed and previewed in the browser (src/lib/csv.ts); this is
// the commit. Idempotent on email, exactly like `addManual`: an organizer who
// re-imports last year's list must not end up with two of everyone.
//
// The merge rule is the one convex/submit.ts `profilePatch` uses for a contact
// somebody ELSE typed in: FILL THE BLANKS ONLY. A spreadsheet is a weaker
// source of truth than what the speaker wrote about themselves in their
// portal, so an import can complete a profile but never overwrite it.

/** One import call. High enough for a real conference, low enough to stay well inside a mutation. */
const MAX_IMPORT_ROWS = 500

const importRowValidator = v.object({
  firstName: v.string(),
  lastName: v.optional(v.string()),
  email: v.string(),
  jobTitle: v.optional(v.string()),
  company: v.optional(v.string()),
  bio: v.optional(v.string()),
})

const importOutcomeValidator = v.union(
  v.literal("added"),
  v.literal("updated"),
  v.literal("skipped"),
)

/** Fields an import may fill in on somebody who already exists. */
const IMPORT_FILLABLE = ["lastName", "jobTitle", "company", "bio"] as const

export const bulkAdd = mutation({
  args: {
    eventId: v.id("events"),
    rows: v.array(importRowValidator),
    /** Status stamped on newly created people. Existing people keep theirs. */
    workflowStatus: v.optional(workflowStatusValidator),
  },
  returns: v.object({
    added: v.number(),
    updated: v.number(),
    skipped: v.number(),
    results: v.array(
      v.object({
        email: v.string(),
        name: v.string(),
        outcome: importOutcomeValidator,
        reason: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    if (args.rows.length === 0) throw new Error("That file had no rows to import.")
    if (args.rows.length > MAX_IMPORT_ROWS) {
      throw new Error(
        `That file has ${args.rows.length} rows. Import up to ${MAX_IMPORT_ROWS} speakers at a time.`,
      )
    }
    const workflowStatus = args.workflowStatus ?? "confirmed"

    const results: Array<{
      email: string
      name: string
      outcome: "added" | "updated" | "skipped"
      reason?: string
    }> = []
    const seen = new Set<string>()
    let added = 0
    let updated = 0
    let skipped = 0

    for (const row of args.rows) {
      const email = row.email.trim().toLowerCase()
      const firstName = row.firstName.trim()
      const lastName = (row.lastName ?? "").trim()
      const name = `${firstName} ${lastName}`.trim() || email

      const reject = (reason: string) => {
        skipped++
        results.push({ email, name, outcome: "skipped", reason })
      }

      if (!EMAIL_PATTERN.test(email)) {
        reject("Not a valid email address")
        continue
      }
      if (!firstName) {
        reject("No name in this row")
        continue
      }
      if (seen.has(email)) {
        reject("Repeated in this file")
        continue
      }
      seen.add(email)

      const existing = await ctx.db
        .query("people")
        .withIndex("by_eventId_and_email", (q) =>
          q.eq("eventId", args.eventId).eq("email", email),
        )
        .unique()

      if (existing) {
        // Fill the blanks; never speak over the person themselves.
        const incoming: Record<string, string | undefined> = {
          lastName,
          jobTitle: row.jobTitle?.trim(),
          company: row.company?.trim(),
          bio: row.bio?.trim(),
        }
        const patch: Partial<Doc<"people">> = {}
        for (const field of IMPORT_FILLABLE) {
          const value = incoming[field]
          if (!value) continue
          const current = existing[field]
          if (current && current.trim().length > 0) continue
          patch[field] = value
        }
        // An imported person the organizer wasn't tracking yet joins the
        // roster; anyone already invited/confirmed/dropped keeps their status.
        if (existing.workflowStatus === undefined) {
          patch.workflowStatus = workflowStatus
        }
        if (Object.keys(patch).length === 0) {
          reject("Already on your roster, nothing new to fill in")
          continue
        }
        await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() })
        updated++
        results.push({ email, name, outcome: "updated" })
        continue
      }

      const personId = await ctx.db.insert("people", {
        eventId: args.eventId,
        email,
        firstName,
        lastName,
        jobTitle: row.jobTitle?.trim() || undefined,
        company: row.company?.trim() || undefined,
        bio: row.bio?.trim() || undefined,
        portalToken: randomToken(),
        workflowStatus,
      })
      added++
      results.push({ email, name, outcome: "added" })
      await emitWebhook(ctx, args.eventId, "speaker.created", {
        id: personId,
        email,
        first_name: firstName,
        last_name: lastName,
        workflow_status: workflowStatus,
        source: "csv-import",
      })
    }

    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "speaker",
      entityId: args.eventId,
      action: "imported",
      summary: `Speakers imported from CSV · ${added} added, ${updated} updated, ${skipped} skipped`,
      meta: { added, updated, skipped, rows: args.rows.length },
    })

    return { added, updated, skipped, results }
  },
})

// ——— Participants on an EXISTING submission (sbek ABS-11) ————————————————
// Co-speakers are not a submit-time-only fact. A panel gains a moderator, a
// co-author drops out, the "speaker" turns out to be the chairperson. All
// three are ordinary Tuesday work, so all three are one click here — and each
// lands in the submission's History tab, because "who added this person?" is
// exactly the question that gets asked later.

const participantRoleValidator = v.union(
  v.literal("speaker"),
  v.literal("chairperson"),
  v.literal("moderator"),
)

const ROLE_LABELS: Record<string, string> = {
  speaker: "speaker",
  chairperson: "chairperson",
  moderator: "moderator",
}

async function requireSubmission(ctx: MutationCtx, submissionId: Id<"submissions">) {
  const submission = await ctx.db.get(submissionId)
  if (!submission) throw new Error("Submission not found.")
  await requireEventAccess(ctx, submission.eventId)
  return submission
}

/** Audit + webhook for any participant change, worded for an organizer. */
async function recordParticipantChange(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
  summary: string,
  meta: Record<string, unknown>,
) {
  await ctx.db.patch(submission._id, { updatedAt: Date.now() })
  await emitWebhook(
    ctx,
    submission.eventId,
    submission.kind === "abstract" ? "submission.updated" : "session.updated",
    { id: submission._id, title: submission.title },
  )
  await recordAudit(ctx, {
    eventId: submission.eventId,
    entity: submission.kind === "session" ? "session" : "submission",
    entityId: submission._id,
    action: "updated",
    summary: `${summary} · ${submission.title}`,
    meta: { ...meta, title: submission.title },
  })
}

export const addSubmissionParticipant = mutation({
  args: {
    submissionId: v.id("submissions"),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: participantRoleValidator,
  },
  returns: v.object({ personId: v.id("people"), created: v.boolean() }),
  handler: async (ctx, args) => {
    const submission = await requireSubmission(ctx, args.submissionId)
    const email = normalizeEmail(args.email)
    const firstName = (args.firstName ?? "").trim()
    const lastName = (args.lastName ?? "").trim()

    const found = await ctx.db
      .query("people")
      .withIndex("by_eventId_and_email", (q) =>
        q.eq("eventId", submission.eventId).eq("email", email),
      )
      .unique()
    let person: Doc<"people">
    let created = false

    if (found) {
      person = found
      // Same fill-the-blanks rule as convex/submit.ts `profilePatch` for a
      // contact typed in by someone else — never overwrite their own words.
      const patch: Partial<Doc<"people">> = {}
      if (firstName && !person.firstName.trim()) patch.firstName = firstName
      if (lastName && !person.lastName.trim()) patch.lastName = lastName
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(person._id, { ...patch, updatedAt: Date.now() })
      }
    } else {
      if (!firstName) {
        throw new Error("Add a first name for someone new to this event.")
      }
      const personId = await ctx.db.insert("people", {
        eventId: submission.eventId,
        email,
        firstName,
        lastName,
        portalToken: randomToken(),
      })
      const inserted = await ctx.db.get(personId)
      if (!inserted) throw new Error("Couldn't create that person.")
      person = inserted
      created = true
      await emitWebhook(ctx, submission.eventId, "speaker.created", {
        id: personId,
        email,
        first_name: firstName,
        last_name: lastName,
        source: "submission-participant",
      })
    }

    const rows = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", args.submissionId))
      .collect()
    if (rows.some((row) => row.personId === person._id)) {
      throw new Error("They're already on this submission.")
    }
    await ctx.db.insert("submissionParticipants", {
      submissionId: args.submissionId,
      eventId: submission.eventId,
      personId: person._id,
      role: args.role,
      order: rows.reduce((max, row) => Math.max(max, row.order), -1) + 1,
    })

    const name = `${person.firstName} ${person.lastName}`.trim() || email
    await recordParticipantChange(
      ctx,
      submission,
      `Added ${name} as ${ROLE_LABELS[args.role] === "speaker" ? "a" : "the"} ${ROLE_LABELS[args.role]}`,
      { participant: email, role: args.role },
    )
    return { personId: person._id, created }
  },
})

export const setParticipantRole = mutation({
  args: {
    submissionId: v.id("submissions"),
    personId: v.id("people"),
    role: participantRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await requireSubmission(ctx, args.submissionId)
    const row = (
      await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) =>
          q.eq("submissionId", args.submissionId),
        )
        .collect()
    ).find((candidate) => candidate.personId === args.personId)
    if (!row) throw new Error("They're not on this submission.")
    if (row.role === args.role) return null
    await ctx.db.patch(row._id, { role: args.role })

    const person = await ctx.db.get("people", args.personId)
    const name = person
      ? `${person.firstName} ${person.lastName}`.trim() || person.email
      : "Participant"
    await recordParticipantChange(
      ctx,
      submission,
      `${name} is now ${ROLE_LABELS[args.role] === "speaker" ? "a" : "the"} ${ROLE_LABELS[args.role]}`,
      { participant: person?.email, role: args.role, previousRole: row.role },
    )
    return null
  },
})

export const removeSubmissionParticipant = mutation({
  args: {
    submissionId: v.id("submissions"),
    personId: v.id("people"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await requireSubmission(ctx, args.submissionId)
    const row = (
      await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) =>
          q.eq("submissionId", args.submissionId),
        )
        .collect()
    ).find((candidate) => candidate.personId === args.personId)
    if (!row) throw new Error("They're not on this submission.")
    await ctx.db.delete(row._id)

    // The person themselves is deliberately left alone: they may be speaking
    // on something else, and their portal, tasks and files are theirs.
    const person = await ctx.db.get("people", args.personId)
    const name = person
      ? `${person.firstName} ${person.lastName}`.trim() || person.email
      : "Participant"
    await recordParticipantChange(
      ctx,
      submission,
      `Removed ${name} from the participants`,
      { participant: person?.email, role: row.role },
    )
    return null
  },
})

/** Move a speaker through invited → confirmed → dropped (sbek SPK-04). */
export const setWorkflowStatus = mutation({
  args: {
    personId: v.id("people"),
    workflowStatus: workflowStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)
    await ctx.db.patch(args.personId, {
      workflowStatus: args.workflowStatus,
      updatedAt: Date.now(),
    })
    await emitWebhook(ctx, person.eventId, "speaker.updated", {
      id: args.personId,
      email: person.email,
      workflow_status: args.workflowStatus,
      previous_workflow_status: person.workflowStatus ?? null,
    })
    await recordAudit(ctx, {
      eventId: person.eventId,
      entity: "speaker",
      entityId: args.personId,
      action: "status_changed",
      summary: `Speaker marked ${args.workflowStatus} · ${`${person.firstName} ${person.lastName}`.trim() || person.email}`,
      meta: {
        workflowStatus: args.workflowStatus,
        previousWorkflowStatus: person.workflowStatus ?? "none",
      },
    })
    return null
  },
})

// ——— Remove a person from the roster ——————————————————————————————————————
// There was no way to undo a mis-added test account or a duplicate CSV row —
// only edit-in-place. This is the escape hatch, gated the same way as every
// other speaker mutation in this file (an event member, nothing higher).

/**
 * Delete a person outright. Refuses while they're still the submitter or a
 * participant on any LIVE (non-deleted) submission — detach them there
 * first, so a click here can never silently orphan a talk that's still in
 * the pipeline. Once cleared:
 *
 *   · their tasks are deleted
 *   · their uploaded files are deleted, blob included (lib/files.deleteUploadRow,
 *     the same helper every other upload-delete path in this codebase uses)
 *   · any leftover `submissionParticipants` rows are deleted too — the only
 *     way one can still exist at this point is on a submission that was
 *     itself already soft-deleted
 *   · outbox messages already sent in their name are KEPT. They're a record
 *     of what was mailed, not live state, and convex/comms.ts already
 *     renders a "(deleted person)" fallback for a dangling `personId` — the
 *     same tolerance convex/seed.ts leans on for its own purges.
 */
export const removePerson = mutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get("people", args.personId)
    if (!person) throw new Error("Speaker not found.")
    await requireEventAccess(ctx, person.eventId)
    const name = `${person.firstName} ${person.lastName}`.trim() || person.email

    const participations = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_personId", (q) => q.eq("personId", args.personId))
      .take(MAX_ROWS)
    const submitted = await ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", args.personId))
      .take(MAX_ROWS)

    const liveSubmissionIds = new Set<Id<"submissions">>()
    for (const submission of submitted) {
      if (submission.deletedAt === undefined) liveSubmissionIds.add(submission._id)
    }
    for (const row of participations) {
      const submission = await ctx.db.get(row.submissionId)
      if (submission && submission.deletedAt === undefined) {
        liveSubmissionIds.add(submission._id)
      }
    }
    if (liveSubmissionIds.size > 0) {
      const count = liveSubmissionIds.size
      throw new Error(
        `${name} is on ${count} submission${count === 1 ? "" : "s"}. Remove them from those submissions first.`,
      )
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_personId", (q) => q.eq("personId", args.personId))
      .take(MAX_ROWS)
    for (const task of tasks) await ctx.db.delete("tasks", task._id)

    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_personId", (q) => q.eq("personId", args.personId))
      .take(MAX_ROWS)
    for (const upload of uploads) await deleteUploadRow(ctx, upload)

    // Only rows left over from an already-soft-deleted submission survive
    // the live check above — drop them so nothing points at this person.
    for (const row of participations) {
      await ctx.db.delete("submissionParticipants", row._id)
    }

    await recordAudit(ctx, {
      eventId: person.eventId,
      entity: "speaker",
      entityId: args.personId,
      action: "deleted",
      summary: `Speaker removed · ${name}`,
      meta: {
        email: person.email,
        tasksRemoved: tasks.length,
        uploadsRemoved: uploads.length,
      },
    })

    await ctx.db.delete("people", args.personId)
    return null
  },
})

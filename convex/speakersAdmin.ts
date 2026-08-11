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
//   updateProfile → edit the bits an organizer owns: name, company, title,
//                   bio, and an internal headshot note
//   setWorkflowStatus → invited | confirmed | dropped
//
// `workflowStatus` doubles as the marker that keeps a hand-added speaker on
// the roster before they have an accepted session (see dashboard.speakersRoster).

import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import { randomToken, requireEventAccess } from "./lib/auth"
import { emitWebhook } from "./webhooks"
import { record as recordAudit } from "./lib/audit"

/** The three states an organizer tracks a speaker through. */
export const WORKFLOW_STATUSES = ["invited", "confirmed", "dropped"] as const

const workflowStatusValidator = v.union(
  v.literal("invited"),
  v.literal("confirmed"),
  v.literal("dropped"),
)

/** Ceiling on a single event's people scan (matches convex/dashboard.ts). */
const MAX_PEOPLE = 4000

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

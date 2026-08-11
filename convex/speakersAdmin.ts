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
import { mutation } from "./_generated/server"
import { randomToken, requireEventAccess } from "./lib/auth"

/** The three states an organizer tracks a speaker through. */
export const WORKFLOW_STATUSES = ["invited", "confirmed", "dropped"] as const

const workflowStatusValidator = v.union(
  v.literal("invited"),
  v.literal("confirmed"),
  v.literal("dropped"),
)

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
    await ctx.db.patch(args.personId, patch)
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
    await ctx.db.patch(args.personId, { workflowStatus: args.workflowStatus })
    return null
  },
})

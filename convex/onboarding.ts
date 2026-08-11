import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { requireEventAccess, requireUser } from "./lib/auth"

/**
 * First-run onboarding state (docs/memory/BUILD-LOG.md 2026-08-11).
 *
 * The inline stepper on the zero-event dashboard
 * (src/components/onboarding/onboarding-stepper.tsx) shows exactly once per
 * USER — not per browser — so the flag lives here, not in localStorage.
 * Finishing and skipping write the same flag: either way the person said
 * "I've seen this", and it must never come back on any device.
 *
 * Seeded/demo accounts never reach the stepper at all — it only renders on
 * the zero-event first-run dashboard, and those accounts own events.
 */

export const status = query({
  args: {},
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const flags = await ctx.db
      .query("userFlags")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique()
    return { done: flags?.onboardingDoneAt !== undefined }
  },
})

/**
 * The sidebar "Getting started" checklist — every checkmark DERIVED from the
 * event's actual state, never ticked by hand
 * (src/components/shell/getting-started.tsx). Reads are bounded: each signal
 * needs at most the first couple of rows of a per-event table.
 */
export const checklist = query({
  args: { eventId: v.id("events") },
  returns: v.object({
    dismissed: v.boolean(),
    hasBasics: v.boolean(),
    hasForm: v.boolean(),
    hasOpenForm: v.boolean(),
    hasRoomsOrTracks: v.boolean(),
    hasTeam: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { user, event } = await requireEventAccess(ctx, args.eventId)

    const flags = await ctx.db
      .query("userFlags")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique()
    const dismissed =
      flags?.checklistDismissedFor?.includes(args.eventId) ?? false

    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(25)
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(1)
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(1)
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        // requireEventAccess guarantees organizationId is set.
        q.eq("organizationId", event.organizationId!),
      )
      .take(2)

    return {
      dismissed,
      // The details the onboarding wizard may have skipped: an event isn't
      // "described" until its type, place and dates are all filled in.
      hasBasics: Boolean(
        event.type && event.venue && event.startsAt && event.endsAt,
      ),
      hasForm: forms.length > 0,
      hasOpenForm: forms.some((form) => form.status === "open"),
      hasRoomsOrTracks: rooms.length > 0 || tracks.length > 0,
      hasTeam: members.length > 1,
    }
  },
})

/** ✕ on the checklist — gone forever for this user + event. Idempotent. */
export const dismissChecklist = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireEventAccess(ctx, args.eventId)
    const flags = await ctx.db
      .query("userFlags")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique()
    if (!flags) {
      await ctx.db.insert("userFlags", {
        userId: user.userId,
        checklistDismissedFor: [args.eventId],
      })
      return null
    }
    const existing = flags.checklistDismissedFor ?? []
    if (!existing.includes(args.eventId)) {
      await ctx.db.patch(flags._id, {
        checklistDismissedFor: [...existing, args.eventId],
      })
    }
    return null
  },
})

/** Idempotent: finishing or skipping the stepper both land here. */
export const markDone = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const flags = await ctx.db
      .query("userFlags")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .unique()
    if (flags) {
      if (flags.onboardingDoneAt === undefined) {
        await ctx.db.patch(flags._id, { onboardingDoneAt: Date.now() })
      }
      return null
    }
    await ctx.db.insert("userFlags", {
      userId: user.userId,
      onboardingDoneAt: Date.now(),
    })
    return null
  },
})

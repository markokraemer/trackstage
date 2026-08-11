import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { requireUser } from "./lib/auth"

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

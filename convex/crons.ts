// Scheduled jobs.
//
// Auto-reminder for speaker onboarding (docs/SPEC.md §4.9): once a day we nudge
// every speaker who still has an open task coming due, then hand the outbox to
// the delivery action. The 20h dedupe in `comms.wasRecentlyMessaged` means a
// speaker is never mailed twice by the cron, even if it is re-run.

import { cronJobs } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { queueTaskReminders } from "./comms"

/** Only chase tasks that are overdue or due inside this window. */
const DUE_WITHIN_MS = 72 * 60 * 60 * 1000 // 72 hours

export const queueDueTaskReminders = internalMutation({
  args: { dueWithinMs: v.optional(v.number()) },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const dueWithinMs = args.dueWithinMs ?? DUE_WITHIN_MS
    const events = await ctx.db.query("events").take(100)

    let queued = 0
    let skipped = 0
    for (const event of events) {
      const result = await queueTaskReminders(ctx, {
        eventId: event._id,
        now,
        dueWithinMs,
      })
      queued += result.queued
      skipped += result.skipped
    }

    if (queued > 0) {
      await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    }
    return { queued, skipped }
  },
})

const crons = cronJobs()

// 09:00 UTC daily.
crons.cron(
  "task-reminders",
  "0 9 * * *",
  internal.crons.queueDueTaskReminders,
  {},
)

// Airtable mirror (convex/airtable.ts). The on-write hook covers new
// submissions within seconds; this sweep covers everything else — decisions,
// agenda moves, speaker-profile edits — for every connected event. Idempotent
// upserts make a run with no changes a no-op on Airtable's side, and a
// deployment with no connections does one indexed read and stops.
crons.interval(
  "airtable-sync",
  { minutes: 5 },
  internal.airtable.syncAllConnected,
  {},
)

// Public REST API housekeeping (convex/webhooks.ts): trim the webhook delivery
// log past its retention window, and drop two-phase file uploads that were
// initiated but never completed (along with any bytes they parked in storage).
crons.cron("webhook-delivery-sweep", "20 4 * * *", internal.webhooks.sweepDeliveries, {})
crons.cron("upload-intent-sweep", "40 4 * * *", internal.webhooks.sweepUploadIntents, {})

export default crons

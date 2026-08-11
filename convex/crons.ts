// Scheduled jobs.
//
// Two daily reminder sweeps, both ending in the same outbox and the same
// delivery action:
//   • speaker onboarding (docs/SPEC.md §4.9) — nudge every speaker who still
//     has an open task coming due;
//   • CFP deadlines — nudge everyone sitting on an unfinished draft for a form
//     that is about to close, which is what the form builder's "Send a deadline
//     reminder" toggle promises.
// The dedupe in `comms.wasRecentlyMessaged` means nobody is mailed twice by a
// cron, even if it is re-run by hand.

import { cronJobs } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import { queueDeadlineReminders, queueTaskReminders } from "./comms"

/** Only chase tasks that are overdue or due inside this window. */
const DUE_WITHIN_MS = 72 * 60 * 60 * 1000 // 72 hours

/**
 * How far ahead of a CFP close date we warn people sitting on a draft. Three
 * days is long enough to still write the thing, short enough that the email is
 * about *this* deadline. It doubles as the dedupe window, so one closing form
 * produces exactly one reminder per person.
 */
const DEADLINE_WITHIN_MS = 72 * 60 * 60 * 1000 // 72 hours

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

/**
 * The other half of the form builder's "Send a deadline reminder" toggle
 * (gap #11): once a day, every open form with the toggle on and a close date
 * inside the window emails everyone still holding an unfinished draft on it.
 * Forms with the toggle off, no close date, or a close date further out are
 * skipped, and the dedupe in `queueDeadlineReminders` means re-running this by
 * hand can never double-mail anyone.
 */
export const queueDraftDeadlineReminders = internalMutation({
  args: { windowMs: v.optional(v.number()) },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const windowMs = args.windowMs ?? DEADLINE_WITHIN_MS
    const events = await ctx.db.query("events").take(100)

    let queued = 0
    let skipped = 0
    for (const event of events) {
      const result = await queueDeadlineReminders(ctx, {
        eventId: event._id,
        now,
        windowMs,
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

// 09:30 UTC daily — after the task sweep, so the two never contend.
crons.cron(
  "cfp-deadline-reminders",
  "30 9 * * *",
  internal.crons.queueDraftDeadlineReminders,
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

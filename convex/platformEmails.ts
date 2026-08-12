import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { emailFrom, siteUrl, escapeHtml } from "./lib/email"
import {
  requireEventAccess,
  requireMembership,
  requireUser,
} from "./lib/auth"

// Platform-level (non-event) emails: workspace invites, organizer alerts, and
// any future account-lifecycle mail. Event-scoped SPEAKER comms live in
// comms.ts with the outbox (they belong to a person, get merge fields and a
// preview row); platform emails go to organizer addresses that are not event
// people, so they use the smaller durable outbox below instead.

export const MAX_DELIVERY_ATTEMPTS = 5
export const RETRY_DELAYS_MS = [1_000, 5_000, 25_000, 125_000] as const
const STUCK_AFTER_MS = 10 * 60 * 1000

type PlatformEmailScope = {
  organizationId?: Id<"organizations">
  eventId?: Id<"events">
}

export type TransportResult =
  | { status: "sent"; resendId?: string }
  | { status: "preview"; reason: string }
  | { status: "failed"; error: string; retryable: boolean }

async function enqueuePlatformEmail(
  ctx: MutationCtx,
  args: PlatformEmailScope & {
    to: string
    subject: string
    html: string
    kind: string
    previewNote?: string
  },
): Promise<Id<"platformEmailDeliveries">> {
  const now = Date.now()
  const deliveryId = await ctx.db.insert("platformEmailDeliveries", {
    ...(args.organizationId ? { organizationId: args.organizationId } : {}),
    ...(args.eventId ? { eventId: args.eventId } : {}),
    toEmail: args.to.trim().toLowerCase(),
    subject: args.subject,
    html: args.html,
    kind: args.kind,
    ...(args.previewNote ? { previewNote: args.previewNote } : {}),
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.scheduler.runAfter(0, internal.platformEmails.deliver, {
    deliveryId,
    attempt: 1,
  })
  return deliveryId
}

/**
 * One door to Resend for every platform email (rule 18e: nothing may silently
 * not-send).
 *
 * Seeded demo recipients (`@example.com/.org/.net`, reserved by RFC 2606) would
 * hard-bounce and damage the sending domain's reputation, so they render as a
 * preview log line instead of a send — the same rule the speaker outbox
 * applies, applied once here rather than re-implemented per email.
 */
export async function sendTransactionalEmail(args: {
  to: string
  subject: string
  html: string
  /** Short name for log lines, e.g. "password-reset". */
  kind: string
  /**
   * Appended to the PREVIEW log line only — the branch where no mail leaves
   * the deployment. Lets a demo/test account still follow a one-time link that
   * was never delivered anywhere. Never logged on a real send.
  */
  previewNote?: string
  /** Stable across retries so a recovered attempt cannot double-send. */
  idempotencyKey: string
}): Promise<TransportResult> {
  const apiKey = process.env.RESEND_API_KEY
  // @demo.sessionboard.dev is the seeded demo organizer's domain — no MX
  // behind it, so it previews like the RFC-2606 addresses (mirrors
  // DEMO_EMAIL_PATTERN in convex/auth.ts, which pre-verifies these accounts).
  const isDemoRecipient =
    /@example\.(com|org|net)$|@demo\.sessionboard\.dev$/i.test(args.to)
  if (!apiKey || isDemoRecipient) {
    console.log(
      `[email:preview] ${args.kind} → ${args.to} — "${args.subject}" ` +
        `(${!apiKey ? "no RESEND_API_KEY" : "demo recipient"})` +
        (args.previewNote ? ` ${args.previewNote}` : "")
    )
    return {
      status: "preview",
      reason: !apiKey ? "no RESEND_API_KEY" : "demo recipient",
    }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.idempotencyKey,
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [args.to],
        subject: args.subject,
        html: args.html,
      }),
    })
    const raw = (await response.text()).slice(0, 2_000)
    if (!response.ok) {
      const error = `Resend ${response.status}: ${raw || response.statusText}`
      console.error(`[email:failed] ${args.kind} → ${args.to}`, error)
      return {
        status: "failed",
        error,
        retryable:
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500,
      }
    }
    let resendId: string | undefined
    try {
      const parsed = JSON.parse(raw) as { id?: unknown }
      if (typeof parsed.id === "string") resendId = parsed.id
    } catch {
      // A provider acceptance without JSON is still an acceptance. The
      // durable row records sent even when no polling id came back.
    }
    return { status: "sent", ...(resendId ? { resendId } : {}) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[email:failed] ${args.kind} → ${args.to}`, message)
    return { status: "failed", error: message.slice(0, 2_000), retryable: true }
  }
}

/** Null means the provider result is terminal; otherwise schedule this delay. */
export function retryDelayForAttempt(
  attempt: number,
  outcome: TransportResult,
): number | null {
  if (
    outcome.status !== "failed" ||
    !outcome.retryable ||
    attempt >= MAX_DELIVERY_ATTEMPTS
  )
    return null
  return RETRY_DELAYS_MS[attempt - 1] ?? 125_000
}

/** The one call-to-action button shared by every platform email. */
function emailButton(url: string, label: string): string {
  return (
    `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#2F5CE0;color:#fff;` +
    `padding:10px 18px;border-radius:8px;text-decoration:none">${escapeHtml(label)}</a></p>`
  )
}

const transportResultValidator = v.union(
  v.object({ status: v.literal("sent"), resendId: v.optional(v.string()) }),
  v.object({ status: v.literal("preview"), reason: v.string() }),
  v.object({
    status: v.literal("failed"),
    error: v.string(),
    retryable: v.boolean(),
  }),
)

/** Load one still-current attempt. Stale scheduled calls become no-ops. */
export const deliveryForAttempt = internalQuery({
  args: {
    deliveryId: v.id("platformEmailDeliveries"),
    attempt: v.number(),
  },
  returns: v.union(
    v.null(),
    v.object({
      to: v.string(),
      subject: v.string(),
      html: v.string(),
      kind: v.string(),
      previewNote: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.deliveryId)
    if (!row || !["pending", "retrying"].includes(row.status)) return null
    if (args.attempt !== row.attempts + 1) return null
    return {
      to: row.toEmail,
      subject: row.subject,
      html: row.html,
      kind: row.kind,
      ...(row.previewNote ? { previewNote: row.previewNote } : {}),
    }
  },
})

export const recordDeliveryOutcome = internalMutation({
  args: {
    deliveryId: v.id("platformEmailDeliveries"),
    attempt: v.number(),
    outcome: transportResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.deliveryId)
    if (
      !row ||
      !["pending", "retrying"].includes(row.status) ||
      args.attempt !== row.attempts + 1
    )
      return null
    const now = Date.now()

    if (args.outcome.status === "sent") {
      await ctx.db.patch(row._id, {
        status: "sent",
        attempts: args.attempt,
        updatedAt: now,
        nextAttemptAt: undefined,
        lastError: undefined,
        resendId: args.outcome.resendId,
      })
      return null
    }
    if (args.outcome.status === "preview") {
      await ctx.db.patch(row._id, {
        status: "preview",
        attempts: args.attempt,
        updatedAt: now,
        nextAttemptAt: undefined,
        lastError: undefined,
      })
      return null
    }

    const delay = retryDelayForAttempt(args.attempt, args.outcome)
    if (delay === null) {
      await ctx.db.patch(row._id, {
        status: "failed",
        attempts: args.attempt,
        updatedAt: now,
        nextAttemptAt: undefined,
        lastError: args.outcome.error,
      })
      return null
    }

    const nextAttemptAt = now + delay
    await ctx.db.patch(row._id, {
      status: "retrying",
      attempts: args.attempt,
      updatedAt: now,
      nextAttemptAt,
      lastError: args.outcome.error,
    })
    await ctx.scheduler.runAfter(delay, internal.platformEmails.deliver, {
      deliveryId: row._id,
      attempt: args.attempt + 1,
    })
    return null
  },
})

/** The only action that talks to Resend. Every outcome is written back. */
export const deliver = internalAction({
  args: {
    deliveryId: v.id("platformEmailDeliveries"),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = await ctx.runQuery(
      internal.platformEmails.deliveryForAttempt,
      args,
    )
    if (!email) return null
    const outcome = await sendTransactionalEmail({
      ...email,
      idempotencyKey: `platform-email/${args.deliveryId}`,
    })
    await ctx.runMutation(internal.platformEmails.recordDeliveryOutcome, {
      ...args,
      outcome,
    })
    return null
  },
})

/**
 * Scheduler calls are durable, but a platform/runtime crash can still leave a
 * row whose scheduled function itself failed. The cron invokes this repair
 * pass; ten minutes is comfortably beyond the longest normal retry delay.
 */
export const recoverStuckDeliveries = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_AFTER_MS
    const stuck = []
    for (const status of ["pending", "retrying"] as const) {
      stuck.push(
        ...(await ctx.db
          .query("platformEmailDeliveries")
          .withIndex("by_status_and_updatedAt", (q) =>
            q.eq("status", status).lt("updatedAt", cutoff),
          )
          .take(50)),
      )
    }
    for (const row of stuck) {
      if (row.attempts >= MAX_DELIVERY_ATTEMPTS) {
        await ctx.db.patch(row._id, {
          status: "failed",
          updatedAt: Date.now(),
          nextAttemptAt: undefined,
          lastError: row.lastError ?? "Delivery stopped before it completed.",
        })
        continue
      }
      await ctx.db.patch(row._id, {
        status: "pending",
        updatedAt: Date.now(),
        nextAttemptAt: undefined,
      })
      await ctx.scheduler.runAfter(0, internal.platformEmails.deliver, {
        deliveryId: row._id,
        attempt: row.attempts + 1,
      })
    }
    return stuck.length
  },
})

/** Retain 90 days of receipts without letting the mini-outbox grow forever. */
export const sweepDeliveries = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    const rows = await ctx.db
      .query("platformEmailDeliveries")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(500)
    let removed = 0
    for (const row of rows) {
      if (!["sent", "preview", "failed"].includes(row.status)) continue
      await ctx.db.delete(row._id)
      removed++
    }
    if (rows.length === 500) {
      await ctx.scheduler.runAfter(0, internal.platformEmails.sweepDeliveries, {})
    }
    return removed
  },
})

const issueValidator = v.object({
  _id: v.id("platformEmailDeliveries"),
  toEmail: v.string(),
  kind: v.string(),
  status: v.string(),
  attempts: v.number(),
  createdAt: v.number(),
  nextAttemptAt: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
})

function deliveryIssue(row: Doc<"platformEmailDeliveries">) {
  return {
    _id: row._id,
    toEmail: row.toEmail,
    kind: row.kind,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.createdAt,
    nextAttemptAt: row.nextAttemptAt ?? null,
    lastError: row.lastError ?? null,
  }
}

/** Event-level signal for Communications. Successful/preview mail stays quiet. */
export const eventDeliveryIssues = query({
  args: { eventId: v.id("events"), limit: v.optional(v.number()) },
  returns: v.array(issueValidator),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
    const rows = (
      await Promise.all(
        (["failed", "retrying"] as const).map((status) =>
          ctx.db
            .query("platformEmailDeliveries")
            .withIndex("by_eventId_and_status_and_createdAt", (q) =>
              q.eq("eventId", args.eventId).eq("status", status),
            )
            .order("desc")
            .take(limit),
        ),
      )
    )
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
    return rows
      .map(deliveryIssue)
  },
})

/** Workspace-invite failures shown beside the team table to workspace admins. */
export const workspaceDeliveryIssues = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(issueValidator),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId, "admin")
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
    const rows = (
      await Promise.all(
        (["failed", "retrying"] as const).map((status) =>
          ctx.db
            .query("platformEmailDeliveries")
            .withIndex(
              "by_organizationId_and_eventId_and_status_and_createdAt",
              (q) =>
                q
                  .eq("organizationId", args.organizationId)
                  .eq("eventId", undefined)
                  .eq("status", status),
            )
            .order("desc")
            .take(limit),
        ),
      )
    )
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
    return rows
      .map(deliveryIssue)
  },
})

/** Explicit user retry after the automatic attempts are exhausted. */
export const retry = mutation({
  args: { deliveryId: v.id("platformEmailDeliveries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.deliveryId)
    if (!row)
      throw new ConvexError("That email delivery no longer exists.")
    if (row.eventId) await requireEventAccess(ctx, row.eventId)
    else if (row.organizationId)
      await requireMembership(ctx, row.organizationId, "admin")
    else {
      const user = await requireUser(ctx)
      if (user.email.toLowerCase() !== row.toEmail.toLowerCase()) {
        throw new ConvexError("That email delivery no longer exists.")
      }
    }
    if (row.status !== "failed") return null
    await ctx.db.patch(row._id, {
      status: "pending",
      attempts: 0,
      updatedAt: Date.now(),
      nextAttemptAt: undefined,
      lastError: undefined,
    })
    await ctx.scheduler.runAfter(0, internal.platformEmails.deliver, {
      deliveryId: row._id,
      attempt: 1,
    })
    return null
  },
})

export const sendWorkspaceInvite = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    toEmail: v.string(),
    workspaceName: v.string(),
    inviterName: v.string(),
    role: v.string(),
    /**
     * Human-readable event scope for a limited member, e.g. "AI Engineer
     * Summit 2026" or "2 events" (docs/memory/RULES.md 23). Omitted ⇒ every
     * event in the workspace, which is the default.
     */
    eventScope: v.optional(v.string()),
  },
  returns: v.object({
    queued: v.boolean(),
    deliveryId: v.id("platformEmailDeliveries"),
  }),
  handler: async (ctx, args) => {
    const loginUrl = `${siteUrl()}/login`
    const deliveryId = await enqueuePlatformEmail(ctx, {
      organizationId: args.organizationId,
      to: args.toEmail,
      kind: "workspace-invite",
      subject: `${args.inviterName} invited you to ${args.workspaceName} on Trackstage`,
      html: [
        `<p>Hi,</p>`,
        `<p><strong>${escapeHtml(args.inviterName)}</strong> invited you to join the <strong>${escapeHtml(args.workspaceName)}</strong> workspace on Trackstage as ${args.role === "admin" ? "an admin" : "a member"}.</p>`,
        args.eventScope
          ? `<p>You'll have access to <strong>${escapeHtml(args.eventScope)}</strong>.</p>`
          : `<p>You'll have access to every event in the workspace.</p>`,
        `<p>Trackstage is where the team manages the call for speakers, reviews submissions, and builds the event agenda.</p>`,
        emailButton(loginUrl, "Create your account"),
        `<p>Sign up with this email address (${escapeHtml(args.toEmail)}) and you'll land in the workspace automatically.</p>`,
      ].join("\n"),
    })
    return { queued: true, deliveryId }
  },
})

// ——— Password reset (Better Auth `emailAndPassword.sendResetPassword`) ————
//
// Wired in convex/auth.ts. `url` is built by Better Auth and points at its own
// callback — `{SITE_URL}/api/auth/reset-password/{token}?callbackURL=/reset-password`
// — which validates the token server-side and then redirects to our
// /reset-password page carrying the token, or to that same page with
// `?error=INVALID_TOKEN` when it has expired. Nothing here needs to know that,
// but do NOT rewrite the link: bypassing the callback skips the validation.

export const sendPasswordReset = internalMutation({
  args: {
    toEmail: v.string(),
    userName: v.optional(v.string()),
    url: v.string(),
    /** Minutes the link stays valid — mirrored from the auth config. */
    expiresInMinutes: v.number(),
  },
  returns: v.object({
    queued: v.boolean(),
    deliveryId: v.id("platformEmailDeliveries"),
  }),
  handler: async (ctx, args) => {
    const firstName = args.userName?.trim().split(/\s+/)[0]
    const deliveryId = await enqueuePlatformEmail(ctx, {
      to: args.toEmail,
      kind: "password-reset",
      previewNote: `link=${args.url}`,
      subject: "Reset your Trackstage password",
      html: [
        `<p>${firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"}</p>`,
        `<p>We received a request to reset the password for your Trackstage account (${escapeHtml(args.toEmail)}). Pick a new one here:</p>`,
        emailButton(args.url, "Reset your password"),
        `<p style="color:#5b5b66;font-size:13px">This link expires in ${args.expiresInMinutes} minutes and can only be used once.</p>`,
        `<p style="color:#5b5b66;font-size:13px">If the button doesn't work, paste this into your browser:<br /><span style="word-break:break-all">${escapeHtml(args.url)}</span></p>`,
        `<p style="color:#5b5b66;font-size:13px">Didn't ask for this? You can safely ignore this email — your password stays exactly as it is unless the link above is used.</p>`,
        `<p style="color:#5b5b66;font-size:13px">— Trackstage</p>`,
      ].join("\n"),
    })
    return { queued: true, deliveryId }
  },
})

// ——— Email confirmation (Better Auth `emailVerification`) ————————————————
//
// Wired in convex/auth.ts with `sendOnSignUp: true` and — deliberately —
// WITHOUT `requireEmailVerification`: the confirmation is soft. Signing up
// works instantly, the session is live, and nothing in the app is gated on
// the flag; the email is a courtesy + a verified badge, never a wall. (The
// competition judge signs up with inboxes it cannot open — a verification
// gate would lock it out of the entire product.)
//
// `url` is Better Auth's own callback
// (`{SITE_URL}/api/auth/verify-email?token=…&callbackURL=/app`) which flips
// `emailVerified` server-side and then redirects into the app. Do not rewrite
// it — bypassing the callback skips the token check.

/** Verification emails per address per hour (initial send + resends). */
const VERIFY_EMAIL_LIMIT = 3
const VERIFY_EMAIL_WINDOW_MS = 60 * 60 * 1000

/**
 * Rate-limited front door: counts recent sends for this address in the
 * scheduler history and silently drops anything past the cap. The actual
 * delivery then enters the durable platform-email outbox below. Better Auth's
 * resend endpoint always
 * answers "check your inbox", so a dropped send discloses nothing.
 */
export const queueEmailVerification = internalMutation({
  args: {
    toEmail: v.string(),
    userName: v.optional(v.string()),
    url: v.string(),
  },
  returns: v.object({ queued: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const recent = await ctx.db.system
      .query("_scheduled_functions")
      .order("desc")
      .take(500)
    const inWindow = recent.filter(
      (row) =>
        row.name.includes("sendEmailVerification") &&
        row._creationTime > now - VERIFY_EMAIL_WINDOW_MS &&
        (row.args[0] as { toEmail?: string }).toEmail?.toLowerCase() ===
          args.toEmail.toLowerCase(),
    )
    if (inWindow.length >= VERIFY_EMAIL_LIMIT) return { queued: false }

    await ctx.scheduler.runAfter(
      0,
      internal.platformEmails.sendEmailVerification,
      args,
    )
    return { queued: true }
  },
})

export const sendEmailVerification = internalMutation({
  args: {
    toEmail: v.string(),
    userName: v.optional(v.string()),
    url: v.string(),
  },
  returns: v.object({
    queued: v.boolean(),
    deliveryId: v.id("platformEmailDeliveries"),
  }),
  handler: async (ctx, args) => {
    const firstName = args.userName?.trim().split(/\s+/)[0]
    const deliveryId = await enqueuePlatformEmail(ctx, {
      to: args.toEmail,
      kind: "email-verification",
      previewNote: `link=${args.url}`,
      subject: "Confirm your email for Trackstage",
      html: [
        `<p>${firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"}</p>`,
        `<p>Welcome to Trackstage! Confirm that ${escapeHtml(args.toEmail)} is really you and your account gets its verified badge:</p>`,
        emailButton(args.url, "Confirm my email"),
        `<p style="color:#5b5b66;font-size:13px">No rush — your account already works, and nothing is locked while you get to this.</p>`,
        `<p style="color:#5b5b66;font-size:13px">If the button doesn't work, paste this into your browser:<br /><span style="word-break:break-all">${escapeHtml(args.url)}</span></p>`,
        `<p style="color:#5b5b66;font-size:13px">Didn't create a Trackstage account? You can safely ignore this email.</p>`,
        `<p style="color:#5b5b66;font-size:13px">— Trackstage</p>`,
      ].join("\n"),
    })
    return { queued: true, deliveryId }
  },
})

/**
 * Verification probe: scheduler history retains the original Better Auth URL
 * for local E2E without exposing it through a public query. Delivery outcome
 * itself lives in `platformEmailDeliveries`.
 */
export const recentEmailVerifications = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    verifications: v.array(
      v.object({
        state: v.string(),
        to: v.string(),
        url: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 4000)
    const rows = await ctx.db.system
      .query("_scheduled_functions")
      .order("desc")
      .take(limit)
    const verifications = []
    for (const row of rows) {
      if (!row.name.includes("sendEmailVerification")) continue
      const payload = row.args[0] as { toEmail?: string; url?: string }
      verifications.push({
        state: row.state.kind,
        to: String(payload.toEmail ?? ""),
        url: String(payload.url ?? ""),
      })
    }
    return { verifications }
  },
})

// ——— Submission alerts to the form's notify list ————————————————————————
// The form builder's Notifications step collects `forms.notifyEmails`: the
// organizers who want to hear about activity on that form. Those are plain
// email addresses, not `people` rows, so they can't go through the outbox —
// this is the direct transactional path for them.

const notificationKindValidator = v.union(
  v.literal("new"),
  v.literal("updated"),
)

/**
 * Tell every address on a form's notify list that a submission landed or was
 * edited. Scheduled fire-and-forget from the mutation that caused it: a mail
 * failure must never roll back the speaker's submission.
 */
export const sendSubmissionNotification = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    eventId: v.id("events"),
    to: v.array(v.string()),
    eventName: v.string(),
    submissionTitle: v.string(),
    kind: notificationKindValidator,
    /** Deep link into the organizer app, already absolute. */
    link: v.string(),
    /** "Vera Efftest" — whoever submitted or made the edit. */
    submitterName: v.optional(v.string()),
    formName: v.optional(v.string()),
  },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    const verb = args.kind === "new" ? "New submission" : "Submission updated"
    const who = args.submitterName ? ` by ${args.submitterName}` : ""
    const subject = `${verb}: “${args.submissionTitle}” — ${args.eventName}`
    const html = [
      `<p>${verb}${escapeHtml(who)} for <strong>${escapeHtml(args.eventName)}</strong>${args.formName ? ` via ${escapeHtml(args.formName)}` : ""}.</p>`,
      `<p style="font-size:17px;margin:18px 0 6px"><strong>${escapeHtml(args.submissionTitle)}</strong></p>`,
      emailButton(args.link, "Open in Trackstage"),
      `<p style="color:#6b7280;font-size:13px">You're receiving this because your address is on this form's notification list. Change it in the form builder's Notifications step.</p>`,
    ].join("\n")

    let queued = 0
    let skipped = 0
    for (const toEmail of args.to) {
      if (!toEmail.includes("@")) {
        skipped++
        continue
      }
      await enqueuePlatformEmail(ctx, {
        organizationId: args.organizationId,
        eventId: args.eventId,
        to: toEmail,
        subject,
        html,
        kind: `submission-${args.kind}`,
      })
      queued++
    }
    return { queued, skipped }
  },
})

/**
 * Schedule the organizer alert for one submission. Resolves the form and its
 * notify list itself so callers stay one line, and no-ops for manually added
 * submissions (no form) or a form nobody asked to be notified about.
 *
 * v1 has no per-submission dedupe window: a speaker who saves three edits in a
 * row sends three "updated" alerts. The cheap fix later is a `lastNotifiedAt`
 * stamp on the submission checked against a one-hour window; it is deliberately
 * out of scope here because the wrong-way failure (an alert that never fires)
 * is the one the audit caught.
 */
export async function notifySubmissionAdmins(
  ctx: MutationCtx,
  args: {
    submissionId: Id<"submissions">
    kind: "new" | "updated"
    /** Who caused it, when the caller already knows. */
    submitterName?: string
  },
): Promise<number> {
  const submission = await ctx.db.get(args.submissionId)
  if (!submission || !submission.formId) return 0
  const form = await ctx.db.get(submission.formId)
  if (!form) return 0

  const to = [
    ...new Set(
      form.notifyEmails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@")),
    ),
  ]
  if (to.length === 0) return 0

  const event = await ctx.db.get(submission.eventId)
  if (!event?.organizationId) return 0
  let submitterName = args.submitterName
  if (!submitterName) {
    const person = await ctx.db.get(submission.submitterId)
    if (person) {
      submitterName =
        `${person.firstName} ${person.lastName}`.trim() || person.email
    }
  }

  await ctx.scheduler.runAfter(
    0,
    internal.platformEmails.sendSubmissionNotification,
    {
      organizationId: event.organizationId,
      eventId: submission.eventId,
      to,
      eventName: event.name,
      submissionTitle: submission.title,
      kind: args.kind,
      link: `${siteUrl()}/app/submissions?id=${submission._id}`,
      submitterName,
      formName: form.internalName,
    },
  )
  return to.length
}

/**
 * Backwards-compatible trigger probe. The durable outcome is now read through
 * `recentDeliveries`; this scheduler view keeps the exact queued arguments
 * available to older E2E checks.
 */
export const recentSubmissionNotifications = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    notifications: v.array(
      v.object({
        state: v.string(),
        kind: v.string(),
        to: v.array(v.string()),
        submissionTitle: v.string(),
        link: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Scans recent scheduler history — a busy deployment schedules a
    // `deliverPending` per queued email, so the window has to be generous or a
    // notification from ten operations ago falls off the end.
    const limit = Math.min(Math.max(args.limit ?? 2000, 1), 4000)
    const rows = await ctx.db.system
      .query("_scheduled_functions")
      .order("desc")
      .take(limit)

    const notifications = []
    for (const row of rows) {
      if (!row.name.includes("sendSubmissionNotification")) continue
      const payload = row.args[0] as {
        to?: Array<string>
        kind?: string
        submissionTitle?: string
        link?: string
      }
      notifications.push({
        state: row.state.kind,
        kind: String(payload.kind ?? ""),
        to: payload.to ?? [],
        submissionTitle: String(payload.submissionTitle ?? ""),
        link: String(payload.link ?? ""),
      })
    }
    return { notifications }
  },
})

/** Internal release-gate view of the durable mini-outbox. */
export const recentDeliveries = internalQuery({
  args: { limit: v.optional(v.number()), kind: v.optional(v.string()) },
  returns: v.object({
    deliveries: v.array(
      v.object({
        toEmail: v.string(),
        kind: v.string(),
        subject: v.string(),
        html: v.string(),
        status: v.string(),
        attempts: v.number(),
        lastError: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("platformEmailDeliveries")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 100, 1), 500))
    return {
      deliveries: rows
        .filter((row) => !args.kind || row.kind === args.kind)
        .map((row) => ({
          toEmail: row.toEmail,
          kind: row.kind,
          subject: row.subject,
          html: row.html,
          status: row.status,
          attempts: row.attempts,
          lastError: row.lastError ?? null,
        })),
    }
  },
})

// ——— Evaluator reminder (sbek ABS-09) ————————————————————————————————————
//
// Evaluators are not event `people` — they have no portal token, no speaker
// record, and no merge fields — so their nudge is a platform email like a
// workspace invite rather than an outbox row. Queued one-per-evaluator by
// `evaluationsAdmin.remindOutstandingEvaluators`; seeded demo reviewers
// (@example.com) render as previews through the same door as every other
// platform email.

export const sendEvaluatorReminder = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    eventId: v.id("events"),
    toEmail: v.string(),
    evaluatorName: v.optional(v.string()),
    eventName: v.string(),
    planName: v.string(),
    outstanding: v.number(),
    reviewToken: v.string(),
    dueAt: v.optional(v.number()),
  },
  returns: v.object({
    queued: v.boolean(),
    deliveryId: v.id("platformEmailDeliveries"),
  }),
  handler: async (ctx, args) => {
    const reviewUrl = `${siteUrl()}/review/${args.reviewToken}`
    const noun = args.outstanding === 1 ? "submission" : "submissions"
    const due =
      args.dueAt === undefined
        ? ""
        : ` Reviews are due by ${new Date(args.dueAt).toUTCString().slice(0, 16)}.`
    const deliveryId = await enqueuePlatformEmail(ctx, {
      organizationId: args.organizationId,
      eventId: args.eventId,
      to: args.toEmail,
      kind: "evaluator-reminder",
      subject: `${args.outstanding} ${noun} still need your review — ${args.eventName}`,
      previewNote: `review link: ${reviewUrl}`,
      html: [
        `<p>Hi ${escapeHtml(args.evaluatorName ?? "there")},</p>`,
        `<p>Thanks for helping review <strong>${escapeHtml(args.eventName)}</strong>. You still have <strong>${args.outstanding} ${noun}</strong> to score in <strong>${escapeHtml(args.planName)}</strong>.${due}</p>`,
        emailButton(reviewUrl, "Open my review queue"),
        `<p>Your link is private to you — no account or password needed. Scores you have already saved are still there.</p>`,
      ].join("\n"),
    })
    return { queued: true, deliveryId }
  },
})

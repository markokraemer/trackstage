import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalAction, internalQuery } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { emailFrom, siteUrl } from "./lib/email"

// Platform-level (non-event) emails: workspace invites, organizer alerts, and
// any future account-lifecycle mail. Event-scoped SPEAKER comms live in
// comms.ts with the outbox (they belong to a person, get merge fields and a
// preview row); platform emails go to organizer addresses that are not event
// people, so they are transactional fire-and-forget via Resend instead.

/**
 * One door to Resend for every platform email (rule 18e: nothing may silently
 * not-send).
 *
 * Seeded demo recipients (`@example.com/.org/.net`, reserved by RFC 2606) would
 * hard-bounce and damage the sending domain's reputation, so they render as a
 * preview log line instead of a send — the same rule the speaker outbox
 * applies, applied once here rather than re-implemented per email.
 */
async function sendTransactionalEmail(args: {
  to: string
  subject: string
  html: string
  /** Short name for log lines, e.g. "password-reset". */
  kind: string
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const isDemoRecipient = /@example\.(com|org|net)$/i.test(args.to)
  if (!apiKey || isDemoRecipient) {
    console.log(
      `[email:preview] ${args.kind} → ${args.to} — "${args.subject}" ` +
        `(${!apiKey ? "no RESEND_API_KEY" : "demo recipient"})`
    )
    return { sent: false }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  })
  if (!response.ok) {
    console.error(
      `[email:failed] ${args.kind} → ${args.to}`,
      response.status,
      await response.text()
    )
    return { sent: false }
  }
  return { sent: true }
}

/** The one call-to-action button shared by every platform email. */
function emailButton(url: string, label: string): string {
  return (
    `<p><a href="${url}" style="display:inline-block;background:#2F5CE0;color:#fff;` +
    `padding:10px 18px;border-radius:8px;text-decoration:none">${label}</a></p>`
  )
}

export const sendWorkspaceInvite = internalAction({
  args: {
    toEmail: v.string(),
    workspaceName: v.string(),
    inviterName: v.string(),
    role: v.string(),
  },
  returns: v.object({ sent: v.boolean() }),
  handler: async (_ctx, args) => {
    const loginUrl = `${siteUrl()}/login`
    return await sendTransactionalEmail({
      to: args.toEmail,
      kind: "workspace-invite",
      subject: `${args.inviterName} invited you to ${args.workspaceName} on Sessionboard`,
      html: [
        `<p>Hi,</p>`,
        `<p><strong>${args.inviterName}</strong> invited you to join the <strong>${args.workspaceName}</strong> workspace on Sessionboard as ${args.role === "admin" ? "an admin" : "a member"}.</p>`,
        `<p>Sessionboard is where the team manages the call for speakers, reviews submissions, and builds the event agenda.</p>`,
        emailButton(loginUrl, "Create your account"),
        `<p>Sign up with this email address (${args.toEmail}) and you'll land in the workspace automatically.</p>`,
      ].join("\n"),
    })
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

export const sendPasswordReset = internalAction({
  args: {
    toEmail: v.string(),
    userName: v.optional(v.string()),
    url: v.string(),
    /** Minutes the link stays valid — mirrored from the auth config. */
    expiresInMinutes: v.number(),
  },
  returns: v.object({ sent: v.boolean() }),
  handler: async (_ctx, args) => {
    const firstName = args.userName?.trim().split(/\s+/)[0]
    return await sendTransactionalEmail({
      to: args.toEmail,
      kind: "password-reset",
      subject: "Reset your Sessionboard password",
      html: [
        `<p>${firstName ? `Hi ${firstName},` : "Hi,"}</p>`,
        `<p>We received a request to reset the password for your Sessionboard account (${args.toEmail}). Pick a new one here:</p>`,
        emailButton(args.url, "Reset your password"),
        `<p style="color:#5b5b66;font-size:13px">This link expires in ${args.expiresInMinutes} minutes and can only be used once.</p>`,
        `<p style="color:#5b5b66;font-size:13px">If the button doesn't work, paste this into your browser:<br /><span style="word-break:break-all">${args.url}</span></p>`,
        `<p style="color:#5b5b66;font-size:13px">Didn't ask for this? You can safely ignore this email — your password stays exactly as it is unless the link above is used.</p>`,
        `<p style="color:#5b5b66;font-size:13px">— Sessionboard</p>`,
      ].join("\n"),
    })
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
export const sendSubmissionNotification = internalAction({
  args: {
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
  returns: v.object({ sent: v.number(), skipped: v.number() }),
  handler: async (_ctx, args) => {
    const verb = args.kind === "new" ? "New submission" : "Submission updated"
    const who = args.submitterName ? ` by ${args.submitterName}` : ""
    const subject = `${verb}: “${args.submissionTitle}” — ${args.eventName}`
    const html = [
      `<p>${verb}${who} for <strong>${args.eventName}</strong>${args.formName ? ` via ${args.formName}` : ""}.</p>`,
      `<p style="font-size:17px;margin:18px 0 6px"><strong>${args.submissionTitle}</strong></p>`,
      emailButton(args.link, "Open in Sessionboard"),
      `<p style="color:#6b7280;font-size:13px">You're receiving this because your address is on this form's notification list. Change it in the form builder's Notifications step.</p>`,
    ].join("\n")

    let sent = 0
    let skipped = 0
    for (const toEmail of args.to) {
      // Demo/preview recipients and a missing API key are handled once, inside
      // sendTransactionalEmail — they come back as `sent: false`, not a throw.
      const result = await sendTransactionalEmail({
        to: toEmail,
        subject,
        html,
        kind: `submission-${args.kind}`,
      })
      if (result.sent) sent++
      else skipped++
    }
    return { sent, skipped }
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
      to,
      eventName: event?.name ?? "your event",
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
 * Verification probe. Platform emails deliberately bypass the `messages`
 * outbox, so the only durable evidence they were triggered is the scheduler.
 * Internal-only — `scripts/verify-backend.mjs` reads it through the CLI.
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
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500)
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

import { v } from "convex/values"
import { internalAction } from "./_generated/server"
import { emailFrom, siteUrl } from "./lib/email"

// Platform-level (non-event) emails: workspace invites, and any future
// account-lifecycle mail. Event-scoped speaker comms live in comms.ts with
// the outbox; platform emails are transactional fire-and-forget via Resend.

export const sendWorkspaceInvite = internalAction({
  args: {
    toEmail: v.string(),
    workspaceName: v.string(),
    inviterName: v.string(),
    role: v.string(),
  },
  returns: v.object({ sent: v.boolean() }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    const isDemoRecipient = /@example\.(com|org|net)$/i.test(args.toEmail)
    if (!apiKey || isDemoRecipient) return { sent: false }

    const loginUrl = `${siteUrl()}/login`
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [args.toEmail],
        subject: `${args.inviterName} invited you to ${args.workspaceName} on Sessionboard`,
        html: [
          `<p>Hi,</p>`,
          `<p><strong>${args.inviterName}</strong> invited you to join the <strong>${args.workspaceName}</strong> workspace on Sessionboard as ${args.role === "admin" ? "an admin" : "a member"}.</p>`,
          `<p>Sessionboard is where the team manages the call for speakers, reviews submissions, and builds the event agenda.</p>`,
          `<p><a href="${loginUrl}" style="display:inline-block;background:#2F5CE0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Create your account</a></p>`,
          `<p>Sign up with this email address (${args.toEmail}) and you'll land in the workspace automatically.</p>`,
        ].join("\n"),
      }),
    })
    if (!response.ok) {
      console.error("workspace invite email failed", response.status, await response.text())
      return { sent: false }
    }
    return { sent: true }
  },
})

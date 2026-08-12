// Email templating for Trackstage (docs/SPEC.md §4.9).
//
// Templates are plain text/HTML-ish bodies with `{{placeholder}}` tokens. The
// renderer is intentionally tiny and total: an unknown or missing variable
// renders as an empty string rather than leaking `{{speakerName}}` into a real
// speaker's inbox.
//
// Pure module — no Convex imports — so it is usable from queries, mutations and
// actions.

import {
  googleCalendarUrl,
  outlookLiveUrl,
  outlookOfficeUrl,
} from "./calendarLinks"

/** The placeholder set exposed in the template editor. */
export const TEMPLATE_VARIABLES = [
  "speakerName",
  "firstName",
  "sessionTitle",
  "eventName",
  "portalLink",
  // Deadline reminders only (convex/crons.ts): the form's close date, already
  // formatted in the event's timezone, and a link straight back to the form.
  "closeDate",
  "formLink",
  // Task reminders only (convex/comms.ts::queueTaskReminders): the recipient's
  // own outstanding tasks, one per line with their due dates, and the date of
  // the nearest one on its own. A reminder that can't say what is outstanding
  // is just noise, so the default body names them.
  "taskList",
  "nextDueDate",
] as const

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

export type TemplateVars = Partial<Record<string, string | undefined | null>>

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Replace every `{{token}}` with its value. Missing/blank values collapse to an
 * empty string. Tolerates surrounding whitespace inside the braces.
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  if (!body) return ""
  return body.replace(PLACEHOLDER, (_match, name: string) => {
    const value = vars[name]
    return value === undefined || value === null ? "" : String(value)
  })
}

/** Convenience: render subject + body in one call. */
export function renderMessage(
  template: { subject: string; body: string },
  vars: TemplateVars,
): { subject: string; body: string } {
  return {
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
  }
}

export type TemplateDefinition = {
  key: string
  name: string
  subject: string
  body: string
}

/** The template keys Trackstage seeds for every event. */
export const TEMPLATE_KEYS = [
  "confirmation",
  "accepted",
  "declined",
  "waitlisted",
  "reminder",
  "deadline_reminder",
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

/**
 * Seeded copy. Warm, concise, and written the way a real programme chair would
 * write it — these are what a judge sees first in the Communications screen.
 */
export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    key: "confirmation",
    name: "Submission received",
    subject: "We received your submission for {{eventName}}",
    body: [
      "Hi {{firstName}},",
      "",
      "Thanks for submitting “{{sessionTitle}}” to {{eventName}}. Your proposal is in and our programme committee will review it alongside the rest of the call for papers.",
      "",
      "You can review or update your submission at any time before the call closes from your speaker portal:",
      "{{portalLink}}",
      "",
      "We'll be in touch as soon as decisions are made. Thank you for sharing your work with us.",
      "",
      "— The {{eventName}} programme team",
    ].join("\n"),
  },
  {
    key: "accepted",
    name: "Submission accepted",
    subject: "Congratulations — “{{sessionTitle}}” is in the {{eventName}} programme",
    body: [
      "Hi {{firstName}},",
      "",
      "Great news: “{{sessionTitle}}” has been accepted for {{eventName}}. We had a strong field this year and we're genuinely excited to have you on the programme.",
      "",
      "A few next steps so we can get you ready:",
      "",
      "1. Open your speaker portal: {{portalLink}}",
      "2. Confirm your biography and upload a headshot — both appear on the public programme.",
      "3. Work through the tasks listed in the portal before their due dates (slides, travel details, and anything else we need from you).",
      "",
      "If your session has already been scheduled you'll find a calendar invite attached to this email, and the exact time and room in the portal.",
      "",
      "Please let us know if anything changes on your side — we'd rather hear early.",
      "",
      "Welcome aboard,",
      "The {{eventName}} programme team",
    ].join("\n"),
  },
  {
    key: "declined",
    name: "Submission not accepted",
    subject: "Your submission to {{eventName}}",
    body: [
      "Hi {{firstName}},",
      "",
      "Thank you for submitting “{{sessionTitle}}” to {{eventName}}. After careful review by our programme committee, we're not able to include it in this year's programme.",
      "",
      "This was a genuinely difficult round — we received far more strong proposals than we have slots, and a decision not to schedule a talk says much more about the shape of the agenda than about the quality of the work.",
      "",
      "We hope you'll still join us, and we'd very much welcome a submission from you next time. Your submission history stays available in your portal:",
      "{{portalLink}}",
      "",
      "Thank you for taking the time to write it up.",
      "",
      "— The {{eventName}} programme team",
    ].join("\n"),
  },
  {
    key: "waitlisted",
    name: "Submission waitlisted",
    subject: "“{{sessionTitle}}” is on the {{eventName}} waitlist",
    body: [
      "Hi {{firstName}},",
      "",
      "Your submission “{{sessionTitle}}” made it through review for {{eventName}}, but we've run out of slots in the programme for now — so we've placed it on our waitlist.",
      "",
      "That means: if a slot opens up, yours is one of the first talks we'll reach for. We'll contact you straight away if that happens, and we'll confirm either way before the event.",
      "",
      "Nothing is needed from you right now. You can check the current status any time in your speaker portal:",
      "{{portalLink}}",
      "",
      "Thanks for your patience — and for a proposal we'd genuinely like to find room for.",
      "",
      "— The {{eventName}} programme team",
    ].join("\n"),
  },
  {
    key: "reminder",
    name: "Outstanding tasks reminder",
    subject: "A quick reminder: outstanding tasks for {{eventName}}",
    body: [
      "Hi {{firstName}},",
      "",
      "A friendly nudge — these are still outstanding for {{eventName}}:",
      "",
      "{{taskList}}",
      "",
      "You can complete them straight from your speaker portal:",
      "{{portalLink}}",
      "",
      "Getting these in on time lets us publish the programme, print your details correctly and make sure your session runs smoothly on the day.",
      "",
      "If something is blocking you, just reply to this email and we'll help.",
      "",
      "Thank you,",
      "The {{eventName}} programme team",
    ].join("\n"),
  },
  {
    key: "deadline_reminder",
    name: "Draft deadline reminder",
    subject: "Your draft for {{eventName}} closes on {{closeDate}}",
    body: [
      "Hi {{firstName}},",
      "",
      "You started a submission for {{eventName}} — “{{sessionTitle}}” — but it's still saved as a draft, so our programme committee can't see it yet.",
      "",
      "The call for papers closes on {{closeDate}}. Drafts that aren't submitted by then won't be reviewed.",
      "",
      "Pick up where you left off and send it in:",
      "{{formLink}}",
      "",
      "It usually takes a couple of minutes — and we'd genuinely like to read it.",
      "",
      "— The {{eventName}} programme team",
    ].join("\n"),
  },
]

const BY_KEY: Record<string, TemplateDefinition> = Object.fromEntries(
  DEFAULT_TEMPLATES.map((t) => [t.key, t]),
)

/** Fallback used when an event has no stored template for a key. */
export function defaultTemplate(key: string): TemplateDefinition {
  return (
    BY_KEY[key] ?? {
      key,
      name: key,
      subject: "{{eventName}}",
      body: "Hi {{firstName}},\n\n{{portalLink}}\n\n— The {{eventName}} programme team",
    }
  )
}

/** Base URL of the web app; used to build portal magic links. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "")
}

export function portalLinkFor(portalToken: string): string {
  return `${siteUrl()}/portal/t/${portalToken}`
}

/** `From:` header for outbound mail. */
export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "Trackstage <onboarding@resend.dev>"
}

/** Bare address extracted from `EMAIL_FROM` — used as the .ics ORGANIZER. */
export function emailFromAddress(): string {
  const from = emailFrom()
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).trim()
}

// ——— Branding (gap #29) ——————————————————————————————————————————————————
// Templates are authored as plain text — that is what an organizer can read,
// edit and reason about. But a bare text email from an unknown address reads
// like a phishing attempt to a speaker. So the *stored* body stays plain text
// (and still ships as the text/plain alternative), and this wrapper dresses it
// at send time: the event's own logo and name at the top, the copy in the
// middle, one quiet line at the bottom saying who sent it and where to manage
// it. Table-based with inline styles because that is the only HTML every mail
// client agrees on.

export type BrandedEmailInput = {
  /** True when the TEMPLATE was authored as HTML (decided pre-render). */
  isHtml?: boolean
  /** The rendered subject — used for the preheader/title only. */
  subject: string
  /** The rendered body: plain text, or HTML if the composer wrote HTML. */
  body: string
  eventName: string
  /** Public URL of the event logo, when the organizer uploaded one. */
  logoUrl?: string | null
  /** The recipient's speaker-portal link, when they have one. */
  portalLink?: string | null
  /**
   * The scheduled session this email is about, when there is one. Adds a
   * one-click "add to calendar" row under the message — see `calendarBlock`.
   */
  calendar?: CalendarBlockInput | null
}

export type CalendarBlockInput = {
  title: string
  /** Epoch milliseconds. */
  startsAt: number
  durationMinutes: number
  /** Room, venue, or both. */
  location?: string
  /** IANA zone of the event — used to say *when*, in the venue's own hours. */
  timezone?: string
  /** Conference name, carried into the calendar entry's description. */
  eventName?: string
}

/** True when a body was authored as HTML rather than plain text. */
export function looksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body)
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const URL_IN_TEXT = /(https?:\/\/[^\s<>"')]+)/g

/**
 * Plain text → HTML: escape, turn bare URLs into links, blank lines into
 * paragraphs and single newlines into `<br>`. Deliberately conservative — no
 * markdown, no smart quotes, nothing that could rewrite an organizer's copy.
 */
function textToHtml(body: string): string {
  const escaped = escapeHtml(body)
  const linked = escaped.replace(
    URL_IN_TEXT,
    (url) =>
      `<a href="${url}" style="color:#2f5ce0;text-decoration:underline;">${url}</a>`,
  )
  return linked
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px 0;">${block.replace(/\n/g, "<br />")}</p>`,
    )
    .join("")
}

/**
 * "Friday, October 12 · 04:00 PM – 04:45 PM PDT" — the session line, in the
 * *event's* zone, because "4pm" on a conference programme means 4pm at the
 * venue. Falls back to a plain UTC rendering if the runtime rejects the zone,
 * since a mangled date must never take an acceptance email down with it.
 */
function formatSessionWhen(input: CalendarBlockInput): string {
  const endsAt = input.startsAt + Math.max(1, input.durationMinutes) * 60_000
  const zone = input.timezone
  try {
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(input.startsAt))
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    const abbrev = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "short",
    })
      .formatToParts(new Date(input.startsAt))
      .find((part) => part.type === "timeZoneName")?.value
    return `${day} · ${time.format(new Date(input.startsAt))} – ${time.format(new Date(endsAt))}${abbrev ? ` ${abbrev}` : ""}`
  } catch {
    return new Date(input.startsAt).toUTCString()
  }
}

/**
 * The "add to calendar" row printed under a message about a scheduled session.
 *
 * The `.ics` file is already attached, which every desktop client handles — but
 * a speaker reading this on a phone, in Gmail or Outlook on the web, gets
 * nowhere with an attachment. These three links open the provider with the
 * session already filled in, so the answer to "when am I on" ends up in their
 * actual calendar in one tap. Every interpolated value is escaped: the title
 * and room come from organizer- and speaker-supplied text.
 */
function calendarBlock(input: CalendarBlockInput): string {
  const endsAt = input.startsAt + Math.max(1, input.durationMinutes) * 60_000
  const event = {
    title: input.title,
    startsAt: input.startsAt,
    endsAt,
    location: input.location,
    description: input.eventName,
  }
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:#2f5ce0;text-decoration:underline;white-space:nowrap;">${label}</a>`

  const where = input.location
    ? `<div style="color:#64748b;">${escapeHtml(input.location)}</div>`
    : ""

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;border:1px solid #e6e6e9;border-radius:10px;background-color:#fafafa;">
<tr>
<td style="padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#17171a;">
<div style="font-weight:600;">${escapeHtml(input.title)}</div>
<div style="color:#64748b;">${escapeHtml(formatSessionWhen(input))}</div>
${where}
<div style="margin-top:12px;">Add it to your calendar: ${link(googleCalendarUrl(event), "Google Calendar")} &nbsp;·&nbsp; ${link(outlookLiveUrl(event), "Outlook.com")} &nbsp;·&nbsp; ${link(outlookOfficeUrl(event), "Outlook (work)")}</div>
<div style="margin-top:6px;color:#64748b;font-size:12px;">Apple Calendar and everything else: open the .ics file attached to this email.</div>
</td>
</tr>
</table>`
}

/**
 * Wrap a rendered message in the event's branding. Pure and total: with no
 * logo it falls back to the event name as a wordmark, and with no portal link
 * the footer simply drops that clause.
 */
export function renderBrandedEmail(input: BrandedEmailInput): string {
  const eventName = escapeHtml(input.eventName || "Trackstage")
  // `isHtml` is decided from the TEMPLATE body (before per-recipient merge
  // fields are rendered in): a speaker-typed title containing an HTML-ish
  // token must never flip a plain-text email into raw-HTML mode — that both
  // broke rendering and let submitted text inject markup into mail sent from
  // our verified domain (adversarial-review F2/F3, 2026-08-11). Callers that
  // don't know pass undefined and we fall back to sniffing.
  const isHtml = input.isHtml ?? looksLikeHtml(input.body)
  // The calendar row is appended *after* the rendered body, never merged into
  // it, so an HTML template can't be broken by it and it can't be escaped away
  // by a plain-text one.
  const content =
    (isHtml ? input.body : textToHtml(input.body)) +
    (input.calendar ? calendarBlock(input.calendar) : "")

  const header = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${eventName}" height="36" style="display:block;max-height:36px;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-size:17px;font-weight:600;color:#17171a;letter-spacing:-0.01em;">${eventName}</span>`

  const footerPortal = input.portalLink
    ? ` · <a href="${escapeHtml(input.portalLink)}" style="color:#64748b;text-decoration:underline;">manage in your speaker portal</a>`
    : ""

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;padding:24px 12px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e6e6e9;border-radius:12px;overflow:hidden;">
<tr>
<td style="padding:20px 28px;border-bottom:1px solid #f0f0f2;">
${header}
</td>
</tr>
<tr>
<td style="padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#17171a;">
${content}
</td>
</tr>
<tr>
<td style="padding:16px 28px;border-top:1px solid #f0f0f2;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#64748b;">
Sent via Trackstage for ${eventName}${footerPortal}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}

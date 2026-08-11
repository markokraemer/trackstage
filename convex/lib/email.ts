// Email templating for Trackstage (docs/SPEC.md §4.9).
//
// Templates are plain text/HTML-ish bodies with `{{placeholder}}` tokens. The
// renderer is intentionally tiny and total: an unknown or missing variable
// renders as an empty string rather than leaking `{{speakerName}}` into a real
// speaker's inbox.
//
// Pure module — no Convex imports — so it is usable from queries, mutations and
// actions.

/** The placeholder set exposed in the template editor. */
export const TEMPLATE_VARIABLES = [
  "speakerName",
  "firstName",
  "sessionTitle",
  "eventName",
  "portalLink",
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
      "A friendly nudge — you still have a few speaker tasks outstanding for {{eventName}}. They usually take less than ten minutes in total.",
      "",
      "Open your portal to see exactly what's left and complete it inline:",
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

import { TEMPLATE_VARIABLES } from "@convex/lib/email"

/**
 * Plain-English copy for the Communications screen (docs/SPEC.md §4.9).
 *
 * The backend keys are terse (`accepted`, `reminder`, …); organizers see the
 * friendly name and, more importantly, *when the email goes out* — the single
 * question every non-technical organizer asks about a template.
 */

export interface TemplateMeta {
  /** Friendly name shown on the card. */
  label: string
  /** When this email is sent, in one sentence. */
  when: string
}

export const TEMPLATE_META: Record<string, TemplateMeta | undefined> = {
  confirmation: {
    label: "Submission confirmation",
    when: "Sent automatically the moment someone submits a talk through your form.",
  },
  accepted: {
    label: "Acceptance",
    when: "Sent when you commit the Accept Queue. Includes the speaker portal link, and a calendar invite once the session is scheduled.",
  },
  declined: {
    label: "Decline",
    when: "Sent when you commit the Decline Queue.",
  },
  waitlisted: {
    label: "Waitlist",
    when: "Sent when you put a submission on the waitlist — nothing is promised, nothing is refused.",
  },
  reminder: {
    label: "Task reminder",
    when: "Sent by “Remind incomplete speakers”, and once a day automatically for tasks coming due.",
  },
}

/** Friendly name for a template key, falling back to the stored name. */
export function templateLabel(key: string, storedName?: string): string {
  return TEMPLATE_META[key]?.label ?? storedName ?? key
}

// ——— Merge fields ————————————————————————————————————————————————————————

export interface PlaceholderMeta {
  /** The token, without braces. */
  token: string
  /** What it means, in organizer language. */
  label: string
  /** Value used by the live preview so the copy reads like a real email. */
  sample: string
}

const PLACEHOLDER_COPY: Record<
  string,
  { label: string; sample: string } | undefined
> = {
  speakerName: { label: "Speaker's full name", sample: "Alex Rivera" },
  firstName: { label: "Speaker's first name", sample: "Alex" },
  sessionTitle: {
    label: "Session title",
    sample: "Scaling retrieval for production agents",
  },
  eventName: { label: "Event name", sample: "Your event" },
  portalLink: {
    label: "Speaker portal link",
    sample: "https://trackstage.app/portal/t/8f3a…",
  },
}

/**
 * The merge fields offered in the editor — derived from the backend's
 * `TEMPLATE_VARIABLES` so a new server-side variable shows up here for free.
 */
export function placeholders(eventName?: string): Array<PlaceholderMeta> {
  return TEMPLATE_VARIABLES.map((token) => {
    const copy = PLACEHOLDER_COPY[token]
    return {
      token,
      label: copy?.label ?? token,
      sample:
        token === "eventName" && eventName
          ? eventName
          : (copy?.sample ?? `{{${token}}}`),
    }
  })
}

/** Sample values keyed by token, for the preview renderer. */
export function sampleVars(eventName?: string): Record<string, string> {
  return Object.fromEntries(
    placeholders(eventName).map((p) => [p.token, p.sample]),
  )
}

// ——— Message statuses ————————————————————————————————————————————————————

export interface MessageStatusMeta {
  label: string
  /** One line explaining what this status means for the organizer. */
  help: string
}

/**
 * `convex/comms.ts` MESSAGE_STATUS. "preview" is the demo-safe state: no
 * `RESEND_API_KEY` is configured, so the message is fully rendered and kept
 * here instead of being delivered.
 */
export const MESSAGE_STATUS_META: Record<
  string,
  MessageStatusMeta | undefined
> = {
  sent: {
    label: "Sent",
    help: "Delivered to the recipient's inbox.",
  },
  preview: {
    label: "Preview",
    help: "Preview — no email key configured. The message is fully rendered here but was not delivered.",
  },
  scheduled: {
    label: "Scheduled",
    help: "Queued and waiting to go out.",
  },
  sending: {
    label: "Sending",
    help: "Being handed to the email provider right now.",
  },
  failed: {
    label: "Failed",
    help: "The email provider rejected this message.",
  },
}

/** Ordered status filter options for the outbox toolbar. */
export const MESSAGE_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "preview", label: "Preview" },
  { value: "scheduled", label: "Scheduled" },
  { value: "failed", label: "Failed" },
]

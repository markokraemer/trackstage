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
  deadline_reminder: {
    label: "Draft deadline reminder",
    when: "Sent once, automatically, in the three days before a form closes — to anyone still holding an unfinished draft. Turn it on per form in the form builder’s Settings step.",
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
  closeDate: {
    label: "Form close date (deadline reminders)",
    sample: "Friday, August 14, 2026 at 5:00 PM EDT",
  },
  formLink: {
    label: "Submission form link (deadline reminders)",
    sample: "https://trackstage.app/submit/cfp",
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
    help: "Handed to the email provider. Check delivery to see whether it landed.",
  },
  preview: {
    label: "Preview",
    help: "Rendered in full here but not delivered — a demo address, or no email provider was connected.",
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

/**
 * Extra filters that only exist once delivery receipts have come back. Kept out
 * of the list above so an event with no receipts is never offered two filters
 * that can only ever say "0".
 */
export const DELIVERY_FILTERS: Array<{ value: string; label: string }> = [
  { value: "delivered", label: "Delivered" },
  { value: "bounced", label: "Not delivered" },
]

/** Every filter value the outbox understands — used to validate the URL. */
export const OUTBOX_FILTER_VALUES: Array<string> = [
  ...MESSAGE_STATUS_FILTERS.map((option) => option.value),
  ...DELIVERY_FILTERS.map((option) => option.value),
]

// ——— Delivery receipts ———————————————————————————————————————————————————
// "Sent" only means the email provider accepted the message. Once a receipt
// comes back (comms.refreshDeliveryStatus), the row says what actually
// happened — the vocabulary Sessionboard's own send log uses.

export interface DeliveryStateMeta {
  label: string
  help: string
  /** Status key handed to `StatusPill`, which owns the colour system. */
  tone: "sent" | "failed" | "scheduled"
}

/** Keyed by Resend's `last_event`. */
export const DELIVERY_STATE_META: Record<
  string,
  DeliveryStateMeta | undefined
> = {
  delivered: {
    label: "Delivered",
    help: "The receiving mail server accepted this email.",
    tone: "sent",
  },
  opened: {
    label: "Opened",
    help: "Delivered, and the recipient opened it.",
    tone: "sent",
  },
  clicked: {
    label: "Clicked",
    help: "Delivered, opened, and a link in it was clicked.",
    tone: "sent",
  },
  bounced: {
    label: "Bounced",
    help: "The mail server rejected the address — check it for a typo.",
    tone: "failed",
  },
  complained: {
    label: "Marked as spam",
    help: "The recipient reported this email as spam.",
    tone: "failed",
  },
  canceled: {
    label: "Cancelled",
    help: "The email provider cancelled this send.",
    tone: "failed",
  },
  failed: {
    label: "Not delivered",
    help: "The email provider could not deliver this message.",
    tone: "failed",
  },
  delivery_delayed: {
    label: "Delayed",
    help: "The receiving server asked us to retry later — still on its way.",
    tone: "scheduled",
  },
  queued: {
    label: "Queued at provider",
    help: "Accepted by the email provider, waiting to go out.",
    tone: "scheduled",
  },
  sent: {
    label: "Sent",
    help: "Handed to the email provider. No delivery receipt yet.",
    tone: "sent",
  },
}

export function deliveryStateMeta(
  providerStatus: string | undefined,
): DeliveryStateMeta | undefined {
  if (!providerStatus) return undefined
  return (
    DELIVERY_STATE_META[providerStatus] ?? {
      label: providerStatus.replace(/_/g, " "),
      help: "Reported by the email provider.",
      tone: "scheduled",
    }
  )
}

/**
 * The bucket a row belongs to in the outbox — the receipt when we have one,
 * otherwise the queue status. Filtering and the per-filter counts both go
 * through here so a row is always counted where it is shown.
 */
export function outboxFilterKey(message: {
  status: string
  providerStatus?: string
}): string {
  if (message.status !== "sent" || !message.providerStatus) return message.status
  const tone = deliveryStateMeta(message.providerStatus)?.tone
  if (tone === "failed") return "bounced"
  if (
    message.providerStatus === "delivered" ||
    message.providerStatus === "opened" ||
    message.providerStatus === "clicked"
  ) {
    return "delivered"
  }
  return "sent"
}

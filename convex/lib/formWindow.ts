import type { Doc } from "../_generated/dataModel"

// ————————————————————————————————————————————————————————————————————————
// When is a call for speakers still open?
//
// One definition, shared by the public submission flow (convex/submit.ts) and
// the speaker portal (convex/portal.ts). Before this lived here the portal had
// no idea a form had closed, so a speaker could keep rewriting an abstract
// weeks after the deadline the organizer set — sbek CFP-16.
// ————————————————————————————————————————————————————————————————————————

/**
 * A discriminated union on purpose: a CLOSED window always carries the sentence
 * the speaker reads. That sentence is thrown as `ConvexError` data — the only
 * form Convex doesn't redact on a production deployment — so "closed with no
 * reason" must not be representable.
 */
export type FormWindow =
  | { open: true; reason?: undefined }
  | { open: false; reason: string }

/**
 * The same verdict, from the two fields it actually depends on — so the form
 * builder can ask the question about a draft that has not been saved yet.
 *
 * The organizer UI used to answer it three times over, and each copy looked at
 * `status` alone: a form whose deadline had passed sat there wearing a green
 * "Open" badge and an "This form is open" toggle that was still on, directly
 * above a banner saying it had stopped accepting submissions. A deadline is a
 * way of closing a form, so it has to count as one everywhere.
 */
export function formWindow(form: {
  status: string
  closeAt?: number | null
}): FormWindow {
  if (form.status !== "open") {
    return { open: false, reason: "This call for speakers is closed." }
  }
  if (form.closeAt && Date.now() > form.closeAt) {
    return {
      open: false,
      reason: "The submission deadline for this form has passed.",
    }
  }
  return { open: true }
}

export function isFormOpen(form: Doc<"forms">): FormWindow {
  return formWindow(form)
}

/** "Jul 22, 2026" in the event's own timezone (falls back to UTC). */
export function formatCloseDate(ms: number, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString().slice(0, 10)
  }
}

/**
 * What a speaker reads when they try to change a submission after the call
 * closed. Names the date whenever there was one — "closed on Jul 22" is a fact
 * someone can act on; "closed" alone just sounds like a bug.
 */
export function cfpClosedMessage(
  form: Doc<"forms">,
  timezone?: string,
): string {
  const closedOn =
    form.closeAt !== undefined && Date.now() > form.closeAt
      ? ` on ${formatCloseDate(form.closeAt, timezone)}`
      : ""
  return `The call for speakers closed${closedOn}, so this submission can no longer be edited here. Email the organizers with what you'd like changed and they'll update it for you.`
}

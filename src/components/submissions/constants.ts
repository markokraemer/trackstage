import { format, formatDistanceToNowStrict, isValid } from "date-fns"

import type { SubmissionStatus } from "@/components/shared/status-pill"

/**
 * Shared vocabulary for the organizer submissions workspace (docs/SPEC.md §4.4,
 * docs/ux/03 Part B). Wording matches Sessionboard 1:1 — organizer-side and
 * speaker-side statuses read identically.
 */

/** Status tab strip, in the exact order of docs/ux/03 image5. */
export const STATUS_TABS: Array<{
  /** Tab key — `all` or a submission status. */
  value: "all" | SubmissionStatus
  label: string
  /** Key in the `submissions.counts` result. */
  countKey: string
}> = [
  { value: "all", label: "All", countKey: "all" },
  { value: "accepted", label: "Accepted", countKey: "accepted" },
  { value: "accept_queue", label: "Accept Queue", countKey: "accept_queue" },
  { value: "pending", label: "Pending", countKey: "pending" },
  { value: "decline_queue", label: "Decline Queue", countKey: "decline_queue" },
  { value: "declined", label: "Declined", countKey: "declined" },
  { value: "withdrawn", label: "Withdrawn", countKey: "withdrawn" },
  { value: "draft", label: "Drafts", countKey: "draft" },
]

export type StatusTabValue = (typeof STATUS_TABS)[number]["value"]

export function isStatusTab(value: string): value is StatusTabValue {
  return STATUS_TABS.some((tab) => tab.value === value)
}

/**
 * Plain-English explanation of every tab, used for the empty states so a
 * first-time organizer always learns the pipeline instead of hitting a wall.
 */
export const TAB_EMPTY_COPY: Record<
  StatusTabValue,
  { title: string; description: string }
> = {
  all: {
    title: "No submissions yet",
    description:
      "Everything that arrives through your call for papers lands here, along with sessions you add by hand. Share your form link or add a submission yourself to get started.",
  },
  accepted: {
    title: "Nothing accepted yet",
    description:
      "Accepted talks appear here once you send acceptances from the Accept Queue. They become schedulable sessions on your agenda automatically.",
  },
  accept_queue: {
    title: "Your accept queue is empty",
    description:
      "Stage the talks you want to say yes to here. Nothing is emailed until you press “Send acceptances”, so you can change your mind freely.",
  },
  pending: {
    title: "No submissions waiting on you",
    description:
      "Anything submitted through your form starts as Pending until you move it to the Accept or Decline queue.",
  },
  decline_queue: {
    title: "Your decline queue is empty",
    description:
      "Stage the talks you're turning down here. The decline emails only go out when you press “Send declines”.",
  },
  declined: {
    title: "Nothing declined yet",
    description:
      "Declined talks live here after you commit the decline queue. Speakers keep access to their portal.",
  },
  withdrawn: {
    title: "Nothing withdrawn",
    description:
      "If a speaker pulls their own talk from the speaker portal, it moves here so you don't chase it.",
  },
  draft: {
    title: "No drafts",
    description:
      "Drafts are submissions a speaker started but hasn't sent yet. You'll see them here so you can nudge them before your deadline.",
  },
}

/** Choice lists for the structured dropdowns (never free text — SPEC §2.2). */
export const FORMAT_OPTIONS = [
  "Talk",
  "Keynote",
  "Featured Keynote",
  "Workshop",
  "Panel",
  "Lightning talk",
  "Fireside chat",
]

export const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"]

export const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Japanese",
]

/** Adds an unknown stored value to a choice list so nothing silently vanishes. */
export function withCurrent(
  options: Array<string>,
  current?: string | null
): Array<string> {
  if (!current || options.includes(current)) return options
  return [current, ...options]
}

/** The em-dash convention for empty cells (docs/ux/03 image5). */
export const EMPTY_CELL = "—"

/** "3 days ago" — with an absolute date available on hover. */
export function relativeDate(ms?: number): string {
  if (!ms) return EMPTY_CELL
  const date = new Date(ms)
  if (!isValid(date)) return EMPTY_CELL
  return `${formatDistanceToNowStrict(date)} ago`
}

export function absoluteDate(ms?: number): string {
  if (!ms) return ""
  const date = new Date(ms)
  if (!isValid(date)) return ""
  return format(date, "MMM d, yyyy 'at' h:mm a")
}

/** One decimal place, or the em-dash when nothing has been scored. */
export function formatScore(avg?: number | null): string {
  if (avg === null || avg === undefined) return EMPTY_CELL
  return avg.toFixed(1)
}

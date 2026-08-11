import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { useCurrentEvent } from "@/lib/current-event"
import type { SubmissionStatus } from "@/components/shared/status-pill"

/**
 * The event's status catalogue — the client half of
 * `convex/sessionStatuses.ts` (Settings → Statuses).
 *
 * READ THIS BEFORE CHANGING STATUS CODE:
 * a submission's `status` is still the fixed pipeline enum, and every rule in
 * the product keys off it. A catalogue entry is a LABEL bound to one of those
 * enum values:
 *
 *     name + color   → what the organizer sees
 *     category       → the behaviour it inherits (accepted / pending / …)
 *     pipelineStatus → the enum value written to `submissions.status`
 *
 * So renaming "Accepted" to "Confirmed", or adding "Waitlist" under the
 * pending category, changes wording and colour and nothing else. Anything that
 * needs to *decide* something must branch on `status`, never on a label.
 */

export const STATUS_CATEGORIES = [
  "draft",
  "pending",
  "accepted",
  "declined",
  "withdrawn",
] as const
export type StatusCategory = (typeof STATUS_CATEGORIES)[number]

export const STATUS_TONES = ["green", "amber", "red", "gray", "blue"] as const
export type StatusTone = (typeof STATUS_TONES)[number]

export interface StatusOption {
  /** `null` while the event still runs on the untouched built-in defaults. */
  _id: string | null
  /** Present on the seven built-ins; equals their pipeline value. */
  systemKey?: string
  name: string
  category: StatusCategory
  pipelineStatus: SubmissionStatus
  color: StatusTone
  order: number
  /** Live submission count — the `Sessions` column of their Statuses table. */
  count: number
}

/**
 * What every event starts with, mirroring `DEFAULT_SESSION_STATUSES` in
 * `convex/sessionStatuses.ts`. Used as the fallback whenever the catalogue
 * hasn't loaded (or the screen has no event context), so a status always has
 * a name and a colour — there is no loading state where a pill goes blank.
 */
export const BUILT_IN_STATUSES: Array<StatusOption> = [
  { _id: null, systemKey: "accepted", name: "Accepted", category: "accepted", pipelineStatus: "accepted", color: "green", order: 10, count: 0 },
  { _id: null, systemKey: "accept_queue", name: "Accept Queue", category: "accepted", pipelineStatus: "accept_queue", color: "green", order: 20, count: 0 },
  { _id: null, systemKey: "pending", name: "Pending", category: "pending", pipelineStatus: "pending", color: "amber", order: 30, count: 0 },
  { _id: null, systemKey: "decline_queue", name: "Decline Queue", category: "declined", pipelineStatus: "decline_queue", color: "amber", order: 40, count: 0 },
  { _id: null, systemKey: "declined", name: "Declined", category: "declined", pipelineStatus: "declined", color: "red", order: 50, count: 0 },
  { _id: null, systemKey: "withdrawn", name: "Withdrawn", category: "withdrawn", pipelineStatus: "withdrawn", color: "gray", order: 60, count: 0 },
  { _id: null, systemKey: "draft", name: "Draft", category: "draft", pipelineStatus: "draft", color: "gray", order: 70, count: 0 },
]

/** Organizer-facing explanation of what a category actually does. */
export const CATEGORY_META: Record<
  StatusCategory,
  { label: string; description: string }
> = {
  accepted: {
    label: "Accepted",
    description:
      "Counts as a yes. Lands on the agenda, appears in the public programme, and shows as confirmed in the speaker portal.",
  },
  pending: {
    label: "Pending",
    description:
      "Still undecided. Waits in your review queues and reads as “under review” to the speaker.",
  },
  declined: {
    label: "Declined",
    description:
      "Counts as a no. Never reaches the agenda or the public programme; the speaker keeps portal access.",
  },
  draft: {
    label: "Draft",
    description:
      "Started but not submitted yet. Hidden from evaluation and from everything public.",
  },
  withdrawn: {
    label: "Withdrawn",
    description:
      "The speaker pulled the talk. Kept for your records and out of every other view.",
  },
}

export const CATEGORY_OPTIONS = STATUS_CATEGORIES.map((value) => ({
  value,
  ...CATEGORY_META[value],
}))

/** The five pill colours, all of them design tokens (never a raw hex). */
export const STATUS_TONE_OPTIONS: Array<{ value: StatusTone; label: string }> = [
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
  { value: "gray", label: "Grey" },
  { value: "blue", label: "Blue" },
]

export function isStatusTone(value: string): value is StatusTone {
  return (STATUS_TONES as ReadonlyArray<string>).includes(value)
}

export function isStatusCategory(value: string): value is StatusCategory {
  return (STATUS_CATEGORIES as ReadonlyArray<string>).includes(value)
}

/**
 * Which catalogue entry a submission reads as.
 *
 * The stored label wins only while it still agrees with the pipeline status;
 * otherwise the built-in entry for that status does. That is what makes a
 * stale `statusId` — left behind by a bulk change or a queue commit —
 * harmless instead of a lie on screen. Same rule as the server's `resolveRow`.
 */
export function resolveStatusOption(
  statuses: Array<StatusOption>,
  status: string,
  statusId?: string | null,
): StatusOption {
  if (statusId) {
    const labelled = statuses.find((option) => option._id === statusId)
    if (labelled && labelled.pipelineStatus === status) return labelled
  }
  return (
    statuses.find((option) => option.systemKey === status) ??
    statuses.find((option) => option.pipelineStatus === status) ??
    BUILT_IN_STATUSES.find((option) => option.systemKey === status) ?? {
      _id: null,
      name: status,
      category: "pending",
      pipelineStatus: status as SubmissionStatus,
      color: "gray",
      order: 999,
      count: 0,
    }
  )
}

/** The built-in entry for a pipeline status, used for tab labels. */
export function systemStatusOption(
  statuses: Array<StatusOption>,
  status: string,
): StatusOption {
  return resolveStatusOption(statuses, status)
}

/**
 * Every status for the event currently in context, ordered. Falls back to the
 * built-ins while loading so nothing ever renders an empty picker.
 */
export function useStatusCatalog(): {
  statuses: Array<StatusOption>
  /** False until the event's statuses have been materialised in the database. */
  initialized: boolean
  isLoading: boolean
  eventId: string | undefined
} {
  const { event } = useCurrentEvent()
  const { data, isPending } = useQuery(
    convexQuery(api.sessionStatuses.list, event ? { eventId: event._id } : "skip"),
  )
  return {
    statuses: (data?.statuses as Array<StatusOption> | undefined) ?? BUILT_IN_STATUSES,
    initialized: data?.initialized ?? false,
    isLoading: !!event && isPending,
    eventId: event?._id,
  }
}

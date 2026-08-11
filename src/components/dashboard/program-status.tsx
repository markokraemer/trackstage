/**
 * Why a person is on the speaker roster (docs/SPEC.md §4.8).
 *
 * The roster is ONE source of truth: everyone attached to the programme, on
 * anything, at any status. So every row has to answer "why is this person
 * here?" out loud — one accepted session, one still in review, or added by
 * hand. `convex/dashboard.ts` computes the facet (`programStatus`) and the
 * counts behind it; this module is the single place that words and colours it,
 * so the table cell, the filter tabs and anything built later agree.
 *
 * Renders through the shared `StatusPill` in its default dot variant
 * (RULES.md #22) rather than a bespoke chip.
 */

import { StatusPill } from "@/components/shared/status-pill"

export const PROGRAM_STATUSES = [
  "confirmed",
  "in_review",
  "closed",
  "manual",
] as const

export type ProgramStatus = (typeof PROGRAM_STATUSES)[number]

export interface ProgramCounts {
  /** Sessions with an Accepted decision — they are speaking. */
  accepted: number
  /** Pending / Accept Queue / Decline Queue — still being decided. */
  inReview: number
  declined: number
  withdrawn: number
}

/** Short label for the filter tabs. */
export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  confirmed: "Confirmed",
  in_review: "In review",
  closed: "Not accepted",
  manual: "Added manually",
}

const TONE: Record<ProgramStatus, "green" | "amber" | "red" | "gray"> = {
  confirmed: "green",
  in_review: "amber",
  closed: "red",
  manual: "gray",
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

/**
 * The full sentence a roster row shows — "1 accepted session · 1 in review",
 * "2 in review", "Added manually". Speaker-safe wording throughout: an
 * organizer can read it aloud on a call without leaking a staged decision
 * (Accept Queue and Decline Queue both read simply as "in review").
 */
export function programStatusLabel(
  status: ProgramStatus | (string & {}),
  counts: ProgramCounts,
): string {
  if (status === "confirmed") {
    const base = plural(counts.accepted, "accepted session")
    return counts.inReview > 0 ? `${base} · ${counts.inReview} in review` : base
  }
  if (status === "in_review") return `${counts.inReview} in review`
  if (status === "closed") {
    if (counts.declined > 0 && counts.withdrawn > 0) {
      return `${counts.declined} not accepted · ${counts.withdrawn} withdrawn`
    }
    if (counts.declined > 0) return `${counts.declined} not accepted`
    return plural(counts.withdrawn, "withdrawn session")
  }
  return "Added manually"
}

export interface ProgramStatusPillProps {
  status: ProgramStatus | (string & {})
  counts: ProgramCounts
  size?: "sm" | "default"
  className?: string
}

export function ProgramStatusPill({
  status,
  counts,
  size = "sm",
  className,
}: ProgramStatusPillProps) {
  const key = (
    (PROGRAM_STATUSES as ReadonlyArray<string>).includes(status)
      ? status
      : "manual"
  ) as ProgramStatus
  return (
    <StatusPill
      status={key}
      tone={TONE[key]}
      label={programStatusLabel(key, counts)}
      size={size}
      className={className}
    />
  )
}

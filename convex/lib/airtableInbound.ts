// ————————————————————————————————————————————————————————————————————————
// EXPERIMENTAL two-way Airtable sync — the inbound half (HISTORY.md 61).
//
// The one-way mirror (convex/lib/airtable.ts) is deliberately safe: nothing
// an organizer does in Airtable can corrupt the programme. This adds the one
// inbound path swyx's use case actually wants — triage the Status column in
// Airtable and have the decisions land back here — WITHOUT giving that safety
// up. It is off by default and scoped to a single field.
//
// Everything in this file is PURE (no Convex ctx, no fetch), so the guard
// logic can be unit-tested exhaustively in tests/unit/airtable-sync.test.ts.
// That matters more here than anywhere else in the integration: the failure
// modes are echo loops and lost organizer decisions, and both are decided by
// these few comparisons.
//
// ── Why Status only ───────────────────────────────────────────────────────
// It is the highest-value field (the triage-in-Airtable workflow), and the
// only one that is enum-validatable — an unknown value can be rejected rather
// than half-applied. Free text would let an Airtable typo silently overwrite
// a talk abstract. If this ever widens, it widens field by field.
//
// ── The loop guard ────────────────────────────────────────────────────────
// We record, per submission, the status WE last pushed (`lastPushedStatus`).
// One value answers both dangerous questions:
//
//   echo:     airtable === lastPushed  → this is our own write coming back.
//   conflict: current  !== lastPushed  → our side moved since the mirror was
//                                        written, so the organizer changed it
//                                        HERE. Our DB wins; we log and skip.
//
// Checked in this order — unchanged, unknown, not-allowed, echo, conflict —
// so the cheap, common cases never reach the expensive reasoning, and a
// genuine conflict is always reported rather than silently dropped.
// ————————————————————————————————————————————————————————————————————————

/**
 * The statuses Airtable is allowed to SET. Two are deliberately missing:
 *
 *  · `draft` — a draft is an unfinished submission the speaker still owns;
 *    nothing outside the submit flow may push a row back into it.
 *  · `withdrawn` — speaker-initiated by definition. An organizer marking
 *    someone "Withdrawn" in a spreadsheet must not fake the speaker's intent.
 */
export const INBOUND_STATUSES = [
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
] as const

export type InboundStatus = (typeof INBOUND_STATUSES)[number]

/**
 * Airtable label → our enum, case- and separator-insensitive.
 *
 * The mirror writes "Accept queue"; a human retyping the cell may produce
 * "accept queue", "Accept Queue" or "accept_queue". All four mean the same
 * thing and all four are accepted. Anything else returns null and is skipped
 * with a logged reason rather than guessed at.
 */
export function parseStatusLabel(label: unknown): string | null {
  if (typeof label !== "string") return null
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
  if (!normalized) return null
  const known: Record<string, string> = {
    draft: "draft",
    pending: "pending",
    accept_queue: "accept_queue",
    accepted: "accepted",
    accept: "accepted",
    decline_queue: "decline_queue",
    declined: "declined",
    decline: "declined",
    rejected: "declined",
    withdrawn: "withdrawn",
  }
  return known[normalized] ?? null
}

export type InboundDecision =
  | { apply: true; status: InboundStatus; reason: "apply" }
  | {
      apply: false
      status: null
      reason:
        | "unknown_status" // not a status we recognise at all
        | "not_allowed" // recognised, but Airtable may not set it (draft/withdrawn)
        | "unchanged" // already what we hold — nothing to do
        | "no_baseline" // never mirrored, so echo can't be told from intent
        | "echo" // exactly what we last pushed — our own write returning
        | "conflict" // both sides moved; our DB wins
      /** Present for `conflict`, so the caller can log what was overruled. */
      airtableStatus?: string
    }

export type InboundCandidate = {
  /** The raw Airtable "Status" cell. */
  airtableValue: unknown
  /** What we hold right now. */
  currentStatus: string
  /** The status we last wrote INTO Airtable for this row, if ever. */
  lastPushedStatus?: string | null
}

/**
 * The whole decision, in one pure function.
 *
 * Order is load-bearing:
 *  1. `unknown_status` / `not_allowed` — reject before any state reasoning,
 *     so a typo in Airtable can never be interpreted as a conflict.
 *  2. `unchanged` BEFORE `conflict`. After we apply an inbound change our
 *     `lastPushedStatus` is momentarily stale; checking equality first means
 *     the very next pull says "nothing to do" instead of crying conflict.
 *  3. `no_baseline` — a row we have never mirrored gives us nothing to
 *     compare against, so we decline to act. The next push writes the
 *     baseline and the row becomes eligible.
 *  4. `echo` before `conflict` — our own write returning is not a conflict.
 */
export function shouldApplyInbound(
  candidate: InboundCandidate
): InboundDecision {
  const parsed = parseStatusLabel(candidate.airtableValue)
  if (parsed === null)
    return { apply: false, status: null, reason: "unknown_status" }
  if (!INBOUND_STATUSES.includes(parsed as InboundStatus)) {
    return { apply: false, status: null, reason: "not_allowed" }
  }
  if (parsed === candidate.currentStatus) {
    return { apply: false, status: null, reason: "unchanged" }
  }

  const lastPushed = candidate.lastPushedStatus ?? null
  if (lastPushed === null) {
    return { apply: false, status: null, reason: "no_baseline" }
  }
  if (parsed === lastPushed) {
    return { apply: false, status: null, reason: "echo" }
  }
  if (candidate.currentStatus !== lastPushed) {
    // Both sides moved since the last mirror write. Trackstage is the source
    // of truth, so the organizer's in-app decision stands and the Airtable
    // edit is reported, not applied. The next push overwrites the cell.
    return {
      apply: false,
      status: null,
      reason: "conflict",
      airtableStatus: parsed,
    }
  }
  return { apply: true, status: parsed as InboundStatus, reason: "apply" }
}

/** Reader-facing wording for each skip reason (Integrations card + audit log). */
export const INBOUND_REASON_TEXT: Record<InboundDecision["reason"], string> = {
  apply: "Applied from Airtable",
  unknown_status: "Airtable holds a status we don't recognise — left alone",
  not_allowed: "Draft and Withdrawn can't be set from Airtable — left alone",
  unchanged: "Already up to date",
  no_baseline: "Not mirrored yet — will be eligible after the next sync",
  echo: "Our own last sync coming back — ignored",
  conflict: "Changed in Trackstage too — Trackstage wins",
}

/**
 * `filterByFormula` limiting a list to records touched since our last sync.
 *
 * Airtable has no "modified since" parameter, so this is the documented way:
 * LAST_MODIFIED_TIME() with no arguments covers every field on the record.
 * A little slack is subtracted because Airtable's clock and ours are not the
 * same clock, and missing an edit is worse than re-reading one (re-reading is
 * free — the guard above turns it into "unchanged").
 */
export const MODIFIED_SINCE_SLACK_MS = 60_000

export function modifiedSinceFormula(
  sinceMs: number | null | undefined
): string | undefined {
  if (typeof sinceMs !== "number" || !Number.isFinite(sinceMs)) return undefined
  const iso = new Date(
    Math.max(0, sinceMs - MODIFIED_SINCE_SLACK_MS)
  ).toISOString()
  return `IS_AFTER(LAST_MODIFIED_TIME(), DATETIME_PARSE("${iso}"))`
}

/** Tally of one pull, as shown on the Integrations card. */
export type InboundSummary = {
  applied: number
  skipped: number
  conflicts: number
}

export function emptySummary(): InboundSummary {
  return { applied: 0, skipped: 0, conflicts: 0 }
}

export function tally(
  summary: InboundSummary,
  reason: InboundDecision["reason"]
): InboundSummary {
  if (reason === "apply") return { ...summary, applied: summary.applied + 1 }
  if (reason === "conflict")
    return {
      ...summary,
      skipped: summary.skipped + 1,
      conflicts: summary.conflicts + 1,
    }
  return { ...summary, skipped: summary.skipped + 1 }
}

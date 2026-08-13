// ————————————————————————————————————————————————————————————————————————
// Two-way Airtable sync — the shared inbound machinery (HISTORY.md 61, 66).
//
// The one-way mirror (convex/lib/airtable.ts) is deliberately safe: nothing
// an organizer does in Airtable can corrupt the programme. Write-back gives
// them the other direction WITHOUT giving that safety up — it is off by
// default, and when it is on it is scoped to the individual columns the
// organizer ticked (convex/lib/airtableFields.ts).
//
// This file holds the pieces every inbound field shares: the status
// vocabulary, the modified-since cursor, and the run tally. The per-field
// guard itself lives next door in airtableFields.ts, which imports from here.
// (The dependency runs one way on purpose: this module knows nothing about the
// registry, so the registry can be built out of it.)
//
// Everything in both files is PURE (no Convex ctx, no fetch), so the guard
// logic can be unit-tested exhaustively in tests/unit/airtable-sync.test.ts.
// That matters more here than anywhere else in the integration: the failure
// modes are echo loops and lost organizer decisions, and both are decided by
// a handful of string comparisons.
//
// ── The loop guard, in one sentence ───────────────────────────────────────
// We record, per document per field, the canonical value WE last pushed. One
// value answers both dangerous questions:
//
//   echo:     airtable === baseline  → this is our own write coming back.
//   conflict: current  !== baseline  → our side moved since the mirror was
//                                      written, so the organizer changed it
//                                      HERE. Our DB wins; we log and skip.
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

/**
 * Tally of one pull, as shown on the Integrations card.
 *
 * `checked` counts ROWS examined; the rest count FIELD decisions, because with
 * a dozen columns selected a row is rarely wholly applied or wholly skipped.
 */
export type InboundSummary = {
  checked: number
  applied: number
  skipped: number
  conflicts: number
}

export function emptySummary(): InboundSummary {
  return { checked: 0, applied: 0, skipped: 0, conflicts: 0 }
}

export function addSummary(
  a: InboundSummary,
  b: InboundSummary
): InboundSummary {
  return {
    checked: a.checked + b.checked,
    applied: a.applied + b.applied,
    skipped: a.skipped + b.skipped,
    conflicts: a.conflicts + b.conflicts,
  }
}

/**
 * Reasons that are pure noise and are deliberately NOT counted as "skipped".
 *
 * Every pull re-reads whole rows, so most field decisions are "unchanged" or
 * "echo" by construction. Counting those would bury the number that matters:
 * with twelve columns selected across two hundred rows, "3 applied, 2,397 left
 * alone" tells an organizer nothing, while "3 applied, 2 left alone" is a
 * sentence they can act on. Noise stays out; anything we actually declined to
 * do stays in.
 */
const QUIET_REASONS = new Set(["unchanged", "echo"])

export function tally(summary: InboundSummary, reason: string): InboundSummary {
  if (reason === "apply") return { ...summary, applied: summary.applied + 1 }
  if (reason === "conflict") {
    return {
      ...summary,
      skipped: summary.skipped + 1,
      conflicts: summary.conflicts + 1,
    }
  }
  if (QUIET_REASONS.has(reason)) return summary
  return { ...summary, skipped: summary.skipped + 1 }
}

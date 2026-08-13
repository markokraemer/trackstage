// ————————————————————————————————————————————————————————————————————————
// Inbound field registry — WHICH columns Airtable is allowed to write back,
// and what a legal value looks like in each one (HISTORY.md 61, 66).
//
// The one-way mirror (convex/lib/airtable.ts) is the safe default and stays
// that way. This file is the opt-in half: an organizer switches write-back on
// and then ticks the individual columns they want to edit in Airtable. Nothing
// is inbound unless it appears here AND the organizer selected it.
//
// ── Why a registry instead of a boolean ───────────────────────────────────
// "Two-way sync" as one switch is a lie in both directions: too timid for the
// organizer who wants to bulk-fix speaker bios in a grid, too reckless for the
// one who only wants Airtable to triage Status. A field is the unit an
// organizer actually reasons about ("Airtable may set the Track, nothing
// else"), so it is the unit we store, check and show.
//
// ── The canonical-value trick ─────────────────────────────────────────────
// Every comparison in the sync — is this our own echo? did our side move? — is
// a string comparison, and it is only sound if BOTH sides are spelled the same
// way. So there is exactly one function per field that turns a value into its
// canonical form, `parse`, and all three sites run through it:
//
//   · the Airtable cell we just read      → parse(cell)
//   · the value we hold in Convex         → parse(rawDomainValue)
//   · the cell we last pushed (baseline)  → parse(cellWeWrote), stored
//
// That is why `parse` accepts both spellings of everything it can (the label
// "Accept queue" AND the enum "accept_queue", a Date-shaped string AND a
// number of milliseconds): its job is to collapse every spelling of one value
// onto one string. A field whose parse is sloppy can produce a phantom
// conflict; a field whose parse is strict rejects an organizer's legitimate
// typing. Both failure modes are covered in tests/unit/airtable-sync.test.ts.
//
// Everything here is PURE — no Convex ctx, no fetch — so all of it is
// unit-testable, which for this logic matters more than anywhere else in the
// integration.
// ————————————————————————————————————————————————————————————————————————

import type { TableKey } from "./airtable"
import { TABLE_NAMES } from "./airtable"
import { INBOUND_STATUSES, parseStatusLabel } from "./airtableInbound"

/**
 * Which kind of document a field writes to. Both mirrored tables that key on a
 * submission ("Submissions" and "Sessions") land on the same document, which
 * is exactly why the baseline row is keyed on the DOCUMENT and not the table.
 */
export type InboundEntity = "submission" | "person"

export type InboundFieldSpec = {
  /** Stable id, stored on the connection. `<table>.<field>`. */
  key: string
  /** Which mirrored table the column lives in (what we pull it from). */
  table: TableKey
  /** The Airtable column name, exactly as TABLE_SPECS creates it. */
  column: string
  entity: InboundEntity
  /** UI wording. */
  label: string
  help: string
  /**
   * May an EMPTY Airtable cell clear the value here?
   *
   * False for anything the product requires (a submission has a title and a
   * status; a scheduled session has a room and a time). For those, a blank
   * cell is treated as "nothing to say", never as "delete this" — which is
   * also what protects the mirror from a half-filled row someone pasted in.
   */
  allowClear: boolean
  /**
   * Collapse every spelling of a value onto one canonical string.
   * `""` means empty. `null` means "we don't understand this" — the cell is
   * left alone and the reason is reported, never guessed at.
   */
  parse: (raw: unknown) => string | null
  /** Comparison key, applied to both sides. Defaults to identity. */
  compare?: (value: string) => string
  /** Values that parse cleanly but Airtable still may not set. */
  allowed?: (value: string) => boolean
}

// ——— Parsers ————————————————————————————————————————————————————————————

/** Airtable omits empty cells entirely, so absent and blank are one case. */
function raw(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim()
  return ""
}

function textField(maxLength: number) {
  return (value: unknown): string | null => {
    if (typeof value === "object" && value !== null) return null
    const text = raw(value)
    // A cell longer than this is not an edit, it is an accident (a pasted
    // column, a formula gone wide). Refusing beats silently truncating an
    // organizer's abstract.
    return text.length > maxLength ? null : text
  }
}

/** Single-line-ish values: names, companies, track names, links. */
const shortText = textField(500)
/** Abstracts and bios. Generous — real abstracts run long. */
const longText = textField(20_000)
const titleText = textField(300)

/**
 * Tags round-trip through one comma-separated cell, which is how the mirror
 * writes them. Order is preserved (organizers order tags meaningfully), blanks
 * and duplicates are dropped, and the list is capped so a runaway paste can't
 * become four hundred tags.
 */
const MAX_TAGS = 25

function parseTags(value: unknown): string | null {
  const text = shortText(value)
  if (text === null) return null
  if (text === "") return ""
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of text.split(",")) {
    const tag = part.trim()
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    tags.push(tag)
  }
  if (tags.length > MAX_TAGS) return null
  return tags.join(", ")
}

/** The tag list as our schema holds it, for the current-value side. */
export function tagsToCell(tags: readonly string[]): string {
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(", ")
}

/**
 * Accepts what Airtable returns for a dateTime cell (an ISO string), what our
 * own schema holds (epoch milliseconds), and what a human might type into a
 * date column. Canonical form is a UTC ISO string, so an organizer editing the
 * cell in their own timezone still compares equal to what we wrote.
 */
function parseDateTime(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value).toISOString() : null
  }
  const text = raw(value)
  if (text === "") return ""
  const ms = Date.parse(text)
  if (!Number.isFinite(ms)) return null
  // Airtable's own bounds are wider than any conference; this just stops an
  // obviously-wrong year (a mis-typed "0025") from rewriting the agenda.
  const year = new Date(ms).getUTCFullYear()
  if (year < 2000 || year > 2100) return null
  return new Date(ms).toISOString()
}

/** Mirrors the bounds agenda.schedule enforces for an organizer's own drag. */
const MIN_DURATION = 5
const MAX_DURATION = 480

function parseDuration(value: unknown): string | null {
  const text = raw(value)
  if (text === "") return ""
  const minutes = Number(text)
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) return null
  if (minutes < MIN_DURATION || minutes > MAX_DURATION) return null
  return String(minutes)
}

/**
 * Status is the only enum in the set, and the only field where a value can be
 * understood and still refused: `draft` belongs to the speaker's unfinished
 * work and `withdrawn` is the speaker's own intent, so neither may be faked
 * from a spreadsheet. See INBOUND_STATUSES.
 */
function parseStatus(value: unknown): string | null {
  const text = raw(value)
  if (text === "") return ""
  return parseStatusLabel(text)
}

/** Names and tracks are matched case-insensitively; wording is preserved. */
function foldCase(value: string): string {
  return value.toLowerCase()
}

// ——— The registry ———————————————————————————————————————————————————————

function submissionText(
  key: string,
  column: string,
  label: string,
  help: string
): InboundFieldSpec {
  return {
    key,
    table: "submissions",
    column,
    entity: "submission",
    label,
    help,
    allowClear: true,
    parse: shortText,
  }
}

function personText(
  key: string,
  column: string,
  label: string,
  help: string,
  parse: (raw: unknown) => string | null = shortText
): InboundFieldSpec {
  return {
    key,
    table: "speakers",
    column,
    entity: "person",
    label,
    help,
    allowClear: true,
    parse,
  }
}

/**
 * Every column Airtable may write back, in the order the settings card lists
 * them. Adding one is deliberately a code change: each needs a parser, a
 * clearing rule and a place to land, and "just let everything through" is how
 * a spreadsheet typo silently becomes a talk abstract.
 */
export const INBOUND_FIELDS: readonly InboundFieldSpec[] = [
  // ── Submissions ──────────────────────────────────────────────────────────
  {
    key: "submissions.status",
    table: "submissions",
    column: "Status",
    entity: "submission",
    label: "Status",
    help: "Triage in Airtable — Pending, Accept queue, Decline queue, Accepted, Declined. Draft and Withdrawn can never be set from Airtable.",
    allowClear: false,
    parse: parseStatus,
    allowed: (value) =>
      (INBOUND_STATUSES as readonly string[]).includes(value),
  },
  {
    key: "submissions.title",
    table: "submissions",
    column: "Title",
    entity: "submission",
    label: "Title",
    help: "Rewrite a talk title in the grid. Blank cells are ignored — a submission always keeps a title.",
    allowClear: false,
    parse: titleText,
  },
  {
    key: "submissions.description",
    table: "submissions",
    column: "Description",
    entity: "submission",
    label: "Description",
    help: "The abstract itself. Previous wording is kept in the submission's History tab, so an edit here is undoable.",
    allowClear: true,
    parse: longText,
  },
  {
    key: "submissions.track",
    table: "submissions",
    column: "Track",
    entity: "submission",
    label: "Track",
    help: "Matched by name against the tracks on this event. A name that doesn't exist here is left alone — we never invent a track from a spreadsheet.",
    allowClear: true,
    parse: shortText,
    compare: foldCase,
  },
  submissionText(
    "submissions.format",
    "Format",
    "Format",
    "Talk, workshop, panel — free text, exactly as the form collects it."
  ),
  submissionText(
    "submissions.level",
    "Level",
    "Level",
    "Beginner, intermediate, advanced — free text."
  ),
  submissionText(
    "submissions.language",
    "Language",
    "Language",
    "The language the session is delivered in — free text."
  ),
  {
    key: "submissions.tags",
    table: "submissions",
    column: "Tags",
    entity: "submission",
    label: "Tags",
    help: "One comma-separated cell, the same way we write it out. Duplicates are dropped; up to 25 tags.",
    allowClear: true,
    parse: parseTags,
    compare: foldCase,
  },

  // ── Speakers ─────────────────────────────────────────────────────────────
  {
    key: "speakers.firstName",
    table: "speakers",
    column: "First Name",
    entity: "person",
    label: "First name",
    help: "Blank cells are ignored — everyone keeps a first name.",
    allowClear: false,
    parse: shortText,
  },
  personText(
    "speakers.lastName",
    "Last Name",
    "Last name",
    "Surname, as it should appear in the programme."
  ),
  personText(
    "speakers.jobTitle",
    "Job Title",
    "Job title",
    "The line under their name on the public page."
  ),
  personText(
    "speakers.company",
    "Company",
    "Company",
    "Employer or affiliation."
  ),
  personText(
    "speakers.pronouns",
    "Pronouns",
    "Pronouns",
    "Shown wherever the speaker is introduced."
  ),
  personText(
    "speakers.bio",
    "Bio",
    "Bio",
    "The speaker biography. Long text — the natural one to bulk-tidy in a grid.",
    longText
  ),
  personText(
    "speakers.linkedin",
    "LinkedIn",
    "LinkedIn",
    "Profile link on the public speaker page."
  ),
  personText(
    "speakers.twitter",
    "Twitter",
    "Twitter / X",
    "Profile link or handle."
  ),
  personText(
    "speakers.website",
    "Website",
    "Website",
    "Personal site or blog."
  ),

  // ── Sessions (the agenda) ────────────────────────────────────────────────
  {
    key: "sessions.room",
    table: "sessions",
    column: "Room",
    entity: "submission",
    label: "Room",
    help: "Matched by name against this event's rooms. Blank is ignored — clear a slot on the agenda, not in Airtable.",
    allowClear: false,
    parse: shortText,
    compare: foldCase,
  },
  {
    key: "sessions.startsAt",
    table: "sessions",
    column: "Starts At",
    entity: "submission",
    label: "Start time",
    help: "Move a session by editing its start. Clashes aren't blocked — they show up on the agenda's Conflicts view, same as a drag.",
    allowClear: false,
    parse: parseDateTime,
  },
  {
    key: "sessions.duration",
    table: "sessions",
    column: "Duration (min)",
    entity: "submission",
    label: "Duration",
    help: "Whole minutes, between 5 and 480. The “Ends At” column is ours to calculate — edit this one.",
    allowClear: false,
    parse: parseDuration,
  },
]

export const INBOUND_FIELD_KEYS: readonly string[] = INBOUND_FIELDS.map(
  (field) => field.key
)

const BY_KEY = new Map(INBOUND_FIELDS.map((field) => [field.key, field]))

export function inboundField(key: string): InboundFieldSpec | undefined {
  return BY_KEY.get(key)
}

/**
 * What "two-way sync, on" meant before per-field selection existed, and what a
 * freshly-enabled connection starts with: the single highest-value, safest
 * column. An organizer widens it deliberately from there.
 */
export const DEFAULT_INBOUND_FIELDS: readonly string[] = ["submissions.status"]

/**
 * The selected fields, resolved and ordered — the one place that decides what
 * a connection's stored keys actually mean.
 *
 * Unknown keys are dropped rather than rejected, so a connection configured by
 * a newer deployment (or a field we later retire) degrades to "sync what we
 * still understand" instead of failing every pull. An empty selection with the
 * switch on falls back to the default, because a switch that is on and does
 * nothing is worse than either honest state.
 */
export function resolveInboundFields(
  enabled: boolean | undefined,
  keys: readonly string[] | undefined
): InboundFieldSpec[] {
  if (enabled !== true) return []
  const selected = keys && keys.length > 0 ? keys : DEFAULT_INBOUND_FIELDS
  const wanted = new Set(selected)
  return INBOUND_FIELDS.filter((field) => wanted.has(field.key))
}

/** The mirrored tables a pull has to read, given a selection. */
export function tablesToPull(fields: readonly InboundFieldSpec[]): TableKey[] {
  const tables: TableKey[] = []
  for (const field of fields) {
    if (!tables.includes(field.table)) tables.push(field.table)
  }
  return tables
}

/** UI grouping: the fields of one table, with its human name. */
export function inboundGroups(): Array<{
  table: TableKey
  tableName: string
  fields: InboundFieldSpec[]
}> {
  return (["submissions", "speakers", "sessions"] as TableKey[]).map(
    (table) => ({
      table,
      tableName: TABLE_NAMES[table],
      fields: INBOUND_FIELDS.filter((field) => field.table === table),
    })
  )
}

// ——— The guard ——————————————————————————————————————————————————————————

export type InboundReason =
  | "apply"
  /** Not a value we can make sense of — a typo, a bad date, an over-long paste. */
  | "unknown_value"
  /** Understood, but Airtable may not set it (Draft, Withdrawn). */
  | "not_allowed"
  /** Blank cell on a field that can't be cleared from Airtable. */
  | "blank_ignored"
  /** Already what we hold. */
  | "unchanged"
  /** Never mirrored, so an edit can't be told apart from our own echo. */
  | "no_baseline"
  /** Exactly what we last pushed — our own write coming back. */
  | "echo"
  /** Both sides moved; Trackstage wins. */
  | "conflict"
  /** Understood, but it doesn't exist here (an unknown track or room). */
  | "unresolved"
  /** Understood, but the record can't take it (scheduling a declined talk). */
  | "rejected"

export type FieldDecision =
  | { apply: true; value: string; reason: "apply" }
  | {
      apply: false
      value: null
      reason: Exclude<InboundReason, "apply">
      /** What Airtable held, for the conflict audit row. */
      airtableValue?: string
    }

export type FieldCandidate = {
  spec: InboundFieldSpec
  /** The raw Airtable cell. */
  airtableValue: unknown
  /** What we hold right now, in ANY spelling `spec.parse` accepts. */
  currentValue: unknown
  /**
   * The canonical value we last WROTE into this cell, or undefined if we never
   * have. This single value answers both dangerous questions — see the header
   * of convex/lib/airtableInbound.ts.
   */
  baseline: string | undefined
}

/**
 * The whole per-field decision, in one pure function.
 *
 * Order is load-bearing:
 *
 *  1. `unknown_value` — reject a value we cannot even read before ANY state
 *     reasoning, so a typo in Airtable can never be dressed up as a conflict.
 *  2. Blank handling, so an empty cell on a required field stops here rather
 *     than being compared as if it meant something.
 *  3. `unchanged` BEFORE everything that follows, and this is the subtle one.
 *     A cell that already agrees with us is asking for NOTHING, so it cannot
 *     be a conflict, a refusal or an echo — it is silence. Getting this wrong
 *     is not a correctness bug but an honesty bug, and a live run against a
 *     real base is what surfaced it: every Draft and Withdrawn submission we
 *     mirror out comes straight back as a value Airtable "may not set", so the
 *     card reported four permanent refusals that no organizer could ever act
 *     on or clear. Silence must read as silence.
 *  4. `no_baseline` — a cell we have never written gives us nothing to compare
 *     against, so we decline to act. The next push writes the baseline and the
 *     field becomes eligible. This is also what makes clearing safe: an empty
 *     cell can only mean "delete this" once we know we put something there.
 *  5. `echo` — our own write coming back is not a conflict, and not a refusal
 *     either, even when the value is one Airtable isn't allowed to set.
 *  6. `not_allowed` — only now, once we know Airtable is genuinely ASKING for
 *     a change, is refusing it worth reporting.
 *  7. `conflict` — both sides moved; Trackstage wins and the loser is logged.
 */
export function decideField(candidate: FieldCandidate): FieldDecision {
  const { spec } = candidate
  const skip = (
    reason: Exclude<InboundReason, "apply">,
    airtableValue?: string
  ): FieldDecision => ({ apply: false, value: null, reason, airtableValue })

  const incoming = spec.parse(candidate.airtableValue)
  if (incoming === null) return skip("unknown_value")

  // What we hold, spelled the same way. Our own data failing to parse means a
  // value predating this field's rules — treat it as "we can't compare", which
  // the baseline check below turns into a safe skip rather than a blind write.
  const current = spec.parse(candidate.currentValue)
  if (incoming === "" && !spec.allowClear) {
    return current === "" ? skip("unchanged") : skip("blank_ignored")
  }

  const fold = spec.compare ?? ((value: string) => value)
  if (current !== null && fold(incoming) === fold(current)) {
    return skip("unchanged")
  }

  const baseline = candidate.baseline
  if (baseline === undefined) return skip("no_baseline")
  if (fold(incoming) === fold(baseline)) return skip("echo")
  if (incoming !== "" && spec.allowed && !spec.allowed(incoming)) {
    return skip("not_allowed", incoming)
  }
  if (current === null || fold(current) !== fold(baseline)) {
    // Both sides moved since the mirror was written. Trackstage is the source
    // of truth, so the organizer's in-app edit stands and the Airtable value
    // is reported rather than applied. The next push overwrites the cell.
    return skip("conflict", incoming)
  }
  return { apply: true, value: incoming, reason: "apply" }
}

/** Reader-facing wording for every outcome (settings card + activity log). */
export const INBOUND_FIELD_REASON_TEXT: Record<InboundReason, string> = {
  apply: "Applied from Airtable",
  unknown_value: "Airtable holds a value we don't recognise — left alone",
  not_allowed: "That value can't be set from Airtable — left alone",
  blank_ignored: "Airtable's cell is empty and this field can't be cleared",
  unchanged: "Already up to date",
  no_baseline: "Not mirrored yet — eligible after the next sync",
  echo: "Our own last sync coming back — ignored",
  conflict: "Changed in Trackstage too — Trackstage wins",
  unresolved: "No match for that name on this event — left alone",
  rejected: "This record can't take that value — left alone",
}

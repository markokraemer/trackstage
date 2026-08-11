// ————————————————————————————————————————————————————————————————————————
// Airtable Web API client + record mappers (docs/memory/RULES.md 15).
//
// What this is: a ONE-WAY, idempotent mirror of an event's submissions,
// speakers and scheduled sessions into the organizer's OWN Airtable base.
// swyx's clarification is the whole design brief — his team's automations
// fire "once a new row lands", so a read-only mirror is enough and we never
// read anything back out of Airtable.
//
// Everything here is pure/self-contained (no Convex ctx) so the mappers can
// be reasoned about and the client can be pointed at any base:
//   · TABLE_SPECS      — the schema we create (or verify) in the base
//   · *Fields()        — domain row → Airtable field object
//   · chunk()          — Airtable caps create/update at 10 records/request
//   · AirtableClient   — throttled fetch (5 req/s per base), 429 backoff,
//                        PATCH upsert keyed on our own external-id column
//
// Idempotency: every table carries a "Trackstage ID" text column holding
// the Convex document id, and we PATCH with
// `performUpsert.fieldsToMergeOn: ["Trackstage ID"]`. Re-running a full
// sync therefore updates in place and never duplicates a row — which is what
// lets the cron and the on-write hook overlap harmlessly.
// ————————————————————————————————————————————————————————————————————————

const AIRTABLE_API = "https://api.airtable.com"

/** Airtable allows at most 10 records per create/update request. */
export const BATCH_SIZE = 10

/** 5 requests/second per base — stay just under it. */
const MIN_REQUEST_INTERVAL_MS = 220

/** Airtable's own guidance on a 429 is "wait 30 seconds". Ramp up to it. */
const RETRY_DELAYS_MS = [1_000, 5_000, 30_000]

/** The column every table is keyed on. Also the primary field. */
export const EXTERNAL_ID_FIELD = "Trackstage ID"

export type TableKey = "submissions" | "speakers" | "sessions"

export const TABLE_NAMES: Record<TableKey, string> = {
  submissions: "Submissions",
  speakers: "Speakers",
  sessions: "Sessions",
}

export type AirtableFieldSpec = {
  name: string
  type: string
  options?: Record<string, unknown>
}

const dateTimeOptions = {
  timeZone: "utc",
  dateFormat: { name: "iso" },
  timeFormat: { name: "24hour" },
}

const wholeNumberOptions = { precision: 0 }

function choices(...names: string[]) {
  return { choices: names.map((name) => ({ name })) }
}

/**
 * The schema we want in the organizer's base. The FIRST entry of each table is
 * the primary field (Airtable's rule) and is always the external id, so the
 * upsert merge key is also what a human sees first in the grid.
 *
 * These specs do double duty: we create tables from them when the token can
 * write schema, and we print them as a "here's what to create" checklist when
 * it can't.
 */
export const TABLE_SPECS: Record<
  TableKey,
  { name: string; description: string; fields: AirtableFieldSpec[] }
> = {
  submissions: {
    name: TABLE_NAMES.submissions,
    description:
      "Mirrored from Trackstage. One row per submission (abstract or session). Read-only — edits here are overwritten on the next sync.",
    fields: [
      { name: EXTERNAL_ID_FIELD, type: "singleLineText" },
      { name: "Title", type: "singleLineText" },
      {
        name: "Status",
        type: "singleSelect",
        options: choices(
          "Draft",
          "Pending",
          "Accept queue",
          "Decline queue",
          "Accepted",
          "Declined",
          "Withdrawn",
        ),
      },
      {
        name: "Type",
        type: "singleSelect",
        options: choices("Abstract", "Session"),
      },
      { name: "Track", type: "singleLineText" },
      { name: "Format", type: "singleLineText" },
      { name: "Level", type: "singleLineText" },
      { name: "Language", type: "singleLineText" },
      { name: "Tags", type: "singleLineText" },
      { name: "Speakers", type: "singleLineText" },
      { name: "Speaker Emails", type: "singleLineText" },
      { name: "Submitter Email", type: "email" },
      { name: "Description", type: "multilineText" },
      { name: "Form", type: "singleLineText" },
      { name: "Submitted At", type: "dateTime", options: dateTimeOptions },
      { name: "Decided At", type: "dateTime", options: dateTimeOptions },
      { name: "Trackstage Link", type: "url" },
    ],
  },
  speakers: {
    name: TABLE_NAMES.speakers,
    description:
      "Mirrored from Trackstage. One row per person (speakers, co-speakers and submitters). Read-only — edits here are overwritten on the next sync.",
    fields: [
      { name: EXTERNAL_ID_FIELD, type: "singleLineText" },
      { name: "Name", type: "singleLineText" },
      { name: "First Name", type: "singleLineText" },
      { name: "Last Name", type: "singleLineText" },
      { name: "Email", type: "email" },
      { name: "Job Title", type: "singleLineText" },
      { name: "Company", type: "singleLineText" },
      { name: "Pronouns", type: "singleLineText" },
      { name: "Bio", type: "multilineText" },
      { name: "LinkedIn", type: "url" },
      { name: "Twitter", type: "url" },
      { name: "Website", type: "url" },
      { name: "Submissions", type: "number", options: wholeNumberOptions },
      { name: "Accepted", type: "number", options: wholeNumberOptions },
      { name: "Portal Link", type: "url" },
      { name: "Added At", type: "dateTime", options: dateTimeOptions },
    ],
  },
  sessions: {
    name: TABLE_NAMES.sessions,
    description:
      "Mirrored from Trackstage. One row per SCHEDULED session (it has a time on the agenda). Read-only — edits here are overwritten on the next sync.",
    fields: [
      { name: EXTERNAL_ID_FIELD, type: "singleLineText" },
      { name: "Title", type: "singleLineText" },
      { name: "Track", type: "singleLineText" },
      { name: "Room", type: "singleLineText" },
      { name: "Starts At", type: "dateTime", options: dateTimeOptions },
      { name: "Ends At", type: "dateTime", options: dateTimeOptions },
      { name: "Duration (min)", type: "number", options: wholeNumberOptions },
      { name: "Speakers", type: "singleLineText" },
      { name: "Status", type: "singleLineText" },
      { name: "Trackstage Link", type: "url" },
    ],
  },
}

export const TABLE_KEYS: TableKey[] = ["submissions", "speakers", "sessions"]

// ——— Record mappers ————————————————————————————————————————————————————
// Cell values are `string | number | null`. We deliberately send `null` for
// anything empty rather than omitting the key: the mirror should CLEAR a cell
// when the organizer clears the value in Trackstage, not leave a stale one.

export type AirtableCell = string | number | null
export type AirtableFields = Record<string, AirtableCell>
export type AirtableRecordPayload = { fields: AirtableFields }

function text(value: string | undefined | null): AirtableCell {
  const trimmed = (value ?? "").trim()
  return trimmed.length > 0 ? trimmed : null
}

function iso(value: number | undefined | null): AirtableCell {
  return typeof value === "number" ? new Date(value).toISOString() : null
}

function list(values: readonly string[] | undefined): AirtableCell {
  const cleaned = (values ?? []).map((v) => v.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned.join(", ") : null
}

/** "accept_queue" → "Accept queue" — human wording, matching the app's pills. */
export function statusLabel(status: string): string {
  const words = status.replace(/_/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type SubmissionRow = {
  id: string
  title: string
  status: string
  kind: string
  track?: string
  format?: string
  level?: string
  language?: string
  tags: string[]
  speakers: string[]
  speakerEmails: string[]
  submitterEmail?: string
  description?: string
  formName?: string
  submittedAt: number
  decidedAt?: number
  link?: string
}

export function submissionFields(row: SubmissionRow): AirtableFields {
  return {
    [EXTERNAL_ID_FIELD]: row.id,
    Title: text(row.title),
    Status: statusLabel(row.status),
    Type: row.kind === "session" ? "Session" : "Abstract",
    Track: text(row.track),
    Format: text(row.format),
    Level: text(row.level),
    Language: text(row.language),
    Tags: list(row.tags),
    Speakers: list(row.speakers),
    "Speaker Emails": list(row.speakerEmails),
    "Submitter Email": text(row.submitterEmail),
    Description: text(row.description),
    Form: text(row.formName),
    "Submitted At": iso(row.submittedAt),
    "Decided At": iso(row.decidedAt),
    "Trackstage Link": text(row.link),
  }
}

export type SpeakerRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  company?: string
  pronouns?: string
  bio?: string
  linkedin?: string
  twitter?: string
  website?: string
  submissionCount: number
  acceptedCount: number
  portalLink?: string
  addedAt: number
}

export function speakerFields(row: SpeakerRow): AirtableFields {
  const name = `${row.firstName} ${row.lastName}`.trim()
  return {
    [EXTERNAL_ID_FIELD]: row.id,
    Name: text(name) ?? row.email,
    "First Name": text(row.firstName),
    "Last Name": text(row.lastName),
    Email: text(row.email),
    "Job Title": text(row.jobTitle),
    Company: text(row.company),
    Pronouns: text(row.pronouns),
    Bio: text(row.bio),
    LinkedIn: text(row.linkedin),
    Twitter: text(row.twitter),
    Website: text(row.website),
    Submissions: row.submissionCount,
    Accepted: row.acceptedCount,
    "Portal Link": text(row.portalLink),
    "Added At": iso(row.addedAt),
  }
}

export type SessionRow = {
  id: string
  title: string
  track?: string
  room?: string
  startsAt: number
  durationMinutes?: number
  speakers: string[]
  status: string
  link?: string
}

export function sessionFields(row: SessionRow): AirtableFields {
  const duration = row.durationMinutes ?? null
  return {
    [EXTERNAL_ID_FIELD]: row.id,
    Title: text(row.title),
    Track: text(row.track),
    Room: text(row.room),
    "Starts At": iso(row.startsAt),
    "Ends At":
      duration !== null ? iso(row.startsAt + duration * 60_000) : null,
    "Duration (min)": duration,
    Speakers: list(row.speakers),
    Status: statusLabel(row.status),
    "Trackstage Link": text(row.link),
  }
}

// ——— Batching ——————————————————————————————————————————————————————————

export function chunk<T>(items: readonly T[], size: number = BATCH_SIZE): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1")
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

// ——— Client ————————————————————————————————————————————————————————————

export class AirtableError extends Error {
  readonly status: number
  readonly airtableType?: string

  constructor(message: string, status: number, airtableType?: string) {
    super(message)
    this.name = "AirtableError"
    this.status = status
    this.airtableType = airtableType
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Shape checks before we spend a round-trip. Airtable ids are stable and
 * prefixed, so a typo can be caught with a sentence the organizer can act on
 * instead of a raw 404.
 */
export function validateCredentials(token: string, baseId: string): void {
  if (!token) {
    throw new AirtableError("Paste your Airtable personal access token.", 400)
  }
  if (/\s/.test(token)) {
    throw new AirtableError(
      "That token contains a space — copy the whole value from Airtable without line breaks.",
      400,
    )
  }
  if (!token.startsWith("pat")) {
    throw new AirtableError(
      "Airtable personal access tokens start with “pat”. Create one at airtable.com/create/tokens — the older API keys (“key…”) no longer work.",
      400,
    )
  }
  if (!baseId.startsWith("app")) {
    throw new AirtableError(
      "A base ID starts with “app”. Open your base in Airtable and copy the part of the URL right after airtable.com/ — for example airtable.com/appAbC123…/tbl…",
      400,
    )
  }
}

type AirtableErrorBody = {
  error?: string | { type?: string; message?: string }
}

function readError(status: number, body: string): AirtableError {
  let type: string | undefined
  let detail: string | undefined
  try {
    const parsed = JSON.parse(body) as AirtableErrorBody
    if (typeof parsed.error === "string") {
      type = parsed.error
    } else if (parsed.error) {
      type = parsed.error.type
      detail = parsed.error.message
    }
  } catch {
    detail = body.slice(0, 200)
  }

  const suffix = detail ? ` (${detail})` : ""
  let message: string
  switch (status) {
    case 401:
      message =
        "Airtable rejected that token. Check you pasted the whole value and that the token hasn't been deleted."
      break
    case 403:
      message =
        type === "INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND"
          ? "That token can't see this base. In Airtable, edit the token and add this base under “Access”."
          : `Your Airtable token is missing a permission it needs${suffix}.`
      break
    case 404:
      message =
        "Airtable couldn't find that base. Double-check the base ID (it starts with “app”)."
      break
    case 422:
      message = `Airtable rejected the data${suffix}.`
      break
    case 429:
      message =
        "Airtable is rate-limiting this base right now. We'll retry on the next sync."
      break
    default:
      message =
        status >= 500
          ? "Airtable is having trouble right now. We'll retry on the next sync."
          : `Airtable returned an unexpected error (${status})${suffix}.`
  }
  return new AirtableError(message, status, type)
}

/** `Unknown field name: "Foo"` → `Foo`. */
function unknownFieldName(error: AirtableError): string | null {
  if (error.airtableType !== "UNKNOWN_FIELD_NAME") return null
  const match = /Unknown field name:\s*"([^"]+)"/.exec(error.message)
  return match?.[1] ?? null
}

export type BaseSchema = {
  tables: Array<{
    id: string
    name: string
    fields: Array<{ id: string; name: string; type: string }>
  }>
}

/**
 * A thin, deliberately boring Airtable client: one base, self-throttled,
 * retries 429s and 5xx, and turns every failure into a sentence an event
 * organizer can act on.
 */
export class AirtableClient {
  private lastRequestAt = 0

  constructor(
    private readonly token: string,
    readonly baseId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now()
      if (wait > 0) await sleep(wait)
      this.lastRequestAt = Date.now()

      const response = await this.fetchImpl(`${AIRTABLE_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      if (response.ok) return (await response.json()) as T

      const error = readError(response.status, await response.text())
      const retryable = response.status === 429 || response.status >= 500
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw error
    }
  }

  /** Doubles as the credential check: it fails loudly on a bad token or base. */
  async getBaseSchema(): Promise<BaseSchema> {
    return await this.request<BaseSchema>(
      "GET",
      `/v0/meta/bases/${this.baseId}/tables`,
    )
  }

  /**
   * Read records back out — the ONLY read path in the integration, used by
   * the experimental two-way sync (convex/lib/airtableInbound.ts).
   *
   * Deliberately narrow: it asks for named fields only (so a pull never drags
   * a base's worth of unrelated columns across the wire), follows Airtable's
   * `offset` pagination, and stops at `maxRecords` so one runaway base cannot
   * make a sync run unbounded. `cellFormat: "string"` is NOT used — we want
   * the raw single-select name, not a locale-formatted rendering.
   */
  async listRecords(
    tableName: string,
    options: {
      fields?: string[]
      filterByFormula?: string
      maxRecords?: number
      pageSize?: number
    } = {},
  ): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
    const maxRecords = options.maxRecords ?? 1_000
    const out: Array<{ id: string; fields: Record<string, unknown> }> = []
    let offset: string | undefined

    do {
      const params = new URLSearchParams()
      params.set("pageSize", String(Math.min(options.pageSize ?? 100, 100)))
      for (const field of options.fields ?? []) params.append("fields[]", field)
      if (options.filterByFormula) {
        params.set("filterByFormula", options.filterByFormula)
      }
      if (offset) params.set("offset", offset)

      const page = await this.request<{
        records?: Array<{ id: string; fields?: Record<string, unknown> }>
        offset?: string
      }>(
        "GET",
        `/v0/${this.baseId}/${encodeURIComponent(tableName)}?${params.toString()}`,
      )

      for (const record of page.records ?? []) {
        out.push({ id: record.id, fields: record.fields ?? {} })
        if (out.length >= maxRecords) return out
      }
      offset = page.offset
    } while (offset)

    return out
  }

  async createTable(spec: {
    name: string
    description: string
    fields: AirtableFieldSpec[]
  }): Promise<{ id: string; name: string }> {
    return await this.request<{ id: string; name: string }>(
      "POST",
      `/v0/meta/bases/${this.baseId}/tables`,
      spec,
    )
  }

  async createField(
    tableId: string,
    field: AirtableFieldSpec,
  ): Promise<{ id: string; name: string }> {
    return await this.request<{ id: string; name: string }>(
      "POST",
      `/v0/meta/bases/${this.baseId}/tables/${tableId}/fields`,
      field,
    )
  }

  /**
   * Idempotent write: PATCH with `performUpsert` keyed on our external-id
   * column, ten records at a time.
   *
   * `typecast` lets Airtable coerce values and add missing single-select
   * options rather than failing the batch — the organizer may well have
   * renamed things in their base, and a mirror should bend, not break.
   *
   * If the base is missing a column we send (hand-made table, or an older
   * template), Airtable answers 422 UNKNOWN_FIELD_NAME. Rather than failing
   * the sync we drop that column and retry, so a partial table still mirrors.
   */
  async upsert(
    tableName: string,
    records: AirtableRecordPayload[],
  ): Promise<{ created: number; updated: number; droppedFields: string[] }> {
    let created = 0
    let updated = 0
    const dropped = new Set<string>()

    for (const batch of chunk(records)) {
      let payload = batch
      for (;;) {
        try {
          const result = await this.request<{
            createdRecords?: string[]
            updatedRecords?: string[]
          }>("PATCH", `/v0/${this.baseId}/${encodeURIComponent(tableName)}`, {
            performUpsert: { fieldsToMergeOn: [EXTERNAL_ID_FIELD] },
            typecast: true,
            records: payload,
          })
          created += result.createdRecords?.length ?? 0
          updated += result.updatedRecords?.length ?? 0
          break
        } catch (error) {
          const field =
            error instanceof AirtableError ? unknownFieldName(error) : null
          if (!field || dropped.has(field)) throw error
          dropped.add(field)
          payload = payload.map((record) => {
            const { [field]: _removed, ...rest } = record.fields
            return { fields: rest }
          })
        }
      }
    }

    return { created, updated, droppedFields: [...dropped] }
  }
}

// ——— Schema reconciliation ——————————————————————————————————————————————

export type EnsureTablesResult = {
  createdTables: string[]
  createdFields: string[]
  /** Non-fatal notes worth showing the organizer (e.g. a field we couldn't add). */
  warnings: string[]
}

/**
 * Make the base look like TABLE_SPECS, with a graceful ladder:
 *   1. table exists with all our columns → nothing to do;
 *   2. token can write schema → create what's missing;
 *   3. token can't → a friendly error naming exactly what to create by hand
 *      (we match tables by NAME, so a hand-made table works identically).
 *
 * Missing individual FIELDS never hard-fail: `upsert` prunes unknown columns,
 * so a table the organizer built themselves still mirrors what it can.
 */
export async function ensureTables(
  client: AirtableClient,
  schema: BaseSchema,
): Promise<EnsureTablesResult> {
  const result: EnsureTablesResult = {
    createdTables: [],
    createdFields: [],
    warnings: [],
  }

  for (const key of TABLE_KEYS) {
    const spec = TABLE_SPECS[key]
    const existing = schema.tables.find(
      (table) => table.name.toLowerCase() === spec.name.toLowerCase(),
    )

    if (!existing) {
      try {
        // Create with the primary field only, then add the rest one by one —
        // a single rejected field spec then costs one column, not the table.
        const table = await client.createTable({
          name: spec.name,
          description: spec.description,
          fields: [spec.fields[0]],
        })
        result.createdTables.push(spec.name)
        for (const field of spec.fields.slice(1)) {
          try {
            await client.createField(table.id, field)
            result.createdFields.push(`${spec.name}.${field.name}`)
          } catch {
            result.warnings.push(
              `Couldn't add the “${field.name}” column to ${spec.name} — add it manually if you need it.`,
            )
          }
        }
      } catch (error) {
        if (error instanceof AirtableError && error.status === 403) {
          throw new AirtableError(missingSchemaScopeMessage(), 403, error.airtableType)
        }
        throw error
      }
      continue
    }

    const present = new Set(existing.fields.map((f) => f.name.toLowerCase()))
    if (!present.has(EXTERNAL_ID_FIELD.toLowerCase())) {
      throw new AirtableError(
        `Your “${spec.name}” table has no “${EXTERNAL_ID_FIELD}” column. That column is how we match rows on every sync — add it as a single line text field (ideally the first one), or rename the table and let us create a fresh one.`,
        422,
      )
    }
    for (const field of spec.fields.slice(1)) {
      if (present.has(field.name.toLowerCase())) continue
      try {
        await client.createField(existing.id, field)
        result.createdFields.push(`${spec.name}.${field.name}`)
      } catch {
        result.warnings.push(
          `“${spec.name}” has no “${field.name}” column and we couldn't add it — that value won't be mirrored.`,
        )
      }
    }
  }

  return result
}

/** The copy an organizer sees when their token can read but not write schema. */
export function missingSchemaScopeMessage(): string {
  const tables = TABLE_KEYS.map((key) => {
    const spec = TABLE_SPECS[key]
    return `${spec.name} (${spec.fields.map((f) => f.name).join(", ")})`
  }).join("; ")
  return (
    "Your token can read this base but can't create tables. Either add the " +
    "“schema.bases:write” scope to the token in Airtable, or create these three " +
    `tables yourself and reconnect — we match them by name: ${tables}. The ` +
    `“${EXTERNAL_ID_FIELD}” column must be the first (primary) field in each.`
  )
}

/** The scopes we ask for, in the order the Airtable token screen lists them. */
export const REQUIRED_SCOPES = [
  "data.records:read",
  "data.records:write",
  "schema.bases:read",
  "schema.bases:write",
] as const

/** Masked form for the UI — never return the token itself from a query. */
export function maskToken(token: string): string {
  return token.length <= 10 ? "pat••••" : `${token.slice(0, 7)}…${token.slice(-4)}`
}

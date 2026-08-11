import type { ReactNode } from "react"
import { RiInformationLine } from "@remixicon/react"

import { StatusPill } from "@/components/shared/status-pill"
import {
  Chip,
  EmptyRow,
  FieldGrid,
  Note,
  OpenLink,
  Panel,
  formatWhen,
  isRecord,
  num,
  str,
} from "@/components/copilot/tool-views/shared"
import type { FieldEntry } from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * The AUTO VIEW — the presentable renderer for every tool without a bespoke one.
 *
 * The rule this file exists to enforce (Marko, prompt #30): a tool result must
 * never reach the organizer as naked JSON. Bespoke views cover the tools whose
 * payloads earn a purpose-built layout; this covers the rest, and covers any
 * tool added to the MCP server tomorrow — the registry is keyed by tool NAME
 * and the server is discovered at runtime, so "a tool we've never heard of" is
 * a permanent, not a temporary, state of the world.
 *
 * What it does, in order:
 *
 *  1. Unwraps the REST envelope. Roughly a third of the tools proxy
 *     `internal.apiV1.*` and answer `{data, results, pagination}` — three views
 *     of the same rows. The auto view reads `data`, uses `pagination` only for
 *     the row count in the header, and drops `results` (a byte-identical
 *     duplicate) so the organizer isn't shown everything twice.
 *  2. Splits the payload into scalars (a label/value grid), arrays of objects
 *     (compact tables), arrays of strings (chips) and nested objects (their own
 *     small grid, one level deep — deeper than that and a card is worse than
 *     the JSON it replaced, so the tail is summarised, not drawn).
 *  3. Types values by what they ARE, not what they're called: ISO timestamps
 *     become readable dates, `http(s)` strings become real links, booleans
 *     become Yes/No, a `status` becomes the app's own status pill.
 *  4. Redacts. A payload can carry a webhook signing secret or a magic-link
 *     token, and an auto-generated card is exactly where one would leak by
 *     accident, so anything named like a credential renders masked. Bespoke
 *     views hand out credentials deliberately (LinkRow, with copy); this one
 *     never does it by accident.
 *
 * Read defensively throughout — same contract as every other view (shared.tsx).
 */

// ——— Key handling ————————————————————————————————————————————————————————

/** Envelope plumbing and internal sentinels: true of the transport, not the record. */
const NOISE_KEYS = new Set([
  "results", // byte-identical duplicate of `data`
  "unknownResource", // internal dispatch sentinel
  "currentPage",
  "current_page",
  "pageSize",
  "page_size",
  "totalPages",
  "total_pages",
  "totalResults",
  "total_results",
])

/** Convex ids and foreign keys — machine handles, meaningless to an organizer. */
function isIdKey(key: string): boolean {
  return /^_?id$/i.test(key) || /(^|_)ids?$|Ids?$/.test(key)
}

/** Anything that would be a credential if we printed it. */
function isSecretKey(key: string): boolean {
  return /secret|token|password|api_?key|signing/i.test(key)
}

/** `total_results` / `totalResults` / `dueAt` → "Total results" / "Due at". */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/^_+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

// ——— Value rendering ——————————————————————————————————————————————————————

/** Everything that is not an object or an array, drawn by what it is. */
function ScalarValue({ name, value }: { name: string; value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }
  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>
  }
  if (typeof value === "number") {
    return <span className="tabular-nums">{value.toLocaleString()}</span>
  }
  if (typeof value !== "string") return <span>{String(value)}</span>

  if (isSecretKey(name)) {
    // Show enough to recognise which credential it is, never enough to use it.
    const head = value.slice(0, 6)
    return (
      <span className="font-mono text-muted-foreground">
        {head}
        {"•".repeat(8)} <span className="font-sans text-xs">(hidden)</span>
      </span>
    )
  }
  if (isUrl(value)) return <OpenLink href={value}>{value}</OpenLink>
  if (ISO_DATE.test(value)) {
    const when = formatWhen(value)
    if (when) return <span>{when}</span>
  }
  if (/^(status|state|workflow_status|approval_status)$/i.test(name)) {
    return <StatusPill status={value} size="sm" />
  }
  return <span>{value}</span>
}

/** The one-cell form: same typing, but short enough for a table column. */
function CellValue({ name, value }: { name: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <span className="text-muted-foreground">
        {value.length === 0 ? "—" : `${value.length} item${value.length === 1 ? "" : "s"}`}
      </span>
    )
  }
  if (isRecord(value)) {
    // Nested records inside a table row: show the field a human would read.
    const label = str(value.name) ?? str(value.title) ?? str(value.full_name) ?? str(value.email)
    return <span className="truncate">{label ?? "—"}</span>
  }
  return <ScalarValue name={name} value={value} />
}

// ——— Tables ———————————————————————————————————————————————————————————————

const MAX_TABLE_ROWS = 8
const MAX_TABLE_COLS = 4

/**
 * Column choice for an array of unknown objects.
 *
 * Preference beats frequency: an organizer scanning a table wants the NAME
 * first, whatever else the row carries. So a small priority list runs first and
 * the remaining slots are filled by how often a key actually appears — a
 * heterogeneous array still gets a table rather than a ragged one.
 */
const PREFERRED_COLUMNS = [
  "name",
  "title",
  "label",
  "email",
  "full_name",
  "status",
  "url",
  "kind",
  "role",
  "type",
]

export function pickColumns(rows: Array<Record<string, unknown>>): Array<string> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (NOISE_KEYS.has(key) || isIdKey(key) || isSecretKey(key)) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const chosen: Array<string> = []
  for (const key of PREFERRED_COLUMNS) {
    if (counts.has(key) && !chosen.includes(key)) chosen.push(key)
    if (chosen.length >= MAX_TABLE_COLS) return chosen
  }
  const rest = [...counts.entries()]
    .filter(([key]) => !chosen.includes(key))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key]) => key)
  return [...chosen, ...rest].slice(0, MAX_TABLE_COLS)
}

function AutoTable({
  rows,
  label,
  total,
}: {
  rows: Array<Record<string, unknown>>
  label: string
  /** The server's own count when pagination knows more rows exist than we hold. */
  total?: number | null
}) {
  const columns = pickColumns(rows)
  const shown = rows.slice(0, MAX_TABLE_ROWS)
  const meta = total != null && total > rows.length ? `${total} total` : `${rows.length}`
  if (columns.length === 0) {
    return (
      <Panel title={label} meta={meta}>
        <EmptyRow>
          {rows.length} record{rows.length === 1 ? "" : "s"} with nothing
          readable to show.
        </EmptyRow>
      </Panel>
    )
  }
  return (
    <Panel title={label} meta={meta}>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((column) => (
                <th
                  key={column}
                  className="truncate px-2.5 py-1.5 text-left font-medium text-muted-foreground"
                >
                  {humanizeKey(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td
                    key={column}
                    className="max-w-0 truncate px-2.5 py-1.5 text-foreground"
                  >
                    <CellValue name={column} value={row[column]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length ? (
        <Note>
          +{rows.length - shown.length} more not shown — ask me to narrow the
          list.
        </Note>
      ) : null}
    </Panel>
  )
}

// ——— The view ————————————————————————————————————————————————————————————

type Split = {
  fields: Array<FieldEntry>
  tables: Array<{ key: string; rows: Array<Record<string, unknown>> }>
  chips: Array<{ key: string; values: Array<string> }>
  notes: Array<string>
}

/** One pass over a record, sorting each entry into how it wants to be drawn. */
function splitRecord(record: Record<string, unknown>, depth = 0): Split {
  const split: Split = { fields: [], tables: [], chips: [], notes: [] }
  for (const [key, value] of Object.entries(record)) {
    if (NOISE_KEYS.has(key)) continue
    // `note` is the MCP server's own plain-English trailer — it reads as prose,
    // never as a table cell.
    if (/^(note|notes|summary|headline|message)$/i.test(key) && typeof value === "string") {
      split.notes.push(value)
      continue
    }
    if (isIdKey(key)) continue

    if (Array.isArray(value)) {
      const objects = value.filter(isRecord)
      if (objects.length > 0) {
        split.tables.push({ key, rows: objects })
      } else {
        const strings = value
          .filter((entry) => typeof entry === "string" || typeof entry === "number")
          .map((entry) => String(entry))
        if (strings.length > 0) split.chips.push({ key, values: strings })
        else split.fields.push({ label: humanizeKey(key), value: "—" })
      }
      continue
    }

    if (isRecord(value)) {
      if (depth >= 1) {
        // Deeper than one nesting level, a card stops being clearer than the
        // JSON — so say what is there and stop.
        const count = Object.keys(value).length
        split.fields.push({
          label: humanizeKey(key),
          value: `${count} field${count === 1 ? "" : "s"}`,
        })
        continue
      }
      const nested = splitRecord(value, depth + 1)
      for (const entry of nested.fields) {
        split.fields.push({
          label: `${humanizeKey(key)} · ${entry.label}`,
          value: entry.value,
        })
      }
      split.tables.push(...nested.tables)
      split.chips.push(...nested.chips)
      split.notes.push(...nested.notes)
      continue
    }

    split.fields.push({
      label: humanizeKey(key),
      value: <ScalarValue name={key} value={value} />,
    })
  }
  return split
}

/**
 * Unwraps `{data, results, pagination}` down to the payload worth drawing, and
 * reports the true total when pagination knows it.
 */
export function unwrapEnvelope(output: Record<string, unknown>): {
  payload: unknown
  total: number | null
} {
  const pagination = isRecord(output.pagination) ? output.pagination : null
  const total = pagination
    ? (num(pagination.totalResults) ?? num(pagination.total_results))
    : null
  if ("data" in output && (pagination || "results" in output)) {
    return { payload: output.data, total }
  }
  return { payload: output, total }
}

export function AutoView({ output, toolName }: ToolOutputProps) {
  const { payload, total } = unwrapEnvelope(output)
  const heading = humanizeKey(toolName)

  if (Array.isArray(payload)) {
    const rows = payload.filter(isRecord)
    if (rows.length === 0) {
      return <EmptyRow>Nothing came back for {heading.toLowerCase()}.</EmptyRow>
    }
    return <AutoTable rows={rows} label={heading} total={total} />
  }

  if (!isRecord(payload)) {
    return (
      <Panel title={heading}>
        <p className="text-sm text-foreground">{String(payload ?? "Done.")}</p>
      </Panel>
    )
  }

  const { fields, tables, chips, notes } = splitRecord(payload)
  const empty =
    fields.length === 0 &&
    tables.length === 0 &&
    chips.length === 0 &&
    notes.length === 0
  if (empty) {
    return (
      <EmptyRow>
        {heading} ran and returned nothing to show — no news is good news here.
      </EmptyRow>
    )
  }

  const blocks: Array<ReactNode> = []
  if (fields.length > 0) {
    blocks.push(
      <div
        key="fields"
        className="rounded-lg border border-border bg-card p-3"
      >
        <FieldGrid entries={fields} />
      </div>
    )
  }
  for (const group of chips) {
    blocks.push(
      <div key={`chips-${group.key}`} className="space-y-1">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {humanizeKey(group.key)}
        </p>
        <div className="flex flex-wrap gap-1">
          {group.values.slice(0, 12).map((value, index) => (
            <Chip key={`${value}-${index}`} tone="muted">
              {value}
            </Chip>
          ))}
          {group.values.length > 12 ? (
            <Chip tone="muted">+{group.values.length - 12}</Chip>
          ) : null}
        </div>
      </div>
    )
  }
  for (const table of tables) {
    blocks.push(
      <AutoTable
        key={`table-${table.key}`}
        rows={table.rows}
        label={humanizeKey(table.key)}
      />
    )
  }

  return (
    <Panel
      title={heading}
      meta={total !== null ? `${total} total` : undefined}
    >
      <div className="space-y-2.5">{blocks}</div>
      {notes.map((note, index) => (
        <Note key={index}>
          <RiInformationLine
            size={12}
            aria-hidden
            className="mr-1 inline-block align-[-1px]"
          />
          {note}
        </Note>
      ))}
    </Panel>
  )
}

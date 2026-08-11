import { format } from "date-fns"

import { statusLabel } from "@/components/shared/status-pill"

/**
 * Client-side CSV export for the submissions table (docs/SPEC.md §4.4 Options →
 * Export CSV). The server hands back the joined rows (`submissions.exportData`)
 * and the file is assembled in the browser — no extra backend surface, and the
 * download starts instantly.
 */

/** The shape we consume from `submissions.exportData` (a structural subset). */
export interface ExportableSubmission {
  _id: string
  _creationTime: number
  title: string
  status: string
  kind: string
  description?: string
  format?: string
  level?: string
  language?: string
  tags: Array<string>
  track: { name: string } | null
  room: { name: string } | null
  formName?: string
  startsAt?: number
  durationMinutes?: number
  decidedAt?: number
  notifiedAt?: number
  participants: Array<{ name: string; email: string; role: string }>
}

export interface ScoreAggregate {
  avg: number | null
  count: number
}

const HEADERS = [
  "Title",
  "Status",
  "Type",
  "Source form",
  "Track",
  "Format",
  "Level",
  "Language",
  "Tags",
  "Speakers",
  "Speaker emails",
  "Average score",
  "Reviews",
  "Room",
  "Scheduled at",
  "Duration (min)",
  "Submitted at",
  "Decided at",
  "Notified at",
  "Description",
]

function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  // Escape per RFC 4180; the leading-symbol guard stops spreadsheets treating a
  // title like "=SUM(…)" as a formula.
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${guarded.replace(/"/g, '""')}"`
}

function stamp(ms?: number): string {
  if (!ms) return ""
  return format(new Date(ms), "yyyy-MM-dd HH:mm")
}

export function buildSubmissionsCsv(
  rows: Array<ExportableSubmission>,
  scores: Record<string, ScoreAggregate | undefined> = {}
): string {
  const lines = [HEADERS.map(cell).join(",")]
  for (const row of rows) {
    const score = scores[row._id]
    const speakers = row.participants.filter((p) => p.role === "speaker")
    const people = speakers.length > 0 ? speakers : row.participants
    lines.push(
      [
        row.title,
        statusLabel(row.status),
        row.kind === "session" ? "Session" : "Abstract",
        row.formName ?? "Added manually",
        row.track?.name ?? "",
        row.format ?? "",
        row.level ?? "",
        row.language ?? "",
        row.tags.join("; "),
        people.map((p) => p.name).join("; "),
        people.map((p) => p.email).join("; "),
        score?.avg ?? "",
        score?.count ?? 0,
        row.room?.name ?? "",
        stamp(row.startsAt),
        row.durationMinutes ?? "",
        stamp(row._creationTime),
        stamp(row.decidedAt),
        stamp(row.notifiedAt),
        row.description ?? "",
      ]
        .map(cell)
        .join(",")
    )
  }
  return lines.join("\r\n")
}

/** Triggers a browser download. Call from an event handler only. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * "ai-engineer-world-s-fair-submissions-2026-08-11.csv".
 *
 * `dataset` names what's in the file — the same rows are exported as "scores"
 * from Evaluation, where the point of the download is the score columns.
 */
export function csvFilename(
  eventName: string,
  dataset: "submissions" | "scores" = "submissions"
): string {
  const slug =
    eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event"
  return `${slug}-${dataset}-${format(new Date(), "yyyy-MM-dd")}.csv`
}

import type { ReactNode } from "react"
import {
  RiCalendarEventLine,
  RiExternalLinkLine,
  RiMailSendLine,
  RiTimeLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ai-elements/code-block"
import { StatusPill, statusLabel } from "@/components/shared/status-pill"

/**
 * Generative UI for MCP tool results (docs/memory/RULES.md #24).
 *
 * The copilot's tools return JSON. Dumping JSON at a conference organizer is
 * a non-answer, so the results we know the shape of get rendered as the same
 * primitives the rest of the app uses — status pills, stat rows, compact
 * tables. Anything unrecognised falls back to a syntax-highlighted block, so
 * a tool added to the MCP server tomorrow still renders something honest.
 *
 * Shapes come from convex/mcp.ts (submissionRow, eventSummary, listSpeakers,
 * …). They are read defensively: a renderer that can't recognise its payload
 * returns null and the caller drops back to JSON rather than crashing the
 * conversation.
 */

// ——— Small shared bits —————————————————————————————————————————————————

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: ReactNode
  tone?: "default" | "warn"
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2",
        tone === "warn" && "border-status-amber-dot/40 bg-status-amber-bg/40",
      )}
    >
      <div className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-lg leading-none font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  )
}

function ResultShell({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {meta ? (
          <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null
  return value.filter(isRecord)
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "Ada Lovelace <ada@x.com>" → "Ada Lovelace". */
function speakerName(entry: unknown): string {
  const raw = typeof entry === "string" ? entry : ""
  return raw.replace(/\s*<[^>]*>\s*$/, "").trim() || raw
}

function formatDay(iso: unknown): string | null {
  const value = str(iso)
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// ——— Renderers ——————————————————————————————————————————————————————————

/** `list_submissions` → compact table with status pills. */
function SubmissionsResult({ data }: { data: Record<string, unknown> }) {
  const rows = asArray(data.submissions)
  if (!rows) return null
  const total = num(data.total) ?? rows.length
  const returned = num(data.returned) ?? rows.length

  if (rows.length === 0) {
    return (
      <ResultShell title="Submissions">
        <p className="text-sm text-muted-foreground">
          No submissions match that.
        </p>
      </ResultShell>
    )
  }

  return (
    <ResultShell
      title="Submissions"
      meta={
        returned < total ? `showing ${returned} of ${total}` : `${total} total`
      }
    >
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, index) => {
              const speakers = Array.isArray(row.speakers)
                ? row.speakers.map(speakerName).filter(Boolean)
                : []
              const scheduled = isRecord(row.scheduled) ? row.scheduled : null
              return (
                <tr
                  key={str(row.submissionId) ?? index}
                  className="border-b border-border last:border-0"
                >
                  <td className="min-w-0 px-3 py-2 align-top">
                    <div className="truncate font-medium text-foreground">
                      {str(row.title) ?? "Untitled"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {speakers.length > 0 ? (
                        <span className="truncate">{speakers.join(", ")}</span>
                      ) : null}
                      {str(row.track) ? (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          {str(row.track)}
                        </Badge>
                      ) : null}
                      {scheduled ? (
                        <span className="inline-flex items-center gap-1">
                          <RiTimeLine size={12} aria-hidden />
                          {formatDay(scheduled.startsAt) ?? "scheduled"}
                          {str(scheduled.room) ? ` · ${str(scheduled.room)}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                    <StatusPill status={str(row.status) ?? "draft"} size="sm" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ResultShell>
  )
}

/** `get_event_summary` / `get_event_overview` → stat cards + what to do next. */
function EventStatsResult({ data }: { data: Record<string, unknown> }) {
  const event = isRecord(data.event) ? data.event : null
  const counts = isRecord(data.submissions)
    ? (data.submissions)
    : isRecord(data.statusCounts)
      ? (data.statusCounts)
      : null
  const agenda = isRecord(data.agenda) ? data.agenda : null

  const scheduled = num(agenda?.scheduled) ?? num(data.scheduledSessions)
  const waiting =
    num(agenda?.acceptedNotScheduled) ?? num(data.acceptedNotYetScheduled)
  const conflicts = Array.isArray(agenda?.conflicts)
    ? agenda.conflicts.length
    : num(data.agendaConflicts)
  const openTasks =
    num(isRecord(data.speakerTasks) ? data.speakerTasks.open : undefined) ??
    num(data.openTaskCount)

  if (!event && !counts) return null

  const statusEntries = counts
    ? Object.entries(counts).filter(([, value]) => num(value) !== null)
    : []
  const needsAttention = Array.isArray(data.needsAttention)
    ? data.needsAttention.filter((entry): entry is string => typeof entry === "string")
    : []
  const forms = asArray(data.forms) ?? []

  return (
    <ResultShell
      title={str(event?.name) ?? "Event"}
      meta={str(event?.slug) ?? undefined}
    >
      {str(data.headline) ? (
        <p className="text-sm text-muted-foreground">{str(data.headline)}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {scheduled !== null ? (
          <StatCard label="Scheduled" value={scheduled} />
        ) : null}
        {waiting !== null ? (
          <StatCard
            label="Awaiting slot"
            value={waiting}
            tone={waiting > 0 ? "warn" : "default"}
          />
        ) : null}
        {conflicts !== null ? (
          <StatCard
            label="Conflicts"
            value={conflicts}
            tone={conflicts > 0 ? "warn" : "default"}
          />
        ) : null}
        {openTasks !== null ? (
          <StatCard
            label="Open tasks"
            value={openTasks}
            tone={openTasks > 0 ? "warn" : "default"}
          />
        ) : null}
      </div>

      {statusEntries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusEntries.map(([status, value]) => (
            <StatusPill
              key={status}
              status={status}
              size="sm"
              label={`${statusLabel(status)} · ${String(value)}`}
            />
          ))}
        </div>
      ) : null}

      {needsAttention.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          {needsAttention.map((entry) => (
            <li key={entry} className="flex gap-2 text-foreground">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-status-amber-dot" />
              <span className="min-w-0">{entry}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {forms.length > 0 ? (
        <div className="space-y-1">
          {forms.map((form, index) => {
            const url = str(form.publicUrl)
            return (
              <div
                key={str(form.formId) ?? str(form.name) ?? index}
                className="flex items-center gap-2 text-sm"
              >
                <StatusPill status={str(form.status) ?? "open"} size="sm" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {str(form.name) ?? "CFP form"}
                </span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Public link
                    <RiExternalLinkLine size={12} aria-hidden />
                  </a>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </ResultShell>
  )
}

/** `list_speakers` → avatar roster with what each speaker still owes. */
function SpeakersResult({ data }: { data: Record<string, unknown> }) {
  const rows = asArray(data.speakers)
  if (!rows) return null
  if (rows.length === 0) {
    return (
      <ResultShell title="Speakers">
        <p className="text-sm text-muted-foreground">
          Nobody matches — everyone is done.
        </p>
      </ResultShell>
    )
  }

  return (
    <ResultShell
      title="Speakers"
      meta={`${num(data.speakerCount) ?? rows.length} people`}
    >
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map((row, index) => {
          const name = str(row.name) ?? "Unknown"
          const tasks = asArray(row.outstandingTasks) ?? []
          const missing = Array.isArray(row.missingProfileItems)
            ? row.missingProfileItems.filter(
                (entry): entry is string => typeof entry === "string",
              )
            : []
          const sessions = Array.isArray(row.sessions)
            ? row.sessions.filter((entry): entry is string => typeof entry === "string")
            : []
          return (
            <li
              key={str(row.personId) ?? index}
              className="flex items-start gap-3 px-3 py-2"
            >
              <Avatar className="mt-0.5 size-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {name}
                  {str(row.company) ? (
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {str(row.company)}
                    </span>
                  ) : null}
                </div>
                {sessions.length > 0 ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {sessions.join(" · ")}
                  </div>
                ) : null}
                {tasks.length > 0 || missing.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tasks.map((task, taskIndex) => (
                      <Badge
                        key={str(task.taskId) ?? taskIndex}
                        variant="outline"
                        className="h-5 gap-1 border-status-amber-dot/40 bg-status-amber-bg/60 px-1.5 text-[10px] text-status-amber-fg"
                      >
                        {str(task.title) ?? "Task"}
                      </Badge>
                    ))}
                    {missing.map((item) => (
                      <Badge
                        key={item}
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground"
                      >
                        no {item}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </ResultShell>
  )
}

/** `list_events` / `list_workspaces` → one-line-per-row picker-ish list. */
function EventsResult({ data }: { data: Record<string, unknown> }) {
  const rows = asArray(data.events)
  if (!rows || rows.length === 0) return null
  return (
    <ResultShell title="Events" meta={`${rows.length}`}>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map((row, index) => (
          <li
            key={str(row.eventId) ?? index}
            className="flex items-center gap-2 px-3 py-2 text-sm"
          >
            <RiCalendarEventLine
              size={15}
              aria-hidden
              className="shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {str(row.name) ?? "Untitled event"}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDay(row.startsAt) ?? str(row.slug) ?? ""}
            </span>
          </li>
        ))}
      </ul>
    </ResultShell>
  )
}

/** `list_outbox` → who got what, and whether it actually sent. */
function OutboxResult({ data }: { data: Record<string, unknown> }) {
  const rows = asArray(data.messages)
  if (!rows || rows.length === 0) return null
  return (
    <ResultShell title="Outbox" meta={`${rows.length} message(s)`}>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map((row, index) => (
          <li
            key={str(row.messageId) ?? index}
            className="flex items-center gap-2 px-3 py-2 text-sm"
          >
            <RiMailSendLine
              size={15}
              aria-hidden
              className="shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate text-foreground">
              {str(row.subject) ?? "(no subject)"}
              <span className="text-muted-foreground">
                {str(row.to) ? ` → ${str(row.to)}` : ""}
              </span>
            </span>
            <StatusPill status={str(row.status) ?? "scheduled"} size="sm" />
          </li>
        ))}
      </ul>
    </ResultShell>
  )
}

// ——— Entry point ————————————————————————————————————————————————————————

type Renderer = (data: Record<string, unknown>) => ReactNode

const RENDERERS: Record<string, Renderer | undefined> = {
  list_submissions: (data) => <SubmissionsResult data={data} />,
  get_event_summary: (data) => <EventStatsResult data={data} />,
  get_event_overview: (data) => <EventStatsResult data={data} />,
  list_speakers: (data) => <SpeakersResult data={data} />,
  list_events: (data) => <EventsResult data={data} />,
  list_outbox: (data) => <OutboxResult data={data} />,
}

/**
 * The rich view of a tool result, or `null` when we don't have one — the
 * caller (copilot-tool-part.tsx) renders raw JSON in that case.
 */
export function CopilotToolResult({
  toolName,
  output,
}: {
  toolName: string
  output: unknown
}): ReactNode {
  const renderer = RENDERERS[toolName]
  if (!renderer || !isRecord(output)) return null
  try {
    return renderer(output)
  } catch {
    // A malformed payload must never take the conversation down with it.
    return null
  }
}

/** Raw fallback — also used for the "Parameters" disclosure. */
export function CopilotJsonBlock({ value }: { value: unknown }) {
  return (
    <CodeBlock
      code={
        typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2)
      }
      language="json"
    />
  )
}

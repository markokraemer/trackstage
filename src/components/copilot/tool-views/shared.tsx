import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CodeBlock } from "@/components/ai-elements/code-block"
import { CopyButton } from "@/components/interactions"
import { appLink, legacyAppLink, eventRefFromPathname } from "@/lib/app-links"
import type { EventRef, EventSection } from "@/lib/app-links"

/**
 * The vocabulary every copilot tool view is built from.
 *
 * Two rules hold this file together:
 *
 *  1. TOKENS ONLY. The design system is being re-skinned underneath us, so a
 *     hardcoded hex here becomes a wrong colour tomorrow. Everything reaches
 *     for `bg-card` / `border-border` / `text-muted-foreground` / the
 *     `status-*` families — the same surface the rest of the app is painted
 *     with (docs/memory/RULES.md #19).
 *  2. READ DEFENSIVELY. Tool payloads arrive from a live MCP server over a
 *     model's shoulder. Every accessor here narrows `unknown` and returns
 *     null rather than throwing, so a shape that drifts degrades to a smaller
 *     card instead of taking the conversation down (registry.tsx catches what
 *     slips through, but nothing should slip through).
 */

// ——— Reading payloads ————————————————————————————————————————————————————

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Array of objects, or null when the key isn't an array at all. */
export function asArray(value: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(value)) return null
  return value.filter(isRecord)
}

/** Array of non-empty strings — always an array, never null. */
export function strList(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  )
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** `"Ada Lovelace <ada@x.com>"` → `"Ada Lovelace"`. */
export function speakerName(entry: unknown): string {
  const raw = typeof entry === "string" ? entry : ""
  return raw.replace(/\s*<[^>]*>\s*$/, "").trim() || raw
}

function parseDate(iso: unknown): Date | null {
  const value = str(iso)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Sep 14, 2:00 PM" — the default for anything with a time on it. */
export function formatWhen(iso: unknown): string | null {
  const date = parseDate(iso)
  if (!date) return null
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "Sep 14" — dates where the time is noise (event dates, deadlines). */
export function formatDate(iso: unknown): string | null {
  const date = parseDate(iso)
  if (!date) return null
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** "2:00 PM" — inside an agenda row the day is already established. */
export function formatTime(iso: unknown): string | null {
  const date = parseDate(iso)
  if (!date) return null
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "Mon, Sep 14" — the heading of a day group. */
export function formatDayHeading(iso: unknown): string | null {
  const date = parseDate(iso)
  if (!date) return null
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/** Groups anything with a `startsAt` by calendar day, in time order. */
export function groupByDay<T extends { startsAt?: unknown }>(
  rows: Array<T>
): Array<{ key: string; heading: string; rows: Array<T> }> {
  const groups = new Map<string, Array<T>>()
  for (const row of rows) {
    const date = parseDate(row.startsAt)
    const key = date ? date.toISOString().slice(0, 10) : "unscheduled"
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      heading:
        key === "unscheduled"
          ? "No date"
          : (formatDayHeading(`${key}T12:00:00Z`) ?? key),
      rows: list,
    }))
}

/**
 * Deterministic dot colour for a track name, drawn from the status palette.
 * MCP results carry a track's NAME, never the colour the organizer picked, so
 * the alternative is a colourless list — and colour is what makes a track
 * scannable (docs/memory/RULES.md #22: colour carries data).
 */
const TRACK_DOTS = [
  "bg-status-blue-dot",
  "bg-status-green-dot",
  "bg-status-amber-dot",
  "bg-status-red-dot",
  "bg-status-gray-dot",
] as const

export function trackDotClass(track: string): string {
  let hash = 0
  for (let index = 0; index < track.length; index++) {
    hash = (hash * 31 + track.charCodeAt(index)) >>> 0
  }
  return TRACK_DOTS[hash % TRACK_DOTS.length]
}

export function TrackDot({ track }: { track: string }) {
  return (
    <span
      aria-hidden
      data-slot="track-dot"
      className={cn("size-2 shrink-0 rounded-full", trackDotClass(track))}
    />
  )
}

/** Track name with its dot — the compact form used inside table cells. */
export function TrackTag({ track }: { track: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <TrackDot track={track} />
      <span className="truncate">{track}</span>
    </span>
  )
}

// ——— Layout ——————————————————————————————————————————————————————————————

/**
 * Every tool view sits in one of these: a titled block under the collapsed
 * tool frame. Deliberately NOT a `Card` — it already lives inside the chat
 * bubble's surface, and a second raised panel reads as a second app.
 */
export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title?: ReactNode
  meta?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div data-slot="tool-panel" className={cn("space-y-2", className)}>
      {title || meta ? (
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">
            {title}
          </p>
          {meta ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {meta}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** A bordered, hairline-divided list. The workhorse container. */
export function Rows({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ul
      data-slot="tool-rows"
      className={cn(
        "divide-y divide-border overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
    >
      {children}
    </ul>
  )
}

export function Row({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <li className={cn("flex items-start gap-2.5 px-3 py-2.5", className)}>
      {children}
    </li>
  )
}

/** A single bordered block — one form, one session, one task. */
export function Tile({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode
  className?: string
  tone?: "default" | "good" | "warn" | "bad"
}) {
  return (
    <div
      data-slot="tool-tile"
      className={cn(
        "rounded-lg border border-border bg-card p-3",
        tone === "good" && "border-status-green-dot/40 bg-status-green-bg/30",
        tone === "warn" && "border-status-amber-dot/40 bg-status-amber-bg/40",
        tone === "bad" && "border-status-red-dot/40 bg-status-red-bg/40",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Nothing came back. Friendly, and says what to do instead. */
export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** A trailing explanation — the MCP server's `note`, mostly. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

/** Tool error, or a result that carries its own bad news. */
export function ToolAlert({
  title,
  children,
}: {
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <Alert variant="destructive" className="border-destructive/30">
      <RiErrorWarningLine aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  )
}

/** A receipt for something that happened: "12 committed", "form deleted". */
export function Banner({
  icon,
  title,
  children,
  tone = "good",
}: {
  icon?: ReactNode
  title: ReactNode
  children?: ReactNode
  tone?: "good" | "warn" | "neutral" | "bad"
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3",
        tone === "good" && "border-status-green-dot/40 bg-status-green-bg/40",
        tone === "warn" && "border-status-amber-dot/40 bg-status-amber-bg/50",
        tone === "neutral" && "border-border bg-muted/40",
        tone === "bad" && "border-status-red-dot/40 bg-status-red-bg/40"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          tone === "good" && "text-status-green-fg",
          tone === "warn" && "text-status-amber-fg",
          tone === "neutral" && "text-muted-foreground",
          tone === "bad" && "text-status-red-fg"
        )}
      >
        {icon ?? <RiCheckLine size={16} />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children}
      </div>
    </div>
  )
}

// ——— Numbers ——————————————————————————————————————————————————————————————

export type StatTone = "default" | "good" | "warn" | "bad"

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: ReactNode
  value: ReactNode
  tone?: StatTone
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "min-w-[5.5rem] flex-1 rounded-lg border border-border bg-card px-3 py-2",
        tone === "good" && "border-status-green-dot/40 bg-status-green-bg/30",
        tone === "warn" && "border-status-amber-dot/40 bg-status-amber-bg/40",
        tone === "bad" && "border-status-red-dot/40 bg-status-red-bg/40"
      )}
    >
      {/*
        Wraps rather than truncates: six cards in a 460px panel clipped
        "Awaiting slot" to "AWAITING SL…", which is worse than two short lines.
      */}
      <div className="text-[11px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-lg leading-none font-semibold text-foreground tabular-nums">
        {value}
      </div>
    </div>
  )
}

export function StatRow({
  stats,
}: {
  stats: Array<{ label: string; value: ReactNode; tone?: StatTone }>
}) {
  if (stats.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          tone={stat.tone}
        />
      ))}
    </div>
  )
}

/** Thin completion bar — speaker task progress, form completeness. */
export function MiniProgress({
  value,
  tone = "default",
  className,
}: {
  /** 0–100. */
  value: number
  tone?: "default" | "good" | "warn"
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <span
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-all",
          tone === "good" && "bg-status-green-dot",
          tone === "warn" && "bg-status-amber-dot",
          tone === "default" && "bg-primary"
        )}
        style={{ width: `${clamped}%` }}
      />
    </span>
  )
}

// ——— Fields ———————————————————————————————————————————————————————————————

export type FieldEntry = { label: string; value: ReactNode }

/** Label/value pairs. Used by detail cards AND the approval card's arg table. */
export function FieldGrid({
  entries,
  className,
}: {
  entries: Array<FieldEntry>
  className?: string
}) {
  if (entries.length === 0) return null
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs",
        className
      )}
    >
      {entries.map((entry, index) => (
        <div key={`${entry.label}-${index}`} className="contents">
          <dt className="text-muted-foreground">{entry.label}</dt>
          <dd className="min-w-0 font-medium break-words text-foreground">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** `Before → After` — settings diffs, status transitions. */
export function DiffRow({
  label,
  before,
  after,
}: {
  label: ReactNode
  before: ReactNode
  after: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-muted-foreground line-through decoration-muted-foreground/50">
        {before}
      </span>
      <RiArrowRightLine
        size={14}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {after}
      </span>
    </div>
  )
}

export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode
  tone?: "default" | "warn" | "muted"
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[10px] font-medium",
        tone === "warn" &&
          "border-status-amber-dot/40 bg-status-amber-bg/60 text-status-amber-fg",
        tone === "muted" && "text-muted-foreground",
        className
      )}
    >
      {children}
    </Badge>
  )
}

// ——— Links ————————————————————————————————————————————————————————————————

/**
 * A URL as an affordance rather than a fact.
 *
 * Whenever a tool's whole point is "here is a link" — the public CFP URL, a
 * speaker's magic link — the organizer's next move is to paste it somewhere.
 * So the URL is selectable monospace, Copy is one press, and Open is a real
 * anchor to a new tab. Never a bare string in prose.
 */
export function LinkRow({
  url,
  label,
  openLabel = "Open",
  className,
}: {
  url: string
  label?: ReactNode
  openLabel?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
      ) : null}
      {/*
        The URL gets its own line and WRAPS rather than truncating. In a 360px
        panel a one-line layout clips it to "http://local…", which is useless
        for the one thing this component exists to do: let the organizer read
        the link before they paste it somewhere public.
      */}
      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-2">
        <code className="block w-full font-mono text-xs leading-relaxed break-all text-foreground select-all">
          {url}
        </code>
        <div className="flex items-center justify-end gap-2">
          <CopyButton value={url} className="h-8 shrink-0 px-2.5 text-xs" />
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:border-ring focus-visible:outline-none"
          >
            {openLabel}
            <RiExternalLinkLine size={13} aria-hidden />
          </a>
        </div>
      </div>
    </div>
  )
}

/** External link, inline. */
export function OpenLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline",
        className
      )}
    >
      {children}
      <RiExternalLinkLine size={13} aria-hidden />
    </a>
  )
}

export type AppLinkTarget = {
  to: string
  search?: Record<string, string | undefined>
  params?: Record<string, string>
}

/**
 * The event the copilot is scoped to (`copilot-app-context.tsx` feeds it the
 * same one), for every tool view that needs to build an organizer-app link.
 * `undefined` only while the app is still resolving — callers fall back to
 * `legacyAppLink.*`, the bare path that redirects through the stored event
 * pointer (`src/lib/current-event.ts`).
 */
export function useCopilotEventRef(): EventRef | undefined {
  // Deliberately provider-free: tool views render inside the copilot panel
  // and in unit tests, neither of which guarantees a QueryClient. On a
  // canonical `/app/:ws/:event/…` address the URL itself names the event; on
  // a legacy or global page this returns undefined and the links fall back to
  // the bare legacy paths, which redirect through the stored pointer.
  if (typeof window === "undefined") return undefined
  return eventRefFromPathname(window.location.pathname)
}

/**
 * Resolve one event-scoped destination against the event in context —
 * `appLink.section(ref, "agenda")` when resolvable, else the legacy bare path
 * for that same section.
 */
export function useSectionLink(section: EventSection): string {
  const eventRef = useCopilotEventRef()
  return eventRef ? appLink.section(eventRef, section) : legacyAppLink[section]
}

/**
 * Internal navigation, always through TanStack `Link` so the copilot panel
 * stays open and the app doesn't do a full reload — a tool result is a
 * jumping-off point, not a dead end.
 */
export function GoLink({
  to,
  search,
  params,
  children,
  className,
}: AppLinkTarget & { children: ReactNode; className?: string }) {
  return (
    <Link
      // The registry hands us concrete literals from a small closed set; the
      // generic router types can't see that through the shared prop bag.
      to={to as never}
      search={search as never}
      params={params as never}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline",
        className
      )}
    >
      {children}
      <RiArrowRightLine size={13} aria-hidden />
    </Link>
  )
}

/** The footer of a truncated list: "view all 42 in Submissions →". */
export function MoreLink({
  target,
  children,
}: {
  target: AppLinkTarget
  children: ReactNode
}) {
  return (
    <div className="pt-0.5">
      <GoLink {...target}>{children}</GoLink>
    </div>
  )
}

// ——— Raw ——————————————————————————————————————————————————————————————————

/** Syntax-highlighted JSON — the fallback view and the "raw" disclosures. */
export function JsonBlock({ value }: { value: unknown }) {
  return (
    <CodeBlock
      code={
        typeof value === "string"
          ? value
          : JSON.stringify(value ?? null, null, 2)
      }
      language="json"
    />
  )
}

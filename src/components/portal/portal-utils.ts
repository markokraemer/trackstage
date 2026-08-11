import { format, formatDistanceToNowStrict, isPast, isToday } from "date-fns"

import { formatZonedDateRange } from "@/components/settings/timezone"
import type { PortalMe, PortalSubmission, PortalTask } from "./portal-context"

/**
 * Small, dependency-free helpers shared by the portal screens. Kept here so
 * the wording of a due date or a submission code is identical on every tab.
 */

/** Initials for the avatar fallback ("Ava Nakamura" → "AN"). */
export function initialsOf(...parts: Array<string | undefined>): string {
  const letters = parts
    .map((part) => (part ?? "").trim().charAt(0))
    .filter((letter) => letter.length > 0)
  if (letters.length === 0) return "?"
  return letters.slice(0, 2).join("").toUpperCase()
}

export function fullName(me: Pick<PortalMe, "firstName" | "lastName">): string {
  return `${me.firstName} ${me.lastName}`.trim()
}

/**
 * Sessionboard shows every submission as `SESS-4 – Title`. Our submissions are
 * returned newest-first, so the oldest one is SESS-1 and the codes stay stable
 * for a given speaker.
 */
export function submissionCode(index: number, total: number): string {
  return `SESS-${Math.max(total - index, 1)}`
}

/** "Oct 12, 2026" */
export function formatDate(ms: number): string {
  return format(new Date(ms), "MMM d, yyyy")
}

/** "Oct 12, 2026 · 2:30 PM" — local time, for things that happened on this device. */
export function formatDateTime(ms: number): string {
  return format(new Date(ms), "MMM d, yyyy · h:mm a")
}

/**
 * "Oct 12, 2026 · 7:00 PM PDT" — a SCHEDULED time, always in the event's own
 * timezone with the zone spelled out.
 *
 * A speaker reading this on a laptop in Berlin must see the time they are
 * expected on stage in San Francisco, not the same instant translated into
 * their own clock — that is how people miss their slot. The zone abbreviation
 * is what makes it unambiguous, so it is never dropped.
 */
export function formatEventDateTime(ms: number, timezone?: string): string {
  if (!timezone) return formatDateTime(ms)
  try {
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms))
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(ms))
    return `${date} · ${time}`
  } catch {
    // An unknown IANA name should degrade to a readable date, never to a crash.
    return formatDateTime(ms)
  }
}

/** "Oct 12 – 14, 2026" for the event header, in the event's timezone. */
export function formatEventDates(
  startsAt?: number,
  endsAt?: number,
  timezone?: string,
): string | null {
  if (!startsAt) return null
  if (timezone) {
    const zoned = formatZonedDateRange(startsAt, endsAt, timezone)
    if (zoned) return zoned
  }
  const start = new Date(startsAt)
  if (!endsAt) return format(start, "MMM d, yyyy")
  const end = new Date(endsAt)
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`
}

export interface DueInfo {
  label: string
  tone: "overdue" | "soon" | "normal"
}

/** Plain-English due date: "Due today", "Overdue by 2 days", "Due Oct 12". */
export function dueInfo(dueAt?: number): DueInfo | null {
  if (!dueAt) return null
  const date = new Date(dueAt)
  if (isToday(date)) return { label: "Due today", tone: "soon" }
  if (isPast(date)) {
    return {
      label: `Overdue by ${formatDistanceToNowStrict(date)}`,
      tone: "overdue",
    }
  }
  const days = (dueAt - Date.now()) / 86_400_000
  return {
    label: `Due ${format(date, "MMM d")}`,
    tone: days <= 7 ? "soon" : "normal",
  }
}

/** `workshopDuration` → "Workshop duration". Used for form answers. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export interface CompletenessItem {
  key: "bio" | "headshot" | "links" | "details"
  label: string
  done: boolean
}

export interface Completeness {
  items: Array<CompletenessItem>
  done: number
  total: number
  percent: number
}

/** Drives the "My Profile" meter on Home and the profile page banner. */
export function profileCompleteness(me: PortalMe): Completeness {
  const links = me.links ?? {}
  const items: Array<CompletenessItem> = [
    {
      key: "bio",
      label: "Biography",
      done: Boolean(me.bio && me.bio.trim().length > 0),
    },
    { key: "headshot", label: "Headshot", done: Boolean(me.headshotUrl) },
    {
      key: "details",
      label: "Job title & company",
      done: Boolean(me.jobTitle && me.company),
    },
    {
      key: "links",
      label: "A link",
      done: Boolean(links.linkedin || links.twitter || links.website),
    },
  ]
  const done = items.filter((item) => item.done).length
  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
  }
}

/** Speakers may withdraw anything that is not already decided or gone. */
export function canWithdraw(submission: PortalSubmission): boolean {
  return !["accepted", "declined", "withdrawn"].includes(submission.status)
}

/**
 * Whether this speaker may still change this submission. The server decides —
 * `editLock` is `null` when editing is open, and otherwise carries the exact
 * sentence `portal.updateSubmission` would refuse with (decided status, the
 * organizer's portal switch, or the CFP's close date). Never re-derive the
 * rules here: the whole point is that the screen and the save agree.
 */
export function canEdit(submission: PortalSubmission): boolean {
  return submission.editLock === null
}

export function isOpen(task: PortalTask): boolean {
  return !task.completedAt
}

/** Human sentence for a task kind, shown under the title when useful. */
export const TASK_KIND_LABEL: Record<string, string> = {
  headshot: "Photo upload",
  upload: "File upload",
  confirm: "Confirmation",
  profile: "Profile details",
  // "Collect an answer": a question from the organizer, answered in a text
  // box. `form` is the dead kind it replaced — the server already reads those
  // rows as `answer`, and the label agrees so nothing reads as two things.
  answer: "Written answer",
  form: "Written answer",
}

// File helpers deliberately DO NOT live here: `formatBytes`, type labels and
// icons are in `src/lib/files.ts`, and the approval wording is
// `approvalMeta` in `src/components/shared/file-row.tsx` — organizers and
// speakers must read the same sentence about the same file.

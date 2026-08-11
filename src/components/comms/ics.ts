import { buildIcs } from "@convex/lib/ics"
import type { BuildIcsArgs } from "@convex/lib/ics"

/**
 * Client-side calendar invites for the outbox.
 *
 * The delivery pipeline attaches the `.ics` to the outgoing email
 * (`convex/comms.ts` → `deliverPending`), but there is no query that hands the
 * attachment back to the browser. So the drawer rebuilds the invite from the
 * scheduled-session data using the *same* pure generator the server uses —
 * identical bytes, no duplicated RFC 5545 logic.
 */

export type IcsSession = {
  submissionId: string
  title: string
  description?: string
  startsAt: number
  durationMinutes: number
  roomName?: string
  venue?: string
  timezone?: string
  eventName?: string
  attendeeEmail?: string
}

/** `LOCATION` — room first, venue after, omitted entirely when unknown. */
function locationOf(session: IcsSession): string | undefined {
  const parts = [session.roomName, session.venue].filter(Boolean)
  return parts.length ? parts.join(" · ") : undefined
}

export function icsForSession(session: IcsSession): string {
  const args: BuildIcsArgs = {
    uid: `${session.submissionId}@sessionboard`,
    title: session.title,
    description: session.description,
    startsAt: session.startsAt,
    durationMinutes: session.durationMinutes,
    timezone: session.timezone,
    location: locationOf(session),
    attendeeEmail: session.attendeeEmail,
    eventName: session.eventName,
  }
  return buildIcs(args)
}

export function icsFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${slug || "session"}.ics`
}

/** Trigger a browser download for the generated calendar file. */
export function downloadIcs(filename: string, contents: string): void {
  const blob = new Blob([contents], {
    type: "text/calendar;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give Safari a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

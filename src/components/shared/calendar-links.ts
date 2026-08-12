/**
 * "Add to calendar" — the browser side.
 *
 * No third-party service sits between a speaker and their calendar. The
 * provider deep links come from `convex/lib/calendarLinks.ts` and the `.ics`
 * bytes from `convex/lib/ics.ts`, both pure modules shared with the server — so
 * the link in an email, the link in the app and the attached file always
 * describe the same session at the same instant. What lives here is the browser
 * half: the item shape the UI passes around, and the download itself.
 *
 * Sessions are stored as epoch milliseconds, which is an absolute instant with
 * no zone attached, and every provider URL takes UTC. There is no zone
 * arithmetic anywhere in this path. The event's IANA timezone is used for
 * display only (the toast, and `X-WR-TIMEZONE` as a hint to importers).
 */

import { buildIcsCalendar } from "@convex/lib/ics"
import {
  calendarEnd,
  googleCalendarUrl as googleUrl,
  googleFeedUrl as googleFeed,
  outlookFeedUrl as outlookFeed,
  outlookLiveUrl as outlookLive,
  outlookOfficeUrl as outlookOffice,
} from "@convex/lib/calendarLinks"
import type { CalendarLinkEvent, OutlookHost } from "@convex/lib/calendarLinks"

/** One dated thing a person can put in their calendar. */
export interface CalendarItem extends CalendarLinkEvent {
  /** Stable across re-imports so an update replaces rather than duplicates. */
  uid: string
}

export const endOf = calendarEnd
export const googleCalendarUrl = googleUrl
export const outlookLiveUrl = outlookLive
export const outlookOfficeUrl = outlookOffice
export const googleFeedUrl = googleFeed

export function outlookFeedUrl(
  host: OutlookHost,
  feedUrl: string,
  name: string,
): string {
  return outlookFeed(host, feedUrl, name)
}

/** `webcal://…` — the scheme every desktop calendar treats as "subscribe". */
export function webcalOf(feedUrl: string | null | undefined): string | null {
  if (!feedUrl) return null
  return feedUrl.replace(/^https?:/, "webcal:")
}

/**
 * A `.ics` document for one or more items — Apple Calendar and everything else.
 *
 * Delegates to the shared server writer so folding is octet-correct (RFC 5545
 * §3.1) even for non-ASCII titles, which a naive length-based fold gets wrong.
 */
export function buildIcsFor(
  items: Array<CalendarItem>,
  calendar: { name?: string; timezone?: string } = {},
): string {
  return buildIcsCalendar(
    items.map((item) => ({
      uid: item.uid,
      title: item.title,
      description: [item.description?.trim(), item.url?.trim()]
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
      startsAt: item.startsAt,
      durationMinutes: Math.max(
        1,
        Math.round((calendarEnd(item) - item.startsAt) / 60_000),
      ),
      location: item.location,
    })),
    calendar,
  )
}

/** "keynote-opening-remarks" — safe, readable download filenames. */
export function calendarFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || "calendar"
}

/** Trigger a browser download of an `.ics` file. */
export function downloadIcsFile(filename: string, contents: string): void {
  if (typeof document === "undefined") return
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give Safari a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

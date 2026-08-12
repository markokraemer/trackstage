/**
 * The public event's live calendar feed.
 *
 * Generating the actual `.ics` bytes lives in one place only —
 * `convex/lib/ics.ts`, shared by the server (email invites, the public feed)
 * and the browser (`components/shared/calendar-links.ts`). What remains here is
 * the address of the *subscribe-able* feed, which is a public-pages concern.
 */

/**
 * The event's live calendar feed — the same public endpoint the Embeds
 * settings screen hands organizers (`convex/apiHttp.ts`,
 * `/v1/event/{slug}/schedule.ics`).
 * Unlike a downloaded file this one keeps updating: a visitor who subscribes
 * sees room and time changes without doing anything.
 */
import { apiBaseUrl } from "@/lib/deployment-urls"

export function icsFeedUrl(slug: string): string | null {
  if (!slug) return null
  return `${apiBaseUrl()}/v1/event/${slug}/schedule.ics`
}

/** `webcal://` form — one click subscribes in Apple/Outlook/Google Calendar. */
export function webcalFeedUrl(slug: string): string | null {
  const url = icsFeedUrl(slug)
  return url ? url.replace(/^https?:/, "webcal:") : null
}

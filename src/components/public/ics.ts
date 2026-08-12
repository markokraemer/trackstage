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
export function icsFeedUrl(slug: string): string | null {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (!convexUrl || !slug) return null
  return `${convexUrl.replace(".convex.cloud", ".convex.site")}/v1/event/${slug}/schedule.ics`
}

/** `webcal://` form — one click subscribes in Apple/Outlook/Google Calendar. */
export function webcalFeedUrl(slug: string): string | null {
  const url = icsFeedUrl(slug)
  return url ? url.replace(/^https?:/, "webcal:") : null
}

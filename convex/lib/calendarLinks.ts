// Provider "add to calendar" deep links.
//
// Google and Outlook both accept a fully prefilled compose URL, so a person can
// go from "here is your session" to a saved calendar entry in one click without
// any third-party service in between. The same builders are used on both sides
// of the wire: the browser menu (`src/components/shared/calendar-links.ts`) and
// the quick-links printed inside outgoing emails (`lib/email.ts`), so a link in
// an inbox and a link in the app can never describe different times.
//
// Times are epoch milliseconds — an absolute instant — and both URL schemes
// take UTC, so the conversion is `toISOString()` and nothing else. There is no
// zone arithmetic here to get wrong. The event's IANA timezone is used only to
// *say* when the session is, in words.
//
// This module is pure (no Convex imports) so it can be used from queries,
// mutations, actions, HTTP endpoints and the client bundle alike.

export type CalendarLinkEvent = {
  title: string
  /** Epoch milliseconds. */
  startsAt: number
  /** Epoch milliseconds. Defaults to one hour after the start. */
  endsAt?: number
  description?: string
  /** Room, venue, or both. */
  location?: string
  /** A link back to the session, appended to the description. */
  url?: string
}

const DEFAULT_DURATION_MS = 60 * 60_000

export function calendarEnd(event: CalendarLinkEvent): number {
  if (event.endsAt !== undefined && event.endsAt > event.startsAt) {
    return event.endsAt
  }
  return event.startsAt + DEFAULT_DURATION_MS
}

/** `20261012T160000Z` — the compact UTC form Google's `dates` param wants. */
export function toCompactUtc(epochMs: number): string {
  return new Date(epochMs)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

/** `2026-10-12T16:00:00Z` — the extended UTC form Outlook's compose URL wants. */
export function toIsoUtc(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/\.\d{3}/, "")
}

function detailsOf(event: CalendarLinkEvent): string | undefined {
  const parts = [event.description?.trim(), event.url?.trim()].filter(
    (part): part is string => Boolean(part),
  )
  return parts.length > 0 ? parts.join("\n\n") : undefined
}

function withParams(
  base: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value)
  }
  return url.toString()
}

/** Google Calendar's prefilled "TEMPLATE" compose screen. */
export function googleCalendarUrl(event: CalendarLinkEvent): string {
  return withParams("https://calendar.google.com/calendar/render", {
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCompactUtc(event.startsAt)}/${toCompactUtc(calendarEnd(event))}`,
    details: detailsOf(event),
    location: event.location,
  })
}

/**
 * Outlook is the same query string on two hosts: personal accounts live on
 * `outlook.live.com`, work/school (Microsoft 365) accounts on
 * `outlook.office.com`. Sending a work account to the consumer host lands on a
 * sign-in wall, so both are offered rather than guessed at.
 */
export type OutlookHost = "outlook.live.com" | "outlook.office.com"

export function outlookCalendarUrl(
  host: OutlookHost,
  event: CalendarLinkEvent,
): string {
  return withParams(`https://${host}/calendar/0/action/compose`, {
    rru: "addevent",
    path: "/calendar/action/compose",
    subject: event.title,
    startdt: toIsoUtc(event.startsAt),
    enddt: toIsoUtc(calendarEnd(event)),
    body: detailsOf(event),
    location: event.location,
    allday: "false",
  })
}

/** Outlook.com / Hotmail / personal Microsoft accounts. */
export function outlookLiveUrl(event: CalendarLinkEvent): string {
  return outlookCalendarUrl("outlook.live.com", event)
}

/** Outlook on a work or school (Microsoft 365) account. */
export function outlookOfficeUrl(event: CalendarLinkEvent): string {
  return outlookCalendarUrl("outlook.office.com", event)
}

/**
 * Subscribing (as opposed to importing) is one click on both providers too:
 * Google takes the feed on `?cid=`, Outlook on its `addfromweb` screen. A
 * subscribed calendar keeps updating, so a room change reaches the attendee
 * without anyone re-sending anything.
 */
export function googleFeedUrl(webcalUrl: string): string {
  return withParams("https://calendar.google.com/calendar/r", {
    cid: webcalUrl,
  })
}

export function outlookFeedUrl(
  host: OutlookHost,
  feedUrl: string,
  name: string,
): string {
  return withParams(`https://${host}/calendar/0/addfromweb`, {
    url: feedUrl,
    name,
  })
}

import { describe, expect, it } from "vitest"

import {
  calendarEnd,
  googleCalendarUrl,
  googleFeedUrl,
  outlookFeedUrl,
  outlookLiveUrl,
  outlookOfficeUrl,
  toCompactUtc,
  toIsoUtc,
} from "../../convex/lib/calendarLinks"
import { renderBrandedEmail } from "../../convex/lib/email"

/**
 * The whole point of these links is that a person clicks one and their calendar
 * shows the session at the right moment. Sessions are epoch milliseconds and
 * both providers take UTC, so what has to hold is: the instant survives the
 * round trip, and organizer/speaker text survives encoding.
 */

// 12 Oct 2026, 16:00 UTC — 09:00 in Los Angeles, 18:00 in Berlin.
const START = Date.UTC(2026, 9, 12, 16, 0, 0)

const SESSION = {
  title: "Opening Keynote: AI & the Future",
  startsAt: START,
  endsAt: START + 45 * 60_000,
  location: "Main Stage · Moscone West",
  description: "A talk about things",
  url: "https://trackstage.app/e/ai/summit/sessions/abc",
}

describe("calendar deep links", () => {
  it("stamps UTC in both providers' formats", () => {
    expect(toCompactUtc(START)).toBe("20261012T160000Z")
    expect(toIsoUtc(START)).toBe("2026-10-12T16:00:00Z")
  })

  it("defaults to an hour when a session has no end", () => {
    expect(calendarEnd({ title: "x", startsAt: START })).toBe(
      START + 60 * 60_000,
    )
    // A nonsense end (at or before the start) falls back rather than emitting
    // a negative-length event, which Google silently drops.
    expect(
      calendarEnd({ title: "x", startsAt: START, endsAt: START - 1000 }),
    ).toBe(START + 60 * 60_000)
  })

  it("builds a Google TEMPLATE url carrying the exact instant", () => {
    const url = new URL(googleCalendarUrl(SESSION))
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render",
    )
    expect(url.searchParams.get("action")).toBe("TEMPLATE")
    expect(url.searchParams.get("text")).toBe(SESSION.title)
    expect(url.searchParams.get("dates")).toBe(
      "20261012T160000Z/20261012T164500Z",
    )
    expect(url.searchParams.get("location")).toBe(SESSION.location)
    // The link back to the session rides along in the details.
    expect(url.searchParams.get("details")).toContain(SESSION.url)
  })

  it("builds both Outlook hosts off one query string", () => {
    const live = new URL(outlookLiveUrl(SESSION))
    const office = new URL(outlookOfficeUrl(SESSION))
    expect(live.host).toBe("outlook.live.com")
    expect(office.host).toBe("outlook.office.com")
    expect(live.pathname).toBe("/calendar/0/action/compose")
    for (const url of [live, office]) {
      expect(url.searchParams.get("rru")).toBe("addevent")
      expect(url.searchParams.get("subject")).toBe(SESSION.title)
      expect(url.searchParams.get("startdt")).toBe("2026-10-12T16:00:00Z")
      expect(url.searchParams.get("enddt")).toBe("2026-10-12T16:45:00Z")
      expect(url.searchParams.get("allday")).toBe("false")
    }
    expect(live.search).toBe(office.search)
  })

  it("percent-encodes titles that would otherwise break the query string", () => {
    const nasty = {
      title: "Q&A: what's #next? 100% real — 日本語",
      startsAt: START,
    }
    const google = googleCalendarUrl(nasty)
    // Nothing raw leaks into the URL…
    expect(google).not.toContain("#next")
    expect(google).not.toContain(" ")
    // …but it decodes back to exactly what was typed.
    expect(new URL(google).searchParams.get("text")).toBe(nasty.title)
    expect(new URL(outlookLiveUrl(nasty)).searchParams.get("subject")).toBe(
      nasty.title,
    )
  })

  it("omits empty optional parameters instead of sending blanks", () => {
    const bare = googleCalendarUrl({ title: "Bare", startsAt: START })
    const url = new URL(bare)
    expect(url.searchParams.has("location")).toBe(false)
    expect(url.searchParams.has("details")).toBe(false)
  })

  it("builds one-click subscribe links for a live feed", () => {
    const feed = "https://example.convex.site/v1/event/summit/schedule.ics"
    const webcal = feed.replace(/^https?:/, "webcal:")

    const google = new URL(googleFeedUrl(webcal))
    expect(google.origin + google.pathname).toBe(
      "https://calendar.google.com/calendar/r",
    )
    expect(google.searchParams.get("cid")).toBe(webcal)

    const outlook = new URL(
      outlookFeedUrl("outlook.office.com", feed, "AI Summit"),
    )
    expect(outlook.pathname).toBe("/calendar/0/addfromweb")
    expect(outlook.searchParams.get("url")).toBe(feed)
    expect(outlook.searchParams.get("name")).toBe("AI Summit")
  })
})

describe("the add-to-calendar row in emails", () => {
  const branded = (calendar: Parameters<typeof renderBrandedEmail>[0]["calendar"]) =>
    renderBrandedEmail({
      subject: "You're on the program",
      body: "Congratulations — you're speaking.",
      isHtml: false,
      eventName: "AI Summit",
      calendar,
    })

  it("prints all three provider links when a session is scheduled", () => {
    const html = branded({
      title: "Opening Keynote",
      startsAt: START,
      durationMinutes: 45,
      location: "Main Stage",
      timezone: "America/Los_Angeles",
      eventName: "AI Summit",
    })
    expect(html).toContain("calendar.google.com/calendar/render")
    expect(html).toContain("outlook.live.com/calendar/0/action/compose")
    expect(html).toContain("outlook.office.com/calendar/0/action/compose")
    // Said in the venue's hours, not the server's: 16:00Z is 09:00 in LA.
    expect(html).toContain("09:00 AM")
    expect(html).toContain("Monday, October 12")
    expect(html).toContain("Main Stage")
  })

  it("adds nothing at all when there is no scheduled session", () => {
    const html = branded(null)
    expect(html).not.toContain("calendar.google.com")
    expect(html).not.toContain("Add it to your calendar")
  })

  it("escapes speaker- and organizer-supplied text in the row", () => {
    const html = branded({
      title: '<script>alert("x")</script> & "friends"',
      startsAt: START,
      durationMinutes: 30,
      location: "<b>Room 1</b>",
      timezone: "UTC",
    })
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<b>Room 1</b>")
    expect(html).toContain("&lt;b&gt;Room 1&lt;/b&gt;")
    // The href is escaped too — and the raw title never reaches it unencoded.
    expect(html).not.toContain('href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=<')
  })
})

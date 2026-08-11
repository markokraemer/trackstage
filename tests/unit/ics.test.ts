import { describe, expect, it } from "vitest"
import { buildIcs, buildIcsCalendar } from "../../convex/lib/ics"
import { icsFold } from "../../convex/lib/apiIcs"

describe("ics generation", () => {
  const base = {
    uid: "test-1@sessionboard",
    title: "Opening Keynote; The Future, of AI",
    startsAt: Date.UTC(2026, 9, 12, 16, 0, 0),
    durationMinutes: 45,
    location: "Main Stage",
    eventName: "AI Engineer Summit 2026",
  }

  it("produces a structurally valid VCALENDAR", () => {
    const ics = buildIcs(base)
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true)
    expect(ics).toContain("BEGIN:VEVENT")
    expect(ics).toContain("END:VEVENT")
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
  })

  it("uses CRLF exclusively", () => {
    const ics = buildIcs(base)
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false)
  })

  it("escapes commas and semicolons in text fields", () => {
    const ics = buildIcs(base)
    expect(ics).toContain("Keynote\\;")
    expect(ics).toContain("\\, of AI")
  })

  it("emits UTC DTSTART/DTEND covering the duration", () => {
    const ics = buildIcs(base)
    expect(ics).toContain("DTSTART:20261012T160000Z")
    expect(ics).toContain("DTEND:20261012T164500Z")
  })

  it("includes LOCATION only when provided", () => {
    expect(buildIcs(base)).toContain("LOCATION:Main Stage")
    expect(buildIcs({ ...base, location: undefined })).not.toContain("LOCATION")
  })

  it("folds long lines at 75 octets without splitting sequences", () => {
    const ics = buildIcs({
      ...base,
      description: "Ü".repeat(200),
    })
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75)
    }
  })

  it("multi-event calendar contains one VEVENT per session", () => {
    const calendar = buildIcsCalendar(
      [base, { ...base, uid: "test-2@sessionboard", title: "Second Talk" }],
      { name: "AI Engineer Summit 2026" },
    )
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})

/**
 * The public calendar feed (`GET /v1/event/{slug}/schedule.ics`) folds through
 * `icsFold`. It used to slice by UTF-16 code units, so a line carrying an em
 * dash came out at 76 octets and an emoji could be cut through its surrogate
 * pair. Both are regressions a subscribed calendar would have to live with.
 */
describe("icsFold — octets, not characters", () => {
  const octets = (s: string) => new TextEncoder().encode(s).length

  it("keeps every folded line within 75 octets when the text has em dashes", () => {
    const line =
      "DESCRIPTION:Speakers: Priya Raghavan\\n\\nTrack: AI Engineering\\n\\nA look at what changed in the last twelve months — from demos to systems\\, from prompts to products — and what the discipline needs to figure out next."
    for (const folded of icsFold(line).split("\r\n")) {
      expect(octets(folded)).toBeLessThanOrEqual(75)
    }
  })

  it("never splits a surrogate pair, even when the fold lands mid-character", () => {
    // 8 + 65 = 73 characters of ASCII, so a naive 74-code-unit slice cuts the
    // first emoji in half and emits a lone surrogate — which becomes U+FFFD
    // the moment the feed is encoded as UTF-8.
    const line = `SUMMARY:${"a".repeat(65)}${"🎤".repeat(10)}`
    const folded = icsFold(line)
    expect(/[\uD800-\uDBFF]$/.test(folded.split("\r\n")[0])).toBe(false)
    expect(Buffer.from(folded, "utf8").toString("utf8")).not.toContain("\uFFFD")
    const rejoined = folded
      .split("\r\n")
      .map((part, index) => (index === 0 ? part : part.slice(1)))
      .join("")
    expect(rejoined).toBe(line)
  })

  it("leaves a short line alone", () => {
    expect(icsFold("SUMMARY:Opening keynote")).toBe("SUMMARY:Opening keynote")
  })

  it("round-trips: unfolding restores the original", () => {
    const line = `DESCRIPTION:${"a — b, ".repeat(30)}`
    const unfolded = icsFold(line).replace(/\r\n /g, "")
    expect(unfolded).toBe(line)
  })
})

import { describe, expect, it } from "vitest"
import { buildIcs, buildIcsCalendar } from "../../convex/lib/ics"

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

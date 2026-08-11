import { describe, expect, it } from "vitest"
import { ConvexError } from "convex/values"
import {
  AirtableError,
  humanAirtableError,
  normalizeBaseId,
  normalizeCredentials,
  normalizeToken,
} from "../../convex/lib/airtable"
import { errorMessage } from "../../src/lib/errors"
import {
  INBOUND_REASON_TEXT,
  INBOUND_STATUSES,
  emptySummary,
  modifiedSinceFormula,
  parseStatusLabel,
  shouldApplyInbound,
  tally,
} from "../../convex/lib/airtableInbound"

// The experimental two-way Airtable sync (HISTORY.md 61) lives or dies on these
// comparisons: get them wrong and you either get an echo loop (our own write
// bouncing back forever) or a lost organizer decision. They are pure on purpose
// so every branch can be pinned here rather than discovered in production.

describe("parseStatusLabel", () => {
  it("accepts the exact labels our own mirror writes", () => {
    expect(parseStatusLabel("Pending")).toBe("pending")
    expect(parseStatusLabel("Accept queue")).toBe("accept_queue")
    expect(parseStatusLabel("Decline queue")).toBe("decline_queue")
    expect(parseStatusLabel("Accepted")).toBe("accepted")
    expect(parseStatusLabel("Declined")).toBe("declined")
    expect(parseStatusLabel("Withdrawn")).toBe("withdrawn")
    expect(parseStatusLabel("Draft")).toBe("draft")
  })

  it("is case-, space- and separator-insensitive (humans retype cells)", () => {
    for (const variant of [
      "accept queue",
      "ACCEPT QUEUE",
      "Accept_Queue",
      "  accept-queue  ",
    ]) {
      expect(parseStatusLabel(variant)).toBe("accept_queue")
    }
  })

  it("maps the obvious synonyms an organizer might type", () => {
    expect(parseStatusLabel("Accept")).toBe("accepted")
    expect(parseStatusLabel("Rejected")).toBe("declined")
  })

  it("returns null for anything it does not recognise", () => {
    expect(parseStatusLabel("Maybe?")).toBeNull()
    expect(parseStatusLabel("")).toBeNull()
    expect(parseStatusLabel("   ")).toBeNull()
    expect(parseStatusLabel(undefined)).toBeNull()
    expect(parseStatusLabel(null)).toBeNull()
    expect(parseStatusLabel(42)).toBeNull()
  })
})

describe("shouldApplyInbound", () => {
  it("applies a genuine Airtable triage decision", () => {
    const decision = shouldApplyInbound({
      airtableValue: "Accept queue",
      currentStatus: "pending",
      lastPushedStatus: "pending",
    })
    expect(decision).toEqual({
      apply: true,
      status: "accept_queue",
      reason: "apply",
    })
  })

  it("ignores our OWN write coming back (the echo loop guard)", () => {
    // We pushed "accepted" last sync; Airtable is simply reflecting it while
    // our row has since been moved on by an organizer.
    const decision = shouldApplyInbound({
      airtableValue: "Accepted",
      currentStatus: "declined",
      lastPushedStatus: "accepted",
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("echo")
  })

  it("does nothing when both sides already agree", () => {
    const decision = shouldApplyInbound({
      airtableValue: "Accepted",
      currentStatus: "accepted",
      lastPushedStatus: "pending",
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("unchanged")
  })

  it("lets OUR database win when both sides moved (conflict)", () => {
    // Mirror said "pending"; the organizer accepted it in Trackstage AND
    // someone declined it in Airtable. Trackstage is the source of truth.
    const decision = shouldApplyInbound({
      airtableValue: "Declined",
      currentStatus: "accepted",
      lastPushedStatus: "pending",
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("conflict")
    expect(decision).toHaveProperty("airtableStatus", "declined")
  })

  it("refuses to act on a row it has never mirrored", () => {
    const decision = shouldApplyInbound({
      airtableValue: "Accepted",
      currentStatus: "pending",
      lastPushedStatus: null,
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("no_baseline")

    expect(
      shouldApplyInbound({
        airtableValue: "Accepted",
        currentStatus: "pending",
      }).reason
    ).toBe("no_baseline")
  })

  it("never lets Airtable set draft or withdrawn", () => {
    for (const value of ["Draft", "Withdrawn"]) {
      const decision = shouldApplyInbound({
        airtableValue: value,
        currentStatus: "pending",
        lastPushedStatus: "pending",
      })
      expect(decision.apply).toBe(false)
      expect(decision.reason).toBe("not_allowed")
    }
    expect(INBOUND_STATUSES).not.toContain("draft" as never)
    expect(INBOUND_STATUSES).not.toContain("withdrawn" as never)
  })

  it("rejects an unrecognised cell before any state reasoning", () => {
    const decision = shouldApplyInbound({
      airtableValue: "Shortlisted",
      currentStatus: "accepted",
      lastPushedStatus: "pending", // would otherwise read as a conflict
    })
    expect(decision.reason).toBe("unknown_status")
  })

  it("applies every allowed target status", () => {
    for (const target of INBOUND_STATUSES) {
      const from = target === "pending" ? "accepted" : "pending"
      const decision = shouldApplyInbound({
        airtableValue: target,
        currentStatus: from,
        lastPushedStatus: from,
      })
      expect(decision.apply).toBe(true)
      expect(decision.status).toBe(target)
    }
  })

  it("settles after an applied change instead of looping", () => {
    // Round 1: Airtable moved it, we apply and move the baseline with it.
    const first = shouldApplyInbound({
      airtableValue: "Declined",
      currentStatus: "pending",
      lastPushedStatus: "pending",
    })
    expect(first.apply).toBe(true)
    // Round 2 (same record, next pull): identical cell, now identical state.
    const second = shouldApplyInbound({
      airtableValue: "Declined",
      currentStatus: "declined",
      lastPushedStatus: "declined",
    })
    expect(second.apply).toBe(false)
    expect(second.reason).toBe("unchanged")
  })

  it("has reader-facing wording for every outcome", () => {
    for (const reason of [
      "apply",
      "unknown_status",
      "not_allowed",
      "unchanged",
      "no_baseline",
      "echo",
      "conflict",
    ] as const) {
      expect(INBOUND_REASON_TEXT[reason]).toBeTruthy()
    }
  })
})

describe("tally", () => {
  it("counts applies, skips, and conflicts as both", () => {
    let summary = emptySummary()
    summary = tally(summary, "apply")
    summary = tally(summary, "echo")
    summary = tally(summary, "conflict")
    expect(summary).toEqual({ applied: 1, skipped: 2, conflicts: 1 })
  })
})

describe("modifiedSinceFormula", () => {
  it("is undefined before the first sync (read everything once)", () => {
    expect(modifiedSinceFormula(null)).toBeUndefined()
    expect(modifiedSinceFormula(undefined)).toBeUndefined()
    expect(modifiedSinceFormula(Number.NaN)).toBeUndefined()
  })

  it("asks Airtable for records touched since our cursor, minus clock slack", () => {
    const at = Date.UTC(2026, 7, 11, 12, 0, 0)
    const formula = modifiedSinceFormula(at)
    expect(formula).toContain("LAST_MODIFIED_TIME()")
    expect(formula).toContain("IS_AFTER")
    // 60s of slack: two clocks are never the same clock, and re-reading an
    // unchanged record is free (the guard turns it into "unchanged").
    expect(formula).toContain(new Date(at - 60_000).toISOString())
  })

  it("never produces a negative instant", () => {
    expect(modifiedSinceFormula(0)).toContain(new Date(0).toISOString())
  })
})

// ——— Forgiving input + plain-English errors ————————————————————————————
// Both of these are regressions from a real production failure (BUILD-LOG,
// 2026-08-11): Marko pasted "appcLLu7HlngMfKLW/tblZhfJ2nbaQmVVvC" — the base
// id and table id together, exactly as Airtable's address bar shows them — and
// got back "[CONVEX A(airtable:connect)] [Request ID: …] Server Error".

describe("normalizeBaseId", () => {
  it("takes the base id straight out of whatever a human pasted", () => {
    const id = "appcLLu7HlngMfKLW"
    expect(normalizeBaseId(id)).toBe(id)
    // THE production paste: base id + table id, address-bar style.
    expect(normalizeBaseId(`${id}/tblZhfJ2nbaQmVVvC`)).toBe(id)
    expect(normalizeBaseId(`https://airtable.com/${id}/tblAbc/viwXyz`)).toBe(id)
    expect(
      normalizeBaseId(`https://airtable.com/${id}/tblAbc?blocks=hide`)
    ).toBe(id)
    expect(normalizeBaseId(`  ${id}\n`)).toBe(id)
    expect(
      normalizeBaseId(`https://api.airtable.com/v0/${id}/Submissions`)
    ).toBe(id)
  })

  it("returns null rather than guessing when there is no id in there", () => {
    expect(normalizeBaseId("my airtable thing")).toBeNull()
    expect(normalizeBaseId("")).toBeNull()
    expect(normalizeBaseId(null)).toBeNull()
    expect(normalizeBaseId("tblZhfJ2nbaQmVVvC")).toBeNull()
  })
})

describe("normalizeToken", () => {
  it("repairs a clipboard rather than bouncing it back", () => {
    expect(normalizeToken("  patABC.def  ")).toBe("patABC.def")
    expect(normalizeToken("patABC.\ndef")).toBe("patABC.def")
    expect(normalizeToken("Bearer patABC.def")).toBe("patABC.def")
  })
})

describe("normalizeCredentials", () => {
  it("hands back the cleaned pair", () => {
    expect(
      normalizeCredentials(
        " patABC.def ",
        "https://airtable.com/appcLLu7HlngMfKLW/tblX"
      )
    ).toEqual({ token: "patABC.def", baseId: "appcLLu7HlngMfKLW" })
  })

  it("explains, in one sentence, what to do instead", () => {
    expect(() =>
      normalizeCredentials("keyOLDSTYLE", "appcLLu7HlngMfKLW")
    ).toThrow(/personal access tokens start with/i)
    expect(() => normalizeCredentials("patABC.def", "nonsense")).toThrow(
      /couldn't find a base ID/i
    )
  })

  it("throws ConvexError, the only kind whose message survives production", () => {
    // An ordinary Error here reaches the organizer as "Server Error" — that is
    // precisely the bug this file guards.
    try {
      normalizeCredentials("", "appcLLu7HlngMfKLW")
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError)
      expect(typeof (error as ConvexError<string>).data).toBe("string")
    }
  })
})

describe("humanAirtableError", () => {
  it("keeps our own sentence", () => {
    expect(
      humanAirtableError(new AirtableError("Airtable said no.", 403))
    ).toBe("Airtable said no.")
  })

  it("turns a network failure into something actionable", () => {
    expect(humanAirtableError(new TypeError("fetch failed"))).toMatch(
      /couldn't reach airtable/i
    )
  })

  it("never hands back a bare stack", () => {
    const message = humanAirtableError(new Error("boom\n  at somewhere"))
    expect(message).not.toContain("  at ")
  })
})

describe("errorMessage (what the Integrations card renders)", () => {
  it("prefers the ConvexError payload over Convex's decorated message", () => {
    const error = new ConvexError("The token can't see this base.")
    // Convex rewrites `.message` on the way to the client; `.data` survives.
    error.message =
      "[CONVEX A(airtable:connect)] [Request ID: abc123] Server Error"
    expect(errorMessage(error, "fallback")).toBe(
      "The token can't see this base."
    )
  })

  it("falls back rather than showing Convex's redaction placeholder", () => {
    const error = new Error(
      "[CONVEX A(airtable:connect)] [Request ID: abc123] Server Error"
    )
    expect(errorMessage(error, "Couldn't connect to Airtable.")).toBe(
      "Couldn't connect to Airtable."
    )
  })

  it("still reads a dev deployment's uncaught message", () => {
    const error = new Error(
      "[Request ID: abc] Server Error\nUncaught AirtableError: Create one at airtable.com/create/tokens\n    at handler"
    )
    expect(errorMessage(error, "fallback")).toBe(
      "Create one at airtable.com/create/tokens"
    )
  })
})

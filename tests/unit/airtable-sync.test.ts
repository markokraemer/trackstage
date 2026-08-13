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
  INBOUND_STATUSES,
  addSummary,
  emptySummary,
  modifiedSinceFormula,
  parseStatusLabel,
  tally,
} from "../../convex/lib/airtableInbound"
import {
  DEFAULT_INBOUND_FIELDS,
  INBOUND_FIELDS,
  INBOUND_FIELD_KEYS,
  INBOUND_FIELD_REASON_TEXT,
  decideField,
  inboundField,
  inboundGroups,
  resolveInboundFields,
  tablesToPull,
  tagsToCell,
} from "../../convex/lib/airtableFields"
import type { InboundFieldSpec } from "../../convex/lib/airtableFields"

// The two-way Airtable sync (HISTORY.md 61, 72) lives or dies on these
// comparisons: get them wrong and you either get an echo loop (our own write
// bouncing back forever) or a lost organizer decision. They are pure on purpose
// so every branch can be pinned here rather than discovered in production.

/** The spec under test, by key — the tests read better naming the field. */
function spec(key: string): InboundFieldSpec {
  const found = inboundField(key)
  if (!found) throw new Error(`no such inbound field: ${key}`)
  return found
}

/** `decideField` with the status field and the argument names it used to have. */
function status(candidate: {
  airtableValue: unknown
  currentStatus: string
  lastPushedStatus?: string | null
}) {
  return decideField({
    spec: spec("submissions.status"),
    airtableValue: candidate.airtableValue,
    currentValue: candidate.currentStatus,
    baseline: candidate.lastPushedStatus ?? undefined,
  })
}

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

describe("decideField — Status (the original inbound field)", () => {
  it("applies a genuine Airtable triage decision", () => {
    expect(
      status({
        airtableValue: "Accept queue",
        currentStatus: "pending",
        lastPushedStatus: "pending",
      })
    ).toEqual({ apply: true, value: "accept_queue", reason: "apply" })
  })

  it("ignores our OWN write coming back (the echo loop guard)", () => {
    // We pushed "accepted" last sync; Airtable is simply reflecting it while
    // our row has since been moved on by an organizer.
    const decision = status({
      airtableValue: "Accepted",
      currentStatus: "declined",
      lastPushedStatus: "accepted",
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("echo")
  })

  it("does nothing when both sides already agree", () => {
    const decision = status({
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
    const decision = status({
      airtableValue: "Declined",
      currentStatus: "accepted",
      lastPushedStatus: "pending",
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("conflict")
    expect(decision).toHaveProperty("airtableValue", "declined")
  })

  it("refuses to act on a row it has never mirrored", () => {
    const decision = status({
      airtableValue: "Accepted",
      currentStatus: "pending",
      lastPushedStatus: null,
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("no_baseline")
  })

  it("never lets Airtable set draft or withdrawn", () => {
    for (const value of ["Draft", "Withdrawn"]) {
      const decision = status({
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

  it("does not report a refusal for a draft it is only mirroring back", () => {
    // A live run against a real base is what caught this: we WRITE "Draft" for
    // every draft submission, so it comes back on every single pull. Counting
    // that as a refusal gave the settings card a permanent "4 left alone" that
    // nobody could act on. A cell that agrees with us is asking for nothing.
    const decision = status({
      airtableValue: "Draft",
      currentStatus: "draft",
      lastPushedStatus: "draft",
    })
    expect(decision.reason).toBe("unchanged")
  })

  it("treats a forbidden value we ourselves pushed as an echo, not a refusal", () => {
    // Mirror wrote "Withdrawn"; the organizer has since moved it on here. The
    // cell is stale output of ours, not a request from Airtable.
    const decision = status({
      airtableValue: "Withdrawn",
      currentStatus: "accepted",
      lastPushedStatus: "withdrawn",
    })
    expect(decision.reason).toBe("echo")
  })

  it("rejects an unrecognised cell before any state reasoning", () => {
    const decision = status({
      airtableValue: "Shortlisted",
      currentStatus: "accepted",
      lastPushedStatus: "pending", // would otherwise read as a conflict
    })
    expect(decision.reason).toBe("unknown_value")
  })

  it("refuses to blank a status, however empty the cell", () => {
    const decision = status({
      airtableValue: "",
      currentStatus: "accepted",
      lastPushedStatus: "pending",
    })
    expect(decision.apply).toBe(false)
    expect(decision.reason).toBe("blank_ignored")
  })

  it("applies every allowed target status", () => {
    for (const target of INBOUND_STATUSES) {
      const from = target === "pending" ? "accepted" : "pending"
      const decision = status({
        airtableValue: target,
        currentStatus: from,
        lastPushedStatus: from,
      })
      expect(decision.apply).toBe(true)
      expect(decision.value).toBe(target)
    }
  })

  it("settles after an applied change instead of looping", () => {
    // Round 1: Airtable moved it, we apply and move the baseline with it.
    expect(
      status({
        airtableValue: "Declined",
        currentStatus: "pending",
        lastPushedStatus: "pending",
      }).apply
    ).toBe(true)
    // Round 2 (same record, next pull): identical cell, now identical state.
    const second = status({
      airtableValue: "Declined",
      currentStatus: "declined",
      lastPushedStatus: "declined",
    })
    expect(second.apply).toBe(false)
    expect(second.reason).toBe("unchanged")
  })
})

// Every field goes through the same engine, so what has to be pinned per field
// is its PARSER: what it accepts, what it refuses, and whether an empty cell
// means "clear this" or "nothing to say".

describe("decideField — text fields", () => {
  const apply = (key: string, cell: unknown, current: string, base: string) =>
    decideField({
      spec: spec(key),
      airtableValue: cell,
      currentValue: current,
      baseline: base,
    })

  it("rewrites a title from the grid", () => {
    const decision = apply(
      "submissions.title",
      "  Evaluating RAG pipelines  ",
      "Old title",
      "Old title"
    )
    expect(decision).toEqual({
      apply: true,
      value: "Evaluating RAG pipelines",
      reason: "apply",
    })
  })

  it("never blanks a title, but does clear an optional field", () => {
    expect(apply("submissions.title", "", "A talk", "A talk").reason).toBe(
      "blank_ignored"
    )
    const cleared = apply("speakers.company", "", "Acme", "Acme")
    expect(cleared).toEqual({ apply: true, value: "", reason: "apply" })
  })

  it("refuses a paste so long it can only be an accident", () => {
    expect(
      apply("submissions.title", "x".repeat(301), "A talk", "A talk").reason
    ).toBe("unknown_value")
    // A real abstract is allowed to be long.
    expect(
      apply("submissions.description", "x".repeat(5_000), "old", "old").apply
    ).toBe(true)
    expect(
      apply("submissions.description", "x".repeat(20_001), "old", "old").reason
    ).toBe("unknown_value")
  })

  it("clearing needs a baseline, so a half-filled row can't delete anything", () => {
    // No baseline ⇒ we never wrote that cell ⇒ an empty one means nothing.
    expect(
      decideField({
        spec: spec("speakers.bio"),
        airtableValue: "",
        currentValue: "A long bio",
        baseline: undefined,
      }).reason
    ).toBe("no_baseline")
  })
})

describe("decideField — track and tags", () => {
  it("treats a track rename as case-insensitive (no phantom conflicts)", () => {
    const decision = decideField({
      spec: spec("submissions.track"),
      airtableValue: "ai engineering",
      currentValue: "AI Engineering",
      baseline: "AI Engineering",
    })
    expect(decision.reason).toBe("unchanged")
  })

  it("normalises a tag list the way the mirror writes it", () => {
    const decision = decideField({
      spec: spec("submissions.tags"),
      airtableValue: " rag,  evaluation , RAG ,, ",
      currentValue: "rag",
      baseline: "rag",
    })
    // Trimmed, de-duplicated case-insensitively, order preserved.
    expect(decision).toEqual({
      apply: true,
      value: "rag, evaluation",
      reason: "apply",
    })
  })

  it("refuses a runaway tag paste", () => {
    const many = Array.from({ length: 26 }, (_, i) => `t${i}`).join(", ")
    expect(
      decideField({
        spec: spec("submissions.tags"),
        airtableValue: many,
        currentValue: "",
        baseline: "",
      }).reason
    ).toBe("unknown_value")
  })

  it("round-trips our own tag rendering", () => {
    expect(tagsToCell([" rag ", "", "evaluation"])).toBe("rag, evaluation")
    expect(
      decideField({
        spec: spec("submissions.tags"),
        airtableValue: tagsToCell(["rag", "evaluation"]),
        currentValue: tagsToCell(["rag", "evaluation"]),
        baseline: "rag, evaluation",
      }).reason
    ).toBe("unchanged")
  })
})

describe("decideField — the agenda fields", () => {
  const iso = "2026-10-13T16:30:00.000Z"

  it("compares an Airtable timestamp against our epoch milliseconds", () => {
    // Our side holds a number, Airtable holds a string. Same instant, and the
    // shared parser is what makes them compare equal.
    expect(
      decideField({
        spec: spec("sessions.startsAt"),
        airtableValue: iso,
        currentValue: Date.parse(iso),
        baseline: iso,
      }).reason
    ).toBe("unchanged")
  })

  it("moves a session when the cell really changed", () => {
    const moved = "2026-10-13T18:00:00.000Z"
    expect(
      decideField({
        spec: spec("sessions.startsAt"),
        airtableValue: moved,
        currentValue: Date.parse(iso),
        baseline: iso,
      })
    ).toEqual({ apply: true, value: moved, reason: "apply" })
  })

  it("refuses a date it cannot read, or one from the wrong century", () => {
    for (const bad of ["next tuesday", "0025-01-01T00:00:00Z", "not a date"]) {
      expect(
        decideField({
          spec: spec("sessions.startsAt"),
          airtableValue: bad,
          currentValue: Date.parse(iso),
          baseline: iso,
        }).reason
      ).toBe("unknown_value")
    }
  })

  it("holds durations to the same bounds as a drag on the board", () => {
    const decide = (cell: unknown) =>
      decideField({
        spec: spec("sessions.duration"),
        airtableValue: cell,
        currentValue: 60,
        baseline: "60",
      })
    expect(decide(45)).toEqual({ apply: true, value: "45", reason: "apply" })
    expect(decide("45")).toEqual({ apply: true, value: "45", reason: "apply" })
    expect(decide(4).reason).toBe("unknown_value")
    expect(decide(481).reason).toBe("unknown_value")
    expect(decide(45.5).reason).toBe("unknown_value")
  })

  it("never lets an empty cell wipe a slot", () => {
    for (const key of ["sessions.room", "sessions.startsAt", "sessions.duration"]) {
      expect(
        decideField({
          spec: spec(key),
          airtableValue: "",
          currentValue: key === "sessions.room" ? "Main Stage" : 60,
          baseline: key === "sessions.room" ? "Main Stage" : "60",
        }).reason
      ).toBe("blank_ignored")
    }
  })
})

describe("the inbound registry", () => {
  it("is one-way by default: nothing is inbound unless it is switched on", () => {
    expect(resolveInboundFields(undefined, undefined)).toEqual([])
    expect(resolveInboundFields(false, INBOUND_FIELD_KEYS)).toEqual([])
  })

  it("falls back to Status when the switch is on with no selection", () => {
    // What the switch meant before per-field selection existed — connections
    // made then must keep behaving exactly as they did.
    expect(resolveInboundFields(true, undefined).map((f) => f.key)).toEqual([
      ...DEFAULT_INBOUND_FIELDS,
    ])
    expect(resolveInboundFields(true, []).map((f) => f.key)).toEqual([
      ...DEFAULT_INBOUND_FIELDS,
    ])
  })

  it("drops keys it no longer understands instead of failing the pull", () => {
    const resolved = resolveInboundFields(true, [
      "submissions.status",
      "submissions.somethingWeRetired",
    ])
    expect(resolved.map((f) => f.key)).toEqual(["submissions.status"])
  })

  it("only reads the tables the selection actually needs", () => {
    expect(tablesToPull(resolveInboundFields(true, ["speakers.bio"]))).toEqual([
      "speakers",
    ])
    expect(
      tablesToPull(
        resolveInboundFields(true, ["submissions.title", "sessions.room"])
      )
    ).toEqual(["submissions", "sessions"])
  })

  it("keeps identity and derived columns out of reach", () => {
    // Rewriting an email in a spreadsheet would cut a speaker off from their
    // own portal, tasks and comms; the rest are ours to calculate.
    for (const column of ["Email", "Name", "Trackstage ID", "Ends At", "Speakers"]) {
      expect(INBOUND_FIELDS.some((field) => field.column === column)).toBe(false)
    }
  })

  it("gives every field a place to land and a reader-facing name", () => {
    for (const field of INBOUND_FIELDS) {
      expect(field.key.startsWith(`${field.table}.`)).toBe(true)
      expect(field.label).toBeTruthy()
      expect(field.help).toBeTruthy()
    }
    // Keys are unique — they are what the connection stores.
    expect(new Set(INBOUND_FIELD_KEYS).size).toBe(INBOUND_FIELD_KEYS.length)
    // Every field is reachable from the settings card.
    expect(inboundGroups().flatMap((group) => group.fields)).toHaveLength(
      INBOUND_FIELDS.length
    )
  })

  it("has reader-facing wording for every outcome the engine can produce", () => {
    for (const reason of [
      "apply",
      "unknown_value",
      "not_allowed",
      "blank_ignored",
      "unchanged",
      "no_baseline",
      "echo",
      "conflict",
      "unresolved",
      "rejected",
    ] as const) {
      expect(INBOUND_FIELD_REASON_TEXT[reason]).toBeTruthy()
    }
  })
})

describe("tally", () => {
  it("counts what an organizer can act on, and leaves out the noise", () => {
    let summary = emptySummary()
    summary = tally(summary, "apply")
    summary = tally(summary, "conflict")
    summary = tally(summary, "unresolved")
    // Every pull re-reads whole rows, so these two are the common case by
    // construction — counting them would bury the numbers that matter.
    summary = tally(summary, "echo")
    summary = tally(summary, "unchanged")
    expect(summary).toEqual({
      checked: 0,
      applied: 1,
      skipped: 2,
      conflicts: 1,
    })
  })

  it("adds up across tables", () => {
    expect(
      addSummary(
        { checked: 2, applied: 1, skipped: 0, conflicts: 0 },
        { checked: 3, applied: 0, skipped: 4, conflicts: 1 }
      )
    ).toEqual({ checked: 5, applied: 1, skipped: 4, conflicts: 1 })
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

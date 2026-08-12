import { describe, expect, it } from "vitest"
import { ConvexError } from "convex/values"
import {
  assertReleasable,
  availableOptions,
  publicQuestions,
  releaseBlockers,
  syncTrackOptions,
} from "../../convex/lib/formQuestions"
import type { FormQuestion } from "../../convex/lib/formQuestions"
import { releaseBlockers as clientReleaseBlockers } from "../../src/components/forms-builder/model"

/**
 * The rules behind Marko's fresh-event bug: a required Track dropdown with
 * nothing in it on a live public form. See docs/memory/DECISIONS.md.
 */

const question = (over: Partial<FormQuestion> = {}): FormQuestion => ({
  id: "track",
  label: "Track",
  type: "dropdown",
  required: true,
  enabled: true,
  locked: false,
  options: ["Stale One"],
  isTrackQuestion: true,
  ...over,
})

const title: FormQuestion = {
  id: "title",
  label: "Title",
  type: "short_text",
  required: true,
  enabled: true,
  locked: true,
}

describe("track question options are the event's tracks", () => {
  it("replaces whatever was stored, in the event's order", () => {
    const synced = syncTrackOptions([title, question()], ["AI", "Infra"])
    expect(synced[1].options).toEqual(["AI", "Infra"])
    // Non-track questions are untouched.
    expect(synced[0]).toBe(title)
  })

  it("empties the list when the event has no tracks", () => {
    expect(syncTrackOptions([question()], [])[0].options).toEqual([])
  })

  it("reports what a question can actually offer", () => {
    expect(availableOptions(question(), ["AI"])).toEqual(["AI"])
    expect(
      availableOptions(
        question({ isTrackQuestion: undefined, options: ["Talk"] }),
        ["AI"],
      ),
    ).toEqual(["Talk"])
  })
})

describe("the public form never renders an unanswerable dropdown", () => {
  it("drops a track question when the event has no tracks", () => {
    expect(publicQuestions([title, question()], []).map((q) => q.id)).toEqual([
      "title",
    ])
  })

  it("keeps it, synced, as soon as one track exists", () => {
    const shown = publicQuestions([title, question()], ["AI"])
    expect(shown.map((q) => q.id)).toEqual(["title", "track"])
    expect(shown[1].options).toEqual(["AI"])
  })

  it("leaves an ordinary empty dropdown alone (the builder gate owns that one)", () => {
    const empty = question({ isTrackQuestion: undefined, options: [] })
    expect(publicQuestions([empty], []).map((q) => q.id)).toEqual(["track"])
  })
})

describe("release blockers", () => {
  it("names a required track question with no tracks behind it", () => {
    const [blocker] = releaseBlockers([question()], [])
    expect(blocker.questionId).toBe("track")
    expect(blocker.message).toContain("Settings → Rooms & tracks")
  })

  it("clears once tracks exist, or once the question is optional", () => {
    expect(releaseBlockers([question()], ["AI"])).toEqual([])
    expect(releaseBlockers([question({ required: false })], [])).toEqual([])
    expect(releaseBlockers([question({ enabled: false })], [])).toEqual([])
  })

  it("covers any required choice question, not just tracks", () => {
    const [blocker] = releaseBlockers(
      [question({ id: "format", label: "Format", isTrackQuestion: undefined, options: [] })],
      ["AI"],
    )
    expect(blocker.message).toContain("no answer options")
  })

  it("ignores question types that have no option list", () => {
    expect(releaseBlockers([title], [])).toEqual([])
  })

  it("reads identically in the builder (client mirror)", () => {
    expect(clientReleaseBlockers([question()], [])).toEqual(
      releaseBlockers([question()], []),
    )
  })
})

describe("the release gate", () => {
  const gate = (input: Parameters<typeof assertReleasable>[0]) => () =>
    assertReleasable(input)

  it("refuses to open a form with a blocker", () => {
    expect(
      gate({
        wasOpen: false,
        willBeOpen: true,
        before: [question()],
        after: [question()],
        trackNames: [],
      }),
    ).toThrow(ConvexError)
  })

  it("lets a closed form stay half-built", () => {
    expect(
      gate({
        wasOpen: false,
        willBeOpen: false,
        before: [question()],
        after: [question()],
        trackNames: [],
      }),
    ).not.toThrow()
  })

  it("keeps an already-broken open form editable", () => {
    expect(
      gate({
        wasOpen: true,
        willBeOpen: true,
        before: [question()],
        after: [question({ label: "Track (renamed)" })],
        trackNames: [],
      }),
    ).not.toThrow()
  })

  it("still refuses a NEW blocker on a live form", () => {
    expect(
      gate({
        wasOpen: true,
        willBeOpen: true,
        before: [question({ required: false })],
        after: [question({ required: true })],
        trackNames: [],
      }),
    ).toThrow(ConvexError)
  })
})

import { ConvexError } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"

// ————————————————————————————————————————————————————————————————————————
// The track question is SOURCED FROM THE EVENT'S TRACKS. Always.
//
// A dropdown flagged `isTrackQuestion` exists to route submissions into the
// tracks an organizer set up in Settings → Rooms & tracks, so its answer list
// is not an independent thing to maintain: it IS that track list. Forms used to
// snapshot the names at creation time, which produced the two bugs this module
// closes:
//
//   1. A brand-new event has no tracks yet, so the snapshot was `[]` — and the
//      public form rendered a REQUIRED dropdown with nothing in it. Nobody
//      could submit at all until the organizer went and made a track (with no
//      hint anywhere that that was the problem). Hence `publicQuestions`: with
//      zero tracks the question is simply not shown, and the submission lands
//      trackless for the organizer to sort later. Never render a required field
//      that cannot be answered.
//   2. Tracks added AFTER the form was built never reached the form.
//
// So: `syncTrackOptions` is applied on every read and every write of a form's
// questions, and `roomsTracks` writes through to the stored copy whenever the
// track list itself changes. The per-form override still exists and is exactly
// where it always was — turn "Route answers to tracks" off and the question
// becomes an ordinary dropdown with its own hand-written options.
// ————————————————————————————————————————————————————————————————————————

export type FormQuestion = Doc<"forms">["questions"][number]

/** Question types whose answer is picked from a list — the ones that can be empty. */
const CHOICE_TYPES = ["dropdown", "multi_select"]

/** Track names for an event, in the organizer's own order. */
export async function eventTrackNames(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<Array<string>> {
  const tracks = await ctx.db
    .query("tracks")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  return tracks.sort((a, b) => a.order - b.order).map((track) => track.name)
}

/** Whatever the stored options say, a track question offers the event's tracks. */
export function syncTrackOptions(
  questions: Array<FormQuestion>,
  trackNames: Array<string>,
): Array<FormQuestion> {
  return questions.map((question) =>
    question.isTrackQuestion
      ? { ...question, options: [...trackNames] }
      : question,
  )
}

/**
 * True when this question would render as an unanswerable dropdown: it routes
 * to tracks and the event has none. The organizer's form builder shows a
 * warning for exactly this case; the public form hides the question.
 */
export function trackQuestionIsEmpty(
  question: FormQuestion,
  trackNames: Array<string>,
): boolean {
  return question.isTrackQuestion === true && trackNames.length === 0
}

/**
 * The questions a submitter actually sees: options synced to the live tracks,
 * and a track question with no tracks behind it dropped entirely rather than
 * shown empty. Enabled-only filtering is the caller's business.
 */
export function publicQuestions(
  questions: Array<FormQuestion>,
  trackNames: Array<string>,
): Array<FormQuestion> {
  return syncTrackOptions(questions, trackNames).filter(
    (question) => !trackQuestionIsEmpty(question, trackNames),
  )
}

/**
 * The same form, with its questions as the public flow sees them — so
 * validation, conditional logic and track routing in the submit mutations all
 * reason about the form the speaker was actually shown.
 */
export async function formAsSubmitted(
  ctx: QueryCtx,
  form: Doc<"forms">,
): Promise<Doc<"forms">> {
  const trackNames = await eventTrackNames(ctx, form.eventId)
  return { ...form, questions: publicQuestions(form.questions, trackNames) }
}

/** What this question can actually offer today — tracks, or its own options. */
export function availableOptions(
  question: FormQuestion,
  trackNames: Array<string>,
): Array<string> {
  return question.isTrackQuestion ? trackNames : (question.options ?? [])
}

export interface ReleaseBlocker {
  questionId: string
  message: string
}

/**
 * Why this form must not go live yet — one sentence per question that asks for
 * an answer it cannot offer (enabled + required + a choice list with nothing in
 * it). An empty array means it is safe to open.
 *
 * A REQUIRED question with no options is a dead end for the submitter, and the
 * public form's own guard (`publicQuestions`) can only rescue the track case.
 * So the release itself is refused, in the builder and in `forms.update`, and
 * the organizer is told which of the two fixes they want. Closed forms are
 * exempt: half-built is exactly what a closed form is for.
 */
export function releaseBlockers(
  questions: Array<FormQuestion>,
  trackNames: Array<string>,
): Array<ReleaseBlocker> {
  return questions
    .filter(
      (question) =>
        question.enabled &&
        question.required &&
        CHOICE_TYPES.includes(question.type) &&
        availableOptions(question, trackNames).length === 0,
    )
    .map((question) => ({
      questionId: question.id,
      message: question.isTrackQuestion
        ? `The “${question.label}” question is required but this event has no tracks yet — add tracks in Settings → Rooms & tracks, or make the question optional.`
        : `The “${question.label}” question is required but has no answer options — add options in the form builder, or make the question optional.`,
    }))
}

/**
 * THE release gate. Every write that can put a form live — or change the
 * questions on a live one — runs through here, so "you cannot publish a form
 * nobody can fill in" holds for the builder, the REST API and the MCP server
 * alike.
 *
 * Two rules, and the second one matters as much as the first:
 *   · OPENING a form refuses on ANY blocker.
 *   · A form that is ALREADY open refuses only blockers this write would ADD.
 *     Forms opened before this rule existed (or broken by a track deletion)
 *     must stay editable, or the organizer is locked out of the very screen
 *     where the fix lives.
 */
export function assertReleasable(input: {
  wasOpen: boolean
  willBeOpen: boolean
  /** The questions as stored right now. */
  before: Array<FormQuestion>
  /** The questions this write would leave behind. */
  after: Array<FormQuestion>
  trackNames: Array<string>
}): void {
  if (!input.willBeOpen) return
  const known = new Set(
    releaseBlockers(input.before, input.trackNames).map((b) => b.questionId),
  )
  const offending = releaseBlockers(input.after, input.trackNames).filter(
    (blocker) => !input.wasOpen || !known.has(blocker.questionId),
  )
  if (offending.length > 0) throw new ConvexError(offending[0].message)
}

import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { renderTemplate } from "./email"

// ————————————————————————————————————————————————————————————————————————
// Task personalisation — Sessionboard's "Use Field" (product-map delta #10).
//
// An organizer writes ONE task in the library:
//
//   "Hi {{firstName}} — upload the slides for {{sessionTitle}} by Friday."
//
// and every speaker sees their own name and their own session title. The text
// is stored with the placeholders intact and resolved at READ time, so editing
// a speaker's name or moving their talk fixes the wording everywhere at once.
//
// Same renderer as the email templates (`renderTemplate`), so the placeholder
// vocabulary an organizer learns in the email editor works here too, and an
// unknown token collapses to an empty string rather than leaking `{{x}}` at a
// speaker.
// ————————————————————————————————————————————————————————————————————————

/** The placeholders offered on a task's instructions. */
export const TASK_PLACEHOLDERS = [
  "firstName",
  "lastName",
  "speakerName",
  "sessionTitle",
  "eventName",
] as const

export type TaskVars = Record<string, string>

/** Cheap pre-check: skip all the lookups for text with nothing to resolve. */
export function hasPlaceholder(text: string | undefined): boolean {
  return typeof text === "string" && text.includes("{{")
}

/**
 * The submission whose title a task should quote: their accepted talk if they
 * have one, otherwise the most recent thing they are attached to. Covers both
 * origins — being the submitter and being named as a co-speaker.
 */
async function primarySubmission(
  ctx: QueryCtx | MutationCtx,
  personId: Id<"people">,
): Promise<Doc<"submissions"> | null> {
  const [participantRows, ownRows] = await Promise.all([
    ctx.db
      .query("submissionParticipants")
      .withIndex("by_personId", (q) => q.eq("personId", personId))
      .take(50),
    ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", personId))
      .take(50),
  ])
  const linked = (
    await Promise.all(participantRows.map((row) => ctx.db.get(row.submissionId)))
  ).filter((s): s is Doc<"submissions"> => s !== null)
  const byId = new Map<string, Doc<"submissions">>()
  for (const submission of [...linked, ...ownRows]) {
    if (submission.deletedAt !== undefined) continue
    byId.set(submission._id, submission)
  }
  return pickPrimarySubmission([...byId.values()])
}

/**
 * Everything a task's text may reference for one speaker. Pure — the caller
 * supplies the submission, so a screen that already loaded it (the portal
 * home) doesn't pay for the lookup twice.
 */
export function buildTaskVars(
  person: Doc<"people">,
  eventName: string,
  submission: Doc<"submissions"> | null,
): TaskVars {
  const speakerName =
    `${person.firstName} ${person.lastName}`.trim() || person.email
  return {
    firstName: person.firstName || speakerName,
    lastName: person.lastName,
    speakerName,
    sessionTitle: submission?.title ?? "",
    eventName,
  }
}

/** Same, resolving the speaker's session from the database. */
export async function taskVarsForPerson(
  ctx: QueryCtx | MutationCtx,
  person: Doc<"people">,
  eventName: string,
): Promise<TaskVars> {
  return buildTaskVars(
    person,
    eventName,
    await primarySubmission(ctx, person._id),
  )
}

/** The precedence `buildTaskVars` callers should use: accepted, else newest. */
export function pickPrimarySubmission(
  submissions: Array<Doc<"submissions">>,
): Doc<"submissions"> | null {
  const sorted = [...submissions].sort(
    (a, b) => b._creationTime - a._creationTime,
  )
  return sorted.find((s) => s.status === "accepted") ?? sorted.at(0) ?? null
}

/**
 * Render a task's instructions for one speaker. Returns the text untouched
 * when it holds no placeholders, so the common case costs nothing.
 */
export function renderTaskText(
  text: string | undefined,
  vars: TaskVars,
): string | undefined {
  if (!hasPlaceholder(text)) return text
  return renderTemplate(text as string, vars)
}

/**
 * Per-person variable cache for list queries: a roster of 40 tasks across 8
 * speakers resolves 8 times, not 40.
 */
export function makeTaskVarsCache(
  ctx: QueryCtx | MutationCtx,
  eventName: string,
) {
  const cache = new Map<string, Promise<TaskVars>>()
  return (person: Doc<"people">): Promise<TaskVars> => {
    const cached = cache.get(person._id)
    if (cached) return cached
    const promise = taskVarsForPerson(ctx, person, eventName)
    cache.set(person._id, promise)
    return promise
  }
}

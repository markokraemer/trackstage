/**
 * Tasks that tick themselves.
 *
 * The docs promise a speaker that "Update your profile" disappears the moment
 * the profile is actually complete — nobody should have to tell the system
 * something it can see. That promise only holds if EVERY door into the profile
 * re-checks it (the portal editor, a headshot upload, the organizer fixing a
 * bio ten minutes before go-live) and if assigning the task to an
 * already-complete profile closes it there and then instead of leaving a task
 * nobody can ever finish.
 *
 * Deliberately narrow: only `profile`-kind tasks auto-tick from profile data.
 * A `headshot` or `upload` task is a REQUEST for a new file — "send us a
 * better photo" is a perfectly normal thing to ask someone who already has one
 * — so those only complete when a file actually arrives (see
 * `portal.attachUpload`).
 */

import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { isProfileComplete } from "./profileCompleteness"

/** The four-item verdict of `profileCompleteness`, for a `people` row. */
export function personProfileComplete(person: Doc<"people">): boolean {
  return isProfileComplete({
    bio: person.bio,
    jobTitle: person.jobTitle,
    company: person.company,
    links: person.links,
    hasHeadshot: Boolean(person.headshotId),
  })
}

/** Close every open task of one kind for this person. */
export async function completeTasksOfKind(
  ctx: MutationCtx,
  personId: Id<"people">,
  kind: string,
) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_personId", (q) => q.eq("personId", personId))
    .collect()
  for (const task of tasks) {
    if (task.kind === kind && !task.completedAt) {
      await ctx.db.patch(task._id, { completedAt: Date.now() })
    }
  }
}

/**
 * Call after ANY write to a `people` row (portal edit, headshot upload,
 * organizer edit): if that write completed the profile, the profile tasks are
 * done. Pass the row as it now stands — re-`get` it after the patch.
 */
export async function syncProfileTasks(
  ctx: MutationCtx,
  person: Doc<"people"> | null,
) {
  if (!person) return
  if (!personProfileComplete(person)) return
  await completeTasksOfKind(ctx, person._id, "profile")
}

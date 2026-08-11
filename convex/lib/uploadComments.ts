import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

// ————————————————————————————————————————————————————————————————————————
// The comment thread that hangs off one uploaded file (sbek CNT-05,
// product-map delta #8). One thread, both roles: whatever the organizer asks
// on a deck, the speaker reads on the same file — and vice versa.
//
// Shared by convex/tasksAdmin.ts (organizer side) and convex/portal.ts
// (speaker side) so the two views can never drift apart in shape or order.
// ————————————————————————————————————————————————————————————————————————

export const MAX_COMMENT_LENGTH = 2000

export type UploadComment = {
  id: Id<"uploadComments">
  authorType: string
  authorLabel: string
  body: string
  createdAt: number
}

/** Oldest first — a thread reads like a conversation, not a feed. */
export async function threadFor(
  ctx: QueryCtx | MutationCtx,
  uploadId: Id<"uploads">,
): Promise<Array<UploadComment>> {
  const rows = await ctx.db
    .query("uploadComments")
    .withIndex("by_uploadId", (q) => q.eq("uploadId", uploadId))
    .collect()
  return rows
    .sort((a, b) => a._creationTime - b._creationTime)
    .map((row) => ({
      id: row._id,
      authorType: row.authorType,
      authorLabel: row.authorLabel,
      body: row.body,
      createdAt: row._creationTime,
    }))
}

/** Insert one comment after validating the body. Returns the new row's id. */
export async function addComment(
  ctx: MutationCtx,
  input: {
    uploadId: Id<"uploads">
    eventId: Id<"events">
    authorType: "organizer" | "speaker"
    authorLabel: string
    body: string
  },
): Promise<Id<"uploadComments">> {
  const body = input.body.trim()
  if (!body) throw new Error("Write something before posting.")
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Keep the comment under ${MAX_COMMENT_LENGTH} characters — attach a document for anything longer.`,
    )
  }
  return await ctx.db.insert("uploadComments", {
    uploadId: input.uploadId,
    eventId: input.eventId,
    authorType: input.authorType,
    authorLabel: input.authorLabel,
    body,
  })
}

import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import {
  assertAllowedUpload,
  assertImageUpload,
  deleteUploadRow,
  enrichUploads,
  nextVersion,
  releaseBlob,
  storageMeta,
} from "./lib/files"

// ————————————————————————————————————————————————————————————————————————
// Organizer-side file storage: event branding, attaching a file on a
// speaker's behalf, deleting a version, and the orphan sweep.
//
// The speaker-side twin lives in convex/portal.ts (magic-link auth). Every
// function here goes through `requireEventAccess`, so files are as
// event-scoped as everything else.
// ————————————————————————————————————————————————————————————————————————

/**
 * Signed upload URL for an organizer. Mirrors `portal.generateUploadUrl` but
 * authorizes through workspace membership instead of a portal token.
 */
export const generateUploadUrl = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    return await ctx.storage.generateUploadUrl()
  },
})

// ——— Event branding ———————————————————————————————————————————————————————

const BRANDING_SLOTS = { logo: "logoId", background: "backgroundId" } as const
type BrandingSlot = keyof typeof BRANDING_SLOTS

export const eventBranding = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const describe = async (storageId?: Id<"_storage">) => {
      if (!storageId) return null
      const [meta, url] = await Promise.all([
        storageMeta(ctx, storageId),
        ctx.storage.getUrl(storageId),
      ])
      if (!meta) return null
      return {
        url,
        size: meta.size,
        contentType: meta.contentType,
        sha256: meta.sha256,
        uploadedAt: meta.storedAt,
      }
    }
    return {
      logo: await describe(event.logoId),
      background: await describe(event.backgroundId),
    }
  },
})

/**
 * Set (or clear, with `storageId: null`) the event logo or background image.
 * Replacing one deletes the blob it replaces — branding has no version
 * history, so keeping the old file would leak storage forever.
 */
export const setEventBranding = mutation({
  args: {
    eventId: v.id("events"),
    slot: v.union(v.literal("logo"), v.literal("background")),
    storageId: v.union(v.id("_storage"), v.null()),
    filename: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId, "admin")
    const field = BRANDING_SLOTS[args.slot as BrandingSlot]
    const previous = event[field]

    if (args.storageId !== null) {
      const meta = await storageMeta(ctx, args.storageId)
      if (!meta) {
        throw new Error("That upload didn't finish — please try again.")
      }
      assertImageUpload(meta, args.filename ?? "image")
    }

    await ctx.db.patch(args.eventId, {
      [field]: args.storageId ?? undefined,
    })

    if (previous && previous !== args.storageId) {
      // Branding blobs are never referenced by `uploads`, but ask anyway —
      // one code path for "is anything still using this?".
      await releaseBlob(ctx, previous)
    }
    return null
  },
})

// ——— Attaching on a speaker's behalf ——————————————————————————————————————

/**
 * Organizers routinely receive a deck by email and need it filed against the
 * session. This attaches it exactly like the speaker would have — same slot,
 * same version sequence — recorded against the submission's primary speaker
 * so it shows up in their portal too. Organizer-attached files start
 * `approved`: the organizer is the reviewer.
 */
export const attachUploadAsOrganizer = mutation({
  args: {
    submissionId: v.id("submissions"),
    storageId: v.id("_storage"),
    filename: v.string(),
    /** Defaults to the submission's primary speaker. */
    personId: v.optional(v.id("people")),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Submission not found.")
    await requireEventAccess(ctx, submission.eventId)

    const meta = await storageMeta(ctx, args.storageId)
    if (!meta) throw new Error("That upload didn't finish — please try again.")
    assertAllowedUpload(meta, args.filename)

    const personId = args.personId ?? (await primarySpeaker(ctx, submission))
    const person = await ctx.db.get(personId)
    if (!person || person.eventId !== submission.eventId) {
      throw new Error("That speaker doesn't belong to this event.")
    }

    const version = await nextVersion(ctx, {
      personId,
      submissionId: args.submissionId,
    })
    return await ctx.db.insert("uploads", {
      eventId: submission.eventId,
      personId,
      submissionId: args.submissionId,
      storageId: args.storageId,
      filename: args.filename,
      contentType: meta.contentType,
      size: meta.size,
      version,
      approvalStatus: "approved",
    })
  },
})

async function primarySpeaker(
  ctx: QueryCtx | MutationCtx,
  submission: Doc<"submissions">,
): Promise<Id<"people">> {
  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
    .collect()
  const speakers = participants
    .filter((p) => p.role === "speaker")
    .sort((a, b) => a.order - b.order)
  return speakers[0]?.personId ?? submission.submitterId
}

/**
 * Delete one uploaded version — row AND blob. The escape hatch for a rejected
 * file nobody should keep: without it, "changes requested" leaves the bad file
 * in storage for the life of the event.
 */
export const deleteUpload = mutation({
  args: { uploadId: v.id("uploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.uploadId)
    if (!row) throw new Error("File not found.")
    await requireEventAccess(ctx, row.eventId, "admin")
    await deleteUploadRow(ctx, row)
    return null
  },
})

// ——— Reading ——————————————————————————————————————————————————————————————

/** Every file on one submission, with real metadata. Used by the Files tab. */
export const submissionFiles = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Submission not found.")
    await requireEventAccess(ctx, submission.eventId)
    const rows = await ctx.db
      .query("uploads")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId),
      )
      .collect()
    const files = await enrichUploads(
      ctx,
      rows.sort((a, b) => b._creationTime - a._creationTime),
    )
    const people = new Map<string, string>()
    for (const file of files) {
      if (people.has(file.personId)) continue
      const person = await ctx.db.get(file.personId)
      people.set(
        file.personId,
        person ? `${person.firstName} ${person.lastName}`.trim() || person.email : "",
      )
    }
    return files.map((file) => ({
      ...file,
      personName: people.get(file.personId) ?? "",
    }))
  },
})

// ——— Housekeeping —————————————————————————————————————————————————————————

/**
 * Orphan sweep. Run it with:
 *
 *     pnpm exec convex run files:sweepOrphans '{"deleteUnreferenced": true}'
 *
 * Two kinds of rot, both of which Convex will otherwise keep forever:
 *
 *  · DANGLING ROWS — an `uploads` row whose blob is gone (a delete that
 *    happened before this module existed, or a restore from a partial backup).
 *    Always removed: the row can only ever render a broken link.
 *  · UNREFERENCED BLOBS — a blob in `_storage` no row, headshot or branding
 *    field points at. Usually an upload where the browser died between "POST
 *    the bytes" and "attach the row". Only deleted with `deleteUnreferenced`.
 *
 * LIMITS, deliberately:
 *  · Bounded. It scans at most `limit` (default 2000) blobs and rows per run
 *    so it stays inside one transaction; re-run until `scanComplete` is true.
 *  · `minAgeMinutes` (default 60) protects uploads still in flight — a blob
 *    created seconds ago is not an orphan, it is a form the user hasn't
 *    submitted yet.
 *  · It only knows about THIS app's references. Blobs owned by installed
 *    components (Better Auth) live in their own tables and are never touched,
 *    because `_storage` here is the app's own file store.
 */
export const sweepOrphans = internalMutation({
  args: {
    deleteUnreferenced: v.optional(v.boolean()),
    minAgeMinutes: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 2000
    const minAgeMs = (args.minAgeMinutes ?? 60) * 60_000
    const cutoff = Date.now() - minAgeMs

    const rows = await ctx.db.query("uploads").take(limit)
    const referenced = new Set<string>()
    let danglingRowsDeleted = 0
    for (const row of rows) {
      const meta = await storageMeta(ctx, row.storageId)
      if (meta) {
        referenced.add(row.storageId)
      } else {
        await ctx.db.delete(row._id)
        danglingRowsDeleted++
      }
    }

    const people = await ctx.db.query("people").take(limit)
    let danglingHeadshots = 0
    for (const person of people) {
      if (!person.headshotId) continue
      const meta = await storageMeta(ctx, person.headshotId)
      if (meta) referenced.add(person.headshotId)
      else {
        await ctx.db.patch(person._id, { headshotId: undefined })
        danglingHeadshots++
      }
    }

    const events = await ctx.db.query("events").take(limit)
    for (const event of events) {
      if (event.logoId) referenced.add(event.logoId)
      if (event.backgroundId) referenced.add(event.backgroundId)
    }

    const blobs = await ctx.db.system.query("_storage").take(limit)
    let unreferenced = 0
    let unreferencedBytes = 0
    let deleted = 0
    for (const blob of blobs) {
      if (referenced.has(blob._id)) continue
      if (blob._creationTime > cutoff) continue // still in flight
      unreferenced++
      unreferencedBytes += blob.size
      if (args.deleteUnreferenced) {
        await ctx.storage.delete(blob._id)
        deleted++
      }
    }

    return {
      scannedRows: rows.length,
      scannedBlobs: blobs.length,
      scanComplete: rows.length < limit && blobs.length < limit,
      danglingRowsDeleted,
      danglingHeadshotsCleared: danglingHeadshots,
      unreferencedBlobs: unreferenced,
      unreferencedBytes,
      unreferencedBlobsDeleted: deleted,
    }
  },
})

/**
 * Existence check for stored blobs — the only way a black-box test can prove
 * that replacing a headshot actually deleted the old bytes. Internal on
 * purpose: it takes raw storage ids and is called through `convex run`.
 */
export const blobsExist = internalQuery({
  args: { storageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const out: Record<string, boolean> = {}
    for (const id of args.storageIds) {
      const doc = await ctx.db.system.get("_storage", id as Id<"_storage">)
      out[id] = doc !== null
    }
    return out
  },
})

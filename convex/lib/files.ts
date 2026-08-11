import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { ConvexError } from "convex/values"

// ————————————————————————————————————————————————————————————————————————
// File storage layer. One place that knows how a stored blob becomes a thing
// an organizer or speaker can see, and how it stops existing.
//
// Three rules everything here exists to enforce:
//
//  1. TRUTH COMES FROM `_storage`. The browser tells us a name; the size, MIME
//     type and sha256 are read back from the `_storage` system table
//     (`ctx.db.system.get`) — never from the client. A client that lies about
//     `size` can otherwise walk straight past a 25 MB cap.
//  2. NOTHING ORPHANS. Every path that drops a reference to a blob
//     (replacing a headshot, deleting a version, deleting an event) deletes
//     the blob too, unless something else still points at it.
//  3. THE SAME BYTES ARE THE SAME FILE. sha256 is what lets us tell a speaker
//     "this is identical to v2" instead of silently keeping a third copy.
// ————————————————————————————————————————————————————————————————————————

/** Hard cap for speaker/organizer uploads. Mirrored client-side in src/lib/files.ts. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
/** Event branding is chrome, not a deliverable — keep it small enough to serve fast. */
export const MAX_BRANDING_BYTES = 8 * 1024 * 1024

/**
 * What speakers and organizers are allowed to put in an event's file store.
 * Deliberately an allowlist: images, PDFs, slide decks, documents, archives.
 * SVG is excluded on purpose — it is a script container, and these files are
 * served from a URL we hand to browsers.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/avif",
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.apple.keynote",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
])

const ALLOWED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "heic", "avif",
  "pdf", "ppt", "pptx", "odp", "key", "doc", "docx", "odt",
  "txt", "md", "csv", "zip",
])

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".")
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase()
}

export function isImageType(contentType?: string): boolean {
  return Boolean(contentType && contentType.startsWith("image/"))
}

export interface StorageMeta {
  size: number
  contentType?: string
  /**
   * Convex returns this BASE64-encoded (`+wTctpc…=`), not the base16 the docs
   * claim — verified against the live deployment in scripts/verify-backend.mjs.
   * Treat it as an opaque identity token: equal string ⇒ identical bytes.
   */
  sha256: string
  storedAt: number
}

/**
 * Real metadata for a stored blob. `null` when the id doesn't resolve — which
 * happens for an upload that never completed, or a blob something already
 * deleted (a dangling `uploads` row; `files.sweepOrphans` cleans those up).
 */
export async function storageMeta(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
): Promise<StorageMeta | null> {
  const doc = await ctx.db.system.get("_storage", storageId)
  if (!doc) return null
  return {
    size: doc.size,
    contentType: doc.contentType,
    sha256: doc.sha256,
    storedAt: doc._creationTime,
  }
}

/**
 * Gate an upload the moment it is attached — after the bytes landed, before a
 * row exists. Throws sentences an organizer or speaker can act on.
 */
export function assertAllowedUpload(
  meta: StorageMeta,
  filename: string,
  maxBytes: number = MAX_UPLOAD_BYTES,
): void {
  if (meta.size <= 0) {
    throw new ConvexError("That file is empty — please choose another one.")
  }
  if (meta.size > maxBytes) {
    throw new ConvexError(
      `That file is ${formatBytes(meta.size)}. The limit is ${formatBytes(maxBytes)} — please upload a smaller one.`,
    )
  }
  const type = (meta.contentType ?? "").toLowerCase().split(";")[0].trim()
  if (type && ALLOWED_CONTENT_TYPES.has(type)) return
  if (ALLOWED_EXTENSIONS.has(extensionOf(filename))) return
  throw new ConvexError(
    "That file type isn't accepted. Upload an image, a PDF, a slide deck, a document or a zip.",
  )
}

export function assertImageUpload(meta: StorageMeta, filename: string): void {
  assertAllowedUpload(meta, filename, MAX_BRANDING_BYTES)
  const type = (meta.contentType ?? "").toLowerCase()
  const ext = extensionOf(filename)
  const looksLikeImage =
    isImageType(type) ||
    ["png", "jpg", "jpeg", "webp", "gif", "heic", "avif"].includes(ext)
  if (!looksLikeImage) {
    throw new ConvexError("That needs to be an image — a PNG, JPG or WebP.")
  }
}

/** "2.4 MB" — the same wording the UI uses, so server errors read like the app. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

// ——— Version slots ————————————————————————————————————————————————————————
// A file lives in a "slot": a task, a submission (per person), or the person's
// loose profile files. Re-uploading into the same slot makes v2, v3, … — the
// history organizers review against, never a silent overwrite.

export interface UploadSlot {
  personId: Id<"people">
  taskId?: Id<"tasks">
  submissionId?: Id<"submissions">
}

export function slotKey(row: {
  personId: Id<"people">
  taskId?: Id<"tasks">
  submissionId?: Id<"submissions">
}): string {
  if (row.taskId) return `task:${row.taskId}`
  if (row.submissionId) return `submission:${row.submissionId}:${row.personId}`
  return `person:${row.personId}`
}

/** Every row already in a slot, oldest first. */
export async function slotUploads(
  ctx: QueryCtx | MutationCtx,
  slot: UploadSlot,
): Promise<Array<Doc<"uploads">>> {
  const rows = slot.taskId
    ? await ctx.db
        .query("uploads")
        .withIndex("by_taskId", (q) => q.eq("taskId", slot.taskId))
        .collect()
    : slot.submissionId
      ? (
          await ctx.db
            .query("uploads")
            .withIndex("by_submissionId", (q) =>
              q.eq("submissionId", slot.submissionId),
            )
            .collect()
        ).filter((u) => u.personId === slot.personId)
      : (
          await ctx.db
            .query("uploads")
            .withIndex("by_personId", (q) => q.eq("personId", slot.personId))
            .collect()
        ).filter((u) => !u.taskId && !u.submissionId)
  return rows.sort((a, b) => a.version - b.version)
}

export async function nextVersion(
  ctx: QueryCtx | MutationCtx,
  slot: UploadSlot,
): Promise<number> {
  const rows = await slotUploads(ctx, slot)
  return rows.reduce((max, row) => Math.max(max, row.version), 0) + 1
}

// ——— Read model ———————————————————————————————————————————————————————————

export interface UploadFile {
  id: Id<"uploads">
  filename: string
  /** From `_storage`, falling back to what the row recorded at upload time. */
  contentType?: string
  size?: number
  sha256?: string
  version: number
  approvalStatus: string
  reviewNote?: string
  uploadedAt: number
  url: string | null
  isImage: boolean
  /** The blob is gone — the row is dangling and `files.sweepOrphans` will drop it. */
  missing: boolean
  /** Byte-identical to this earlier version. Set when someone re-uploads the same file. */
  duplicateOfVersion: number | null
  taskId?: Id<"tasks">
  submissionId?: Id<"submissions">
  personId: Id<"people">
}

/**
 * Turn `uploads` rows into what a UI can render: real size/type/checksum, a
 * signed URL, and the "identical to v2" hint that stops organizers chasing a
 * speaker who re-sent the same deck.
 *
 * Returned in the same order as `rows`, so callers can zip in their own joins.
 */
export async function enrichUploads(
  ctx: QueryCtx | MutationCtx,
  rows: Array<Doc<"uploads">>,
): Promise<Array<UploadFile>> {
  const resolved = await Promise.all(
    rows.map(async (row) => ({
      row,
      meta: await storageMeta(ctx, row.storageId),
      url: await ctx.storage.getUrl(row.storageId),
    })),
  )

  // Earliest version carrying each checksum, per slot — the one we point at.
  const firstSeen = new Map<string, number>()
  for (const { row, meta } of [...resolved].sort(
    (a, b) => a.row.version - b.row.version,
  )) {
    if (!meta) continue
    const key = `${slotKey(row)}|${meta.sha256}`
    if (!firstSeen.has(key)) firstSeen.set(key, row.version)
  }

  return resolved.map(({ row, meta, url }) => {
    const contentType = meta?.contentType ?? row.contentType
    const original = meta ? firstSeen.get(`${slotKey(row)}|${meta.sha256}`) : undefined
    return {
      id: row._id,
      filename: row.filename,
      contentType,
      size: meta?.size ?? row.size,
      sha256: meta?.sha256,
      version: row.version,
      approvalStatus: row.approvalStatus,
      reviewNote: row.reviewNote,
      uploadedAt: row._creationTime,
      url,
      isImage: isImageType(contentType),
      missing: meta === null,
      duplicateOfVersion:
        original !== undefined && original !== row.version ? original : null,
      taskId: row.taskId,
      submissionId: row.submissionId,
      personId: row.personId,
    }
  })
}

// ——— Lifecycle ————————————————————————————————————————————————————————————

/** Rows still pointing at a blob (excluding one being deleted). */
async function referencingRows(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  exceptUploadId?: Id<"uploads">,
): Promise<Array<Doc<"uploads">>> {
  const rows = await ctx.db
    .query("uploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .collect()
  return rows.filter((row) => row._id !== exceptUploadId)
}

/**
 * Drop a blob once the last thing pointing at it is gone. Safe to call
 * speculatively — it checks `uploads` and the owning person's headshot first.
 */
export async function releaseBlob(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  options: { exceptUploadId?: Id<"uploads">; personId?: Id<"people"> } = {},
): Promise<boolean> {
  const rows = await referencingRows(ctx, storageId, options.exceptUploadId)
  if (rows.length > 0) return false
  if (options.personId) {
    const person = await ctx.db.get(options.personId)
    if (person?.headshotId === storageId) return false
  }
  await ctx.storage.delete(storageId)
  return true
}

/**
 * Point a person at a new profile photo and clean up the old one.
 *
 * The headshot is a CURRENT VALUE, not a version history: replacing it drops
 * the previous loose profile upload and its blob. A previous headshot that was
 * uploaded against a task or a submission is a reviewed deliverable, so its
 * row — and therefore its blob — survives.
 */
export async function replaceHeadshot(
  ctx: MutationCtx,
  person: Doc<"people">,
  storageId: Id<"_storage">,
): Promise<void> {
  const previous = person.headshotId
  await ctx.db.patch(person._id, { headshotId: storageId })
  if (!previous || previous === storageId) return

  const rows = await referencingRows(ctx, previous)
  for (const row of rows) {
    if (!row.taskId && !row.submissionId) await ctx.db.delete(row._id)
  }
  const remaining = await referencingRows(ctx, previous)
  if (remaining.length === 0) await ctx.storage.delete(previous)
}

/** Delete one upload row and its blob (when nothing else needs it). */
export async function deleteUploadRow(
  ctx: MutationCtx,
  row: Doc<"uploads">,
): Promise<void> {
  const person = await ctx.db.get(row.personId)
  if (person?.headshotId === row.storageId) {
    await ctx.db.patch(person._id, { headshotId: undefined })
  }
  await ctx.db.delete(row._id)
  await releaseBlob(ctx, row.storageId, { exceptUploadId: row._id })
}

/**
 * Delete every blob an event owns — its uploads, its speakers' headshots, its
 * branding. Callers delete the rows themselves; this is only the storage side,
 * so it must run BEFORE the rows go (it reads them).
 */
export async function deleteEventBlobs(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<number> {
  let deleted = 0
  const seen = new Set<string>()
  const drop = async (storageId: Id<"_storage">) => {
    if (seen.has(storageId)) return
    seen.add(storageId)
    await ctx.storage.delete(storageId)
    deleted++
  }

  const uploads = await ctx.db
    .query("uploads")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  for (const row of uploads) await drop(row.storageId)

  const people = await ctx.db
    .query("people")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  for (const person of people) {
    if (person.headshotId) await drop(person.headshotId)
  }

  const event = await ctx.db.get(eventId)
  if (event?.logoId) await drop(event.logoId)
  if (event?.backgroundId) await drop(event.backgroundId)

  return deleted
}

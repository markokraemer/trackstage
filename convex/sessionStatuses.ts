import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"

/**
 * Settings → Statuses — Sessionboard's custom session statuses
 * (docs/reference/sessionboard-product-map.md §2.2 "Custom statuses",
 * TODO.md [L1]).
 *
 * ── The one design decision to understand ────────────────────────────────
 * `submissions.status` remains the fixed pipeline enum. Queue commits,
 * decision emails, portal masking, agenda visibility and the public API all
 * key off it and are untouched by this file. A `sessionStatuses` row is a
 * LABEL bound to a pipeline value:
 *
 *     name + color   → what the organizer sees
 *     category       → the behaviour it inherits (their model exactly)
 *     pipelineStatus → the enum value written to `submissions.status`
 *
 * Picking "Waitlist" (category `pending`) writes `status: "pending"` and
 * remembers the label in `submissions.statusId`. Every rule downstream still
 * sees a pending submission; only the wording and the dot colour change.
 *
 * That is the pragmatic v1: custom labels and colours inside our five pipeline
 * categories, with zero risk to the pipeline. A future v2 could give a custom
 * status behaviour of its own — it would only need to widen the enum, because
 * the presentation layer already exists.
 */

export const STATUS_CATEGORIES = [
  "draft",
  "pending",
  "accepted",
  "declined",
  "withdrawn",
] as const
export type StatusCategory = (typeof STATUS_CATEGORIES)[number]

export const STATUS_COLORS = ["green", "amber", "red", "gray", "blue"] as const
export type StatusColor = (typeof STATUS_COLORS)[number]

const categoryValidator = v.union(
  v.literal("draft"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("withdrawn"),
)

const colorValidator = v.union(
  v.literal("green"),
  v.literal("amber"),
  v.literal("red"),
  v.literal("gray"),
  v.literal("blue"),
)

/**
 * The seven statuses every event starts with — our current pipeline, 1:1.
 * Order and colour match Sessionboard's own built-ins (Accepted 10, Accept
 * Queue 20, Pending 30, Decline Queue 40, Declined 50) with our two extra
 * pipeline states appended.
 *
 * `systemKey` is the pipeline enum value, which is also what marks a row as
 * built-in: system rows can be renamed, recoloured and reordered, never
 * deleted, never re-categorised.
 */
export const PIPELINE_STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
] as const
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]

export const DEFAULT_SESSION_STATUSES: Array<{
  systemKey: PipelineStatus
  name: string
  category: StatusCategory
  pipelineStatus: PipelineStatus
  color: StatusColor
  order: number
}> = [
  { systemKey: "accepted", name: "Accepted", category: "accepted", pipelineStatus: "accepted", color: "green", order: 10 },
  { systemKey: "accept_queue", name: "Accept Queue", category: "accepted", pipelineStatus: "accept_queue", color: "green", order: 20 },
  { systemKey: "pending", name: "Pending", category: "pending", pipelineStatus: "pending", color: "amber", order: 30 },
  { systemKey: "decline_queue", name: "Decline Queue", category: "declined", pipelineStatus: "decline_queue", color: "amber", order: 40 },
  { systemKey: "declined", name: "Declined", category: "declined", pipelineStatus: "declined", color: "red", order: 50 },
  { systemKey: "withdrawn", name: "Withdrawn", category: "withdrawn", pipelineStatus: "withdrawn", color: "gray", order: 60 },
  { systemKey: "draft", name: "Draft", category: "draft", pipelineStatus: "draft", color: "gray", order: 70 },
]

/**
 * The pipeline value a brand-new custom status writes. One per category — the
 * queue states are staging lanes the organizer moves through, not destinations
 * you would invent a new name for, so they are never the target of a custom
 * status.
 */
const CATEGORY_PIPELINE_STATUS: Record<StatusCategory, PipelineStatus> = {
  draft: "draft",
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  withdrawn: "withdrawn",
}

function sortStatuses(rows: Array<Doc<"sessionStatuses">>) {
  return [...rows].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/**
 * The event's LIVE statuses. Soft-deleted rows (see `remove`) are excluded
 * everywhere in the product — they exist only so the public API can restore
 * one, which is how Sessionboard's delete/restore pair behaves.
 */
async function listRows(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  return sortStatuses(
    (
      await ctx.db
        .query("sessionStatuses")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect()
    ).filter((row) => row.deletedAt === undefined),
  )
}

/**
 * Which row a submission actually reads as. The stored label wins only while
 * it still agrees with the pipeline status; otherwise the built-in row for
 * that status does. This is what makes a stale `statusId` (left behind by a
 * bulk change or a queue commit) harmless rather than a lie on screen.
 */
function resolveRow(
  rows: Array<Doc<"sessionStatuses">>,
  status: string,
  statusId?: Id<"sessionStatuses">,
): Doc<"sessionStatuses"> | undefined {
  if (statusId) {
    const labelled = rows.find((row) => row._id === statusId)
    if (labelled && labelled.pipelineStatus === status) return labelled
  }
  return (
    rows.find((row) => row.systemKey === status) ??
    rows.find((row) => row.pipelineStatus === status)
  )
}

/**
 * Every status for an event, each with its live submission count — the
 * `Sessions` column of their Statuses table.
 *
 * `initialized: false` means this event has never opened the screen and has no
 * rows yet. The response still carries the seven defaults (with `_id: null`)
 * so every reader — picker, table, tabs — renders correctly without a write
 * ever having happened. `ensureDefaults` materialises them on first edit.
 */
export const list = query({
  args: { eventId: v.id("events") },
  returns: v.object({
    initialized: v.boolean(),
    statuses: v.array(
      v.object({
        // `null` while the event still runs on the built-in defaults.
        _id: v.union(v.id("sessionStatuses"), v.null()),
        systemKey: v.optional(v.string()),
        name: v.string(),
        category: categoryValidator,
        pipelineStatus: v.string(),
        color: colorValidator,
        order: v.number(),
        count: v.number(),
        // Their `Created By` / `Created At` columns. `null` means the row ships
        // with the product and reads as "System".
        createdBy: v.union(v.string(), v.null()),
        createdAt: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const rows = await listRows(ctx, args.eventId)
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    const live = submissions.filter((row) => !row.deletedAt)

    if (rows.length === 0) {
      return {
        initialized: false,
        statuses: DEFAULT_SESSION_STATUSES.map((preset) => ({
          _id: null,
          ...preset,
          count: live.filter((s) => s.status === preset.pipelineStatus).length,
          createdBy: null,
          createdAt: null,
        })),
      }
    }

    const counts = new Map<string, number>()
    for (const submission of live) {
      const row = resolveRow(rows, submission.status, submission.statusId)
      if (!row) continue
      counts.set(row._id, (counts.get(row._id) ?? 0) + 1)
    }

    return {
      initialized: true,
      statuses: rows.map((row) => ({
        _id: row._id,
        systemKey: row.systemKey,
        name: row.name,
        category: row.category,
        pipelineStatus: row.pipelineStatus,
        color: row.color,
        order: row.order,
        count: counts.get(row._id) ?? 0,
        createdBy: row.createdBy ?? null,
        // Built-ins are seeded with the event, so their creation time is noise
        // — "System" is the whole answer for a row nobody added.
        createdAt: row.systemKey ? null : row._creationTime,
      })),
    }
  },
})

/** Materialise the seven built-ins. Idempotent — a no-op once rows exist. */
export const ensureDefaults = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    await ensureDefaultStatuses(ctx, args.eventId)
    return null
  },
})

/** Shared with the seed so the demo world and a real event agree exactly. */
export async function ensureDefaultStatuses(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<void> {
  const existing = await ctx.db
    .query("sessionStatuses")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .first()
  if (existing) return
  for (const preset of DEFAULT_SESSION_STATUSES) {
    await ctx.db.insert("sessionStatuses", { eventId, ...preset })
  }
}

async function assertNameFree(
  ctx: MutationCtx,
  eventId: Id<"events">,
  name: string,
  ignoreId?: Id<"sessionStatuses">,
): Promise<void> {
  const rows = await listRows(ctx, eventId)
  const clash = rows.find(
    (row) =>
      row._id !== ignoreId && row.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (clash) {
    throw new Error(`You already have a status called “${clash.name}”.`)
  }
}

export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    category: categoryValidator,
    color: colorValidator,
  },
  returns: v.id("sessionStatuses"),
  handler: async (ctx, args) => {
    const { user } = await requireEventAccess(ctx, args.eventId)
    const name = args.name.trim()
    if (!name) throw new Error("Give the status a name first.")
    if (name.length > 60) throw new Error("Status names are limited to 60 characters.")
    // Adding a custom status to an event that never opened this screen must
    // not silently orphan the built-ins.
    await ensureDefaultStatuses(ctx, args.eventId)
    await assertNameFree(ctx, args.eventId, name)
    const rows = await listRows(ctx, args.eventId)
    const order = (rows.at(-1)?.order ?? 0) + 10
    return await ctx.db.insert("sessionStatuses", {
      eventId: args.eventId,
      name,
      category: args.category,
      pipelineStatus: CATEGORY_PIPELINE_STATUS[args.category],
      color: args.color,
      order,
      createdBy: user.name || user.email,
    })
  },
})

export const update = mutation({
  args: {
    statusId: v.id("sessionStatuses"),
    patch: v.object({
      name: v.optional(v.string()),
      category: v.optional(categoryValidator),
      color: v.optional(colorValidator),
      order: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const status = await ctx.db.get(args.statusId)
    if (!status) throw new Error("Status not found.")
    await requireEventAccess(ctx, status.eventId)

    const patch: Partial<Doc<"sessionStatuses">> = {}
    if (args.patch.name !== undefined) {
      const name = args.patch.name.trim()
      if (!name) throw new Error("A status needs a name.")
      if (name.length > 60) throw new Error("Status names are limited to 60 characters.")
      await assertNameFree(ctx, status.eventId, name, status._id)
      patch.name = name
    }
    if (args.patch.color !== undefined) patch.color = args.patch.color
    if (args.patch.order !== undefined) patch.order = args.patch.order
    if (args.patch.category !== undefined && args.patch.category !== status.category) {
      if (status.systemKey) {
        // Re-categorising "Accepted" would silently rewire acceptance emails.
        throw new Error(
          "Built-in statuses keep their category — it's what the accept/decline pipeline runs on. Rename or recolour it instead.",
        )
      }
      patch.category = args.patch.category
      patch.pipelineStatus = CATEGORY_PIPELINE_STATUS[args.patch.category]
    }
    await ctx.db.patch(args.statusId, patch)
    return null
  },
})

/**
 * Deleting a status that submissions are still labelled with would silently
 * reset them to the built-in wording, so it refuses — unless the organizer
 * names where those submissions should land (`reassignToStatusId`), which is
 * the "move them to…" choice their UI offers.
 */
export const remove = mutation({
  args: {
    statusId: v.id("sessionStatuses"),
    reassignToStatusId: v.optional(v.id("sessionStatuses")),
  },
  returns: v.object({ reassigned: v.number() }),
  handler: async (ctx, args) => {
    const status = await ctx.db.get(args.statusId)
    if (!status) throw new Error("Status not found.")
    // Deleting configuration the whole event reads is an admin act.
    await requireEventAccess(ctx, status.eventId, "admin")
    if (status.systemKey) {
      throw new Error(
        `“${status.name}” is a built-in status the pipeline needs. You can rename or recolour it, but not delete it.`,
      )
    }

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", status.eventId))
      .collect()
    const labelled = submissions.filter((row) => row.statusId === status._id)
    // Only labels that still AGREE with the submission's pipeline status are
    // really in use — those are the ones the Statuses screen counts, so the
    // message below matches the number the organizer is looking at. A label
    // left behind by a queue commit is already being ignored on screen; it
    // just needs clearing, and moving it would rewrite a pipeline status the
    // organizer never asked to change.
    const inUse = labelled.filter((row) => row.status === status.pipelineStatus)
    const stale = labelled.filter((row) => row.status !== status.pipelineStatus)

    if (inUse.length > 0 && !args.reassignToStatusId) {
      throw new Error(
        `${inUse.length} submission${inUse.length === 1 ? " is" : "s are"} set to “${status.name}”. Choose a status to move ${inUse.length === 1 ? "it" : "them"} to first.`,
      )
    }

    let reassigned = 0
    if (inUse.length > 0 && args.reassignToStatusId) {
      const target = await ctx.db.get(args.reassignToStatusId)
      if (!target || target.eventId !== status.eventId) {
        throw new Error("Pick a status from this event to move them to.")
      }
      if (target._id === status._id) {
        throw new Error("Pick a different status to move them to.")
      }
      for (const submission of inUse) {
        // The pipeline value moves with the label — that is the whole point of
        // the category mapping. `status` stays the enum either way.
        await ctx.db.patch(submission._id, {
          statusId: target._id,
          status: target.pipelineStatus,
        })
        reassigned += 1
      }
    }

    // Whatever happens to the live ones, a dangling label must not outlive the
    // row it points at.
    for (const submission of stale) {
      await ctx.db.patch(submission._id, { statusId: undefined })
    }

    // Soft delete: gone from every screen and every read, but recoverable via
    // `POST /v1/event/{ref}/statuses/{id}/restore`. Nothing in the product
    // reads a soft-deleted row (see `listRows`), so this is invisible here.
    await ctx.db.patch(args.statusId, { deletedAt: Date.now() })
    return { reassigned }
  },
})

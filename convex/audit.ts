// ————————————————————————————————————————————————————————————————————————
// Audit log — read surface + the agent-side write surface (sbek CNT-11).
//
// The helper that *writes* rows lives in convex/lib/audit.ts and is called
// inline from the domain mutations, so history is written in the same
// transaction as the change it describes. This file is what reads it back —
// the submission History tab and the event-wide Activity feed — plus the two
// entry points that can't call the helper inline:
//
//   · `recordMcpToolCall` — the MCP dispatcher is an ACTION, so it schedules
//     its row through a mutation once the tool has actually succeeded.
//   · `recordApiWrite`    — same story for the REST API's action-side writes.
//
// Reading is authorized exactly like everything else: requireEventAccess for
// the event feed. There is no public write surface at all — an audit log a
// client can append to isn't an audit log.
// ————————————————————————————————————————————————————————————————————————

import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { internalMutation, query } from "./_generated/server"
import { eventAccessFor, requireEventAccess } from "./lib/auth"
import { agentLabel, record, recordWorkspace } from "./lib/audit"
import type { AuditEntity } from "./lib/audit"

/** One page of feed. 50 is what the UI shows before "Load more". */
const PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const rowValidator = v.object({
  _id: v.id("auditLog"),
  _creationTime: v.number(),
  actorType: v.string(),
  actorLabel: v.string(),
  entity: v.string(),
  entityId: v.string(),
  action: v.string(),
  summary: v.string(),
  meta: v.union(v.record(v.string(), v.any()), v.null()),
})

function shape(row: Doc<"auditLog">) {
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    actorType: row.actorType,
    actorLabel: row.actorLabel,
    entity: row.entity,
    entityId: row.entityId,
    action: row.action,
    summary: row.summary,
    meta: row.meta ?? null,
  }
}

/**
 * History for ONE record — what the submission drawer's History tab renders.
 * Indexed on (eventId, entity, entityId) so a busy event's feed never has to
 * be scanned to answer "what happened to this talk".
 */
export const forEntity = query({
  args: {
    eventId: v.id("events"),
    entity: v.string(),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(rowValidator),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const limit = Math.min(args.limit ?? PAGE_SIZE, MAX_PAGE_SIZE)
    const rows = await ctx.db
      .query("auditLog")
      .withIndex("by_eventId_and_entity_and_entityId", (q) =>
        q
          .eq("eventId", args.eventId)
          .eq("entity", args.entity)
          .eq("entityId", args.entityId),
      )
      .order("desc")
      .take(limit)
    return rows.map(shape)
  },
})

/**
 * The event-wide Activity feed.
 *
 * Two sources merged: rows scoped to this event, plus the workspace-level
 * rows (API-key lifecycle) that have no event of their own — those matter to
 * exactly the same reviewer, and hiding them would leave "who minted the key
 * that agent is using" unanswerable.
 *
 * Paginated by a `before` creation-time cursor rather than Convex's cursor
 * pagination, because merging two ordered sources needs a shared, comparable
 * key. Both reads are index-bounded, so the cost is O(page), not O(table).
 */
export const feed = query({
  args: {
    eventId: v.id("events"),
    /** submission | form | … — or "agents" for the MCP/API review lens. */
    filter: v.optional(v.string()),
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(rowValidator),
    isDone: v.boolean(),
    nextBefore: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const limit = Math.min(args.limit ?? PAGE_SIZE, MAX_PAGE_SIZE)
    const before = args.before ?? Number.MAX_SAFE_INTEGER
    // Over-read so post-filtering still fills a page in the common case.
    const fetch = Math.min(limit * 4, MAX_PAGE_SIZE * 4)

    const [eventRows, workspaceRows] = await Promise.all([
      ctx.db
        .query("auditLog")
        .withIndex("by_eventId", (q) =>
          q.eq("eventId", args.eventId).lt("_creationTime", before),
        )
        .order("desc")
        .take(fetch),
      event.organizationId
        ? ctx.db
            .query("auditLog")
            .withIndex("by_organizationId", (q) =>
              q
                .eq("organizationId", event.organizationId!)
                .lt("_creationTime", before),
            )
            .order("desc")
            .take(fetch)
        : Promise.resolve([]),
    ])

    const merged = [
      ...eventRows,
      // Only the ones with no event — anything event-scoped already came from
      // the first read, and this one spans every event in the workspace.
      ...workspaceRows.filter((row) => row.eventId === undefined),
    ]
      .sort((a, b) => b._creationTime - a._creationTime)
      .filter((row) => matchesFilter(row, args.filter))

    const page = merged.slice(0, limit)
    const isDone = merged.length <= limit && eventRows.length < fetch
    return {
      rows: page.map(shape),
      isDone,
      nextBefore: page.length > 0 ? page[page.length - 1]._creationTime : null,
    }
  },
})

function matchesFilter(row: Doc<"auditLog">, filter: string | undefined): boolean {
  if (!filter || filter === "all") return true
  // The review lens Marko asked for: everything a robot did, in one place.
  if (filter === "agents") return row.actorType === "mcp" || row.actorType === "api"
  return row.entity === filter
}

// ——— Agent-side writes ————————————————————————————————————————————————————

/**
 * One row per successful MCP write tool call (convex/mcp.ts dispatcher).
 *
 * Emitted at the DISPATCHER rather than inside each tool's mutation on
 * purpose: the MCP tools carry their own copies of the domain logic, so one
 * call site here covers every write tool — including the ones added later —
 * and can't double-log against the in-app path.
 *
 * `event` accepts an id or a slug, exactly like the tools do; when it can't
 * be resolved (create_event, delete_event) we fall back to whatever id the
 * tool's own receipt carried, and give up silently rather than throw — a
 * logging failure must never turn a successful tool call into an error.
 */
export const recordMcpToolCall = internalMutation({
  args: {
    userId: v.string(),
    tool: v.string(),
    keyPrefix: v.optional(v.string()),
    eventRef: v.optional(v.string()),
    entity: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    meta: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const eventId = await resolveEventRef(ctx, args.userId, args.eventRef)
    const actor = {
      type: "mcp" as const,
      label: agentLabel("MCP", args.tool, args.keyPrefix ?? null),
    }
    if (!eventId) return null
    await record(ctx, {
      eventId,
      entity: args.entity as AuditEntity,
      entityId: args.entityId ?? eventId,
      action: args.tool,
      summary: args.summary,
      meta: args.meta,
      actor,
    })
    return null
  },
})

/**
 * One row per REST API write (convex/apiV1.ts). Same contract as the MCP one
 * — a tiny, additive call the API layer makes after a write has committed.
 */
export const recordApiWrite = internalMutation({
  args: {
    eventId: v.id("events"),
    method: v.string(), // e.g. "POST /v1/event/{id}/sessions"
    credentialPrefix: v.optional(v.string()),
    entity: v.string(),
    entityId: v.string(),
    action: v.string(),
    summary: v.string(),
    meta: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await record(ctx, {
      eventId: args.eventId,
      entity: args.entity as AuditEntity,
      entityId: args.entityId,
      action: args.action,
      summary: args.summary,
      meta: args.meta,
      actor: {
        type: "api",
        label: agentLabel("API", args.method, args.credentialPrefix ?? null),
      },
    })
    return null
  },
})

/**
 * Convenience for callers that already hold a MutationCtx and an org id —
 * currently the API-key lifecycle in convex/apiKeys.ts.
 */
export async function recordKeyEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  input: { entityId: string; action: string; summary: string; meta?: Record<string, unknown> },
): Promise<void> {
  await recordWorkspace(ctx, {
    organizationId,
    entity: "api-key",
    ...input,
  })
}

/**
 * Event id from an id-or-slug reference, authorized for the acting user.
 * Returns null (rather than throwing) whenever we can't be sure — the caller
 * is a logging path.
 */
async function resolveEventRef(
  ctx: MutationCtx,
  userId: string,
  ref: string | undefined,
): Promise<Id<"events"> | null> {
  if (!ref) return null
  try {
    const direct = ctx.db.normalizeId("events", ref)
    if (direct) {
      await eventAccessFor(ctx, userId, direct)
      return direct
    }
    const bySlug = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", ref))
      .unique()
    if (!bySlug) return null
    await eventAccessFor(ctx, userId, bySlug._id)
    return bySlug._id
  } catch {
    return null
  }
}

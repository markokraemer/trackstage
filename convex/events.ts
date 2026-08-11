import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import {
  memberCanSeeEvent,
  myMemberships,
  requireEventAccess,
  requireMembership,
} from "./lib/auth"
import { record as recordAudit } from "./lib/audit"
import { deleteEventBlobs } from "./lib/files"
import { uniqueEventSlug } from "./lib/publicLinks"

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Events across every organization the signed-in user belongs to — minus
    // any this membership is scoped out of (docs/memory/RULES.md 23). This
    // query feeds the shell's event switcher, so a scoped member simply never
    // sees the events they weren't given.
    const memberships = await myMemberships(ctx)
    const rows = []
    for (const membership of memberships) {
      const organization = await ctx.db.get(membership.organizationId)
      const events = await ctx.db
        .query("events")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", membership.organizationId),
        )
        .collect()
      for (const event of events) {
        if (!memberCanSeeEvent(membership, event._id)) continue
        rows.push({
          ...event,
          organizationName: organization?.name ?? "",
          // The shell's event switcher shows the event's own logo on its tile
          // when branding is set (convex/files.setEventBranding), so the
          // Trackstage logomark is never repeated inside the app chrome.
          logoUrl: event.logoId ? await ctx.storage.getUrl(event.logoId) : null,
        })
      }
    }
    return rows
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    // Public: only safe display fields.
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!event) return null
    const { name, slug, description, venue, timezone, startsAt, endsAt, type } =
      event
    return {
      _id: event._id,
      name,
      slug,
      description,
      venue,
      timezone,
      startsAt,
      endsAt,
      type,
      // Event branding for the public header (convex/files.setEventBranding).
      logoUrl: event.logoId ? await ctx.storage.getUrl(event.logoId) : null,
      backgroundUrl: event.backgroundId
        ? await ctx.storage.getUrl(event.backgroundId)
        : null,
    }
  },
})

export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    return event
  },
})

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    type: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    venue: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId, "admin")
    // `/e/:eventSlug` is one segment, so event slugs stay globally unique —
    // but a taken address must NEVER block someone from creating their event.
    // We suffix with a short readable id and hand the real slug back so the UI
    // can say "that address was taken — yours is …"
    // (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical").
    const slug = await uniqueEventSlug(ctx, args.slug)
    const eventId = await ctx.db.insert("events", { ...args, slug })
    return { eventId, slug, slugAdjusted: slug !== args.slug.trim().toLowerCase() }
  },
})

export const update = mutation({
  args: {
    eventId: v.id("events"),
    patch: v.object({
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      timezone: v.optional(v.string()),
      type: v.optional(v.string()),
      websiteUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      venue: v.optional(v.string()),
      startsAt: v.optional(v.number()),
      endsAt: v.optional(v.number()),
      // Speaker-portal behaviour (schema `events.portalSettings`). Sent as a
      // whole object — `ctx.db.patch` replaces the field, so the settings card
      // always submits all three flags together.
      portalSettings: v.optional(
        v.object({
          alwaysShowTasks: v.optional(v.boolean()),
          allowSubmissionEdits: v.optional(v.boolean()),
          extendTaskDeadlines: v.optional(v.boolean()),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId, "admin")

    // Renaming the public address must never fail on a collision either — the
    // organizer gets the nearest free address and is told what it became.
    let slug: string | undefined
    if (args.patch.slug !== undefined) {
      const desired = args.patch.slug.trim().toLowerCase()
      slug =
        desired === event.slug
          ? event.slug
          : await uniqueEventSlug(ctx, desired, args.eventId)
    }
    const slugAdjusted =
      slug !== undefined && slug !== args.patch.slug!.trim().toLowerCase()

    await ctx.db.patch(args.eventId, {
      ...args.patch,
      ...(slug !== undefined ? { slug } : {}),
    })
    const changed = Object.keys(args.patch)
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "settings",
      entityId: args.eventId,
      action: "updated",
      summary:
        slug !== undefined && slug !== event.slug
          ? `Public address changed to /e/${slug} · ${args.patch.name ?? event.name}`
          : `Event settings updated (${changed.join(", ")}) · ${args.patch.name ?? event.name}`,
      meta: {
        fields: changed,
        ...(slug !== undefined && slug !== event.slug
          ? { slug, previousSlug: event.slug }
          : {}),
      },
    })
    // The address that is actually live now (see `create`).
    return { slug: slug ?? event.slug, slugAdjusted }
  },
})

/**
 * The cascade itself, with NO authorization of its own — every caller must have
 * already proved the caller may delete this event. It lives outside `remove` so
 * the MCP `delete_event` tool (convex/mcp.ts, which authorizes against a
 * Better Auth user id rather than `ctx.auth`) deletes through the exact same
 * path instead of maintaining a second, drifting copy of the table list.
 */
export async function deleteEventCascade(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<void> {
  // Storage first — it reads the rows that are about to be deleted. Without
  // this, every uploaded deck, headshot and logo would outlive its event as
  // an unreachable blob nobody can ever find again.
  await deleteEventBlobs(ctx, eventId)
  const byEventId = [
    "rooms",
    "tracks",
    "sessionStatuses",
    "forms",
    "people",
    "submissions",
    "submissionParticipants",
    "evaluationPlans",
    "evaluators",
    "tasks",
    "uploads",
    "emailTemplates",
    "messages",
    "embeds",
    // Integration + history rows: they are event-scoped bookkeeping and must
    // not outlive the event they describe.
    "airtableConnections",
    "airtableRecordSync",
    "auditLog",
  ] as const
  for (const table of byEventId) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .collect()
    for (const row of rows) {
      if (table === "evaluationPlans") {
        const evals = await ctx.db
          .query("evaluations")
          .withIndex("by_planId", (q) => q.eq("planId", row._id as never))
          .collect()
        for (const e of evals) await ctx.db.delete(e._id)
      }
      await ctx.db.delete(row._id)
    }
  }
  await ctx.db.delete(eventId)
}

// Delete an event and every row that belongs to it. Admin-only and
// deliberately explicit — the UI must confirm with the event name.
export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    await deleteEventCascade(ctx, args.eventId)
    return null
  },
})

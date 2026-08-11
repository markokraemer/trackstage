import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { myMemberships, requireEventAccess, requireMembership } from "./lib/auth"
import { deleteEventBlobs } from "./lib/files"

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Events across every organization the signed-in user belongs to.
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
        rows.push({ ...event, organizationName: organization?.name ?? "" })
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
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (existing) {
      throw new Error(`An event with the slug "${args.slug}" already exists.`)
    }
    return await ctx.db.insert("events", args)
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
    }),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    await ctx.db.patch(args.eventId, args.patch)
    return null
  },
})

// Delete an event and every row that belongs to it. Admin-only and
// deliberately explicit — the UI must confirm with the event name.
export const remove = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    // Storage first — it reads the rows that are about to be deleted. Without
    // this, every uploaded deck, headshot and logo would outlive its event as
    // an unreachable blob nobody can ever find again.
    await deleteEventBlobs(ctx, args.eventId)
    const byEventId = [
      "rooms",
      "tracks",
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
    ] as const
    for (const table of byEventId) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
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
    await ctx.db.delete(args.eventId)
    return null
  },
})

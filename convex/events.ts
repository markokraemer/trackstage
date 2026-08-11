import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireOrganizer } from "./lib/auth"

export const list = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, args.sessionToken)
    return await ctx.db.query("events").collect()
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
    return { _id: event._id, name, slug, description, venue, timezone, startsAt, endsAt, type }
  },
})

export const get = query({
  args: { sessionToken: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, args.sessionToken)
    return await ctx.db.get(args.eventId)
  },
})

export const create = mutation({
  args: {
    sessionToken: v.string(),
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
    await requireOrganizer(ctx, args.sessionToken)
    const { sessionToken: _sessionToken, ...fields } = args
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", fields.slug))
      .unique()
    if (existing) {
      throw new Error(`An event with the slug "${fields.slug}" already exists.`)
    }
    return await ctx.db.insert("events", fields)
  },
})

export const update = mutation({
  args: {
    sessionToken: v.string(),
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
    await requireOrganizer(ctx, args.sessionToken)
    await ctx.db.patch(args.eventId, args.patch)
    return null
  },
})

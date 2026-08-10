import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").collect()
  },
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    timezone: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    venue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const [rooms, tracks] = await Promise.all([
      ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ])
    return {
      rooms: rooms.sort((a, b) => a.order - b.order),
      tracks: tracks.sort((a, b) => a.order - b.order),
    }
  },
})

export const addRoom = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return await ctx.db.insert("rooms", {
      eventId: args.eventId,
      name: args.name,
      capacity: args.capacity,
      order: existing.length,
    })
  },
})

export const updateRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    patch: v.object({
      name: v.optional(v.string()),
      capacity: v.optional(v.number()),
      order: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Room not found.")
    await requireEventAccess(ctx, room.eventId)
    await ctx.db.patch(args.roomId, args.patch)
    return null
  },
})

export const deleteRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Room not found.")
    await requireEventAccess(ctx, room.eventId, "admin")
    const scheduled = await ctx.db
      .query("submissions")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first()
    if (scheduled) {
      throw new Error(
        "This room has scheduled sessions. Move them to another room first.",
      )
    }
    await ctx.db.delete(args.roomId)
    return null
  },
})

export const addTrack = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    return await ctx.db.insert("tracks", {
      eventId: args.eventId,
      name: args.name,
      color: args.color,
      order: existing.length,
    })
  },
})

export const updateTrack = mutation({
  args: {
    trackId: v.id("tracks"),
    patch: v.object({
      name: v.optional(v.string()),
      color: v.optional(v.string()),
      order: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found.")
    await requireEventAccess(ctx, track.eventId)
    await ctx.db.patch(args.trackId, args.patch)
    return null
  },
})

export const deleteTrack = mutation({
  args: { trackId: v.id("tracks") },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId)
    if (!track) throw new Error("Track not found.")
    await requireEventAccess(ctx, track.eventId, "admin")
    await ctx.db.delete(args.trackId)
    return null
  },
})

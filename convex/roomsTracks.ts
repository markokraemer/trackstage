import { ConvexError, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { eventTrackNames, syncTrackOptions } from "./lib/formQuestions"

/**
 * Editing the track list edits every CFP form that routes on it. The track
 * question's options ARE this list (convex/lib/formQuestions.ts) — reads
 * re-derive them anyway, but writing through keeps the stored copy honest for
 * the REST API, the MCP server and anything else reading a form document
 * directly. Called after the track table changes, never before.
 */
async function syncFormsToTracks(ctx: MutationCtx, eventId: Id<"events">) {
  const trackNames = await eventTrackNames(ctx, eventId)
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  for (const form of forms) {
    if (!form.questions.some((question) => question.isTrackQuestion)) continue
    const questions = syncTrackOptions(form.questions, trackNames)
    const unchanged = questions.every(
      (question, index) =>
        JSON.stringify(question.options ?? []) ===
        JSON.stringify(form.questions[index].options ?? []),
    )
    if (unchanged) continue
    await ctx.db.patch(form._id, { questions })
  }
}

/** Carry a track rename into the answers submitters already gave. */
async function renameTrackAnswers(
  ctx: MutationCtx,
  eventId: Id<"events">,
  from: string,
  to: string,
) {
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  const questionIds = new Set(
    forms.flatMap((form) =>
      form.questions
        .filter((question) => question.isTrackQuestion)
        .map((question) => question.id),
    ),
  )
  if (questionIds.size === 0) return
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  for (const submission of submissions) {
    const answers = submission.answers
    let touched = false
    const next = { ...answers }
    for (const questionId of questionIds) {
      if (next[questionId] === from) {
        next[questionId] = to
        touched = true
      }
    }
    if (touched) await ctx.db.patch(submission._id, { answers: next })
  }
}

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
    if (!room) throw new ConvexError("Room not found.")
    await requireEventAccess(ctx, room.eventId)
    await ctx.db.patch(args.roomId, args.patch)
    return null
  },
})

export const deleteRoom = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new ConvexError("Room not found.")
    await requireEventAccess(ctx, room.eventId, "admin")
    const scheduled = await ctx.db
      .query("submissions")
      .withIndex("by_roomId", (q) => q.eq("roomId", args.roomId))
      .first()
    if (scheduled) {
      throw new ConvexError(
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
    const trackId = await ctx.db.insert("tracks", {
      eventId: args.eventId,
      name: args.name,
      color: args.color,
      order: existing.length,
    })
    // The new track is offered on the CFP from this second on — no second trip
    // to the form builder, which is what "sync to my tracks" has to mean.
    await syncFormsToTracks(ctx, args.eventId)
    return trackId
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
    if (!track) throw new ConvexError("Track not found.")
    await requireEventAccess(ctx, track.eventId)
    await ctx.db.patch(args.trackId, args.patch)
    const renamedTo =
      args.patch.name && args.patch.name !== track.name
        ? args.patch.name
        : undefined
    await syncFormsToTracks(ctx, track.eventId)
    // A rename carries the answers already given with it (the same cascade
    // `valueLists.rename` does for Format/Level/Language): a submission whose
    // stored answer still said the old name would read as an answer the form no
    // longer offers, and would stop routing on the next edit.
    if (renamedTo) await renameTrackAnswers(ctx, track.eventId, track.name, renamedTo)
    return null
  },
})

export const deleteTrack = mutation({
  args: { trackId: v.id("tracks") },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId)
    if (!track) throw new ConvexError("Track not found.")
    await requireEventAccess(ctx, track.eventId, "admin")
    await ctx.db.delete(args.trackId)
    await syncFormsToTracks(ctx, track.eventId)
    return null
  },
})

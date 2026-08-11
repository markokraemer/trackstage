// Saved embed configurations (sbek EMB-15).
//
// An embed here is NOT a published artefact with a cache to wait on — every
// public page already renders bare with `?embed=1`, so the snippet is just a
// URL. What organizers still need is a place to name a configuration ("Agenda
// for the sponsors page"), come back to it next week, and hand the identical
// code to a colleague. That's all this table is: named, reusable configuration.

import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"

/** Widget ids must match `WIDGET_TYPES` in src/routes/app/embeds/index.tsx. */
export const EMBED_WIDGETS = [
  "agenda",
  "itinerary",
  "sessions",
  "speaker-gallery",
  "speaker-list",
] as const

/** Delivery formats offered by the generator. */
export const EMBED_FORMATS = ["iframe", "html", "link", "json", "ics"] as const

const optionsValidator = v.object({
  format: v.optional(v.string()),
  hideDescriptions: v.optional(v.boolean()),
  hideSpeakers: v.optional(v.boolean()),
  hideImages: v.optional(v.boolean()),
  hideSearch: v.optional(v.boolean()),
  track: v.optional(v.string()),
  height: v.optional(v.number()),
})

const embedRowValidator = v.object({
  _id: v.id("embeds"),
  _creationTime: v.number(),
  eventId: v.id("events"),
  name: v.string(),
  widget: v.string(),
  options: optionsValidator,
})

function validWidget(widget: string): string {
  if (!(EMBED_WIDGETS as ReadonlyArray<string>).includes(widget)) {
    throw new Error(`Unknown widget "${widget}".`)
  }
  return widget
}

function validFormat(format: string | undefined): string | undefined {
  if (format === undefined) return undefined
  if (!(EMBED_FORMATS as ReadonlyArray<string>).includes(format)) {
    throw new Error(`Unknown embed format "${format}".`)
  }
  return format
}

export const list = query({
  args: { eventId: v.id("events") },
  returns: v.array(embedRowValidator),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const rows = await ctx.db
      .query("embeds")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(200)
    return rows.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const save = mutation({
  args: {
    eventId: v.id("events"),
    /** Present ⇒ overwrite that saved embed instead of creating a new one. */
    embedId: v.optional(v.id("embeds")),
    name: v.string(),
    widget: v.string(),
    options: optionsValidator,
  },
  returns: v.id("embeds"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const name = args.name.trim()
    if (!name) throw new Error("Give this embed a name.")
    const widget = validWidget(args.widget)
    const options = { ...args.options, format: validFormat(args.options.format) }

    if (args.embedId) {
      const existing = await ctx.db.get("embeds", args.embedId)
      if (!existing || existing.eventId !== args.eventId) {
        throw new Error("That saved embed belongs to a different event.")
      }
      await ctx.db.patch(args.embedId, { name, widget, options })
      return args.embedId
    }
    return await ctx.db.insert("embeds", {
      eventId: args.eventId,
      name,
      widget,
      options,
    })
  },
})

export const remove = mutation({
  args: { embedId: v.id("embeds") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const embed = await ctx.db.get("embeds", args.embedId)
    if (!embed) throw new Error("Saved embed not found.")
    await requireEventAccess(ctx, embed.eventId)
    await ctx.db.delete(args.embedId)
    return null
  },
})

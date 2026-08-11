// Saved embed configurations (sbek EMB-15).
//
// An embed here is NOT a published artefact with a cache to wait on — every
// public page already renders bare with `?embed=1`, so the snippet is just a
// URL. What organizers still need is a place to name a configuration ("Agenda
// for the sponsors page"), come back to it next week, and hand the identical
// code to a colleague. That's all this table is: named, reusable configuration.
//
// One thing a saved row buys beyond convenience: an OFF SWITCH. A saved
// embed's snippet carries `?e={id}`, so the public page can ask this table
// whether that embed is still live and answer "this embed is turned off"
// instead of the programme. A snippet built without saving has no id and is
// simply a link, as it always was.

import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"

/** Widget ids must match `WIDGET_TYPES` in src/components/embeds/embed-config.ts. */
export const EMBED_WIDGETS = [
  "agenda",
  "itinerary",
  "sessions",
  "speaker-gallery",
  "speaker-list",
] as const

/** Delivery formats offered by the generator. */
export const EMBED_FORMATS = [
  "iframe",
  "html",
  "link",
  "json",
  "xml",
  "ics",
] as const

/** `#RRGGBB` — the only colour shape we hand to a stylesheet. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const optionsValidator = v.object({
  format: v.optional(v.string()),
  hideDescriptions: v.optional(v.boolean()),
  hideSpeakers: v.optional(v.boolean()),
  hideImages: v.optional(v.boolean()),
  hideSearch: v.optional(v.boolean()),
  /** One track name, or several comma-separated. */
  track: v.optional(v.string()),
  height: v.optional(v.number()),
  accent: v.optional(v.string()),
  showHeader: v.optional(v.boolean()),
})

const embedRowValidator = v.object({
  _id: v.id("embeds"),
  _creationTime: v.number(),
  eventId: v.id("events"),
  name: v.string(),
  widget: v.string(),
  enabled: v.optional(v.boolean()),
  options: optionsValidator,
})

function validWidget(widget: string): string {
  if (!(EMBED_WIDGETS as ReadonlyArray<string>).includes(widget)) {
    throw new ConvexError(`Unknown widget "${widget}".`)
  }
  return widget
}

function validFormat(format: string | undefined): string | undefined {
  if (format === undefined) return undefined
  if (!(EMBED_FORMATS as ReadonlyArray<string>).includes(format)) {
    throw new ConvexError(`Unknown embed format "${format}".`)
  }
  return format
}

/**
 * The accent colour ends up in a stylesheet on a public page, so only a plain
 * six-digit hex is ever stored — nothing that could carry a second declaration
 * with it.
 */
function validAccent(accent: string | undefined): string | undefined {
  if (accent === undefined) return undefined
  const trimmed = accent.trim()
  if (trimmed === "") return undefined
  if (!HEX_COLOR.test(trimmed)) {
    throw new ConvexError(
      "Give the accent colour as a hex code like #0F6E70.",
    )
  }
  return trimmed.toUpperCase()
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

/**
 * What a PUBLIC widget page needs to know about the embed it was opened as.
 *
 * Deliberately anonymous and deliberately tiny: an embed id travels in every
 * copy of the snippet, so this answers only "is it on, and what colour" and
 * never the embed's name or its event. An id we don't recognise reads as ON —
 * a hand-written URL, or a snippet whose saved row was deleted, keeps working
 * as the plain link it always was rather than dying with a scary message.
 */
export const publicState = query({
  args: { embedId: v.string() },
  returns: v.object({
    enabled: v.boolean(),
    accent: v.union(v.string(), v.null()),
    showHeader: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("embeds", args.embedId)
    const embed = id ? await ctx.db.get("embeds", id) : null
    if (!embed) return { enabled: true, accent: null, showHeader: false }
    return {
      enabled: embed.enabled !== false,
      accent: embed.options.accent ?? null,
      showHeader: embed.options.showHeader === true,
    }
  },
})

export const save = mutation({
  args: {
    eventId: v.id("events"),
    /** Present ⇒ overwrite that saved embed instead of creating a new one. */
    embedId: v.optional(v.id("embeds")),
    name: v.string(),
    widget: v.string(),
    /** Absent on create ⇒ live. */
    enabled: v.optional(v.boolean()),
    options: optionsValidator,
  },
  returns: v.id("embeds"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const name = args.name.trim()
    if (!name) throw new ConvexError("Give this embed a name.")
    const widget = validWidget(args.widget)
    const options = {
      ...args.options,
      format: validFormat(args.options.format),
      accent: validAccent(args.options.accent),
    }

    if (args.embedId) {
      const existing = await ctx.db.get("embeds", args.embedId)
      if (!existing || existing.eventId !== args.eventId) {
        throw new ConvexError("That saved embed belongs to a different event.")
      }
      await ctx.db.patch(args.embedId, {
        name,
        widget,
        options,
        // Saving a configuration never silently flips the switch: an omitted
        // `enabled` keeps whatever the row already had.
        enabled: args.enabled ?? existing.enabled ?? true,
      })
      return args.embedId
    }
    return await ctx.db.insert("embeds", {
      eventId: args.eventId,
      name,
      widget,
      options,
      enabled: args.enabled ?? true,
    })
  },
})

/** The off switch, on its own — the toggle in the saved-embeds list. */
export const setEnabled = mutation({
  args: { embedId: v.id("embeds"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const embed = await ctx.db.get("embeds", args.embedId)
    if (!embed) throw new ConvexError("Saved embed not found.")
    await requireEventAccess(ctx, embed.eventId)
    await ctx.db.patch(args.embedId, { enabled: args.enabled })
    return null
  },
})

export const remove = mutation({
  args: { embedId: v.id("embeds") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const embed = await ctx.db.get("embeds", args.embedId)
    if (!embed) throw new ConvexError("Saved embed not found.")
    await requireEventAccess(ctx, embed.eventId)
    await ctx.db.delete(args.embedId)
    return null
  },
})

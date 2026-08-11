import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { record as recordAudit } from "./lib/audit"

// ————————————————————————————————————————————————————————————————————————
// Shared value lists — Format, Level, Language, Tags.
//
// These have no table of their own, and deliberately so: a value list IS the
// option set on the corresponding CFP form question (docs/reference/
// api-parity.md, "Value lists"). The REST API models them exactly this way
// (`POST /v1/event/{ref}/formats/create` edits the `format` question), and so
// does this module — one source of truth, so the form builder, the public
// submission form, the organizer's dropdowns and the API can never drift.
//
// Everything here operates across EVERY form on the event: an organizer who
// adds "Panel" means "this event runs panels", not "this one form offers
// panels".
// ————————————————————————————————————————————————————————————————————————

/** list key → the form-question id that owns its options. */
export const VALUE_LIST_QUESTION = {
  format: "format",
  level: "level",
  language: "language",
  tags: "tags",
} as const

export type ValueListKey = keyof typeof VALUE_LIST_QUESTION

const listKeyArg = v.union(
  v.literal("format"),
  v.literal("level"),
  v.literal("language"),
  v.literal("tags"),
)

const LIST_META: Record<
  ValueListKey,
  { label: string; singular: string; help: string }
> = {
  format: {
    label: "Formats",
    singular: "format",
    help: "How a session runs — a talk, a workshop, a panel.",
  },
  level: {
    label: "Levels",
    singular: "level",
    help: "How much the audience needs to know already.",
  },
  language: {
    label: "Languages",
    singular: "language",
    help: "The language a session is delivered in.",
  },
  tags: {
    label: "Tags",
    singular: "tag",
    help: "Free-form labels for grouping sessions. Sessions can carry several.",
  },
}

function usageOf(submission: Doc<"submissions">, key: ValueListKey): Array<string> {
  if (key === "tags") return submission.tags
  const value = submission[key]
  return value ? [value] : []
}

/**
 * Every list with its options and, per option, how many live sessions use it —
 * the number that makes "can I safely remove this?" answerable without
 * guessing. Options in use but no longer offered are included and flagged, so
 * the organizer can see (and fix) the drift rather than being blind to it.
 */
export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const [forms, submissions] = await Promise.all([
      ctx.db
        .query("forms")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect(),
    ])
    const live = submissions.filter((s) => s.deletedAt === undefined)

    return (Object.keys(VALUE_LIST_QUESTION) as Array<ValueListKey>).map((key) => {
      const questionId = VALUE_LIST_QUESTION[key]
      const offered: Array<string> = []
      for (const form of forms) {
        const question = form.questions.find((q) => q.id === questionId)
        for (const option of question?.options ?? []) {
          if (!offered.includes(option)) offered.push(option)
        }
      }
      const counts = new Map<string, number>()
      for (const submission of live) {
        for (const value of usageOf(submission, key)) {
          counts.set(value, (counts.get(value) ?? 0) + 1)
        }
      }
      const orphans = [...counts.keys()]
        .filter((value) => !offered.includes(value))
        .sort((a, b) => a.localeCompare(b))

      return {
        key,
        ...LIST_META[key],
        // Which forms actually carry this question — an organizer who deleted
        // it from the builder should be told rather than shown an inert list.
        formCount: forms.filter((form) =>
          form.questions.some((q) => q.id === questionId),
        ).length,
        options: [
          ...offered.map((name) => ({ name, usage: counts.get(name) ?? 0, offered: true })),
          ...orphans.map((name) => ({ name, usage: counts.get(name) ?? 0, offered: false })),
        ],
      }
    })
  },
})

/** Rewrites the option array on one question across every form on the event. */
async function editOptions(
  ctx: MutationCtx,
  eventId: Id<"events">,
  key: ValueListKey,
  edit: (options: Array<string>) => Array<string> | null,
): Promise<number> {
  const questionId = VALUE_LIST_QUESTION[key]
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect()
  let touched = 0
  for (const form of forms) {
    const index = form.questions.findIndex((q) => q.id === questionId)
    if (index === -1) continue
    const question = form.questions[index]
    const next = edit([...(question.options ?? [])])
    if (next === null) continue
    const questions = [...form.questions]
    questions[index] = { ...question, options: next }
    await ctx.db.patch(form._id, { questions })
    touched++
  }
  return touched
}

function clean(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new ConvexError("Enter a name.")
  if (trimmed.length > 60) throw new ConvexError("Keep it under 60 characters.")
  return trimmed
}

async function auditList(
  ctx: MutationCtx,
  eventId: Id<"events">,
  key: ValueListKey,
  action: string,
  summary: string,
  meta: Record<string, unknown>,
) {
  await recordAudit(ctx, {
    eventId,
    entity: "settings",
    entityId: eventId,
    action,
    summary,
    meta: { list: key, ...meta },
  })
}

export const add = mutation({
  args: { eventId: v.id("events"), key: listKeyArg, name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    const name = clean(args.name)
    const clashes: Array<boolean> = []
    const touched = await editOptions(ctx, args.eventId, args.key, (options) => {
      if (options.some((option) => option.toLowerCase() === name.toLowerCase())) {
        clashes.push(true)
        return null
      }
      return [...options, name]
    })
    if (clashes.length > 0) throw new ConvexError(`“${name}” is already on this list.`)
    if (touched === 0) {
      throw new ConvexError(
        `No form on this event asks for a ${LIST_META[args.key].singular}. Add that question in the form builder first.`,
      )
    }
    await auditList(
      ctx,
      args.eventId,
      args.key,
      "updated",
      `Added “${name}” to ${LIST_META[args.key].label.toLowerCase()}`,
      { name, formsUpdated: touched },
    )
    return null
  },
})

/**
 * Renaming cascades onto the sessions already using the old value. Anything
 * else would leave a session pointing at a value the form no longer offers,
 * which then reappears in every list as an orphan — a rename that creates work
 * is not a rename.
 */
export const rename = mutation({
  args: {
    eventId: v.id("events"),
    key: listKeyArg,
    from: v.string(),
    to: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    const to = clean(args.to)
    const from = args.from
    if (to === from) return null

    await editOptions(ctx, args.eventId, args.key, (options) => {
      const at = options.indexOf(from)
      if (at === -1) return null
      if (options.includes(to)) options.splice(at, 1)
      else options[at] = to
      return options
    })

    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    let moved = 0
    for (const submission of submissions) {
      if (args.key === "tags") {
        if (!submission.tags.includes(from)) continue
        const tags = submission.tags.map((tag) => (tag === from ? to : tag))
        await ctx.db.patch(submission._id, {
          tags: [...new Set(tags)],
        })
      } else {
        if (submission[args.key] !== from) continue
        await ctx.db.patch(submission._id, { [args.key]: to })
      }
      moved++
    }

    await auditList(
      ctx,
      args.eventId,
      args.key,
      "updated",
      `Renamed “${from}” to “${to}” in ${LIST_META[args.key].label.toLowerCase()}`,
      { from, to, sessionsUpdated: moved },
    )
    return null
  },
})

/**
 * Removing takes the option off the form. Sessions already using it keep the
 * value (deleting an organizer's data because a dropdown changed would be
 * indefensible) — the list surfaces it as "no longer offered" until they are
 * moved, and `usage` on the list query is what warns before the click.
 */
export const remove = mutation({
  args: { eventId: v.id("events"), key: listKeyArg, name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    const touched = await editOptions(ctx, args.eventId, args.key, (options) => {
      const at = options.indexOf(args.name)
      if (at === -1) return null
      options.splice(at, 1)
      return options
    })
    if (touched === 0) throw new ConvexError(`“${args.name}” is not on this list.`)
    await auditList(
      ctx,
      args.eventId,
      args.key,
      "updated",
      `Removed “${args.name}” from ${LIST_META[args.key].label.toLowerCase()}`,
      { name: args.name, formsUpdated: touched },
    )
    return null
  },
})

/** Options only — what the submission drawer's dropdowns render. */
export const options = query({
  args: { eventId: v.id("events") },
  handler: async (ctx: QueryCtx, args: { eventId: Id<"events"> }) => {
    await requireEventAccess(ctx, args.eventId)
    const forms = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()
    const pick = (key: ValueListKey) => {
      const questionId = VALUE_LIST_QUESTION[key]
      const values: Array<string> = []
      for (const form of forms) {
        const question = form.questions.find((q) => q.id === questionId)
        for (const option of question?.options ?? []) {
          if (!values.includes(option)) values.push(option)
        }
      }
      return values
    }
    return {
      format: pick("format"),
      level: pick("level"),
      language: pick("language"),
      tags: pick("tags"),
    }
  },
})

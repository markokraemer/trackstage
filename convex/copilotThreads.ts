import { ConvexError, v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { eventAccessFor, requireUser } from "./lib/auth"

// ————————————————————————————————————————————————————————————————————————
// Copilot conversation history (docs/memory/RULES.md 24).
//
// A chat the organizer had yesterday is work product — the accept queue they
// reasoned through, the agenda conflict the copilot found — and losing it on
// reload made the copilot feel like a toy. So every conversation is a row
// here, autosaved as it streams, listed in the rail on /app/copilot.
//
// THREE RULES THIS FILE EXISTS TO ENFORCE:
//
// 1. A thread belongs to exactly ONE user. Every function starts at
//    `requireUser` and refuses anything the caller doesn't own — with "chat
//    not found", never "not yours", because whether someone else's chat exists
//    is not the caller's business.
// 2. A document can never outgrow Convex's 1 MB limit. `trimForStorage` is run
//    on EVERY write, not as a cleanup job, so the invariant holds by
//    construction rather than by hope.
// 3. Listing is cheap. `list` never ships transcripts — the rail wants titles
//    and timestamps, and a reactive query that re-sends every message of every
//    chat on each keystroke of autosave would be the opposite of rule 26.
// ————————————————————————————————————————————————————————————————————————

/** Serialized-transcript budget. Convex's document ceiling is 1 MB. */
const MESSAGES_BYTE_BUDGET = 600_000
/** A single message allowed to keep its tool payloads verbatim. */
const MESSAGE_BYTE_BUDGET = 120_000
/** Longest auto-derived title; the rail truncates further with CSS. */
const TITLE_MAX = 48
/** Belt and braces — one user cannot fill the table with empty chats. */
const LIST_LIMIT = 100

const FALLBACK_TITLE = "New chat"

/** The rail's row: everything it draws, and nothing it doesn't. */
const summaryValidator = v.object({
  _id: v.id("copilotThreads"),
  title: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  messageCount: v.number(),
})

function byteLength(value: unknown): number {
  try {
    return JSON.stringify(value).length
  } catch {
    // A cycle, or a value `JSON` refuses: treat it as unstorable, which makes
    // `trimForStorage` leave it out rather than fail the whole save.
    return Number.POSITIVE_INFINITY
  }
}

/**
 * A message as it arrives: whatever the AI SDK serialised, validated only as
 * `v.any()`. Everything below treats it as untrusted shape — a part may be
 * missing, null, or something we have never seen.
 */
type LoosePart = Record<string, unknown> | null | undefined
type LooseMessage = {
  role?: unknown
  parts?: Array<LoosePart>
} & Record<string, unknown>

/**
 * Tool results are the bulky part of a transcript — a `list_submissions` call
 * can carry a hundred rows — and they are also the part a re-read needs least.
 * Replacing the payload (rather than dropping the part) keeps the message
 * shape intact, so the renderer still draws the tool card and the model still
 * sees that the call happened.
 */
function stripToolPayloads(message: LooseMessage): LooseMessage {
  if (!Array.isArray(message.parts)) return message
  return {
    ...message,
    parts: message.parts.map((part) => {
      if (!part) return part
      const type = typeof part.type === "string" ? part.type : ""
      if (!type.startsWith("tool-") && type !== "dynamic-tool") return part
      if (!("output" in part) && !("input" in part)) return part
      return {
        ...part,
        input: {},
        output: { truncated: true },
      }
    }),
  }
}

/**
 * The transcript, guaranteed to fit. Newest turns win: an old chat re-opened
 * after a hundred messages shows its recent history, which is what anyone
 * scrolling back is actually looking for.
 */
function trimForStorage(messages: Array<unknown>): Array<unknown> {
  const kept: Array<unknown> = []
  let total = 0
  for (let index = messages.length - 1; index >= 0; index--) {
    let message = messages[index] as LooseMessage
    let size = byteLength(message)
    if (size > MESSAGE_BYTE_BUDGET) {
      message = stripToolPayloads(message)
      size = byteLength(message)
    }
    // Still oversized on its own, or no longer room for it: stop here rather
    // than leave a gap in the middle of the conversation.
    if (total + size > MESSAGES_BYTE_BUDGET) break
    total += size
    kept.push(message)
  }
  return kept.reverse()
}

function textOf(message: LooseMessage): string {
  if (!Array.isArray(message.parts)) return ""
  return message.parts
    .map((part) =>
      part?.type === "text" && typeof part.text === "string" ? part.text : "",
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

/** "Which talks are still pending?" — the first thing the organizer asked. */
export function deriveTitle(messages: Array<unknown>): string {
  const firstUser = (messages as Array<LooseMessage | null>).find(
    (message) => message?.role === "user",
  )
  const text = firstUser ? textOf(firstUser) : ""
  if (!text) return FALLBACK_TITLE
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text
}

/**
 * The thread, or a refusal. Ownership is checked here and nowhere else, so
 * there is exactly one answer to "may this caller touch this chat".
 */
async function ownThread(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  threadId: Id<"copilotThreads">,
): Promise<Doc<"copilotThreads">> {
  const thread = await ctx.db.get(threadId)
  // Same sentence for "deleted" and "someone else's" — a stranger learns
  // nothing about what exists.
  if (!thread || thread.userId !== userId) {
    throw new ConvexError("Chat not found.")
  }
  return thread
}

/**
 * An eventId only ever tags a thread the caller already owns, but tagging it
 * with an event they cannot see would still be a lie about the workspace they
 * belong to — so it goes through the same door every other event-scoped
 * function uses.
 */
async function assertEvent(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  eventId: Id<"events"> | undefined,
): Promise<void> {
  if (!eventId) return
  await eventAccessFor(ctx, userId, eventId)
}

function summarize(thread: Doc<"copilotThreads">) {
  return {
    _id: thread._id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount: thread.messages.length,
  }
}

/** My conversations for this event, newest first. Titles only. */
export const list = query({
  args: { eventId: v.optional(v.id("events")) },
  returns: v.array(summaryValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await assertEvent(ctx, user.userId, args.eventId)
    const threads = await ctx.db
      .query("copilotThreads")
      .withIndex("by_userId_and_eventId_and_updatedAt", (q) =>
        q.eq("userId", user.userId).eq("eventId", args.eventId),
      )
      .order("desc")
      .take(LIST_LIMIT)
    return threads.map(summarize)
  },
})

/** One conversation, transcript included. Null when it isn't mine. */
export const get = query({
  args: { threadId: v.id("copilotThreads") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("copilotThreads"),
      title: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      messages: v.array(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ctx.db.get(args.threadId)
    // A deleted thread is a normal race here (the rail can delete the one the
    // page is showing), so this one answers with null instead of throwing.
    if (!thread || thread.userId !== user.userId) return null
    return {
      _id: thread._id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messages: thread.messages,
    }
  },
})

/**
 * Autosave. Creates the row on the first turn and updates it after that —
 * one call either way, because the client should not have to know whether the
 * conversation it is holding has been written down yet.
 *
 * A thread is born the moment it has something to say: "New chat" alone writes
 * nothing, so the rail never fills with empty rows.
 */
export const save = mutation({
  args: {
    threadId: v.optional(v.id("copilotThreads")),
    eventId: v.optional(v.id("events")),
    messages: v.array(v.any()),
    /** Client-derived title for a brand-new thread; server derives otherwise. */
    title: v.optional(v.string()),
  },
  returns: v.object({ threadId: v.id("copilotThreads") }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const messages = trimForStorage(args.messages)
    if (messages.length === 0) throw new ConvexError("Nothing to save.")
    const now = Date.now()

    if (args.threadId) {
      const thread = await ownThread(ctx, user.userId, args.threadId)
      await ctx.db.patch(thread._id, {
        messages,
        updatedAt: now,
        // A thread that was saved before its first user turn landed (or one
        // the organizer never renamed) picks up a real title as soon as one
        // can be derived; a renamed title is never overwritten.
        ...(thread.title === FALLBACK_TITLE
          ? { title: deriveTitle(messages) }
          : {}),
      })
      return { threadId: thread._id }
    }

    await assertEvent(ctx, user.userId, args.eventId)
    const title = (args.title ?? "").trim() || deriveTitle(messages)
    const threadId = await ctx.db.insert("copilotThreads", {
      userId: user.userId,
      eventId: args.eventId,
      title: title.slice(0, TITLE_MAX),
      createdAt: now,
      updatedAt: now,
      messages,
    })
    return { threadId }
  },
})

export const rename = mutation({
  args: { threadId: v.id("copilotThreads"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ownThread(ctx, user.userId, args.threadId)
    const title = args.title.trim().slice(0, TITLE_MAX)
    if (!title) throw new ConvexError("Give the chat a name.")
    await ctx.db.patch(thread._id, { title })
    return null
  },
})

export const remove = mutation({
  args: { threadId: v.id("copilotThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ownThread(ctx, user.userId, args.threadId)
    await ctx.db.delete(thread._id)
    return null
  },
})

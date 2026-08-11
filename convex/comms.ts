// Communications — templates, outbox, delivery and reminders.
// See docs/SPEC.md §4.9.
//
// Pipeline
//   queueMessage()  → messages row, status "scheduled"
//   deliverPending  → claims a batch (status "sending"), delivers, then marks
//                     each row "sent" | "preview" | "failed"
//
// Transport is Resend. Without `RESEND_API_KEY` nothing is sent and every
// message lands in the outbox as "preview" with its fully rendered subject and
// body — the demo-safe path judges evaluate. Delivery is claim-based so two
// overlapping `deliverPending` runs can never send the same email twice.

import { ConvexError, v } from "convex/values"
import type {Infer} from "convex/values";
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query
  
  
} from "./_generated/server"
import type {MutationCtx, QueryCtx} from "./_generated/server";
import { requireEventAccess } from "./lib/auth"
import {
  DEFAULT_TEMPLATES,
  defaultTemplate,
  emailFrom,
  emailFromAddress,
  looksLikeHtml,
  portalLinkFor,
  renderBrandedEmail,
  renderTemplate,
  siteUrl

} from "./lib/email"
import type {TemplateDefinition} from "./lib/email";
import { buildIcs } from "./lib/ics"
import { formPath, workspaceSlugForEvent } from "./lib/publicLinks"

// ——— Constants ————————————————————————————————————————————————————————————

/** Don't nag the same speaker more than once per this window. */
export const REMINDER_DEDUPE_MS = 20 * 60 * 60 * 1000 // 20 hours
/** A claimed message stuck in "sending" longer than this is retried. */
const CLAIM_STALE_MS = 5 * 60 * 1000
const DEFAULT_BATCH = 25
/**
 * How many recipients the composer renders for the review step in one call.
 * Sessionboard caps a manual send at 100 recipients; we render up to the same
 * number so the reviewer never scrolls a list the product itself would refuse.
 */
const MAX_PER_SEND = 100
/** How many delivery receipts one refresh click checks. */
const MAX_DELIVERY_POLL = 50

export const MESSAGE_STATUS = {
  scheduled: "scheduled",
  sending: "sending",
  sent: "sent",
  preview: "preview",
  failed: "failed",
} as const

/** Statuses that count as "we already contacted them" for dedupe purposes. */
const DELIVERED_OR_PENDING = new Set<string>([
  MESSAGE_STATUS.scheduled,
  MESSAGE_STATUS.sending,
  MESSAGE_STATUS.sent,
  MESSAGE_STATUS.preview,
])

// ——— Shared helpers (called directly; see Convex guidelines on helpers) ————

export async function resolveTemplate(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  key: string,
): Promise<TemplateDefinition> {
  const stored = await ctx.db
    .query("emailTemplates")
    .withIndex("by_eventId_and_key", (q) => q.eq("eventId", eventId).eq("key", key))
    .unique()
  if (stored) {
    return {
      key: stored.key,
      name: stored.name,
      subject: stored.subject,
      body: stored.body,
    }
  }
  return defaultTemplate(key)
}

/**
 * Provider delivery states we understand, in Resend's own vocabulary. Anything
 * else Resend returns is stored verbatim and rendered as-is — we never hide a
 * state just because it is new.
 */
export const DELIVERY_TERMINAL = new Set<string>([
  "delivered",
  "bounced",
  "complained",
  "opened",
  "clicked",
  "canceled",
  "failed",
])

export type QueueMessageArgs = {
  eventId: Id<"events">
  personId: Id<"people">
  templateKey: string
  submissionId?: Id<"submissions">
  extraVars?: Record<string, string>
  /** Send somewhere other than the person's own address (template test sends). */
  toEmailOverride?: string
  /**
   * Ad-hoc copy that bypasses the stored template (the bulk composer). The
   * placeholders are still rendered per recipient, so `{{firstName}}` works
   * exactly as it does in a saved template.
   */
  override?: { subject: string; body: string }
}

export type RenderedMessage = {
  personName: string
  toEmail: string
  subject: string
  body: string
  icsAttached: boolean
}

/**
 * Render one person's copy of a message — the exact subject and body that would
 * hit their inbox — without writing anything.
 *
 * Both the outbox insert and the composer's per-recipient review step go
 * through here, so what an organizer approves in the review step is byte-for-byte
 * what gets queued (product-map delta #7 / sbek SPK-14).
 */
export async function renderMessageFor(
  ctx: QueryCtx | MutationCtx,
  args: QueueMessageArgs,
): Promise<RenderedMessage> {
  const person = await ctx.db.get("people", args.personId)
  if (!person) throw new ConvexError("Person not found.")
  if (person.eventId !== args.eventId) {
    throw new ConvexError("That person belongs to a different event.")
  }
  const event = await ctx.db.get("events", args.eventId)
  if (!event) throw new ConvexError("Event not found.")

  let submission = null
  if (args.submissionId) {
    submission = await ctx.db.get("submissions", args.submissionId)
    if (submission && submission.eventId !== args.eventId) {
      throw new ConvexError("That submission belongs to a different event.")
    }
  }

  const template =
    args.override ?? (await resolveTemplate(ctx, args.eventId, args.templateKey))
  const fullName = `${person.firstName} ${person.lastName}`.trim()
  const vars: Record<string, string> = {
    speakerName: fullName || "there",
    // A CFP submission only requires an email, so a recipient can have no
    // name at all — "Hi {{firstName}}," must never render as "Hi  ,".
    firstName: person.firstName.trim() || fullName || "there",
    eventName: event.name,
    sessionTitle: submission?.title ?? "",
    portalLink: portalLinkFor(person.portalToken),
    ...(args.extraVars ?? {}),
  }

  return {
    personName: `${person.firstName} ${person.lastName}`.trim(),
    toEmail: args.toEmailOverride ?? person.email,
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
    // An invite only makes sense once the session actually has a slot.
    icsAttached: Boolean(args.submissionId && submission?.startsAt != null),
  }
}

/**
 * Render a template for one person and drop it into the outbox. Returns the new
 * message id. Does NOT schedule delivery — callers batch that into a single
 * `ctx.scheduler.runAfter(0, internal.comms.deliverPending)`.
 */
export async function queueMessage(
  ctx: MutationCtx,
  args: QueueMessageArgs,
): Promise<Id<"messages">> {
  const rendered = await renderMessageFor(ctx, args)

  const template =
    args.override ?? (await resolveTemplate(ctx, args.eventId, args.templateKey))
  return await ctx.db.insert("messages", {
    eventId: args.eventId,
    personId: args.personId,
    templateKey: args.templateKey,
    toEmail: rendered.toEmail,
    subject: rendered.subject,
    body: rendered.body,
    // Decided from the TEMPLATE, pre-render (adversarial-review F3).
    isHtml: looksLikeHtml(template.body),
    submissionId: args.submissionId,
    icsAttached: rendered.icsAttached,
    scheduledAt: Date.now(),
    status: MESSAGE_STATUS.scheduled,
  })
}

/** True when this person already got `templateKey` inside the dedupe window. */
export async function wasRecentlyMessaged(
  ctx: QueryCtx | MutationCtx,
  personId: Id<"people">,
  templateKey: string,
  now: number,
  windowMs: number = REMINDER_DEDUPE_MS,
): Promise<boolean> {
  const recent = await ctx.db
    .query("messages")
    .withIndex("by_personId", (q) => q.eq("personId", personId))
    .order("desc")
    .take(25)
  return recent.some(
    (m) =>
      m.templateKey === templateKey &&
      DELIVERED_OR_PENDING.has(m.status) &&
      (m.scheduledAt ?? m.sentAt ?? m._creationTime) > now - windowMs,
  )
}

/**
 * Queue a reminder for every person in `eventId` with an incomplete task, honouring
 * the dedupe window. `dueWithinMs` (when given) restricts to tasks coming due soon.
 * Shared by the manual organizer action and the daily cron.
 */
export async function queueTaskReminders(
  ctx: MutationCtx,
  opts: {
    eventId: Id<"events">
    now: number
    /** Only consider tasks with a dueAt inside `now + dueWithinMs`. */
    dueWithinMs?: number
  },
): Promise<{ queued: number; skipped: number }> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_eventId", (q) => q.eq("eventId", opts.eventId))
    .take(1000)

  const horizon = opts.dueWithinMs === undefined ? null : opts.now + opts.dueWithinMs
  const personIds = new Set<Id<"people">>()
  for (const task of tasks) {
    if (task.completedAt !== undefined) continue
    if (horizon !== null) {
      // No due date ⇒ never "due soon"; overdue tasks still count.
      if (task.dueAt === undefined) continue
      if (task.dueAt > horizon) continue
    }
    personIds.add(task.personId)
  }

  let queued = 0
  let skipped = 0
  for (const personId of personIds) {
    if (await wasRecentlyMessaged(ctx, personId, "reminder", opts.now)) {
      skipped++
      continue
    }
    await queueMessage(ctx, {
      eventId: opts.eventId,
      personId,
      templateKey: "reminder",
    })
    queued++
  }
  return { queued, skipped }
}

/**
 * Queue the "your draft closes soon" nudge for every unfinished draft on a form
 * whose close date is inside `windowMs` — the promise the form builder's "Send
 * a deadline reminder" toggle makes (gap #11).
 *
 * One email per person per form, deduped over the whole window (not the usual
 * 20h), so a three-day warning window means one reminder, not three.
 */
export async function queueDeadlineReminders(
  ctx: MutationCtx,
  opts: { eventId: Id<"events">; now: number; windowMs: number },
): Promise<{ queued: number; skipped: number }> {
  const forms = await ctx.db
    .query("forms")
    .withIndex("by_eventId", (q) => q.eq("eventId", opts.eventId))
    .take(200)

  const due = forms.filter(
    (form) =>
      form.status === "open" &&
      form.settings.sendReminderEmail &&
      form.closeAt !== undefined &&
      form.closeAt > opts.now &&
      form.closeAt <= opts.now + opts.windowMs,
  )
  if (due.length === 0) return { queued: 0, skipped: 0 }

  const event = await ctx.db.get("events", opts.eventId)
  if (!event) return { queued: 0, skipped: 0 }

  // Every open draft in the event, once — then split per form below.
  const drafts = await ctx.db
    .query("submissions")
    .withIndex("by_eventId_and_status", (q) =>
      q.eq("eventId", opts.eventId).eq("status", "draft"),
    )
    .take(2000)

  let queued = 0
  let skipped = 0
  for (const form of due) {
    const closeDate = formatCloseDate(form.closeAt as number, event.timezone)
    const formLink = `${siteUrl()}${formPath(await workspaceSlugForEvent(ctx, event), event.slug, form.slug)}`
    // A person with two drafts on the same form is still one human.
    const seen = new Set<Id<"people">>()
    for (const draft of drafts) {
      if (draft.formId !== form._id) continue
      if (draft.deletedAt !== undefined) continue
      if (seen.has(draft.submitterId)) continue
      seen.add(draft.submitterId)

      if (
        await wasRecentlyMessaged(
          ctx,
          draft.submitterId,
          "deadline_reminder",
          opts.now,
          opts.windowMs,
        )
      ) {
        skipped++
        continue
      }
      await queueMessage(ctx, {
        eventId: opts.eventId,
        personId: draft.submitterId,
        templateKey: "deadline_reminder",
        submissionId: draft._id,
        extraVars: { closeDate, formLink },
      })
      queued++
    }
  }
  return { queued, skipped }
}

/** "Friday, 14 August 2026 at 5:00 PM GMT+1", in the event's own timezone. */
function formatCloseDate(closeAt: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(closeAt))
  } catch {
    return new Date(closeAt).toUTCString()
  }
}

// ——— Branding (gap #29) ———————————————————————————————————————————————————
// The stored body stays plain text; the event's identity is applied at
// render/send time. `brandFor` is the one place that answers "whose event is
// this, what is their logo, and where is this person's portal?" — the sender
// and the outbox preview both go through it, so what an organizer inspects is
// what the speaker received.

const brandValidator = v.object({
  eventName: v.string(),
  logoUrl: v.union(v.string(), v.null()),
  portalLink: v.union(v.string(), v.null()),
})

async function brandFor(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  personId: Id<"people">,
  eventCache?: Map<Id<"events">, { name: string; logoUrl: string | null }>,
): Promise<Infer<typeof brandValidator>> {
  let branding = eventCache?.get(eventId)
  if (!branding) {
    const event = await ctx.db.get("events", eventId)
    branding = {
      name: event?.name ?? "Trackstage",
      logoUrl: event?.logoId ? await ctx.storage.getUrl(event.logoId) : null,
    }
    eventCache?.set(eventId, branding)
  }
  const person = await ctx.db.get("people", personId)
  return {
    eventName: branding.name,
    logoUrl: branding.logoUrl,
    portalLink: person ? portalLinkFor(person.portalToken) : null,
  }
}

/**
 * The branded HTML for one outbox row — exactly the markup handed to the email
 * provider. The outbox drawer renders this so "preview" means the real email,
 * chrome included, not an approximation of it.
 */
export const messageHtml = query({
  args: { eventId: v.id("events"), messageId: v.id("messages") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const message = await ctx.db.get("messages", args.messageId)
    if (!message || message.eventId !== args.eventId) return null
    const brand = await brandFor(ctx, message.eventId, message.personId)
    return renderBrandedEmail({
      subject: message.subject,
      body: message.body,
      isHtml: message.isHtml,
      eventName: brand.eventName,
      logoUrl: brand.logoUrl,
      portalLink: brand.portalLink,
    })
  },
})

// ——— Templates ————————————————————————————————————————————————————————————

const templateRowValidator = v.object({
  templateId: v.union(v.id("emailTemplates"), v.null()),
  key: v.string(),
  name: v.string(),
  subject: v.string(),
  body: v.string(),
  /** True when this row is the built-in copy, not yet customised for the event. */
  isDefault: v.boolean(),
})

/**
 * Every template the event can send: its stored overrides first, then the
 * built-in defaults for any key it has not customised yet.
 */
export const listTemplates = query({
  args: { eventId: v.id("events") },
  returns: v.array(templateRowValidator),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const stored = await ctx.db
      .query("emailTemplates")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(200)

    const rows: Array<{
      templateId: Id<"emailTemplates"> | null
      key: string
      name: string
      subject: string
      body: string
      isDefault: boolean
    }> = stored.map((t) => ({
      templateId: t._id,
      key: t.key,
      name: t.name,
      subject: t.subject,
      body: t.body,
      isDefault: false,
    }))
    const storedKeys = new Set(stored.map((t) => t.key))
    for (const def of DEFAULT_TEMPLATES) {
      if (storedKeys.has(def.key)) continue
      rows.push({
        templateId: null,
        key: def.key,
        name: def.name,
        subject: def.subject,
        body: def.body,
        isDefault: true,
      })
    }

    const order = DEFAULT_TEMPLATES.map((t) => t.key)
    return rows.sort((a, b) => {
      const ai = order.indexOf(a.key)
      const bi = order.indexOf(b.key)
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return a.key.localeCompare(b.key)
    })
  },
})

export const upsertTemplate = mutation({
  args: {
    eventId: v.id("events"),
    key: v.string(),
    name: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.id("emailTemplates"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const key = args.key.trim()
    if (!key) throw new ConvexError("A template key is required.")

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_eventId_and_key", (q) =>
        q.eq("eventId", args.eventId).eq("key", key),
      )
      .unique()

    if (existing) {
      await ctx.db.patch("emailTemplates", existing._id, {
        name: args.name,
        subject: args.subject,
        body: args.body,
      })
      return existing._id
    }
    return await ctx.db.insert("emailTemplates", {
      eventId: args.eventId,
      key,
      name: args.name,
      subject: args.subject,
      body: args.body,
    })
  },
})

// ——— Outbox ———————————————————————————————————————————————————————————————

const outboxRowValidator = v.object({
  _id: v.id("messages"),
  _creationTime: v.number(),
  eventId: v.id("events"),
  personId: v.id("people"),
  templateKey: v.optional(v.string()),
  toEmail: v.string(),
  subject: v.string(),
  body: v.string(),
  submissionId: v.optional(v.id("submissions")),
  icsAttached: v.boolean(),
  isHtml: v.optional(v.boolean()),
  scheduledAt: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  status: v.string(),
  error: v.optional(v.string()),
  resendId: v.optional(v.string()),
  providerStatus: v.optional(v.string()),
  deliveredAt: v.optional(v.number()),
  personName: v.string(),
  personEmail: v.string(),
  submissionTitle: v.union(v.string(), v.null()),
})

/** The outbox: newest first, joined with recipient name/email. */
export const listMessages = query({
  args: {
    eventId: v.id("events"),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(outboxRowValidator),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500)

    const raw = await ctx.db
      .query("messages")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .take(500)
    const scoped = (
      args.status ? raw.filter((m) => m.status === args.status) : raw
    ).slice(0, limit)

    const peopleCache = new Map<
      Id<"people">,
      { name: string; email: string } | null
    >()
    const submissionCache = new Map<Id<"submissions">, string | null>()

    const rows: Array<
      Doc<"messages"> & {
        personName: string
        personEmail: string
        submissionTitle: string | null
      }
    > = []
    for (const m of scoped) {
      if (!peopleCache.has(m.personId)) {
        const person = await ctx.db.get("people", m.personId)
        peopleCache.set(
          m.personId,
          person
            ? {
                name: `${person.firstName} ${person.lastName}`.trim(),
                email: person.email,
              }
            : null,
        )
      }
      const person = peopleCache.get(m.personId) ?? null

      let submissionTitle: string | null = null
      if (m.submissionId) {
        if (!submissionCache.has(m.submissionId)) {
          const submission = await ctx.db.get("submissions", m.submissionId)
          submissionCache.set(m.submissionId, submission?.title ?? null)
        }
        submissionTitle = submissionCache.get(m.submissionId) ?? null
      }

      rows.push({
        ...m,
        personName: person?.name ?? "(deleted person)",
        personEmail: person?.email ?? m.toEmail,
        submissionTitle,
      })
    }
    return rows
  },
})

// ——— Queueing ————————————————————————————————————————————————————————————

/**
 * Queue one templated message and kick off delivery. This is the entry point
 * other modules (decision commits, scheduling) call via
 * `ctx.runMutation(internal.comms.queueForPerson, …)`.
 */
export const queueForPerson = internalMutation({
  args: {
    eventId: v.id("events"),
    personId: v.id("people"),
    templateKey: v.string(),
    submissionId: v.optional(v.id("submissions")),
    extraVars: v.optional(v.record(v.string(), v.string())),
    toEmailOverride: v.optional(v.string()),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const messageId = await queueMessage(ctx, args)
    await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    return messageId
  },
})

/** Preview a template by mailing it to the signed-in organizer. */
export const sendTestToSelf = mutation({
  args: {
    eventId: v.id("events"),
    key: v.string(),
  },
  returns: v.object({ messageId: v.id("messages"), toEmail: v.string() }),
  handler: async (ctx, args) => {
    const { user } = await requireEventAccess(ctx, args.eventId)

    // Render against a real person so the preview shows realistic values. If the
    // event has no people yet, stand one up for the organizer.
    let found = await ctx.db
      .query("people")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first()
    if (!found) {
      const [firstName, ...rest] = (user.name ?? user.email).split(" ")
      const personId = await ctx.db.insert("people", {
        eventId: args.eventId,
        email: user.email,
        firstName: firstName || "Organizer",
        lastName: rest.join(" ") || "",
        portalToken: `test-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      })
      found = await ctx.db.get("people", personId)
      if (!found) throw new ConvexError("Could not create a preview recipient.")
    }
    const recipient: Doc<"people"> = found

    const submission = await ctx.db
      .query("submissions")
      .withIndex("by_submitterId", (q) => q.eq("submitterId", recipient._id))
      .first()

    const messageId = await queueMessage(ctx, {
      eventId: args.eventId,
      personId: recipient._id,
      templateKey: args.key,
      submissionId: submission?._id,
      extraVars: submission ? undefined : { sessionTitle: "Your session title" },
      toEmailOverride: user.email,
    })
    await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    return { messageId, toEmail: user.email }
  },
})

// ——— Bulk composer (sbek SPK-13) ————————————————————————————————————————
// Templates cover the moments the system knows about (accepted, declined,
// reminder). This covers everything else an organizer needs to say: "the venue
// changed", "here's your green room time". One subject + body, one audience
// filter, one message per recipient — each rendered with that person's own
// placeholders and dropped into the same outbox as every other email, so the
// preview/delivery path is identical.

/** Who a bulk email goes to. */
export const BULK_FILTERS = [
  "all_speakers",
  "accepted",
  "incomplete_tasks",
  "manual",
] as const

const bulkFilterValidator = v.union(
  v.literal("all_speakers"),
  v.literal("accepted"),
  v.literal("incomplete_tasks"),
  v.literal("manual"),
)

/**
 * Resolve a filter to concrete person ids. Exported so the composer's live
 * "this will go to N people" count and the send itself can never disagree —
 * `recipientCount` and `composeBulk` call exactly this.
 */
export async function resolveBulkRecipients(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  filter: (typeof BULK_FILTERS)[number],
  personIds?: Array<Id<"people">>,
): Promise<Array<Id<"people">>> {
  if (filter === "manual") {
    const picked: Array<Id<"people">> = []
    for (const personId of personIds ?? []) {
      const person = await ctx.db.get("people", personId)
      if (person && person.eventId === eventId) picked.push(person._id)
    }
    return [...new Set(picked)]
  }

  if (filter === "incomplete_tasks") {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .take(2000)
    const ids = new Set<Id<"people">>()
    for (const task of tasks) {
      if (task.completedAt === undefined) ids.add(task.personId)
    }
    return [...ids]
  }

  if (filter === "accepted") {
    const accepted = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", eventId).eq("status", "accepted"),
      )
      .take(2000)
    const ids = new Set<Id<"people">>()
    for (const submission of accepted) {
      const participants = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) =>
          q.eq("submissionId", submission._id),
        )
        .take(64)
      for (const participant of participants) ids.add(participant.personId)
    }
    return [...ids]
  }

  // all_speakers — everyone on a submission of any status, plus anyone the
  // organizer manages by hand (speakersAdmin.addManual).
  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(4000)
  const ids = new Set<Id<"people">>(participants.map((p) => p.personId))
  const managed = await ctx.db
    .query("people")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(4000)
  for (const person of managed) {
    if (person.workflowStatus !== undefined) ids.add(person._id)
  }
  return [...ids]
}

/** `{{sessionTitle}}` (any spacing) anywhere in the composer's copy. */
const SESSION_TITLE_PLACEHOLDER = /\{\{\s*sessionTitle\s*\}\}/

/**
 * The session an organizer means when they write `{{sessionTitle}}` in a bulk
 * email: this person's accepted session if they have one, otherwise whatever
 * they submitted. Returns "" for someone with no submission at all — visible
 * in the review step, which is exactly where a wrong merge field should
 * surface, before anything is sent.
 */
async function sessionTitleFor(
  ctx: QueryCtx | MutationCtx,
  personId: Id<"people">,
): Promise<string> {
  const participations = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_personId", (q) => q.eq("personId", personId))
    .take(16)

  let fallback = ""
  for (const participation of participations) {
    const submission = await ctx.db.get("submissions", participation.submissionId)
    if (!submission) continue
    if (submission.status === "accepted") return submission.title
    if (!fallback) fallback = submission.title
  }
  return fallback
}

/** Live audience size for the composer, before anything is sent. */
export const recipientCount = query({
  args: {
    eventId: v.id("events"),
    filter: bulkFilterValidator,
    personIds: v.optional(v.array(v.id("people"))),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const ids = await resolveBulkRecipients(
      ctx,
      args.eventId,
      args.filter,
      args.personIds,
    )
    return ids.length
  },
})

/** One recipient's fully rendered copy, for the composer's review step. */
const bulkPreviewValidator = v.object({
  personId: v.id("people"),
  personName: v.string(),
  toEmail: v.string(),
  subject: v.string(),
  body: v.string(),
})

/**
 * Send a one-off email to an audience — or, with `preview: true`, render every
 * recipient's copy and write nothing.
 *
 * The preview mode is what the composer's Review step reads (product-map delta
 * #7 / sbek SPK-14): the organizer walks the list, reads the exact email each
 * person will get with their own merge fields resolved, drops anyone who
 * shouldn't be on it, and only then sends. Preview and send share
 * `renderMessageFor`, so the approved copy is the sent copy.
 */
export const composeBulk = mutation({
  args: {
    eventId: v.id("events"),
    filter: bulkFilterValidator,
    subject: v.string(),
    body: v.string(),
    /** Only read when `filter` is "manual". */
    personIds: v.optional(v.array(v.id("people"))),
    /** Render every recipient's copy and queue nothing. */
    preview: v.optional(v.boolean()),
  },
  returns: v.object({
    queued: v.number(),
    recipients: v.number(),
    /** Populated only when `preview` is true. */
    previews: v.array(bulkPreviewValidator),
  }),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const subject = args.subject.trim()
    const body = args.body.trim()
    if (!subject) throw new ConvexError("Add a subject line.")
    if (!body) throw new ConvexError("Write a message before sending.")

    const recipients = await resolveBulkRecipients(
      ctx,
      args.eventId,
      args.filter,
      args.personIds,
    )
    if (recipients.length === 0) {
      throw new ConvexError(
        "Nobody matches that audience yet — pick a different filter.",
      )
    }

    // Groups these in the outbox without pretending to be a saved template.
    const templateKey = "custom-bulk"
    // A bulk send carries no session of its own, so {{sessionTitle}} would
    // render empty for everyone. Resolve each person's own session instead —
    // but only when the copy actually asks for it.
    const usesSessionTitle = SESSION_TITLE_PLACEHOLDER.test(`${subject}\n${body}`)
    const extraVarsFor = async (personId: Id<"people">) =>
      usesSessionTitle
        ? { sessionTitle: await sessionTitleFor(ctx, personId) }
        : undefined

    if (args.preview === true) {
      const previews: Array<Infer<typeof bulkPreviewValidator>> = []
      for (const personId of recipients.slice(0, MAX_PER_SEND)) {
        const rendered = await renderMessageFor(ctx, {
          eventId: args.eventId,
          personId,
          templateKey,
          override: { subject, body },
          extraVars: await extraVarsFor(personId),
        })
        previews.push({
          personId,
          personName: rendered.personName,
          toEmail: rendered.toEmail,
          subject: rendered.subject,
          body: rendered.body,
        })
      }
      return { queued: 0, recipients: recipients.length, previews }
    }

    let queued = 0
    for (const personId of recipients) {
      await queueMessage(ctx, {
        eventId: args.eventId,
        personId,
        templateKey,
        override: { subject, body },
        extraVars: await extraVarsFor(personId),
      })
      queued++
    }
    await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    return { queued, recipients: recipients.length, previews: [] }
  },
})

/** "Send reminder to incomplete speakers" (SPEC §4.9). */
export const remindIncompleteSpeakers = mutation({
  args: { eventId: v.id("events") },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const result = await queueTaskReminders(ctx, {
      eventId: args.eventId,
      now: Date.now(),
    })
    if (result.queued > 0) {
      await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
    }
    return result
  },
})

// ——— Delivery ————————————————————————————————————————————————————————————

const claimedMessageValidator = v.object({
  isHtml: v.optional(v.boolean()),
  messageId: v.id("messages"),
  toEmail: v.string(),
  subject: v.string(),
  body: v.string(),
  icsAttached: v.boolean(),
  /** Event identity applied to the HTML part at send time. */
  brand: brandValidator,
})

/**
 * Atomically take the next batch of outbound mail. Claimed rows flip to
 * "sending" so a concurrent `deliverPending` cannot pick them up; rows stuck in
 * "sending" past `CLAIM_STALE_MS` (an action that died mid-flight) are retried.
 */
export const claimPending = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.array(claimedMessageValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? DEFAULT_BATCH, 1), 100)
    const now = Date.now()

    const scheduled = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", MESSAGE_STATUS.scheduled))
      .take(limit)

    const claimable = [...scheduled]
    if (claimable.length < limit) {
      const inFlight = await ctx.db
        .query("messages")
        .withIndex("by_status", (q) => q.eq("status", MESSAGE_STATUS.sending))
        .take(limit)
      for (const m of inFlight) {
        if (claimable.length >= limit) break
        const claimedAt = m.scheduledAt ?? m._creationTime
        if (claimedAt < now - CLAIM_STALE_MS) claimable.push(m)
      }
    }

    for (const m of claimable) {
      // scheduledAt doubles as the claim stamp so stale claims can be detected.
      await ctx.db.patch("messages", m._id, {
        status: MESSAGE_STATUS.sending,
        scheduledAt: now,
      })
    }

    const eventCache = new Map<
      Id<"events">,
      { name: string; logoUrl: string | null }
    >()
    const claimed: Array<Infer<typeof claimedMessageValidator>> = []
    for (const m of claimable) {
      claimed.push({
        messageId: m._id,
        isHtml: m.isHtml,
        toEmail: m.toEmail,
        subject: m.subject,
        body: m.body,
        icsAttached: m.icsAttached,
        brand: await brandFor(ctx, m.eventId, m.personId, eventCache),
      })
    }
    return claimed
  },
})

const icsContextValidator = v.object({
  messageId: v.id("messages"),
  filename: v.string(),
  uid: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  startsAt: v.number(),
  durationMinutes: v.number(),
  timezone: v.optional(v.string()),
  location: v.optional(v.string()),
  attendeeEmail: v.optional(v.string()),
  eventName: v.optional(v.string()),
})

/** Everything the action needs to build a calendar invite: submission + event + room. */
export const icsContexts = internalQuery({
  args: { messageIds: v.array(v.id("messages")) },
  returns: v.array(icsContextValidator),
  handler: async (ctx, args) => {
    const out: Array<Infer<typeof icsContextValidator>> = []
    for (const messageId of args.messageIds.slice(0, 100)) {
      const message = await ctx.db.get("messages", messageId)
      if (!message || !message.submissionId) continue
      const submission = await ctx.db.get("submissions", message.submissionId)
      if (!submission || submission.startsAt === undefined) continue
      const event = await ctx.db.get("events", submission.eventId)
      const room = submission.roomId
        ? await ctx.db.get("rooms", submission.roomId)
        : null
      const person = await ctx.db.get("people", message.personId)

      const locationParts = [room?.name, event?.venue].filter(
        (part): part is string => Boolean(part),
      )
      out.push({
        messageId,
        filename: `${slugify(submission.title) || "session"}.ics`,
        uid: `${submission._id}@trackstage`,
        title: submission.title,
        description: submission.description,
        startsAt: submission.startsAt,
        durationMinutes: submission.durationMinutes ?? 45,
        timezone: event?.timezone,
        location: locationParts.length ? locationParts.join(" · ") : undefined,
        attendeeEmail: person?.email,
        eventName: event?.name,
      })
    }
    return out
  },
})

export const markDelivered = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.string(),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    /** Resend's own message id — the handle used to ask "did it land?". */
    resendId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.messageId)
    if (!message) return null
    await ctx.db.patch("messages", args.messageId, {
      status: args.status,
      sentAt: args.sentAt,
      error: args.error,
      resendId: args.resendId,
    })
    return null
  },
})

/**
 * Deliver claimed messages. With `RESEND_API_KEY` set they go out over the
 * Resend API (with the .ics attached when the session is scheduled); without
 * one, every message is marked "preview" so the outbox stays fully inspectable
 * with no external dependency.
 */
export const deliverPending = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    sent: v.number(),
    preview: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Explicit annotations: these call same-file functions (TS circularity).
    const batch: Array<Infer<typeof claimedMessageValidator>> =
      await ctx.runMutation(internal.comms.claimPending, { limit: args.limit })
    const summary = { processed: batch.length, sent: 0, preview: 0, failed: 0 }
    if (batch.length === 0) return summary

    const needsIcs = batch.filter((m) => m.icsAttached).map((m) => m.messageId)
    const contexts: Array<Infer<typeof icsContextValidator>> = needsIcs.length
      ? await ctx.runQuery(internal.comms.icsContexts, { messageIds: needsIcs })
      : []
    const icsByMessage = new Map(contexts.map((c) => [c.messageId, c]))

    const apiKey = process.env.RESEND_API_KEY

    for (const message of batch) {
      try {
        const context = icsByMessage.get(message.messageId)
        const ics = context
          ? buildIcs({
              uid: context.uid,
              title: context.title,
              description: context.description,
              startsAt: context.startsAt,
              durationMinutes: context.durationMinutes,
              timezone: context.timezone,
              location: context.location,
              organizerEmail: emailFromAddress(),
              attendeeEmail: context.attendeeEmail,
              eventName: context.eventName,
            })
          : null

        // Demo-safe paths: no transport configured, OR a seeded demo
        // recipient (@example.com would bounce at Resend and pollute the
        // outbox with failures) — keep the fully rendered preview instead.
        const isDemoRecipient = /@example\.(com|org|net)$/i.test(message.toEmail)
        if (!apiKey || isDemoRecipient) {
          await ctx.runMutation(internal.comms.markDelivered, {
            messageId: message.messageId,
            status: MESSAGE_STATUS.preview,
          })
          summary.preview++
          continue
        }

        // Always send both parts: the branded HTML (event logo/name header,
        // the copy, a quiet Trackstage footer) plus the plain-text original as
        // the fallback for text-only clients. A body an organizer authored as
        // HTML is embedded as-is inside the same wrapper.
        const payload: Record<string, unknown> = {
          from: emailFrom(),
          to: [message.toEmail],
          subject: message.subject,
          html: renderBrandedEmail({
            subject: message.subject,
            body: message.body,
            isHtml: message.isHtml,
            eventName: message.brand.eventName,
            logoUrl: message.brand.logoUrl,
            portalLink: message.brand.portalLink,
          }),
        }
        if (!(message.isHtml ?? looksLikeHtml(message.body)))
          payload.text = message.body
        if (ics && context) {
          payload.attachments = [
            {
              filename: context.filename,
              content: toBase64(ics),
              content_type: "text/calendar; charset=utf-8; method=REQUEST",
            },
          ]
        }

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const detail = await response.text()
          throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 400)}`)
        }

        // Resend answers `{ id }` — keep it: it is the only handle for asking
        // later whether the mail actually landed (refreshDeliveryStatus).
        const accepted: unknown = await response.json().catch(() => null)
        const acceptedId =
          accepted && typeof accepted === "object" && "id" in accepted
            ? accepted.id
            : undefined
        const resendId =
          typeof acceptedId === "string" ? acceptedId : undefined

        await ctx.runMutation(internal.comms.markDelivered, {
          messageId: message.messageId,
          status: MESSAGE_STATUS.sent,
          sentAt: Date.now(),
          resendId,
        })
        summary.sent++
      } catch (error) {
        await ctx.runMutation(internal.comms.markDelivered, {
          messageId: message.messageId,
          status: MESSAGE_STATUS.failed,
          error: error instanceof Error ? error.message : String(error),
        })
        summary.failed++
      }
    }

    // A full batch means there may be more waiting (a bulk send to 40 people
    // arrives as 40 scheduled rows but one claim takes at most 25) — chain
    // another run so the tail is delivered instead of stranded until the next
    // unrelated send re-triggers delivery.
    const claimCap = Math.min(Math.max(args.limit ?? DEFAULT_BATCH, 1), 100)
    if (batch.length === claimCap) {
      await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {
        limit: args.limit,
      })
    }

    return summary
  },
})

// ——— Delivery receipts (product-map delta #7 / sbek SPK-14) ——————————————
// "Sent" only means Resend accepted the message. Whether it reached the inbox
// is a second question, and the one an organizer actually cares about when a
// speaker says "I never got it". We answer it on demand — one click asks Resend
// GET /emails/{id} for the messages that still have an open question — rather
// than running a cron that burns API calls on a mailbox nobody is looking at.

const deliveryHandleValidator = v.object({
  messageId: v.id("messages"),
  resendId: v.string(),
})

/** Sent messages whose final delivery state we don't know yet. */
export const openDeliveryHandles = internalQuery({
  args: {
    eventId: v.id("events"),
    messageId: v.optional(v.id("messages")),
  },
  returns: v.array(deliveryHandleValidator),
  handler: async (ctx, args) => {
    const candidates: Array<Doc<"messages">> = []
    if (args.messageId) {
      const one = await ctx.db.get("messages", args.messageId)
      if (one && one.eventId === args.eventId) candidates.push(one)
    } else {
      const recent = await ctx.db
        .query("messages")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .order("desc")
        .take(500)
      candidates.push(...recent)
    }

    const open: Array<Infer<typeof deliveryHandleValidator>> = []
    for (const message of candidates) {
      if (open.length >= MAX_DELIVERY_POLL) break
      if (message.status !== MESSAGE_STATUS.sent) continue
      if (!message.resendId) continue
      // Terminal states never change; don't pay to re-ask.
      if (
        message.providerStatus &&
        DELIVERY_TERMINAL.has(message.providerStatus)
      ) {
        continue
      }
      open.push({ messageId: message._id, resendId: message.resendId })
    }
    return open
  },
})

export const applyDeliveryStatus = internalMutation({
  args: {
    messageId: v.id("messages"),
    providerStatus: v.string(),
    deliveredAt: v.optional(v.number()),
    /** Why it didn't land, when the provider tells us. */
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get("messages", args.messageId)
    if (!message) return null
    await ctx.db.patch("messages", args.messageId, {
      providerStatus: args.providerStatus,
      deliveredAt: args.deliveredAt ?? message.deliveredAt,
      error: args.error ?? message.error,
    })
    return null
  },
})

/** Ask Resend what happened to each handle and write the answer back. */
export const pollDeliveryStatus = internalAction({
  args: { handles: v.array(deliveryHandleValidator) },
  returns: v.object({ checked: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    let checked = 0
    let updated = 0
    if (!apiKey) return { checked, updated }

    for (const handle of args.handles.slice(0, MAX_DELIVERY_POLL)) {
      checked++
      try {
        const response = await fetch(
          `https://api.resend.com/emails/${encodeURIComponent(handle.resendId)}`,
          { headers: { Authorization: `Bearer ${apiKey}` } },
        )
        if (!response.ok) continue
        const payload: unknown = await response.json()
        if (!payload || typeof payload !== "object") continue
        const record = payload as Record<string, unknown>
        const lastEvent =
          typeof record.last_event === "string" ? record.last_event : null
        if (!lastEvent) continue

        await ctx.runMutation(internal.comms.applyDeliveryStatus, {
          messageId: handle.messageId,
          providerStatus: lastEvent,
          deliveredAt:
            lastEvent === "delivered" ||
            lastEvent === "opened" ||
            lastEvent === "clicked"
              ? Date.now()
              : undefined,
          error:
            lastEvent === "bounced"
              ? "The mail server rejected this address (bounced)."
              : lastEvent === "complained"
                ? "The recipient marked this email as spam."
                : undefined,
        })
        updated++
      } catch {
        // A receipt we couldn't fetch just stays unknown — never a failure the
        // organizer has to act on.
      }
    }
    return { checked, updated }
  },
})

/**
 * "Check delivery" — refresh the delivery state of this event's sent mail (or
 * of one message). Returns how many receipts are being checked so the UI can
 * say something true immediately; the rows themselves update reactively as the
 * answers come back.
 */
export const refreshDeliveryStatus = mutation({
  args: {
    eventId: v.id("events"),
    messageId: v.optional(v.id("messages")),
  },
  returns: v.object({ checking: v.number(), configured: v.boolean() }),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const handles: Array<Infer<typeof deliveryHandleValidator>> =
      await ctx.runQuery(internal.comms.openDeliveryHandles, {
        eventId: args.eventId,
        messageId: args.messageId,
      })
    if (handles.length > 0) {
      await ctx.scheduler.runAfter(0, internal.comms.pollDeliveryStatus, {
        handles,
      })
    }
    return {
      checking: handles.length,
      configured: process.env.RESEND_API_KEY !== undefined,
    }
  },
})

// ——— Small pure utilities ————————————————————————————————————————————————

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** Base64 without relying on `btoa`/`Buffer` being present in the runtime. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined
    out += B64_ALPHABET[b0 >> 2]
    out += B64_ALPHABET[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? "=" : B64_ALPHABET[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? "=" : B64_ALPHABET[b2 & 0b111111]
  }
  return out
}

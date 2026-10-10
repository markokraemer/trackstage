import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import type { AuditActor } from "./lib/audit"
import { record as recordAudit } from "./lib/audit"
import { queueMessage } from "./comms"
import { scheduleAirtableSync } from "./airtable"
import { emitWebhook } from "./webhooks"
import { friendlyId } from "./lib/friendlyId"
import {
  allowanceSentence,
  allowanceUsed,
  cleanOptionalText,
  cleanSessionLimit,
  cleanSponsorName,
  cleanWebsiteUrl,
  linkContact,
  requireSponsorInEvent,
  sponsorContacts,
  sponsorPortalRules,
  sponsorSessions,
} from "./lib/sponsors"

// ————————————————————————————————————————————————————————————————————————
// Sponsors — the organizer side (Speakers → Sponsors).
//
// A sponsor is a company with a package on the event; its contacts sign into
// the ordinary portal and add the sessions the package includes, with no CFP
// in between. The rules live in convex/lib/sponsors.ts; this module is the
// organizer's CRUD on top of them, plus the `…Core` helpers the MCP server
// (convex/mcp.ts) calls so the two paths can never drift.
// ————————————————————————————————————————————————————————————————————————

export const SPONSOR_INVITE_TEMPLATE_KEY = "sponsor_invite"

function personLabel(person: Doc<"people">): string {
  return `${person.firstName} ${person.lastName}`.trim() || person.email
}

// ——— Reads ————————————————————————————————————————————————————————————————

/** One sponsor as every organizer surface (page, drawer, MCP) reads it. */
export async function sponsorRow(ctx: QueryCtx, sponsor: Doc<"sponsors">) {
  const [contacts, sessions] = await Promise.all([
    sponsorContacts(ctx, sponsor._id),
    sponsorSessions(ctx, sponsor._id),
  ])
  // When each contact was last sent their invite — "did they ever get it?" is
  // the first question when a sponsor says they can't find their portal.
  const invites = await Promise.all(
    contacts.map(async (person) => {
      const recent = await ctx.db
        .query("messages")
        .withIndex("by_personId", (q) => q.eq("personId", person._id))
        .order("desc")
        .take(25)
      const last = recent.find((m) => m.templateKey === SPONSOR_INVITE_TEMPLATE_KEY)
      return last ? (last.scheduledAt ?? last._creationTime) : null
    }),
  )
  return {
    _id: sponsor._id,
    name: sponsor.name,
    tier: sponsor.tier ?? null,
    websiteUrl: sponsor.websiteUrl ?? null,
    notes: sponsor.notes ?? null,
    sessionLimit: sponsor.sessionLimit,
    sessionsUsed: allowanceUsed(sessions),
    contacts: contacts
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((person, index) => ({
        personId: person._id,
        name: personLabel(person),
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        jobTitle: person.jobTitle ?? null,
        // Organizer-only, like the speaker roster's: copying a contact's
        // magic link is how an organizer helps a sponsor who lost the email.
        portalToken: person.portalToken,
        invitedAt: invites[index],
      })),
    sessions: sessions.map((s) => ({
      _id: s._id,
      title: s.title,
      status: s.status,
      kind: s.kind,
      scheduled: s.startsAt !== undefined,
    })),
  }
}

function isoOrNull(ms: number | null | undefined): string | null {
  return ms === undefined || ms === null ? null : new Date(ms).toISOString()
}

/**
 * The public shape of a sponsor — Sessionboard's field names where they exist
 * (`friendly_id`, AccountContact-style `contacts[]` with `is_primary`) plus our
 * extensions. ONE shape for the REST API (convex/apiV1.ts) and every
 * `sponsor.*` webhook, whichever path made the change.
 */
export async function sponsorApiShape(
  ctx: QueryCtx,
  sponsor: Doc<"sponsors">,
): Promise<Record<string, unknown>> {
  const row = await sponsorRow(ctx, sponsor)
  const friendly = friendlyId("SPON", sponsor._id)
  return {
    id: sponsor._id,
    friendly_id: friendly.id,
    friendly_id_raw: friendly.raw,
    name: sponsor.name,
    // Sessionboard fields we don't model — present so their clients can read
    // them without a guard.
    description: null,
    logo_image_url: null,
    banner_image_url: null,
    website_url: sponsor.websiteUrl ?? null,
    created_at: isoOrNull(sponsor._creationTime),
    // Sponsors carry no write timestamp, so this is the creation time and PUT
    // does not enforce optimistic concurrency (documented on the route).
    updated_at: isoOrNull(sponsor._creationTime),
    contacts: row.contacts.map((c, index) => {
      const contactFriendly = friendlyId("CONT", c.personId)
      return {
        id: c.personId,
        friendly_id: contactFriendly.id,
        friendly_id_raw: contactFriendly.raw,
        first_name: c.firstName,
        last_name: c.lastName,
        full_name: c.name,
        email: c.email,
        photo_url: null,
        company_name: sponsor.name,
        title: c.jobTitle,
        about: null,
        // The first contact added is the primary one (the one whose portal
        // the sponsor was set up around).
        is_primary: index === 0,
        invited_at: isoOrNull(c.invitedAt),
      }
    }),
    // ——— Trackstage extensions ———
    tier: sponsor.tier ?? null,
    session_limit: sponsor.sessionLimit,
    sessions_used: row.sessionsUsed,
    notes: sponsor.notes ?? null,
    sessions: row.sessions.map((s) => ({
      id: s._id,
      title: s.title,
      status: s.status,
      kind: s.kind,
      is_scheduled: s.scheduled,
    })),
  }
}


/** Fire `sponsor.*` with the current API shape. Never fails the write. */
async function emitSponsorWebhook(
  ctx: MutationCtx,
  eventId: Id<"events">,
  type: "sponsor.created" | "sponsor.updated" | "sponsor.deleted",
  payload: Record<string, unknown>,
): Promise<void> {
  await emitWebhook(ctx, eventId, type, payload)
}

export async function emitSponsorUpdated(ctx: MutationCtx, sponsorId: Id<"sponsors">) {
  const fresh = await ctx.db.get(sponsorId)
  if (!fresh) return
  await emitSponsorWebhook(ctx, fresh.eventId, "sponsor.updated", await sponsorApiShape(ctx, fresh))
}

export const list = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const sponsors = await ctx.db
      .query("sponsors")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(500)
    const rows = await Promise.all(
      sponsors
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((sponsor) => sponsorRow(ctx, sponsor)),
    )
    return { sponsors: rows, rules: sponsorPortalRules(event) }
  },
})

/** Names only — what the submission drawer's "Sponsor" select renders. */
export const options = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const sponsors = await ctx.db
      .query("sponsors")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(500)
    return sponsors
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ _id: s._id, name: s.name, tier: s.tier ?? null }))
  },
})

// ——— Writes: shared cores (organizer UI + MCP) ———————————————————————————

export interface SponsorFields {
  name: string
  tier?: string
  websiteUrl?: string
  sessionLimit: number
  notes?: string
}

export async function createSponsorCore(
  ctx: MutationCtx,
  event: Doc<"events">,
  fields: SponsorFields,
  contacts: Array<{ email: string; firstName?: string; lastName?: string; jobTitle?: string }>,
  actor?: AuditActor,
): Promise<Id<"sponsors">> {
  const name = cleanSponsorName(fields.name)
  const existing = await ctx.db
    .query("sponsors")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(500)
  if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new ConvexError(`${name} is already a sponsor of this event.`)
  }
  const sponsorId = await ctx.db.insert("sponsors", {
    eventId: event._id,
    name,
    tier: cleanOptionalText(fields.tier),
    websiteUrl: cleanWebsiteUrl(fields.websiteUrl),
    sessionLimit: cleanSessionLimit(fields.sessionLimit),
    notes: cleanOptionalText(fields.notes),
  })
  const sponsor = await ctx.db.get(sponsorId)
  if (!sponsor) throw new Error("Failed to create sponsor")
  for (const contact of contacts) {
    await linkContact(ctx, sponsor, contact)
  }
  await recordAudit(ctx, {
    eventId: event._id,
    entity: "sponsor",
    entityId: sponsorId,
    action: "created",
    summary: `Sponsor added · ${name}`,
    meta: { tier: sponsor.tier, sessionLimit: sponsor.sessionLimit, contacts: contacts.length },
    actor,
  })
  const created = await ctx.db.get(sponsorId)
  if (created) {
    await emitSponsorWebhook(ctx, event._id, "sponsor.created", await sponsorApiShape(ctx, created))
  }
  return sponsorId
}

export async function updateSponsorCore(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  patch: Partial<SponsorFields>,
  actor?: AuditActor,
): Promise<void> {
  const next: Partial<Doc<"sponsors">> = {}
  if (patch.name !== undefined) {
    const name = cleanSponsorName(patch.name)
    if (name.toLowerCase() !== sponsor.name.toLowerCase()) {
      const siblings = await ctx.db
        .query("sponsors")
        .withIndex("by_eventId", (q) => q.eq("eventId", sponsor.eventId))
        .take(500)
      if (siblings.some((s) => s._id !== sponsor._id && s.name.toLowerCase() === name.toLowerCase())) {
        throw new ConvexError(`${name} is already a sponsor of this event.`)
      }
    }
    next.name = name
  }
  // An empty string CLEARS an optional field; absent leaves it alone.
  if (patch.tier !== undefined) next.tier = cleanOptionalText(patch.tier)
  if (patch.websiteUrl !== undefined) next.websiteUrl = cleanWebsiteUrl(patch.websiteUrl)
  if (patch.notes !== undefined) next.notes = cleanOptionalText(patch.notes)
  if (patch.sessionLimit !== undefined) next.sessionLimit = cleanSessionLimit(patch.sessionLimit)
  if (Object.keys(next).length === 0) return
  await ctx.db.patch(sponsor._id, next)
  await recordAudit(ctx, {
    eventId: sponsor.eventId,
    entity: "sponsor",
    entityId: sponsor._id,
    action: "updated",
    summary: `Sponsor updated · ${next.name ?? sponsor.name}`,
    meta: { fields: Object.keys(next) },
    actor,
  })
  await emitSponsorUpdated(ctx, sponsor._id)
}

/**
 * Remove a sponsor. Its sessions STAY on the program (they may already be
 * scheduled and announced) and its contacts stay as people — both simply lose
 * the link, so the contacts' portals stop offering the sponsor tab.
 */
export async function removeSponsorCore(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  actor?: AuditActor,
): Promise<{ contactsUnlinked: number; sessionsUnlinked: number }> {
  // Shaped BEFORE the unlink, so subscribers learn who and what it had.
  const before = await sponsorApiShape(ctx, sponsor)
  const contacts = await sponsorContacts(ctx, sponsor._id)
  for (const person of contacts) await ctx.db.patch(person._id, { sponsorId: undefined })
  const sessions = await ctx.db
    .query("submissions")
    .withIndex("by_sponsorId", (q) => q.eq("sponsorId", sponsor._id))
    .take(500)
  for (const session of sessions) await ctx.db.patch(session._id, { sponsorId: undefined })
  await ctx.db.delete(sponsor._id)
  await recordAudit(ctx, {
    eventId: sponsor.eventId,
    entity: "sponsor",
    entityId: sponsor._id,
    action: "deleted",
    summary: `Sponsor removed · ${sponsor.name}`,
    meta: { contacts: contacts.length, sessions: sessions.length },
    actor,
  })
  await emitSponsorWebhook(ctx, sponsor.eventId, "sponsor.deleted", before)
  return { contactsUnlinked: contacts.length, sessionsUnlinked: sessions.length }
}

export async function addContactCore(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  contact: { email: string; firstName?: string; lastName?: string; jobTitle?: string },
  actor?: AuditActor,
): Promise<{ personId: Id<"people">; created: boolean }> {
  const { person, created } = await linkContact(ctx, sponsor, contact)
  await recordAudit(ctx, {
    eventId: sponsor.eventId,
    entity: "sponsor",
    entityId: sponsor._id,
    action: "contact_added",
    summary: `Contact added to ${sponsor.name} · ${personLabel(person)}`,
    meta: { email: person.email },
    actor,
  })
  await emitSponsorUpdated(ctx, sponsor._id)
  return { personId: person._id, created }
}

export async function removeContactCore(
  ctx: MutationCtx,
  person: Doc<"people">,
  actor?: AuditActor,
): Promise<void> {
  if (!person.sponsorId) return
  const sponsor = await ctx.db.get(person.sponsorId)
  await ctx.db.patch(person._id, { sponsorId: undefined })
  if (sponsor) {
    await recordAudit(ctx, {
      eventId: sponsor.eventId,
      entity: "sponsor",
      entityId: sponsor._id,
      action: "contact_removed",
      summary: `Contact removed from ${sponsor.name} · ${personLabel(person)}`,
      meta: { email: person.email },
      actor,
    })
    await emitSponsorUpdated(ctx, sponsor._id)
  }
}

/**
 * Email the portal invite to some (or all) of a sponsor's contacts through the
 * ordinary outbox — a demo `@example.com` address renders as a preview row, a
 * real one goes out over Resend. The template is editable under
 * Communications → Templates ("Sponsor portal invite").
 */
export async function sendInvitesCore(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  personIds: Array<Id<"people">> | undefined,
): Promise<{ queued: number; recipients: Array<string> }> {
  const contacts = await sponsorContacts(ctx, sponsor._id)
  const targets = personIds
    ? contacts.filter((person) => personIds.includes(person._id))
    : contacts
  if (personIds && targets.length !== personIds.length) {
    throw new ConvexError("Only this sponsor's own contacts can be invited from here.")
  }
  if (targets.length === 0) {
    throw new ConvexError(`${sponsor.name} has no contacts yet — add one first.`)
  }
  const sessions = await sponsorSessions(ctx, sponsor._id)
  const sessionAllowance = allowanceSentence(sponsor, allowanceUsed(sessions))
  for (const person of targets) {
    await queueMessage(ctx, {
      eventId: sponsor.eventId,
      personId: person._id,
      templateKey: SPONSOR_INVITE_TEMPLATE_KEY,
      extraVars: { sponsorName: sponsor.name, sessionAllowance },
    })
  }
  await ctx.scheduler.runAfter(0, internal.comms.deliverPending, {})
  return { queued: targets.length, recipients: targets.map((p) => p.email) }
}

/** Link a session to a sponsor (or unlink it with `null`). */
export async function setSessionSponsorCore(
  ctx: MutationCtx,
  submission: Doc<"submissions">,
  sponsor: Doc<"sponsors"> | null,
  actor?: AuditActor,
): Promise<void> {
  if ((submission.sponsorId ?? null) === (sponsor?._id ?? null)) return
  await ctx.db.patch(submission._id, { sponsorId: sponsor?._id, updatedAt: Date.now() })
  await scheduleAirtableSync(ctx, submission.eventId)
  await recordAudit(ctx, {
    eventId: submission.eventId,
    entity: submission.kind === "session" ? "session" : "submission",
    entityId: submission._id,
    action: "updated",
    summary: sponsor
      ? `Linked to sponsor ${sponsor.name} · ${submission.title}`
      : `Sponsor link removed · ${submission.title}`,
    meta: { sponsor: sponsor?.name ?? null },
    actor,
  })
}

export async function updatePortalRulesCore(
  ctx: MutationCtx,
  event: Doc<"events">,
  patch: {
    newSessionStatus?: "pending" | "accepted"
    closeAt?: number | null
    allowColleagueInvites?: boolean
  },
  actor?: AuditActor,
): Promise<void> {
  const current = event.sponsorPortal ?? {}
  const next = {
    ...current,
    ...(patch.newSessionStatus !== undefined ? { newSessionStatus: patch.newSessionStatus } : {}),
    ...(patch.closeAt !== undefined ? { closeAt: patch.closeAt ?? undefined } : {}),
    ...(patch.allowColleagueInvites !== undefined
      ? { allowColleagueInvites: patch.allowColleagueInvites }
      : {}),
  }
  await ctx.db.patch(event._id, { sponsorPortal: next })
  await recordAudit(ctx, {
    eventId: event._id,
    entity: "settings",
    entityId: event._id,
    action: "updated",
    summary: "Sponsor portal settings changed",
    meta: {
      newSessionStatus: next.newSessionStatus ?? "pending",
      closeAt: next.closeAt ? new Date(next.closeAt).toISOString() : "none",
      allowColleagueInvites: next.allowColleagueInvites ?? true,
    },
    actor,
  })
}

// ——— Writes: the organizer's public mutations ———————————————————————————

const contactArg = v.object({
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
})

export const create = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    tier: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    sessionLimit: v.number(),
    notes: v.optional(v.string()),
    contacts: v.optional(v.array(contactArg)),
  },
  returns: v.id("sponsors"),
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const { eventId: _eventId, contacts, ...fields } = args
    return await createSponsorCore(ctx, event, fields, contacts ?? [])
  },
})

export const update = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    name: v.optional(v.string()),
    tier: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    sessionLimit: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.sponsorId)
    if (!sponsor) throw new ConvexError("Sponsor not found.")
    await requireEventAccess(ctx, sponsor.eventId)
    const { sponsorId: _sponsorId, ...patch } = args
    await updateSponsorCore(ctx, sponsor, patch)
    return null
  },
})

export const remove = mutation({
  args: { sponsorId: v.id("sponsors") },
  returns: v.object({ contactsUnlinked: v.number(), sessionsUnlinked: v.number() }),
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.sponsorId)
    if (!sponsor) throw new ConvexError("Sponsor not found.")
    await requireEventAccess(ctx, sponsor.eventId)
    return await removeSponsorCore(ctx, sponsor)
  },
})

export const addContact = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    /** Queue the portal invite straight away. */
    sendInvite: v.optional(v.boolean()),
  },
  returns: v.object({ personId: v.id("people"), created: v.boolean(), invited: v.boolean() }),
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.sponsorId)
    if (!sponsor) throw new ConvexError("Sponsor not found.")
    await requireEventAccess(ctx, sponsor.eventId)
    const { personId, created } = await addContactCore(ctx, sponsor, args)
    if (args.sendInvite) await sendInvitesCore(ctx, sponsor, [personId])
    return { personId, created, invited: Boolean(args.sendInvite) }
  },
})

export const removeContact = mutation({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId)
    if (!person) throw new ConvexError("Contact not found.")
    await requireEventAccess(ctx, person.eventId)
    await removeContactCore(ctx, person)
    return null
  },
})

export const sendInvites = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    /** Absent ⇒ every contact of the sponsor. */
    personIds: v.optional(v.array(v.id("people"))),
  },
  returns: v.object({ queued: v.number(), recipients: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.sponsorId)
    if (!sponsor) throw new ConvexError("Sponsor not found.")
    await requireEventAccess(ctx, sponsor.eventId)
    return await sendInvitesCore(ctx, sponsor, args.personIds)
  },
})

export const setSessionSponsor = mutation({
  args: {
    submissionId: v.id("submissions"),
    sponsorId: v.union(v.id("sponsors"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission || submission.deletedAt !== undefined) {
      throw new ConvexError("Submission not found.")
    }
    await requireEventAccess(ctx, submission.eventId)
    const sponsor = args.sponsorId
      ? await requireSponsorInEvent(ctx, args.sponsorId, submission.eventId)
      : null
    await setSessionSponsorCore(ctx, submission, sponsor)
    return null
  },
})

export const updatePortalRules = mutation({
  args: {
    eventId: v.id("events"),
    newSessionStatus: v.optional(v.union(v.literal("pending"), v.literal("accepted"))),
    /** `null` clears the deadline. */
    closeAt: v.optional(v.union(v.number(), v.null())),
    allowColleagueInvites: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    await updatePortalRulesCore(ctx, event, {
      newSessionStatus: args.newSessionStatus,
      closeAt: args.closeAt,
      allowColleagueInvites: args.allowColleagueInvites,
    })
    return null
  },
})

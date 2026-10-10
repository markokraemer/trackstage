import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import type { AuditActor } from "./lib/audit"
import { record as recordAudit } from "./lib/audit"
import { queueMessage } from "./comms"
import { sponsorPortalLinkFor } from "./lib/email"
import { scheduleAirtableSync } from "./airtable"
import { assertImageUpload, releaseBlob, storageMeta } from "./lib/files"
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
  cleanDescription,
  fieldsWithValues,
  mergeFieldValues,
  primaryContactOf,
  sponsorFieldsFor,
  sponsorPortalRules,
  sponsorSessions,
  sponsorWindowClosed,
  stillNeeded,
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
  const [contacts, sessions, event, fieldDefs] = await Promise.all([
    sponsorContacts(ctx, sponsor._id),
    sponsorSessions(ctx, sponsor._id),
    ctx.db.get(sponsor.eventId),
    sponsorFieldsFor(ctx, sponsor.eventId),
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
  const primary = primaryContactOf(sponsor, contacts)
  const used = allowanceUsed(sessions)
  const rules = sponsorPortalRules(event)
  const needed = stillNeeded({
    sponsor,
    contacts: invites.map((at) => ({ invited: at !== null })),
    sessionsUsed: used,
    windowOpen: !sponsorWindowClosed(rules, Date.now()),
  })
  const contactRows = contacts
    .sort((a, b) => a._creationTime - b._creationTime)
    .map((person) => ({
      personId: person._id,
      name: personLabel(person),
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      jobTitle: person.jobTitle ?? null,
      // Organizer-only, like the speaker roster's: copying a contact's
      // magic link is how an organizer helps a sponsor who lost the email.
      portalToken: person.portalToken,
      invitedAt: invites[contacts.indexOf(person)],
      isPrimary: primary?._id === person._id,
    }))
  return {
    _id: sponsor._id,
    _creationTime: sponsor._creationTime,
    eventId: sponsor.eventId,
    name: sponsor.name,
    tier: sponsor.tier ?? null,
    websiteUrl: sponsor.websiteUrl ?? null,
    /** The event's company fields with this sponsor's values, in order. */
    fields: fieldsWithValues(fieldDefs, sponsor.fields),
    description: sponsor.description ?? null,
    logoUrl: sponsor.logoId ? await ctx.storage.getUrl(sponsor.logoId) : null,
    publicVisible: sponsor.publicVisible !== false,
    notes: sponsor.notes ?? null,
    sessionLimit: sponsor.sessionLimit,
    sessionsUsed: used,
    // Primary first, then in the order they were added.
    contacts: [
      ...contactRows.filter((c) => c.isPrimary),
      ...contactRows.filter((c) => !c.isPrimary),
    ],
    sessions: sessions.map((s) => ({
      _id: s._id,
      title: s.title,
      status: s.status,
      kind: s.kind,
      scheduled: s.startsAt !== undefined,
    })),
    stillNeeded: needed,
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
    description: row.description,
    logo_image_url: row.logoUrl,
    // Sessionboard's `custom_fields` — the event's own company fields.
    custom_fields: row.fields.map((f) => ({
      id: f.id,
      internal_name: f.label,
      value: f.value,
      public: f.public,
    })),
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
    const [sponsors, tiers] = await Promise.all([
      ctx.db
        .query("sponsors")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .take(500),
      tiersOf(ctx, args.eventId),
    ])
    // Tier order first (Platinum above Gold), untiered last, then by name.
    const rank = (tier: string | undefined) => {
      const index = tiers.findIndex((t) => t.name === tier)
      return index === -1 ? Number.MAX_SAFE_INTEGER : index
    }
    const rows = await Promise.all(
      sponsors
        .sort((a, b) => rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name))
        .map((sponsor) => sponsorRow(ctx, sponsor)),
    )
    return {
      sponsors: rows,
      rules: sponsorPortalRules(event),
      tiers: tiers.map((t) => ({ _id: t._id, name: t.name, sessionLimit: t.sessionLimit })),
      fields: (await sponsorFieldsFor(ctx, args.eventId)).map((f) => ({
        _id: f._id,
        label: f.label,
        kind: f.kind,
        public: f.public,
      })),
    }
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
  description?: string
  /** `{fieldId → value}` — merged; an empty string clears one value. */
  fields?: Record<string, string>
  publicVisible?: boolean
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
  if (patch.description !== undefined) next.description = cleanDescription(patch.description)
  if (patch.fields !== undefined && Object.keys(patch.fields).length > 0) {
    next.fields = mergeFieldValues(
      sponsor.fields,
      await sponsorFieldsFor(ctx, sponsor.eventId),
      patch.fields,
    )
  }
  if (patch.publicVisible !== undefined) next.publicVisible = patch.publicVisible
  if (Object.keys(next).length === 0) return
  await ctx.db.patch(sponsor._id, { ...next, updatedAt: Date.now() })
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
  if (sponsor?.primaryContactId === person._id) {
    await ctx.db.patch(sponsor._id, { primaryContactId: undefined })
  }
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
      // {{portalLink}} in this template opens the SPONSOR portal.
      extraVars: {
        sponsorName: sponsor.name,
        sessionAllowance,
        portalLink: sponsorPortalLinkFor(person.portalToken),
      },
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
    description: v.optional(v.string()),
    fields: v.optional(v.record(v.string(), v.string())),
    publicVisible: v.optional(v.boolean()),
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

/** Make one of the sponsor's contacts the primary one. */
export const setPrimaryContact = mutation({
  args: { sponsorId: v.id("sponsors"), personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.sponsorId)
    if (!sponsor) throw new ConvexError("Sponsor not found.")
    await requireEventAccess(ctx, sponsor.eventId)
    const person = await ctx.db.get(args.personId)
    if (!person || person.sponsorId !== sponsor._id) {
      throw new ConvexError("That person isn't a contact for this sponsor.")
    }
    await ctx.db.patch(sponsor._id, { primaryContactId: person._id, updatedAt: Date.now() })
    await recordAudit(ctx, {
      eventId: sponsor.eventId,
      entity: "sponsor",
      entityId: sponsor._id,
      action: "updated",
      summary: `Primary contact for ${sponsor.name} · ${personLabel(person)}`,
      meta: { email: person.email },
    })
    await emitSponsorUpdated(ctx, sponsor._id)
    return null
  },
})

/**
 * Set or clear (`storageId: null`) a sponsor's logo — shared by the organizer
 * (here) and the sponsor's own portal (convex/sponsorTasks.ts). A current
 * value, like event branding: the replaced blob is deleted.
 */
export async function setSponsorLogoCore(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  storageId: Id<"_storage"> | null,
  filename: string | undefined,
  actor?: AuditActor,
): Promise<void> {
  if (storageId !== null) {
    const meta = await storageMeta(ctx, storageId)
    if (!meta) throw new ConvexError("That upload didn't finish — please try again.")
    assertImageUpload(meta, filename ?? "logo")
  }
  const previous = sponsor.logoId
  await ctx.db.patch(sponsor._id, { logoId: storageId ?? undefined, updatedAt: Date.now() })
  if (previous && previous !== storageId) await releaseBlob(ctx, previous)
  await recordAudit(ctx, {
    eventId: sponsor.eventId,
    entity: "sponsor",
    entityId: sponsor._id,
    action: "updated",
    summary: storageId ? `Logo updated · ${sponsor.name}` : `Logo removed · ${sponsor.name}`,
    actor,
  })
  await emitSponsorUpdated(ctx, sponsor._id)
}

export const setLogo = mutation({
  args: {
    sponsorId: v.id("sponsors"),
    storageId: v.union(v.id("_storage"), v.null()),
    filename: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sponsor = await ctx.db.get(args.sponsorId)
    if (!sponsor) throw new ConvexError("Sponsor not found.")
    await requireEventAccess(ctx, sponsor.eventId)
    await setSponsorLogoCore(ctx, sponsor, args.storageId, args.filename)
    return null
  },
})

// ——— Tiers ————————————————————————————————————————————————————————————————

async function tiersOf(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  const rows = await ctx.db
    .query("sponsorTiers")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(100)
  return rows.sort((a, b) => a.order - b.order)
}

/**
 * Create or update a tier. Renaming one renames it on every sponsor in it —
 * the sponsor's `tier` is the tier's name, so they move together.
 */
export const saveTier = mutation({
  args: {
    eventId: v.id("events"),
    tierId: v.optional(v.id("sponsorTiers")),
    name: v.string(),
    sessionLimit: v.number(),
  },
  returns: v.id("sponsorTiers"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const name = args.name.trim()
    if (!name) throw new ConvexError("Give the tier a name.")
    if (name.length > 60) throw new ConvexError("Keep tier names under 60 characters.")
    const sessionLimit = cleanSessionLimit(args.sessionLimit)
    const tiers = await tiersOf(ctx, args.eventId)
    if (tiers.some((t) => t._id !== args.tierId && t.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError(`There's already a tier called ${name}.`)
    }
    if (!args.tierId) {
      const id = await ctx.db.insert("sponsorTiers", {
        eventId: args.eventId,
        name,
        sessionLimit,
        order: (tiers.at(-1)?.order ?? 0) + 10,
      })
      await recordAudit(ctx, {
        eventId: args.eventId,
        entity: "settings",
        entityId: id,
        action: "created",
        summary: `Sponsor tier added · ${name}`,
      })
      return id
    }
    const tier = tiers.find((t) => t._id === args.tierId)
    if (!tier) throw new ConvexError("Tier not found.")
    await ctx.db.patch(tier._id, { name, sessionLimit })
    if (tier.name !== name) {
      const sponsors = await ctx.db
        .query("sponsors")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .take(500)
      for (const sponsor of sponsors) {
        if (sponsor.tier === tier.name) await ctx.db.patch(sponsor._id, { tier: name })
      }
    }
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "settings",
      entityId: tier._id,
      action: "updated",
      summary: tier.name === name ? `Sponsor tier updated · ${name}` : `Sponsor tier renamed · ${tier.name} → ${name}`,
    })
    return tier._id
  },
})

/** Remove a tier. Its sponsors keep everything but the tier label. */
export const removeTier = mutation({
  args: { tierId: v.id("sponsorTiers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tier = await ctx.db.get(args.tierId)
    if (!tier) throw new ConvexError("Tier not found.")
    await requireEventAccess(ctx, tier.eventId)
    const sponsors = await ctx.db
      .query("sponsors")
      .withIndex("by_eventId", (q) => q.eq("eventId", tier.eventId))
      .take(500)
    for (const sponsor of sponsors) {
      if (sponsor.tier === tier.name) await ctx.db.patch(sponsor._id, { tier: undefined })
    }
    await ctx.db.delete(tier._id)
    await recordAudit(ctx, {
      eventId: tier.eventId,
      entity: "settings",
      entityId: tier._id,
      action: "deleted",
      summary: `Sponsor tier removed · ${tier.name}`,
    })
    return null
  },
})

// ——— Company fields ——————————————————————————————————————————————————————

const fieldKindArg = v.union(v.literal("text"), v.literal("longText"), v.literal("url"))

/** Create or update one of the event's company fields. */
export const saveField = mutation({
  args: {
    eventId: v.id("events"),
    fieldId: v.optional(v.id("sponsorFields")),
    label: v.string(),
    kind: fieldKindArg,
    public: v.boolean(),
  },
  returns: v.id("sponsorFields"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const label = args.label.trim()
    if (!label) throw new ConvexError("Give the field a label.")
    if (label.length > 60) throw new ConvexError("Keep field labels under 60 characters.")
    const fields = await sponsorFieldsFor(ctx, args.eventId)
    if (fields.some((f) => f._id !== args.fieldId && f.label.toLowerCase() === label.toLowerCase())) {
      throw new ConvexError(`There's already a field called ${label}.`)
    }
    if (!args.fieldId) {
      const id = await ctx.db.insert("sponsorFields", {
        eventId: args.eventId,
        label,
        kind: args.kind,
        public: args.public,
        order: (fields.at(-1)?.order ?? 0) + 10,
      })
      await recordAudit(ctx, {
        eventId: args.eventId,
        entity: "settings",
        entityId: id,
        action: "created",
        summary: `Sponsor field added · ${label}`,
      })
      return id
    }
    const field = fields.find((f) => f._id === args.fieldId)
    if (!field) throw new ConvexError("Field not found.")
    await ctx.db.patch(field._id, { label, kind: args.kind, public: args.public })
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "settings",
      entityId: field._id,
      action: "updated",
      summary: `Sponsor field updated · ${label}`,
    })
    return field._id
  },
})

/** Remove a company field — and every sponsor's value for it. */
export const removeField = mutation({
  args: { fieldId: v.id("sponsorFields") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const field = await ctx.db.get(args.fieldId)
    if (!field) throw new ConvexError("Field not found.")
    await requireEventAccess(ctx, field.eventId)
    const sponsors = await ctx.db
      .query("sponsors")
      .withIndex("by_eventId", (q) => q.eq("eventId", field.eventId))
      .take(500)
    for (const sponsor of sponsors) {
      if (sponsor.fields && field._id in sponsor.fields) {
        const { [field._id]: _dropped, ...rest } = sponsor.fields
        await ctx.db.patch(sponsor._id, { fields: rest })
      }
    }
    await ctx.db.delete(field._id)
    await recordAudit(ctx, {
      eventId: field.eventId,
      entity: "settings",
      entityId: field._id,
      action: "deleted",
      summary: `Sponsor field removed · ${field.label}`,
    })
    return null
  },
})

export const reorderFields = mutation({
  args: { eventId: v.id("events"), fieldIds: v.array(v.id("sponsorFields")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const fields = await sponsorFieldsFor(ctx, args.eventId)
    for (const [index, fieldId] of args.fieldIds.entries()) {
      const field = fields.find((f) => f._id === fieldId)
      if (field) await ctx.db.patch(field._id, { order: (index + 1) * 10 })
    }
    return null
  },
})

/** Reorder tiers (top = most prominent on the sponsor wall). */
export const reorderTiers = mutation({
  args: { eventId: v.id("events"), tierIds: v.array(v.id("sponsorTiers")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const tiers = await tiersOf(ctx, args.eventId)
    for (const [index, tierId] of args.tierIds.entries()) {
      const tier = tiers.find((t) => t._id === tierId)
      if (tier) await ctx.db.patch(tier._id, { order: (index + 1) * 10 })
    }
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

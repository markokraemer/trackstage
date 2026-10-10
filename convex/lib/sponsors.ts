import { ConvexError } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { randomToken, requirePerson } from "./auth"

// ————————————————————————————————————————————————————————————————————————
// Sponsors — the shared rules behind the organizer's Sponsors page
// (convex/sponsors.ts), the MCP tools (convex/mcp.ts) and the sponsor side of
// the portal (convex/portal.ts).
//
// The model in one paragraph: a sponsor is a COMPANY on an event. Its contacts
// are ordinary `people` rows carrying `sponsorId`, so they sign in through the
// same passwordless portal link as every speaker. The sessions it adds are
// ordinary `submissions` rows carrying `sponsorId`, so the pipeline, agenda,
// emails, webhooks and API need no special case. What a sponsor adds is
// bounded by `sessionLimit` (its package) and by the event's sponsor window
// (`events.sponsorPortal.closeAt`) — both enforced here, once.
//
// Kelsey (AI Engineer ops), on why this exists: "not all submissions come
// through [the CFP] … if OpenAI has a sponsor, OpenAI has a main login, then
// they go in and add the sessions that they want."
// ————————————————————————————————————————————————————————————————————————

/** Ceiling on any single sponsor-scoped scan (contacts, sessions). */
export const MAX_SPONSOR_ROWS = 500
/** A package that allows more sessions than this is a typo. */
export const MAX_SESSION_LIMIT = 50

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeSponsorEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(trimmed)) {
    throw new ConvexError(`"${email.trim()}" isn't a valid email address.`)
  }
  return trimmed
}

export function cleanSponsorName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new ConvexError("Give the sponsor a name.")
  if (trimmed.length > 120) {
    throw new ConvexError("That sponsor name is too long — keep it under 120 characters.")
  }
  return trimmed
}

export function cleanSessionLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 0 || Math.floor(limit) !== limit) {
    throw new ConvexError("The session allowance must be a whole number, 0 or more.")
  }
  if (limit > MAX_SESSION_LIMIT) {
    throw new ConvexError(
      `A sponsor can be allowed at most ${MAX_SESSION_LIMIT} sessions.`,
    )
  }
  return limit
}

export function cleanOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

/**
 * The sponsor's website, which the public session page renders as a link — so
 * only http(s) ever gets stored (no `javascript:`), and a bare "acme.ai" is
 * forgiven with an https:// prefix. Empty clears it.
 */
export function cleanWebsiteUrl(value: string | undefined): string | undefined {
  const trimmed = cleanOptionalText(value)
  if (trimmed === undefined) return undefined
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new ConvexError(`"${trimmed}" isn't a valid website address.`)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConvexError("The website must start with https:// or http://.")
  }
  return url.toString()
}

/**
 * A sponsor that belongs to this event, or the same "not found" a stranger
 * would get — never a hint that it exists elsewhere.
 */
export async function requireSponsorInEvent(
  ctx: QueryCtx | MutationCtx,
  sponsorId: Id<"sponsors">,
  eventId: Id<"events">,
): Promise<Doc<"sponsors">> {
  const sponsor = await ctx.db.get(sponsorId)
  if (!sponsor || sponsor.eventId !== eventId) {
    throw new ConvexError("Sponsor not found.")
  }
  return sponsor
}

export async function sponsorContacts(
  ctx: QueryCtx | MutationCtx,
  sponsorId: Id<"sponsors">,
): Promise<Array<Doc<"people">>> {
  return await ctx.db
    .query("people")
    .withIndex("by_sponsorId", (q) => q.eq("sponsorId", sponsorId))
    .take(MAX_SPONSOR_ROWS)
}

/** Every live (not soft-deleted) session linked to the sponsor, newest first. */
export async function sponsorSessions(
  ctx: QueryCtx | MutationCtx,
  sponsorId: Id<"sponsors">,
): Promise<Array<Doc<"submissions">>> {
  const rows = await ctx.db
    .query("submissions")
    .withIndex("by_sponsorId", (q) => q.eq("sponsorId", sponsorId))
    .order("desc")
    .take(MAX_SPONSOR_ROWS)
  return rows.filter((s) => s.deletedAt === undefined)
}

/**
 * Does this session use up one of the package's slots? Withdrawn and declined
 * sessions hand their slot back — a sponsor whose first idea was turned down
 * should be able to propose another without emailing anyone.
 */
export function countsAgainstAllowance(session: Doc<"submissions">): boolean {
  return session.status !== "withdrawn" && session.status !== "declined"
}

export function allowanceUsed(sessions: Array<Doc<"submissions">>): number {
  return sessions.filter(countsAgainstAllowance).length
}

// ——— The event-level sponsor window ————————————————————————————————————

export interface SponsorPortalRules {
  newSessionStatus: "pending" | "accepted"
  closeAt: number | null
  allowColleagueInvites: boolean
}

export function sponsorPortalRules(event: Doc<"events"> | null): SponsorPortalRules {
  return {
    newSessionStatus: event?.sponsorPortal?.newSessionStatus ?? "pending",
    closeAt: event?.sponsorPortal?.closeAt ?? null,
    allowColleagueInvites: event?.sponsorPortal?.allowColleagueInvites ?? true,
  }
}

export function sponsorWindowClosed(rules: SponsorPortalRules, now: number): boolean {
  return rules.closeAt !== null && rules.closeAt <= now
}

function formatCloseDate(closeAt: number, timezone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(closeAt)
  } catch {
    return new Date(closeAt).toUTCString()
  }
}

/** The sentence a sponsor reads when the window has shut. */
export function sponsorClosedMessage(
  closeAt: number,
  timezone: string | undefined,
): string {
  return `Sponsor sessions closed on ${formatCloseDate(closeAt, timezone)}. Email the organizers and they can make the change for you.`
}

/**
 * Why this sponsor can't add another session right now, or null when it can.
 * One sentence, used by the portal to explain the disabled button AND by the
 * mutation to refuse — so the two can never disagree.
 */
export function addSessionBlocker(
  sponsor: Doc<"sponsors">,
  used: number,
  rules: SponsorPortalRules,
  timezone: string | undefined,
  now: number,
): string | null {
  if (rules.closeAt !== null && sponsorWindowClosed(rules, now)) {
    return sponsorClosedMessage(rules.closeAt, timezone)
  }
  if (sponsor.sessionLimit === 0) {
    return "Your package doesn't include sessions you add yourself. The organizers will add any sessions for you."
  }
  if (used >= sponsor.sessionLimit) {
    return `You've added all ${sponsor.sessionLimit} session${sponsor.sessionLimit === 1 ? "" : "s"} your package includes. Withdraw one to propose another, or ask the organizers for more.`
  }
  return null
}

/** "2 sessions" / "1 session" / "no sessions" — for emails and summaries. */
export function allowanceSentence(sponsor: Doc<"sponsors">, used: number): string {
  if (sponsor.sessionLimit === 0) {
    return "The organizers will add your sessions for you — you'll see them in the portal as soon as they do."
  }
  const left = Math.max(0, sponsor.sessionLimit - used)
  const total = `${sponsor.sessionLimit} session${sponsor.sessionLimit === 1 ? "" : "s"}`
  if (used === 0) return `Your package includes ${total}.`
  return `Your package includes ${total}; ${left} still to add.`
}

// ——— Contacts ———————————————————————————————————————————————————————————

export interface ContactInput {
  email: string
  firstName?: string
  lastName?: string
  jobTitle?: string
}

/**
 * Make `input.email` a contact of `sponsor`. Idempotent on email within the
 * event: an existing person (a speaker who also handles their company's
 * sponsorship) is linked rather than duplicated, and only blank name fields
 * are filled in — a contact never overwrites somebody's own profile.
 *
 * A person is a contact for ONE sponsor per event; asking to move them is
 * refused with the sponsor they already belong to, so nobody quietly loses
 * access to another company's sessions.
 */
export async function linkContact(
  ctx: MutationCtx,
  sponsor: Doc<"sponsors">,
  input: ContactInput,
): Promise<{ person: Doc<"people">; created: boolean }> {
  const email = normalizeSponsorEmail(input.email)
  const firstName = input.firstName?.trim() ?? ""
  const lastName = input.lastName?.trim() ?? ""
  const jobTitle = cleanOptionalText(input.jobTitle)

  const existing = await ctx.db
    .query("people")
    .withIndex("by_eventId_and_email", (q) =>
      q.eq("eventId", sponsor.eventId).eq("email", email),
    )
    .unique()

  if (existing) {
    if (existing.sponsorId && existing.sponsorId !== sponsor._id) {
      const other = await ctx.db.get(existing.sponsorId)
      throw new ConvexError(
        `${email} is already a contact for ${other?.name ?? "another sponsor"}. Remove them there first.`,
      )
    }
    await ctx.db.patch(existing._id, {
      sponsorId: sponsor._id,
      firstName: existing.firstName || firstName,
      lastName: existing.lastName || lastName,
      jobTitle: existing.jobTitle ?? jobTitle,
      company: existing.company ?? sponsor.name,
    })
    const person = await ctx.db.get(existing._id)
    if (!person) throw new Error("Contact vanished mid-update")
    return { person, created: false }
  }

  const personId = await ctx.db.insert("people", {
    eventId: sponsor.eventId,
    email,
    firstName,
    lastName,
    jobTitle,
    company: sponsor.name,
    portalToken: randomToken(),
    sponsorId: sponsor._id,
  })
  const person = await ctx.db.get(personId)
  if (!person) throw new Error("Failed to create contact")
  return { person, created: true }
}

// ——— Session speakers ——————————————————————————————————————————————————

export interface SpeakerInput {
  email: string
  firstName: string
  lastName: string
}

/**
 * The person behind a speaker a sponsor named, created when new. An existing
 * person keeps their own profile untouched — a sponsor typing a colleague's
 * name differently must never rename a speaker the organizers already know.
 */
export async function resolveSpeaker(
  ctx: MutationCtx,
  eventId: Id<"events">,
  sponsor: Doc<"sponsors">,
  input: SpeakerInput,
): Promise<Doc<"people">> {
  const email = normalizeSponsorEmail(input.email)
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  if (!firstName) throw new ConvexError(`Add a first name for ${email}.`)
  const existing = await ctx.db
    .query("people")
    .withIndex("by_eventId_and_email", (q) =>
      q.eq("eventId", eventId).eq("email", email),
    )
    .unique()
  if (existing) return existing
  const personId = await ctx.db.insert("people", {
    eventId,
    email,
    firstName,
    lastName,
    company: sponsor.name,
    portalToken: randomToken(),
  })
  const person = await ctx.db.get(personId)
  if (!person) throw new Error("Failed to create speaker")
  return person
}

/**
 * Abuse ceiling only — never shown, never a product rule. A real panel never
 * gets near it; it just stops a script from attaching thousands of people.
 */
export const MAX_SPONSOR_SESSION_SPEAKERS = 50

// ——— Portal access ———————————————————————————————————————————————————————

/** The signed-in contact, their sponsor and event — or a plain refusal. */
export async function requireSponsorContact(
  ctx: QueryCtx | MutationCtx,
  portalToken: string,
) {
  const person = await requirePerson(ctx, portalToken)
  const sponsor = person.sponsorId ? await ctx.db.get(person.sponsorId) : null
  if (!sponsor || sponsor.eventId !== person.eventId) {
    throw new ConvexError(
      "Only sponsor contacts can do this. Ask the organizers to add you to your company.",
    )
  }
  const event = await ctx.db.get(person.eventId)
  if (!event) throw new ConvexError("Event not found")
  return { person, sponsor, event }
}

// ——— "What's still needed" ——————————————————————————————————————————————

/** The primary contact: the one chosen, else the first added. */
export function primaryContactOf(
  sponsor: Doc<"sponsors">,
  contacts: Array<Doc<"people">>,
): Doc<"people"> | null {
  const chosen = sponsor.primaryContactId
    ? contacts.find((c) => c._id === sponsor.primaryContactId)
    : undefined
  if (chosen) return chosen
  return [...contacts].sort((a, b) => a._creationTime - b._creationTime).at(0) ?? null
}

export interface StillNeeded {
  key: string
  label: string
  /** Who has to act: the sponsor, or the organizers. */
  owner: "sponsor" | "organizer"
  dueAt?: number
}

/**
 * Everything standing between this sponsor and "all set" — ONE list, so the
 * organizer's "Still needed" column, the sponsor portal's overview and the
 * dashboard can never disagree. Ordered: organizer blockers first (nobody can
 * sign in), then the sponsor's own to-dos.
 */
export function stillNeeded(input: {
  sponsor: Doc<"sponsors">
  contacts: Array<{ invited: boolean }>
  sessionsUsed: number
  windowOpen: boolean
}): Array<StillNeeded> {
  const out: Array<StillNeeded> = []
  const { sponsor, contacts } = input
  if (contacts.length === 0) {
    out.push({ key: "contact", label: "No contact", owner: "organizer" })
  } else if (contacts.some((c) => !c.invited)) {
    out.push({ key: "invite", label: "Not invited", owner: "organizer" })
  }
  if (!sponsor.logoId) out.push({ key: "logo", label: "Logo", owner: "sponsor" })
  if (!sponsor.description?.trim()) {
    out.push({ key: "description", label: "Company description", owner: "sponsor" })
  }
  const left = sponsor.sessionLimit - input.sessionsUsed
  if (input.windowOpen && sponsor.sessionLimit > 0 && left > 0) {
    out.push({
      key: "sessions",
      label: `${left} session${left === 1 ? "" : "s"} to add`,
      owner: "sponsor",
    })
  }
  return out
}

const LINK_PATTERN = /^[a-z][a-z0-9+.-]*:/i

/** A social/profile link: http(s) only, bare domains forgiven, empty clears. */
export function cleanProfileUrl(value: string | undefined, label: string): string | undefined {
  const trimmed = cleanOptionalText(value)
  if (trimmed === undefined) return undefined
  const withScheme = LINK_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme")
    return url.toString()
  } catch {
    throw new ConvexError(`That ${label} link doesn't look right.`)
  }
}

/** The public blurb: trimmed, and short enough to read on a sponsor wall. */
export function cleanDescription(value: string | undefined): string | undefined {
  const trimmed = cleanOptionalText(value)
  if (trimmed && trimmed.length > 600) {
    throw new ConvexError("Keep the description under 600 characters — it's read on the sponsor wall.")
  }
  return trimmed
}

// ——— Company fields ——————————————————————————————————————————————————————

const FIELD_LIMITS = { text: 200, longText: 2000, url: 500 } as const

/** One value for one field, cleaned for its kind. Empty ⇒ undefined (cleared). */
export function cleanFieldValue(field: Doc<"sponsorFields">, raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (field.kind === "url") return cleanProfileUrl(trimmed, field.label)
  if (trimmed.length > FIELD_LIMITS[field.kind]) {
    throw new ConvexError(`Keep ${field.label} under ${FIELD_LIMITS[field.kind]} characters.`)
  }
  return trimmed
}

export async function sponsorFieldsFor(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
): Promise<Array<Doc<"sponsorFields">>> {
  const rows = await ctx.db
    .query("sponsorFields")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(100)
  return rows.sort((a, b) => a.order - b.order)
}

/**
 * Merge a `{fieldId → value}` patch into a sponsor's values. Only fields the
 * event defines are accepted; an empty string clears that one value.
 */
export function mergeFieldValues(
  current: Record<string, string> | undefined,
  definitions: Array<Doc<"sponsorFields">>,
  patch: Record<string, string>,
): Record<string, string> {
  const next = { ...(current ?? {}) }
  for (const [fieldId, raw] of Object.entries(patch)) {
    const field = definitions.find((f) => f._id === fieldId)
    if (!field) throw new ConvexError("That field doesn't exist on this event any more — reload and try again.")
    const value = cleanFieldValue(field, raw)
    if (value === undefined) delete next[fieldId]
    else next[fieldId] = value
  }
  return next
}

/** Definitions joined with one sponsor's values, in display order. */
export function fieldsWithValues(
  definitions: Array<Doc<"sponsorFields">>,
  values: Record<string, string> | undefined,
) {
  return definitions.map((f) => ({
    id: f._id,
    label: f.label,
    kind: f.kind,
    public: f.public,
    value: values?.[f._id] ?? null,
  }))
}

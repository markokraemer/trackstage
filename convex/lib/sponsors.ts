import { ConvexError } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { randomToken } from "./auth"

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

/** Speakers per sponsor session — the agenda card gets crowded beyond this. */
export const MAX_SPONSOR_SESSION_SPEAKERS = 8

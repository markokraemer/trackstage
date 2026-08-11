import type { Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

// Simple team-model auth for the demo. Organizer sessions are opaque tokens
// stored in orgSessions; speaker/portal access uses per-person portal tokens.
// Cross-event data isolation is enforced by every query filtering on eventId —
// helpers here only establish WHO is calling.

export async function requireOrganizer(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  const session = await ctx.db
    .query("orgSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .unique()
  if (!session) throw new Error("Not signed in. Please log in as an organizer.")
  const organizer = await ctx.db.get(session.organizerId)
  if (!organizer) throw new Error("Organizer account no longer exists.")
  return organizer
}

export async function requirePerson(
  ctx: QueryCtx | MutationCtx,
  portalToken: string,
) {
  const person = await ctx.db
    .query("people")
    .withIndex("by_portalToken", (q) => q.eq("portalToken", portalToken))
    .unique()
  if (!person) throw new Error("Invalid or expired portal link.")
  return person
}

export async function requirePersonInEvent(
  ctx: QueryCtx | MutationCtx,
  portalToken: string,
  eventId: Id<"events">,
) {
  const person = await requirePerson(ctx, portalToken)
  if (person.eventId !== eventId) {
    throw new Error("This portal link belongs to a different event.")
  }
  return person
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

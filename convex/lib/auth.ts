import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { authComponent } from "../auth"

// ————————————————————————————————————————————————————————————————————————
// Authorization layer. Authentication is Better Auth (users/sessions live in
// the component); authorization is explicit here:
//   organizations ← members (userId, role) ← events ← everything else
// Roles: owner > admin > member. Every organizer-facing function calls
// requireEventAccess (or requireMembership) — cross-org isolation depends on
// these checks plus eventId-scoped queries.
// Speaker portal + evaluator flows stay magic-token based (passwordless
// personas, not org members).
// ————————————————————————————————————————————————————————————————————————

const ROLE_RANK: Record<string, number> = { member: 0, admin: 1, owner: 2 }

export type AuthedUser = { userId: string; email: string; name?: string }

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthedUser> {
  // getAuthUser throws when unauthenticated (typed non-null).
  const user = await authComponent.getAuthUser(ctx)
  return { userId: user._id, email: user.email, name: user.name || undefined }
}

/**
 * The membership check itself, for an EXPLICIT user id.
 *
 * `requireMembership` (ctx.auth-driven) and the MCP server (API-key-driven,
 * see convex/mcp.ts) both funnel through this, so both paths enforce exactly
 * the same rule — there is only one authorization implementation to audit.
 */
export async function membershipFor(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  organizationId: Id<"organizations">,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<Doc<"members">> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique()
  if (!member) {
    throw new Error("You don't have access to this workspace.")
  }
  if ((ROLE_RANK[member.role] ?? -1) < ROLE_RANK[minRole]) {
    throw new Error(
      `This action requires the ${minRole} role (you are ${member.role}).`,
    )
  }
  return member
}

/** Same, but resolving the organization from an event (explicit user id). */
export async function eventAccessFor(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  eventId: Id<"events">,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<{ member: Doc<"members">; event: Doc<"events"> }> {
  const event = await ctx.db.get(eventId)
  if (!event || !event.organizationId) throw new Error("Event not found.")
  const member = await membershipFor(
    ctx,
    userId,
    event.organizationId,
    minRole,
  )
  return { member, event }
}

export async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<{ user: AuthedUser; member: Doc<"members"> }> {
  const user = await requireUser(ctx)
  const member = await membershipFor(
    ctx,
    user.userId,
    organizationId,
    minRole,
  )
  return { user, member }
}

export async function requireEventAccess(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<{ user: AuthedUser; member: Doc<"members">; event: Doc<"events"> }> {
  const event = await ctx.db.get(eventId)
  if (!event) throw new Error("Event not found.")
  if (!event.organizationId) {
    // Legacy pre-multi-tenancy row awaiting purge (see seed.run).
    throw new Error("Event not found.")
  }
  const { user, member } = await requireMembership(
    ctx,
    event.organizationId,
    minRole,
  )
  return { user, member, event }
}

/** Organizations the current user belongs to (empty when signed out). */
export async function myMemberships(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx)
  if (!user) return []
  return await ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect()
}

// ——— Passwordless personas (unchanged) ————————————————————————————————————

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

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

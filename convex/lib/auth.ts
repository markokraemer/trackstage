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
  const user = await authComponent.getAuthUser(ctx)
  if (!user) throw new Error("Not signed in.")
  return { userId: user._id, email: user.email, name: user.name ?? undefined }
}

export async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<{ user: AuthedUser; member: Doc<"members"> }> {
  const user = await requireUser(ctx)
  const member = await ctx.db
    .query("members")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", user.userId),
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
  return { user, member }
}

export async function requireEventAccess(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
  minRole: "member" | "admin" | "owner" = "member",
): Promise<{ user: AuthedUser; member: Doc<"members">; event: Doc<"events"> }> {
  const event = await ctx.db.get(eventId)
  if (!event) throw new Error("Event not found.")
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

import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import {
  isWorkspaceWideRole,
  myMemberships,
  requireMembership,
  requireUser,
} from "./lib/auth"

// Organizations ("workspaces") — the multi-tenancy root. Every event belongs
// to exactly one organization; users see only their organizations' data.

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const memberships = await myMemberships(ctx)
    return await Promise.all(
      memberships.map(async (member) => {
        const org = await ctx.db.get(member.organizationId)
        return org
          ? { id: org._id, name: org.name, slug: org.slug, role: member.role }
          : null
      }),
    ).then((rows) => rows.filter((r) => r !== null))
  },
})

// Idempotent: called after first sign-in so every user lands in a workspace.
export const ensure = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)

    // Claim any pending memberships added by email before this user existed.
    const pending = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .collect()
    for (const row of pending) {
      if (row.userId === "") await ctx.db.patch(row._id, { userId: user.userId })
    }

    const existing = await myMemberships(ctx)
    if (existing.length > 0) {
      const org = await ctx.db.get(existing[0].organizationId)
      return { organizationId: existing[0].organizationId, slug: org?.slug }
    }
    const name =
      args.name ?? `${user.name ?? user.email.split("@")[0]}'s workspace`
    const base =
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
      "workspace"
    let slug = base
    for (let i = 2; ; i++) {
      const clash = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
      if (!clash) break
      slug = `${base}-${i}`
    }
    const organizationId = await ctx.db.insert("organizations", { name, slug })
    await ctx.db.insert("members", {
      organizationId,
      userId: user.userId,
      email: user.email,
      role: "owner",
    })
    return { organizationId, slug }
  },
})

export const members = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId)
    return await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()
  },
})

/**
 * Narrows a caller-supplied list of event ids to events that really belong to
 * this workspace — otherwise an admin could pin a member to an event in
 * someone else's workspace, and the scope check would silently never match.
 */
async function checkedEventIds(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  eventIds: Array<Id<"events">>,
): Promise<Array<Id<"events">>> {
  const unique = [...new Set(eventIds)]
  for (const eventId of unique) {
    const event = await ctx.db.get(eventId)
    if (!event || event.organizationId !== organizationId) {
      throw new Error("That event isn't part of this workspace.")
    }
  }
  return unique
}

// Add a teammate by email. The membership row is created straight away with an
// empty userId and linked on their first sign-in (see `ensure` above), so the
// access scope chosen here is already in force the moment they arrive.
export const addMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.string(), // admin | member
    /**
     * Optional per-event scope for a `member` invite (docs/memory/RULES.md 23).
     * Omitted ⇒ every event in the workspace. Ignored for admins, who always
     * have the whole workspace.
     */
    eventIds: v.optional(v.array(v.id("events"))),
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.organizationId, "admin")
    if (!["admin", "member"].includes(args.role)) {
      throw new Error("Role must be admin or member.")
    }
    const scoped =
      args.role === "member" && args.eventIds !== undefined
        ? await checkedEventIds(ctx, args.organizationId, args.eventIds)
        : undefined
    if (scoped !== undefined && scoped.length === 0) {
      throw new Error("Pick at least one event, or give them all events.")
    }
    const email = args.email.toLowerCase().trim()
    const existing = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect()
    if (existing.some((m) => m.email === email)) {
      throw new Error("That person is already a member.")
    }
    // The userId is resolved when they first sign in (ensure() links by email
    // is not possible without their user id) — so we require they exist:
    // stored with empty userId and linked on their next ensure() call.
    await ctx.db.insert("members", {
      organizationId: args.organizationId,
      userId: "",
      email,
      role: args.role,
      ...(scoped !== undefined ? { eventIds: scoped } : {}),
    })
    // Invite email (Resend) — linked automatically when they sign up.
    const org = await ctx.db.get(args.organizationId)
    let eventScope: string | undefined
    if (scoped !== undefined) {
      if (scoped.length === 1) {
        eventScope = (await ctx.db.get(scoped[0]))?.name ?? "1 event"
      } else {
        eventScope = `${scoped.length} events`
      }
    }
    await ctx.scheduler.runAfter(0, internal.platformEmails.sendWorkspaceInvite, {
      toEmail: email,
      workspaceName: org?.name ?? "your team's workspace",
      inviterName: user.name ?? user.email,
      role: args.role,
      ...(eventScope ? { eventScope } : {}),
    })
    return null
  },
})

export const removeMember = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId)
    if (!target) return null
    const { member } = await requireMembership(
      ctx,
      target.organizationId,
      "admin",
    )
    if (target._id === member._id) {
      throw new Error("You can't remove yourself.")
    }
    if (target.role === "owner") {
      throw new Error("Owners can't be removed.")
    }
    await ctx.db.delete(args.memberId)
    return null
  },
})

export const updateMemberRole = mutation({
  args: { memberId: v.id("members"), role: v.string() },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId)
    if (!target) throw new Error("Member not found.")
    await requireMembership(ctx, target.organizationId, "owner")
    if (!["admin", "member"].includes(args.role)) {
      throw new Error("Role must be admin or member.")
    }
    if (target.role === "owner") throw new Error("Owners keep the owner role.")
    await ctx.db.patch(args.memberId, {
      role: args.role,
      // Promoting to admin unlocks the whole workspace — an admin is never
      // event-scoped (docs/memory/RULES.md 23), so drop any scope they had.
      ...(args.role === "admin" ? { eventIds: undefined } : {}),
    })
    return null
  },
})

/**
 * Which events a member may work on (docs/memory/RULES.md 23).
 *
 * `eventIds: null` ⇒ all events, now and in future (the default). A list ⇒
 * only those events; everything else in the workspace becomes invisible to
 * them, right down to "Event not found." on a direct link. Owners and admins
 * can't be scoped — they run the workspace by definition.
 */
export const setMemberEventAccess = mutation({
  args: {
    memberId: v.id("members"),
    eventIds: v.union(v.array(v.id("events")), v.null()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId)
    if (!target) throw new Error("Member not found.")
    await requireMembership(ctx, target.organizationId, "admin")

    if (args.eventIds === null) {
      await ctx.db.patch(args.memberId, { eventIds: undefined })
      return null
    }
    if (isWorkspaceWideRole(target.role)) {
      throw new Error(
        `${target.role === "owner" ? "Owners" : "Admins"} always have access to every event. Change their role to Member first if you want to limit them.`,
      )
    }
    const eventIds = await checkedEventIds(
      ctx,
      target.organizationId,
      args.eventIds,
    )
    if (eventIds.length === 0) {
      throw new Error("Pick at least one event, or give them all events.")
    }
    await ctx.db.patch(args.memberId, { eventIds })
    return null
  },
})

export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { member } = await requireMembership(ctx, args.organizationId)
    const org = await ctx.db.get(args.organizationId)
    if (!org) throw new Error("Workspace not found.")
    return { id: org._id, name: org.name, slug: org.slug, myRole: member.role }
  },
})

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    patch: v.object({ name: v.optional(v.string()) }),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId, "admin")
    if (args.patch.name !== undefined && !args.patch.name.trim()) {
      throw new Error("Workspace name can't be empty.")
    }
    await ctx.db.patch(args.organizationId, {
      ...(args.patch.name !== undefined ? { name: args.patch.name.trim() } : {}),
    })
    return null
  },
})

// A user may create additional workspaces (beyond the auto-created first one).
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    if (!args.name.trim()) throw new Error("Workspace name is required.")
    const base =
      args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
      "workspace"
    let slug = base
    for (let i = 2; ; i++) {
      const clash = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
      if (!clash) break
      slug = `${base}-${i}`
    }
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name.trim(),
      slug,
    })
    await ctx.db.insert("members", {
      organizationId,
      userId: user.userId,
      email: user.email,
      role: "owner",
    })
    return { organizationId, slug }
  },
})

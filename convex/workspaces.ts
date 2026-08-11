import { v } from "convex/values"
import { internal } from "./_generated/api"
import { mutation, query } from "./_generated/server"
import { myMemberships, requireMembership, requireUser } from "./lib/auth"

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
      const org = await ctx.db.get(existing[0]!.organizationId)
      return { organizationId: existing[0]!.organizationId, slug: org?.slug }
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

// Add a teammate who has already signed up, by email. (Pending email invites
// are a stretch goal — tracked in TODO.md.)
export const addMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.string(), // admin | member
  },
  handler: async (ctx, args) => {
    const { user } = await requireMembership(ctx, args.organizationId, "admin")
    if (!["admin", "member"].includes(args.role)) {
      throw new Error("Role must be admin or member.")
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
    })
    // Invite email (Resend) — linked automatically when they sign up.
    const org = await ctx.db.get(args.organizationId)
    await ctx.scheduler.runAfter(0, internal.platformEmails.sendWorkspaceInvite, {
      toEmail: email,
      workspaceName: org?.name ?? "your team's workspace",
      inviterName: user.name ?? user.email,
      role: args.role,
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
    await ctx.db.patch(args.memberId, { role: args.role })
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

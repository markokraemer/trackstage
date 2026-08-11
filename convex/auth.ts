import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { randomToken, requireOrganizer, sha256Hex } from "./lib/auth"

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const organizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique()
    if (!organizer) throw new Error("No organizer account with that email.")
    const hash = await sha256Hex(args.password)
    if (hash !== organizer.passwordHash) throw new Error("Incorrect password.")
    const token = randomToken()
    await ctx.db.insert("orgSessions", {
      token,
      organizerId: organizer._id,
      createdAt: Date.now(),
    })
    return { token, name: organizer.name, email: organizer.email }
  },
})

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("orgSessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .unique()
    if (session) await ctx.db.delete(session._id)
    return null
  },
})

export const me = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const organizer = await requireOrganizer(ctx, args.sessionToken)
      return { name: organizer.name, email: organizer.email }
    } catch {
      return null
    }
  },
})

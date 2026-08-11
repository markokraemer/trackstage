import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireUser } from "./lib/auth"

// ————————————————————————————————————————————————————————————————————————
// Personal API keys — the credential for the MCP server (convex/mcp.ts) and
// for any script that wants to drive Sessionboard as a specific user.
//
// Shape: sb_live_<32 hex chars>. Only sha-256(key) is persisted, so a leaked
// database gives an attacker nothing usable; the plaintext is returned by
// `create` exactly once and never again.
//
// A key is an identity, not a capability: it resolves to a Better Auth user
// id and every downstream call re-runs the normal membership authorization
// (see lib/auth.ts membershipFor / eventAccessFor). Revoking a key is
// immediate — the by_keyHash lookup simply stops matching.
// ————————————————————————————————————————————————————————————————————————

const KEY_PREFIX = "sb_live_"
/** Characters of the key kept in plaintext for display ("sb_live_1a2b3c4d"). */
const DISPLAY_CHARS = 8

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Generates a fresh `sb_live_<32 hex>` key. 128 bits of entropy. */
export function generateApiKey(): string {
  return KEY_PREFIX + toHex(crypto.getRandomValues(new Uint8Array(16)))
}

/**
 * sha-256 of the key, hex encoded. Web Crypto only (Convex's default runtime
 * has no node:crypto) and identical in queries, mutations and HTTP actions.
 */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  )
  return toHex(new Uint8Array(digest))
}

export function keyPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + DISPLAY_CHARS)
}

export const create = mutation({
  args: { name: v.optional(v.string()) },
  returns: v.object({
    keyId: v.id("apiKeys"),
    key: v.string(),
    prefix: v.string(),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const name = (args.name ?? "").trim() || "API key"
    if (name.length > 60) throw new Error("Name must be 60 characters or less.")

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect()
    if (existing.length >= 20) {
      throw new Error("You already have 20 API keys. Revoke one first.")
    }

    const key = generateApiKey()
    const keyId = await ctx.db.insert("apiKeys", {
      userId: user.userId,
      name,
      keyHash: await hashApiKey(key),
      prefix: keyPrefix(key),
      createdAt: Date.now(),
    })
    // The only time the plaintext key ever leaves the server.
    return { keyId, key, prefix: keyPrefix(key), name }
  },
})

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      keyId: v.id("apiKeys"),
      name: v.string(),
      prefix: v.string(),
      createdAt: v.number(),
      lastUsedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const rows = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect()
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        keyId: row._id,
        name: row.name,
        prefix: row.prefix,
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt ?? null,
      }))
  },
})

export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const row = await ctx.db.get(args.keyId)
    // Same 404-shaped error whether it never existed or belongs to someone
    // else — no probing another user's key ids.
    if (!row || row.userId !== user.userId) throw new Error("Key not found.")
    await ctx.db.delete(args.keyId)
    return null
  },
})

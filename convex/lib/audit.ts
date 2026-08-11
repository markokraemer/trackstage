// ————————————————————————————————————————————————————————————————————————
// Audit log (sbek CNT-11, docs/memory/HISTORY.md 61).
//
// One append-only row per meaningful change, with attribution. It answers
// "who changed what, when" — and deliberately nothing more: swyx's own
// instinct was that full versioning-with-restore is overkill for v1, so this
// is a change LOG, not a change STORE. Nothing here reconstructs an old
// document.
//
// Design rules that keep it honest:
//
//  · SURGICAL emit points. Only the changes an organizer would actually ask
//    about (decisions, form edits, agenda moves, profile changes, agent and
//    API writes). Logging every patch would bury the signal.
//
//  · NEVER fails its caller. `record()` swallows its own errors: an audit row
//    is a nice-to-have, and losing one must never roll back a real decision.
//
//  · Attribution is a SENTENCE, not an id. `actorLabel` holds a name, an
//    email, or "MCP · set_submission_status · sb_live_1a2b3c4d" — something a
//    non-technical organizer can read at a glance.
//
//  · Agent traffic is first-class (Marko, HISTORY 61 addendum). MCP, the REST
//    API and the Airtable sync all carry their own `actorType`, so the
//    Activity feed can filter to "Agents & API" and show exactly what the
//    robots did.
// ————————————————————————————————————————————————————————————————————————

import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { authComponent } from "../auth"

export const ACTOR_TYPES = [
  "organizer",
  "speaker",
  "mcp",
  "api",
  "system",
] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

export const AUDIT_ENTITIES = [
  "submission",
  "form",
  "session",
  "speaker",
  "agenda",
  "settings",
  "api-key",
] as const
export type AuditEntity = (typeof AUDIT_ENTITIES)[number]

/** Who did it. Omit and the signed-in organizer is resolved from the session. */
export type AuditActor = { type: ActorType; label: string }

export type AuditInput = {
  eventId: Id<"events">
  entity: AuditEntity
  entityId: string
  action: string
  summary: string
  meta?: Record<string, unknown>
  actor?: AuditActor
}

/** Truncation guard — a summary is a sentence, and meta is a receipt, not a blob. */
const MAX_SUMMARY = 300
const MAX_META_KEYS = 24
const MAX_META_STRING = 500

function trim(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

/**
 * Meta is `v.record(v.string(), v.any())`, which will happily accept a
 * megabyte of tool arguments. Clamp it here rather than at every call site:
 * the log stays cheap to read and no caller has to think about it.
 */
export function clampMeta(
  meta: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!meta) return undefined
  const out: Record<string, unknown> = {}
  let keys = 0
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue
    if (keys >= MAX_META_KEYS) break
    keys++
    if (typeof value === "string") out[key] = trim(value, MAX_META_STRING)
    else if (typeof value === "number" || typeof value === "boolean")
      out[key] = value
    else if (Array.isArray(value))
      out[key] = value
        .slice(0, 20)
        .map((item) =>
          typeof item === "string"
            ? trim(item, 120)
            : String(item).slice(0, 120)
        )
    else out[key] = trim(JSON.stringify(value) ?? "", MAX_META_STRING)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * The signed-in organizer, as a label. Falls back to "System" rather than
 * throwing — an audit row must never be the thing that fails a mutation
 * running outside a user session (crons, scheduled work).
 */
async function currentActor(ctx: MutationCtx): Promise<AuditActor> {
  try {
    const user = await authComponent.safeGetAuthUser(ctx)
    if (user) {
      return {
        type: "organizer",
        label: user.name?.trim() || user.email || "Organizer",
      }
    }
  } catch {
    // Unauthenticated context (cron, internal scheduling) — fall through.
  }
  return { type: "system", label: "System" }
}

/**
 * Write one audit row. Best-effort by construction: any failure (a deleted
 * event, an auth hiccup) is swallowed, because the change it describes has
 * already happened and rolling it back would be far worse than losing a line
 * of history.
 */
export async function record(
  ctx: MutationCtx,
  input: AuditInput
): Promise<void> {
  try {
    const event = await ctx.db.get(input.eventId)
    if (!event?.organizationId) return
    const actor = input.actor ?? (await currentActor(ctx))
    await ctx.db.insert("auditLog", {
      organizationId: event.organizationId,
      eventId: input.eventId,
      actorType: actor.type,
      actorLabel: trim(actor.label, 120),
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      summary: trim(input.summary, MAX_SUMMARY),
      meta: clampMeta(input.meta),
    })
  } catch {
    // Never fail the caller over history.
  }
}

/**
 * Workspace-level row: API-key lifecycle, which belongs to a user and their
 * organizations rather than to any one event. Marko flagged these explicitly
 * — a key is the credential every agent then acts through, so minting and
 * revoking one is the security event an admin reviews.
 */
export async function recordWorkspace(
  ctx: MutationCtx,
  input: {
    organizationId: Id<"organizations">
    entity: AuditEntity
    entityId: string
    action: string
    summary: string
    meta?: Record<string, unknown>
    actor?: AuditActor
  }
): Promise<void> {
  try {
    const actor = input.actor ?? (await currentActor(ctx))
    await ctx.db.insert("auditLog", {
      organizationId: input.organizationId,
      actorType: actor.type,
      actorLabel: trim(actor.label, 120),
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      summary: trim(input.summary, MAX_SUMMARY),
      meta: clampMeta(input.meta),
    })
  } catch {
    // Never fail the caller over history.
  }
}

/**
 * Same, fanned out across every organization the user belongs to. An API key
 * is not scoped to one workspace — it acts with the full reach of its owner's
 * memberships — so every workspace that key can touch gets the row.
 */
export async function recordForUserWorkspaces(
  ctx: MutationCtx,
  userId: string,
  input: {
    entity: AuditEntity
    entityId: string
    action: string
    summary: string
    meta?: Record<string, unknown>
    actor?: AuditActor
  }
): Promise<void> {
  try {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(10)
    for (const membership of memberships) {
      await recordWorkspace(ctx, {
        organizationId: membership.organizationId,
        ...input,
      })
    }
  } catch {
    // Never fail the caller over history.
  }
}

// ——— Summary helpers ————————————————————————————————————————————————————
// Wording is the product here: these strings are what an organizer reads in
// the History tab, so they use the app's own status vocabulary rather than
// raw enum values.

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  accept_queue: "Accept queue",
  decline_queue: "Decline queue",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
}

export function statusWord(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function statusChangeSummary(from: string, to: string): string {
  return `Status changed ${statusWord(from)} → ${statusWord(to)}`
}

/** "MCP · set_submission_status · sb_live_1a2b3c4d" */
export function agentLabel(
  channel: "MCP" | "API",
  detail: string,
  credentialPrefix?: string | null
): string {
  const parts = [channel, detail]
  if (credentialPrefix) parts.push(credentialPrefix)
  return parts.join(" · ")
}

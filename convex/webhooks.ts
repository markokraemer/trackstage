import { v } from "convex/values"
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

// ————————————————————————————————————————————————————————————————————————
// Outbound webhooks — the "real-time notifications instead of polling" half
// of the public API (docs/reference/api-parity.md).
//
// Shape mirrors Sessionboard's: a delivery body is `{ data, metadata }`,
// `data` carries the changed resource plus its id, `metadata` carries the
// action, the ids it happened under, a `resource_url` to re-fetch, a schema
// `version` and an ISO `datetime`.
//
// What we add on top — theirs documents "custom headers" as the only
// integrity story — is that every delivery is HMAC-SHA256 signed over
// `${timestamp}.${body}` with the endpoint's own `whsec_…` secret, sent as
//     Sessionboard-Signature: t=<unix-seconds>,v1=<hex>
// so a receiver can verify authenticity and reject replays without trusting
// the network. Failed deliveries retry with exponential backoff.
//
// Emission is fire-and-forget: `emitWebhook` schedules and returns, so no
// product mutation can ever be slowed down or failed by a customer's endpoint.
// ————————————————————————————————————————————————————————————————————————

/** Everything an organizer can subscribe to. `*` matches all of them. */
export const WEBHOOK_EVENT_TYPES = [
  "submission.created",
  "submission.updated",
  "submission.deleted",
  "submission.restored",
  "session.created",
  "session.updated",
  "session.deleted",
  "session.restored",
  "session.scheduled",
  "session.unscheduled",
  "session.speaker.attached",
  "session.speaker.detached",
  "decision.committed",
  "agenda.published",
  "speaker.created",
  "speaker.updated",
  "file.uploaded",
  "file.deleted",
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

const MAX_ATTEMPTS = 5
/** 1s, 5s, 25s, 125s — deterministic (no jitter) so the suite can assert it. */
const BACKOFF_MS = [1_000, 5_000, 25_000, 125_000]
const DELIVERY_TIMEOUT_MS = 10_000
/** Deliveries older than this are swept (convex/crons.ts). */
export const DELIVERY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `whsec_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`
}

/** Head + tail only — what GET /v1/webhooks shows after creation. */
export function maskSecret(secret: string): string {
  if (secret.length <= 14) return `${secret.slice(0, 6)}…`
  return `${secret.slice(0, 12)}…${secret.slice(-4)}`
}

export async function signPayload(
  secret: string,
  timestampSeconds: number,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestampSeconds}.${body}`),
  )
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function subscribes(subscribed: Array<string>, eventType: string): boolean {
  return subscribed.includes("*") || subscribed.includes(eventType)
}

// ——— Emission ————————————————————————————————————————————————————————————

/**
 * The ONE call site product code needs. Additive by design: drop it at the end
 * of a mutation, pass the event id, the type and the resource, and forget
 * about it. Never throws — a webhook must not be able to fail a decision
 * commit or a drag-drop reschedule.
 */
export async function emitWebhook(
  ctx: MutationCtx,
  eventId: Id<"events"> | null,
  type: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await ctx.scheduler.runAfter(0, internal.webhooks.fanOut, {
      eventId: eventId ?? undefined,
      eventType: type,
      data,
    })
  } catch {
    // Scheduling is the only thing that can fail here, and it is not worth
    // failing the caller's transaction over.
  }
}

/** Best-effort deep link back into the API, matching their `resource_url`. */
function resourceUrl(
  eventType: string,
  eventId: Id<"events"> | undefined,
  data: Record<string, unknown>,
): string | null {
  const site = process.env.CONVEX_SITE_URL
  const id = typeof data.id === "string" ? data.id : null
  if (!site || !eventId || !id) return null
  if (eventType.startsWith("session.") || eventType.startsWith("submission."))
    return `${site}/v1/event/${eventId}/sessions/${id}`
  if (eventType.startsWith("speaker."))
    return `${site}/v1/event/${eventId}/speakers/${id}`
  if (eventType.startsWith("file."))
    return `${site}/v1/event/${eventId}/sessions/${String(data.session_id ?? "")}/files`
  return null
}

/**
 * Resolves subscribers for one change and queues a delivery per endpoint.
 * Runs as its own mutation so the emitting transaction stays small.
 */
export const fanOut = internalMutation({
  args: {
    eventId: v.optional(v.id("events")),
    eventType: v.string(),
    data: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = args.eventId ? await ctx.db.get(args.eventId) : null
    const organizationId = event?.organizationId
    if (!organizationId) return null

    const candidates = await ctx.db
      .query("webhooks")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect()

    const now = Date.now()
    for (const hook of candidates) {
      if (!hook.enabled) continue
      // An event-scoped endpoint only hears about its own event; an endpoint
      // with no eventId hears about every event in the workspace.
      if (hook.eventId && hook.eventId !== args.eventId) continue
      if (!subscribes(hook.events, args.eventType)) continue

      const data: Record<string, unknown> =
        args.data && typeof args.data === "object"
          ? (args.data as Record<string, unknown>)
          : { value: args.data }
      const body = JSON.stringify({
        data: { ...data, sourceOfChange: data.sourceOfChange ?? "user" },
        metadata: {
          action: args.eventType,
          event_id: args.eventId ?? null,
          org_id: organizationId,
          resource_url: resourceUrl(args.eventType, args.eventId, data),
          version: 1,
          datetime: new Date(now).toISOString(),
        },
      })

      const deliveryId = await ctx.db.insert("webhookDeliveries", {
        webhookId: hook._id,
        organizationId,
        eventType: args.eventType,
        payload: body,
        status: "pending",
        attempts: 0,
        createdAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.webhooks.deliver, {
        deliveryId,
        attempt: 1,
      })
    }
    return null
  },
})

// ——— Delivery ————————————————————————————————————————————————————————————

export const deliveryForAttempt = internalQuery({
  args: { deliveryId: v.id("webhookDeliveries") },
  returns: v.union(
    v.object({
      payload: v.string(),
      eventType: v.string(),
      url: v.string(),
      secret: v.string(),
      enabled: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery) return null
    const hook = await ctx.db.get(delivery.webhookId)
    if (!hook) return null
    return {
      payload: delivery.payload,
      eventType: delivery.eventType,
      url: hook.url,
      secret: hook.secret,
      enabled: hook.enabled,
    }
  },
})

export const recordAttempt = internalMutation({
  args: {
    deliveryId: v.id("webhookDeliveries"),
    attempt: v.number(),
    ok: v.boolean(),
    responseStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    exhausted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId)
    if (!delivery) return null
    const now = Date.now()
    await ctx.db.patch(args.deliveryId, {
      attempts: args.attempt,
      status: args.ok ? "success" : args.exhausted ? "failed" : "pending",
      responseStatus: args.responseStatus,
      error: args.error,
      deliveredAt: args.ok ? now : undefined,
    })
    const hook = await ctx.db.get(delivery.webhookId)
    if (hook) {
      await ctx.db.patch(hook._id, {
        lastDeliveryAt: now,
        lastStatus: args.responseStatus,
        lastError: args.ok ? undefined : args.error,
        consecutiveFailures: args.ok
          ? 0
          : (hook.consecutiveFailures ?? 0) + (args.exhausted ? 1 : 0),
      })
    }
    return null
  },
})

/**
 * One delivery attempt. Retries itself with exponential backoff by
 * re-scheduling; gives up after MAX_ATTEMPTS and leaves the delivery `failed`
 * so it stays visible in the log.
 */
export const deliver = internalAction({
  args: { deliveryId: v.id("webhookDeliveries"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.webhooks.deliveryForAttempt, {
      deliveryId: args.deliveryId,
    })
    if (!target || !target.enabled) return null

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await signPayload(
      target.secret,
      timestamp,
      target.payload,
    )

    let ok = false
    let responseStatus: number | undefined
    let error: string | undefined
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
      const res = await fetch(target.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Sessionboard-Webhooks/1",
          "Sessionboard-Event": target.eventType,
          "Sessionboard-Delivery": args.deliveryId,
          "Sessionboard-Signature": `t=${timestamp},v1=${signature}`,
        },
        body: target.payload,
        signal: controller.signal,
      })
      clearTimeout(timer)
      responseStatus = res.status
      ok = res.ok
      if (!ok) error = `Endpoint responded ${res.status}`
    } catch (e) {
      error = String((e as Error)?.message ?? e).slice(0, 300)
    }

    const exhausted = !ok && args.attempt >= MAX_ATTEMPTS
    await ctx.runMutation(internal.webhooks.recordAttempt, {
      deliveryId: args.deliveryId,
      attempt: args.attempt,
      ok,
      responseStatus,
      error,
      exhausted,
    })
    if (!ok && !exhausted) {
      const delay = BACKOFF_MS[Math.min(args.attempt - 1, BACKOFF_MS.length - 1)]
      await ctx.scheduler.runAfter(delay, internal.webhooks.deliver, {
        deliveryId: args.deliveryId,
        attempt: args.attempt + 1,
      })
    }
    return null
  },
})

// ——— Housekeeping ————————————————————————————————————————————————————————

/** Drops delivery rows past the retention window (convex/crons.ts). */
export const sweepDeliveries = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - DELIVERY_RETENTION_MS
    const stale = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(500)
    for (const row of stale) await ctx.db.delete(row._id)
    return { deleted: stale.length }
  },
})

/** Drops abandoned two-phase file-upload intents older than 24h. */
export const sweepUploadIntents = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const stale = await ctx.db
      .query("fileUploadIntents")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(200)
    for (const row of stale) {
      // Any blob here was never referenced by an `uploads` row.
      if (row.storageId) {
        try {
          await ctx.storage.delete(row.storageId)
        } catch {
          /* already gone */
        }
      }
      await ctx.db.delete(row._id)
    }
    return { deleted: stale.length }
  },
})

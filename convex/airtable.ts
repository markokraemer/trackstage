// ————————————————————————————————————————————————————————————————————————
// Airtable one-click sync (docs/memory/RULES.md 15, HISTORY.md 40).
//
// ONE-WAY. The organizer pastes a personal access token + a base ID; we
// create (or adopt) three tables — Submissions, Speakers, Sessions — in
// THEIR base and keep them mirrored. We never read their data back, never
// delete their rows, and never treat Airtable as a source of truth. That is
// exactly what swyx asked for: his team's automations fire "once a new row
// lands", so a read-only mirror is enough.
//
// NEAR-REAL-TIME on purpose, two cheap paths, both idempotent:
//   · on-write  — `scheduleAirtableSync(ctx, eventId)` from the mutations
//                 that create submissions; debounced ~5s by a latch on the
//                 connection row, so a burst of submissions costs one sync.
//   · every 5m  — the `airtable-sync` cron (convex/crons.ts) catches
//                 everything else (status changes, agenda edits, profiles).
// Overlap is harmless: every write is a PATCH upsert keyed on our own
// "Trackstage ID" column, so the same run twice is the same result.
//
// EXPERIMENTAL TWO-WAY (HISTORY.md 61): opt-in per connection. When on, each
// sync also PULLS the Status column back — one field, enum-validated, guarded
// against echo loops by the status we last pushed, and our DB wins every
// genuine conflict (the losing Airtable edit is written to the audit log, not
// swallowed). The guard itself is pure and unit-tested in
// convex/lib/airtableInbound.ts + tests/unit/airtable-sync.test.ts.
//
// DEMO MODE: with AIRTABLE_DEMO_MODE=1 on the deployment, `connect` skips
// live validation and `syncEvent` counts rows without talking to Airtable.
// That exists because the integration must be demo-able (and verifiable in
// scripts/verify-backend.mjs) without an Airtable account.
// ————————————————————————————————————————————————————————————————————————

import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { siteUrl } from "./lib/email"
import {
  AirtableClient,
  AirtableError,
  EXTERNAL_ID_FIELD,
  TABLE_KEYS,
  TABLE_NAMES,
  ensureTables,
  maskToken,
  sessionFields,
  speakerFields,
  submissionFields,
  validateCredentials,
} from "./lib/airtable"
import type { AirtableRecordPayload } from "./lib/airtable"
import {
  INBOUND_REASON_TEXT,
  emptySummary,
  modifiedSinceFormula,
  shouldApplyInbound,
  tally,
} from "./lib/airtableInbound"
import type { InboundSummary } from "./lib/airtableInbound"
import { record as recordAudit } from "./lib/audit"

/** How long we let writes settle before the on-write sync fires. */
const SYNC_DEBOUNCE_MS = 5_000

/**
 * Per-table row cap for one sync run. Well above any realistic conference
 * (the biggest CFPs in the brief are low thousands) and low enough that the
 * payload query stays inside one Convex transaction.
 */
const MAX_ROWS = 1_000

/** Connections handled by a single cron tick. */
const MAX_CONNECTIONS_PER_RUN = 25

function demoMode(): boolean {
  return process.env.AIRTABLE_DEMO_MODE === "1"
}

function connectionQuery(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
  return ctx.db
    .query("airtableConnections")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .unique()
}

// ——— Public surface ————————————————————————————————————————————————————

const countsValidator = v.object({
  submissions: v.number(),
  speakers: v.number(),
  sessions: v.number(),
})

/**
 * What the Integrations settings tab renders. Deliberately never returns the
 * token — only a masked prefix, which is enough for "yes, that's the one I
 * pasted" and useless to anyone else.
 */
export const status = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      baseId: v.string(),
      baseUrl: v.string(),
      tokenMasked: v.string(),
      status: v.string(),
      mode: v.union(v.literal("live"), v.literal("demo")),
      connectedAt: v.number(),
      lastSyncAt: v.union(v.number(), v.null()),
      lastError: v.union(v.string(), v.null()),
      recordCounts: v.union(countsValidator, v.null()),
      tables: v.array(v.string()),
      twoWaySync: v.boolean(),
      inbound: v.union(
        v.object({
          at: v.number(),
          applied: v.number(),
          skipped: v.number(),
          conflicts: v.number(),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection) return null
    return {
      baseId: connection.baseId,
      baseUrl: `https://airtable.com/${connection.baseId}`,
      tokenMasked: maskToken(connection.token),
      status: connection.status,
      mode: connection.demo ? ("demo" as const) : ("live" as const),
      connectedAt: connection._creationTime,
      lastSyncAt: connection.lastSyncAt ?? null,
      lastError: connection.lastError ?? null,
      recordCounts: connection.recordCounts ?? null,
      tables: TABLE_KEYS.map((key) => TABLE_NAMES[key]),
      twoWaySync: connection.twoWaySync === true,
      inbound: connection.inbound ?? null,
    }
  },
})

/**
 * One-click connect. An ACTION, not a mutation, because it proves the
 * credentials against the live API before anything is stored — a connection
 * that only fails later is worse than no connection at all.
 *
 * Order matters: authorize → validate shape → prove the token/base → make
 * the tables → save → kick off the first full sync.
 */
export const connect = action({
  args: {
    eventId: v.id("events"),
    token: v.string(),
    baseId: v.string(),
  },
  returns: v.object({
    mode: v.union(v.literal("live"), v.literal("demo")),
    createdTables: v.array(v.string()),
    warnings: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.airtable.assertAdmin, { eventId: args.eventId })

    const token = args.token.trim()
    const baseId = args.baseId.trim()

    if (demoMode()) {
      await ctx.runMutation(internal.airtable.saveConnection, {
        eventId: args.eventId,
        token: token || "pat-demo-token",
        baseId: baseId || "appDemoBase000000",
        demo: true,
      })
      await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
        eventId: args.eventId,
      })
      return { mode: "demo" as const, createdTables: [], warnings: [] }
    }

    validateCredentials(token, baseId)

    const client = new AirtableClient(token, baseId)
    const schema = await client.getBaseSchema()
    const ensured = await ensureTables(client, schema)

    await ctx.runMutation(internal.airtable.saveConnection, {
      eventId: args.eventId,
      token,
      baseId,
      demo: false,
    })
    await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
      eventId: args.eventId,
    })

    return {
      mode: "live" as const,
      createdTables: ensured.createdTables,
      warnings: ensured.warnings,
    }
  },
})

/**
 * Forget the token. Their Airtable tables stay exactly as they are — this is
 * a mirror, not a lease, so disconnecting must never touch their data.
 */
export const disconnect = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    const connection = await connectionQuery(ctx, args.eventId)
    if (connection) await ctx.db.delete(connection._id)
    return null
  },
})

/**
 * Turn the experimental inbound sync on or off (admin only — it is the one
 * switch that lets an outside system change programme data).
 *
 * Turning it ON does not immediately pull: the first push after this writes
 * the per-record baseline (`lastPushedStatus`), and only once a row has a
 * baseline can an Airtable edit be told apart from our own echo. So the
 * honest sequence is switch on → next sync mirrors out → edits in Airtable
 * come back from the sync after that.
 */
export const setTwoWaySync = mutation({
  args: { eventId: v.id("events"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection) throw new Error("Airtable isn't connected for this event.")
    await ctx.db.patch(connection._id, { twoWaySync: args.enabled })
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "settings",
      entityId: args.eventId,
      action: "updated",
      summary: `Airtable two-way sync turned ${args.enabled ? "on" : "off"}`,
      meta: { twoWaySync: args.enabled, baseId: connection.baseId },
    })
    // Re-mirror straight away so every row has a baseline to compare against.
    await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
      eventId: args.eventId,
    })
    return null
  },
})

/** "Sync now" — any member can ask for a refresh; the work happens async. */
export const syncNow = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection) throw new Error("Airtable isn't connected for this event.")
    await ctx.db.patch(connection._id, { syncScheduled: false })
    await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
      eventId: args.eventId,
    })
    return null
  },
})

// ——— On-write hook ——————————————————————————————————————————————————————

/**
 * Called from the mutations that create submissions (submit.submit,
 * submissions.commitQueue, submissions.addManual). One line each, and a
 * no-op — one indexed read — when the event has no Airtable connection, so
 * the public CFP path pays essentially nothing for a feature it isn't using.
 *
 * The `syncScheduled` latch coalesces a burst (a queue commit touching 40
 * submissions schedules ONE sync, not 40).
 */
export async function scheduleAirtableSync(
  ctx: MutationCtx,
  eventId: Id<"events">
): Promise<void> {
  const connection = await connectionQuery(ctx, eventId)
  if (!connection || connection.syncScheduled) return
  await ctx.db.patch(connection._id, { syncScheduled: true })
  await ctx.scheduler.runAfter(SYNC_DEBOUNCE_MS, internal.airtable.syncEvent, {
    eventId,
  })
}

// ——— Internals ——————————————————————————————————————————————————————————

export const assertAdmin = internalQuery({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    return null
  },
})

export const saveConnection = internalMutation({
  args: {
    eventId: v.id("events"),
    token: v.string(),
    baseId: v.string(),
    demo: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Re-checked here and not just in the calling action: an internal
    // mutation is still a real entry point, and authorization belongs next
    // to the write.
    await requireEventAccess(ctx, args.eventId, "admin")
    const existing = await connectionQuery(ctx, args.eventId)
    const fields = {
      token: args.token,
      baseId: args.baseId,
      status: "connected",
      demo: args.demo,
      lastError: undefined,
      syncScheduled: false,
    }
    if (existing) {
      await ctx.db.patch(existing._id, fields)
    } else {
      await ctx.db.insert("airtableConnections", {
        eventId: args.eventId,
        ...fields,
      })
    }
    return null
  },
})

/** Clears the debounce latch as the sync starts, so new writes re-arm it. */
export const beginSync = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await connectionQuery(ctx, args.eventId)
    if (connection?.syncScheduled) {
      await ctx.db.patch(connection._id, { syncScheduled: false })
    }
    return null
  },
})

export const finishSync = internalMutation({
  args: {
    eventId: v.id("events"),
    counts: v.optional(countsValidator),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection) return null
    await ctx.db.patch(connection._id, {
      status: args.error ? "error" : "connected",
      lastError: args.error,
      ...(args.counts
        ? { recordCounts: args.counts, lastSyncAt: Date.now() }
        : {}),
    })
    return null
  },
})

const payloadValidator = v.union(
  v.null(),
  v.object({
    token: v.string(),
    baseId: v.string(),
    demo: v.boolean(),
    submissions: v.array(v.any()),
    speakers: v.array(v.any()),
    sessions: v.array(v.any()),
  })
)

/**
 * Everything one sync run needs, read in ONE transaction so the three tables
 * are mutually consistent. Joins are done with three indexed scans and
 * in-memory maps rather than per-row lookups — a 500-submission event costs
 * four queries, not fifteen hundred.
 */
export const syncPayload = internalQuery({
  args: { eventId: v.id("events") },
  returns: payloadValidator,
  handler: async (ctx, args) => {
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection) return null

    const [submissions, participants, people, tracks, rooms, forms] =
      await Promise.all([
        ctx.db
          .query("submissions")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .take(MAX_ROWS),
        ctx.db
          .query("submissionParticipants")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .take(MAX_ROWS * 4),
        ctx.db
          .query("people")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .take(MAX_ROWS),
        ctx.db
          .query("tracks")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .take(200),
        ctx.db
          .query("rooms")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .take(200),
        ctx.db
          .query("forms")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .take(200),
      ])

    const peopleById = new Map(people.map((person) => [person._id, person]))
    const trackName = new Map(tracks.map((track) => [track._id, track.name]))
    const roomName = new Map(rooms.map((room) => [room._id, room.name]))
    const formName = new Map(forms.map((form) => [form._id, form.internalName]))

    const bySubmission = new Map<
      Id<"submissions">,
      Array<Doc<"submissionParticipants">>
    >()
    for (const participant of participants) {
      const bucket = bySubmission.get(participant.submissionId)
      if (bucket) bucket.push(participant)
      else bySubmission.set(participant.submissionId, [participant])
    }

    const base = siteUrl()
    const displayName = (person: Doc<"people">) =>
      `${person.firstName} ${person.lastName}`.trim() || person.email

    const speakersOf = (submission: Doc<"submissions">) => {
      const roster = (bySubmission.get(submission._id) ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((participant) => peopleById.get(participant.personId))
        .filter((person): person is Doc<"people"> => person !== undefined)
      if (roster.length > 0) return roster
      const submitter = peopleById.get(submission.submitterId)
      return submitter ? [submitter] : []
    }

    const submissionRows = submissions.map((submission) => {
      const roster = speakersOf(submission)
      return {
        id: submission._id,
        title: submission.title,
        status: submission.status,
        kind: submission.kind,
        track: submission.trackId
          ? trackName.get(submission.trackId)
          : undefined,
        format: submission.format,
        level: submission.level,
        language: submission.language,
        tags: submission.tags,
        speakers: roster.map(displayName),
        speakerEmails: roster.map((person) => person.email),
        submitterEmail: peopleById.get(submission.submitterId)?.email,
        description: submission.description,
        formName: submission.formId
          ? formName.get(submission.formId)
          : undefined,
        submittedAt: submission._creationTime,
        decidedAt: submission.decidedAt,
        link: `${base}/app/submissions/${submission._id}`,
      }
    })

    const sessionRows = submissions
      .filter((submission) => typeof submission.startsAt === "number")
      .map((submission) => ({
        id: submission._id,
        title: submission.title,
        track: submission.trackId
          ? trackName.get(submission.trackId)
          : undefined,
        room: submission.roomId ? roomName.get(submission.roomId) : undefined,
        startsAt: submission.startsAt as number,
        durationMinutes: submission.durationMinutes,
        speakers: speakersOf(submission).map(displayName),
        status: submission.status,
        link: `${base}/app/agenda`,
      }))

    const submissionCount = new Map<Id<"people">, number>()
    const acceptedCount = new Map<Id<"people">, number>()
    for (const submission of submissions) {
      const seen = new Set<Id<"people">>()
      for (const person of speakersOf(submission)) {
        if (seen.has(person._id)) continue
        seen.add(person._id)
        submissionCount.set(
          person._id,
          (submissionCount.get(person._id) ?? 0) + 1
        )
        if (submission.status === "accepted") {
          acceptedCount.set(
            person._id,
            (acceptedCount.get(person._id) ?? 0) + 1
          )
        }
      }
    }

    const speakerRows = people.map((person) => ({
      id: person._id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      jobTitle: person.jobTitle,
      company: person.company,
      pronouns: person.pronouns,
      bio: person.bio,
      linkedin: person.links?.linkedin,
      twitter: person.links?.twitter,
      website: person.links?.website,
      submissionCount: submissionCount.get(person._id) ?? 0,
      acceptedCount: acceptedCount.get(person._id) ?? 0,
      portalLink: `${base}/portal/t/${person.portalToken}`,
      addedAt: person._creationTime,
    }))

    return {
      token: connection.token,
      baseId: connection.baseId,
      demo: connection.demo === true,
      submissions: submissionRows,
      speakers: speakerRows,
      sessions: sessionRows,
    }
  },
})

// ——— Two-way sync: state, pull, apply ————————————————————————————————————

/** Records the mirror baseline in batches the transaction can comfortably hold. */
const STATE_BATCH = 200

const recordStateRow = v.object({
  submissionId: v.id("submissions"),
  status: v.string(),
})

/**
 * Remember what we just wrote into Airtable. This is the ENTIRE loop guard:
 * with it, an inbound value that equals the baseline is our own echo, and a
 * local status that differs from the baseline means the organizer changed it
 * here since the mirror was written (so we win).
 *
 * Written for every connection, not just two-way ones, so flipping the switch
 * on doesn't need a special backfill — the baseline is already there.
 */
export const recordPushedStatuses = internalMutation({
  args: { eventId: v.id("events"), rows: v.array(recordStateRow) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("airtableRecordSync")
        .withIndex("by_submissionId", (q) =>
          q.eq("submissionId", row.submissionId)
        )
        .unique()
      if (existing) {
        if (existing.lastPushedStatus === row.status) continue
        await ctx.db.patch(existing._id, {
          lastPushedStatus: row.status,
          lastPushedAt: now,
        })
      } else {
        await ctx.db.insert("airtableRecordSync", {
          eventId: args.eventId,
          submissionId: row.submissionId,
          lastPushedStatus: row.status,
          lastPushedAt: now,
        })
      }
    }
    return null
  },
})

/** Credentials + cursor for one pull. Null when there is nothing to pull. */
export const pullContext = internalQuery({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      token: v.string(),
      baseId: v.string(),
      demo: v.boolean(),
      lastSyncAt: v.union(v.number(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection || connection.twoWaySync !== true) return null
    return {
      token: connection.token,
      baseId: connection.baseId,
      demo: connection.demo === true,
      lastSyncAt: connection.lastSyncAt ?? null,
    }
  },
})

const inboundRecord = v.object({
  /** Our own document id, from the "Trackstage ID" column. */
  externalId: v.string(),
  /** The raw Airtable "Status" cell. */
  status: v.optional(v.string()),
  modifiedTime: v.optional(v.string()),
})

const inboundSummaryValidator = v.object({
  applied: v.number(),
  skipped: v.number(),
  conflicts: v.number(),
})

/**
 * Apply one batch of Airtable rows, guarded.
 *
 * Public-ish surface note: this is INTERNAL and takes rows as data, which is
 * exactly what lets the verify suite exercise the real guard logic (and the
 * state-table roundtrip) in demo mode without an Airtable account.
 *
 * Nothing here patches `status` directly — it calls submissions.setStatus's
 * internal twin, so an inbound change fires the same webhook and writes the
 * same audit row as a click in the UI, attributed to Airtable.
 */
export const applyInbound = internalMutation({
  args: { eventId: v.id("events"), records: v.array(inboundRecord) },
  returns: inboundSummaryValidator,
  handler: async (ctx, args) => {
    let summary: InboundSummary = emptySummary()
    const now = Date.now()

    for (const row of args.records) {
      const submissionId = ctx.db.normalizeId("submissions", row.externalId)
      if (!submissionId) {
        // A row created by hand in Airtable, or one belonging to another
        // deployment. We never create submissions from a spreadsheet.
        summary = tally(summary, "unknown_status")
        continue
      }
      const submission = await ctx.db.get(submissionId)
      // Cross-event isolation: an id from a different event's base must not
      // be reachable through this connection.
      if (!submission || submission.eventId !== args.eventId) {
        summary = tally(summary, "unknown_status")
        continue
      }

      const state = await ctx.db
        .query("airtableRecordSync")
        .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
        .unique()

      const decision = shouldApplyInbound({
        airtableValue: row.status,
        currentStatus: submission.status,
        lastPushedStatus: state?.lastPushedStatus ?? null,
      })
      summary = tally(summary, decision.reason)

      if (decision.reason === "conflict") {
        // The overruled edit is recorded rather than silently dropped — an
        // organizer who triaged in Airtable and lost deserves to see why.
        await recordAudit(ctx, {
          eventId: args.eventId,
          entity: submission.kind === "session" ? "session" : "submission",
          entityId: submissionId,
          action: "sync_conflict",
          summary: `Airtable said “${decision.airtableStatus}” but this changed in Trackstage — Trackstage wins · ${submission.title}`,
          meta: {
            airtableStatus: decision.airtableStatus ?? "",
            currentStatus: submission.status,
            lastPushedStatus: state?.lastPushedStatus ?? "none",
            reason: INBOUND_REASON_TEXT.conflict,
          },
          actor: { type: "system", label: "Airtable sync" },
        })
        continue
      }

      if (!decision.apply) continue

      await ctx.runMutation(internal.submissions.setStatusInternal, {
        submissionId,
        status: decision.status,
        actorType: "system",
        actorLabel: "Airtable sync",
      })

      // The mirror and our row now agree, so the baseline moves with them —
      // otherwise the very next pull would read this as a fresh conflict.
      const patch = {
        lastPushedStatus: decision.status,
        lastPulledStatus: decision.status,
        lastPulledAt: now,
        lastPulledModifiedTime: row.modifiedTime,
      }
      if (state) await ctx.db.patch(state._id, patch)
      else {
        await ctx.db.insert("airtableRecordSync", {
          eventId: args.eventId,
          submissionId,
          ...patch,
        })
      }
    }

    return summary
  },
})

/** Stores the pull outcome so the Integrations card can report it. */
export const finishPull = internalMutation({
  args: { eventId: v.id("events"), summary: inboundSummaryValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection) return null
    await ctx.db.patch(connection._id, {
      inbound: { at: Date.now(), ...args.summary },
    })
    return null
  },
})

/**
 * The inbound half of one sync run. Only ever scheduled by `syncEvent`, and
 * only when the connection has `twoWaySync` on — so the 5-minute cron pulls
 * exactly for the events that asked for it and nobody else pays for it.
 *
 * Reads are narrowed twice: to two columns, and (when we have a cursor) to
 * records Airtable says changed since our last sync.
 */
export const pullEvent = internalAction({
  args: { eventId: v.id("events") },
  returns: inboundSummaryValidator,
  handler: async (ctx, args) => await pullCore(ctx, args.eventId),
})

/**
 * The pull itself as a plain function, so `syncEvent` runs it inline instead
 * of paying for a nested action call (the two never cross runtimes).
 */
async function pullCore(
  ctx: ActionCtx,
  eventId: Id<"events">
): Promise<InboundSummary> {
  const context = await ctx.runQuery(internal.airtable.pullContext, {
    eventId,
  })
  if (!context) return emptySummary()
  // Demo mode never talks to Airtable; the suite drives `applyInbound`
  // directly with fabricated rows to exercise the same guards.
  if (context.demo || demoMode()) return emptySummary()

  const client = new AirtableClient(context.token, context.baseId)
  let records: Array<{ id: string; fields: Record<string, unknown> }>
  try {
    records = await client.listRecords(TABLE_NAMES.submissions, {
      fields: [EXTERNAL_ID_FIELD, "Status"],
      filterByFormula: modifiedSinceFormula(context.lastSyncAt),
      maxRecords: MAX_ROWS,
    })
  } catch (error) {
    const message =
      error instanceof AirtableError
        ? error.message
        : `Couldn't read changes back from Airtable: ${error instanceof Error ? error.message : String(error)}`
    await ctx.runMutation(internal.airtable.finishSync, {
      eventId,
      error: message,
    })
    return emptySummary()
  }

  const candidates = records
    .map((record) => ({
      externalId: String(record.fields[EXTERNAL_ID_FIELD] ?? "").trim(),
      status:
        typeof record.fields.Status === "string"
          ? record.fields.Status
          : undefined,
    }))
    .filter((row) => row.externalId.length > 0)

  let summary = emptySummary()
  for (let i = 0; i < candidates.length; i += STATE_BATCH) {
    const batch = await ctx.runMutation(internal.airtable.applyInbound, {
      eventId,
      records: candidates.slice(i, i + STATE_BATCH),
    })
    summary = {
      applied: summary.applied + batch.applied,
      skipped: summary.skipped + batch.skipped,
      conflicts: summary.conflicts + batch.conflicts,
    }
  }

  await ctx.runMutation(internal.airtable.finishPull, {
    eventId,
    summary,
  })
  return summary
}

/**
 * The sync itself. Idempotent by construction (PATCH upsert on
 * "Trackstage ID"), so it is safe to run concurrently with itself — which
 * it will be, because the cron and the on-write hook are independent.
 *
 * A failure is recorded on the connection rather than thrown away: the
 * Integrations card shows the organizer exactly what Airtable said.
 */
export const syncEvent = internalAction({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.airtable.beginSync, {
      eventId: args.eventId,
    })

    const payload = await ctx.runQuery(internal.airtable.syncPayload, {
      eventId: args.eventId,
    })
    if (!payload) return null // disconnected between scheduling and running

    const counts = {
      submissions: payload.submissions.length,
      speakers: payload.speakers.length,
      sessions: payload.sessions.length,
    }

    // The mirror baseline every inbound comparison depends on. Recorded for
    // the demo path too, so the toggle and the state table are exercisable
    // (and verifiable) without an Airtable account.
    const statusRows = payload.submissions
      .map((row) => ({
        submissionId: row.id as Id<"submissions">,
        status: String(row.status),
      }))
      .slice(0, MAX_ROWS)

    if (payload.demo || demoMode()) {
      // Nothing leaves the deployment: the mirror is simulated so the UI,
      // the cron and the verify suite are all exercisable without an
      // Airtable account.
      await recordPushed(ctx, args.eventId, statusRows)
      await ctx.runMutation(internal.airtable.finishSync, {
        eventId: args.eventId,
        counts,
      })
      await maybePull(ctx, args.eventId)
      return null
    }

    const client = new AirtableClient(payload.token, payload.baseId)
    const tables: Array<[string, AirtableRecordPayload[]]> = [
      [
        TABLE_NAMES.submissions,
        payload.submissions.map((row) => ({ fields: submissionFields(row) })),
      ],
      [
        TABLE_NAMES.speakers,
        payload.speakers.map((row) => ({ fields: speakerFields(row) })),
      ],
      [
        TABLE_NAMES.sessions,
        payload.sessions.map((row) => ({ fields: sessionFields(row) })),
      ],
    ]

    try {
      for (const [name, records] of tables) {
        if (records.length === 0) continue
        await client.upsert(name, records)
      }
    } catch (error) {
      const message =
        error instanceof AirtableError
          ? error.message
          : `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      await ctx.runMutation(internal.airtable.finishSync, {
        eventId: args.eventId,
        error: message,
      })
      return null
    }

    await recordPushed(ctx, args.eventId, statusRows)
    await ctx.runMutation(internal.airtable.finishSync, {
      eventId: args.eventId,
      counts,
    })
    // PUSH THEN PULL, always in that order: the push refreshes the baseline,
    // so the pull that follows can tell an organizer's Airtable edit from the
    // value we just wrote there ourselves.
    await maybePull(ctx, args.eventId)
    return null
  },
})

/** Baseline write, chunked to stay well inside one transaction each. */
async function recordPushed(
  ctx: ActionCtx,
  eventId: Id<"events">,
  rows: Array<{ submissionId: Id<"submissions">; status: string }>
): Promise<void> {
  for (let i = 0; i < rows.length; i += STATE_BATCH) {
    await ctx.runMutation(internal.airtable.recordPushedStatuses, {
      eventId,
      rows: rows.slice(i, i + STATE_BATCH),
    })
  }
}

/**
 * Runs the inbound half when — and only when — the connection opted in.
 * `pullEvent` re-checks the flag itself, so this is a cheap guard rather than
 * the security boundary.
 */
async function maybePull(ctx: ActionCtx, eventId: Id<"events">): Promise<void> {
  await pullCore(ctx, eventId)
}

/**
 * Cron entry point (every 5 minutes). Catches everything the on-write hook
 * can't see cheaply — status changes, agenda moves, profile edits — and is
 * free when nothing changed, because an upsert of unchanged rows is a no-op
 * on Airtable's side.
 */
export const syncAllConnected = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx) => {
    const connections = await ctx.db
      .query("airtableConnections")
      .take(MAX_CONNECTIONS_PER_RUN)
    for (const connection of connections) {
      await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
        eventId: connection.eventId,
      })
    }
    return { scheduled: connections.length }
  },
})

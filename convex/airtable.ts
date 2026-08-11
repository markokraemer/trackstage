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
// DEMO MODE: with AIRTABLE_DEMO_MODE=1 on the deployment, `connect` skips
// live validation and `syncEvent` counts rows without talking to Airtable.
// That exists because the integration must be demo-able (and verifiable in
// scripts/verify-backend.mjs) without an Airtable account.
// ————————————————————————————————————————————————————————————————————————

import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
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
    }),
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
  eventId: Id<"events">,
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
      ...(args.counts ? { recordCounts: args.counts, lastSyncAt: Date.now() } : {}),
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
  }),
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
        track: submission.trackId ? trackName.get(submission.trackId) : undefined,
        format: submission.format,
        level: submission.level,
        language: submission.language,
        tags: submission.tags,
        speakers: roster.map(displayName),
        speakerEmails: roster.map((person) => person.email),
        submitterEmail: peopleById.get(submission.submitterId)?.email,
        description: submission.description,
        formName: submission.formId ? formName.get(submission.formId) : undefined,
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
        track: submission.trackId ? trackName.get(submission.trackId) : undefined,
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
        submissionCount.set(person._id, (submissionCount.get(person._id) ?? 0) + 1)
        if (submission.status === "accepted") {
          acceptedCount.set(person._id, (acceptedCount.get(person._id) ?? 0) + 1)
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
    await ctx.runMutation(internal.airtable.beginSync, { eventId: args.eventId })

    const payload = await ctx.runQuery(internal.airtable.syncPayload, {
      eventId: args.eventId,
    })
    if (!payload) return null // disconnected between scheduling and running

    const counts = {
      submissions: payload.submissions.length,
      speakers: payload.speakers.length,
      sessions: payload.sessions.length,
    }

    if (payload.demo || demoMode()) {
      // Nothing leaves the deployment: the mirror is simulated so the UI,
      // the cron and the verify suite are all exercisable without an
      // Airtable account.
      await ctx.runMutation(internal.airtable.finishSync, {
        eventId: args.eventId,
        counts,
      })
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

    await ctx.runMutation(internal.airtable.finishSync, {
      eventId: args.eventId,
      counts,
    })
    return null
  },
})

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

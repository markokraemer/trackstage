// ————————————————————————————————————————————————————————————————————————
// Airtable one-click sync (docs/memory/RULES.md 15, HISTORY.md 40, 61, 66).
//
// ONE-WAY BY DEFAULT. The organizer pastes a personal access token + a base
// ID; we create (or adopt) three tables — Submissions, Speakers, Sessions —
// in THEIR base and keep them mirrored. Out of the box we never read their
// data back, never delete their rows, and never treat Airtable as a source of
// truth. That is exactly what swyx asked for: his team's automations fire
// "once a new row lands", so a read-only mirror is enough.
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
// TWO-WAY IS AN OPT-IN, TWICE OVER. A connection has a master switch, and
// then a per-COLUMN selection (convex/lib/airtableFields.ts): status, wording,
// classification, speaker profiles, agenda slots — the organizer ticks what
// Airtable is allowed to change and nothing else travels. Every inbound value
// is parsed and validated, guarded against echo loops by the value we last
// pushed into that exact cell, and our DB wins every genuine conflict (the
// losing Airtable edit is written to the audit log, not swallowed). The guard
// is pure and unit-tested in convex/lib/airtableFields.ts +
// tests/unit/airtable-sync.test.ts.
//
// Nothing inbound patches a document directly: status goes through
// submissions.setStatusInternal, wording through updateDetailsInternal,
// profiles through speakersAdmin.updateProfileInternal and slots through
// agenda.rescheduleInternal — so a spreadsheet edit fires the same webhooks
// and writes the same history as a click in the UI, attributed to Airtable.
//
// PULL BEFORE PUSH is not a preference: the push rewrites every mirrored
// cell, so pushing first destroys the very edit the pull exists to collect.
//
// DEMO MODE: with AIRTABLE_DEMO_MODE=1 on the deployment, `connect` skips
// live validation and `syncEvent` counts rows without talking to Airtable.
// That exists because the integration must be demo-able (and verifiable in
// scripts/verify-backend.mjs) without an Airtable account.
// ————————————————————————————————————————————————————————————————————————

import { ConvexError, v } from "convex/values"
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
  EXTERNAL_ID_FIELD,
  TABLE_KEYS,
  TABLE_NAMES,
  ensureTables,
  humanAirtableError,
  maskToken,
  normalizeBaseId,
  normalizeCredentials,
  sessionFields,
  speakerFields,
  submissionFields,
} from "./lib/airtable"
import type { AirtableFields, TableKey } from "./lib/airtable"
import {
  addSummary,
  emptySummary,
  modifiedSinceFormula,
  tally,
} from "./lib/airtableInbound"
import type { InboundSummary } from "./lib/airtableInbound"
import {
  INBOUND_FIELDS,
  INBOUND_FIELD_REASON_TEXT,
  decideField,
  inboundField,
  resolveInboundFields,
  tablesToPull,
  tagsToCell,
} from "./lib/airtableFields"
import type {
  InboundFieldSpec,
  InboundReason,
} from "./lib/airtableFields"
import type { AuditEntity } from "./lib/audit"
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

/**
 * The authorization layer throws ordinary `Error`s with human sentences —
 * fine everywhere else, but Convex strips those on production. Inside an
 * action the real message is still readable (redaction happens at the client
 * boundary), so we keep the sentence and re-throw it as a ConvexError.
 */
function authMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message.split("\n")[0]?.trim() : ""
  if (raw && raw.length < 200 && !/^Server Error/i.test(raw)) return raw
  return "You need to be an admin of this workspace to connect Airtable."
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
      /**
       * The field keys Airtable may write back, already resolved — an empty
       * selection has been expanded to the default and anything we no longer
       * recognise has been dropped, so the card renders what will actually
       * happen rather than what happens to be stored.
       */
      inboundFields: v.array(v.string()),
      inbound: v.union(
        v.object({
          at: v.number(),
          checked: v.number(),
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
    const inbound = connection.inbound
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
      inboundFields: resolveInboundFields(
        connection.twoWaySync,
        connection.inboundFields
      ).map((field) => field.key),
      inbound: inbound
        ? { ...inbound, checked: inbound.checked ?? 0 }
        : null,
    }
  },
})

/**
 * One-click connect. An ACTION, not a mutation, because it proves the
 * credentials against the live API before anything is stored — a connection
 * that only fails later is worse than no connection at all.
 *
 * Order matters: authorize → normalize + validate shape → prove the
 * token/base → make the tables → save → kick off the first full sync.
 *
 * `baseId` is deliberately forgiving: the organizer pastes their address bar
 * ("appX/tblY", or the whole https:// URL) and we dig the base id out. The UI
 * does the same normalization on blur so they can see what we understood, but
 * this is the boundary that has to hold — an API client, or a tab that
 * predates the UI fix, must get the same treatment.
 *
 * EVERY throw out of here is a ConvexError carrying a sentence. Convex hides
 * ordinary exception messages on production deployments ("Server Error"), so
 * an unwrapped throw here is, from the organizer's seat, no message at all.
 */
export const connect = action({
  args: {
    eventId: v.id("events"),
    token: v.string(),
    baseId: v.string(),
  },
  returns: v.object({
    mode: v.union(v.literal("live"), v.literal("demo")),
    baseId: v.string(),
    createdTables: v.array(v.string()),
    warnings: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runQuery(internal.airtable.assertAdmin, {
        eventId: args.eventId,
      })
    } catch (error) {
      throw new ConvexError(authMessage(error))
    }

    if (demoMode()) {
      const demoBaseId =
        (normalizeBaseId(args.baseId) ?? args.baseId.trim()) ||
        "appDemoBase000000"
      await ctx.runMutation(internal.airtable.saveConnection, {
        eventId: args.eventId,
        token: args.token.trim() || "pat-demo-token",
        baseId: demoBaseId,
        demo: true,
      })
      await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
        eventId: args.eventId,
      })
      return {
        mode: "demo" as const,
        baseId: demoBaseId,
        createdTables: [],
        warnings: [],
      }
    }

    const { token, baseId } = normalizeCredentials(args.token, args.baseId)

    let ensured
    try {
      const client = new AirtableClient(token, baseId)
      const schema = await client.getBaseSchema()
      ensured = await ensureTables(client, schema)
    } catch (error) {
      throw new ConvexError(humanAirtableError(error))
    }

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
      baseId,
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
 * Turn inbound write-back on or off, and choose which columns it covers
 * (admin only — it is the one switch that lets an outside system change
 * programme data).
 *
 * `fields` left out means "don't touch the selection", so the master switch
 * and the per-field list can be driven independently by the UI. An empty array
 * IS meaningful — it resets to the default (Status only) rather than leaving
 * the switch on with nothing to do.
 *
 * Turning it ON does not immediately pull: the first push after this writes
 * the per-field baselines, and only once a cell has a baseline can an Airtable
 * edit be told apart from our own echo. So the honest sequence is switch on →
 * next sync mirrors out → edits in Airtable come back from the sync after
 * that. Same for a newly-ticked field, which is why re-mirroring is scheduled
 * here rather than waiting for the cron.
 */
export const setTwoWaySync = mutation({
  args: {
    eventId: v.id("events"),
    enabled: v.boolean(),
    fields: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection)
      throw new ConvexError("Airtable isn't connected for this event.")

    // Store only keys we understand, so a stale tab can never park a typo in
    // the selection and quietly disable a column the organizer thinks is on.
    const fields =
      args.fields === undefined
        ? undefined
        : args.fields.filter((key) => inboundField(key) !== undefined)
    if (args.fields !== undefined && fields!.length !== args.fields.length) {
      throw new ConvexError("That isn't a field Airtable can write back.")
    }

    await ctx.db.patch(connection._id, {
      twoWaySync: args.enabled,
      ...(fields === undefined ? {} : { inboundFields: fields }),
    })

    const selected = resolveInboundFields(
      args.enabled,
      fields ?? connection.inboundFields
    )
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "settings",
      entityId: args.eventId,
      action: "updated",
      summary: args.enabled
        ? `Airtable write-back on for ${selected.length} field${selected.length === 1 ? "" : "s"}: ${selected.map((field) => field.label).join(", ")}`
        : "Airtable write-back turned off",
      meta: {
        twoWaySync: args.enabled,
        baseId: connection.baseId,
        fields: selected.map((field) => field.key).join(", "),
      },
    })
    // Re-mirror straight away so every cell has a baseline to compare against.
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
    if (!connection)
      throw new ConvexError("Airtable isn't connected for this event.")
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
      await ctx.db.patch(existing._id, {
        ...fields,
        // Reconnecting starts a fresh mirror authority. A previous
        // connection's inbound switch/selection/cursor must never silently
        // carry over: the new base first receives a clean outbound baseline,
        // then the organizer can explicitly opt back into write-back.
        twoWaySync: false,
        inboundFields: undefined,
        inbound: undefined,
        lastSyncAt: undefined,
        recordCounts: undefined,
      })
      const oldState = await ctx.db
        .query("airtableRecordSync")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect()
      for (const row of oldState) await ctx.db.delete(row._id)
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

const baselineRow = v.object({
  /** The Convex document id, exactly as it went into "Trackstage ID". */
  externalId: v.string(),
  entity: v.string(),
  /** Field key → the canonical value now sitting in that Airtable cell. */
  fields: v.record(v.string(), v.string()),
})

/**
 * Remember what we just wrote into Airtable. This is the ENTIRE loop guard:
 * with it, an inbound value that equals the baseline is our own echo, and a
 * local value that differs from the baseline means the organizer changed it
 * here since the mirror was written (so we win).
 *
 * Written for every connection, not just two-way ones, so flipping the switch
 * on doesn't need a special backfill — the baselines are already there.
 *
 * Baselines MERGE rather than replace: a submission's row collects keys from
 * both the "Submissions" and the "Sessions" push, and an unscheduled session
 * simply isn't in the second one. Replacing would erase the other table's
 * baselines on every run and push those fields back to `no_baseline` forever.
 */
export const recordBaselines = internalMutation({
  args: { eventId: v.id("events"), rows: v.array(baselineRow) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    for (const row of args.rows) {
      const existing = await findRecordState(ctx, args.eventId, row.externalId)
      const merged = { ...(existing?.lastPushed ?? {}), ...row.fields }
      if (existing) {
        await ctx.db.patch(existing._id, {
          externalId: row.externalId,
          entity: row.entity,
          lastPushed: merged,
          lastPushedAt: now,
          // Kept in step for connections that predate per-field baselines, so
          // nothing reads a stale status out of the legacy column.
          ...("submissions.status" in merged
            ? { lastPushedStatus: merged["submissions.status"] }
            : {}),
        })
      } else {
        await ctx.db.insert("airtableRecordSync", {
          eventId: args.eventId,
          externalId: row.externalId,
          entity: row.entity,
          lastPushed: merged,
          lastPushedAt: now,
          ...(row.entity === "submission"
            ? {
                submissionId:
                  ctx.db.normalizeId("submissions", row.externalId) ??
                  undefined,
                lastPushedStatus: merged["submissions.status"],
              }
            : {}),
        })
      }
    }
    return null
  },
})

/**
 * The mirror-state row for one document, adopting the pre-per-field shape when
 * it finds one.
 *
 * Rows written before speakers and sessions became syncable are keyed only by
 * `submissionId` and carry a bare `lastPushedStatus`. Looking them up by that
 * index and lifting the old column into the new map means an organizer who had
 * write-back on before an upgrade keeps their Status baseline instead of
 * losing a sync cycle to `no_baseline`.
 */
async function findRecordState(
  ctx: MutationCtx,
  eventId: Id<"events">,
  externalId: string
): Promise<Doc<"airtableRecordSync"> | null> {
  const byExternal = await ctx.db
    .query("airtableRecordSync")
    .withIndex("by_event_and_external", (q) =>
      q.eq("eventId", eventId).eq("externalId", externalId)
    )
    .unique()
  if (byExternal) return byExternal

  const submissionId = ctx.db.normalizeId("submissions", externalId)
  if (!submissionId) return null
  const legacy = await ctx.db
    .query("airtableRecordSync")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
    .unique()
  if (!legacy || legacy.eventId !== eventId) return null
  return {
    ...legacy,
    lastPushed:
      legacy.lastPushed ??
      (legacy.lastPushedStatus === undefined
        ? {}
        : { "submissions.status": legacy.lastPushedStatus }),
  }
}

/** Credentials, selection and cursor for one pull. Null when there is nothing to pull. */
export const pullContext = internalQuery({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      token: v.string(),
      baseId: v.string(),
      demo: v.boolean(),
      lastSyncAt: v.union(v.number(), v.null()),
      fieldKeys: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const connection = await connectionQuery(ctx, args.eventId)
    if (!connection || connection.twoWaySync !== true) return null
    const fields = resolveInboundFields(
      connection.twoWaySync,
      connection.inboundFields
    )
    if (fields.length === 0) return null
    return {
      token: connection.token,
      baseId: connection.baseId,
      demo: connection.demo === true,
      lastSyncAt: connection.lastSyncAt ?? null,
      fieldKeys: fields.map((field) => field.key),
    }
  },
})

const inboundRecord = v.object({
  /** Our own document id, from the "Trackstage ID" column. */
  externalId: v.string(),
  /**
   * Field key → the cell as a string. A key is present only when we actually
   * read that column, so a column missing from the base can never be mistaken
   * for an emptied cell.
   */
  values: v.record(v.string(), v.string()),
  modifiedTime: v.optional(v.string()),
})

const inboundSummaryValidator = v.object({
  checked: v.number(),
  applied: v.number(),
  skipped: v.number(),
  conflicts: v.number(),
})

/** Who an inbound change is attributed to, everywhere it leaves a trace. */
const SYNC_ACTOR = { type: "system" as const, label: "Airtable sync" }

/** One field's verdict for one record, after both guarding and applying. */
type Outcome = {
  spec: InboundFieldSpec
  reason: InboundReason
  /** The canonical value to write, present only while `reason` is "apply". */
  value?: string
  /** What Airtable held, for the conflict audit row. */
  airtableValue?: string
}

/**
 * Guard every selected field of one record. Pure bookkeeping — nothing is
 * written here, so the caller can still downgrade an "apply" that the domain
 * layer then refuses (an unknown track, a session that isn't accepted).
 */
function decideRecord(
  specs: readonly InboundFieldSpec[],
  values: Record<string, string>,
  baselines: Record<string, string>,
  current: (spec: InboundFieldSpec) => unknown
): Outcome[] {
  const outcomes: Outcome[] = []
  for (const spec of specs) {
    // Absent means we never read that column (it isn't in the base, or the
    // table wasn't pulled) — which is NOT the same as an emptied cell.
    if (!(spec.key in values)) continue
    const decision = decideField({
      spec,
      airtableValue: values[spec.key],
      currentValue: current(spec),
      baseline: baselines[spec.key],
    })
    outcomes.push({
      spec,
      reason: decision.reason,
      value: decision.apply ? decision.value : undefined,
      airtableValue: decision.apply ? undefined : decision.airtableValue,
    })
  }
  return outcomes
}

/**
 * Fold the verdicts into the run tally, write an audit row for every conflict,
 * and move the baselines of everything that actually landed.
 *
 * Moving the baseline on apply is not optional bookkeeping: after an inbound
 * write our value and the cell agree, so the baseline has to agree with them
 * too. Leave it stale and the organizer's NEXT Airtable edit reads as a
 * conflict against a value nobody holds any more.
 */
async function settleRecord(
  ctx: MutationCtx,
  args: {
    eventId: Id<"events">
    externalId: string
    entity: "submission" | "person"
    label: string
    auditEntity: AuditEntity
    outcomes: Outcome[]
    modifiedTime?: string
  }
): Promise<InboundSummary> {
  let summary = emptySummary()
  summary = { ...summary, checked: 1 }
  const applied: Record<string, string> = {}

  for (const outcome of args.outcomes) {
    summary = tally(summary, outcome.reason)
    if (outcome.reason === "apply" && outcome.value !== undefined) {
      applied[outcome.spec.key] = outcome.value
      continue
    }
    if (outcome.reason !== "conflict") continue
    // The overruled edit is recorded rather than silently dropped — an
    // organizer who edited in Airtable and lost deserves to see why.
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: args.auditEntity,
      entityId: args.externalId,
      action: "sync_conflict",
      summary: `Airtable said “${outcome.airtableValue ?? ""}” for ${outcome.spec.label} but this changed in Trackstage — Trackstage wins · ${args.label}`,
      meta: {
        field: outcome.spec.key,
        airtableValue: outcome.airtableValue ?? "",
        reason: INBOUND_FIELD_REASON_TEXT.conflict,
      },
      actor: SYNC_ACTOR,
    })
  }

  if (Object.keys(applied).length > 0) {
    const state = await findRecordState(ctx, args.eventId, args.externalId)
    const patch = {
      externalId: args.externalId,
      entity: args.entity,
      lastPushed: { ...(state?.lastPushed ?? {}), ...applied },
      lastPulledAt: Date.now(),
      lastPulledModifiedTime: args.modifiedTime,
      ...("submissions.status" in applied
        ? {
            lastPushedStatus: applied["submissions.status"],
            lastPulledStatus: applied["submissions.status"],
          }
        : {}),
    }
    if (state) await ctx.db.patch(state._id, patch)
    else {
      await ctx.db.insert("airtableRecordSync", {
        eventId: args.eventId,
        ...patch,
        ...(args.entity === "submission"
          ? {
              submissionId:
                ctx.db.normalizeId("submissions", args.externalId) ?? undefined,
            }
          : {}),
      })
    }
  }
  return summary
}

/** The selected specs for one entity, resolved from stored keys. */
function specsFor(
  keys: readonly string[],
  entity: "submission" | "person"
): InboundFieldSpec[] {
  return resolveInboundFields(true, keys).filter(
    (spec) => spec.entity === entity
  )
}

/**
 * Apply one batch of Airtable rows to SUBMISSIONS — which covers both mirrored
 * tables that key on a submission, "Submissions" and "Sessions".
 *
 * Public-ish surface note: this is INTERNAL and takes rows as data, which is
 * exactly what lets the verify suite exercise the real guard logic (and the
 * state-table roundtrip) in demo mode without an Airtable account.
 *
 * Nothing here patches a document directly. Status goes through
 * submissions.setStatusInternal, wording and classification through
 * submissions.updateDetailsInternal, and a slot through
 * agenda.rescheduleInternal — so an inbound change fires the same webhooks,
 * writes the same audit rows and keeps the same version history as a click in
 * the UI, attributed to Airtable rather than to a person.
 */
export const applyInbound = internalMutation({
  args: {
    eventId: v.id("events"),
    fieldKeys: v.array(v.string()),
    records: v.array(inboundRecord),
  },
  returns: inboundSummaryValidator,
  handler: async (ctx, args) => {
    const specs = specsFor(args.fieldKeys, "submission")
    if (specs.length === 0) return emptySummary()

    // Names, not ids, travel through a spreadsheet. Resolved once per batch.
    const [tracks, rooms] = await Promise.all([
      ctx.db
        .query("tracks")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .take(200),
      ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .take(200),
    ])
    const trackByName = new Map(
      tracks.map((track) => [track.name.trim().toLowerCase(), track])
    )
    const roomByName = new Map(
      rooms.map((room) => [room.name.trim().toLowerCase(), room])
    )
    const trackById = new Map(tracks.map((track) => [track._id, track]))
    const roomById = new Map(rooms.map((room) => [room._id, room]))

    let summary = emptySummary()

    for (const row of args.records) {
      const submissionId = ctx.db.normalizeId("submissions", row.externalId)
      const submission = submissionId ? await ctx.db.get(submissionId) : null
      // A row created by hand in Airtable, one belonging to another
      // deployment, or an id from a different event's base — none of them are
      // reachable through this connection. We never create records from a
      // spreadsheet.
      if (!submissionId || !submission || submission.eventId !== args.eventId) {
        summary = addSummary(summary, {
          checked: 1,
          applied: 0,
          skipped: 1,
          conflicts: 0,
        })
        continue
      }

      const state = await findRecordState(ctx, args.eventId, row.externalId)
      const currentTrack = submission.trackId
        ? trackById.get(submission.trackId)
        : undefined
      const currentRoom = submission.roomId
        ? roomById.get(submission.roomId)
        : undefined

      const outcomes = decideRecord(
        specs,
        row.values,
        state?.lastPushed ?? {},
        (spec) => {
          switch (spec.key) {
            case "submissions.status":
              return submission.status
            case "submissions.title":
              return submission.title
            case "submissions.description":
              return submission.description ?? ""
            case "submissions.track":
              return currentTrack?.name ?? ""
            case "submissions.format":
              return submission.format ?? ""
            case "submissions.level":
              return submission.level ?? ""
            case "submissions.language":
              return submission.language ?? ""
            case "submissions.tags":
              return tagsToCell(submission.tags)
            case "sessions.room":
              return currentRoom?.name ?? ""
            case "sessions.startsAt":
              return submission.startsAt ?? ""
            case "sessions.duration":
              return submission.durationMinutes ?? ""
            default:
              return ""
          }
        }
      )

      // ── Resolve names to ids, downgrading anything that has no match here ──
      const applying = new Map(
        outcomes
          .filter((outcome) => outcome.reason === "apply")
          .map((outcome) => [outcome.spec.key, outcome])
      )
      const downgrade = (key: string, reason: InboundReason) => {
        const outcome = applying.get(key)
        if (!outcome) return
        outcome.reason = reason
        outcome.value = undefined
        applying.delete(key)
      }

      let trackId: Id<"tracks"> | null | undefined
      const trackOutcome = applying.get("submissions.track")
      if (trackOutcome) {
        const name = (trackOutcome.value ?? "").trim()
        if (name === "") trackId = null
        else {
          const match = trackByName.get(name.toLowerCase())
          if (match) trackId = match._id
          else downgrade("submissions.track", "unresolved")
        }
      }
      let roomId: Id<"rooms"> | undefined
      const roomOutcome = applying.get("sessions.room")
      if (roomOutcome) {
        const match = roomByName.get((roomOutcome.value ?? "").toLowerCase())
        if (match) roomId = match._id
        else downgrade("sessions.room", "unresolved")
      }

      // ── Apply, most consequential first ──────────────────────────────────
      // Status leads because a schedule change in the same batch may depend on
      // it: a talk accepted in Airtable and given a slot in the same edit only
      // works if the acceptance lands first.
      const statusOutcome = applying.get("submissions.status")
      if (statusOutcome?.value) {
        await ctx.runMutation(internal.submissions.setStatusInternal, {
          submissionId,
          status: statusOutcome.value,
          actorType: SYNC_ACTOR.type,
          actorLabel: SYNC_ACTOR.label,
        })
      }

      const detail: {
        title?: string
        description?: string
        format?: string
        level?: string
        language?: string
        tags?: string[]
        trackId?: Id<"tracks"> | null
      } = {}
      const applied = (key: string) => applying.get(key)?.value
      const title = applied("submissions.title")
      if (title !== undefined) detail.title = title
      const description = applied("submissions.description")
      if (description !== undefined) detail.description = description
      const format = applied("submissions.format")
      if (format !== undefined) detail.format = format
      const level = applied("submissions.level")
      if (level !== undefined) detail.level = level
      const language = applied("submissions.language")
      if (language !== undefined) detail.language = language
      const tags = applied("submissions.tags")
      if (tags !== undefined) detail.tags = tags === "" ? [] : tags.split(", ")
      if (trackId !== undefined) detail.trackId = trackId
      if (Object.keys(detail).length > 0) {
        await ctx.runMutation(internal.submissions.updateDetailsInternal, {
          submissionId,
          patch: detail,
          actorType: SYNC_ACTOR.type,
          actorLabel: SYNC_ACTOR.label,
        })
      }

      const startsAt = applying.get("sessions.startsAt")?.value
      const duration = applying.get("sessions.duration")?.value
      if (roomId !== undefined || startsAt !== undefined || duration !== undefined) {
        const result = await ctx.runMutation(
          internal.agenda.rescheduleInternal,
          {
            submissionId,
            roomId,
            startsAt:
              startsAt === undefined ? undefined : Date.parse(startsAt),
            durationMinutes:
              duration === undefined ? undefined : Number(duration),
            actorType: SYNC_ACTOR.type,
            actorLabel: SYNC_ACTOR.label,
          }
        )
        if (result === "rejected") {
          // The agenda refused the slot (not accepted yet, or the three
          // scheduling values don't add up to a placeable session). Report it
          // per field rather than pretending the row synced.
          for (const key of [
            "sessions.room",
            "sessions.startsAt",
            "sessions.duration",
          ]) {
            downgrade(key, "rejected")
          }
        }
      }

      summary = addSummary(
        summary,
        await settleRecord(ctx, {
          eventId: args.eventId,
          externalId: row.externalId,
          entity: "submission",
          label: submission.title,
          auditEntity: submission.kind === "session" ? "session" : "submission",
          outcomes,
          modifiedTime: row.modifiedTime,
        })
      )
    }

    return summary
  },
})

/**
 * The same machinery for the Speakers table. Profile fields are the other half
 * of the spreadsheet workflow — an organizer chasing twelve missing bios wants
 * a grid, not twelve drawers — and they are safer than submission fields:
 * nothing here can move a decision or a slot.
 *
 * `Email` is deliberately not writable. It is the identity a speaker's portal
 * token, tasks and comms all hang off, so rewriting it in a spreadsheet would
 * silently cut someone off from their own submissions.
 */
export const applyInboundPeople = internalMutation({
  args: {
    eventId: v.id("events"),
    fieldKeys: v.array(v.string()),
    records: v.array(inboundRecord),
  },
  returns: inboundSummaryValidator,
  handler: async (ctx, args) => {
    const specs = specsFor(args.fieldKeys, "person")
    if (specs.length === 0) return emptySummary()

    let summary = emptySummary()
    for (const row of args.records) {
      const personId = ctx.db.normalizeId("people", row.externalId)
      const person = personId ? await ctx.db.get("people", personId) : null
      if (!personId || !person || person.eventId !== args.eventId) {
        summary = addSummary(summary, {
          checked: 1,
          applied: 0,
          skipped: 1,
          conflicts: 0,
        })
        continue
      }

      const state = await findRecordState(ctx, args.eventId, row.externalId)
      const outcomes = decideRecord(
        specs,
        row.values,
        state?.lastPushed ?? {},
        (spec) => {
          switch (spec.key) {
            case "speakers.firstName":
              return person.firstName
            case "speakers.lastName":
              return person.lastName
            case "speakers.jobTitle":
              return person.jobTitle ?? ""
            case "speakers.company":
              return person.company ?? ""
            case "speakers.pronouns":
              return person.pronouns ?? ""
            case "speakers.bio":
              return person.bio ?? ""
            case "speakers.linkedin":
              return person.links?.linkedin ?? ""
            case "speakers.twitter":
              return person.links?.twitter ?? ""
            case "speakers.website":
              return person.links?.website ?? ""
            default:
              return ""
          }
        }
      )

      const patch: {
        firstName?: string
        lastName?: string
        jobTitle?: string
        company?: string
        pronouns?: string
        bio?: string
        linkedin?: string
        twitter?: string
        website?: string
      } = {}
      for (const outcome of outcomes) {
        if (outcome.reason !== "apply" || outcome.value === undefined) continue
        // Every person field is `speakers.<documentField>` by construction —
        // the registry and convex/speakersAdmin.ts's internal twin are named
        // to match, so the mapping is the key itself.
        patch[outcome.spec.key.slice("speakers.".length) as "bio"] =
          outcome.value
      }
      if (Object.keys(patch).length > 0) {
        await ctx.runMutation(internal.speakersAdmin.updateProfileInternal, {
          personId,
          patch,
          actorType: SYNC_ACTOR.type,
          actorLabel: SYNC_ACTOR.label,
        })
      }

      summary = addSummary(
        summary,
        await settleRecord(ctx, {
          eventId: args.eventId,
          externalId: row.externalId,
          entity: "person",
          label:
            `${person.firstName} ${person.lastName}`.trim() || person.email,
          auditEntity: "speaker",
          outcomes,
          modifiedTime: row.modifiedTime,
        })
      )
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
  handler: async (ctx, args) => (await pullCore(ctx, args.eventId)).summary,
})

/**
 * The pull itself as a plain function, so `syncEvent` runs it inline instead
 * of paying for a nested action call (the two never cross runtimes).
 *
 * Returns the error rather than recording it: only `syncEvent` knows whether
 * the run as a whole failed, and it has to decide whether pushing is still
 * safe (it isn't — see there).
 */
async function pullCore(
  ctx: ActionCtx,
  eventId: Id<"events">
): Promise<{ summary: InboundSummary; error?: string }> {
  const context = await ctx.runQuery(internal.airtable.pullContext, {
    eventId,
  })
  if (!context) return { summary: emptySummary() }
  // Demo mode never talks to Airtable; the suite drives the apply mutations
  // directly with fabricated rows to exercise the same guards.
  if (context.demo || demoMode()) return { summary: emptySummary() }

  const selected = resolveInboundFields(true, context.fieldKeys)
  const client = new AirtableClient(context.token, context.baseId)
  const formula = modifiedSinceFormula(context.lastSyncAt)
  let summary = emptySummary()

  // One read per mirrored table that has at least one selected column, so an
  // organizer who only ticked speaker fields never pays for a submissions
  // read — and the Sessions table is only touched when the agenda is in play.
  for (const table of tablesToPull(selected)) {
    const specs = selected.filter((spec) => spec.table === table)
    let page: Awaited<ReturnType<typeof client.listRecords>>
    try {
      page = await client.listRecords(TABLE_NAMES[table], {
        fields: [EXTERNAL_ID_FIELD, ...specs.map((spec) => spec.column)],
        filterByFormula: formula,
        maxRecords: MAX_ROWS,
      })
    } catch (error) {
      return { summary, error: humanAirtableError(error) }
    }

    // A column the organizer deleted from their base is dropped from the read
    // rather than failing it — but it is then excluded from the candidates
    // entirely, because "we couldn't read this column" must never be mistaken
    // for "this cell is empty" by a field that is allowed to clear.
    const readable = specs.filter(
      (spec) => !page.droppedFields.includes(spec.column)
    )
    if (readable.length === 0) continue

    const candidates = page.records
      .map((record) => ({
        externalId: String(record.fields[EXTERNAL_ID_FIELD] ?? "").trim(),
        values: Object.fromEntries(
          readable.map((spec) => [spec.key, cellToString(record.fields[spec.column])])
        ),
      }))
      .filter((row) => row.externalId.length > 0)

    const apply =
      table === "speakers"
        ? internal.airtable.applyInboundPeople
        : internal.airtable.applyInbound
    for (let i = 0; i < candidates.length; i += STATE_BATCH) {
      const batch = await ctx.runMutation(apply, {
        eventId,
        fieldKeys: readable.map((spec) => spec.key),
        records: candidates.slice(i, i + STATE_BATCH),
      })
      summary = addSummary(summary, batch)
    }
  }

  await ctx.runMutation(internal.airtable.finishPull, {
    eventId,
    summary,
  })
  return { summary }
}

/**
 * An Airtable cell as the guard wants it: a string, with an absent cell and an
 * empty one collapsing to "". Numbers (durations) and the odd array-valued
 * cell (a multi-select the organizer changed the column type to) are rendered
 * rather than dropped, so the parser gets a chance to reject them by name
 * instead of silently seeing a blank.
 */
function cellToString(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(cellToString).join(", ")
  return ""
}

/**
 * The sync itself. Idempotent by construction (PATCH upsert on
 * "Trackstage ID"), so it is safe to run concurrently with itself — which
 * it will be, because the cron and the on-write hook are independent.
 *
 * A failure is recorded on the connection rather than thrown away: the
 * Integrations card shows the organizer exactly what Airtable said.
 *
 * PULL THEN PUSH, always in that order, and the order is load-bearing.
 * The push rewrites every mirrored cell — including Status — so a push that
 * ran first would overwrite the organizer's Airtable edit before the pull
 * could ever read it, and the pull would then see nothing but our own value.
 * (It did exactly that until 2026-08-11; the inbound half was quietly a
 * no-op for real edits.) Reading first means the payload we mirror out
 * already contains anything we just accepted, so one run settles both sides.
 */
export const syncEvent = internalAction({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.airtable.beginSync, {
      eventId: args.eventId,
    })

    // INBOUND FIRST. A no-op — one indexed read — unless the connection has
    // two-way sync switched on.
    const inbound = await pullCore(ctx, args.eventId)
    if (inbound.error) {
      // We could not read their side, so we must not write over it: an
      // unread Airtable edit is exactly what the push would destroy. Record
      // the reason and let the next sync (cron, 5 minutes) try again.
      await ctx.runMutation(internal.airtable.finishSync, {
        eventId: args.eventId,
        error: inbound.error,
      })
      return null
    }

    const payload = await ctx.runQuery(internal.airtable.syncPayload, {
      eventId: args.eventId,
    })
    if (!payload) return null // disconnected between scheduling and running

    const counts = {
      submissions: payload.submissions.length,
      speakers: payload.speakers.length,
      sessions: payload.sessions.length,
    }

    // The exact cells we are about to write. Baselines are derived from THESE
    // objects rather than re-derived from the documents, so the value we
    // record as "what's in Airtable" is literally the value we sent.
    const tables: Array<{
      key: TableKey
      entity: "submission" | "person"
      records: Array<{ id: string; fields: AirtableFields }>
    }> = [
      {
        key: "submissions",
        entity: "submission",
        records: payload.submissions.map((row) => ({
          id: String(row.id),
          fields: submissionFields(row),
        })),
      },
      {
        key: "speakers",
        entity: "person",
        records: payload.speakers.map((row) => ({
          id: String(row.id),
          fields: speakerFields(row),
        })),
      },
      {
        key: "sessions",
        entity: "submission",
        records: payload.sessions.map((row) => ({
          id: String(row.id),
          fields: sessionFields(row),
        })),
      },
    ]

    if (payload.demo || demoMode()) {
      // Nothing leaves the deployment: the mirror is simulated so the UI,
      // the cron and the verify suite are all exercisable without an
      // Airtable account.
      await recordPushed(ctx, args.eventId, baselinesFor(tables, {}))
      await ctx.runMutation(internal.airtable.finishSync, {
        eventId: args.eventId,
        counts,
      })
      return null
    }

    const client = new AirtableClient(payload.token, payload.baseId)
    // Columns the base turned out not to have. We never wrote them, so they
    // must not get a baseline — claiming to have written a cell we didn't is
    // the one bookkeeping error that could let a pull overwrite live data.
    const dropped: Record<string, string[]> = {}
    try {
      for (const table of tables) {
        if (table.records.length === 0) continue
        const result = await client.upsert(
          TABLE_NAMES[table.key],
          table.records.map((record) => ({ fields: record.fields }))
        )
        dropped[table.key] = result.droppedFields
      }
    } catch (error) {
      await ctx.runMutation(internal.airtable.finishSync, {
        eventId: args.eventId,
        error: humanAirtableError(error),
      })
      return null
    }

    // The baselines move last, once the mirror really holds these values —
    // that is what lets the NEXT pull tell an organizer's edit apart from our
    // own write coming back.
    await recordPushed(ctx, args.eventId, baselinesFor(tables, dropped))
    await ctx.runMutation(internal.airtable.finishSync, {
      eventId: args.eventId,
      counts,
    })
    return null
  },
})

type BaselineRow = {
  externalId: string
  entity: string
  fields: Record<string, string>
}

/**
 * Turn the cells we just pushed into per-field baselines, one row per
 * DOCUMENT — the Submissions and Sessions pushes both contribute to the same
 * submission's row, which is why they are merged here rather than written
 * twice.
 *
 * Each value goes through the same `parse` the inbound side uses, so the
 * baseline is spelled exactly the way a pull will spell the cell it reads
 * back. That single shared function is what makes echo detection reliable;
 * deriving the baseline any other way is how a mirror starts fighting itself.
 */
function baselinesFor(
  tables: Array<{
    key: TableKey
    entity: "submission" | "person"
    records: Array<{ id: string; fields: AirtableFields }>
  }>,
  dropped: Record<string, string[]>
): BaselineRow[] {
  const byDocument = new Map<string, BaselineRow>()
  for (const table of tables) {
    const specs = INBOUND_FIELDS.filter(
      (spec) =>
        spec.table === table.key &&
        !(dropped[table.key] ?? []).includes(spec.column)
    )
    if (specs.length === 0) continue
    for (const record of table.records.slice(0, MAX_ROWS)) {
      let row = byDocument.get(record.id)
      if (!row) {
        row = { externalId: record.id, entity: table.entity, fields: {} }
        byDocument.set(record.id, row)
      }
      for (const spec of specs) {
        const canonical = spec.parse(record.fields[spec.column])
        // Our own value failing our own parser means the mirror holds
        // something this field can't represent. Recording no baseline leaves
        // it at `no_baseline` — inert — which beats recording a wrong one.
        if (canonical !== null) row.fields[spec.key] = canonical
      }
    }
  }
  return [...byDocument.values()]
}

/** Baseline write, chunked to stay well inside one transaction each. */
async function recordPushed(
  ctx: ActionCtx,
  eventId: Id<"events">,
  rows: BaselineRow[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += STATE_BATCH) {
    await ctx.runMutation(internal.airtable.recordBaselines, {
      eventId,
      rows: rows.slice(i, i + STATE_BATCH),
    })
  }
}

/**
 * Cron entry point (every 5 minutes). Catches everything the on-write hook
 * can't see cheaply — status changes, agenda moves, profile edits — and is
 * free when nothing changed, because an upsert of unchanged rows is a no-op
 * on Airtable's side.
 *
 * It also sweeps ORPHANS. A connection row holds a live Airtable token; if the
 * event it belongs to is gone, that token is both useless and a secret we have
 * no reason to keep, so the row goes with the event. (Deleting an event cannot
 * reach every child table by hand — this is the backstop, and it is the only
 * place that ever deletes a connection the organizer didn't disconnect.)
 */
export const syncAllConnected = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number(), orphansRemoved: v.number() }),
  handler: async (ctx) => {
    const connections = await ctx.db
      .query("airtableConnections")
      .take(MAX_CONNECTIONS_PER_RUN)
    let scheduled = 0
    let orphansRemoved = 0
    for (const connection of connections) {
      const event = await ctx.db.get(connection.eventId)
      if (!event) {
        await ctx.db.delete(connection._id)
        orphansRemoved++
        continue
      }
      await ctx.scheduler.runAfter(0, internal.airtable.syncEvent, {
        eventId: connection.eventId,
      })
      scheduled++
    }
    return { scheduled, orphansRemoved }
  },
})

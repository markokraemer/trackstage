import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { requireEventAccess } from "./lib/auth"
import { record as recordAudit } from "./lib/audit"
import { emitWebhook } from "./webhooks"

// A submission is schedulable when accepted (or a manual session).
function isSchedulable(s: Doc<"submissions">) {
  return s.status === "accepted"
}

function overlaps(
  aStart: number,
  aMinutes: number,
  bStart: number,
  bMinutes: number,
) {
  const aEnd = aStart + aMinutes * 60_000
  const bEnd = bStart + bMinutes * 60_000
  return aStart < bEnd && bStart < aEnd
}

async function speakersOf(ctx: QueryCtx, submissionId: Id<"submissions">) {
  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submissionId))
    .collect()
  return participants.filter((p) => p.role === "speaker")
}

export type Conflict = {
  kind: "room" | "speaker"
  label: string
  submissionIds: [Id<"submissions">, Id<"submissions">]
}

export async function computeConflicts(ctx: QueryCtx, eventId: Id<"events">) {
  const scheduled = (
    await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", eventId).eq("status", "accepted"),
      )
      .collect()
  ).filter(
    (s) =>
      s.deletedAt === undefined &&
      s.startsAt !== undefined &&
      s.durationMinutes !== undefined,
  )

  const conflicts: Array<{
    kind: "room" | "speaker"
    label: string
    a: { id: Id<"submissions">; title: string }
    b: { id: Id<"submissions">; title: string }
  }> = []

  // Room double-bookings.
  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i]
      const b = scheduled[j]
      if (!overlaps(a.startsAt!, a.durationMinutes!, b.startsAt!, b.durationMinutes!)) {
        continue
      }
      if (a.roomId && a.roomId === b.roomId) {
        const room = await ctx.db.get(a.roomId)
        conflicts.push({
          kind: "room",
          label: `Both booked in ${room?.name ?? "the same room"} at the same time`,
          a: { id: a._id, title: a.title },
          b: { id: b._id, title: b.title },
        })
      }
    }
  }

  // Speaker double-bookings (across any rooms).
  const speakerMap = new Map<string, Array<Doc<"submissions">>>()
  for (const s of scheduled) {
    for (const sp of await speakersOf(ctx, s._id)) {
      const key = sp.personId
      const list = speakerMap.get(key) ?? []
      list.push(s)
      speakerMap.set(key, list)
    }
  }
  for (const [personId, sessions] of speakerMap) {
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i]
        const b = sessions[j]
        if (overlaps(a.startsAt!, a.durationMinutes!, b.startsAt!, b.durationMinutes!)) {
          const person = await ctx.db.get(personId as Id<"people">)
          const name = person
            ? `${person.firstName} ${person.lastName}`.trim()
            : "A speaker"
          conflicts.push({
            kind: "speaker",
            label: `${name} is booked in two overlapping sessions`,
            a: { id: a._id, title: a.title },
            b: { id: b._id, title: b.title },
          })
        }
      }
    }
  }
  return conflicts
}

export const board = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const accepted = (
      await ctx.db
        .query("submissions")
        .withIndex("by_eventId_and_status", (q) =>
          q.eq("eventId", args.eventId).eq("status", "accepted"),
        )
        .collect()
    ).filter((s) => s.deletedAt === undefined)

    const rooms = (
      await ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .collect()
    ).sort((a, b) => a.order - b.order)
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect()

    const enrich = async (s: Doc<"submissions">) => {
      const speakers = await Promise.all(
        (await speakersOf(ctx, s._id)).map(async (p) => {
          const person = await ctx.db.get(p.personId)
          return person
            ? `${person.firstName} ${person.lastName}`.trim() || person.email
            : ""
        }),
      )
      const track = s.trackId ? tracks.find((t) => t._id === s.trackId) : undefined
      return {
        id: s._id,
        title: s.title,
        durationMinutes: s.durationMinutes ?? 45,
        startsAt: s.startsAt,
        roomId: s.roomId,
        track: track ? { name: track.name, color: track.color } : null,
        speakers: speakers.filter(Boolean),
        kind: s.kind,
      }
    }

    const scheduled = await Promise.all(
      accepted.filter((s) => s.startsAt !== undefined).map(enrich),
    )
    const unscheduled = await Promise.all(
      accepted.filter((s) => s.startsAt === undefined).map(enrich),
    )
    const conflicts = await computeConflicts(ctx, args.eventId)

    return {
      event: {
        name: event.name,
        slug: event.slug,
        timezone: event.timezone,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        agendaPublishedAt: event.agendaPublishedAt ?? null,
      },
      rooms,
      tracks,
      scheduled,
      unscheduled,
      conflicts,
    }
  },
})

// ——— Publish / go live (sbek AIA-07) ————————————————————————————————————
// Scheduling is an internal draft until the organizer says so. Publishing is
// one reversible flag on the event; every public query in convex/publicData.ts
// reads it, so unpublishing pulls the whole program back behind
// "Schedule coming soon" without touching a single session.

export const publishAgenda = mutation({
  args: { eventId: v.id("events") },
  returns: v.object({
    agendaPublishedAt: v.number(),
    sessionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId, "admin")
    const now = Date.now()
    await ctx.db.patch(args.eventId, { agendaPublishedAt: now })
    const accepted = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", "accepted"),
      )
      .collect()
    const sessionCount = accepted.filter(
      (s) => s.deletedAt === undefined && s.startsAt !== undefined,
    ).length
    // Outbound webhooks (convex/webhooks.ts) — fire-and-forget.
    await emitWebhook(ctx, args.eventId, "agenda.published", {
      id: args.eventId,
      name: event.name,
      slug: event.slug,
      published_at: new Date(now).toISOString(),
      session_count: sessionCount,
    })
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "agenda",
      entityId: args.eventId,
      action: "published",
      summary: `Agenda published — ${sessionCount} scheduled session${sessionCount === 1 ? "" : "s"} went public`,
      meta: { sessionCount },
    })
    return { agendaPublishedAt: now, sessionCount }
  },
})

export const unpublishAgenda = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId, "admin")
    await ctx.db.patch(args.eventId, { agendaPublishedAt: undefined })
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "agenda",
      entityId: args.eventId,
      action: "unpublished",
      summary: "Agenda unpublished — the public schedule is hidden again",
    })
    return null
  },
})

export const schedule = mutation({
  args: {
    submissionId: v.id("submissions"),
    roomId: v.id("rooms"),
    startsAt: v.number(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Session not found")
    await requireEventAccess(ctx, submission.eventId)
    if (!isSchedulable(submission)) {
      throw new Error("Only accepted sessions can be scheduled.")
    }
    const room = await ctx.db.get(args.roomId)
    if (!room || room.eventId !== submission.eventId) {
      throw new Error("Room belongs to a different event.")
    }
    if (args.durationMinutes < 5 || args.durationMinutes > 480) {
      throw new Error("Duration must be between 5 minutes and 8 hours.")
    }
    await ctx.db.patch(args.submissionId, {
      roomId: args.roomId,
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes,
    })
    // Conflicts are computed reactively by `board` — scheduling is never
    // blocked, only flagged (organizers stay in control).
    await emitWebhook(ctx, submission.eventId, "session.scheduled", {
      id: args.submissionId,
      title: submission.title,
      room_id: args.roomId,
      starts_at: new Date(args.startsAt).toISOString(),
      duration_minutes: args.durationMinutes,
    })
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: "session",
      entityId: args.submissionId,
      action: submission.startsAt === undefined ? "scheduled" : "rescheduled",
      summary: `${submission.startsAt === undefined ? "Scheduled" : "Moved"} to ${room.name}, ${new Date(args.startsAt).toISOString()} (${args.durationMinutes} min) · ${submission.title}`,
      meta: {
        room: room.name,
        startsAt: args.startsAt,
        durationMinutes: args.durationMinutes,
        previousStartsAt: submission.startsAt,
        title: submission.title,
      },
    })
    return null
  },
})

export const unschedule = mutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("Session not found")
    await requireEventAccess(ctx, submission.eventId)
    await ctx.db.patch(args.submissionId, {
      roomId: undefined,
      startsAt: undefined,
    })
    await emitWebhook(ctx, submission.eventId, "session.unscheduled", {
      id: args.submissionId,
      title: submission.title,
    })
    await recordAudit(ctx, {
      eventId: submission.eventId,
      entity: "session",
      entityId: args.submissionId,
      action: "unscheduled",
      summary: `Removed from the agenda · ${submission.title}`,
      meta: { title: submission.title, previousStartsAt: submission.startsAt },
    })
    return null
  },
})

// "AI agenda" basics: greedy auto-placement of unscheduled accepted sessions
// into free slots — earliest gap first, preferring emptier rooms, avoiding
// speaker overlaps. Deterministic and explainable.
/**
 * The greedy auto-placement itself, split out from the public mutation so the
 * MCP server (convex/mcp.ts) can run the SAME algorithm after authorizing via
 * an API key instead of a browser session. Callers must have already
 * authorized access to `event`.
 */
export async function autoPlaceCore(
  ctx: MutationCtx,
  event: Doc<"events">,
  args: {
    dayStartHour?: number
    dayEndHour?: number
    defaultDurationMinutes?: number
    gapMinutes?: number
  },
) {
  {
    const eventId = event._id
    if (!event.startsAt || !event.endsAt) {
      throw new Error("Set the event start and end dates first (Settings).")
    }
    const rooms = (
      await ctx.db
        .query("rooms")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .collect()
    ).sort((a, b) => a.order - b.order)
    if (rooms.length === 0) throw new Error("Add at least one room first (Settings).")

    const accepted = await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", eventId).eq("status", "accepted"),
      )
      .collect()
    const live = accepted.filter((s) => s.deletedAt === undefined)
    const scheduled = live.filter((s) => s.startsAt !== undefined)
    const unscheduled = live.filter((s) => s.startsAt === undefined)

    const duration = args.defaultDurationMinutes ?? 45
    const gap = args.gapMinutes ?? 15
    const dayStartHour = args.dayStartHour ?? 9
    const dayEndHour = args.dayEndHour ?? 18

    // Build candidate slots per day within event range (UTC-based hours offset
    // approximation using the event's stored timestamps as anchors).
    const dayMs = 24 * 60 * 60 * 1000
    const days: number[] = []
    for (let t = event.startsAt; t <= event.endsAt; t += dayMs) days.push(t)

    const placements: Array<{ submissionId: Id<"submissions">; roomId: Id<"rooms">; startsAt: number }> = []
    const occupied: Array<{ roomId: Id<"rooms">; startsAt: number; durationMinutes: number; speakers: Array<Id<"people">> }> = []
    for (const s of scheduled) {
      occupied.push({
        roomId: s.roomId!,
        startsAt: s.startsAt!,
        durationMinutes: s.durationMinutes ?? duration,
        speakers: (await speakersOf(ctx, s._id)).map((p) => p.personId),
      })
    }

    for (const submission of unscheduled) {
      const speakers = (await speakersOf(ctx, submission._id)).map((p) => p.personId)
      let placed = false
      outer: for (const dayAnchor of days) {
        const dayStart = new Date(dayAnchor)
        dayStart.setUTCHours(dayStartHour, 0, 0, 0)
        const dayEnd = new Date(dayAnchor)
        dayEnd.setUTCHours(dayEndHour, 0, 0, 0)
        for (
          let slot = dayStart.getTime();
          slot + duration * 60_000 <= dayEnd.getTime();
          slot += (duration + gap) * 60_000
        ) {
          // Prefer rooms in order; pick first free room where no speaker clashes.
          for (const room of rooms) {
            const roomBusy = occupied.some(
              (o) =>
                o.roomId === room._id &&
                overlaps(o.startsAt, o.durationMinutes, slot, duration),
            )
            if (roomBusy) continue
            const speakerBusy = occupied.some(
              (o) =>
                o.speakers.some((sp) => speakers.includes(sp)) &&
                overlaps(o.startsAt, o.durationMinutes, slot, duration),
            )
            if (speakerBusy) continue
            placements.push({ submissionId: submission._id, roomId: room._id, startsAt: slot })
            occupied.push({ roomId: room._id, startsAt: slot, durationMinutes: duration, speakers })
            placed = true
            break outer
          }
        }
      }
      if (!placed) {
        // Leave unscheduled; the UI reports how many couldn't fit.
      }
    }

    for (const p of placements) {
      await ctx.db.patch(p.submissionId, {
        roomId: p.roomId,
        startsAt: p.startsAt,
        durationMinutes: duration,
      })
    }
    return { placed: placements.length, remaining: unscheduled.length - placements.length }
  }
}

export const autoPlace = mutation({
  args: {
    eventId: v.id("events"),
    dayStartHour: v.optional(v.number()), // event-local, default 9
    dayEndHour: v.optional(v.number()), // default 18
    defaultDurationMinutes: v.optional(v.number()), // default 45
    gapMinutes: v.optional(v.number()), // default 15
  },
  handler: async (ctx, args) => {
    const { event } = await requireEventAccess(ctx, args.eventId)
    const result = await autoPlaceCore(ctx, event, args)
    // One row for the whole run: auto-placement is a single organizer action
    // and a row per placed talk would flood the feed.
    await recordAudit(ctx, {
      eventId: args.eventId,
      entity: "agenda",
      entityId: args.eventId,
      action: "auto_placed",
      summary: `Auto-placed ${result.placed} session${result.placed === 1 ? "" : "s"}${result.remaining > 0 ? ` — ${result.remaining} still unscheduled` : ""}`,
      meta: { placed: result.placed, remaining: result.remaining },
    })
    return result
  },
})

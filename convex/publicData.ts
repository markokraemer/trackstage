import { v } from "convex/values"
import { internalQuery, query } from "./_generated/server"
import type { QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

// ————————————————————————————————————————————————————————————————————————
// Public event surfaces (SPEC §4.6/§7, sbek "Public & Embeddable Widgets").
// Everything here is reachable with NO login, by event slug only, so it must
// only ever return safe display fields: never emails, phones, portal tokens,
// evaluator tokens, evaluation scores or submitter contact details.
//
// These queries are the data behind: the public schedule (agenda grid /
// itinerary), the speaker gallery + speaker list, the sessions catalog with
// search + facets, session detail, and a speaker's personal itinerary.
// Every one of them is empty-safe: an event with nothing scheduled still
// returns a well-formed, renderable payload.
// ————————————————————————————————————————————————————————————————————————

const MAX_ROWS = 4000

export type PublicSpeaker = {
  _id: Id<"people">
  name: string
  firstName: string
  lastName: string
  jobTitle?: string
  company?: string
  bio?: string
  headshotUrl: string | null
  links?: {
    linkedin?: string
    twitter?: string
    website?: string
  }
}

/**
 * A person on a session, with the role they hold *on that session*. Roles are
 * per-participation, not per-person: the same human can chair one panel and
 * speak in another, and both public surfaces have to say so (gap #19).
 */
export type PublicSessionSpeaker = PublicSpeaker & { role: string }

/** Roles the product understands, in the wording the UI shows. */
export const ROLE_LABELS: Record<string, string> = {
  speaker: "Speaker",
  chairperson: "Chairperson",
  moderator: "Moderator",
}

export function roleLabel(role: string): string {
  return (
    ROLE_LABELS[role] ??
    (role ? role.charAt(0).toUpperCase() + role.slice(1) : "Speaker")
  )
}

export type PublicSession = {
  _id: Id<"submissions">
  title: string
  description?: string
  startsAt?: number
  endsAt?: number
  durationMinutes?: number
  room: { _id: Id<"rooms">; name: string; capacity?: number } | null
  track: { _id: Id<"tracks">; name: string; color: string } | null
  format?: string
  level?: string
  language?: string
  tags: Array<string>
  speakers: Array<PublicSessionSpeaker>
}

function personName(person: Doc<"people">): string {
  const name = `${person.firstName} ${person.lastName}`.trim()
  return name || "Speaker"
}

function dayKey(ms: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString().slice(0, 10)
  }
}

function dayLabel(ms: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toDateString()
  }
}

function apiEventShape(event: Doc<"events">) {
  return {
    _id: event._id,
    name: event.name,
    slug: event.slug,
    timezone: event.timezone,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venue: event.venue,
  }
}

async function eventBySlug(ctx: QueryCtx, slug: string) {
  const trimmed = slug.trim()
  if (!trimmed) return null
  return await ctx.db
    .query("events")
    .withIndex("by_slug", (q) => q.eq("slug", trimmed))
    .unique()
}

/**
 * Loads the whole public program for an event once: accepted sessions, their
 * rooms/tracks, and their speakers (headshot URLs resolved). Every public
 * query below is a projection of this so the shapes never drift apart.
 */
/**
 * Copy shown on every public surface while the program is still a draft.
 * Organizers flip this with agenda.publishAgenda (sbek AIA-07).
 */
export const UNPUBLISHED_MESSAGE = "Schedule coming soon"

async function loadProgram(ctx: QueryCtx, slug: string) {
  const event = await eventBySlug(ctx, slug)
  if (!event) return null
  // Not published yet ⇒ the event exists publicly, its program does not.
  const published = event.agendaPublishedAt !== undefined

  const roomRows = await ctx.db
    .query("rooms")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(MAX_ROWS)
  const trackRows = await ctx.db
    .query("tracks")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(MAX_ROWS)
  // Only accepted submissions are ever public — the published program.
  // On top of that, `publicVisible: false` keeps an individual session off
  // every public surface (sbek CNT-12, Sessionboard's "Display Session"
  // checkbox): still accepted, still on the organizer's agenda, simply not
  // announced. Absent ⇒ visible, so nothing existing changes behaviour.
  const submissionRows = (
    await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", event._id).eq("status", "accepted")
      )
      .take(MAX_ROWS)
  ).filter(
    (submission) =>
      submission.deletedAt === undefined && submission.publicVisible !== false,
  )

  const rooms = new Map(roomRows.map((r) => [r._id, r]))
  const tracks = new Map(trackRows.map((t) => [t._id, t]))

  const speakerCache = new Map<Id<"people">, PublicSpeaker>()
  const sessionsByPerson = new Map<Id<"people">, Array<Id<"submissions">>>()
  // "sessionId:personId" → the role that person holds on that session, so the
  // speaker directory can label each of a person's sessions correctly.
  const roleBySessionPerson = new Map<string, string>()
  // Every distinct role a person holds across the programme, in first-seen
  // order — the summary the gallery shows next to their name.
  const rolesByPerson = new Map<Id<"people">, Array<string>>()

  const sessions: Array<PublicSession> = []
  for (const submission of submissionRows) {
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(64)
    participants.sort((a, b) => a.order - b.order)

    const speakers: Array<PublicSessionSpeaker> = []
    for (const participant of participants) {
      let speaker = speakerCache.get(participant.personId)
      if (!speaker) {
        const person = await ctx.db.get(participant.personId)
        if (!person) continue
        // Per-speaker eye toggle (sbek CNT-12): a hidden person disappears
        // from the gallery, from their sessions' speaker lists, from the API
        // and from their own itinerary. The session itself stays public.
        if (person.publicVisible === false) continue
        speaker = {
          _id: person._id,
          name: personName(person),
          firstName: person.firstName,
          lastName: person.lastName,
          jobTitle: person.jobTitle,
          company: person.company,
          bio: person.bio,
          headshotUrl: person.headshotId
            ? await ctx.storage.getUrl(person.headshotId)
            : null,
          links: person.links,
        }
        speakerCache.set(person._id, speaker)
      }
      const role = participant.role || "speaker"
      speakers.push({ ...speaker, role })
      roleBySessionPerson.set(`${submission._id}:${speaker._id}`, role)
      const roles = rolesByPerson.get(speaker._id) ?? []
      if (!roles.includes(role)) roles.push(role)
      rolesByPerson.set(speaker._id, roles)
      const list = sessionsByPerson.get(speaker._id) ?? []
      if (!list.includes(submission._id)) list.push(submission._id)
      sessionsByPerson.set(speaker._id, list)
    }

    const room = submission.roomId
      ? (rooms.get(submission.roomId) ?? null)
      : null
    const track = submission.trackId
      ? (tracks.get(submission.trackId) ?? null)
      : null
    sessions.push({
      _id: submission._id,
      title: submission.title,
      description: submission.description,
      startsAt: submission.startsAt,
      endsAt:
        submission.startsAt !== undefined &&
        submission.durationMinutes !== undefined
          ? submission.startsAt + submission.durationMinutes * 60_000
          : undefined,
      durationMinutes: submission.durationMinutes,
      room: room
        ? { _id: room._id, name: room.name, capacity: room.capacity }
        : null,
      track: track
        ? { _id: track._id, name: track.name, color: track.color }
        : null,
      format: submission.format,
      level: submission.level,
      language: submission.language,
      tags: submission.tags,
      speakers,
    })
  }

  sessions.sort(
    (a, b) =>
      (a.startsAt ?? Number.MAX_SAFE_INTEGER) -
        (b.startsAt ?? Number.MAX_SAFE_INTEGER) ||
      a.title.localeCompare(b.title)
  )

  const logoUrl = event.logoId ? await ctx.storage.getUrl(event.logoId) : null

  return {
    published,
    /** Non-null exactly when the program is still a draft. */
    publicMessage: published ? null : UNPUBLISHED_MESSAGE,
    event: {
      _id: event._id,
      name: event.name,
      slug: event.slug,
      type: event.type,
      description: event.description,
      venue: event.venue,
      websiteUrl: event.websiteUrl,
      timezone: event.timezone,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      logoUrl,
    },
    sessions,
    rooms: roomRows
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ _id: r._id, name: r.name, capacity: r.capacity })),
    tracks: trackRows
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ _id: t._id, name: t.name, color: t.color })),
    speakers: [...speakerCache.values()],
    sessionsByPerson,
    roleBySessionPerson,
    rolesByPerson,
  }
}

function groupByDay(
  sessions: Array<PublicSession>,
  timezone: string
): Array<{ date: string; label: string; sessions: Array<PublicSession> }> {
  const byDay = new Map<
    string,
    { label: string; sessions: Array<PublicSession> }
  >()
  for (const session of sessions) {
    if (session.startsAt === undefined) continue
    const key = dayKey(session.startsAt, timezone)
    const bucket = byDay.get(key) ?? {
      label: dayLabel(session.startsAt, timezone),
      sessions: [],
    }
    bucket.sessions.push(session)
    byDay.set(key, bucket)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, bucket]) => ({
      date,
      label: bucket.label,
      sessions: bucket.sessions
        .slice()
        .sort(
          (a, b) =>
            (a.startsAt ?? 0) - (b.startsAt ?? 0) ||
            a.title.localeCompare(b.title)
        ),
    }))
}

function uniqueSorted(values: Array<string | undefined>): Array<string> {
  return [...new Set(values.filter((x): x is string => Boolean(x)))].sort(
    (a, b) => a.localeCompare(b)
  )
}

// ——— Public queries ——————————————————————————————————————————————————————

/**
 * The published program: event header + day-grouped sessions (agenda grid,
 * itinerary and day tabs all render from this). Accepted-but-unscheduled
 * sessions land in an "Unscheduled" bucket, present only when non-empty.
 */
export const schedule = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const program = await loadProgram(ctx, args.slug)
    if (!program) return null
    const { event, rooms, tracks } = program
    // Draft program: the event page still renders (name, dates, venue), the
    // schedule itself does not exist publicly yet.
    const sessions = program.published ? program.sessions : []

    const days = groupByDay(sessions, event.timezone)
    const unscheduled = sessions.filter((s) => s.startsAt === undefined)

    return {
      event,
      publicMessage: program.publicMessage,
      published: program.published,
      days,
      // Only surfaced when there is actually something to show.
      unscheduled: unscheduled.length > 0 ? unscheduled : [],
      rooms,
      tracks,
      totals: {
        sessions: sessions.length,
        scheduled: sessions.length - unscheduled.length,
        days: days.length,
        speakers: program.speakers.length,
      },
    }
  },
})

/**
 * Speaker gallery + speaker directory. Alphabetical by surname (the ordering
 * SessionBoard's gallery/list widgets use), each with their session list.
 */
export const speakers = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const program = await loadProgram(ctx, args.slug)
    if (!program) return null
    const { event, sessions, sessionsByPerson } = program
    const byId = new Map(sessions.map((s) => [s._id, s]))

    const rows = program.speakers.map((speaker) => {
      // Speakers stay public while the program is a draft; their *slots* don't.
      const ids = program.published ? (sessionsByPerson.get(speaker._id) ?? []) : []
      const mine = ids
        .map((id) => byId.get(id))
        .filter((s): s is PublicSession => Boolean(s))
        .sort(
          (a, b) =>
            (a.startsAt ?? Number.MAX_SAFE_INTEGER) -
              (b.startsAt ?? Number.MAX_SAFE_INTEGER) ||
            a.title.localeCompare(b.title)
        )
      // The roles this person actually holds (gap #19) — a moderator is not a
      // speaker, and the directory used to call everyone one.
      const roles = program.rolesByPerson.get(speaker._id) ?? ["speaker"]
      return {
        ...speaker,
        roles,
        roleLabels: roles.map(roleLabel),
        sessions: mine.map((s) => {
          const role =
            program.roleBySessionPerson.get(`${s._id}:${speaker._id}`) ??
            "speaker"
          return {
            _id: s._id,
            title: s.title,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            durationMinutes: s.durationMinutes,
            roomName: s.room?.name ?? null,
            track: s.track,
            role,
            roleLabel: roleLabel(role),
          }
        }),
        sessionCount: mine.length,
      }
    })
    rows.sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName)
    )
    return {
      event,
      publicMessage: program.publicMessage,
      published: program.published,
      speakers: rows,
      totalResults: rows.length,
    }
  },
})

/**
 * Flat sessions catalog + facet values, for the search/filter widget
 * (search matches session titles AND speaker names client-side).
 */
export const sessionsList = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const program = await loadProgram(ctx, args.slug)
    if (!program) return null
    const { event, tracks } = program
    const sessions = program.published ? program.sessions : []
    return {
      event,
      publicMessage: program.publicMessage,
      published: program.published,
      sessions,
      totalResults: sessions.length,
      facets: {
        tracks,
        formats: uniqueSorted(sessions.map((s) => s.format)),
        levels: uniqueSorted(sessions.map((s) => s.level)),
        languages: uniqueSorted(sessions.map((s) => s.language)),
        rooms: uniqueSorted(sessions.map((s) => s.room?.name)),
        tags: uniqueSorted(sessions.flatMap((s) => s.tags)),
      },
    }
  },
})

/** Full public detail for one session, including speaker bios. */
export const sessionDetail = query({
  args: { slug: v.string(), submissionId: v.string() },
  handler: async (ctx, args) => {
    const program = await loadProgram(ctx, args.slug)
    if (!program) return null
    const blank = {
      event: program.event,
      publicMessage: program.publicMessage,
      published: program.published,
      session: null,
      prev: null,
      next: null,
    }
    if (!program.published) return blank
    const id = ctx.db.normalizeId("submissions", args.submissionId)
    if (!id) return blank
    const session = program.sessions.find((s) => s._id === id) ?? null
    if (!session) return blank

    const index = program.sessions.findIndex((s) => s._id === id)
    return {
      event: program.event,
      publicMessage: program.publicMessage,
      published: program.published,
      session: {
        ...session,
        dayLabel:
          session.startsAt !== undefined
            ? dayLabel(session.startsAt, program.event.timezone)
            : null,
      },
      // Cheap prev/next so the detail view can page through the program.
      prev:
        index > 0
          ? {
              _id: program.sessions[index - 1]._id,
              title: program.sessions[index - 1].title,
            }
          : null,
      next:
        index >= 0 && index < program.sessions.length - 1
          ? {
              _id: program.sessions[index + 1]._id,
              title: program.sessions[index + 1].title,
            }
          : null,
    }
  },
})

/** One speaker's public itinerary: their sessions, grouped by day. */
export const speakerItinerary = query({
  args: { slug: v.string(), personId: v.string() },
  handler: async (ctx, args) => {
    const program = await loadProgram(ctx, args.slug)
    if (!program) return null
    const id = ctx.db.normalizeId("people", args.personId)
    const speaker = id
      ? (program.speakers.find((s) => s._id === id) ?? null)
      : null
    if (!speaker || !id) {
      return {
        event: program.event,
        publicMessage: program.publicMessage,
        published: program.published,
        speaker: null,
        days: [],
        unscheduled: [],
        totalResults: 0,
      }
    }

    const ids = new Set(
      program.published ? (program.sessionsByPerson.get(id) ?? []) : [],
    )
    const mine = program.sessions.filter((s) => ids.has(s._id))
    return {
      event: program.event,
      publicMessage: program.publicMessage,
      published: program.published,
      speaker,
      days: groupByDay(mine, program.event.timezone),
      unscheduled: mine.filter((s) => s.startsAt === undefined),
      totalResults: mine.length,
    }
  },
})

// ——— Internal queries backing convex/http.ts ————————————————————————————
// These are internal on purpose: the HTTP layer does the Bearer-token check
// and shapes the JSON, so these must never be callable from a browser client.

function paginate<T>(items: Array<T>, page: number, pageSize: number) {
  const totalResults = items.length
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages)
  const start = (currentPage - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    pagination: { currentPage, pageSize, totalPages, totalResults },
  }
}

/** All submissions, paginated — GET /v1/event/{slug}/submissions (auth'd). */
export const apiSubmissionsPage = internalQuery({
  args: { slug: v.string(), page: v.number(), pageSize: v.number() },
  handler: async (ctx, args) => {
    const event = await eventBySlug(ctx, args.slug)
    if (!event) return null
    const submissions = (
      await ctx.db
        .query("submissions")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(MAX_ROWS)
    ).filter((submission) => submission.deletedAt === undefined)

    const items = []
    for (const submission of submissions) {
      const track = submission.trackId
        ? await ctx.db.get(submission.trackId)
        : null
      const participants = await ctx.db
        .query("submissionParticipants")
        .withIndex("by_submissionId", (q) =>
          q.eq("submissionId", submission._id)
        )
        .take(64)
      participants.sort((a, b) => a.order - b.order)
      const submissionSpeakers = []
      for (const participant of participants) {
        const person = await ctx.db.get(participant.personId)
        if (!person) continue
        submissionSpeakers.push({
          id: person._id,
          name: personName(person),
          email: person.email,
          role: participant.role,
          jobTitle: person.jobTitle ?? null,
          company: person.company ?? null,
        })
      }
      items.push({
        id: submission._id,
        title: submission.title,
        description: submission.description ?? null,
        kind: submission.kind,
        status: submission.status,
        track: track?.name ?? null,
        format: submission.format ?? null,
        level: submission.level ?? null,
        language: submission.language ?? null,
        tags: submission.tags,
        submittedAt: submission._creationTime,
        decidedAt: submission.decidedAt ?? null,
        speakers: submissionSpeakers,
      })
    }
    items.sort((a, b) => b.submittedAt - a.submittedAt)
    return {
      event: apiEventShape(event),
      ...paginate(items, args.page, args.pageSize),
    }
  },
})

/** Everything the .ics feed needs — GET /v1/event/{slug}/schedule.ics. */
export const icsFeed = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const program = await loadProgram(ctx, args.slug)
    if (!program) return null
    const events = program.sessions
      .filter((s) => s.startsAt !== undefined && s.endsAt !== undefined)
      .map((s) => ({
        id: s._id,
        title: s.title,
        description: s.description ?? "",
        startsAt: s.startsAt as number,
        endsAt: s.endsAt as number,
        location: s.room?.name ?? program.event.venue ?? "",
        track: s.track?.name ?? "",
        speakers: s.speakers.map((sp) => sp.name),
      }))
    return {
      event: {
        name: program.event.name,
        slug: program.event.slug,
        timezone: program.event.timezone,
      },
      events,
    }
  },
})

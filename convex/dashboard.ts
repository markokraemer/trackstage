import { v } from "convex/values"
import { query } from "./_generated/server"
import type { QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { requireEventAccess } from "./lib/auth"

// ————————————————————————————————————————————————————————————————————————
// Dashboard + Speakers roster (SPEC §4.8).
// The job these answer: "who do I need to chase?" — in one glance, live.
// Both are organizer-only; the roster intentionally includes portalToken so an
// organizer can copy a speaker's magic link.
// ————————————————————————————————————————————————————————————————————————

const MAX_ROWS = 4000
const PACING_DAYS = 21
const TOP_SPEAKERS = 8

const SUBMISSION_STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
] as const

function personName(person: Doc<"people">): string {
  return `${person.firstName} ${person.lastName}`.trim() || person.email
}

/** yyyy-mm-dd for an instant, rendered in the event's timezone. */
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

async function submissionsForEvent(ctx: QueryCtx, eventId: Id<"events">) {
  // Soft-deleted rows never count towards anything an organizer is shown.
  return (
    await ctx.db
      .query("submissions")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .take(MAX_ROWS)
  ).filter((s) => s.deletedAt === undefined)
}

/** A programme item a person is attached to, as the roster renders it. */
interface RosterSession {
  _id: Id<"submissions">
  title: string
  startsAt?: number
  role: string
  /** The submission's pipeline status — what makes this person "confirmed". */
  status: string
  /** abstract (came through a form) | session (added by hand). */
  kind: string
}

/** Statuses that mean "still a live question" — a decision hasn't landed. */
const IN_REVIEW_STATUSES = new Set(["pending", "accept_queue", "decline_queue"])

/**
 * THE roster definition (one source of truth for "who is attached to this
 * event"): every person who is a participant on any submission or session,
 * whatever its status.
 *
 * Drafts are the single exclusion — a form the submitter never finished is not
 * a commitment to anybody, and the people typed into it shouldn't show up as
 * speakers. Soft-deleted submissions are excluded by `submissionsForEvent`.
 *
 * Deliberately NOT keyed on acceptance: an organizer who books a keynote by
 * hand, or who is still deciding on a panel, must see those people the moment
 * they exist. Acceptance is a facet on the row (`programStatus`), never a gate.
 *
 * Submitters are deliberately not included on their own: manual sessions are
 * "submitted" by the organizer's own person record (submissions.addManual), and
 * the organizer is not a speaker. Being a participant is what puts you here.
 */
async function programParticipation(ctx: QueryCtx, eventId: Id<"events">) {
  const submissions = await submissionsForEvent(ctx, eventId)
  const byId = new Map(submissions.map((s) => [s._id as string, s]))

  // One indexed scan for the whole event rather than one per submission.
  const participants = await ctx.db
    .query("submissionParticipants")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)

  const sessionsByPerson = new Map<string, Array<RosterSession>>()
  for (const participant of participants) {
    const submission = byId.get(participant.submissionId)
    if (!submission) continue
    if (submission.status === "draft") continue
    const list = sessionsByPerson.get(participant.personId) ?? []
    list.push({
      _id: submission._id,
      title: submission.title,
      startsAt: submission.startsAt,
      role: participant.role,
      status: submission.status,
      kind: submission.kind,
    })
    sessionsByPerson.set(participant.personId, list)
  }
  return sessionsByPerson
}

/** Where a session sorts inside one person's list: yes, then maybe, then no. */
function sessionRank(status: string): number {
  if (status === "accepted") return 0
  if (IN_REVIEW_STATUSES.has(status)) return 1
  return 2
}

/**
 * Person ids participating in an ACCEPTED submission, with their sessions.
 *
 * Deliberately narrower than `programParticipation`: the dashboard's chase
 * list and its "N accepted speakers" metrics are about people who are
 * definitely speaking — chasing a bio from someone you may still decline is
 * noise. The roster uses `programParticipation`; only the chase surfaces below
 * use this one, and they say so at the call site.
 */
async function acceptedParticipation(ctx: QueryCtx, eventId: Id<"events">) {
  const accepted = (
    await ctx.db
      .query("submissions")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", eventId).eq("status", "accepted")
      )
      .take(MAX_ROWS)
  ).filter((s) => s.deletedAt === undefined)

  const sessionsByPerson = new Map<
    string,
    Array<{
      _id: Id<"submissions">
      title: string
      startsAt?: number
      role: string
    }>
  >()
  for (const submission of accepted) {
    const participants = await ctx.db
      .query("submissionParticipants")
      .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
      .take(64)
    for (const participant of participants) {
      const list = sessionsByPerson.get(participant.personId) ?? []
      list.push({
        _id: submission._id,
        title: submission.title,
        startsAt: submission.startsAt,
        role: participant.role,
      })
      sessionsByPerson.set(participant.personId, list)
    }
  }
  return { accepted, sessionsByPerson }
}

function missingBits(person: Doc<"people">, hasUpload: boolean): Array<string> {
  const missing: Array<string> = []
  if (!person.bio || person.bio.trim().length === 0) missing.push("bio")
  if (!person.headshotId) missing.push("headshot")
  if (!hasUpload) missing.push("slides")
  return missing
}

/**
 * One query for the whole dashboard: status counts, chase list, pacing chart
 * and the forms card. `now` is passed in by the client so the query result
 * stays cacheable and never depends on a wall clock read inside Convex.
 */
export const overview = query({
  args: {
    eventId: v.id("events"),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, event } = await requireEventAccess(ctx, args.eventId)
    const timezone = event.timezone

    const submissions = await submissionsForEvent(ctx, args.eventId)

    // ——— Counts by status ———
    const statusCounts: Record<string, number> = {}
    for (const status of SUBMISSION_STATUSES) statusCounts[status] = 0
    for (const submission of submissions) {
      statusCounts[submission.status] =
        (statusCounts[submission.status] ?? 0) + 1
    }
    const totalSubmissions = submissions.length

    // ——— Accepted speakers + their outstanding work ———
    // Scoped to ACCEPTED on purpose: everything built from `sessionsByPerson`
    // below (the chase list, "speakers missing a bio", the accepted-speaker
    // count) is about chasing people who are definitely on the programme. The
    // Speakers roster is the wider view — see `speakersRoster`.
    const { sessionsByPerson } = await acceptedParticipation(ctx, args.eventId)

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS)
    const openTasksByPerson = new Map<string, Array<Doc<"tasks">>>()
    let outstandingTaskCount = 0
    for (const task of tasks) {
      if (task.completedAt !== undefined) continue
      outstandingTaskCount += 1
      const list = openTasksByPerson.get(task.personId) ?? []
      list.push(task)
      openTasksByPerson.set(task.personId, list)
    }

    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS)
    const peopleWithUploads = new Set<string>(uploads.map((u) => u.personId))

    let missingBio = 0
    let missingHeadshot = 0
    const chaseList: Array<{
      personId: Id<"people">
      name: string
      company?: string
      openTaskCount: number
      missing: Array<string>
      sessionCount: number
    }> = []

    for (const personId of sessionsByPerson.keys()) {
      const person = await ctx.db.get(personId as Id<"people">)
      if (!person) continue
      const missing = missingBits(person, peopleWithUploads.has(person._id))
      if (missing.includes("bio")) missingBio += 1
      if (missing.includes("headshot")) missingHeadshot += 1
      const openTaskCount = (openTasksByPerson.get(person._id) ?? []).length
      if (openTaskCount > 0 || missing.length > 0) {
        chaseList.push({
          personId: person._id,
          name: personName(person),
          company: person.company,
          openTaskCount,
          missing,
          sessionCount: (sessionsByPerson.get(person._id) ?? []).length,
        })
      }
    }
    chaseList.sort(
      (a, b) =>
        b.openTaskCount - a.openTaskCount ||
        b.missing.length - a.missing.length ||
        a.name.localeCompare(b.name)
    )

    // ——— Submission pacing, last 21 days in the event's timezone ———
    const now = args.now ?? Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const counts = new Map<string, number>()
    for (const submission of submissions) {
      const key = dayKey(submission._creationTime, timezone)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const pacing: Array<{ date: string; count: number }> = []
    for (let i = PACING_DAYS - 1; i >= 0; i--) {
      const key = dayKey(now - i * dayMs, timezone)
      pacing.push({ date: key, count: counts.get(key) ?? 0 })
    }

    // ——— Forms card ———
    const formRows = await ctx.db
      .query("forms")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS)
    const forms = []
    for (const form of formRows) {
      const formSubmissions = (
        await ctx.db
          .query("submissions")
          .withIndex("by_formId", (q) => q.eq("formId", form._id))
          .take(MAX_ROWS)
      ).filter((s) => s.deletedAt === undefined)
      forms.push({
        formId: form._id,
        name: form.internalName,
        externalTitle: form.externalTitle,
        slug: form.slug,
        kind: form.kind,
        status: form.status,
        closeAt: form.closeAt,
        submissionCount: formSubmissions.length,
      })
    }
    forms.sort((a, b) => a.name.localeCompare(b.name))

    const acceptedSpeakerCount = sessionsByPerson.size

    // Accepted sessions still waiting for a room and a time — the agenda's
    // to-do number, surfaced on the dashboard so nobody publishes half a
    // programme (same definition as agenda's "Not scheduled" tray).
    const unscheduledAccepted = submissions.filter(
      (s) =>
        s.status === "accepted" &&
        (s.startsAt === undefined || s.roomId === undefined)
    ).length

    return {
      // Greeting data for the dashboard header.
      viewer: { name: user.name ?? user.email, email: user.email },
      event: {
        _id: event._id,
        name: event.name,
        slug: event.slug,
        timezone,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      },
      totalSubmissions,
      statusCounts,
      acceptedSpeakerCount,
      outstandingTaskCount,
      unscheduledAccepted,
      speakersMissing: { bio: missingBio, headshot: missingHeadshot },
      topSpeakersByOutstandingTasks: chaseList.slice(0, TOP_SPEAKERS),
      pacing,
      forms,
    }
  },
})

/**
 * THE speaker roster (SPEC §4.8) — one source of truth for the people attached
 * to an event.
 *
 * Everyone who is a participant on any submission or session (drafts aside)
 * plus anyone the organizer added by hand, with task progress, missing profile
 * bits and their portal link. Acceptance is reported per row as
 * `programStatus` / `programCounts` — a facet the UI filters on, never a gate
 * on who exists. Book a keynote at 9am and the speaker is here at 9am, whether
 * the session is accepted, queued or still pending.
 */
export const speakersRoster = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const sessionsByPerson = await programParticipation(ctx, args.eventId)

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS)
    const tasksByPerson = new Map<string, Array<Doc<"tasks">>>()
    for (const task of tasks) {
      const list = tasksByPerson.get(task.personId) ?? []
      list.push(task)
      tasksByPerson.set(task.personId, list)
    }

    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS)
    const uploadsByPerson = new Map<string, number>()
    for (const upload of uploads) {
      uploadsByPerson.set(
        upload.personId,
        (uploadsByPerson.get(upload.personId) ?? 0) + 1
      )
    }

    // …plus anyone the organizer manages by hand with no programme item at all
    // yet: `speakersAdmin.addManual` and the CSV import stamp `workflowStatus`,
    // which is what makes a speaker who isn't on anything visible (sbek
    // SPK-02/SPK-03). People with no participation and no workflow status are
    // NOT speakers — that set is the organizer's own person record (created as
    // the submitter of a manual session) and half-finished form accounts.
    const managed = (
      await ctx.db
        .query("people")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .take(MAX_ROWS)
    ).filter((person) => person.workflowStatus !== undefined)
    for (const person of managed) {
      if (!sessionsByPerson.has(person._id)) sessionsByPerson.set(person._id, [])
    }

    const rows = []
    for (const [personId, sessions] of sessionsByPerson) {
      const person = await ctx.db.get(personId as Id<"people">)
      if (!person) continue
      const personTasks = tasksByPerson.get(person._id) ?? []
      const openTasks = personTasks.filter((t) => t.completedAt === undefined)
      const uploadCount = uploadsByPerson.get(person._id) ?? 0
      const headshotUrl = person.headshotId
        ? await ctx.storage.getUrl(person.headshotId)
        : null
      // Yes first, then maybe, then no — the first title in the list is the
      // one the roster shows, so it has to be the one that matters.
      sessions.sort(
        (a, b) =>
          sessionRank(a.status) - sessionRank(b.status) ||
          (a.startsAt ?? Infinity) - (b.startsAt ?? Infinity) ||
          a.title.localeCompare(b.title)
      )

      // Why this person is on the roster, as counts the UI can phrase.
      const programCounts = {
        accepted: 0,
        inReview: 0,
        declined: 0,
        withdrawn: 0,
      }
      for (const session of sessions) {
        if (session.status === "accepted") programCounts.accepted += 1
        else if (IN_REVIEW_STATUSES.has(session.status)) {
          programCounts.inReview += 1
        } else if (session.status === "declined") programCounts.declined += 1
        else if (session.status === "withdrawn") programCounts.withdrawn += 1
      }
      /**
       * confirmed  — at least one accepted session (they are speaking)
       * in_review  — nothing accepted yet, something still being decided
       * closed     — everything they were on was declined or withdrawn
       * manual     — added by hand, not on anything yet
       */
      const programStatus =
        programCounts.accepted > 0
          ? "confirmed"
          : programCounts.inReview > 0
            ? "in_review"
            : sessions.length > 0
              ? "closed"
              : "manual"

      rows.push({
        personId: person._id,
        name: personName(person),
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        company: person.company,
        jobTitle: person.jobTitle,
        bio: person.bio,
        // invited | confirmed | dropped — the organizer's own tracking, which
        // is a different question from "did their session get accepted". When
        // nobody has set it, it follows the programme so the two columns can
        // never contradict each other: an accepted session reads "Confirmed",
        // anything still open reads "Invited".
        workflowStatus:
          person.workflowStatus ??
          (programStatus === "confirmed" ? "confirmed" : "invited"),
        headshotNote: person.headshotNote,
        hasBio: Boolean(person.bio && person.bio.trim().length > 0),
        hasHeadshot: Boolean(person.headshotId),
        headshotUrl,
        // Organizer-only: lets an organizer copy the speaker's magic link.
        portalToken: person.portalToken,
        // Every non-draft submission or session they're on, accepted or not.
        sessions: sessions.map((s) => ({
          _id: s._id,
          title: s.title,
          startsAt: s.startsAt,
          role: s.role,
          status: s.status,
          kind: s.kind,
        })),
        programStatus,
        programCounts,
        tasks: {
          done: personTasks.length - openTasks.length,
          total: personTasks.length,
        },
        openTasks: openTasks.map((t) => ({
          _id: t._id,
          title: t.title,
          kind: t.kind,
          dueAt: t.dueAt,
        })),
        uploadCount,
        missing: missingBits(person, uploadCount > 0),
      })
    }
    rows.sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name)
    )
    return rows
  },
})

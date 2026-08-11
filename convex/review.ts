import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import {
  assignedSubmissionIds,
  criterionType,
  isRequiredCriterion,
} from "./lib/evaluation"

// ————————————————————————————————————————————————————————————————————————
// Evaluator review queue (SPEC §4.5) — the `/review/:token` magic link.
// Public functions, authenticated ONLY by the opaque evaluator token. There is
// deliberately no login wall: an evaluator clicks the emailed link and scores.
// Everything returned is scoped to the evaluator's own plan; nothing here
// exposes other evaluators, other events, or organizer data.
// ————————————————————————————————————————————————————————————————————————

const MAX_ROWS = 4000

async function requireEvaluator(ctx: QueryCtx | MutationCtx, token: string) {
  const trimmed = token.trim()
  if (!trimmed) throw new ConvexError("Invalid or expired review link.")
  const evaluator = await ctx.db
    .query("evaluators")
    .withIndex("by_token", (q) => q.eq("token", trimmed))
    .unique()
  if (!evaluator) throw new ConvexError("Invalid or expired review link.")
  const plan = await ctx.db.get(evaluator.planId)
  if (!plan) throw new ConvexError("This evaluation plan no longer exists.")
  return { evaluator, plan }
}

async function myEvaluations(
  ctx: QueryCtx | MutationCtx,
  evaluatorId: Id<"evaluators">
) {
  return await ctx.db
    .query("evaluations")
    .withIndex("by_evaluatorId", (q) => q.eq("evaluatorId", evaluatorId))
    .take(MAX_ROWS)
}

function personName(person: Doc<"people"> | null): string {
  if (!person) return "Unknown speaker"
  return `${person.firstName} ${person.lastName}`.trim() || person.email
}

/**
 * A round with an `opensAt` in the future is real but not yet startable
 * (sbek ABS-01). The link keeps working — the queue is simply held back, on
 * the server, so nobody can score early by poking at the network response.
 */
function roundNotYetOpen(
  plan: Doc<"evaluationPlans">,
  now: number = Date.now()
): boolean {
  return plan.opensAt !== undefined && now < plan.opensAt
}

/**
 * The evaluator's whole working set in one query: who they are, the plan and
 * its criteria, and every assigned submission with their own saved scores.
 * Incomplete submissions come first so "next" always lands on real work.
 */
export const queue = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { evaluator, plan } = await requireEvaluator(ctx, args.token)
    const event = await ctx.db.get(plan.eventId)
    // Blind round (sbek ABS-07): the identities are stripped HERE, on the
    // server, not hidden in the UI — an evaluator reading the network response
    // must not be able to recover who submitted.
    const anonymized = plan.blind === true
    const notYetOpen = roundNotYetOpen(plan)
    const mine = await myEvaluations(ctx, evaluator._id)
    const bySubmission = new Map<string, Doc<"evaluations">>()
    for (const evaluation of mine) {
      if (evaluation.planId !== plan._id) continue
      bySubmission.set(evaluation.submissionId, evaluation)
    }

    // Their own list when the organizer assigned one, the plan's pool
    // otherwise (sbek ABS-05/06).
    const assigned = assignedSubmissionIds(evaluator, plan)
    const queueIds: Array<Id<"submissions">> = notYetOpen ? [] : assigned

    const submissions = []
    for (const [index, submissionId] of queueIds.entries()) {
      const submission = await ctx.db.get(submissionId)
      if (!submission) continue
      const track = submission.trackId
        ? await ctx.db.get(submission.trackId)
        : null

      const speakers: Array<{
        name: string
        jobTitle?: string
        company?: string
        role: string
      }> = []
      if (!anonymized) {
        const participants = await ctx.db
          .query("submissionParticipants")
          .withIndex("by_submissionId", (q) =>
            q.eq("submissionId", submission._id)
          )
          .take(64)
        participants.sort((a, b) => a.order - b.order)
        for (const participant of participants) {
          const person = await ctx.db.get(participant.personId)
          // Names + affiliation only, never contact details.
          speakers.push({
            name: personName(person),
            jobTitle: person?.jobTitle,
            company: person?.company,
            role: participant.role,
          })
        }
      }

      const existing = bySubmission.get(submission._id) ?? null
      submissions.push({
        _id: submission._id,
        order: index,
        title: submission.title,
        description: submission.description,
        format: submission.format,
        level: submission.level,
        language: submission.language,
        tags: submission.tags,
        track: track ? { name: track.name, color: track.color } : null,
        speakers,
        scores: existing?.scores ?? null,
        /** Answers to select/text criteria (sbek ABS-03). */
        values: existing?.values ?? null,
        comment: existing?.comment ?? null,
        /** Set when this evaluator declared a conflict (sbek ABS-12). */
        recusedAt: existing?.recusedAt ?? null,
        recusalReason: existing?.recusalReason ?? null,
        completedAt: existing?.completedAt ?? null,
      })
    }

    // Incomplete first, then plan order — a stable "keep going" queue.
    submissions.sort((a, b) => {
      const aDone = a.completedAt !== null ? 1 : 0
      const bDone = b.completedAt !== null ? 1 : 0
      return aDone - bDone || a.order - b.order
    })

    const done = submissions.filter((s) => s.completedAt !== null).length
    return {
      evaluator: {
        _id: evaluator._id,
        email: evaluator.email,
        name: evaluator.name,
      },
      event: event
        ? { name: event.name, slug: event.slug, timezone: event.timezone }
        : null,
      plan: {
        _id: plan._id,
        name: plan.name,
        round: plan.round,
        criteria: plan.criteria,
        opensAt: plan.opensAt,
        dueAt: plan.dueAt,
        status: plan.status,
        blind: anonymized,
      },
      /** True when speaker identities were withheld from this payload. */
      anonymized,
      /** True when the round hasn't opened yet — the queue is held back. */
      notYetOpen,
      submissions,
      progress: { done, total: submissions.length },
    }
  },
})

/** Small standalone query so the progress bar can poll without the full queue. */
export const progress = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { evaluator, plan } = await requireEvaluator(ctx, args.token)
    const mine = await myEvaluations(ctx, evaluator._id)
    const assignedIds = assignedSubmissionIds(evaluator, plan)
    const assigned = new Set<string>(assignedIds)
    const done = mine.filter(
      (e) =>
        e.planId === plan._id &&
        e.completedAt !== undefined &&
        assigned.has(e.submissionId)
    ).length
    return { done, total: assignedIds.length }
  },
})

/**
 * Shared guard for every write an evaluator makes: the round must be open and
 * within its window, and the submission must be on THEIR list.
 */
async function requireScorable(
  ctx: MutationCtx,
  token: string,
  submissionId: Id<"submissions">
) {
  const { evaluator, plan } = await requireEvaluator(ctx, token)
  if (plan.status !== "open") {
    throw new ConvexError("This evaluation round is closed.")
  }
  if (roundNotYetOpen(plan)) {
    throw new ConvexError("This evaluation round hasn't opened yet.")
  }
  const assignedIds = assignedSubmissionIds(evaluator, plan)
  if (!assignedIds.includes(submissionId)) {
    throw new ConvexError("That submission is not assigned to you.")
  }
  const submission = await ctx.db.get(submissionId)
  if (!submission || submission.eventId !== plan.eventId) {
    throw new ConvexError("That submission no longer exists.")
  }
  return { evaluator, plan, assignedIds }
}

/** How far through their OWN list this evaluator is. */
async function progressFor(
  ctx: MutationCtx,
  evaluatorId: Id<"evaluators">,
  planId: Id<"evaluationPlans">,
  assignedIds: Array<Id<"submissions">>
) {
  const after = await myEvaluations(ctx, evaluatorId)
  const assigned = new Set<string>(assignedIds)
  const done = after.filter(
    (e) =>
      e.planId === planId &&
      e.completedAt !== undefined &&
      assigned.has(e.submissionId)
  ).length
  return { done, total: assignedIds.length }
}

/**
 * Upsert this evaluator's scorecard for one assigned submission.
 *
 * `scores` carries the 1–5 numeric criteria and is still validated as whole
 * numbers 1–5; `values` carries the select and text answers (sbek ABS-03),
 * kept in a separate field precisely so that guard never has to loosen. Every
 * numeric and select criterion must be answered; free text is optional.
 */
export const submitScores = mutation({
  args: {
    token: v.string(),
    submissionId: v.id("submissions"),
    scores: v.record(v.string(), v.number()),
    values: v.optional(v.record(v.string(), v.string())),
    comment: v.optional(v.string()),
  },
  returns: v.object({ done: v.number(), total: v.number() }),
  handler: async (ctx, args) => {
    const { evaluator, plan, assignedIds } = await requireScorable(
      ctx,
      args.token,
      args.submissionId
    )

    const byId = new Map(plan.criteria.map((c) => [c.id, c]))
    for (const [criterionId, value] of Object.entries(args.scores)) {
      const criterion = byId.get(criterionId)
      if (!criterion) {
        throw new ConvexError(`Unknown scoring criterion "${criterionId}".`)
      }
      if (criterionType(criterion) !== "numeric") {
        throw new ConvexError(`"${criterion.label}" isn't a 1–5 rating.`)
      }
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new ConvexError("Scores must be whole numbers between 1 and 5.")
      }
    }

    // Non-numeric answers, trimmed and checked against the criterion.
    const values: Record<string, string> = {}
    for (const [criterionId, raw] of Object.entries(args.values ?? {})) {
      const criterion = byId.get(criterionId)
      if (!criterion) {
        throw new ConvexError(`Unknown scoring criterion "${criterionId}".`)
      }
      const type = criterionType(criterion)
      if (type === "numeric") {
        throw new ConvexError(`"${criterion.label}" is a 1–5 rating.`)
      }
      const value = raw.trim()
      if (!value) continue
      if (type === "select" && !(criterion.options ?? []).includes(value)) {
        throw new ConvexError(`"${value}" isn't one of the choices for "${criterion.label}".`)
      }
      values[criterionId] = value.slice(0, 4000)
    }

    for (const criterion of plan.criteria) {
      if (!isRequiredCriterion(criterion)) continue
      const answered =
        criterionType(criterion) === "numeric"
          ? criterion.id in args.scores
          : criterion.id in values
      if (!answered) {
        throw new ConvexError(`Please answer "${criterion.label}" before saving.`)
      }
    }

    const comment = args.comment?.trim() || undefined
    const mine = await myEvaluations(ctx, evaluator._id)
    const existing = mine.find(
      (e) => e.planId === plan._id && e.submissionId === args.submissionId
    )
    const completedAt = Date.now()
    const row = {
      scores: args.scores,
      values: Object.keys(values).length > 0 ? values : undefined,
      comment,
      // Saving a real scorecard withdraws any previous recusal.
      recusedAt: undefined,
      recusalReason: undefined,
      completedAt,
    }
    if (existing) {
      await ctx.db.patch(existing._id, row)
    } else {
      await ctx.db.insert("evaluations", {
        planId: plan._id,
        eventId: plan.eventId,
        submissionId: args.submissionId,
        evaluatorId: evaluator._id,
        ...row,
      })
    }

    return await progressFor(ctx, evaluator._id, plan._id, assignedIds)
  },
})

/**
 * Declare a conflict of interest on one submission (sbek ABS-12).
 *
 * The evaluator knows the speaker, works with them, or is competing with them
 * — they should not score it and should not be nagged about it either. The row
 * is marked handled so their queue clears, any scores they had already entered
 * are dropped, and every average excludes it. Organizers see it as "Recused".
 */
export const declareConflict = mutation({
  args: {
    token: v.string(),
    submissionId: v.id("submissions"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ done: v.number(), total: v.number() }),
  handler: async (ctx, args) => {
    const { evaluator, plan, assignedIds } = await requireScorable(
      ctx,
      args.token,
      args.submissionId
    )

    const now = Date.now()
    const reason = args.reason?.trim().slice(0, 1000) || undefined
    const mine = await myEvaluations(ctx, evaluator._id)
    const existing = mine.find(
      (e) => e.planId === plan._id && e.submissionId === args.submissionId
    )
    const row = {
      // A recusal carries no opinion — drop anything already entered so it can
      // never reach an average by another route.
      scores: {},
      values: undefined,
      comment: undefined,
      recusedAt: now,
      recusalReason: reason,
      completedAt: now,
    }
    if (existing) {
      await ctx.db.patch(existing._id, row)
    } else {
      await ctx.db.insert("evaluations", {
        planId: plan._id,
        eventId: plan.eventId,
        submissionId: args.submissionId,
        evaluatorId: evaluator._id,
        ...row,
      })
    }

    return await progressFor(ctx, evaluator._id, plan._id, assignedIds)
  },
})

/** Undo: clear this evaluator's scores for a submission (back to incomplete). */
export const clearScores = mutation({
  args: { token: v.string(), submissionId: v.id("submissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { evaluator, plan } = await requireEvaluator(ctx, args.token)
    if (plan.status !== "open") {
      throw new ConvexError("This evaluation round is closed.")
    }
    const mine = await myEvaluations(ctx, evaluator._id)
    const existing = mine.find(
      (e) => e.planId === plan._id && e.submissionId === args.submissionId
    )
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

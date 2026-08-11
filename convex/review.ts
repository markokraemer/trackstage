import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

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
  if (!trimmed) throw new Error("Invalid or expired review link.")
  const evaluator = await ctx.db
    .query("evaluators")
    .withIndex("by_token", (q) => q.eq("token", trimmed))
    .unique()
  if (!evaluator) throw new Error("Invalid or expired review link.")
  const plan = await ctx.db.get(evaluator.planId)
  if (!plan) throw new Error("This evaluation plan no longer exists.")
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
    const mine = await myEvaluations(ctx, evaluator._id)
    const bySubmission = new Map<string, Doc<"evaluations">>()
    for (const evaluation of mine) {
      if (evaluation.planId !== plan._id) continue
      bySubmission.set(evaluation.submissionId, evaluation)
    }

    const submissions = []
    for (const [index, submissionId] of plan.submissionIds.entries()) {
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
        comment: existing?.comment ?? null,
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
        dueAt: plan.dueAt,
        status: plan.status,
        blind: anonymized,
      },
      /** True when speaker identities were withheld from this payload. */
      anonymized,
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
    const assigned = new Set<string>(plan.submissionIds)
    const done = mine.filter(
      (e) =>
        e.planId === plan._id &&
        e.completedAt !== undefined &&
        assigned.has(e.submissionId)
    ).length
    return { done, total: plan.submissionIds.length }
  },
})

/**
 * Upsert this evaluator's scores for one assigned submission. Validates that
 * the plan is open, the submission is actually assigned, and every score is an
 * integer 1–5 against a criterion that exists on the plan.
 */
export const submitScores = mutation({
  args: {
    token: v.string(),
    submissionId: v.id("submissions"),
    scores: v.record(v.string(), v.number()),
    comment: v.optional(v.string()),
  },
  returns: v.object({ done: v.number(), total: v.number() }),
  handler: async (ctx, args) => {
    const { evaluator, plan } = await requireEvaluator(ctx, args.token)
    if (plan.status !== "open") {
      throw new Error("This evaluation round is closed.")
    }
    if (!plan.submissionIds.includes(args.submissionId)) {
      throw new Error("That submission is not assigned to you.")
    }
    const submission = await ctx.db.get(args.submissionId)
    if (!submission || submission.eventId !== plan.eventId) {
      throw new Error("That submission no longer exists.")
    }

    const criterionIds = new Set(plan.criteria.map((c) => c.id))
    const scored = new Set(Object.keys(args.scores))
    for (const [criterionId, value] of Object.entries(args.scores)) {
      if (!criterionIds.has(criterionId)) {
        throw new Error(`Unknown scoring criterion "${criterionId}".`)
      }
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new Error("Scores must be whole numbers between 1 and 5.")
      }
    }
    for (const criterion of plan.criteria) {
      if (!scored.has(criterion.id)) {
        throw new Error(`Please score "${criterion.label}" before saving.`)
      }
    }

    const comment = args.comment?.trim() || undefined
    const mine = await myEvaluations(ctx, evaluator._id)
    const existing = mine.find(
      (e) => e.planId === plan._id && e.submissionId === args.submissionId
    )
    const completedAt = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        scores: args.scores,
        comment,
        completedAt,
      })
    } else {
      await ctx.db.insert("evaluations", {
        planId: plan._id,
        eventId: plan.eventId,
        submissionId: args.submissionId,
        evaluatorId: evaluator._id,
        scores: args.scores,
        comment,
        completedAt,
      })
    }

    const after = await myEvaluations(ctx, evaluator._id)
    const assigned = new Set<string>(plan.submissionIds)
    const done = after.filter(
      (e) =>
        e.planId === plan._id &&
        e.completedAt !== undefined &&
        assigned.has(e.submissionId)
    ).length
    return { done, total: plan.submissionIds.length }
  },
})

/** Undo: clear this evaluator's scores for a submission (back to incomplete). */
export const clearScores = mutation({
  args: { token: v.string(), submissionId: v.id("submissions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { evaluator, plan } = await requireEvaluator(ctx, args.token)
    if (plan.status !== "open") {
      throw new Error("This evaluation round is closed.")
    }
    const mine = await myEvaluations(ctx, evaluator._id)
    const existing = mine.find(
      (e) => e.planId === plan._id && e.submissionId === args.submissionId
    )
    if (existing) await ctx.db.delete(existing._id)
    return null
  },
})

import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { randomToken, requireEventAccess } from "./lib/auth"

// ————————————————————————————————————————————————————————————————————————
// Evaluation — organizer side (SPEC §4.5).
// Plans hold criteria (each scored 1–5) + the submissions under review +
// the evaluators. Evaluators score through a magic link (see convex/review.ts);
// there is no evaluator login. Everything here requires an organizer session.
// ————————————————————————————————————————————————————————————————————————

// Event-scoped tables in this demo stay well inside these bounds; the caps
// exist so no query is unbounded as data grows.
const MAX_ROWS = 4000

const criterionValidator = v.object({ id: v.string(), label: v.string() })

export type ScoreAggregate = { avg: number | null; count: number }

/** Mean of the criterion scores on a single evaluation. */
function evaluationScore(evaluation: Doc<"evaluations">): number | null {
  const values = Object.values(evaluation.scores).filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  )
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function aggregate(evaluations: Array<Doc<"evaluations">>): ScoreAggregate {
  const scores: Array<number> = []
  for (const evaluation of evaluations) {
    if (evaluation.completedAt === undefined) continue
    const score = evaluationScore(evaluation)
    if (score !== null) scores.push(score)
  }
  if (scores.length === 0) return { avg: null, count: 0 }
  return {
    avg: round2(scores.reduce((a, b) => a + b, 0) / scores.length),
    count: scores.length,
  }
}

async function plansForEvent(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("evaluationPlans")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_ROWS)
}

async function evaluationsForPlan(
  ctx: QueryCtx,
  planId: Id<"evaluationPlans">
) {
  return await ctx.db
    .query("evaluations")
    .withIndex("by_planId", (q) => q.eq("planId", planId))
    .take(MAX_ROWS)
}

async function evaluatorsForPlan(ctx: QueryCtx, planId: Id<"evaluationPlans">) {
  return await ctx.db
    .query("evaluators")
    .withIndex("by_planId", (q) => q.eq("planId", planId))
    .take(MAX_ROWS)
}

async function requirePlan(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"evaluationPlans">
) {
  const plan = await ctx.db.get(planId)
  if (!plan) throw new Error("That evaluation plan no longer exists.")
  return plan
}

function validateCriteria(criteria: Array<{ id: string; label: string }>) {
  if (criteria.length === 0) {
    throw new Error("Add at least one scoring criterion.")
  }
  const seen = new Set<string>()
  for (const criterion of criteria) {
    const id = criterion.id.trim()
    if (!id) throw new Error("Every criterion needs an id.")
    if (!criterion.label.trim()) {
      throw new Error("Every criterion needs a label.")
    }
    if (seen.has(id)) throw new Error(`Duplicate criterion id "${id}".`)
    seen.add(id)
  }
}

async function validateSubmissionIds(
  ctx: MutationCtx,
  eventId: Id<"events">,
  submissionIds: Array<Id<"submissions">>
): Promise<Array<Id<"submissions">>> {
  const unique = [...new Set(submissionIds)]
  for (const submissionId of unique) {
    const submission = await ctx.db.get(submissionId)
    if (!submission || submission.eventId !== eventId) {
      throw new Error("A selected submission does not belong to this event.")
    }
  }
  return unique
}

// ——— Queries ————————————————————————————————————————————————————————————

/** Plans list with per-plan evaluator / submission / completion counts. */
export const listPlans = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const plans = await plansForEvent(ctx, args.eventId)

    const rows = []
    for (const plan of plans) {
      const evaluators = await evaluatorsForPlan(ctx, plan._id)
      const evaluations = await evaluationsForPlan(ctx, plan._id)
      const submissionCount = plan.submissionIds.length
      const totalEvaluations = evaluators.length * submissionCount
      const completedEvaluations = evaluations.filter(
        (e) => e.completedAt !== undefined
      ).length
      const score = aggregate(evaluations)
      rows.push({
        _id: plan._id,
        _creationTime: plan._creationTime,
        name: plan.name,
        round: plan.round,
        status: plan.status,
        dueAt: plan.dueAt,
        criteria: plan.criteria,
        blind: plan.blind === true,
        submissionIds: plan.submissionIds,
        submissionCount,
        evaluatorCount: evaluators.length,
        completedEvaluations,
        totalEvaluations,
        completionPct:
          totalEvaluations === 0
            ? 0
            : Math.round((completedEvaluations / totalEvaluations) * 100),
        avgScore: score.avg,
        scoredCount: score.count,
      })
    }
    rows.sort((a, b) => a.round - b.round || a._creationTime - b._creationTime)
    return rows
  },
})

/** Everything the plan drawer needs: evaluators (with links) + submissions. */
export const planDetail = query({
  args: { planId: v.id("evaluationPlans") },
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId)

    const evaluatorRows = await evaluatorsForPlan(ctx, plan._id)
    const evaluations = await evaluationsForPlan(ctx, plan._id)
    const total = plan.submissionIds.length

    const evaluators = evaluatorRows.map((evaluator) => {
      const mine = evaluations.filter((e) => e.evaluatorId === evaluator._id)
      const done = mine.filter((e) => e.completedAt !== undefined).length
      return {
        _id: evaluator._id,
        email: evaluator.email,
        name: evaluator.name,
        // Organizer-only: used to render/copy the /review/:token magic link.
        token: evaluator.token,
        done,
        total,
        lastActivityAt: mine.reduce<number | null>(
          (latest, e) =>
            e.completedAt !== undefined &&
            (latest === null || e.completedAt > latest)
              ? e.completedAt
              : latest,
          null
        ),
      }
    })
    evaluators.sort((a, b) => a.email.localeCompare(b.email))

    const submissions = []
    for (const submissionId of plan.submissionIds) {
      const submission = await ctx.db.get(submissionId)
      if (!submission) continue
      const track = submission.trackId
        ? await ctx.db.get(submission.trackId)
        : null
      const forSubmission = evaluations.filter(
        (e) => e.submissionId === submissionId
      )
      const score = aggregate(forSubmission)
      submissions.push({
        _id: submission._id,
        title: submission.title,
        status: submission.status,
        format: submission.format,
        level: submission.level,
        track: track
          ? { _id: track._id, name: track.name, color: track.color }
          : null,
        avgScore: score.avg,
        scoreCount: score.count,
        completedCount: forSubmission.filter((e) => e.completedAt !== undefined)
          .length,
      })
    }

    const completed = evaluations.filter(
      (e) => e.completedAt !== undefined
    ).length
    return {
      plan: {
        _id: plan._id,
        eventId: plan.eventId,
        name: plan.name,
        round: plan.round,
        criteria: plan.criteria,
        dueAt: plan.dueAt,
        status: plan.status,
        blind: plan.blind === true,
        submissionIds: plan.submissionIds,
      },
      evaluators,
      submissions,
      progress: {
        completed,
        total: evaluatorRows.length * total,
      },
    }
  },
})

/** Metric-card + chart data for the Evaluation → Summary tab. */
export const summary = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const plans = await plansForEvent(ctx, args.eventId)

    let totalEvaluations = 0
    let expectedEvaluations = 0
    let evaluatorCount = 0
    const evaluatedSubmissions = new Set<string>()
    const avgScoreByPlan: Array<{
      planId: Id<"evaluationPlans">
      name: string
      round: number
      avg: number | null
      count: number
    }> = []

    for (const plan of plans) {
      const evaluators = await evaluatorsForPlan(ctx, plan._id)
      const evaluations = await evaluationsForPlan(ctx, plan._id)
      evaluatorCount += evaluators.length
      expectedEvaluations += evaluators.length * plan.submissionIds.length
      for (const evaluation of evaluations) {
        if (evaluation.completedAt === undefined) continue
        totalEvaluations += 1
        evaluatedSubmissions.add(evaluation.submissionId)
      }
      const score = aggregate(evaluations)
      avgScoreByPlan.push({
        planId: plan._id,
        name: plan.name,
        round: plan.round,
        avg: score.avg,
        count: score.count,
      })
    }
    avgScoreByPlan.sort(
      (a, b) => a.round - b.round || a.name.localeCompare(b.name)
    )

    const complete = totalEvaluations
    const incomplete = Math.max(expectedEvaluations - totalEvaluations, 0)
    return {
      totalEvaluations,
      evaluatedSubmissions: evaluatedSubmissions.size,
      planCount: plans.length,
      evaluatorCount,
      completion: {
        complete,
        incomplete,
        total: expectedEvaluations,
        pct:
          expectedEvaluations === 0
            ? 0
            : Math.round((complete / expectedEvaluations) * 100),
      },
      avgScoreByPlan,
    }
  },
})

/**
 * submissionId → {avg, count} across every plan in the event. Powers the
 * "Score" column (and score sorting) on the submissions table.
 */
export const scoresBySubmission = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const plans = await plansForEvent(ctx, args.eventId)

    const bySubmission = new Map<string, Array<Doc<"evaluations">>>()
    for (const plan of plans) {
      const evaluations = await evaluationsForPlan(ctx, plan._id)
      for (const evaluation of evaluations) {
        const list = bySubmission.get(evaluation.submissionId) ?? []
        list.push(evaluation)
        bySubmission.set(evaluation.submissionId, list)
      }
    }

    const result: Record<string, ScoreAggregate> = {}
    for (const [submissionId, evaluations] of bySubmission) {
      result[submissionId] = aggregate(evaluations)
    }
    return result
  },
})

// ——— Mutations ——————————————————————————————————————————————————————————

export const createPlan = mutation({
  args: {
    eventId: v.id("events"),
    name: v.string(),
    round: v.number(),
    criteria: v.array(criterionValidator),
    submissionIds: v.array(v.id("submissions")),
    evaluatorEmails: v.array(v.string()),
    dueAt: v.optional(v.number()),
    /** Blind round: evaluators never see who submitted (sbek ABS-07). */
    blind: v.optional(v.boolean()),
  },
  returns: v.id("evaluationPlans"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const name = args.name.trim()
    if (!name) throw new Error("Give the plan a name.")
    validateCriteria(args.criteria)
    const submissionIds = await validateSubmissionIds(
      ctx,
      args.eventId,
      args.submissionIds
    )

    const planId = await ctx.db.insert("evaluationPlans", {
      eventId: args.eventId,
      name,
      round: args.round,
      criteria: args.criteria.map((c) => ({
        id: c.id.trim(),
        label: c.label.trim(),
      })),
      submissionIds,
      dueAt: args.dueAt,
      status: "open",
      blind: args.blind === true ? true : undefined,
    })

    const seen = new Set<string>()
    for (const raw of args.evaluatorEmails) {
      const email = raw.toLowerCase().trim()
      if (!email || seen.has(email)) continue
      seen.add(email)
      await ctx.db.insert("evaluators", {
        planId,
        eventId: args.eventId,
        email,
        token: randomToken(),
      })
    }
    return planId
  },
})

export const updatePlan = mutation({
  args: {
    planId: v.id("evaluationPlans"),
    name: v.optional(v.string()),
    round: v.optional(v.number()),
    criteria: v.optional(v.array(criterionValidator)),
    submissionIds: v.optional(v.array(v.id("submissions"))),
    dueAt: v.optional(v.number()),
    clearDueAt: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"))),
    blind: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId)

    const patch: Partial<Doc<"evaluationPlans">> = {}
    if (args.name !== undefined) {
      const name = args.name.trim()
      if (!name) throw new Error("Give the plan a name.")
      patch.name = name
    }
    if (args.round !== undefined) patch.round = args.round
    if (args.criteria !== undefined) {
      validateCriteria(args.criteria)
      patch.criteria = args.criteria.map((c) => ({
        id: c.id.trim(),
        label: c.label.trim(),
      }))
    }
    if (args.submissionIds !== undefined) {
      patch.submissionIds = await validateSubmissionIds(
        ctx,
        plan.eventId,
        args.submissionIds
      )
    }
    if (args.clearDueAt) patch.dueAt = undefined
    else if (args.dueAt !== undefined) patch.dueAt = args.dueAt
    if (args.status !== undefined) patch.status = args.status
    // Store `undefined` rather than `false` so the flag reads the same whether
    // a plan predates blind review or had it turned off.
    if (args.blind !== undefined) patch.blind = args.blind ? true : undefined

    await ctx.db.patch(plan._id, patch)
    return null
  },
})

export const closePlan = mutation({
  args: {
    planId: v.id("evaluationPlans"),
    // Pass false to reopen a closed plan.
    closed: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId)
    await ctx.db.patch(plan._id, {
      status: args.closed === false ? "open" : "closed",
    })
    return null
  },
})

export const deletePlan = mutation({
  args: { planId: v.id("evaluationPlans") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId, "admin")
    for (const evaluation of await evaluationsForPlan(ctx, plan._id)) {
      await ctx.db.delete(evaluation._id)
    }
    for (const evaluator of await evaluatorsForPlan(ctx, plan._id)) {
      await ctx.db.delete(evaluator._id)
    }
    await ctx.db.delete(plan._id)
    return null
  },
})

export const addEvaluator = mutation({
  args: {
    planId: v.id("evaluationPlans"),
    email: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.object({ evaluatorId: v.id("evaluators"), token: v.string() }),
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId)
    const email = args.email.toLowerCase().trim()
    if (!email.includes("@")) throw new Error("Enter a valid email address.")

    const existing = (await evaluatorsForPlan(ctx, plan._id)).find(
      (e) => e.email === email
    )
    if (existing) {
      return { evaluatorId: existing._id, token: existing.token }
    }
    const token = randomToken()
    const evaluatorId = await ctx.db.insert("evaluators", {
      planId: plan._id,
      eventId: plan.eventId,
      email,
      name: args.name?.trim() || undefined,
      token,
    })
    return { evaluatorId, token }
  },
})

export const removeEvaluator = mutation({
  args: { evaluatorId: v.id("evaluators") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const evaluator = await ctx.db.get(args.evaluatorId)
    if (!evaluator) return null
    await requireEventAccess(ctx, evaluator.eventId, "admin")
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_evaluatorId", (q) => q.eq("evaluatorId", evaluator._id))
      .take(MAX_ROWS)
    for (const evaluation of evaluations) {
      await ctx.db.delete(evaluation._id)
    }
    await ctx.db.delete(evaluator._id)
    return null
  },
})

/** Mint a fresh magic link for an evaluator (invalidates the previous one). */
export const rotateEvaluatorToken = mutation({
  args: { evaluatorId: v.id("evaluators") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const evaluator = await ctx.db.get(args.evaluatorId)
    if (!evaluator) throw new Error("That evaluator no longer exists.")
    await requireEventAccess(ctx, evaluator.eventId)
    const token = randomToken()
    await ctx.db.patch(evaluator._id, { token })
    return token
  },
})

/** Every evaluator in the event — powers the Evaluation → Evaluators tab. */
export const listEvaluators = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const evaluators = await ctx.db
      .query("evaluators")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS)

    const rows = []
    for (const evaluator of evaluators) {
      const plan = await ctx.db.get(evaluator.planId)
      const evaluations = await ctx.db
        .query("evaluations")
        .withIndex("by_evaluatorId", (q) => q.eq("evaluatorId", evaluator._id))
        .take(MAX_ROWS)
      rows.push({
        _id: evaluator._id,
        email: evaluator.email,
        name: evaluator.name,
        token: evaluator.token,
        planId: evaluator.planId,
        planName: plan?.name ?? "Deleted plan",
        planStatus: plan?.status ?? "closed",
        done: evaluations.filter((e) => e.completedAt !== undefined).length,
        total: plan?.submissionIds.length ?? 0,
      })
    }
    rows.sort(
      (a, b) =>
        a.email.localeCompare(b.email) || a.planName.localeCompare(b.planName)
    )
    return rows
  },
})

/**
 * All evaluations for one submission — the Evaluations tab of the submission
 * drawer. Includes evaluator identity (organizer-only view).
 */
export const submissionEvaluations = query({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId)
    if (!submission) throw new Error("That submission no longer exists.")
    await requireEventAccess(ctx, submission.eventId)
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .take(MAX_ROWS)

    const rows = []
    for (const evaluation of evaluations) {
      const evaluator = await ctx.db.get(evaluation.evaluatorId)
      const plan = await ctx.db.get(evaluation.planId)
      rows.push({
        _id: evaluation._id,
        planId: evaluation.planId,
        planName: plan?.name ?? "Deleted plan",
        criteria: plan?.criteria ?? [],
        evaluatorEmail: evaluator?.email ?? "Removed evaluator",
        evaluatorName: evaluator?.name,
        scores: evaluation.scores,
        score: evaluationScore(evaluation),
        comment: evaluation.comment,
        completedAt: evaluation.completedAt,
      })
    }
    rows.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    return { evaluations: rows, ...aggregate(evaluations) }
  },
})

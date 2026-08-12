import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { randomToken, requireEventAccess } from "./lib/auth"
import {
  aggregateScorecards,
  assignedSubmissionIds,
  criterionType,
  criterionValidator,
  EMPTY_AGGREGATE,
  hasCustomAssignment,
  isNumericCriterion,
  scorecardValue,
} from "./lib/evaluation"
import type { PlanCriterion, ScoreAggregate } from "./lib/evaluation"

// ————————————————————————————————————————————————————————————————————————
// Evaluation — organizer side (SPEC §4.5).
// Plans hold criteria (each scored 1–5) + the submissions under review +
// the evaluators. Evaluators score through a magic link (see convex/review.ts);
// there is no evaluator login. Everything here requires an organizer session.
// ————————————————————————————————————————————————————————————————————————

// Event-scoped tables in this demo stay well inside these bounds; the caps
// exist so no query is unbounded as data grows.
const MAX_ROWS = 4000

export type { ScoreAggregate }

/**
 * Aggregate a set of scorecards against their plan's criteria. Weighted by
 * criterion weight (sbek ABS-04); select/text answers and recusals are
 * excluded — see convex/lib/evaluation.ts for the rules.
 */
function aggregate(
  evaluations: Array<Doc<"evaluations">>,
  criteria: Array<PlanCriterion> | undefined
): ScoreAggregate {
  return aggregateScorecards(evaluations, criteria)
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
  if (!plan) throw new ConvexError("That evaluation plan no longer exists.")
  return plan
}

/**
 * Normalise + validate the scorecard. Each criterion is numeric (1–5), a
 * single-select over its own options, or free text (sbek ABS-03), and numeric
 * criteria may carry a weight (sbek ABS-04). Everything is stored trimmed, and
 * fields that don't apply to a type are dropped rather than stored as noise.
 */
function validateCriteria(
  criteria: Array<PlanCriterion>
): Array<PlanCriterion> {
  if (criteria.length === 0) {
    throw new ConvexError("Add at least one scoring criterion.")
  }
  const seen = new Set<string>()
  const normalized: Array<PlanCriterion> = []
  for (const criterion of criteria) {
    const id = criterion.id.trim()
    const label = criterion.label.trim()
    if (!id) throw new ConvexError("Every criterion needs an id.")
    if (!label) throw new ConvexError("Every criterion needs a label.")
    if (seen.has(id)) throw new ConvexError(`Duplicate criterion id "${id}".`)
    seen.add(id)

    const type = criterionType(criterion)
    if (type === "select") {
      const options = (criterion.options ?? [])
        .map((option) => option.trim())
        .filter(Boolean)
      if (options.length < 2) {
        throw new ConvexError(
          `"${label}" is a choice — give it at least two options to pick from.`
        )
      }
      if (new Set(options).size !== options.length) {
        throw new ConvexError(`"${label}" has the same option listed twice.`)
      }
      normalized.push({ id, label, type, options })
      continue
    }
    if (type === "text") {
      normalized.push({ id, label, type })
      continue
    }

    const weight = criterion.weight
    if (
      weight !== undefined &&
      (!Number.isFinite(weight) || weight <= 0 || weight > 100)
    ) {
      throw new ConvexError(`"${label}" needs a weight between 1 and 100.`)
    }
    normalized.push({
      id,
      label,
      // Store "numeric" explicitly on new plans; old untyped plans keep
      // reading as numeric through criterionType().
      type: "numeric",
      // Weight 1 is the default — don't store the noise.
      weight: weight === undefined || weight === 1 ? undefined : weight,
    })
  }
  if (!normalized.some(isNumericCriterion)) {
    throw new ConvexError(
      "Add at least one 1–5 rating so submissions can be ranked by score."
    )
  }
  return normalized
}

/** Every evaluator on the plan, keyed for assignment maths. */
function assignmentsFor(
  evaluator: Doc<"evaluators">,
  plan: Doc<"evaluationPlans">
): Array<Id<"submissions">> {
  return assignedSubmissionIds(evaluator, plan)
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
      throw new ConvexError("A selected submission does not belong to this event.")
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
      // Expected work is the sum of what each evaluator was actually given —
      // with per-evaluator assignment a plan is no longer "everyone × every
      // submission" (sbek ABS-05).
      const totalEvaluations = evaluators.reduce(
        (total, evaluator) => total + assignmentsFor(evaluator, plan).length,
        0
      )
      const completedEvaluations = evaluations.filter(
        (e) => e.completedAt !== undefined
      ).length
      const score = aggregate(evaluations, plan.criteria)
      rows.push({
        _id: plan._id,
        _creationTime: plan._creationTime,
        name: plan.name,
        round: plan.round,
        status: plan.status,
        opensAt: plan.opensAt,
        dueAt: plan.dueAt,
        criteria: plan.criteria,
        blind: plan.blind === true,
        submissionIds: plan.submissionIds,
        submissionCount,
        evaluatorCount: evaluators.length,
        assignedCount: totalEvaluations,
        completedEvaluations,
        totalEvaluations,
        completionPct:
          totalEvaluations === 0
            ? 0
            : Math.round((completedEvaluations / totalEvaluations) * 100),
        avgScore: score.avg,
        avgScoreUnweighted: score.avgUnweighted,
        weighted: score.weighted,
        recusedCount: score.recusedCount,
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

    // submissionId → how many evaluators are on the hook for it.
    const assignedTally = new Map<string, number>()
    let expectedTotal = 0
    for (const evaluator of evaluatorRows) {
      for (const submissionId of assignmentsFor(evaluator, plan)) {
        assignedTally.set(submissionId, (assignedTally.get(submissionId) ?? 0) + 1)
        expectedTotal += 1
      }
    }

    const evaluators = evaluatorRows.map((evaluator) => {
      const assigned = assignmentsFor(evaluator, plan)
      const assignedSet = new Set<string>(assigned)
      const mine = evaluations.filter((e) => e.evaluatorId === evaluator._id)
      // Progress counts against THEIR list, not the plan pool (sbek ABS-06).
      const done = mine.filter(
        (e) => e.completedAt !== undefined && assignedSet.has(e.submissionId)
      ).length
      return {
        _id: evaluator._id,
        email: evaluator.email,
        name: evaluator.name,
        // Organizer-only: used to render/copy the /review/:token magic link.
        token: evaluator.token,
        done,
        total: assigned.length,
        outstanding: Math.max(assigned.length - done, 0),
        assignedSubmissionIds: assigned,
        /** True when the organizer hand-picked this list (vs. the whole pool). */
        customAssignment: hasCustomAssignment(evaluator),
        recusedCount: mine.filter((e) => e.recusedAt !== undefined).length,
        lastRemindedAt: evaluator.lastRemindedAt ?? null,
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
      const score = aggregate(forSubmission, plan.criteria)
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
        avgScoreUnweighted: score.avgUnweighted,
        scoreCount: score.count,
        recusedCount: score.recusedCount,
        assignedCount: assignedTally.get(submissionId) ?? 0,
        completedCount: forSubmission.filter((e) => e.completedAt !== undefined)
          .length,
      })
    }

    const completed = evaluations.filter(
      (e) => e.completedAt !== undefined
    ).length
    const planScore = aggregate(evaluations, plan.criteria)
    return {
      plan: {
        _id: plan._id,
        eventId: plan.eventId,
        name: plan.name,
        round: plan.round,
        criteria: plan.criteria,
        opensAt: plan.opensAt,
        dueAt: plan.dueAt,
        status: plan.status,
        blind: plan.blind === true,
        submissionIds: plan.submissionIds,
        /** True when any numeric criterion carries a weight other than 1. */
        weighted: planScore.weighted,
      },
      evaluators,
      submissions,
      progress: {
        completed,
        total: expectedTotal,
        outstanding: Math.max(expectedTotal - completed, 0),
        recused: planScore.recusedCount,
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
      avgUnweighted: number | null
      weighted: boolean
      count: number
    }> = []
    let recusedEvaluations = 0

    for (const plan of plans) {
      const evaluators = await evaluatorsForPlan(ctx, plan._id)
      const evaluations = await evaluationsForPlan(ctx, plan._id)
      evaluatorCount += evaluators.length
      for (const evaluator of evaluators) {
        expectedEvaluations += assignmentsFor(evaluator, plan).length
      }
      for (const evaluation of evaluations) {
        if (evaluation.completedAt === undefined) continue
        totalEvaluations += 1
        if (evaluation.recusedAt !== undefined) recusedEvaluations += 1
        evaluatedSubmissions.add(evaluation.submissionId)
      }
      const score = aggregate(evaluations, plan.criteria)
      avgScoreByPlan.push({
        planId: plan._id,
        name: plan.name,
        round: plan.round,
        avg: score.avg,
        avgUnweighted: score.avgUnweighted,
        weighted: score.weighted,
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
      recusedEvaluations,
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

    // Each evaluation is scored against ITS OWN plan's criteria (weights and
    // types differ per round), then the resulting 1–5 values are averaged
    // across plans.
    const bySubmission = new Map<
      string,
      { weighted: Array<number>; plain: Array<number>; recused: number }
    >()
    for (const plan of plans) {
      const evaluations = await evaluationsForPlan(ctx, plan._id)
      for (const evaluation of evaluations) {
        if (evaluation.completedAt === undefined) continue
        const bucket = bySubmission.get(evaluation.submissionId) ?? {
          weighted: [],
          plain: [],
          recused: 0,
        }
        if (evaluation.recusedAt !== undefined) {
          bucket.recused += 1
        } else {
          const value = scorecardValue(evaluation, plan.criteria)
          if (value !== null) {
            bucket.weighted.push(value.weighted)
            bucket.plain.push(value.plain)
          }
        }
        bySubmission.set(evaluation.submissionId, bucket)
      }
    }

    const result: Record<string, ScoreAggregate> = {}
    for (const [submissionId, bucket] of bySubmission) {
      if (bucket.weighted.length === 0) {
        result[submissionId] = { ...EMPTY_AGGREGATE, recusedCount: bucket.recused }
        continue
      }
      const mean = (values: Array<number>) =>
        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
      result[submissionId] = {
        avg: mean(bucket.weighted),
        avgUnweighted: mean(bucket.plain),
        count: bucket.weighted.length,
        recusedCount: bucket.recused,
        weighted: false,
      }
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
    /** Round window (sbek ABS-01) — reviewing opens at `opensAt`, due `dueAt`. */
    opensAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    /** Blind round: evaluators never see who submitted (sbek ABS-07). */
    blind: v.optional(v.boolean()),
  },
  returns: v.id("evaluationPlans"),
  handler: async (ctx, args) => {
    await requireEventAccess(ctx, args.eventId)
    const name = args.name.trim()
    if (!name) throw new ConvexError("Give the plan a name.")
    const criteria = validateCriteria(args.criteria)
    if (
      args.opensAt !== undefined &&
      args.dueAt !== undefined &&
      args.opensAt > args.dueAt
    ) {
      throw new ConvexError("The round can't close before it opens.")
    }
    const submissionIds = await validateSubmissionIds(
      ctx,
      args.eventId,
      args.submissionIds
    )

    const planId = await ctx.db.insert("evaluationPlans", {
      eventId: args.eventId,
      name,
      round: args.round,
      criteria,
      submissionIds,
      opensAt: args.opensAt,
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
    opensAt: v.optional(v.number()),
    clearOpensAt: v.optional(v.boolean()),
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
      if (!name) throw new ConvexError("Give the plan a name.")
      patch.name = name
    }
    if (args.round !== undefined) patch.round = args.round
    if (args.criteria !== undefined) {
      patch.criteria = validateCriteria(args.criteria)
    }
    if (args.submissionIds !== undefined) {
      patch.submissionIds = await validateSubmissionIds(
        ctx,
        plan.eventId,
        args.submissionIds
      )
    }
    if (args.clearOpensAt) patch.opensAt = undefined
    else if (args.opensAt !== undefined) patch.opensAt = args.opensAt
    if (args.clearDueAt) patch.dueAt = undefined
    else if (args.dueAt !== undefined) patch.dueAt = args.dueAt
    const opensAt = args.clearOpensAt
      ? undefined
      : (args.opensAt ?? plan.opensAt)
    const dueAt = args.clearDueAt ? undefined : (args.dueAt ?? plan.dueAt)
    if (opensAt !== undefined && dueAt !== undefined && opensAt > dueAt) {
      throw new ConvexError("The round can't close before it opens.")
    }
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
    if (!email.includes("@")) throw new ConvexError("Enter a valid email address.")

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
    if (!evaluator) throw new ConvexError("That evaluator no longer exists.")
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
      const assigned = plan ? assignmentsFor(evaluator, plan) : []
      const assignedSet = new Set<string>(assigned)
      rows.push({
        _id: evaluator._id,
        email: evaluator.email,
        name: evaluator.name,
        token: evaluator.token,
        planId: evaluator.planId,
        planName: plan?.name ?? "Deleted plan",
        planStatus: plan?.status ?? "closed",
        done: evaluations.filter(
          (e) => e.completedAt !== undefined && assignedSet.has(e.submissionId)
        ).length,
        total: assigned.length,
        customAssignment: hasCustomAssignment(evaluator),
        lastRemindedAt: evaluator.lastRemindedAt ?? null,
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
    if (!submission) throw new ConvexError("That submission no longer exists.")
    await requireEventAccess(ctx, submission.eventId)
    const evaluations = await ctx.db
      .query("evaluations")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .take(MAX_ROWS)

    const rows = []
    // Averaged per plan, then across plans — same rule as scoresBySubmission.
    const weightedValues: Array<number> = []
    const plainValues: Array<number> = []
    let recusedCount = 0
    for (const evaluation of evaluations) {
      const evaluator = await ctx.db.get(evaluation.evaluatorId)
      const plan = await ctx.db.get(evaluation.planId)
      const value = scorecardValue(evaluation, plan?.criteria)
      if (evaluation.completedAt !== undefined) {
        if (evaluation.recusedAt !== undefined) recusedCount += 1
        else if (value !== null) {
          weightedValues.push(value.weighted)
          plainValues.push(value.plain)
        }
      }
      rows.push({
        _id: evaluation._id,
        planId: evaluation.planId,
        planName: plan?.name ?? "Deleted plan",
        criteria: plan?.criteria ?? [],
        evaluatorEmail: evaluator?.email ?? "Removed evaluator",
        evaluatorName: evaluator?.name,
        scores: evaluation.scores,
        /** Answers to select/text criteria (sbek ABS-03). */
        values: evaluation.values ?? {},
        score: value?.weighted ?? null,
        comment: evaluation.comment,
        /** Conflict of interest (sbek ABS-12) — excluded from the average. */
        recusedAt: evaluation.recusedAt ?? null,
        recusalReason: evaluation.recusalReason,
        completedAt: evaluation.completedAt,
      })
    }
    rows.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

    const mean = (values: Array<number>) =>
      Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
    const summaryScore: ScoreAggregate =
      weightedValues.length === 0
        ? { ...EMPTY_AGGREGATE, recusedCount }
        : {
            avg: mean(weightedValues),
            avgUnweighted: mean(plainValues),
            count: weightedValues.length,
            recusedCount,
            weighted: false,
          }
    return { evaluations: rows, ...summaryScore }
  },
})

// ——— Assignment (sbek ABS-05/06) ————————————————————————————————————————

/**
 * Split the plan's pool evenly between its evaluators, round-robin.
 *
 * Each submission lands with exactly one evaluator, so a 40-abstract pool and
 * four reviewers becomes four queues of ten rather than four queues of forty.
 * `perReviewerCap` stops anyone being handed more than they agreed to; any
 * submissions left over stay unassigned and are reported back so the organizer
 * knows to add reviewers or raise the cap.
 */
export const autoDistribute = mutation({
  args: {
    planId: v.id("evaluationPlans"),
    /** Most submissions any one evaluator may be given. */
    perReviewerCap: v.optional(v.number()),
  },
  returns: v.object({
    assigned: v.number(),
    unassigned: v.number(),
    evaluatorCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId)

    const cap = args.perReviewerCap
    if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) {
      throw new ConvexError("The per-reviewer cap has to be a whole number, 1 or more.")
    }

    const evaluators = await evaluatorsForPlan(ctx, plan._id)
    if (evaluators.length === 0) {
      throw new ConvexError("Add at least one evaluator before distributing.")
    }
    // Stable order so re-running the same distribution gives the same result.
    evaluators.sort((a, b) => a.email.localeCompare(b.email))

    const buckets = new Map<string, Array<Id<"submissions">>>(
      evaluators.map((evaluator) => [evaluator._id, []])
    )
    let cursor = 0
    let assigned = 0
    for (const submissionId of plan.submissionIds) {
      let placed = false
      for (let step = 0; step < evaluators.length; step++) {
        const evaluator = evaluators[(cursor + step) % evaluators.length]
        const bucket = buckets.get(evaluator._id)
        if (bucket === undefined) continue
        if (cap !== undefined && bucket.length >= cap) continue
        bucket.push(submissionId)
        cursor = (cursor + step + 1) % evaluators.length
        placed = true
        assigned += 1
        break
      }
      // Everyone is at their cap — the rest of the pool stays unassigned.
      if (!placed) break
    }

    for (const evaluator of evaluators) {
      await ctx.db.patch(evaluator._id, {
        assignedSubmissionIds: buckets.get(evaluator._id) ?? [],
      })
    }
    return {
      assigned,
      unassigned: plan.submissionIds.length - assigned,
      evaluatorCount: evaluators.length,
    }
  },
})

/**
 * Hand-pick what one evaluator reviews. `clear: true` puts them back on the
 * plan's whole pool (the pre-assignment default).
 */
export const setAssignments = mutation({
  args: {
    evaluatorId: v.id("evaluators"),
    submissionIds: v.optional(v.array(v.id("submissions"))),
    clear: v.optional(v.boolean()),
  },
  returns: v.object({ assigned: v.number() }),
  handler: async (ctx, args) => {
    const evaluator = await ctx.db.get(args.evaluatorId)
    if (!evaluator) throw new ConvexError("That evaluator no longer exists.")
    await requireEventAccess(ctx, evaluator.eventId)
    const plan = await requirePlan(ctx, evaluator.planId)

    if (args.clear) {
      await ctx.db.patch(evaluator._id, { assignedSubmissionIds: undefined })
      return { assigned: plan.submissionIds.length }
    }

    const pool = new Set<string>(plan.submissionIds)
    const unique = [...new Set(args.submissionIds ?? [])]
    for (const submissionId of unique) {
      if (!pool.has(submissionId)) {
        throw new ConvexError(
          "That submission isn't in this plan — add it to the plan first."
        )
      }
    }
    await ctx.db.patch(evaluator._id, { assignedSubmissionIds: unique })
    return { assigned: unique.length }
  },
})

/**
 * Nudge every evaluator with outstanding reviews (sbek ABS-09).
 *
 * One templated email each, carrying their own review link and their own
 * outstanding count — never a bulk blast that tells someone who is finished
 * they still owe work. Demo (@example.com) reviewers render as previews, the
 * same rule the speaker outbox applies.
 */
export const remindOutstandingEvaluators = mutation({
  args: { planId: v.id("evaluationPlans") },
  returns: v.object({
    reminded: v.number(),
    skipped: v.number(),
    recipients: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const plan = await requirePlan(ctx, args.planId)
    await requireEventAccess(ctx, plan.eventId)
    const event = await ctx.db.get(plan.eventId)
    if (!event?.organizationId) throw new ConvexError("Event not found.")
    const evaluators = await evaluatorsForPlan(ctx, plan._id)
    const evaluations = await evaluationsForPlan(ctx, plan._id)

    const now = Date.now()
    const recipients: Array<string> = []
    let skipped = 0
    for (const evaluator of evaluators) {
      const assigned = new Set<string>(assignmentsFor(evaluator, plan))
      const done = evaluations.filter(
        (e) =>
          e.evaluatorId === evaluator._id &&
          e.completedAt !== undefined &&
          assigned.has(e.submissionId)
      ).length
      const outstanding = assigned.size - done
      if (outstanding <= 0) {
        skipped += 1
        continue
      }
      await ctx.scheduler.runAfter(
        0,
        internal.platformEmails.sendEvaluatorReminder,
        {
          organizationId: event.organizationId,
          eventId: plan.eventId,
          toEmail: evaluator.email,
          evaluatorName: evaluator.name,
          eventName: event.name,
          planName: plan.name,
          outstanding,
          reviewToken: evaluator.token,
          dueAt: plan.dueAt,
        }
      )
      await ctx.db.patch(evaluator._id, { lastRemindedAt: now })
      recipients.push(evaluator.email)
    }
    return { reminded: recipients.length, skipped, recipients }
  },
})

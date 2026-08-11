import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"

// ————————————————————————————————————————————————————————————————————————
// Shared evaluation rules — the handful of decisions that the organizer side
// (convex/evaluationsAdmin.ts) and the evaluator side (convex/review.ts) must
// answer identically, kept in one place so they cannot drift:
//
//   • what a criterion's TYPE is when the plan predates typed criteria,
//   • what a criterion's WEIGHT is when the plan predates weights,
//   • which submissions an evaluator is actually assigned,
//   • how one scorecard turns into a single number.
// ————————————————————————————————————————————————————————————————————————

/** Every way an evaluator can answer a criterion (sbek ABS-03). */
export const CRITERION_TYPES = ["numeric", "select", "text"] as const
export type CriterionType = (typeof CRITERION_TYPES)[number]

export const criterionValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.optional(
    v.union(v.literal("numeric"), v.literal("select"), v.literal("text")),
  ),
  options: v.optional(v.array(v.string())),
  weight: v.optional(v.number()),
})

export type PlanCriterion = {
  id: string
  label: string
  type?: CriterionType
  options?: Array<string>
  weight?: number
}

/**
 * A criterion with no `type` is numeric — that is what every criterion was
 * before types existed, so old plans keep behaving exactly as they did.
 */
export function criterionType(criterion: PlanCriterion): CriterionType {
  return criterion.type ?? "numeric"
}

/** Weight of a numeric criterion in the weighted average. Absent/invalid ⇒ 1. */
export function criterionWeight(criterion: PlanCriterion): number {
  const weight = criterion.weight
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
    return 1
  }
  return weight
}

/** True when this criterion contributes to averages. */
export function isNumericCriterion(criterion: PlanCriterion): boolean {
  return criterionType(criterion) === "numeric"
}

/** True when the criterion must be answered before a scorecard can be saved. */
export function isRequiredCriterion(criterion: PlanCriterion): boolean {
  // Free text is the "anything else?" box — never a blocker.
  return criterionType(criterion) !== "text"
}

/**
 * The submissions this evaluator is responsible for (sbek ABS-05/06).
 *
 * An explicit per-evaluator assignment wins; an absent one falls back to the
 * plan's whole pool, which is how every plan behaved before assignment existed
 * — so nothing regresses for plans that never used it. Assignments are always
 * intersected with the live pool, so removing a submission from the plan also
 * removes it from everyone's queue.
 */
export function assignedSubmissionIds(
  evaluator: Pick<Doc<"evaluators">, "assignedSubmissionIds">,
  plan: Pick<Doc<"evaluationPlans">, "submissionIds">,
): Array<Id<"submissions">> {
  const assigned = evaluator.assignedSubmissionIds
  if (assigned === undefined) return plan.submissionIds
  const pool = new Set<string>(plan.submissionIds)
  return assigned.filter((id) => pool.has(id))
}

/** True when the organizer has hand-picked what this evaluator reviews. */
export function hasCustomAssignment(
  evaluator: Pick<Doc<"evaluators">, "assignedSubmissionIds">,
): boolean {
  return evaluator.assignedSubmissionIds !== undefined
}

export type ScorecardValue = {
  /** Weighted mean of the numeric criteria — the headline number. */
  weighted: number
  /** Plain, unweighted mean of the same criteria, for comparison. */
  plain: number
}

/**
 * Turn one evaluation into a single 1–5 number, or `null` when it contributes
 * nothing to an average: a recusal (sbek ABS-12), a scorecard with only
 * select/text answers, or one that was never completed.
 */
export function scorecardValue(
  evaluation: Pick<Doc<"evaluations">, "scores" | "recusedAt">,
  criteria: Array<PlanCriterion> | undefined,
): ScorecardValue | null {
  if (evaluation.recusedAt !== undefined) return null

  const numeric = (criteria ?? []).filter(isNumericCriterion)
  if (criteria === undefined || numeric.length === 0) {
    // The plan's criteria are unavailable (deleted plan) or carry no numeric
    // criterion — fall back to a plain mean of whatever numbers were stored.
    const values = Object.values(evaluation.scores).filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n),
    )
    if (values.length === 0) return null
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return { weighted: mean, plain: mean }
  }

  let weightedTotal = 0
  let weightTotal = 0
  let plainTotal = 0
  let count = 0
  for (const criterion of numeric) {
    const value = evaluation.scores[criterion.id]
    if (typeof value !== "number" || !Number.isFinite(value)) continue
    const weight = criterionWeight(criterion)
    weightedTotal += value * weight
    weightTotal += weight
    plainTotal += value
    count += 1
  }
  if (count === 0 || weightTotal === 0) return null
  return { weighted: weightedTotal / weightTotal, plain: plainTotal / count }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type ScoreAggregate = {
  /** Weighted average across completed, non-recused scorecards. */
  avg: number | null
  /** Same population, ignoring criterion weights. */
  avgUnweighted: number | null
  /** How many scorecards went into `avg`. */
  count: number
  /** Completed scorecards that were recusals (excluded from `avg`). */
  recusedCount: number
  /** True when at least one criterion carries a weight other than 1. */
  weighted: boolean
}

export const EMPTY_AGGREGATE: ScoreAggregate = {
  avg: null,
  avgUnweighted: null,
  count: 0,
  recusedCount: 0,
  weighted: false,
}

/**
 * Average a set of scorecards. Only completed, non-recused cards count, and
 * only their numeric criteria — a "Recommendation: Accept" or a paragraph of
 * prose must never quietly become a 3.
 */
export function aggregateScorecards(
  evaluations: Array<Pick<Doc<"evaluations">, "scores" | "recusedAt" | "completedAt">>,
  criteria: Array<PlanCriterion> | undefined,
): ScoreAggregate {
  const weightedValues: Array<number> = []
  const plainValues: Array<number> = []
  let recusedCount = 0
  for (const evaluation of evaluations) {
    if (evaluation.completedAt === undefined) continue
    if (evaluation.recusedAt !== undefined) {
      recusedCount += 1
      continue
    }
    const value = scorecardValue(evaluation, criteria)
    if (value === null) continue
    weightedValues.push(value.weighted)
    plainValues.push(value.plain)
  }
  const isWeighted = (criteria ?? [])
    .filter(isNumericCriterion)
    .some((criterion) => criterionWeight(criterion) !== 1)

  if (weightedValues.length === 0) {
    return { ...EMPTY_AGGREGATE, recusedCount, weighted: isWeighted }
  }
  return {
    avg: round2(
      weightedValues.reduce((a, b) => a + b, 0) / weightedValues.length,
    ),
    avgUnweighted: round2(
      plainValues.reduce((a, b) => a + b, 0) / plainValues.length,
    ),
    count: weightedValues.length,
    recusedCount,
    weighted: isWeighted,
  }
}

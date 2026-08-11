import { Link } from "@tanstack/react-router"
import { format, isBefore } from "date-fns"
import {
  RiArrowRightLine,
  RiCalendarEventLine,
  RiFileList3Line,
  RiGroupLine,
  RiStarLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StatusPill } from "@/components/shared/status-pill"
import { ProgressMeter } from "@/components/evaluation/progress-meter"

/** Row shape returned by `api.evaluationsAdmin.listPlans`. */
export interface PlanCardData {
  _id: string
  name: string
  round: number
  status: "open" | "closed" | string
  dueAt?: number
  submissionCount: number
  evaluatorCount: number
  completedEvaluations: number
  totalEvaluations: number
  avgScore: number | null
}

/**
 * Evaluation plan card (docs/video/actions.md §10: "Cards displaying active
 * grading plans showing evaluator count, assigned submissions, and status
 * badges (Open/Closed)"). Built on the shadcn `Card` + `Badge` primitives and
 * the shared `StatusPill`, so Open/Closed reads identically everywhere.
 */
export function PlanCard({ plan }: { plan: PlanCardData }) {
  const due = plan.dueAt === undefined ? undefined : new Date(plan.dueAt)
  const overdue =
    due !== undefined && plan.status === "open" && isBefore(due, new Date())

  return (
    <Card className="gap-0 p-5 transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/evaluation/$planId"
              params={{ planId: plan._id }}
              className="font-heading truncate text-base font-semibold text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {plan.name}
            </Link>
            <Badge variant="secondary" className="shrink-0">
              Round {plan.round}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.status === "open"
              ? "Evaluators can score right now."
              : "Scoring is closed — results are final."}
          </p>
        </div>
        <StatusPill status={plan.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <Stat icon={RiGroupLine} value={plan.evaluatorCount} noun="evaluator" />
        <Stat
          icon={RiFileList3Line}
          value={plan.submissionCount}
          noun="submission"
        />
        <Stat
          icon={RiStarLine}
          value={plan.avgScore === null ? "—" : plan.avgScore.toFixed(1)}
          noun="avg score"
          plain
        />
      </div>

      <ProgressMeter
        className="mt-4"
        label="Evaluations completed"
        done={plan.completedEvaluations}
        total={plan.totalEvaluations}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs",
            overdue ? "font-medium text-status-red-fg" : "text-muted-foreground",
          )}
        >
          <RiCalendarEventLine size={14} aria-hidden />
          {due
            ? `${overdue ? "Was due" : "Due"} ${format(due, "MMM d, yyyy")}`
            : "No due date"}
        </p>
        <Button nativeButton={false}
          variant="ghost"
          size="sm"
          render={
            <Link to="/app/evaluation/$planId" params={{ planId: plan._id }} />
          }
        >
          Open plan
          <RiArrowRightLine aria-hidden />
        </Button>
      </div>
    </Card>
  )
}

function Stat({
  icon: Icon,
  value,
  noun,
  plain = false,
}: {
  icon: RemixiconComponentType
  value: number | string
  noun: string
  plain?: boolean
}) {
  const label =
    plain || value === 1 || typeof value === "string" ? noun : `${noun}s`
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon size={15} aria-hidden className="text-muted-foreground" />
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
      {label}
    </p>
  )
}

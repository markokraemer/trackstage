import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { format, isBefore } from "date-fns"
import {
  RiArrowLeftLine,
  RiCheckDoubleLine,
  RiChatQuoteLine,
  RiListCheck2,
  RiMailSendLine,
  RiRestartLine,
  RiStarLine,
  RiUserForbidLine,
  RiUserStarLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { ProgressMeter } from "@/components/evaluation/progress-meter"
import { EvaluatorsTable } from "@/components/evaluation/evaluators-table"
import type { EvaluatorRow } from "@/components/evaluation/evaluators-table"
import { AddEvaluatorForm } from "@/components/evaluation/add-evaluator-form"
import { DistributeDialog } from "@/components/evaluation/distribute-dialog"
import { AssignSubmissionsDialog } from "@/components/evaluation/assign-submissions-dialog"
import { DeletePlanButton } from "@/components/evaluation/delete-plan-dialog"

/**
 * Evaluation plan detail (docs/SPEC.md §4.5): who is reviewing, how far they
 * have got, what they are reviewing, and the averages so far — plus the one
 * lever an organizer needs at the end of a round: Close plan.
 */
export const Route = createFileRoute("/app/evaluation/$planId")({
  component: PlanDetailPage,
})

function PlanDetailPage() {
  const { planId } = Route.useParams()
  const {
    data: detail,
    isPending,
    isError,
  } = useQuery({
    ...convexQuery(api.evaluationsAdmin.planDetail, {
      planId: planId as Id<"evaluationPlans">,
    }),
    retry: false,
  })

  const closePlan = useMutation({
    mutationFn: useConvexMutation(api.evaluationsAdmin.closePlan),
  })
  const remind = useMutation({
    mutationFn: useConvexMutation(
      api.evaluationsAdmin.remindOutstandingEvaluators,
    ),
  })
  const [assigning, setAssigning] = useState<EvaluatorRow | null>(null)

  const backButton = (
    <Link
      to="/app/evaluation"
      search={{ tab: "plans" }}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <RiArrowLeftLine aria-hidden />
      All plans
    </Link>
  )

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Evaluation plan" actions={backButton} />
        <EmptyState
          icon={RiStarLine}
          title="We couldn't find that plan"
          description="It may have been deleted. Head back to Evaluation to see the plans that are still running."
          action={
            <Link
              to="/app/evaluation"
              search={{ tab: "plans" }}
              className={buttonVariants({})}
            >
              Back to Evaluation
            </Link>
          }
        />
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const { plan, evaluators, submissions, progress } = detail
  const opens = plan.opensAt === undefined ? undefined : new Date(plan.opensAt)
  const notYetOpen = opens !== undefined && isBefore(new Date(), opens)
  const due = plan.dueAt === undefined ? undefined : new Date(plan.dueAt)
  const overdue =
    due !== undefined && plan.status === "open" && isBefore(due, new Date())
  const closed = plan.status === "closed"
  const outstandingReviewers = evaluators.filter(
    (evaluator) => evaluator.outstanding > 0,
  ).length

  const scored = submissions.filter((s) => s.avgScore !== null)
  const average = (values: Array<number>) =>
    values.length === 0
      ? null
      : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) /
        100
  const eventAverage = average(scored.map((s) => s.avgScore ?? 0))
  const eventAverageUnweighted = average(
    scored.map((s) => s.avgScoreUnweighted ?? 0),
  )

  function sendReminders() {
    remind.mutate(
      { planId: plan._id },
      {
        onSuccess: (result) => {
          if (result.reminded === 0) {
            toast.success("Everyone is up to date", {
              description: "No reviewer has outstanding submissions right now.",
            })
            return
          }
          toast.success(
            `Reminder sent to ${result.reminded} reviewer${result.reminded === 1 ? "" : "s"}`,
            {
              description: `${result.recipients.slice(0, 3).join(", ")}${
                result.recipients.length > 3
                  ? ` +${result.recipients.length - 3} more`
                  : ""
              }. Each one got their own link and their own outstanding count.`,
            },
          )
        },
        onError: (error: Error) =>
          toast.error("Couldn't send the reminders", {
            description: error.message,
          }),
      },
    )
  }

  function toggleClosed() {
    closePlan.mutate(
      { planId: plan._id, closed: !closed },
      {
        onSuccess: () =>
          toast.success(
            closed
              ? "Plan reopened — evaluators can score again."
              : "Plan closed — scoring is locked.",
          ),
        onError: (error: Error) =>
          toast.error("Couldn't update the plan", {
            description: error.message,
          }),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={plan.name}
        description={
          closed
            ? "This round is closed. Reopen it if evaluators still need to score."
            : "Evaluators can score right now. Copy each person's review link to invite them."
        }
        actions={
          <>
            {backButton}
            <DeletePlanButton planId={plan._id} name={plan.name} />
            <Button
              variant={closed ? "outline" : "default"}
              disabled={closePlan.isPending}
              onClick={toggleClosed}
            >
              {closed ? (
                <>
                  <RiRestartLine aria-hidden />
                  Reopen plan
                </>
              ) : (
                <>
                  <RiCheckDoubleLine aria-hidden />
                  Close plan
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={plan.status} />
          <Badge variant="secondary">Round {plan.round}</Badge>
          <Badge variant="secondary">
            {submissions.length}{" "}
            {submissions.length === 1 ? "submission" : "submissions"}
          </Badge>
          <Badge variant="secondary">
            {evaluators.length}{" "}
            {evaluators.length === 1 ? "evaluator" : "evaluators"}
          </Badge>
          {notYetOpen ? (
            <Badge variant="secondary">
              Opens {format(opens, "MMM d, yyyy")}
            </Badge>
          ) : null}
          {progress.recused > 0 ? (
            <Badge variant="secondary" className="gap-1">
              <RiUserForbidLine size={12} aria-hidden />
              {progress.recused} recused
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      {/* Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Round progress</CardTitle>
            <CardDescription>
              One scorecard per evaluator, per submission.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressMeter
              done={progress.completed}
              total={progress.total}
              unit="scorecards done"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Fact
                label={plan.weighted ? "Weighted average" : "Average score"}
                value={eventAverage === null ? "—" : eventAverage.toFixed(1)}
                hint={
                  eventAverage === null
                    ? "No scores yet"
                    : plan.weighted && eventAverageUnweighted !== null
                      ? `${eventAverageUnweighted.toFixed(1)} unweighted · ${scored.length} scored`
                      : `Across ${scored.length} scored ${scored.length === 1 ? "submission" : "submissions"}`
                }
              />
              <Fact
                label="Review window"
                value={
                  due
                    ? format(due, "MMM d, yyyy")
                    : opens
                      ? `From ${format(opens, "MMM d")}`
                      : "Not set"
                }
                hint={
                  overdue
                    ? "Past due — nudge your evaluators"
                    : notYetOpen
                      ? `Opens ${format(opens, "MMM d, yyyy")}`
                      : opens
                        ? `Opened ${format(opens, "MMM d, yyyy")}`
                        : "Shown to evaluators"
                }
                tone={overdue ? "warn" : "default"}
              />
              <Fact
                label="Outstanding"
                value={progress.outstanding}
                hint={
                  outstandingReviewers === 0
                    ? "Every reviewer is done"
                    : outstandingReviewers === 1
                      ? "1 reviewer still has work"
                      : `${outstandingReviewers} reviewers still have work`
                }
                tone={progress.outstanding > 0 ? "warn" : "default"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>The scorecard</CardTitle>
            <CardDescription>
              Ratings are averaged into the score. Choices and free text are
              recorded for you to read, never averaged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.criteria.map((criterion) => {
                const type = criterion.type ?? "numeric"
                const Icon =
                  type === "numeric"
                    ? RiStarLine
                    : type === "select"
                      ? RiListCheck2
                      : RiChatQuoteLine
                return (
                  <li
                    key={criterion.id}
                    className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground"
                  >
                    <Icon
                      size={15}
                      aria-hidden
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{criterion.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {type === "numeric"
                          ? `Rating 1–5${
                              criterion.weight && criterion.weight !== 1
                                ? ` · counts ${criterion.weight}×`
                                : ""
                            }`
                          : type === "select"
                            ? (criterion.options ?? []).join(" · ")
                            : "Free text — optional"}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Evaluators */}
      <Card className="p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle>Evaluators</CardTitle>
          <CardDescription>
            Everyone reviewing this round. Send each person their own link —
            they never need an account. Split the pool so nobody is handed all{" "}
            {submissions.length} submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-6">
          <AddEvaluatorForm planId={plan._id} className="pb-1" />
          <div className="flex flex-wrap items-center gap-2">
            <DistributeDialog
              planId={plan._id}
              submissionCount={submissions.length}
              evaluatorCount={evaluators.length}
              disabled={closed}
            />
            <Button
              variant="outline"
              disabled={remind.isPending || outstandingReviewers === 0}
              onClick={sendReminders}
            >
              <RiMailSendLine aria-hidden />
              {remind.isPending
                ? "Sending…"
                : outstandingReviewers === 0
                  ? "Everyone is up to date"
                  : `Remind ${outstandingReviewers} outstanding reviewer${outstandingReviewers === 1 ? "" : "s"}`}
            </Button>
          </div>
        </CardContent>
        {evaluators.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiUserStarLine}
            title="No evaluators yet"
            description="Add an email above and we'll mint a private review link for that person straight away."
          />
        ) : (
          <div className="border-t border-border">
            <EvaluatorsTable
              showActivity
              onEditAssignment={setAssigning}
              rows={evaluators.map((evaluator) => ({
                _id: evaluator._id,
                email: evaluator.email,
                name: evaluator.name,
                token: evaluator.token,
                done: evaluator.done,
                total: evaluator.total,
                lastActivityAt: evaluator.lastActivityAt,
                customAssignment: evaluator.customAssignment,
              }))}
            />
          </div>
        )}
      </Card>

      {assigning ? (
        <AssignSubmissionsDialog
          open
          onOpenChange={(next) => {
            if (!next) setAssigning(null)
          }}
          evaluatorId={assigning._id as Id<"evaluators">}
          evaluatorName={assigning.name ?? assigning.email}
          customAssignment={assigning.customAssignment === true}
          assignedSubmissionIds={
            evaluators.find((evaluator) => evaluator._id === assigning._id)
              ?.assignedSubmissionIds ?? []
          }
          submissions={submissions.map((submission) => ({
            _id: submission._id,
            title: submission.title,
            status: submission.status,
            track: submission.track
              ? { name: submission.track.name, color: submission.track.color }
              : null,
          }))}
        />
      ) : null}

      {/* Assigned submissions */}
      <Card className="p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle>Submissions under review</CardTitle>
          <CardDescription>
            {plan.weighted
              ? "Average score is the weighted mean of every completed scorecard for that submission. Recusals are excluded."
              : "Average score is the mean of every completed scorecard for that submission. Recusals are excluded."}
          </CardDescription>
        </CardHeader>
        {submissions.length === 0 ? (
          <EmptyState
            variant="plain"
            title="No submissions assigned"
            description="This plan has no submissions attached, so evaluators have nothing to score."
          />
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission</TableHead>
                  <TableHead className="w-40">Track</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-36 text-right">
                    {plan.weighted ? "Weighted avg" : "Avg score"}
                  </TableHead>
                  <TableHead className="w-28 text-right">Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...submissions]
                  .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1))
                  .map((submission) => (
                    <TableRow key={submission._id}>
                      <TableCell className="font-medium text-foreground">
                        {submission.title}
                      </TableCell>
                      <TableCell>
                        {submission.track ? (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: submission.track.color,
                              }}
                            />
                            {submission.track.name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No track
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={submission.status} size="sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        {submission.avgScore === null ? (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-foreground tabular-nums">
                              {submission.avgScore.toFixed(1)}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                / 5
                              </span>
                            </span>
                            {plan.weighted &&
                            submission.avgScoreUnweighted !== null ? (
                              <span className="block text-xs text-muted-foreground tabular-nums">
                                {submission.avgScoreUnweighted.toFixed(1)}{" "}
                                unweighted
                              </span>
                            ) : null}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {submission.completedCount} of{" "}
                        {submission.assignedCount}
                        {submission.recusedCount > 0 ? (
                          <span className="block text-xs text-status-amber-fg">
                            {submission.recusedCount} recused
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Fact({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: "default" | "warn"
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-heading mt-0.5 text-lg font-semibold text-foreground tabular-nums">
        {value}
      </p>
      {hint ? (
        <p
          className={
            tone === "warn"
              ? "mt-0.5 text-xs font-medium text-status-red-fg"
              : "mt-0.5 text-xs text-muted-foreground"
          }
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}

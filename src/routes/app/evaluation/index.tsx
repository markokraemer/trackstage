import { useMemo, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiDownloadLine,
  RiFileList3Line,
  RiGroupLine,
  RiStarLine,
  RiUserStarLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { MetricCard } from "@/components/evaluation/metric-card"
import { CompletionDonut } from "@/components/evaluation/completion-donut"
import { AvgScoreBars } from "@/components/evaluation/avg-score-bars"
import { PlanCard } from "@/components/evaluation/plan-card"
import type { PlanCardData } from "@/components/evaluation/plan-card"
import { NewPlanDialog } from "@/components/evaluation/new-plan-dialog"
import { DeletePlanDialog } from "@/components/evaluation/delete-plan-dialog"
import { EvaluatorsTable } from "@/components/evaluation/evaluators-table"
import {
  buildSubmissionsCsv,
  csvFilename,
  downloadCsv,
} from "@/components/submissions/export-csv"
import { useCurrentEvent } from "@/lib/current-event"

const TABS = ["summary", "plans", "evaluators"] as const
type EvaluationTab = (typeof TABS)[number]

/**
 * Evaluation (docs/SPEC.md §4.5, docs/video/actions.md §10).
 *
 * Three tabs — Summary · Plans · Evaluators. Sessionboard's "My Evaluations"
 * tab is deliberately dropped: organizers score through the same `/review`
 * link as everyone else, so there is no second, organizer-only scoring UI.
 *
 * The active tab lives in the URL (`?tab=plans`) so links are shareable and a
 * browser agent can jump straight to a tab.
 */
export const Route = createFileRoute("/app/evaluation/")({
  validateSearch: (search: Record<string, unknown>): { tab: EvaluationTab } => {
    const tab = search.tab
    return {
      tab: TABS.includes(tab as EvaluationTab) ? (tab as EvaluationTab) : "summary",
    }
  },
  component: EvaluationPage,
})

function EvaluationPage() {
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [evaluatorSearch, setEvaluatorSearch] = useState("")
  const [deleting, setDeleting] = useState<PlanCardData | null>(null)

  const { event, isLoading: eventsPending } = useCurrentEvent()
  const eventArgs = event ? { eventId: event._id } : "skip"

  const { data: summary } = useQuery(
    convexQuery(api.evaluationsAdmin.summary, eventArgs),
  )
  const { data: plans } = useQuery(
    convexQuery(api.evaluationsAdmin.listPlans, eventArgs),
  )
  const { data: evaluators } = useQuery(
    convexQuery(api.evaluationsAdmin.listEvaluators, eventArgs),
  )

  // The results export (sbek ABS-13). The scores lived one screen away on
  // Submissions → Options, which is the wrong place to look for them once
  // you're reading averages — so the same CSV is offered here, where the
  // results are. Every row carries Average score + Reviews alongside the
  // status, which is exactly the "who did we score, and how" sheet an
  // organizer takes into a programme-committee call.
  const { data: exportRows } = useQuery(
    convexQuery(api.submissions.exportData, eventArgs),
  )
  const { data: scoresBySubmission } = useQuery(
    convexQuery(api.evaluationsAdmin.scoresBySubmission, eventArgs),
  )

  function exportScores() {
    const rows = exportRows ?? []
    if (rows.length === 0) {
      toast.error("There's nothing to export yet.")
      return
    }
    downloadCsv(
      csvFilename(event?.name ?? "event", "scores"),
      buildSubmissionsCsv(rows, scoresBySubmission ?? {}),
    )
    toast.success(`Exported ${rows.length} submissions with their scores.`)
  }

  const exportButton = (
    <Button variant="outline" onClick={exportScores} disabled={!exportRows}>
      <RiDownloadLine aria-hidden />
      Export scores
    </Button>
  )

  const nextRound = useMemo(() => {
    if (!plans || plans.length === 0) return 1
    return Math.max(...plans.map((plan) => plan.round)) + 1
  }, [plans])

  const filteredEvaluators = useMemo(() => {
    const needle = evaluatorSearch.trim().toLowerCase()
    if (!needle) return evaluators ?? []
    return (evaluators ?? []).filter(
      (row) =>
        row.email.toLowerCase().includes(needle) ||
        (row.name ?? "").toLowerCase().includes(needle) ||
        row.planName.toLowerCase().includes(needle),
    )
  }, [evaluators, evaluatorSearch])

  const newPlanButton = (
    <Button onClick={() => setDialogOpen(true)} disabled={!event}>
      <RiAddLine aria-hidden />
      New plan
    </Button>
  )

  if (!event) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Evaluation"
          description="Score submissions with a panel of reviewers, one round at a time."
        />
        {eventsPending ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <EmptyState
            icon={RiStarLine}
            title="Create your event first"
            description="Evaluation plans belong to an event. Set up your event in Settings, then come back to invite reviewers."
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Evaluation"
        description="Score submissions with a panel of reviewers, one round at a time. Every reviewer gets a private link — no accounts to create."
        actions={
          <>
            {exportButton}
            {newPlanButton}
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) =>
          void navigate({ search: { tab: value as EvaluationTab } })
        }
      >
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="plans">
            Plans
            {plans ? <TabsCount>{plans.length}</TabsCount> : null}
          </TabsTrigger>
          <TabsTrigger value="evaluators">
            Evaluators
            {evaluators ? <TabsCount>{evaluators.length}</TabsCount> : null}
          </TabsTrigger>
        </TabsList>

        {/* ——— Summary ——————————————————————————————————————————————— */}
        <TabsContent value="summary" className="pt-5">
          {!summary ? (
            <SummarySkeleton />
          ) : summary.planCount === 0 ? (
            <EmptyState
              icon={RiStarLine}
              title="No evaluation plans yet"
              description="An evaluation plan is one round of scoring: you choose the submissions, invite reviewers by email, and they score each one out of 5. Averages appear here as soon as the first review lands."
              action={newPlanButton}
            />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={RiCheckboxCircleLine}
                  label="Total evaluations"
                  value={summary.totalEvaluations}
                  hint="Completed scorecards across every plan"
                />
                <MetricCard
                  icon={RiFileList3Line}
                  label="Evaluated submissions"
                  value={summary.evaluatedSubmissions}
                  hint="Submissions with at least one score"
                />
                <MetricCard
                  icon={RiStarLine}
                  label="Evaluation plans"
                  value={summary.planCount}
                  hint="One plan per review round"
                />
                <MetricCard
                  icon={RiGroupLine}
                  label="Evaluators"
                  value={summary.evaluatorCount}
                  hint="People invited to score"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Completion status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CompletionDonut
                      complete={summary.completion.complete}
                      incomplete={summary.completion.incomplete}
                    />
                    <p className="mt-5 text-sm text-muted-foreground">
                      {summary.completion.total === 0
                        ? "Add evaluators to a plan and their reviews will show up here."
                        : `${summary.completion.incomplete} scorecard${
                            summary.completion.incomplete === 1 ? "" : "s"
                          } still outstanding.`}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average score by plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AvgScoreBars
                      rows={summary.avgScoreByPlan.map((row) => ({
                        key: row.planId,
                        name: row.name,
                        round: row.round,
                        avg: row.avg,
                        count: row.count,
                      }))}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ——— Plans ————————————————————————————————————————————————— */}
        <TabsContent value="plans" className="pt-5">
          {!plans ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              icon={RiStarLine}
              title="No evaluation plans yet"
              description="Create a plan to send a batch of submissions to a panel of reviewers. You pick what they score, who scores it, and when it's due."
              action={newPlanButton}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {plans.map((plan) => (
                <PlanCard
                  key={plan._id}
                  plan={{
                    _id: plan._id,
                    name: plan.name,
                    round: plan.round,
                    status: plan.status,
                    dueAt: plan.dueAt,
                    submissionCount: plan.submissionCount,
                    evaluatorCount: plan.evaluatorCount,
                    completedEvaluations: plan.completedEvaluations,
                    totalEvaluations: plan.totalEvaluations,
                    avgScore: plan.avgScore,
                  }}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ——— Evaluators ——————————————————————————————————————————— */}
        <TabsContent value="evaluators" className="pt-5">
          {!evaluators ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : evaluators.length === 0 ? (
            <EmptyState
              icon={RiUserStarLine}
              title="No evaluators invited yet"
              description="Evaluators are added to a plan. Open a plan and add their email — each one gets a private review link that works without a password."
              action={newPlanButton}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <DataToolbar
                value={evaluatorSearch}
                onValueChange={setEvaluatorSearch}
                placeholder="Search evaluators…"
                searchLabel="Search evaluators"
                actions={newPlanButton}
              />
              <Card className="p-0">
                {filteredEvaluators.length === 0 ? (
                  <EmptyState
                    variant="plain"
                    title="No evaluators match that search"
                    description="Try a different name, email, or plan."
                  />
                ) : (
                  <EvaluatorsTable
                    showPlan
                    rows={filteredEvaluators.map((row) => ({
                      _id: row._id,
                      email: row.email,
                      name: row.name,
                      token: row.token,
                      done: row.done,
                      total: row.total,
                      planName: row.planName,
                      planStatus: row.planStatus,
                    }))}
                  />
                )}
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NewPlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={event._id}
        nextRound={nextRound}
        onCreated={(planId: Id<"evaluationPlans">) =>
          void navigate({
            to: "/app/evaluation/$planId",
            params: { planId },
            search: undefined,
          })
        }
      />

      <DeletePlanDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        planId={(deleting?._id ?? null) as Id<"evaluationPlans"> | null}
        name={deleting?.name ?? ""}
      />
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

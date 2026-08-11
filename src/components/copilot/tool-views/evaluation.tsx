import {
  RiDeleteBin6Line,
  RiKey2Line,
  RiMailSendLine,
  RiScales3Line,
  RiShuffleLine,
  RiUserStarLine,
} from "@remixicon/react"

import { StatusPill } from "@/components/shared/status-pill"
import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  LinkRow,
  MiniProgress,
  Note,
  Panel,
  Row,
  Rows,
  StatRow,
  Tile,
  asArray,
  formatDate,
  isRecord,
  num,
  str,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * Evaluation — plans, evaluators, scorecards, distribution and reminders.
 *
 * Everything here is really one number in different clothes: how much of the
 * reviewing is DONE. So every view leads with progress (a bar, a percentage, an
 * outstanding count) and only then lists rows, because "are we going to finish
 * before the committee meeting?" is the question an organizer actually opens
 * this panel to answer.
 *
 * These tools proxy `internal.apiV1.*`, so their payloads arrive in the REST
 * envelope — `{ data, results, pagination }`, snake_cased. `record()` below is
 * the one place that unwraps it; every view reads the plain record after that.
 */

/** The REST envelope's payload — `{data: …}` when present, else the body. */
function record(output: Record<string, unknown>): Record<string, unknown> {
  return isRecord(output.data) ? output.data : output
}

/** The REST envelope's rows — `data` when it is an array, else a named key. */
function rowsOf(
  output: Record<string, unknown>,
  key: string
): Array<Record<string, unknown>> {
  return asArray(output.data) ?? asArray(output[key]) ?? []
}

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

/** "63%" bar plus its raw fraction — the shape every progress row uses. */
function Progress({
  done,
  total,
  label,
}: {
  done: number
  total: number
  label?: string
}) {
  const value = pct(done, total)
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>
      <MiniProgress
        value={value}
        tone={value === 100 ? "good" : value === 0 ? "warn" : "default"}
      />
    </div>
  )
}

// ——— list_evaluation_plans ———————————————————————————————————————————————

export function EvaluationPlansView({ output }: ToolOutputProps) {
  const evaluationLink = useSectionLink("evaluation")
  const plans = rowsOf(output, "plans")
  if (plans.length === 0) {
    return (
      <EmptyRow>
        No evaluation plans yet — ask me to create one, or{" "}
        <GoLink to={evaluationLink}>open Evaluation</GoLink>.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Evaluation plans" meta={`${plans.length}`}>
      <Rows>
        {plans.map((plan, index) => {
          const done = num(plan.completed_count) ?? 0
          const assigned = num(plan.assigned_count) ?? 0
          const average = num(plan.average_score)
          const due = formatDate(plan.due_at)
          return (
            <Row key={str(plan.id) ?? index} className="flex-col gap-1.5">
              <div className="flex w-full min-w-0 items-center gap-2">
                <RiScales3Line
                  size={15}
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {str(plan.name) ?? "Untitled plan"}
                </span>
                {num(plan.round) !== null ? (
                  <Chip tone="muted">Round {num(plan.round)}</Chip>
                ) : null}
                <StatusPill status={str(plan.status) ?? "open"} size="sm" />
              </div>
              <div className="flex w-full items-center gap-3 pl-[23px]">
                <Progress
                  done={done}
                  total={assigned}
                  label={`${num(plan.evaluator_count) ?? 0} evaluator${(num(plan.evaluator_count) ?? 0) === 1 ? "" : "s"} · ${num(plan.submission_count) ?? 0} submissions`}
                />
                {average !== null ? (
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    ★ {average.toFixed(1)}
                  </span>
                ) : null}
              </div>
              {due ? (
                <span className="pl-[23px] text-xs text-muted-foreground">
                  Due {due}
                </span>
              ) : null}
            </Row>
          )
        })}
      </Rows>
      <GoLink to={evaluationLink}>Open Evaluation</GoLink>
    </Panel>
  )
}

// ——— get_evaluation_plan —————————————————————————————————————————————————

export function EvaluationPlanDetailView({ output }: ToolOutputProps) {
  const evaluationLink = useSectionLink("evaluation")
  const plan = record(output)
  const evaluators = asArray(plan.evaluators) ?? []
  const submissions = asArray(plan.submissions) ?? []
  const assigned = num(plan.assigned_count) ?? 0
  const completed = num(plan.completed_count) ?? 0
  const outstanding = num(plan.outstanding_count) ?? 0
  const average = num(plan.average_score)
  const criteria = asArray(plan.criteria) ?? []

  return (
    <Panel
      title={str(plan.name) ?? "Evaluation plan"}
      meta={formatDate(plan.due_at) ? `due ${formatDate(plan.due_at)}` : undefined}
    >
      <StatRow
        stats={[
          { label: "Submissions", value: num(plan.submission_count) ?? 0 },
          { label: "Evaluators", value: num(plan.evaluator_count) ?? 0 },
          {
            label: "Reviewed",
            value: `${pct(completed, assigned)}%`,
            tone: completed === assigned && assigned > 0 ? "good" : "default",
          },
          {
            label: "Outstanding",
            value: outstanding,
            tone: outstanding > 0 ? "warn" : "good",
          },
          ...(average !== null
            ? [{ label: "Avg score", value: average.toFixed(1) } as const]
            : []),
        ]}
      />

      {criteria.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {criteria.map((criterion, index) => (
            <Chip key={str(criterion.id) ?? index} tone="muted">
              {str(criterion.label) ?? str(criterion.id) ?? "Criterion"}
              {num(criterion.weight) !== null && num(criterion.weight) !== 1
                ? ` ×${num(criterion.weight)}`
                : ""}
            </Chip>
          ))}
          {plan.blind === true ? <Chip tone="warn">Blind</Chip> : null}
        </div>
      ) : null}

      {evaluators.length > 0 ? (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Evaluators
          </h4>
          <Rows>
            {evaluators.map((evaluator, index) => {
              const done = num(evaluator.completed_count) ?? 0
              const load = num(evaluator.assigned_count) ?? 0
              return (
                <Row key={str(evaluator.id) ?? index} className="items-center">
                  <RiUserStarLine
                    size={15}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-[2]">
                    <p className="truncate text-sm text-foreground">
                      {str(evaluator.name) ?? str(evaluator.email) ?? "Evaluator"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {str(evaluator.email)}
                    </p>
                  </div>
                  <Progress done={done} total={load} />
                </Row>
              )
            })}
          </Rows>
        </div>
      ) : (
        <EmptyRow>
          No evaluators on this plan yet — nobody can score until you add one.
        </EmptyRow>
      )}

      {submissions.length > 0 ? (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Pool
          </h4>
          <Rows>
            {submissions.slice(0, 6).map((submission, index) => (
              <Row key={str(submission.id) ?? index} className="items-center">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {str(submission.title) ?? "Untitled"}
                </span>
                {num(submission.average_score) !== null ? (
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    ★ {(num(submission.average_score) ?? 0).toFixed(1)}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    not scored
                  </span>
                )}
              </Row>
            ))}
          </Rows>
          {submissions.length > 6 ? (
            <Note>+{submissions.length - 6} more in the pool.</Note>
          ) : null}
        </div>
      ) : null}

      <GoLink to={evaluationLink}>Open Evaluation</GoLink>
    </Panel>
  )
}

// ——— create_evaluation_plan / update_evaluation_plan —————————————————————

export function EvaluationPlanSavedView({ output, toolName }: ToolOutputProps) {
  const evaluationLink = useSectionLink("evaluation")
  const plan = record(output)
  const created = toolName === "create_evaluation_plan"
  const criteria = asArray(plan.criteria) ?? []
  return (
    <Banner
      icon={<RiScales3Line size={16} />}
      title={`${str(plan.name) ?? "Plan"} ${created ? "created" : "updated"}`}
    >
      <FieldGrid
        entries={[
          { label: "Round", value: String(num(plan.round) ?? 1) },
          {
            label: "Status",
            value: <StatusPill status={str(plan.status) ?? "open"} size="sm" />,
          },
          {
            label: "Pool",
            value: `${num(plan.submission_count) ?? 0} submission(s)`,
          },
          {
            label: "Evaluators",
            value: String(num(plan.evaluator_count) ?? 0),
          },
          ...(formatDate(plan.due_at)
            ? [{ label: "Due", value: formatDate(plan.due_at)! }]
            : []),
          ...(criteria.length > 0
            ? [
                {
                  label: "Criteria",
                  value: criteria
                    .map((c) => str(c.label) ?? str(c.id) ?? "?")
                    .join(", "),
                },
              ]
            : []),
        ]}
      />
      {created && (num(plan.evaluator_count) ?? 0) === 0 ? (
        <Note>
          Add evaluators next — a plan with nobody on it never produces a score.
        </Note>
      ) : null}
      <GoLink to={evaluationLink}>Open Evaluation</GoLink>
    </Banner>
  )
}

// ——— delete_evaluation_plan ——————————————————————————————————————————————

export function EvaluationPlanDeletedView({ output }: ToolOutputProps) {
  const evaluationLink = useSectionLink("evaluation")
  const plan = record(output)
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(plan.name) ?? "Evaluation plan"} deleted`}
    >
      <Note>
        The plan, its evaluators and every score they entered are gone. Their
        review links no longer work.
      </Note>
      <GoLink to={evaluationLink}>Open Evaluation</GoLink>
    </Banner>
  )
}

// ——— add_evaluator / update_evaluator ————————————————————————————————————

/**
 * An evaluator's `review_path` IS their credential — there is no password
 * behind it — so it gets the LinkRow treatment (readable, copyable, opens in a
 * new tab) rather than being buried in a field grid as a string.
 */
export function EvaluatorSavedView({ output, toolName }: ToolOutputProps) {
  const evaluator = record(output)
  const added = toolName === "add_evaluator"
  const path = str(evaluator.review_path)
  const url =
    path && typeof window !== "undefined"
      ? new URL(path, window.location.origin).toString()
      : path
  const assigned = num(evaluator.assigned_count) ?? 0
  return (
    <Banner
      icon={<RiUserStarLine size={16} />}
      title={`${str(evaluator.name) ?? str(evaluator.email) ?? "Evaluator"} ${added ? "added" : "updated"}`}
    >
      <FieldGrid
        entries={[
          { label: "Email", value: str(evaluator.email) ?? "—" },
          { label: "Assigned", value: `${assigned} submission(s)` },
          {
            label: "Assignment",
            value:
              evaluator.custom_assignment === true
                ? "Hand-picked"
                : "The whole pool",
          },
        ]}
      />
      {url ? (
        <LinkRow url={url} label="Their review link" openLabel="Preview" />
      ) : null}
      <Note>
        This link is their sign-in — anyone holding it can score. Send it to
        them directly, never post it publicly.
      </Note>
    </Banner>
  )
}

// ——— rotate_evaluator_token ——————————————————————————————————————————————

export function EvaluatorTokenRotatedView({ output }: ToolOutputProps) {
  const url = str(output.reviewUrl)
  return (
    <Banner
      tone="warn"
      icon={<RiKey2Line size={16} />}
      title={`New review link for ${str(output.name) ?? str(output.email) ?? "this evaluator"}`}
    >
      <Note>
        The old link stopped working the moment this ran. Their scores so far
        are untouched — send them the new one.
      </Note>
      {url ? <LinkRow url={url} label="New review link" openLabel="Preview" /> : null}
    </Banner>
  )
}

// ——— remove_evaluator ————————————————————————————————————————————————————

export function EvaluatorRemovedView({ output }: ToolOutputProps) {
  const evaluator = record(output)
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(evaluator.name) ?? str(evaluator.email) ?? "Evaluator"} removed`}
    >
      <Note>
        Their magic link stopped working immediately, and the scores they
        entered went with them — the plan&apos;s averages have moved.
      </Note>
    </Banner>
  )
}

// ——— list_evaluations ————————————————————————————————————————————————————

export function EvaluationsView({ output }: ToolOutputProps) {
  const evaluationLink = useSectionLink("evaluation")
  const rows = rowsOf(output, "evaluations")
  if (rows.length === 0) {
    return <EmptyRow>No scorecards match that filter yet.</EmptyRow>
  }
  const recused = rows.filter((row) => row.recused === true).length
  return (
    <Panel title="Scorecards" meta={`${rows.length}`}>
      {recused > 0 ? (
        <Note>
          {recused} recusal{recused === 1 ? "" : "s"} — declared conflicts of
          interest, shown as rows but excluded from every average.
        </Note>
      ) : null}
      <Rows>
        {rows.slice(0, 8).map((row, index) => {
          const scores = isRecord(row.scores) ? row.scores : {}
          const values = Object.entries(scores)
            .map(([key, value]) => `${key} ${num(value) ?? "—"}`)
            .slice(0, 3)
          return (
            <Row key={str(row.id) ?? index} className="flex-col gap-1">
              <div className="flex w-full min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {str(row.session_title) ?? "Untitled submission"}
                </span>
                {row.recused === true ? (
                  <Chip tone="warn">Recused</Chip>
                ) : row.completed_at ? (
                  <Chip tone="muted">Done</Chip>
                ) : (
                  <Chip tone="warn">Open</Chip>
                )}
              </div>
              <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="truncate">{str(row.evaluator_email)}</span>
                {values.length > 0 ? (
                  <span className="tabular-nums">{values.join(" · ")}</span>
                ) : null}
              </div>
              {str(row.comment) ? (
                <p className="w-full truncate text-xs text-foreground italic">
                  “{str(row.comment)}”
                </p>
              ) : null}
              {str(row.recusal_reason) ? (
                <p className="w-full truncate text-xs text-status-amber-fg">
                  Recused: {str(row.recusal_reason)}
                </p>
              ) : null}
            </Row>
          )
        })}
      </Rows>
      {rows.length > 8 ? (
        <Note>+{rows.length - 8} more scorecards.</Note>
      ) : null}
      <GoLink to={evaluationLink}>Open Evaluation</GoLink>
    </Panel>
  )
}

// ——— distribute_evaluations ——————————————————————————————————————————————

export function EvaluationsDistributedView({ output }: ToolOutputProps) {
  const assigned = num(output.assigned) ?? 0
  const unassigned = num(output.unassigned) ?? 0
  return (
    <Banner
      icon={<RiShuffleLine size={16} />}
      tone={unassigned > 0 ? "warn" : "good"}
      title={`${assigned} submission${assigned === 1 ? "" : "s"} distributed across ${num(output.evaluatorCount) ?? 0} evaluator${(num(output.evaluatorCount) ?? 0) === 1 ? "" : "s"}`}
    >
      {unassigned > 0 ? (
        <Tile tone="warn">
          <p className="text-xs font-medium text-status-amber-fg">
            {unassigned} left unassigned
          </p>
          <p className="mt-0.5 text-xs text-foreground">
            Add evaluators or raise the per-reviewer cap, then run it again.
          </p>
        </Tile>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <Note>
        This REPLACED every existing assignment on the plan, hand-picked ones
        included.
      </Note>
    </Banner>
  )
}

// ——— remind_evaluators ———————————————————————————————————————————————————

export function EvaluatorsRemindedView({ output }: ToolOutputProps) {
  const commsLink = useSectionLink("communications")
  const reminded = num(output.reminded) ?? 0
  const skipped = num(output.skipped) ?? 0
  const recipients = asArray(output.recipients)
  const emails = Array.isArray(output.recipients)
    ? output.recipients.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : (recipients ?? []).map((row) => str(row.email) ?? "")
  return (
    <Banner
      icon={<RiMailSendLine size={16} />}
      tone={reminded > 0 ? "good" : "neutral"}
      title={
        reminded === 0
          ? "Nobody needed a reminder"
          : `${reminded} reminder${reminded === 1 ? "" : "s"} queued`
      }
    >
      {emails.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {emails.slice(0, 8).map((email, index) => (
            <Chip key={`${email}-${index}`} tone="muted">
              {email}
            </Chip>
          ))}
          {emails.length > 8 ? <Chip tone="muted">+{emails.length - 8}</Chip> : null}
        </div>
      ) : null}
      {skipped > 0 ? (
        <Note>
          {skipped} evaluator{skipped === 1 ? "" : "s"} already finished and
          {skipped === 1 ? " was" : " were"} skipped — nobody who is done gets
          nagged.
        </Note>
      ) : null}
      <GoLink to={commsLink} search={{ tab: "outbox" }}>
        Check the outbox
      </GoLink>
    </Banner>
  )
}

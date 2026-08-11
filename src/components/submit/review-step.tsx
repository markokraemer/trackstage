import { RiPencilLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  STEP_INDEX,
  displayAnswer,
  participantName,
  visibleQuestions,
} from "@/components/submit/form-logic"
import { ROLE_LABELS } from "@/components/submit/types"
import type {
  Answers,
  ParticipantDraft,
  SubmitForm,
} from "@/components/submit/types"

/**
 * Step 5 — Review (docs/SPEC.md §4.3). One summary card per section, each with
 * an Edit link that jumps straight back to the step that owns it — so a
 * correction never costs a restart.
 */

export interface ReviewStepProps {
  form: SubmitForm
  email: string
  answers: Answers
  participants: Array<ParticipantDraft>
  onEditStep: (stepIndex: number) => void
}

function SummaryCard({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string
  onEdit: () => void
  editLabel: string
  children: React.ReactNode
}) {
  return (
    <Card size="sm" className="gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <RiPencilLine aria-hidden />
          {editLabel}
        </Button>
      </div>
      {children}
    </Card>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid gap-0.5 border-t border-border pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
  )
}

export function ReviewStep({
  form,
  email,
  answers,
  participants,
  onEditStep,
}: ReviewStepProps) {
  const questions = visibleQuestions(form.questions, answers)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Review and submit
        </h1>
        <p className="text-sm text-muted-foreground">
          Check everything over. You can edit any section, and you&rsquo;ll still
          be able to update your submission from your speaker portal afterwards.
        </p>
      </div>

      <SummaryCard
        title="Account"
        editLabel="Edit"
        onEdit={() => onEditStep(STEP_INDEX.account)}
      >
        <dl className="space-y-3">
          <SummaryRow label="Email address" value={email || "—"} />
        </dl>
      </SummaryCard>

      <SummaryCard
        title="Submission"
        editLabel="Edit"
        onEdit={() => onEditStep(STEP_INDEX.submission)}
      >
        <dl className="space-y-3">
          {questions.map((question) => {
            const value = displayAnswer(question, answers[question.id])
            return (
              <SummaryRow
                key={question.id}
                label={question.label}
                value={
                  value ? (
                    value
                  ) : (
                    <span className="text-muted-foreground">Not answered</span>
                  )
                }
              />
            )
          })}
        </dl>
      </SummaryCard>

      <SummaryCard
        title={`Participants (${participants.length})`}
        editLabel="Edit"
        onEdit={() => onEditStep(STEP_INDEX.participants)}
      >
        <ul className="space-y-3">
          {participants.map((participant, index) => (
            <li
              key={index}
              className="border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  {participantName(participant, index)}
                </p>
                <Badge variant="secondary" className="font-normal">
                  {ROLE_LABELS[participant.role] ?? participant.role}
                </Badge>
                {index === 0 ? (
                  <span className="text-xs text-muted-foreground">(You)</span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {[participant.email, participant.jobTitle, participant.company]
                  .filter((part) => part && part.trim() !== "")
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </SummaryCard>
    </div>
  )
}

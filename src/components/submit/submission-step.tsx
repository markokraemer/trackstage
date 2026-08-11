import { FieldGroup } from "@/components/ui/field"
import { QuestionField } from "@/components/submit/question-field"
import { visibleQuestions } from "@/components/submit/form-logic"
import type { AnswerValue, Answers, SubmitForm } from "@/components/submit/types"

/**
 * Step 3 — Submission (docs/SPEC.md §4.3). The organizer's questions, rendered
 * in order with conditional logic applied live: answering "Workshop" makes the
 * workshop-only question appear on the spot, and clearing it hides it again.
 */

export interface SubmissionStepProps {
  form: SubmitForm
  answers: Answers
  onAnswerChange: (questionId: string, value: AnswerValue) => void
  /** Question ids flagged by validation. */
  invalidIds: Array<string>
}

export function SubmissionStep({
  form,
  answers,
  onAnswerChange,
  invalidIds,
}: SubmissionStepProps) {
  const questions = visibleQuestions(form.questions, answers)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Your submission
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us about the session you&rsquo;d like to present. Fields marked
          with <span className="required-asterisk">*</span> are required.
        </p>
      </div>

      <FieldGroup className="gap-7">
        {questions.map((question) => (
          <QuestionField
            key={question.id}
            question={question}
            value={answers[question.id]}
            invalid={invalidIds.includes(question.id)}
            onChange={(value) => onAnswerChange(question.id, value)}
          />
        ))}
      </FieldGroup>
    </div>
  )
}

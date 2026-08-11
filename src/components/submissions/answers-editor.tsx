import { useEffect, useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiCheckLine } from "@remixicon/react"
import { toast } from "sonner"

import { FieldGroup } from "@/components/ui/field"
import { QuestionField } from "@/components/submit/question-field"
import type { AnswerValue, SubmitQuestion } from "@/components/submit/types"
import { errorMessage } from "@/lib/errors"

/**
 * The submission's custom-field answers, EDITABLE (docs/reference/
 * api-parity.md UI census #8: the REST API can write these, the organizer
 * could only read them, so a typo in a speaker's answer was unfixable without
 * asking the speaker).
 *
 * Each answer renders through the SAME `QuestionField` the public CFP form
 * uses, driven by the question's own definition — a dropdown stays a dropdown,
 * a multi-select stays checkboxes. Sharing the component is what guarantees
 * the organizer and the speaker are editing the same field, not two
 * lookalikes.
 *
 * Saving is autosave-on-blur for anything typed, and immediate for anything
 * picked (a Select or a checkbox never blurs in a way a user would recognise
 * as "done"). Only the touched key is sent — `submissions.updateDetails`
 * merges the answers patch — so two organizers editing different answers on
 * the same submission cannot clobber each other.
 */

/** Handled by the drawer's own dedicated controls, so never duplicated here. */
const CORE_QUESTION_IDS = new Set([
  "title",
  "description",
  "track",
  "format",
  "level",
  "language",
  "tags",
])

type AnswerMap = Record<string, unknown>

export interface AnswersEditorProps {
  submissionId: Id<"submissions">
  /** `form.questions` for the form this submission came through (may be empty). */
  questions: Array<SubmitQuestion>
  answers: AnswerMap
}

export function AnswersEditor({
  submissionId,
  questions,
  answers,
}: AnswersEditorProps) {
  const updateDetails = useConvexMutation(api.submissions.updateDetails)
  const [draft, setDraft] = useState<Record<string, AnswerValue>>({})
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A different submission means a different set of answers.
  useEffect(() => {
    setDraft({})
    setSavedKey(null)
  }, [submissionId])

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    []
  )

  const custom = questions.filter(
    (question) => !CORE_QUESTION_IDS.has(question.id)
  )
  // Answers whose question was deleted from the form after the fact still
  // belong to the organizer — show them as plain text rather than dropping
  // data on the floor.
  const orphanKeys = Object.keys(answers).filter(
    (key) =>
      !CORE_QUESTION_IDS.has(key) &&
      !questions.some((question) => question.id === key) &&
      answers[key] !== null &&
      answers[key] !== undefined &&
      String(answers[key]).length > 0
  )

  if (custom.length === 0 && orphanKeys.length === 0) return null

  function valueFor(key: string, question?: SubmitQuestion): AnswerValue {
    if (key in draft) return draft[key]
    const stored = answers[key]
    if (question?.type === "multi_select") {
      return Array.isArray(stored) ? (stored as Array<string>) : []
    }
    if (question?.type === "checkbox") return stored === true
    if (stored === null || stored === undefined) return ""
    if (Array.isArray(stored)) return stored as Array<string>
    if (typeof stored === "boolean") return stored
    return String(stored)
  }

  function normalized(value: unknown): string {
    return JSON.stringify(value ?? "")
  }

  async function save(key: string, value: AnswerValue) {
    if (normalized(value) === normalized(answers[key])) return
    try {
      await updateDetails({
        submissionId,
        patch: { answers: { [key]: value ?? "" } },
      })
      setDraft((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setSavedKey(key)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedKey(null), 2000)
      toast.success("Answer saved.")
    } catch (error) {
      toast.error(errorMessage(error, "Could not save that answer."))
    }
  }

  /** Picked controls commit at once; typed controls wait for blur. */
  function isImmediate(type: string): boolean {
    return ["dropdown", "multi_select", "checkbox"].includes(type)
  }

  function renderQuestion(question: SubmitQuestion) {
    const value = valueFor(question.id, question)
    return (
      <div
        key={question.id}
        data-answer-field={question.id}
        onBlur={() => {
          if (isImmediate(question.type)) return
          if (!(question.id in draft)) return
          void save(question.id, draft[question.id])
        }}
      >
        <QuestionField
          question={question}
          value={value}
          onChange={(next) => {
            setDraft((prev) => ({ ...prev, [question.id]: next }))
            if (isImmediate(question.type)) void save(question.id, next)
          }}
        />
        {savedKey === question.id ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <RiCheckLine size={13} aria-hidden />
            Saved
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <FieldGroup>
      {custom.filter((question) => question.enabled).map(renderQuestion)}

      {orphanKeys.map((key) =>
        renderQuestion({
          id: key,
          label: key,
          type: "short_text",
          required: false,
          enabled: true,
          locked: false,
          help: "This question was removed from the form. The answer is kept here.",
        })
      )}
    </FieldGroup>
  )
}

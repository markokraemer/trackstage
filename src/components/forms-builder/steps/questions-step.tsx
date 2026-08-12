import { useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { RiSignpostLine } from "@remixicon/react"
import { toast } from "sonner"

import { AddQuestionMenu } from "../add-question-menu"
import {
  InfoNote,
  SectionHeading,
  StepIntro,
  WarningNote,
} from "../builder-controls"
import { QuestionEditorDrawer } from "../question-editor-drawer"
import { QuestionRow } from "../question-row"
import { makeQuestion, makeQuestionId } from "../model"
import type { FormQuestion, QuestionType } from "../model"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 3 — Submission questions. The heart of the builder (docs/SPEC.md §4.2):
 * reorderable rows, Required/Enabled per question, an edit drawer with the
 * options editor and the "Show only when…" rule, and the track-routing hint.
 */

/** Conditions may only point at a question that comes earlier in the list. */
function firstBrokenCondition(
  questions: Array<FormQuestion>,
): { question: FormQuestion; reason: string } | null {
  const ids = questions.map((question) => question.id)
  for (const question of questions) {
    if (!question.showIf) continue
    const sourceIndex = ids.indexOf(question.showIf.questionId)
    if (sourceIndex === -1) {
      return {
        question,
        reason: `“${question.label}” depends on a question that no longer exists.`,
      }
    }
    if (sourceIndex >= ids.indexOf(question.id)) {
      return {
        question,
        reason: `“${question.label}” can only depend on a question above it.`,
      }
    }
  }
  return null
}

export function QuestionsStep({
  draft,
  update,
  trackNames,
}: {
  draft: FormDraft
  update: (updater: (draft: FormDraft) => FormDraft) => void
  trackNames: Array<string>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const questions = draft.questions

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function setQuestions(next: Array<FormQuestion>): boolean {
    const broken = firstBrokenCondition(next)
    if (broken) {
      toast.error("That would break a conditional rule", {
        description: broken.reason,
      })
      return false
    }
    update((current) => ({ ...current, questions: next }))
    return true
  }

  function patchQuestion(id: string, patch: Partial<FormQuestion>) {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              ...patch,
              // Only one question can drive track routing.
              ...(patch.isTrackQuestion ? { isTrackQuestion: true } : {}),
            }
          : patch.isTrackQuestion && question.isTrackQuestion
            ? { ...question, isTrackQuestion: undefined }
            : question,
      ),
    )
  }

  function moveQuestion(id: string, direction: -1 | 1) {
    const index = questions.findIndex((question) => question.id === id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= questions.length) return
    setQuestions(arrayMove(questions, index, target))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = questions.findIndex((question) => question.id === active.id)
    const to = questions.findIndex((question) => question.id === over.id)
    if (from === -1 || to === -1) return
    setQuestions(arrayMove(questions, from, to))
  }

  function addQuestion(type: QuestionType) {
    const question = makeQuestion(
      type,
      questions.map((item) => item.id),
    )
    update((current) => ({ ...current, questions: [...current.questions, question] }))
    setEditingId(question.id)
  }

  function duplicateQuestion(id: string) {
    const source = questions.find((question) => question.id === id)
    if (!source) return
    const copy: FormQuestion = {
      ...source,
      id: makeQuestionId(
        `${source.label} copy`,
        questions.map((item) => item.id),
      ),
      label: `${source.label} (copy)`,
      locked: false,
      isTrackQuestion: undefined,
    }
    const index = questions.findIndex((question) => question.id === id)
    const next = [...questions]
    next.splice(index + 1, 0, copy)
    update((current) => ({ ...current, questions: next }))
  }

  function deleteQuestion(id: string) {
    const target = questions.find((question) => question.id === id)
    if (!target || target.locked) return
    const dependents = questions.filter(
      (question) => question.showIf?.questionId === id,
    )
    const next = questions
      .filter((question) => question.id !== id)
      .map((question) =>
        question.showIf?.questionId === id
          ? { ...question, showIf: undefined }
          : question,
      )
    update((current) => ({ ...current, questions: next }))
    if (dependents.length > 0) {
      toast.info(
        `Removed the “show only when” rule from ${dependents.length} question${dependents.length === 1 ? "" : "s"}.`,
      )
    } else {
      toast.success(`“${target.label}” deleted.`)
    }
    if (editingId === id) setEditingId(null)
  }

  const trackQuestion = questions.find((question) => question.isTrackQuestion)
  const editing = questions.find((question) => question.id === editingId) ?? null
  const enabledCount = questions.filter((question) => question.enabled).length

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Submission questions"
        description="What you want to know about each talk. Drag to reorder."
      />

      <SectionHeading
        title={`${enabledCount} question${enabledCount === 1 ? "" : "s"} on the form`}
        description="Turn a question off to hide it without losing it. Title and Description are always asked."
        actions={<AddQuestionMenu onAdd={addQuestion} />}
      />

      {trackQuestion && trackNames.length === 0 ? (
        // Marko's bug, at the place it is fixable: a Track question on an event
        // with no tracks used to render as a required dropdown with nothing in
        // it on the live public form.
        <WarningNote>
          <span className="font-medium">“{trackQuestion.label}”</span> offers
          your event tracks — and you haven&rsquo;t created any yet. Add them in{" "}
          <span className="font-medium">Settings → Rooms &amp; tracks</span>;
          until then this question is hidden on the public form
          {trackQuestion.required && trackQuestion.enabled
            ? ", and the form can't be opened while it is switched on and required"
            : ""}
          .
        </WarningNote>
      ) : trackQuestion ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-accent px-3.5 py-3 text-sm text-foreground/80">
          <RiSignpostLine
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <p className="leading-relaxed">
            <span className="font-medium text-foreground">
              “{trackQuestion.label}”
            </span>{" "}
            routes submissions: whatever a submitter picks puts their session in
            the matching track, ready for the agenda. Its answers stay in step
            with Settings → Rooms &amp; tracks automatically.
          </p>
        </div>
      ) : (
        <InfoNote>
          No question is routing submissions to tracks yet. Open a dropdown
          question and switch on “Route answers to tracks” to sort submissions
          automatically.
        </InfoNote>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((question) => question.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2.5">
            {questions.map((question, index) => (
              <QuestionRow
                key={question.id}
                question={question}
                questions={questions}
                trackNames={trackNames}
                isFirst={index === 0}
                isLast={index === questions.length - 1}
                onChange={(patch) => patchQuestion(question.id, patch)}
                onEdit={() => setEditingId(question.id)}
                onDuplicate={() => duplicateQuestion(question.id)}
                onDelete={() => deleteQuestion(question.id)}
                onMove={(direction) => moveQuestion(question.id, direction)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div>
        <AddQuestionMenu onAdd={addQuestion} label="Add another question" />
      </div>

      <QuestionEditorDrawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null)
        }}
        question={editing}
        questions={questions}
        trackNames={trackNames}
        onChange={(patch) => {
          if (editing) patchQuestion(editing.id, patch)
        }}
        onDelete={() => {
          if (editing) deleteQuestion(editing.id)
        }}
      />
    </div>
  )
}

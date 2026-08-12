import { useId } from "react"
import {
  RiAddLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiGitBranchLine,
  RiSignpostLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { RoomsTracksLink } from "./rooms-tracks-link"
import {
  BuilderField,
  InfoNote,
  SectionHeading,
  SettingRow,
  WarningNote,
} from "./builder-controls"
import {
  QUESTION_TYPES,
  conditionSources,
  conditionValues,
  questionTypeMeta,
} from "./model"
import type { FormQuestion, QuestionType } from "./model"

/**
 * Per-question editor (docs/SPEC.md §4.2 step 3 — "pencil → edit drawer").
 *
 * Everything edits live: changes land in the draft as you type and autosave
 * writes them, so the drawer never holds work hostage behind a Save button.
 */

/** value → label map so the select trigger reads "Dropdown", not "dropdown". */
const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((type) => [type.value, type.label]),
)

export interface QuestionEditorDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: FormQuestion | null
  /** Full ordered list — conditions may only reference earlier questions. */
  questions: Array<FormQuestion>
  /** Track names from the event, offered as one-click answer options. */
  trackNames: Array<string>
  onChange: (patch: Partial<FormQuestion>) => void
  onDelete: () => void
}

export function QuestionEditorDrawer({
  open,
  onOpenChange,
  question,
  questions,
  trackNames,
  onChange,
  onDelete,
}: QuestionEditorDrawerProps) {
  const fieldId = useId()

  if (!question) return null

  const meta = questionTypeMeta(question.type)
  const options = question.options ?? []
  const sources = conditionSources(questions, question.id)
  const condition = question.showIf ?? null
  const conditionSource = condition
    ? (questions.find((item) => item.id === condition.questionId) ?? null)
    : null

  function setOptions(next: Array<string>) {
    onChange({ options: next })
  }

  function changeType(nextType: QuestionType) {
    const nextMeta = questionTypeMeta(nextType)
    onChange({
      type: nextType,
      options: nextMeta.hasOptions ? (options.length ? options : ["Option 1"]) : undefined,
      maxChars: nextMeta.hasMaxChars ? (question?.maxChars ?? nextMeta.defaultMaxChars) : undefined,
      placeholder: nextMeta.hasPlaceholder ? question?.placeholder : undefined,
      isTrackQuestion: nextType === "dropdown" ? question?.isTrackQuestion : undefined,
    })
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit question"
      description="Changes appear on your public form as soon as they're saved."
      footer={
        <>
          {!question.locked ? (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:bg-destructive/10"
              onClick={() => {
                onDelete()
                onOpenChange(false)
              }}
            >
              <RiDeleteBinLine aria-hidden />
              Delete
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {question.locked ? (
          <InfoNote>
            This is a built-in question, so its type can't be changed and it
            can't be removed — every submission needs it. You can still reword
            the label and add helper text.
          </InfoNote>
        ) : null}

        <BuilderField
          htmlFor={`${fieldId}-label`}
          label="Question"
          required
          description="What submitters will read above the answer box."
        >
          <Input
            id={`${fieldId}-label`}
            value={question.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </BuilderField>

        <BuilderField
          htmlFor={`${fieldId}-type`}
          label="Answer type"
          description={meta.description}
        >
          <Select
            value={question.type}
            items={QUESTION_TYPE_LABELS}
            disabled={question.locked}
            onValueChange={(value) => changeType(String(value) as QuestionType)}
          >
            <SelectTrigger id={`${fieldId}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </BuilderField>

        <BuilderField
          htmlFor={`${fieldId}-help`}
          label="Helper text"
          description="Optional. Shown in small grey text under the question."
        >
          <Textarea
            id={`${fieldId}-help`}
            rows={2}
            value={question.help ?? ""}
            placeholder="e.g. Two or three sentences is plenty."
            onChange={(event) =>
              onChange({ help: event.target.value || undefined })
            }
          />
        </BuilderField>

        {meta.hasPlaceholder ? (
          <BuilderField
            htmlFor={`${fieldId}-placeholder`}
            label="Example answer"
            description="Optional. Shown as faint text inside the empty box."
          >
            <Input
              id={`${fieldId}-placeholder`}
              value={question.placeholder ?? ""}
              placeholder="e.g. How we cut our CFP review time in half"
              onChange={(event) =>
                onChange({ placeholder: event.target.value || undefined })
              }
            />
          </BuilderField>
        ) : null}

        {meta.hasMaxChars ? (
          <BuilderField
            htmlFor={`${fieldId}-max`}
            label="Character limit"
            description="Submitters see a live counter as they type."
          >
            <Input
              id={`${fieldId}-max`}
              type="number"
              min={10}
              max={20000}
              step={10}
              className="w-40"
              value={question.maxChars ?? ""}
              onChange={(event) => {
                const next = Number(event.target.value)
                onChange({
                  maxChars: Number.isFinite(next) && next > 0 ? next : undefined,
                })
              }}
            />
          </BuilderField>
        ) : null}

        {meta.hasOptions && question.isTrackQuestion ? (
          // Track answers are not typed here: they ARE the event's tracks, kept
          // in step automatically (convex/lib/formQuestions.ts). Editing them
          // by hand is what let a form offer a track that didn't exist — and an
          // empty list is what put a required, unanswerable dropdown on the
          // public form. Switch "Route answers to tracks" off below to go back
          // to an ordinary dropdown with your own options.
          <div className="flex flex-col gap-3">
            <SectionHeading
              title="Answer options"
              description="Taken from your event tracks, and updated automatically when you add or rename one."
            />
            {trackNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {trackNames.map((name) => (
                  <Badge key={name} variant="secondary" className="font-normal">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : (
              <WarningNote>
                You haven&rsquo;t created any tracks yet, so this question has
                nothing to offer. Add them in <RoomsTracksLink /> — until then
                it is hidden on the public form
                {question.required && question.enabled
                  ? ", and the form can't be opened while it is required"
                  : ""}
                .
              </WarningNote>
            )}
          </div>
        ) : meta.hasOptions ? (
          <div className="flex flex-col gap-3">
            <SectionHeading
              title="Answer options"
              description="One per line. Submitters pick from exactly these."
            />
            <ul className="flex flex-col gap-2">
              {options.map((option, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    aria-label={`Answer option ${index + 1}`}
                    onChange={(event) => {
                      const next = [...options]
                      next[index] = event.target.value
                      setOptions(next)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() =>
                      setOptions(options.filter((_, i) => i !== index))
                    }
                  >
                    <RiCloseLine size={16} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No options yet — add at least one so submitters have something
                to choose.
              </p>
            ) : null}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions([...options, `Option ${options.length + 1}`])
                }
              >
                <RiAddLine aria-hidden />
                Add option
              </Button>
            </div>
          </div>
        ) : null}

        {question.type === "dropdown" ? (
          <SettingRow
            id={`${fieldId}-track`}
            title={
              <span className="flex items-center gap-2">
                <RiSignpostLine size={15} aria-hidden className="text-primary" />
                Route answers to tracks
              </span>
            }
            description="The answers become your event's tracks, and stay in step with them. Submissions land in the matching track automatically — no manual sorting."
            checked={Boolean(question.isTrackQuestion)}
            onCheckedChange={(value) =>
              onChange({ isTrackQuestion: value || undefined })
            }
          >
            <p className="text-sm text-muted-foreground">
              {trackNames.length > 0 ? (
                <>
                  Your event tracks:{" "}
                  {trackNames.map((name) => (
                    <Badge
                      key={name}
                      variant="secondary"
                      className="mr-1 text-[11px]"
                    >
                      {name}
                    </Badge>
                  ))}
                </>
              ) : (
                <>
                  You haven&rsquo;t created any tracks yet. Add them in{" "}
                  <RoomsTracksLink /> and they appear here — and on your public
                  form — straight away.
                </>
              )}
            </p>
          </SettingRow>
        ) : null}

        <div className="flex flex-col gap-3">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <RiGitBranchLine size={15} aria-hidden className="text-primary" />
                Conditional logic
              </span>
            }
            description="Show this question only when an earlier answer matches."
          />

          {sources.length === 0 ? (
            <InfoNote>
              To use conditional logic, add a dropdown or checkbox question
              above this one — that answer becomes the trigger.
            </InfoNote>
          ) : (
            <SettingRow
              id={`${fieldId}-condition`}
              title="Only show this question sometimes"
              description="Everyone sees it unless you set a rule."
              checked={Boolean(condition)}
              onCheckedChange={(value) => {
                if (!value) {
                  onChange({ showIf: undefined })
                  return
                }
                const first = sources[0]
                onChange({
                  showIf: {
                    questionId: first.id,
                    equals: conditionValues(first)[0] ?? "",
                  },
                })
              }}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Show only when</span>
                <Select
                  value={condition?.questionId ?? ""}
                  items={Object.fromEntries(
                    sources.map((item) => [item.id, item.label]),
                  )}
                  onValueChange={(value) => {
                    const next = sources.find(
                      (item) => item.id === String(value),
                    )
                    if (!next) return
                    onChange({
                      showIf: {
                        questionId: next.id,
                        equals: conditionValues(next)[0] ?? "",
                      },
                    })
                  }}
                >
                  <SelectTrigger aria-label="Trigger question" className="min-w-[170px]">
                    <SelectValue placeholder="Choose a question" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">is</span>
                <Select
                  value={condition?.equals ?? ""}
                  onValueChange={(value) => {
                    if (!condition) return
                    onChange({
                      showIf: {
                        questionId: condition.questionId,
                        equals: String(value),
                      },
                    })
                  }}
                >
                  <SelectTrigger aria-label="Trigger answer" className="min-w-[150px]">
                    <SelectValue placeholder="Choose an answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(conditionSource
                      ? conditionValues(conditionSource)
                      : []
                    ).map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SettingRow>
          )}
        </div>
      </div>
    </DrawerShell>
  )
}

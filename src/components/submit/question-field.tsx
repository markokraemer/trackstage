import { RiInformationLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { FILE_PLACEHOLDER } from "@/components/submit/form-logic"
import type { AnswerValue, SubmitQuestion } from "@/components/submit/types"

/**
 * One question of the organizer's CFP form, rendered with the right real
 * component for its type (docs/SPEC.md §2.2 — never a raw text field for a
 * choice). Every control is the shadcn primitive, extended only with the
 * label/help/counter/validation chrome the public form needs.
 *
 * Types: short_text → Input · long_text/rich_text → Textarea · dropdown →
 * Select · multi_select → checkbox group · email/url/phone → typed Input ·
 * checkbox → Switch · file → an explanatory note (uploads happen in the
 * speaker portal, which is where the file requests live).
 */

export interface QuestionFieldProps {
  question: SubmitQuestion
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  /** Flagged by validation — red outline + message (docs/video §C). */
  invalid?: boolean
}

const NO_ANSWER = "__none__"

export function QuestionField({
  question,
  value,
  onChange,
  invalid = false,
}: QuestionFieldProps) {
  const id = `question-${question.id}`
  const text = typeof value === "string" ? value : ""
  const selected = Array.isArray(value) ? value : []
  const options = question.options ?? []
  const describedBy = question.help ? `${id}-help` : undefined

  const counter =
    question.maxChars &&
    ["short_text", "long_text", "rich_text"].includes(question.type) ? (
      <FieldDescription className="text-right text-xs tabular-nums">
        {text.length} / {question.maxChars}
      </FieldDescription>
    ) : null

  const control = () => {
    switch (question.type) {
      case "long_text":
      case "rich_text":
        return (
          <Textarea
            id={id}
            rows={6}
            value={text}
            maxLength={question.maxChars}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            placeholder={question.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )

      case "dropdown":
        return (
          <Select
            value={text === "" ? null : text}
            onValueChange={(next) =>
              onChange(next === NO_ANSWER || next === null ? "" : String(next))
            }
          >
            <SelectTrigger
              id={id}
              className="w-full"
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            >
              <SelectValue placeholder="Select an option…" />
            </SelectTrigger>
            <SelectContent>
              {!question.required ? (
                <SelectItem value={NO_ANSWER}>No answer</SelectItem>
              ) : null}
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "multi_select":
        return (
          <div
            role="group"
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            className={cn(
              "grid gap-2 sm:grid-cols-2",
              invalid && "rounded-md ring-3 ring-destructive/20",
            )}
          >
            {options.map((option) => {
              const checked = selected.includes(option)
              return (
                <FieldLabel
                  key={option}
                  htmlFor={`${id}-${option}`}
                  className={cn(
                    "w-full cursor-pointer items-center gap-2.5 rounded-md border border-input bg-card px-3 py-2.5 text-sm font-normal transition-colors hover:bg-muted/50",
                    checked && "border-primary/40 bg-primary/5",
                  )}
                >
                  <Checkbox
                    id={`${id}-${option}`}
                    checked={checked}
                    onCheckedChange={(next) =>
                      onChange(
                        next
                          ? [...selected, option]
                          : selected.filter((item) => item !== option),
                      )
                    }
                  />
                  {option}
                </FieldLabel>
              )
            })}
          </div>
        )

      case "checkbox":
        return (
          <FieldLabel
            htmlFor={id}
            className="w-full cursor-pointer items-center gap-3 rounded-md border border-input bg-card px-3 py-2.5 text-sm font-normal"
          >
            <Switch
              id={id}
              checked={value === true}
              aria-describedby={describedBy}
              onCheckedChange={(next) => onChange(next === true)}
            />
            {value === true ? "Yes" : "No"}
          </FieldLabel>
        )

      case "file":
        return (
          <div className="flex items-start gap-2.5 rounded-md border border-dashed border-input bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            <RiInformationLine
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p>
              No upload needed now — you can upload this in your speaker portal
              after your submission is accepted.
            </p>
          </div>
        )

      default: {
        const inputType =
          question.type === "email"
            ? "email"
            : question.type === "url"
              ? "url"
              : question.type === "phone"
                ? "tel"
                : "text"
        return (
          <Input
            id={id}
            type={inputType}
            value={text}
            maxLength={question.maxChars}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            placeholder={question.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      }
    }
  }

  return (
    <Field data-invalid={invalid || undefined}>
      {/* `gap-1` keeps the required asterisk tight to its label (see the note
          in account-step.tsx). */}
      <FieldLabel
        id={`${id}-label`}
        htmlFor={id}
        className="gap-1 text-foreground"
      >
        {question.label}
        {question.required ? (
          <span className="required-asterisk" aria-hidden>
            *
          </span>
        ) : null}
        {question.required ? <span className="sr-only">(required)</span> : null}
      </FieldLabel>

      {question.help ? (
        <FieldDescription id={describedBy}>{question.help}</FieldDescription>
      ) : null}

      {control()}

      {counter}

      {question.type === "file" && question.required ? (
        <FieldDescription>
          Recorded as “{FILE_PLACEHOLDER}” on your submission.
        </FieldDescription>
      ) : null}

      {invalid ? (
        <FieldError>
          {question.type === "multi_select"
            ? "Please choose at least one option."
            : "This field is required."}
        </FieldError>
      ) : null}
    </Field>
  )
}

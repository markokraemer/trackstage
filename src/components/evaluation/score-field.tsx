import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export const SCORE_VALUES = [1, 2, 3, 4, 5] as const

/** Plain-English meaning of each point on the scale — evaluators shouldn't guess. */
export const SCORE_HINTS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
}

/**
 * One 1–5 scoring criterion, as a big segmented control (docs/SPEC.md §4.5).
 * Built on the shadcn `ToggleGroup` primitive: five real buttons, each with an
 * explicit accessible name, so a person on a phone and a browser agent can
 * both hit them without hunting.
 */
export interface ScoreFieldProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  criterionId: string
  label: string
  value: number | undefined
  onChange: (value: number) => void
  disabled?: boolean
}

export function ScoreField({
  criterionId,
  label,
  value,
  onChange,
  disabled = false,
  weight,
  className,
  ...props
}: ScoreFieldProps & { weight?: number }) {
  const labelId = `criterion-${criterionId}`

  return (
    <div data-slot="score-field" className={cn("space-y-2", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="text-sm font-medium text-foreground">
          {label}
          <span className="required-asterisk">*</span>
          {weight !== undefined && weight !== 1 ? (
            <span
              className="ml-2 text-xs font-normal text-muted-foreground"
              title={`This rating counts ${weight}× in the average.`}
            >
              counts {weight}×
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {value === undefined ? "Not scored yet" : `${value} — ${SCORE_HINTS[value]}`}
        </p>
      </div>

      <ToggleGroup
        aria-labelledby={labelId}
        disabled={disabled}
        value={value === undefined ? [] : [String(value)]}
        onValueChange={(next) => {
          const picked = next[next.length - 1]
          if (picked) onChange(Number(picked))
        }}
        className="grid w-full grid-cols-5 gap-2"
      >
        {SCORE_VALUES.map((score) => (
          <ToggleGroupItem
            key={score}
            value={String(score)}
            variant="outline"
            aria-label={`${label}: ${score} of 5 — ${SCORE_HINTS[score]}`}
            className={cn(
              "h-14 w-full flex-col gap-0.5 rounded-lg text-lg font-semibold",
              "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground",
            )}
          >
            {score}
            <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
              {SCORE_HINTS[score]}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

// ——— Typed criteria (sbek ABS-03) ————————————————————————————————————————

/** A criterion as the plan stores it. Absent `type` means the 1–5 rating. */
export interface PlanCriterion {
  id: string
  label: string
  type?: "numeric" | "select" | "text"
  options?: Array<string>
  weight?: number
}

export function criterionType(
  criterion: PlanCriterion,
): "numeric" | "select" | "text" {
  return criterion.type ?? "numeric"
}

/** True when a scorecard can't be saved until this criterion is answered. */
export function criterionIsRequired(criterion: PlanCriterion): boolean {
  return criterionType(criterion) !== "text"
}

export interface CriterionFieldProps {
  criterion: PlanCriterion
  /** The 1–5 answer, for a numeric criterion. */
  score: number | undefined
  /** The chosen option or free text, for a select/text criterion. */
  value: string | undefined
  onScoreChange: (value: number) => void
  onValueChange: (value: string) => void
  disabled?: boolean
}

/**
 * One criterion on the evaluator's scorecard, rendered as whatever it actually
 * is: a 1–5 segmented control, a real dropdown, or a textarea (docs/SPEC.md
 * §2.2 — never a raw text box for structured data). Every branch is an
 * ordinary labelled control, so a browser agent can drive it blind.
 */
export function CriterionField({
  criterion,
  score,
  value,
  onScoreChange,
  onValueChange,
  disabled = false,
}: CriterionFieldProps) {
  const type = criterionType(criterion)
  const fieldId = `criterion-${criterion.id}`

  if (type === "numeric") {
    return (
      <ScoreField
        criterionId={criterion.id}
        label={criterion.label}
        value={score}
        weight={criterion.weight}
        disabled={disabled}
        onChange={onScoreChange}
      />
    )
  }

  if (type === "select") {
    const options = criterion.options ?? []
    return (
      <div data-slot="score-field" className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-foreground"
          >
            {criterion.label}
            <span className="required-asterisk">*</span>
          </label>
          <p className="text-xs text-muted-foreground">
            {value ? value : "Not answered yet"}
          </p>
        </div>
        <Select
          value={value ?? ""}
          disabled={disabled}
          onValueChange={(next) => onValueChange(String(next))}
        >
          <SelectTrigger
            id={fieldId}
            aria-label={criterion.label}
            className="w-full sm:max-w-xs"
          >
            <SelectValue>
              {(selected: string) =>
                selected ? selected : (
                  <span className="text-muted-foreground">Choose one…</span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div data-slot="score-field" className="space-y-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {criterion.label}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          Optional
        </span>
      </label>
      <Textarea
        id={fieldId}
        rows={3}
        value={value ?? ""}
        disabled={disabled}
        placeholder="Type your answer…"
        onChange={(event) => onValueChange(event.target.value)}
      />
    </div>
  )
}

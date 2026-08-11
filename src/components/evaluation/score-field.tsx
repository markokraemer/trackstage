import { cn } from "@/lib/utils"
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
  className,
  ...props
}: ScoreFieldProps) {
  const labelId = `criterion-${criterionId}`

  return (
    <div data-slot="score-field" className={cn("space-y-2", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="text-sm font-medium text-foreground">
          {label}
          <span className="required-asterisk">*</span>
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

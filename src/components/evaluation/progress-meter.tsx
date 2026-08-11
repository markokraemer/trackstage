import { cn } from "@/lib/utils"
import { Progress, ProgressLabel } from "@/components/ui/progress"

/**
 * "3 of 8 reviewed" bar. Wraps the shadcn `Progress` primitive so every
 * progress readout in Evaluation reads the same way: a plain-English label on
 * the left, the count and percentage on the right, the bar underneath.
 */
export interface ProgressMeterProps
  extends Omit<React.ComponentProps<typeof Progress>, "value" | "children"> {
  done: number
  total: number
  label?: React.ReactNode
  /** Word for the counted thing, e.g. "reviewed" → "3 of 8 reviewed". */
  unit?: string
  /** Hide the "x of y" readout (used in tight table cells). */
  hideCount?: boolean
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

export function ProgressMeter({
  done,
  total,
  label,
  unit,
  hideCount = false,
  className,
  ...props
}: ProgressMeterProps) {
  const pct = percent(done, total)
  const complete = total > 0 && done >= total

  return (
    <Progress
      value={pct}
      data-slot="progress-meter"
      className={cn("gap-1.5", className)}
      {...props}
    >
      {label ? (
        <ProgressLabel className="text-xs font-medium text-muted-foreground">
          {label}
        </ProgressLabel>
      ) : null}
      {hideCount ? null : (
        <span
          className={cn(
            "ml-auto text-xs font-medium tabular-nums",
            complete ? "text-status-green-fg" : "text-muted-foreground",
          )}
        >
          {done} of {total}
          {unit ? ` ${unit}` : ""} · {pct}%
        </span>
      )}
    </Progress>
  )
}

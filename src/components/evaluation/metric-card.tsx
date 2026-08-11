import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

/**
 * Metric card for the Evaluation → Summary tab (docs/video/actions.md §10:
 * "Total Evaluations, Evaluated Submissions, Evaluation Plans, Evaluators").
 *
 * Extends the shadcn `Card` primitive — big tabular number, plain-English
 * label, and a one-line hint so an organizer never has to guess what counts.
 */
export interface MetricCardProps
  extends Omit<React.ComponentProps<typeof Card>, "title"> {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: RemixiconComponentType
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card
      data-slot="metric-card"
      className={cn("gap-0 p-5", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon size={16} aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </Card>
  )
}

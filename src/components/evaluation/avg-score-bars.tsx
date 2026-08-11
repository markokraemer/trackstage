import { cn } from "@/lib/utils"

/**
 * "Average submission score by plan" (docs/video/actions.md §10). A plain
 * horizontal bar chart on the fixed 1–5 scoring scale, so bars are comparable
 * between plans. Values are printed next to every bar.
 */
export interface AvgScoreRow {
  key: string
  name: string
  round: number
  avg: number | null
  count: number
}

export interface AvgScoreBarsProps extends React.ComponentProps<"div"> {
  rows: Array<AvgScoreRow>
  /** Top of the scale — criteria are always scored 1–5. */
  max?: number
}

export function AvgScoreBars({
  rows,
  max = 5,
  className,
  ...props
}: AvgScoreBarsProps) {
  return (
    <div
      data-slot="avg-score-bars"
      className={cn("space-y-4", className)}
      {...props}
    >
      {rows.map((row) => {
        const width = row.avg === null ? 0 : Math.min(100, (row.avg / max) * 100)
        return (
          <div key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-foreground">
                {row.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Round {row.round}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                {row.avg === null ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    No scores yet
                  </span>
                ) : (
                  <>
                    {row.avg.toFixed(1)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      / {max}
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {row.count === 0
                ? "Waiting on evaluators"
                : `${row.count} ${row.count === 1 ? "evaluation" : "evaluations"} counted`}
            </p>
          </div>
        )
      })}
    </div>
  )
}

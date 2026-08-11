import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { shortDayLabel } from "@/components/dashboard/format"

export interface PacingPoint {
  /** `yyyy-MM-dd` in the event's timezone. */
  date: string
  count: number
}

export interface PacingChartProps {
  data: Array<PacingPoint>
  className?: string
}

const VIEW_W = 300
const VIEW_H = 90

/**
 * Submission pacing (docs/SPEC.md §4.8, docs/ux/05 image32) — one bar per day
 * for the last three weeks. Hand-rolled SVG on purpose: no chart library, no
 * extra bytes, and it scales with the card.
 *
 * The numbers are also written out in text under the chart, so a screen reader
 * (and a browser agent) can read the same information the bars encode.
 */
export function PacingChart({ data, className }: PacingChartProps) {
  const total = data.reduce((sum, point) => sum + point.count, 0)
  const max = data.reduce((acc, point) => Math.max(acc, point.count), 0)
  const last7 = data.slice(-7).reduce((sum, point) => sum + point.count, 0)
  const gap = 2
  const barWidth =
    data.length > 0 ? (VIEW_W - gap * (data.length - 1)) / data.length : 0
  const first = data[0]
  const latest = data[data.length - 1]

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle>Submission pacing</CardTitle>
        <CardDescription>
          Submissions received per day over the last {data.length} days.
        </CardDescription>
      </CardHeader>

      <CardContent className="gap-3">
        <div className="flex items-baseline gap-4">
          <div>
            <p className="font-heading text-2xl leading-none font-semibold tabular-nums text-foreground">
              {total}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">in this window</p>
          </div>
          <div>
            <p className="font-heading text-2xl leading-none font-semibold tabular-nums text-foreground">
              {last7}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">in the last 7 days</p>
          </div>
        </div>

        {total === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No submissions in the last {data.length} days. Share your form's
            public link to get the first one in.
          </p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${total} submissions over the last ${data.length} days, ${last7} in the last 7 days.`}
              className="h-24 w-full"
            >
              <line
                x1="0"
                y1={VIEW_H - 0.5}
                x2={VIEW_W}
                y2={VIEW_H - 0.5}
                className="stroke-border"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {data.map((point, index) => {
                const height =
                  max > 0 && point.count > 0
                    ? Math.max(3, (point.count / max) * (VIEW_H - 6))
                    : 1.5
                return (
                  <rect
                    key={point.date}
                    x={index * (barWidth + gap)}
                    y={VIEW_H - height}
                    width={barWidth}
                    height={height}
                    rx="1"
                    className={
                      point.count > 0 ? "fill-primary" : "fill-muted-foreground/25"
                    }
                  >
                    <title>{`${shortDayLabel(point.date)}: ${point.count} submission${point.count === 1 ? "" : "s"}`}</title>
                  </rect>
                )
              })}
            </svg>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{shortDayLabel(first.date)}</span>
              <span>{shortDayLabel(latest.date)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function PacingChartSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-5 w-40" />
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  )
}

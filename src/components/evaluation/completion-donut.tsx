import { cn } from "@/lib/utils"

/**
 * Completion Status donut (docs/video/actions.md §10: "Donut chart for
 * Completion Status — Complete vs Incomplete").
 *
 * Hand-rolled SVG on purpose: no chart library, no layout shift, and it stays
 * readable at any card width. Colours come from the brand tokens (primary for
 * done, muted for outstanding). The numbers are also written out in the legend
 * so the chart is never the only way to read the data — screen readers and
 * browser agents get the same facts as the eye.
 */
export interface CompletionDonutProps extends React.ComponentProps<"div"> {
  complete: number
  incomplete: number
  /** Diameter in px. */
  size?: number
}

export function CompletionDonut({
  complete,
  incomplete,
  size = 168,
  className,
  ...props
}: CompletionDonutProps) {
  const total = complete + incomplete
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0

  const stroke = 18
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (pct / 100) * circumference

  return (
    <div
      data-slot="completion-donut"
      className={cn("flex flex-wrap items-center gap-6", className)}
      {...props}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${pct}% of evaluations complete: ${complete} complete, ${incomplete} incomplete.`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          {total > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={stroke}
              strokeLinecap={pct > 0 && pct < 100 ? "round" : "butt"}
              strokeDasharray={`${dash} ${circumference - dash}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-[stroke-dasharray] duration-500"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {pct}%
          </span>
          <span className="text-xs text-muted-foreground">complete</span>
        </div>
      </div>

      <dl className="min-w-[9rem] space-y-3">
        <LegendRow
          swatch="bg-primary"
          label="Complete"
          value={complete}
          total={total}
        />
        <LegendRow
          swatch="bg-muted-foreground/25"
          label="Incomplete"
          value={incomplete}
          total={total}
        />
      </dl>
    </div>
  )
}

function LegendRow({
  swatch,
  label,
  value,
  total,
}: {
  swatch: string
  label: string
  value: number
  total: number
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", swatch)}
      />
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="ml-auto text-sm font-semibold text-foreground tabular-nums">
        {value}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          / {total}
        </span>
      </dd>
    </div>
  )
}

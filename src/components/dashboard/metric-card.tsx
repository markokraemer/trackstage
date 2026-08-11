import { Link } from "@tanstack/react-router"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export interface MetricCardProps {
  /** Plain-English noun, e.g. "Accepted speakers". */
  label: string
  value: number | string
  icon: RemixiconComponentType
  /** One short line under the number that explains what it means. */
  hint?: React.ReactNode
  /** Makes the whole card a link to the screen that acts on this number. */
  to?: string
  linkLabel?: string
  className?: string
}

/**
 * Dashboard KPI tile (docs/ux/05 image32 — label top-left, big numeral, icon
 * chip top-right). Extends the shadcn `Card` primitive; when `to` is set the
 * whole card becomes an ordinary link so a browser agent can click through.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  to,
  linkLabel,
  className,
}: MetricCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon size={18} aria-hidden />
        </span>
      </div>
      <p className="font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="text-xs text-muted-foreground">
          {hint}
          {to ? (
            <span className="ml-1 font-medium text-primary group-hover/metric:underline">
              {linkLabel ?? "View"} →
            </span>
          ) : null}
        </p>
      ) : null}
    </>
  )

  const cardClass = cn(
    "group/metric gap-3 px-5 transition-colors",
    to && "hover:bg-accent/40",
    className,
  )

  if (to) {
    return (
      <Link
        to={to}
        aria-label={`${label}: ${value}`}
        className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card size="sm" className={cardClass}>
          {body}
        </Card>
      </Link>
    )
  }

  return (
    <Card size="sm" className={cardClass}>
      {body}
    </Card>
  )
}

/** Same footprint as `MetricCard`, for the first paint. */
export function MetricCardSkeleton() {
  return (
    <Card size="sm" className="gap-3 px-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-9 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-36" />
    </Card>
  )
}

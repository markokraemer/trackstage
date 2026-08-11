import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  StatusPill,
  SUBMISSION_STATUSES,
} from "@/components/shared/status-pill"
import { APP_ROUTES, linkSearch } from "@/components/dashboard/app-routes"

/**
 * The status pill bar (docs/SPEC.md §4.8): one tile per pipeline status, each
 * a plain link into the matching tab of the submissions table. Counts stay
 * live because the underlying Convex query is reactive.
 */
export interface StatusCountBarProps {
  counts: Record<string, number>
  className?: string
}

export function StatusCountBar({ counts, className }: StatusCountBarProps) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      <div className="px-4">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Submission status
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 xl:grid-cols-7">
        {SUBMISSION_STATUSES.map((status) => (
          <Link
            key={status}
            to={APP_ROUTES.submissions}
            search={linkSearch({ status })}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5",
              "transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <StatusPill status={status} size="sm" />
            <span className="font-heading text-xl leading-none font-semibold tabular-nums text-foreground">
              {counts[status] ?? 0}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  )
}

export function StatusCountBarSkeleton() {
  return (
    <Card size="sm" className="gap-3">
      <div className="px-4">
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 xl:grid-cols-7">
        {SUBMISSION_STATUSES.map((status) => (
          <Skeleton key={status} className="h-[68px] rounded-lg" />
        ))}
      </div>
    </Card>
  )
}

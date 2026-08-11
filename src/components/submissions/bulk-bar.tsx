import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCloseLine,
  RiTimeLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { SubmissionStatus } from "@/components/shared/status-pill"

/**
 * Bulk action bar for the submissions table (docs/SPEC.md §4.4 "Bulk: select →
 * move to Accept/Decline Queue"). Moving to a queue is a *staged* decision —
 * the copy says so, because no email goes out until the queue is committed.
 */
export interface BulkBarProps {
  count: number
  onMove: (status: SubmissionStatus) => void | Promise<void>
  onClear: () => void
  busy?: boolean
  className?: string
}

export function BulkBar({
  count,
  onMove,
  onClear,
  busy,
  className,
}: BulkBarProps) {
  if (count <= 0) return null

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-accent px-3 py-2",
        className
      )}
    >
      <span className="text-sm font-medium text-foreground">
        {count} selected
      </span>
      <span className="hidden text-sm text-muted-foreground sm:inline">
        Staging a decision doesn't email anyone yet.
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onMove("accept_queue")}
        >
          <RiCheckboxCircleLine aria-hidden className="text-status-green-dot" />
          Move to Accept Queue
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onMove("decline_queue")}
        >
          <RiCloseCircleLine aria-hidden className="text-status-red-dot" />
          Move to Decline Queue
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onMove("pending")}
        >
          <RiTimeLine aria-hidden className="text-status-amber-dot" />
          Move to Pending
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={busy}
        >
          <RiCloseLine aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  )
}

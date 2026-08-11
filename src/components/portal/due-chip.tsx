import { RiLockLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { dueInfo } from "./portal-utils"

/**
 * "Due today" / "Overdue by 2 days" / "Due Oct 12" — one component so the due
 * date reads and colours identically on Home, on the Tasks tab, and anywhere
 * else it turns up. Dates are never shown raw: a speaker glancing at their
 * phone should not have to work out what "1786625982669" or even "Aug 13"
 * means relative to today.
 */
export function DueChip({
  dueAt,
  locked = false,
  className,
}: {
  dueAt?: number
  /** Past its deadline AND the event doesn't take late work. */
  locked?: boolean
  className?: string
}) {
  const due = dueInfo(dueAt)
  if (!due) return null

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-xs font-medium",
        locked
          ? "text-muted-foreground"
          : due.tone === "overdue"
            ? "text-destructive"
            : due.tone === "soon"
              ? "text-status-amber-fg"
              : "text-muted-foreground",
        className,
      )}
    >
      {locked ? <RiLockLine size={12} aria-hidden /> : null}
      {locked ? "Closed" : due.label}
    </span>
  )
}

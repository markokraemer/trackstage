import { cn } from "@/lib/utils"

/**
 * "2 of 3 sessions added" with a thin bar — the one number an organizer and a
 * sponsor both ask first. A 0 allowance reads as "organizer-managed" instead
 * of a full bar, because nothing is used up: the sponsor simply doesn't add
 * sessions themselves.
 */
export function AllowanceMeter({
  used,
  limit,
  className,
  compact = false,
}: {
  used: number
  limit: number
  className?: string
  compact?: boolean
}) {
  if (limit === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {used > 0 ? `${used} session${used === 1 ? "" : "s"} · ` : ""}
        Added by organizers
      </p>
    )
  }
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const full = used >= limit
  return (
    <div className={cn("flex flex-col gap-1.5", compact ? "w-28" : "w-full", className)}>
      <span className="text-xs font-medium text-foreground tabular-nums">
        {used} of {limit} session{limit === 1 ? "" : "s"} added
      </span>
      <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", full ? "bg-status-green-dot" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  )
}

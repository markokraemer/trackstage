import { RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/** The gaps `convex/dashboard.ts` reports, in plain English. */
export const MISSING_LABELS: Record<string, string> = {
  bio: "No bio",
  headshot: "No headshot",
  slides: "No slides",
}

export function missingLabel(key: string): string {
  return MISSING_LABELS[key] ?? `No ${key}`
}

export interface MissingPillsProps {
  missing: ReadonlyArray<string>
  /** Shown when nothing is missing. Set `false` to render nothing instead. */
  completeLabel?: string | false
  className?: string
}

/**
 * "What this speaker still owes you" chips — amber for a gap, green when the
 * profile is complete. Built on the shadcn `Badge` primitive so the pills sit
 * in the same family as `StatusPill` (docs/ux/05 image42).
 */
export function MissingPills({
  missing,
  completeLabel = "All set",
  className,
}: MissingPillsProps) {
  if (missing.length === 0) {
    if (completeLabel === false) return null
    return (
      <Badge
        variant="secondary"
        className="h-5 gap-1 rounded-full bg-status-green-bg px-2 text-[11px] text-status-green-fg"
      >
        <RiCheckLine size={12} aria-hidden />
        {completeLabel}
      </Badge>
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {missing.map((key) => (
        <Badge
          key={key}
          variant="secondary"
          className="h-5 rounded-full bg-status-amber-bg px-2 text-[11px] text-status-amber-fg"
        >
          {missingLabel(key)}
        </Badge>
      ))}
    </div>
  )
}

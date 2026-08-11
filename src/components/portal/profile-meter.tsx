import { Link } from "@tanstack/react-router"
import { RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import type { PortalMe } from "./portal-context"
import { profileCompleteness } from "./portal-utils"

/**
 * "Profile 75% complete" — the nudge, in one component so Home and the Profile
 * tab count the same four things and word them the same way. Each outstanding
 * item is a link straight to the field that fixes it: a speaker should never
 * have to hunt for the thing the meter is complaining about.
 */
export function ProfileMeter({
  me,
  compact = false,
  className,
}: {
  me: PortalMe
  /** Chips on one wrapping row instead of a checklist. */
  compact?: boolean
  className?: string
}) {
  const completeness = profileCompleteness(me)
  const done = completeness.percent === 100

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">
          {done
            ? "Your profile is complete"
            : `Profile ${completeness.percent}% complete`}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {completeness.done} of {completeness.total}
        </span>
      </div>

      <Progress
        value={completeness.percent}
        className="mt-1.5"
        aria-label={`Profile ${completeness.percent} percent complete`}
      />

      <ul
        className={cn(
          "mt-3",
          compact ? "flex flex-wrap gap-x-3 gap-y-1.5" : "grid gap-1.5",
        )}
      >
        {completeness.items.map((item) => (
          <li
            key={item.key}
            className={cn(
              "flex items-center gap-2",
              compact ? "text-xs" : "text-sm",
              item.done ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full",
                compact ? "size-3.5" : "size-4",
                item.done
                  ? "bg-status-green-bg text-status-green-fg"
                  : "border border-dashed border-muted-foreground/50",
              )}
            >
              {item.done ? <RiCheckLine size={compact ? 9 : 11} /> : null}
            </span>
            {item.done ? (
              <span>
                {item.label}
                <span className="sr-only"> — added</span>
              </span>
            ) : (
              // Not done ⇒ make it the shortest possible path to done.
              <Link
                to="/portal/profile"
                hash={item.key}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {item.label}
                <span className="sr-only"> — still missing, add it</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

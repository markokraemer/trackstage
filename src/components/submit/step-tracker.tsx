import { RiArrowRightSLine, RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { STEPS } from "@/components/submit/form-logic"

/**
 * The public flow's horizontal step tracker: numbered circles + labels joined
 * by chevrons (docs/ux/01 §7, docs/video/ui_fidelity.md §C).
 *
 * Completed steps stay clickable — nothing in this flow is ever trapped behind
 * a "Next". On small screens the row collapses to "Step 3 of 5 · Submission"
 * plus a progress bar so the card never scrolls sideways.
 *
 * Built on the shadcn `Button` (steps) and `Progress` (mobile) primitives.
 */

export interface StepTrackerProps {
  /** Index into `STEPS` of the step being shown. */
  currentIndex: number
  /** Furthest step the speaker has unlocked; earlier steps are clickable. */
  reachedIndex: number
  onSelect?: (index: number) => void
  className?: string
}

export function StepTracker({
  currentIndex,
  reachedIndex,
  onSelect,
  className,
}: StepTrackerProps) {
  const current = STEPS[currentIndex] ?? STEPS[0]

  return (
    <div data-slot="step-tracker" className={className}>
      {/* Mobile: one line + a progress bar. */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {current.label}
          </p>
          <p className="text-xs text-muted-foreground">
            Step {currentIndex + 1} of {STEPS.length}
          </p>
        </div>
        <Progress
          value={((currentIndex + 1) / STEPS.length) * 100}
          aria-label={`Step ${currentIndex + 1} of ${STEPS.length}: ${current.label}`}
        />
      </div>

      {/* Desktop: the full breadcrumb stepper. */}
      <ol className="hidden flex-wrap items-center gap-y-2 sm:flex">
        {STEPS.map((step, index) => {
          const isCurrent = index === currentIndex
          const isComplete = index < currentIndex
          const canGo = Boolean(onSelect) && index <= reachedIndex && !isCurrent

          return (
            <li key={step.id} className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-current={isCurrent ? "step" : undefined}
                disabled={!canGo}
                onClick={canGo ? () => onSelect?.(index) : undefined}
                className={cn(
                  "h-8 gap-2 rounded-full px-2 text-sm disabled:opacity-100",
                  isCurrent
                    ? "font-semibold text-primary"
                    : isComplete
                      ? "font-medium text-foreground"
                      : "font-normal text-muted-foreground",
                  canGo && "hover:bg-accent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-accent text-accent-foreground"
                        : "border border-input bg-card text-muted-foreground",
                  )}
                >
                  {isComplete ? <RiCheckLine size={12} /> : index + 1}
                </span>
                {step.label}
              </Button>
              {index < STEPS.length - 1 ? (
                <RiArrowRightSLine
                  size={16}
                  aria-hidden
                  className="mx-0.5 shrink-0 text-muted-foreground/60"
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

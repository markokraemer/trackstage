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
 * a "Next".
 *
 * FITTING FIVE STEPS INTO A 42rem CARD (Marko, 2026-08-12: "you see how ugly
 * the break is? it just breaks for the five Review step"). The old row was
 * `flex-wrap`, and five full labels + four chevrons overflow the card's ~608px
 * of content width by a few dozen pixels — so "Review" orphan-wrapped onto a
 * line of its own. Wrapping is now structurally impossible (`flex-nowrap`,
 * `whitespace-nowrap` labels) and the row degrades in three deliberate tiers
 * instead:
 *
 *   1. `< sm` — "Step 2 of 5 · Account" plus a progress bar. The row of
 *      circles is dropped entirely; a 380px phone has no business showing it.
 *   2. `sm … md` — COMPACT: every step is a numbered circle, but only the
 *      CURRENT one is labelled. The other labels go `sr-only`, not `hidden`,
 *      so each button keeps its accessible name at every width (browser agents
 *      and screen readers still find "Review").
 *   3. `≥ md` — the full breadcrumb, every step labelled, on one line.
 *
 * The card is capped at 42rem, so tier 3 has a fixed budget no viewport can
 * widen: ~608px against ~510px of content. The slack is real but finite, which
 * is why the labels are `text-sm` with tight padding and the chevrons are 14px.
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
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold text-foreground">
            {current.label}
          </p>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            Step {currentIndex + 1} of {STEPS.length}
          </p>
        </div>
        <Progress
          className="h-1.5"
          value={((currentIndex + 1) / STEPS.length) * 100}
          aria-label={`Step ${currentIndex + 1} of ${STEPS.length}: ${current.label}`}
        />
      </div>

      {/* sm and up: the breadcrumb stepper, compact until `md`. */}
      <ol
        aria-label="Submission steps"
        className="hidden flex-nowrap items-center sm:flex"
      >
        {STEPS.map((step, index) => {
          const isCurrent = index === currentIndex
          const isComplete = index < currentIndex
          const canGo = Boolean(onSelect) && index <= reachedIndex && !isCurrent

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                // Compact tier: the steps spread across the full card instead
                // of huddling on the left with 300px of dead space beside
                // them. At `md` the row is content-width again.
                index < STEPS.length - 1
                  ? "min-w-0 flex-1 md:flex-none"
                  : "shrink-0",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-current={isCurrent ? "step" : undefined}
                disabled={!canGo}
                onClick={canGo ? () => onSelect?.(index) : undefined}
                className={cn(
                  "h-8 shrink-0 gap-1.5 whitespace-nowrap rounded-full px-1 text-sm disabled:opacity-100",
                  isCurrent
                    ? "bg-primary-surface font-semibold text-primary hover:bg-primary-surface"
                    : isComplete
                      ? "font-medium text-foreground"
                      : "font-normal text-muted-foreground",
                  canGo && "hover:bg-accent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-primary-surface text-primary"
                        : "border border-input bg-card text-muted-foreground",
                  )}
                >
                  {isComplete ? <RiCheckLine size={13} /> : index + 1}
                </span>
                {/* `sr-only`, never `hidden` — the compact tier drops the ink,
                    not the accessible name. */}
                <span className={cn(!isCurrent && "sr-only md:not-sr-only")}>
                  {step.label}
                </span>
              </Button>
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="flex flex-1 items-center justify-center px-1.5 md:flex-none md:px-0"
                >
                  {/* Compact tier: a rule spans the gap — a chevron floating
                      in 60px of white would read as a stray glyph. It tints
                      once the segment has been traversed. */}
                  <span
                    className={cn(
                      "h-px w-full md:hidden",
                      isComplete ? "bg-primary/35" : "bg-border",
                    )}
                  />
                  <RiArrowRightSLine
                    size={14}
                    className="hidden shrink-0 text-muted-foreground/50 md:block"
                  />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine } from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

/**
 * Left step-rail wizard (docs/SPEC.md §2.6, docs/ux/02 synthesis).
 *
 * Rail: every step always visible with title + one-line description. Completed
 * steps show a green checkmark, the current step is a solid dark card, future
 * steps are muted but still clickable so nothing is ever trapped behind a
 * "Next". Footer: Back / Next, with Next becoming Save on the final step.
 */

export interface WizardStep {
  id: string
  title: string
  /** One plain-English line so the rail explains itself. */
  description?: string
  icon?: RemixiconComponentType
  disabled?: boolean
}

export interface WizardShellProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  steps: Array<WizardStep>
  currentStepId: string
  /** Steps marked done (green check). Defaults to every step before current. */
  completedStepIds?: Array<string>
  onStepSelect?: (stepId: string) => void
  /** Small uppercase heading above the rail. */
  railTitle?: string

  title?: React.ReactNode
  description?: React.ReactNode
  /** Persistent top-right actions (View form, Copy link, Save). */
  actions?: React.ReactNode

  onBack?: () => void
  onNext?: () => void
  /** Called by the final-step primary button. Falls back to `onNext`. */
  onSave?: () => void
  saving?: boolean
  backLabel?: string
  nextLabel?: string
  saveLabel?: string
  /** Extra content on the left of the footer (e.g. "All changes saved"). */
  footerLeft?: React.ReactNode

  children: React.ReactNode
}

export function WizardShell({
  steps,
  currentStepId,
  completedStepIds,
  onStepSelect,
  railTitle = "Steps",
  title,
  description,
  actions,
  onBack,
  onNext,
  onSave,
  saving = false,
  backLabel = "Back",
  nextLabel = "Next",
  saveLabel = "Save",
  footerLeft,
  children,
  className,
  ...props
}: WizardShellProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStepId),
  )
  const isFirst = currentIndex === 0
  const isLast = currentIndex === steps.length - 1
  const done = (index: number, step: WizardStep) =>
    completedStepIds ? completedStepIds.includes(step.id) : index < currentIndex

  return (
    <div
      data-slot="wizard-shell"
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h1 className="font-heading truncate text-xl font-semibold tracking-tight">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            // Wraps on phones — three actions are wider than a 390px screen.
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          aria-label={railTitle}
          className="shrink-0 lg:sticky lg:top-6 lg:w-64"
        >
          <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {railTitle}
          </p>
          <ol className="flex flex-col gap-1">
            {steps.map((step, index) => {
              const isCurrent = step.id === currentStepId
              const isDone = done(index, step)
              const Icon = step.icon
              return (
                <li key={step.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={step.disabled}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => onStepSelect?.(step.id)}
                    className={cn(
                      "h-auto w-full items-start justify-start gap-3 rounded-lg px-3 py-2.5 text-left whitespace-normal",
                      isCurrent
                        ? "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                        : "text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        isCurrent
                          ? "bg-background/15 text-background"
                          : isDone
                            ? "bg-status-green-bg text-status-green-fg"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isDone && !isCurrent ? (
                        <RiCheckLine size={12} aria-hidden />
                      ) : Icon ? (
                        <Icon size={12} aria-hidden />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {step.title}
                      </span>
                      {step.description ? (
                        <span
                          className={cn(
                            "mt-0.5 block text-xs leading-snug",
                            isCurrent
                              ? "text-background/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {step.description}
                        </span>
                      ) : null}
                    </span>
                    {isDone && !isCurrent ? (
                      <span className="sr-only">completed</span>
                    ) : null}
                  </Button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="min-w-0 flex-1">
          <Card className="p-6">{children}</Card>

          <Card className="mt-4 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm text-muted-foreground">{footerLeft}</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isFirst || !onBack}
              >
                <RiArrowLeftLine aria-hidden />
                {backLabel}
              </Button>
              {isLast ? (
                <Button
                  type="button"
                  onClick={onSave ?? onNext}
                  disabled={saving}
                >
                  <RiCheckLine aria-hidden />
                  {saving ? "Saving…" : saveLabel}
                </Button>
              ) : (
                <Button type="button" onClick={onNext} disabled={!onNext}>
                  {nextLabel}
                  <RiArrowRightLine aria-hidden />
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

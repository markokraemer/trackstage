import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { LogoMark } from "@/components/brand/logo"
import { PoweredByTrackstage } from "@/components/brand/powered-by"

/**
 * The public CFP page frame: fully de-chromed — no sidebar, no app header —
 * a single centred card on the page background (docs/ux/01 §7).
 */

export interface SubmitShellProps {
  /** Small line above the card: the event this call for speakers belongs to. */
  eventName?: string
  /** The organizer's external form title. */
  formTitle?: string
  /** The step tracker, pinned to the top of the card. */
  tracker?: React.ReactNode
  /** Footer actions rendered inside the card, under a hairline. */
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function SubmitShell({
  eventName,
  formTitle,
  tracker,
  footer,
  className,
  children,
}: SubmitShellProps) {
  return (
    <main className="min-h-svh bg-background py-8 sm:py-12">
      <div className={cn("container-narrow", className)}>
        <div className="mb-5 flex items-center gap-2.5">
          <LogoMark size={32} variant="boxed" />
          <div className="min-w-0">
            {eventName ? (
              <p className="truncate text-sm font-semibold text-foreground">
                {eventName}
              </p>
            ) : null}
            {formTitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {formTitle}
              </p>
            ) : null}
          </div>
        </div>

        <Card className="gap-0 p-0">
          {tracker ? (
            <div className="border-b border-border px-5 py-4 sm:px-8">
              {tracker}
            </div>
          ) : null}

          <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>

          {footer ? (
            <div className="border-t border-border px-5 py-4 sm:px-8">
              {footer}
            </div>
          ) : null}
        </Card>

        <div className="mt-5 flex justify-center">
          <PoweredByTrackstage />
        </div>
      </div>
    </main>
  )
}

/** Right-aligned footer actions, stacked on mobile so nothing is cut off. */
export function SubmitFooterActions({
  children,
  left,
}: {
  children: React.ReactNode
  left?: React.ReactNode
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {children}
      </div>
    </div>
  )
}

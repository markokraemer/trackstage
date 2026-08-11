import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

export interface EmptyStateProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  /** Remixicon component, e.g. `RiFileList3Line`. */
  icon?: RemixiconComponentType
  title: React.ReactNode
  /** Say what this thing IS, in plain English (docs/SPEC.md §2.10). */
  description?: React.ReactNode
  /** The primary action — usually the same button as the page header. */
  action?: React.ReactNode
  /** Optional secondary link/button next to the primary action. */
  secondaryAction?: React.ReactNode
  /** `card` renders inside a shadcn Card; `plain` drops into an existing one. */
  variant?: "card" | "plain"
}

/**
 * Empty state: never a bare "No results". Always explains the concept and
 * offers the primary action so a first-time organizer is never stuck.
 * Wraps the shadcn `Card` primitive in its default variant.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "card",
  className,
  ...props
}: EmptyStateProps) {
  const body = (
    <>
      {Icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
          <Icon size={20} aria-hidden />
        </div>
      ) : null}
      <p className="font-heading text-base font-semibold text-foreground">
        {title}
      </p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </>
  )

  const layout =
    "flex flex-col items-center justify-center gap-0 px-6 py-14 text-center"

  if (variant === "plain") {
    return (
      <div data-slot="empty-state" className={cn(layout, className)} {...props}>
        {body}
      </div>
    )
  }

  return (
    <Card data-slot="empty-state" className={cn(layout, className)} {...props}>
      {body}
    </Card>
  )
}

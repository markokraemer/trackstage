import { Link } from "@tanstack/react-router"
import { RiInformationLine } from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"

export interface InsightBannerProps {
  /** One plain-English sentence stating the gap. */
  title: React.ReactNode
  description?: React.ReactNode
  /** Where the organizer goes to fix it. */
  to: string
  actionLabel: string
  /** Optional typed search params for the destination route. */
  search?: Record<string, string>
  icon?: RemixiconComponentType
  className?: string
}

/**
 * Actionable insight row (docs/ux/05 image42): tinted background, info icon,
 * a sentence in plain English, and a right-aligned link that fixes it —
 * e.g. "3 accepted speakers are missing a bio or headshot → View speakers".
 *
 * Extends the shadcn `Alert` primitive.
 */
export function InsightBanner({
  title,
  description,
  to,
  actionLabel,
  search,
  icon: Icon = RiInformationLine,
  className,
}: InsightBannerProps) {
  return (
    <Alert
      className={cn(
        "items-center gap-x-3 border-border bg-accent px-4 py-3 sm:flex sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        <div>
          <AlertTitle className="text-foreground">{title}</AlertTitle>
          {description ? (
            <AlertDescription className="text-foreground/70">
              {description}
            </AlertDescription>
          ) : null}
        </div>
      </div>
      <Link
        to={to as never}
        search={search as never}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-3 shrink-0 sm:mt-0",
        )}
      >
        {actionLabel}
      </Link>
    </Alert>
  )
}

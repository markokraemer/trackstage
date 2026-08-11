import { cn } from "@/lib/utils"

export interface PageHeaderProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  /** One plain-English line under the title. Organizers should never guess. */
  description?: React.ReactNode
  /** Right-side actions — primary button last. */
  actions?: React.ReactNode
  /**
   * `banner` (default) = the tinted lavender panel used across the organizer
   * app (docs/ux/01 synthesis — module headers get their own tinted banner).
   * `plain` = bare heading, for drawers, public pages, and nested sections.
   */
  variant?: "banner" | "plain"
  /** Slot rendered under the title block (tabs, status pills, meta). */
  children?: React.ReactNode
}

/**
 * Standard page heading: title + one-line description on the left, actions on
 * the right (docs/SPEC.md §2.7 — every list gets its primary action top-right).
 */
export function PageHeader({
  title,
  description,
  actions,
  variant = "banner",
  children,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      data-variant={variant}
      className={cn(
        "flex flex-col gap-4",
        variant === "banner" &&
          "rounded-xl border border-primary/10 bg-accent px-5 py-4",
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading truncate text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            // A <div>, not a <p>: descriptions carry skeletons and chips, and a
            // block element inside <p> is a hydration error.
            <div
              className={cn(
                "text-sm",
                variant === "banner"
                  ? "text-foreground/70"
                  : "text-muted-foreground",
              )}
            >
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  )
}

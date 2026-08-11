import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/**
 * Segmented control, as *links*.
 *
 * The public pages keep every view mode in the URL (`?view=rooms`,
 * `?view=list`) so a visitor can share the exact thing they are looking at and
 * the back button behaves. That rules out a `ToggleGroup` — the control has to
 * be real anchors. These helpers give those anchors the shadcn segmented look
 * without three copies of the same class list across routes.
 */

/** The pill-shaped track the items sit in. */
export const segmentedGroup =
  "inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"

/** One item. `active` gets the filled state. */
export function segmentedItem(active: boolean, className?: string): string {
  return cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground",
    active &&
      "bg-secondary font-semibold text-secondary-foreground hover:bg-secondary",
    className,
  )
}

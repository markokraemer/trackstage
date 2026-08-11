import { RiBookmarkFill, RiBookmarkLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useMySchedule } from "@/components/public/use-my-schedule"

/**
 * Save a session to the visitor's personal schedule (sbek EMB-10/EMB-11).
 * No account needed — the picks live in the browser and persist across
 * reloads. Extends the shadcn `Button`.
 */
export interface SaveSessionButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children" | "onClick"> {
  eventSlug: string
  sessionId: string
  /** `icon` for cards, `full` for detail pages. */
  display?: "icon" | "full"
}

export function SaveSessionButton({
  eventSlug,
  sessionId,
  display = "icon",
  className,
  ...props
}: SaveSessionButtonProps) {
  const { has, toggle } = useMySchedule(eventSlug)
  const saved = has(sessionId)
  const label = saved ? "Saved to my schedule" : "Add to my schedule"
  const Icon = saved ? RiBookmarkFill : RiBookmarkLine

  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size={display === "icon" ? "icon-sm" : "default"}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(saved && "text-primary", className)}
      onClick={(clickEvent) => {
        clickEvent.preventDefault()
        clickEvent.stopPropagation()
        toggle(sessionId)
      }}
      {...props}
    >
      <Icon aria-hidden />
      {display === "full" ? label : null}
    </Button>
  )
}

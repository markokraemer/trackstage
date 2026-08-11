import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Truncated body copy with a "Show more" / "Show less" toggle — the anatomy
 * every Sessionboard widget card uses for abstracts and bios.
 * Built on the shadcn `Button` (link variant) so the control matches the app.
 */
export interface ShowMoreProps extends React.ComponentProps<"div"> {
  text?: string | null
  /** Clamped line count while collapsed. */
  lines?: 2 | 3 | 4
  /** Below this length the text is short enough to always show in full. */
  threshold?: number
}

const CLAMP: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
}

export function ShowMore({
  text,
  lines = 3,
  threshold = 180,
  className,
  ...props
}: ShowMoreProps) {
  const [expanded, setExpanded] = useState(false)
  const value = text?.trim()
  if (!value) return null

  const collapsible = value.length > threshold

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <p
        className={cn(
          "text-sm leading-relaxed whitespace-pre-line text-muted-foreground",
          collapsible && !expanded && CLAMP[lines],
        )}
      >
        {value}
      </p>
      {collapsible ? (
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0 font-medium"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </div>
  )
}

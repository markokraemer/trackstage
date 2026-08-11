import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Truncated body copy with a "Show more" / "Show less" toggle — the anatomy
 * every Sessionboard widget card uses for abstracts and bios.
 * Built on the shadcn `Button` (link variant) so the control matches the app.
 *
 * Whether the toggle appears is decided by the text being *actually* clamped,
 * not by counting characters. A character count cannot know the card's width or
 * the reader's font size, so a 200-character abstract that fits comfortably in
 * three lines still got a "Show more" button that changed nothing when pressed
 * — a control that lies about there being more to read. We clamp first, then
 * measure, and only offer the toggle when the paragraph really is cut off.
 */
export interface ShowMoreProps extends React.ComponentProps<"div"> {
  text?: string | null
  /** Clamped line count while collapsed. */
  lines?: 2 | 3 | 4
  /**
   * Length below which we don't even bother clamping. Purely an optimisation
   * for the obviously-short case — the measurement is what decides.
   */
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
  threshold = 120,
  className,
  ...props
}: ShowMoreProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const paragraph = useRef<HTMLParagraphElement | null>(null)

  const value = text?.trim()
  const worthClamping = (value?.length ?? 0) > threshold

  const measure = useCallback(() => {
    const el = paragraph.current
    if (!el) return
    // Only meaningful while the clamp is applied; once expanded the paragraph
    // is its full height by definition, so keep the last verdict.
    if (expanded) return
    setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [expanded])

  useEffect(() => {
    if (!worthClamping) {
      setOverflowing(false)
      return
    }
    measure()
    const el = paragraph.current
    if (!el || typeof ResizeObserver === "undefined") return
    // Reflows change the answer: a narrower card clamps text that fitted
    // before, and web fonts land after first paint.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, worthClamping, value])

  if (!value) return null

  const clamped = worthClamping && !expanded
  // Keep the control mounted while expanded — it is the only way back.
  const showToggle = overflowing || expanded

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <p
        ref={paragraph}
        className={cn(
          "text-sm leading-relaxed whitespace-pre-line text-muted-foreground",
          clamped && CLAMP[lines],
        )}
      >
        {value}
      </p>
      {showToggle ? (
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

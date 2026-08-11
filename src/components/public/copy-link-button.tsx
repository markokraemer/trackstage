import { useEffect, useRef, useState } from "react"
import { RiCheckLine, RiLinkM } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * "Copy link" — the share affordance every public surface needs.
 *
 * Attendees share sessions and speakers with colleagues far more often than
 * they share the event root, so the control sits on session cards, session
 * detail, speaker pages and the event header. It copies an absolute URL (so
 * the link still works when pasted into Slack) and confirms twice: an inline
 * checkmark on the button itself, and a toast for anyone using a screen
 * reader or looking elsewhere on the page.
 *
 * Extends the shadcn `Button`.
 */
export interface CopyLinkButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children" | "onClick"> {
  /** Absolute or root-relative URL. Defaults to the current page. */
  url?: string
  /** What was copied, for the confirmation copy ("Link to this session"). */
  what?: string
  /** `icon` for dense card clusters, `full` for detail pages. */
  display?: "icon" | "full"
  label?: string
}

/** Resolve to an absolute URL so a pasted link works anywhere. */
function absolute(url: string | undefined): string {
  if (typeof window === "undefined") return url ?? ""
  if (!url) return window.location.href
  return new URL(url, window.location.origin).toString()
}

export function CopyLinkButton({
  url,
  what = "Link",
  display = "full",
  label = "Copy link",
  variant = "outline",
  size,
  ...props
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = async (clickEvent: React.MouseEvent) => {
    clickEvent.preventDefault()
    clickEvent.stopPropagation()
    const value = absolute(url)
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard permission denied (or an insecure origin) — showing the URL
      // is still better than a silent no-op: the visitor can copy it manually.
      toast.error("We couldn't copy that automatically", { description: value })
      return
    }
    setCopied(true)
    toast.success(`${what} copied`, { description: value })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  const Icon = copied ? RiCheckLine : RiLinkM

  return (
    <Button
      variant={variant}
      size={size ?? (display === "icon" ? "icon-sm" : "default")}
      aria-label={label}
      title={label}
      onClick={(clickEvent) => void copy(clickEvent)}
      {...props}
    >
      <Icon aria-hidden />
      {display === "full" ? (copied ? "Copied" : label) : null}
    </Button>
  )
}

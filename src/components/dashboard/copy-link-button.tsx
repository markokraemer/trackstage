import { useState } from "react"
import { RiCheckLine, RiLinkM } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface CopyLinkButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  /** Absolute URL to put on the clipboard. */
  url: string
  label?: string
  copiedLabel?: string
  /** Toast text on success. Defaults to "Link copied to your clipboard". */
  toastMessage?: string
  /** Hide the text label (icon-only button still keeps an aria-label). */
  iconOnly?: boolean
}

/**
 * Copy-to-clipboard button. Public links are never hidden behind a menu —
 * swyx hunted for the CFP link in Sessionboard (docs/SPEC.md §2.8).
 *
 * Extends the shadcn `Button` primitive; falls back to a manual copy prompt
 * when the Clipboard API is unavailable (non-secure contexts).
 */
export function CopyLinkButton({
  url,
  label = "Copy link",
  copiedLabel = "Copied",
  toastMessage = "Link copied to your clipboard",
  iconOnly = false,
  variant = "outline",
  size = "sm",
  className,
  ...props
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      toast.success(toastMessage, { description: url })
    } catch {
      toast.error("Couldn't copy automatically", { description: url })
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon-sm" : size}
      aria-label={iconOnly ? label : undefined}
      className={cn(className)}
      onClick={() => void copy()}
      {...props}
    >
      {copied ? <RiCheckLine aria-hidden /> : <RiLinkM aria-hidden />}
      {iconOnly ? null : copied ? copiedLabel : label}
    </Button>
  )
}

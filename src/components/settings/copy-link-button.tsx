import { useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * "Copy public link" — surfaced directly wherever a public URL exists
 * (docs/SPEC.md §2.8: swyx hunted for this in Sessionboard, so never hide it).
 * Extends the shadcn `Button` with a copied confirmation state.
 */
export interface CopyLinkButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  url: string
  label?: string
  /** Toast shown after a successful copy. */
  successMessage?: string
}

export function CopyLinkButton({
  url,
  label = "Copy public link",
  successMessage = "Public link copied to your clipboard",
  variant = "outline",
  size = "sm",
  ...props
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(successMessage)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.")
    }
  }

  return (
    <Button variant={variant} size={size} onClick={() => void copy()} {...props}>
      {copied ? (
        <RiCheckLine size={15} aria-hidden />
      ) : (
        <RiFileCopyLine size={15} aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  )
}

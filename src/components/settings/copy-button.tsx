import { useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/**
 * Generic "copy this text" button — same copied-confirmation pattern as
 * `CopyLinkButton`, but for arbitrary snippets (endpoint URLs, config blocks,
 * CLI commands) rather than a public link.
 */
export interface CopyButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  value: string
  label?: string
  successMessage?: string
}

export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to your clipboard",
  variant = "outline",
  size = "sm",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually.")
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

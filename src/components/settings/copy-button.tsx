import { useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react"
import { toast } from "sonner"

import { copyText } from "@/lib/clipboard"

import { Button } from "@/components/ui/button"

/**
 * Generic "copy this text" button — same copied-confirmation pattern as
 * `CopyLinkButton`, but for arbitrary snippets (endpoint URLs, config blocks,
 * CLI commands) rather than a public link.
 */
export interface CopyButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  value: string
  /**
   * Resolve the text to copy at click time instead of using `value` — for
   * copies that first have to do work (mint an API key, fetch a secret).
   * Return null to abort silently (the resolver has already toasted its own
   * error). `value` remains what the surrounding UI displays.
   */
  getValue?: () => Promise<string | null>
  label?: string
  successMessage?: string
}

export function CopyButton({
  value,
  getValue,
  label = "Copy",
  successMessage = "Copied to your clipboard",
  variant = "outline",
  size = "sm",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    let text: string | null = value
    if (getValue) {
      try {
        text = await getValue()
      } catch {
        toast.error("Couldn't prepare the copy — try again.")
        return
      }
      if (text === null) return
    }
    if (await copyText(text)) {
      setCopied(true)
      toast.success(successMessage)
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Couldn't copy automatically", { description: text })
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

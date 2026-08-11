import { useCallback, useState } from "react"
import { RiCheckLine, RiExternalLinkLine, RiFileCopyLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

/** The magic link an evaluator uses — no login, straight into their queue. */
export function reviewLinkPath(token: string): string {
  return `/review/${token}`
}

export function reviewLinkUrl(token: string): string {
  const path = reviewLinkPath(token)
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/**
 * "Copy review link" — the single most important action on the Evaluators
 * table (docs/SPEC.md §4.5: evaluators score through `/review/:token`, no
 * login wall), so it is always visible, never hidden in a `…` menu.
 */
export interface CopyReviewLinkProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  token: string
  label?: string
}

export function CopyReviewLink({
  token,
  label = "Copy review link",
  variant = "outline",
  size = "sm",
  className,
  ...props
}: CopyReviewLinkProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = useCallback(() => {
    const url = reviewLinkUrl(token)
    void copyText(url).then((ok) => {
      if (ok) {
        setCopied(true)
        toast.success("Review link copied", { description: url })
        window.setTimeout(() => setCopied(false), 2000)
      } else {
        toast.error("Couldn't copy automatically", { description: url })
      }
    })
  }, [token])

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onCopy}
      className={cn(className)}
      {...props}
    >
      {copied ? (
        <RiCheckLine aria-hidden className="text-status-green-fg" />
      ) : (
        <RiFileCopyLine aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  )
}

/** Plain anchor to the evaluator's queue — clickable by a person or an agent. */
export function OpenReviewLink({
  token,
  label = "Open",
  className,
}: {
  token: string
  label?: string
  className?: string
}) {
  return (
    <a
      href={reviewLinkPath(token)}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: "ghost", size: "sm", className })}
    >
      <RiExternalLinkLine aria-hidden />
      {label}
    </a>
  )
}

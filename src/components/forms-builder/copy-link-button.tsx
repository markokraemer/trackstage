import { useState } from "react"
import { RiCheckLine, RiLinkM } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { publicFormUrl } from "./model"

/**
 * Copy the public submission link. Surfaced directly on every form card and in
 * the editor header (docs/SPEC.md §2.8 — never hide this behind a menu).
 */
export function CopyLinkButton({
  eventSlug,
  slug,
  variant = "outline",
  size = "default",
  label = "Copy public link",
}: {
  /** The event the form belongs to — form slugs are only unique inside one. */
  eventSlug: string
  slug: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = publicFormUrl(eventSlug, slug)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Public link copied", { description: url })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("We couldn't copy the link", { description: url })
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={() => void copy()}>
      {copied ? (
        <RiCheckLine aria-hidden className="text-status-green-fg" />
      ) : (
        <RiLinkM aria-hidden />
      )}
      {copied ? "Copied!" : label}
    </Button>
  )
}

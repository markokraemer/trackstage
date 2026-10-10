import * as React from "react"
import { RiDeleteBin6Line, RiImageAddLine, RiUploadLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { uploadToStorage } from "@/lib/files"
import { errorMessage } from "@/lib/errors"

const ACCEPT = "image/png,image/jpeg,image/svg+xml,image/webp"

/**
 * A sponsor's logo — preview, upload/replace, remove. Used by the organizer
 * (sponsor drawer) and by the sponsor itself (portal → Company); the caller
 * supplies how to get an upload URL and how to save the result, so the same
 * control works on both sides of the token boundary.
 */
export function SponsorLogoUploader({
  logoUrl,
  name,
  getUploadUrl,
  onSave,
  className,
}: {
  logoUrl: string | null
  name: string
  getUploadUrl: () => Promise<string>
  /** `null` removes the logo. */
  onSave: (storageId: string | null, filename?: string) => Promise<void>
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<number | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image — PNG, JPG, SVG or WebP")
      return
    }
    setBusy(true)
    try {
      const url = await getUploadUrl()
      const storageId = await uploadToStorage(url, file, setProgress)
      await onSave(storageId, file.name)
      toast.success(logoUrl ? "Logo replaced" : "Logo added")
    } catch (error) {
      toast.error("Couldn't upload the logo", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await onSave(null)
      toast.success("Logo removed")
    } catch (error) {
      toast.error("Couldn't remove the logo", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={logoUrl ? `Replace ${name}'s logo` : `Upload ${name}'s logo`}
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="size-full object-contain p-2" />
        ) : (
          <RiImageAddLine size={22} aria-hidden className="text-muted-foreground" />
        )}
      </button>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <RiUploadLine aria-hidden />
            {progress !== null ? `Uploading ${Math.round(progress)}%` : logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {logoUrl ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
              <RiDeleteBin6Line aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          SVG or a PNG on a transparent background works best on the sponsor wall.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  )
}

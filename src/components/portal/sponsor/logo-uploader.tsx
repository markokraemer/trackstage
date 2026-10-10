import { useEffect, useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"
import { RiDeleteBin6Line, RiImageAddLine, RiUpload2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { IMAGE_ACCEPT, isImage, uploadToStorage, validateFile } from "@/lib/files"
import { fitImageWithinLimit } from "@/lib/image"
import { errorMessage } from "@/lib/errors"
import { usePortal } from "@/components/portal/portal-context"
import { initialsOf } from "@/components/portal/portal-utils"

const MAX_BYTES = 5 * 1024 * 1024

/**
 * The sponsor's logo — the same one-tap / drop-on-it uploader as the speaker
 * headshot (headshot-uploader.tsx), squared off for a logo and drawn with
 * `object-contain` so a wide wordmark is never cropped. Replacing it deletes
 * the old file (convex/sponsors.ts → setSponsorLogoCore): a logo is a current
 * value, not a version history.
 */
export function LogoUploader() {
  const { home, portalToken } = usePortal()
  const sponsor = home.sponsor
  const generateUploadUrl = useConvexMutation(api.portal.generateUploadUrl)
  const setLogo = useConvexMutation(api.sponsorProfile.setCompanyLogo)
  const inputRef = useRef<HTMLInputElement>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [isOver, setIsOver] = useState(false)
  const [removing, setRemoving] = useState(false)
  // Optimistic: the chosen image shows immediately and stays until the
  // reactive query catches up — no flash of the old logo.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isUploading = percent !== null
  const shownUrl = previewUrl ?? sponsor?.logoUrl ?? null

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  if (!sponsor) return null

  async function handleFile(file: File | undefined) {
    if (!file || isUploading) return
    if (file.size > 0 && !isImage(file.type, file.name)) {
      toast.error("That needs to be an image — a PNG, JPG or WebP.")
      return
    }
    setPercent(0)
    let candidate = file
    try {
      candidate = await fitImageWithinLimit(file, MAX_BYTES)
    } catch (error) {
      setPercent(null)
      toast.error(errorMessage(error, "We couldn't read that image."))
      return
    }
    const problem = validateFile(candidate, { maxBytes: MAX_BYTES, imagesOnly: true })
    if (problem) {
      setPercent(null)
      toast.error(problem)
      return
    }
    setPreviewUrl(URL.createObjectURL(candidate))
    try {
      const uploadUrl = await generateUploadUrl({ portalToken })
      const storageId = await uploadToStorage(uploadUrl, candidate, setPercent)
      await setLogo({
        portalToken,
        storageId: storageId as Id<"_storage">,
        filename: candidate.name,
      })
      toast.success("Your logo was updated.")
    } catch (error) {
      setPreviewUrl(null)
      toast.error(errorMessage(error, "We couldn't upload that logo."))
    } finally {
      setPercent(null)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await setLogo({ portalToken, storageId: null })
      setPreviewUrl(null)
      toast.success("Logo removed.")
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't remove the logo."))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <button
        type="button"
        disabled={isUploading}
        aria-label={shownUrl ? "Replace your logo" : "Upload your logo"}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsOver(false)
          void handleFile(event.dataTransfer.files[0])
        }}
        className={cn(
          "group/logo relative rounded-xl p-1 transition-colors outline-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          isOver && "bg-primary/10 ring-2 ring-primary",
          isUploading && "pointer-events-none opacity-70",
        )}
      >
        <span className="flex size-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
          {shownUrl ? (
            <img src={shownUrl} alt={`${sponsor.name} logo`} className="size-full object-contain p-2" />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground">
              {initialsOf(...sponsor.name.split(" "))}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-lg bg-foreground/55 text-xs font-medium text-background opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100"
        >
          {shownUrl ? "Change" : "Add logo"}
        </span>
      </button>

      {isUploading ? (
        <Progress value={percent} aria-label="Uploading your logo" className="w-40 gap-1" />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        aria-label="Choose a logo image"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          void handleFile(file)
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {shownUrl ? <RiUpload2Line aria-hidden /> : <RiImageAddLine aria-hidden />}
          {isUploading ? `Uploading… ${percent}%` : shownUrl ? "Replace logo" : "Upload a logo"}
        </Button>
        {shownUrl && !isUploading ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={removing}
            onClick={() => void handleRemove()}
          >
            <RiDeleteBin6Line aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>
      <p className="self-stretch text-left text-xs leading-relaxed text-muted-foreground">
        A PNG or JPG on a transparent or white background, at least 600 pixels wide. Big
        images are shrunk automatically. If the organizers asked for a vector (SVG) version
        too, send it under Deliverables.
      </p>
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { RiImageAddLine, RiUpload2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { IMAGE_ACCEPT, isImage, validateFile } from "@/lib/files"
import { fitImageWithinLimit } from "@/lib/image"
import { usePortalUpload } from "./use-portal-upload"
import { errorMessage } from "@/lib/errors"

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Headshot upload (docs/SPEC.md §4.7). One click — or one drag onto the photo
 * itself — a live preview, real upload progress, and the guidelines stated in
 * plain English. Organizers chase missing headshots more than anything else,
 * so this has to be the easiest thing on the page.
 *
 * Over-the-limit photos are shrunk in the browser (`@/lib/image`), never
 * rejected: a 23 MB phone photo is normal, not a user error. The only refusal
 * left is a file the browser can't decode as an image at all.
 *
 * Replacing the photo deletes the file it replaces (convex/lib/files.ts →
 * `replaceHeadshot`): a profile picture is a current value, not a version
 * history, and five rejected selfies should not live in storage forever.
 */
export function HeadshotUploader({
  headshotUrl,
  initials,
}: {
  headshotUrl: string | null
  initials: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload } = usePortalUpload()
  const [percent, setPercent] = useState<number | null>(null)
  const [shrinking, setShrinking] = useState(false)
  const [isOver, setIsOver] = useState(false)
  // Optimistic: the moment a photo is chosen it appears in the avatar, and it
  // stays there while the reactive query catches up — no flash of the old
  // photo after a successful upload.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isUploading = percent !== null
  const shownUrl = previewUrl ?? headshotUrl

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  async function handleFile(file: File | undefined) {
    if (!file || isUploading) return
    if (file.size > 0 && !isImage(file.type, file.name)) {
      toast.error("That needs to be an image — a PNG, JPG or WebP.")
      return
    }

    setPercent(0)
    let candidate = file
    try {
      setShrinking(file.size > MAX_BYTES)
      candidate = await fitImageWithinLimit(file, MAX_BYTES)
    } catch (error) {
      setPercent(null)
      setShrinking(false)
      toast.error(errorMessage(error, "We couldn't read that photo."))
      return
    }
    setShrinking(false)

    // Backstop only — after shrinking, the remaining failures are empty or
    // non-image files.
    const problem = validateFile(candidate, {
      maxBytes: MAX_BYTES,
      imagesOnly: true,
    })
    if (problem) {
      setPercent(null)
      toast.error(problem)
      return
    }

    const localUrl = URL.createObjectURL(candidate)
    setPreviewUrl(localUrl)
    try {
      await upload(candidate, { isHeadshot: true }, setPercent)
      toast.success("Your headshot was updated.")
    } catch (error) {
      setPreviewUrl(null)
      toast.error(errorMessage(error, "We couldn't upload that photo."))
    } finally {
      setPercent(null)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {/* The photo IS the button. On a phone, tapping your own face is the
          first thing anyone tries; on a desktop you can also drop a file on
          it. */}
      <button
        type="button"
        disabled={isUploading}
        aria-label={shownUrl ? "Replace your headshot" : "Upload a headshot"}
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
          "group/headshot relative rounded-full p-1 transition-colors outline-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          isOver && "bg-primary/10 ring-2 ring-primary",
          isUploading && "pointer-events-none opacity-70",
        )}
      >
        <Avatar className="size-24 ring-1 ring-border">
          {shownUrl ? <AvatarImage src={shownUrl} alt="Your headshot" /> : null}
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-full bg-foreground/55 text-xs font-medium text-background opacity-0 transition-opacity group-hover/headshot:opacity-100 group-focus-visible/headshot:opacity-100"
        >
          {shownUrl ? "Change" : "Add photo"}
        </span>
      </button>

      {isUploading ? (
        <Progress
          value={percent}
          aria-label="Uploading your headshot"
          className="w-40 gap-1"
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        aria-label="Choose a headshot image"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          void handleFile(file)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {shownUrl ? (
          <RiUpload2Line aria-hidden />
        ) : (
          <RiImageAddLine aria-hidden />
        )}
        {isUploading
          ? shrinking
            ? "Shrinking…"
            : `Uploading… ${percent}%`
          : shownUrl
            ? "Replace photo"
            : "Upload a photo"}
      </Button>
      {/* The avatar and its button are centred; four lines of prose are not.
          Every other helper line in the portal and the CFP wizard is
          left-aligned, and centred multi-line copy is harder to read. */}
      <p className="self-stretch text-left text-xs leading-relaxed text-muted-foreground">
        A square photo, at least 800 × 800 pixels — JPG or PNG. Big photos are
        shrunk automatically. Tap the photo, or drag one straight onto it. It
        appears on the public programme next to your talk.
      </p>
    </div>
  )
}

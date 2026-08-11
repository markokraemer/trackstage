import { useRef, useState } from "react"
import { toast } from "sonner"
import { RiImageAddLine, RiUpload2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { IMAGE_ACCEPT, formatBytes, validateFile } from "@/lib/files"
import { usePortalUpload } from "./use-portal-upload"

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Headshot upload (docs/SPEC.md §4.7). One click — or one drag onto the photo
 * itself — a live preview, real upload progress, and the guidelines stated in
 * plain English. Organizers chase missing headshots more than anything else,
 * so this has to be the easiest thing on the page.
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
  const [isOver, setIsOver] = useState(false)
  const isUploading = percent !== null

  async function handleFile(file: File | undefined) {
    if (!file || isUploading) return
    const problem = validateFile(file, { maxBytes: MAX_BYTES, imagesOnly: true })
    if (problem) {
      toast.error(problem)
      return
    }
    setPercent(0)
    try {
      await upload(file, { isHeadshot: true }, setPercent)
      toast.success("Your headshot was updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't upload that photo.",
      )
    } finally {
      setPercent(null)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
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
          "rounded-full p-1 transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary",
        )}
      >
        <Avatar className="size-24 ring-1 ring-border">
          {headshotUrl ? (
            <AvatarImage src={headshotUrl} alt="Your headshot" />
          ) : null}
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
      </div>

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
        {headshotUrl ? (
          <RiUpload2Line aria-hidden />
        ) : (
          <RiImageAddLine aria-hidden />
        )}
        {isUploading
          ? `Uploading… ${percent}%`
          : headshotUrl
            ? "Replace photo"
            : "Upload a photo"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        A square photo, at least 800 × 800 pixels. JPG or PNG, up to{" "}
        {formatBytes(MAX_BYTES)}. Drag one straight onto the circle if you like.
        It appears on the public programme next to your talk.
      </p>
    </div>
  )
}

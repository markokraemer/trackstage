import { useRef } from "react"
import { toast } from "sonner"
import { RiImageAddLine, RiUpload2Line } from "@remixicon/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { usePortalUpload } from "./use-portal-upload"

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Headshot upload (docs/SPEC.md §4.7). One click, a live preview, and the
 * guidelines stated in plain English — organizers chase missing headshots more
 * than anything else, so this has to be the easiest thing on the page.
 */
export function HeadshotUploader({
  headshotUrl,
  initials,
}: {
  headshotUrl: string | null
  initials: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading } = usePortalUpload()

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPG or PNG).")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("That image is larger than 5 MB. Please choose a smaller one.")
      return
    }
    try {
      await upload(file, { isHeadshot: true })
      toast.success("Your headshot was updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't upload that photo.",
      )
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Avatar className="size-24 ring-1 ring-border">
        {headshotUrl ? <AvatarImage src={headshotUrl} alt="Your headshot" /> : null}
        <AvatarFallback className="text-xl">{initials}</AvatarFallback>
      </Avatar>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Choose a headshot image"
        onChange={handleFile}
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
          ? "Uploading…"
          : headshotUrl
            ? "Replace photo"
            : "Upload a photo"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        A square photo, at least 800 × 800 pixels. JPG or PNG, up to 5 MB. It
        appears on the public programme next to your talk.
      </p>
    </div>
  )
}

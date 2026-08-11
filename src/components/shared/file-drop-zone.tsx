import { useId, useRef, useState } from "react"
import { RiUploadCloud2Line } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  validateFile,
} from "@/lib/files"

/**
 * The one way anything in Trackstage accepts a file.
 *
 * Drag a file onto it, or click to browse. It validates BEFORE the upload
 * starts (an organizer should learn a 40 MB keynote is too big immediately,
 * not four minutes later), then shows real progress while the bytes move.
 *
 * Deliberately dumb about WHERE the file goes — the caller passes an
 * `onUpload` that knows whether this is a headshot, a task deliverable, an
 * event logo or an organizer attaching a deck on a speaker's behalf.
 */

export interface FileDropZoneProps {
  /** Do the upload. Report 0–100 through `onProgress` to drive the bar. */
  onUpload: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<void>
  /** Only images (headshots, event branding). */
  imagesOnly?: boolean
  maxBytes?: number
  label?: string
  hint?: string
  disabled?: boolean
  /** Compact single-line variant for tight rows (task items, drawers). */
  size?: "default" | "sm"
  className?: string
  onError?: (message: string) => void
  onSuccess?: (file: File) => void
}

export function FileDropZone({
  onUpload,
  imagesOnly = false,
  maxBytes = imagesOnly ? MAX_IMAGE_BYTES : MAX_UPLOAD_BYTES,
  label,
  hint,
  disabled = false,
  size = "default",
  className,
  onError,
  onSuccess,
}: FileDropZoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOver, setIsOver] = useState(false)
  const [percent, setPercent] = useState<number | null>(null)
  const [current, setCurrent] = useState<string | null>(null)

  const busy = percent !== null
  const defaultLabel = imagesOnly
    ? "Drop an image here, or click to choose one"
    : "Drop a file here, or click to choose one"
  const defaultHint = imagesOnly
    ? `PNG, JPG or WebP · up to ${formatBytes(maxBytes)}`
    : `PDF, slides, documents or images · up to ${formatBytes(maxBytes)}`

  async function handleFile(file: File | undefined) {
    if (!file || disabled || busy) return
    const problem = validateFile(file, { maxBytes, imagesOnly })
    if (problem) {
      onError?.(problem)
      return
    }
    setCurrent(file.name)
    setPercent(0)
    try {
      await onUpload(file, (value) => setPercent(value))
      onSuccess?.(file)
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "We couldn't upload that file. Please try again.",
      )
    } finally {
      setPercent(null)
      setCurrent(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/*
        The input is machinery, not a control: the labelled, focusable,
        keyboard-operable button is the zone below, and it opens this picker.
        Left exposed, `<input type="file">` also maps to role="button" with the
        SAME accessible name, so a screen reader announces the drop zone twice
        and `getByRole` can't tell them apart. Hidden from the a11y tree and
        out of the tab order, there is exactly one button here.
      */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={imagesOnly ? IMAGE_ACCEPT : FILE_ACCEPT}
        disabled={disabled || busy}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          // Read the File out FIRST. `input.value = ""` empties the very
          // FileList the event still points at (same object), so clearing
          // before reading hands `handleFile` nothing and the upload silently
          // never happens — verified in Chrome.
          const file = event.target.files?.[0]
          event.target.value = ""
          void handleFile(file)
        }}
      />

      <div
        role="button"
        tabIndex={disabled || busy ? -1 : 0}
        aria-disabled={disabled || busy}
        aria-describedby={`${inputId}-hint`}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          if (!disabled && !busy) inputRef.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !busy) setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsOver(false)
          void handleFile(event.dataTransfer.files[0])
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-center transition-colors outline-none",
          "hover:border-primary/50 hover:bg-muted/60",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          size === "sm" ? "px-3 py-3" : "px-4 py-6",
          isOver && "border-primary bg-primary/5",
          (disabled || busy) && "pointer-events-none opacity-60",
        )}
      >
        <RiUploadCloud2Line
          aria-hidden
          className={cn(
            "text-muted-foreground",
            size === "sm" ? "size-5" : "size-6",
          )}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            {busy ? `Uploading ${current}…` : (label ?? defaultLabel)}
          </span>
          <span
            id={`${inputId}-hint`}
            className="text-xs text-muted-foreground"
          >
            {hint ?? defaultHint}
          </span>
        </div>
        {size !== "sm" && !busy ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              inputRef.current?.click()
            }}
          >
            Choose a file
          </Button>
        ) : null}
      </div>

      {busy ? (
        <Progress
          value={percent}
          aria-label={`Uploading ${current ?? "file"}`}
          className="gap-1"
        />
      ) : null}
    </div>
  )
}

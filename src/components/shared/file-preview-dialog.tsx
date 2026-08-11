import { useEffect, useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiDownload2Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import {
  downloadFile,
  extensionOf,
  fileIcon,
  fileKindLabel,
  formatBytes,
  isImage,
} from "@/lib/files"

/**
 * One-click file preview (Marko, live walkthrough 2026-08-11): click a file
 * anywhere it is listed and it opens right here, instead of a download round
 * trip through the Finder. One dialog for every surface — organizer Files
 * library, submission drawer, speaker profile drawer, portal task uploads —
 * so a file previews identically wherever it appears.
 *
 * The browser is the viewer: images in an <img>, PDFs in the native viewer
 * via <iframe>, audio/video in native elements, small text files fetched into
 * a <pre>. Everything else gets an honest "no preview" card with the metadata
 * and a Download button. URLs are the same signed, access-checked storage
 * URLs the download buttons already use — no new ways to reach a file.
 */

export interface PreviewFile {
  id: string
  filename: string
  contentType?: string
  size?: number
  url: string | null
  /** Context line in the header — "Ada Lovelace · Keynote slides". */
  meta?: string
}

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "none"

// Extension fallbacks for when the stored content type is missing or generic
// (`application/octet-stream` — common for email-forwarded files). The
// browser's native loaders are the "library": img/iframe/video/audio cover
// every common upload without shipping a renderer.
const EXTRA_IMAGE_EXTENSIONS = ["svg", "bmp", "ico"]
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"]
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg", "aac", "flac"]
const TEXT_EXTENSIONS = ["txt", "md", "csv", "json", "log"]
/** Text preview cap — enough for any speaker bio, small enough to render. */
const TEXT_PREVIEW_CAP = 1024 * 1024

function previewKind(file: PreviewFile): PreviewKind {
  if (!file.url) return "none"
  const type = file.contentType ?? ""
  const ext = extensionOf(file.filename)
  if (isImage(file.contentType, file.filename)) return "image"
  if (EXTRA_IMAGE_EXTENSIONS.includes(ext)) return "image"
  if (type === "application/pdf" || ext === "pdf") return "pdf"
  if (type.startsWith("video/") || VIDEO_EXTENSIONS.includes(ext)) return "video"
  if (type.startsWith("audio/") || AUDIO_EXTENSIONS.includes(ext)) return "audio"
  if (type.startsWith("text/") || type === "application/json") return "text"
  if (TEXT_EXTENSIONS.includes(ext)) return "text"
  return "none"
}

export interface FilePreviewDialogProps {
  /** The list being browsed — arrow keys move through it in this order. */
  files: Array<PreviewFile>
  /** Id of the file being previewed, or null when closed. */
  openId: string | null
  onOpenChange: (id: string | null) => void
}

export function FilePreviewDialog({
  files,
  openId,
  onOpenChange,
}: FilePreviewDialogProps) {
  const index = openId === null ? -1 : files.findIndex((f) => f.id === openId)
  const file = index >= 0 ? files[index] : null
  const [downloading, setDownloading] = useState(false)

  function step(delta: number) {
    if (files.length < 2 || index < 0) return
    const next = (index + delta + files.length) % files.length
    onOpenChange(files[next].id)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      step(1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      step(-1)
    }
  }

  async function handleDownload() {
    if (!file?.url) return
    setDownloading(true)
    try {
      await downloadFile(file.url, file.filename)
    } catch {
      toast.error(`We couldn't download ${file.filename}.`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(null)
      }}
    >
      <DialogPortal>
        {/* Darker scrim than the standard dialog — the preview is a lightbox. */}
        <DialogOverlay className="bg-black/60" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          aria-label={file ? `Preview of ${file.filename}` : "File preview"}
          onKeyDown={handleKeyDown}
          className="fixed top-1/2 left-1/2 z-50 flex h-[85vh] w-[min(80vw,1280px)] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          {file ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title className="truncate font-heading text-sm font-medium text-foreground">
                    {file.filename}
                  </DialogPrimitive.Title>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      fileKindLabel(file.contentType, file.filename),
                      formatBytes(file.size),
                      file.meta,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                {files.length > 1 ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Previous file"
                      onClick={() => step(-1)}
                    >
                      <RiArrowLeftSLine aria-hidden />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {index + 1} of {files.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Next file"
                      onClick={() => step(1)}
                    >
                      <RiArrowRightSLine aria-hidden />
                    </Button>
                  </div>
                ) : null}

                {file.url ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={downloading}
                    onClick={() => void handleDownload()}
                  >
                    <RiDownload2Line aria-hidden />
                    {downloading ? "Downloading…" : "Download"}
                  </Button>
                ) : null}

                <DialogPrimitive.Close
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                    />
                  }
                >
                  <RiCloseLine aria-hidden />
                  <span className="sr-only">Close preview</span>
                </DialogPrimitive.Close>
              </header>

              {/* Keyed by file id so switching files never shows the previous
                  document while the next one loads. */}
              <div className="min-h-0 flex-1" key={file.id}>
                <PreviewBody file={file} />
              </div>
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

function PreviewBody({ file }: { file: PreviewFile }) {
  const kind = previewKind(file)
  const url = file.url
  // The asset itself failed to load (corrupt bytes, expired URL) — never a
  // silent white void; fall through to the honest card instead.
  const [loadFailed, setLoadFailed] = useState(false)

  if (loadFailed) {
    return (
      <NoPreview
        file={file}
        message="The preview couldn't load — the file may be corrupt. Download it to have a look."
      />
    )
  }

  if (url && kind === "image") {
    return (
      // Checkerboard backdrop + a ring on the image itself, so a white or
      // transparent image always reads as an image with edges — not a blank
      // dialog (Marko hit exactly that with a solid-white fixture).
      <div
        className="flex h-full items-center justify-center overflow-hidden p-6"
        style={{
          backgroundColor: "var(--muted)",
          backgroundImage:
            "conic-gradient(rgba(0,0,0,0.06) 25%, transparent 0 50%, rgba(0,0,0,0.06) 0 75%, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      >
        <img
          src={url}
          alt={file.filename}
          onError={() => setLoadFailed(true)}
          className="max-h-full max-w-full rounded-sm object-contain shadow-md ring-1 ring-black/10"
        />
      </div>
    )
  }

  if (url && kind === "pdf") {
    return (
      <iframe
        src={url}
        title={file.filename}
        onError={() => setLoadFailed(true)}
        className="h-full w-full border-0 bg-muted/40"
      />
    )
  }

  if (url && kind === "video") {
    return (
      <div className="flex h-full items-center justify-center bg-black/90 p-4">
        <video
          src={url}
          controls
          onError={() => setLoadFailed(true)}
          className="max-h-full max-w-full"
        />
      </div>
    )
  }

  if (url && kind === "audio") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <audio
          src={url}
          controls
          onError={() => setLoadFailed(true)}
          className="w-full max-w-lg"
        />
      </div>
    )
  }

  if (url && kind === "text") {
    return <TextPreview url={url} />
  }

  return <NoPreview file={file} />
}

/**
 * Small text files (bios, CSVs, notes) fetched and shown as-is. Capped at
 * 1 MB — beyond that the preview says so and the Download button is the tool.
 */
function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; text: string; truncated: boolean }
  >({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error("not ok")
        const blob = await response.blob()
        const truncated = blob.size > TEXT_PREVIEW_CAP
        const text = await blob.slice(0, TEXT_PREVIEW_CAP).text()
        if (!cancelled) setState({ status: "ready", text, truncated })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (state.status === "loading") {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </p>
    )
  }
  if (state.status === "error") {
    return (
      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
        The file couldn't be read — try the Download button instead.
      </p>
    )
  }
  return (
    <div className="h-full overflow-auto bg-muted/30">
      <pre className="min-h-full p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {state.text}
        {state.truncated ? "\n\n… preview capped at 1 MB — download the file for the rest." : ""}
      </pre>
    </div>
  )
}

function NoPreview({
  file,
  message,
}: {
  file: PreviewFile
  message?: string
}) {
  const Icon = fileIcon(file.contentType, file.filename)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!file.url) return
    setDownloading(true)
    try {
      await downloadFile(file.url, file.filename)
    } catch {
      toast.error(`We couldn't download ${file.filename}.`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-xl border border-border bg-muted/50",
        )}
      >
        <Icon className="size-6 text-muted-foreground" />
      </span>
      <div>
        <p className="max-w-md truncate text-sm font-medium text-foreground">
          {file.filename}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[
            fileKindLabel(file.contentType, file.filename),
            formatBytes(file.size),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">
        {message ??
          (file.url
            ? "This file type doesn't preview in the browser — download it to have a look."
            : "The stored file is missing, so there is nothing to preview or download.")}
      </p>
      {file.url ? (
        <Button size="sm" disabled={downloading} onClick={() => void handleDownload()}>
          <RiDownload2Line aria-hidden />
          {downloading ? "Downloading…" : "Download"}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * True when a click landed on something that already means something — a
 * button, link, form control, or a region opted out with `data-no-preview`.
 * Rows use this so checkboxes, downloads and comment threads keep their own
 * click without the preview swallowing it.
 */
export function isPreviewExemptClick(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "a,button,input,textarea,select,label,[data-no-preview]",
    ) !== null
  )
}

import { useState } from "react"
import { RiAlertLine, RiDownload2Line, RiFileCopy2Line } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/shared/status-pill"
import {
  downloadFile,
  fileIcon,
  fileKindLabel,
  formatBytes,
} from "@/lib/files"

/**
 * One uploaded file, rendered the same way everywhere it appears — speaker
 * portal, organizer drawer, content review.
 *
 * Shows what the `_storage` system table actually knows about the blob (real
 * size and MIME type, not what the browser claimed at upload time), an image
 * thumbnail when it is one, its version and approval state, and a download
 * that saves under the real filename instead of opening a signed URL in a tab.
 */

/** Exactly the shape `convex/lib/files.ts` → `enrichUploads` returns. */
export interface StoredFile {
  id: string
  filename: string
  contentType?: string
  size?: number
  sha256?: string
  version: number
  approvalStatus: string
  reviewNote?: string
  uploadedAt: number
  url: string | null
  isImage: boolean
  missing: boolean
  duplicateOfVersion: number | null
}

export function approvalMeta(status: string): { label: string; status: string } {
  if (status === "approved") return { label: "Approved", status: "accepted" }
  if (status === "changes_requested") {
    return { label: "Changes requested", status: "declined" }
  }
  return { label: "Awaiting review", status: "pending" }
}

export interface FileRowProps {
  file: StoredFile
  /** Extra buttons (review, delete) rendered after the download button. */
  actions?: React.ReactNode
  /** Hide the approval pill where it adds nothing (event branding). */
  showStatus?: boolean
  /** Extra line under the filename — speaker name, submission title. */
  meta?: React.ReactNode
  className?: string
}

export function FileRow({
  file,
  actions,
  showStatus = true,
  meta,
  className,
}: FileRowProps) {
  const [downloading, setDownloading] = useState(false)
  const Icon = fileIcon(file.contentType, file.filename)
  const status = approvalMeta(file.approvalStatus)
  const size = formatBytes(file.size)
  const kind = fileKindLabel(file.contentType, file.filename)

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
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5",
        className,
      )}
    >
      {/* Thumbnail for images, a typed icon for everything else. */}
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/50"
      >
        {file.isImage && file.url ? (
          <img
            src={file.url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <Icon className="size-4 text-muted-foreground" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {file.filename}
        </p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>Version {file.version}</span>
          <span aria-hidden>·</span>
          <span>{kind}</span>
          {size ? (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{size}</span>
            </>
          ) : null}
          {file.duplicateOfVersion !== null ? (
            <span
              className="inline-flex items-center gap-1 text-status-amber-fg"
              title={`Byte-for-byte the same file as version ${file.duplicateOfVersion} — matching SHA-256 checksum.`}
            >
              <RiFileCopy2Line size={12} aria-hidden />
              identical to v{file.duplicateOfVersion}
            </span>
          ) : null}
          {file.missing ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <RiAlertLine size={12} aria-hidden />
              file missing
            </span>
          ) : null}
        </p>
        {meta ? (
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>

      {/* Status and actions travel together so they never split across lines
          in a narrow container like the submission drawer. */}
      <span className="flex shrink-0 items-center gap-1">
        {showStatus ? (
          <StatusPill status={status.status} label={status.label} size="sm" />
        ) : null}
        {file.url ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${file.filename}`}
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            <RiDownload2Line aria-hidden />
          </Button>
        ) : null}
        {actions}
      </span>
    </li>
  )
}

export function FileList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul
      className={cn(
        "divide-y divide-border rounded-lg border border-border bg-background",
        className,
      )}
    >
      {children}
    </ul>
  )
}

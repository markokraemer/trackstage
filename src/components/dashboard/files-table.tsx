import { useState } from "react"
import { Link } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"
import { RiCheckLine, RiDownload2Line, RiFileCopy2Line } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusPill } from "@/components/shared/status-pill"
import { approvalMeta } from "@/components/shared/file-row"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"
import { relativeTime } from "@/components/dashboard/format"
import {
  downloadFile,
  fileIcon,
  fileKindLabel,
  formatBytes,
} from "@/lib/files"

/** Exactly one row of `convex/tasksAdmin.ts` → `listUploads`. */
export type FileLibraryRow = FunctionReturnType<
  typeof api.tasksAdmin.listUploads
>[number]

export interface FilesTableProps {
  rows: Array<FileLibraryRow>
  /** Approve a file in place — the same mutation the submission drawer uses. */
  onApprove?: (row: FileLibraryRow) => void
  className?: string
}

/**
 * The files library (docs/reference/sbek-rubric.md CNT-04/05/13): every file
 * any speaker has uploaded to this event, in one place, with the speaker and
 * session it belongs to and its approval state.
 *
 * Built on the shadcn `Table` primitive inside a `Card`, and it reuses the
 * shared file vocabulary (`src/lib/files.ts` icons/labels, `approvalMeta` from
 * `file-row.tsx`) so a file reads identically here, in the speaker portal and
 * in the submission drawer.
 */
export function FilesTable({ rows, onApprove, className }: FilesTableProps) {
  return (
    <Card className={cn("overflow-x-auto p-0 py-0", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead>Speaker</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="w-20">Version</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead className="w-24 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <FileTableRow key={row.id} row={row} onApprove={onApprove} />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function FileTableRow({
  row,
  onApprove,
}: {
  row: FileLibraryRow
  onApprove?: (row: FileLibraryRow) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const { eventRef } = useCurrentEvent()
  const speakersLink = eventRef
    ? appLink.speakers(eventRef)
    : legacyAppLink.speakers
  const submissionsLink = eventRef
    ? appLink.submissions(eventRef)
    : legacyAppLink.submissions
  const Icon = fileIcon(row.contentType, row.filename)
  const approval = approvalMeta(row.approvalStatus)
  const size = formatBytes(row.size)

  async function handleDownload() {
    if (!row.url) return
    setDownloading(true)
    try {
      await downloadFile(row.url, row.filename)
    } catch {
      toast.error(`We couldn't download ${row.filename}.`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/50"
          >
            {row.isImage && row.url ? (
              <img
                src={row.url}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <Icon className="size-4 text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0">
            <p className="max-w-[280px] truncate font-medium text-foreground">
              {row.filename}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{fileKindLabel(row.contentType, row.filename)}</span>
              {size ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{size}</span>
                </>
              ) : null}
              {row.duplicateOfVersion !== null ? (
                <span
                  className="inline-flex items-center gap-1 text-status-amber-fg"
                  title={`Byte-for-byte the same file as version ${row.duplicateOfVersion}.`}
                >
                  <RiFileCopy2Line size={12} aria-hidden />
                  same as v{row.duplicateOfVersion}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </TableCell>

      <TableCell>
        {row.person ? (
          <Link
            to={speakersLink as never}
            search={{ person: String(row.person.id) } as never}
            className="block max-w-[180px] truncate font-medium text-foreground hover:underline"
          >
            {row.person.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        {row.submissionId && row.submissionTitle ? (
          <Link
            to={submissionsLink as never}
            search={{ id: String(row.submissionId) } as never}
            className="block max-w-[220px] truncate text-foreground hover:underline"
          >
            {row.submissionTitle}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {row.task ? (
          <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
            {row.task.title}
          </span>
        ) : null}
      </TableCell>

      <TableCell className="text-muted-foreground">
        <span title={new Date(row.uploadedAt).toLocaleString()}>
          {relativeTime(row.uploadedAt)}
        </span>
      </TableCell>

      <TableCell className="tabular-nums text-muted-foreground">
        v{row.version}
      </TableCell>

      <TableCell>
        <StatusPill status={approval.status} label={approval.label} />
        {row.reviewNote ? (
          <span className="mt-0.5 block max-w-[200px] truncate text-xs text-muted-foreground">
            “{row.reviewNote}”
          </span>
        ) : null}
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {onApprove && row.approvalStatus !== "approved" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Approve ${row.filename}`}
              onClick={() => onApprove(row)}
            >
              <RiCheckLine aria-hidden />
            </Button>
          ) : null}
          {row.url ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${row.filename}`}
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <RiDownload2Line aria-hidden />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function FilesTableSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full rounded-lg" />
      ))}
    </Card>
  )
}

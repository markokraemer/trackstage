import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiFolder3Line,
  RiFolderDownloadLine,
  RiSettings3Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import {
  FilesTable,
  FilesTableSkeleton,
} from "@/components/dashboard/files-table"
import type { FileLibraryRow } from "@/components/dashboard/files-table"
import { FilePreviewDialog } from "@/components/shared/file-preview-dialog"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"
import { downloadFilesBundle } from "@/lib/files"
import { errorMessage } from "@/lib/errors"

/**
 * `/app/files` — the event's file library (docs/reference/sbek-rubric.md
 * CNT-04/05/07/13).
 *
 * Every file a speaker has uploaded, in one list, with who sent it, which
 * session it belongs to, when it landed and whether it has been reviewed. It
 * is the answer to "did the slides ever arrive?" — which, before this screen
 * existed, could only be answered by opening speakers one at a time.
 *
 * Reactive: a file uploaded in a speaker portal appears here without a reload.
 */
export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/files/")({
  component: FilesPage,
})

const ANY_STATUS = "all"
const ANY_KIND = "all"

const STATUS_OPTIONS = [
  { value: ANY_STATUS, label: "Any approval" },
  { value: "pending", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "changes_requested", label: "Changes requested" },
]

/** What the speaker was asked for — the task the file came in against. */
const KIND_OPTIONS = [
  { value: ANY_KIND, label: "Any request" },
  { value: "upload", label: "File requests" },
  { value: "headshot", label: "Headshots" },
  { value: "confirm", label: "Confirmations" },
  { value: "profile", label: "Profile tasks" },
  { value: "none", label: "Not from a task" },
]

function FilesPage() {
  const { event, eventRef, isEmpty } = useCurrentEvent()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>(ANY_STATUS)
  const [kind, setKind] = useState<string>(ANY_KIND)
  const [bundling, setBundling] = useState(false)
  /** Ticked files, by upload id — what "Download N selected" bundles. */
  const [selected, setSelected] = useState<Array<string>>([])
  /** File open in the preview dialog — click a row and it opens right here. */
  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data: rows } = useQuery(
    convexQuery(
      api.tasksAdmin.listUploads,
      event ? { eventId: event._id } : "skip",
    ),
  )
  const reviewUpload = useConvexMutation(api.tasksAdmin.reviewUpload)

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (rows ?? []).filter((row) => {
      if (status !== ANY_STATUS && row.approvalStatus !== status) return false
      if (kind === "none" && row.task) return false
      if (kind !== ANY_KIND && kind !== "none" && row.task?.kind !== kind) {
        return false
      }
      if (!term) return true
      return (
        row.filename.toLowerCase().includes(term) ||
        (row.person?.name ?? "").toLowerCase().includes(term) ||
        (row.person?.email ?? "").toLowerCase().includes(term) ||
        (row.submissionTitle ?? "").toLowerCase().includes(term) ||
        (row.task?.title ?? "").toLowerCase().includes(term)
      )
    })
  }, [rows, search, status, kind])

  const awaiting = useMemo(
    () => (rows ?? []).filter((row) => row.approvalStatus === "pending").length,
    [rows],
  )

  async function approve(row: FileLibraryRow) {
    try {
      await reviewUpload({ uploadId: row.id, approvalStatus: "approved" })
      toast.success(`${row.filename} approved.`)
    } catch (error) {
      toast.error("Couldn't approve that file", {
        description:
          errorMessage(error, "Please try again."),
      })
    }
  }

  /**
   * The bundle is whatever you have said you want: the files you ticked, or —
   * when you have ticked nothing — exactly what the filters are showing. One
   * button, and it names its own scope, so "Download all" can never quietly
   * mean something broader than the screen in front of you.
   */
  const chosen = useMemo(
    () =>
      selected.length > 0
        ? visible.filter((row) => selected.includes(row.id))
        : visible,
    [visible, selected],
  )

  async function downloadAll() {
    if (chosen.length === 0) return
    setBundling(true)
    try {
      const result = await downloadFilesBundle(
        chosen.map((row) => ({ url: row.url, filename: row.filename })),
        `${event?.slug ?? "event"}-files.zip`,
      )
      toast.success(
        result.skipped > 0
          ? `Downloaded ${result.included} files — ${result.skipped} couldn't be read.`
          : `Downloaded ${result.included} file${result.included === 1 ? "" : "s"}.`,
      )
    } catch (error) {
      toast.error(errorMessage(error, "Could not build the bundle."))
    } finally {
      setBundling(false)
    }
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Files"
          description="Everything your speakers have uploaded, in one place."
        />
        <EmptyState
          icon={RiSettings3Line}
          title="Create your event first"
          description="Files appear here once you've set up an event and your speakers start uploading."
          action={
            <Link
              to={eventRef ? appLink.settings(eventRef) : legacyAppLink.settings}
              className={buttonVariants()}
            >
              Go to settings
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Files"
        description={
          awaiting > 0
            ? `Everything your speakers have uploaded. ${awaiting} file${awaiting === 1 ? "" : "s"} waiting for review.`
            : "Everything your speakers have uploaded — slides, headshots and signed forms."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selected.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={bundling || chosen.length === 0}
              onClick={() => void downloadAll()}
            >
              <RiFolderDownloadLine aria-hidden />
              {bundling
                ? "Preparing…"
                : selected.length > 0
                  ? `Download ${selected.length} selected`
                  : "Download all"}
            </Button>
          </div>
        }
      />

      <DataToolbar
        value={search}
        onValueChange={setSearch}
        placeholder="Search by file, speaker or session…"
        searchLabel="Search files"
        filters={
          <>
            <Select
              items={STATUS_OPTIONS}
              value={status}
              onValueChange={(value) => setStatus(String(value))}
            >
              <SelectTrigger
                size="sm"
                aria-label="Filter by approval status"
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              items={KIND_OPTIONS}
              value={kind}
              onValueChange={(value) => setKind(String(value))}
            >
              <SelectTrigger
                size="sm"
                aria-label="Filter by what was requested"
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {rows === undefined ? (
        <FilesTableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RiFolder3Line}
          title="No files yet"
          description="Slides, headshots and anything else your speakers upload land here — with the session they belong to and whether you've approved them. Assign a speaker an upload task to ask for one."
          action={
            <Link
              to={eventRef ? appLink.speakers(eventRef) : legacyAppLink.speakers}
              className={buttonVariants()}
            >
              Go to speakers
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={RiFolder3Line}
          title="No file matches this view"
          description="Try a different search term, or clear the filters to see every file again."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("")
                setStatus(ANY_STATUS)
                setKind(ANY_KIND)
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <FilesTable
          rows={visible}
          onApprove={(row) => void approve(row)}
          onPreview={(row) => setPreviewId(row.id)}
          selectedIds={selected}
          onSelectedChange={setSelected}
        />
      )}

      {/* Arrow keys walk through exactly what the filters are showing. */}
      <FilePreviewDialog
        files={visible.map((row) => ({
          id: row.id,
          filename: row.filename,
          contentType: row.contentType,
          size: row.size,
          url: row.url,
          meta: [row.person?.name, row.submissionTitle]
            .filter(Boolean)
            .join(" · "),
        }))}
        openId={previewId}
        onOpenChange={setPreviewId}
      />
    </div>
  )
}

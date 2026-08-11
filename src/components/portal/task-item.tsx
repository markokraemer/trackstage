import { useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import { RiAlertLine, RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { FileList, FileRow } from "@/components/shared/file-row"
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/files"
import { usePortal } from "./portal-context"
import type { PortalTask, PortalUpload } from "./portal-context"
import { usePortalUpload } from "./use-portal-upload"
import { TASK_KIND_LABEL, dueInfo, formatDate } from "./portal-utils"

export interface TaskItemProps {
  task: PortalTask
  /** Every upload recorded against this task, newest version first. */
  uploads: Array<PortalUpload>
}

/**
 * One task in the speaker checklist (docs/SPEC.md §4.7). Three shapes:
 * confirm (a button), headshot/upload (a file), and anything else (guidance).
 * Uploaded files stay visible with their approval status, and a "changes
 * requested" note tells the speaker exactly what to fix.
 */
export function TaskItem({ task, uploads }: TaskItemProps) {
  const { portalToken } = usePortal()
  const completeTask = useConvexMutation(api.portal.completeTask)
  const { upload } = usePortalUpload()
  const [isCompleting, setIsCompleting] = useState(false)

  const done = Boolean(task.completedAt)
  const due = dueInfo(task.dueAt)
  const isFileTask = task.kind === "upload" || task.kind === "headshot"
  const canConfirm = task.kind === "confirm" || task.kind === "profile"
  const latest: PortalUpload | undefined = uploads.length > 0 ? uploads[0] : undefined
  const needsChanges = latest?.approvalStatus === "changes_requested"

  async function handleComplete() {
    setIsCompleting(true)
    try {
      await completeTask({ portalToken, taskId: task.id })
      toast.success("Marked as complete.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't complete that task.",
      )
    } finally {
      setIsCompleting(false)
    }
  }

  async function handleUpload(
    file: File,
    onProgress: (percent: number) => void,
  ) {
    await upload(
      file,
      {
        taskId: task.id,
        isHeadshot: task.kind === "headshot" ? true : undefined,
      },
      onProgress,
    )
    toast.success(
      uploads.length > 0
        ? "New version uploaded — the organizers will review it."
        : "Uploaded. The organizers will review it.",
    )
  }

  return (
    <li className="flex gap-3 px-4 py-4">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          done
            ? "bg-status-green-bg text-status-green-fg"
            : needsChanges
              ? "bg-status-red-bg text-status-red-fg"
              : "border border-dashed border-muted-foreground/50",
        )}
      >
        {done ? <RiCheckLine size={13} /> : null}
        {!done && needsChanges ? <RiAlertLine size={12} /> : null}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p
            className={cn(
              "text-sm font-medium text-foreground",
              done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </p>
          <span className="text-xs text-muted-foreground">
            {TASK_KIND_LABEL[task.kind] ?? "Task"}
          </span>
          {done ? (
            <span className="text-xs font-medium text-status-green-fg">
              Completed{task.completedAt ? ` ${formatDate(task.completedAt)}` : ""}
            </span>
          ) : due ? (
            <span
              className={cn(
                "text-xs font-medium",
                due.tone === "overdue"
                  ? "text-destructive"
                  : due.tone === "soon"
                    ? "text-status-amber-fg"
                    : "text-muted-foreground",
              )}
            >
              {due.label}
            </span>
          ) : null}
        </div>

        {task.instructions ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {task.instructions}
          </p>
        ) : null}

        {needsChanges && latest.reviewNote ? (
          <Alert variant="destructive" className="mt-3">
            <RiAlertLine aria-hidden />
            <AlertTitle>The organizers asked for changes</AlertTitle>
            <AlertDescription>{latest.reviewNote}</AlertDescription>
          </Alert>
        ) : null}

        {uploads.length > 0 ? (
          <FileList className="mt-3">
            {uploads.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                meta={`Uploaded ${formatDate(file.uploadedAt)}`}
              />
            ))}
          </FileList>
        ) : null}

        {isFileTask ? (
          <FileDropZone
            size="sm"
            className="mt-3"
            imagesOnly={task.kind === "headshot"}
            maxBytes={
              task.kind === "headshot" ? MAX_IMAGE_BYTES : MAX_UPLOAD_BYTES
            }
            label={
              uploads.length > 0
                ? "Drop a new version here, or click to choose one"
                : task.kind === "headshot"
                  ? "Drop your headshot here, or click to choose one"
                  : "Drop your file here, or click to choose one"
            }
            onUpload={handleUpload}
            onError={(message) => toast.error(message)}
          />
        ) : null}

        {!done && (canConfirm || !isFileTask) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canConfirm ? (
              <Button size="sm" disabled={isCompleting} onClick={handleComplete}>
                <RiCheckLine aria-hidden />
                {isCompleting ? "Saving…" : "Mark complete"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                The organizers will tick this off once they've received your
                response.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </li>
  )
}

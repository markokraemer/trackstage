import { useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import {
  RiAlertLine,
  RiCheckLine,
  RiDownload2Line,
  RiUpload2Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/shared/status-pill"
import { usePortal } from "./portal-context"
import type { PortalTask, PortalUpload } from "./portal-context"
import { usePortalUpload } from "./use-portal-upload"
import {
  TASK_KIND_LABEL,
  dueInfo,
  formatBytes,
  formatDate,
  uploadStatusMeta,
} from "./portal-utils"

const MAX_BYTES = 25 * 1024 * 1024

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
  const { upload, isUploading } = usePortalUpload()
  const inputRef = useRef<HTMLInputElement>(null)
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

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error("That file is larger than 25 MB. Please upload a smaller one.")
      return
    }
    try {
      await upload(file, {
        taskId: task.id,
        isHeadshot: task.kind === "headshot" ? true : undefined,
      })
      toast.success(
        uploads.length > 0
          ? "New version uploaded — the organizers will review it."
          : "Uploaded. The organizers will review it.",
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We couldn't upload that file.",
      )
    }
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
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {uploads.map((file) => {
              const meta = uploadStatusMeta(file.approvalStatus)
              const size = formatBytes(file.size)
              return (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version {file.version}
                      {size ? ` · ${size}` : ""} ·{" "}
                      {formatDate(file.uploadedAt)}
                    </p>
                  </div>
                  <StatusPill
                    status={meta.status}
                    label={meta.label}
                    size="sm"
                  />
                  {file.url ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${file.filename}`}
                      nativeButton={false}
                      render={
                        <a href={file.url} target="_blank" rel="noreferrer" />
                      }
                    >
                      <RiDownload2Line aria-hidden />
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isFileTask ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept={task.kind === "headshot" ? "image/*" : undefined}
                className="sr-only"
                aria-label={`Choose a file for ${task.title}`}
                onChange={handleFile}
              />
              <Button
                variant={done && !needsChanges ? "outline" : "default"}
                size="sm"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
              >
                <RiUpload2Line aria-hidden />
                {isUploading
                  ? "Uploading…"
                  : uploads.length > 0
                    ? "Upload a new version"
                    : task.kind === "headshot"
                      ? "Upload my headshot"
                      : "Upload a file"}
              </Button>
            </>
          ) : null}

          {canConfirm && !done ? (
            <Button size="sm" disabled={isCompleting} onClick={handleComplete}>
              <RiCheckLine aria-hidden />
              {isCompleting ? "Saving…" : "Mark complete"}
            </Button>
          ) : null}

          {!isFileTask && !canConfirm && !done ? (
            <p className="text-sm text-muted-foreground">
              The organizers will tick this off once they've received your
              response.
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

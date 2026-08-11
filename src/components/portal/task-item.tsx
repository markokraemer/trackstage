import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"
import {
  RiAlertLine,
  RiChat1Line,
  RiCheckLine,
  RiLockLine,
  RiUpload2Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { FileComments } from "@/components/shared/file-comments"
import { FileList, FileRow } from "@/components/shared/file-row"
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/files"
import { DueChip } from "./due-chip"
import { usePortal } from "./portal-context"
import type { PortalTask, PortalUpload } from "./portal-context"
import { usePortalUpload } from "./use-portal-upload"
import { TASK_KIND_LABEL, formatDate } from "./portal-utils"

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
  // Optimistic (docs/memory/RULES.md #26): ticking a task moves the row, the
  // counters and the tab badge on the same frame as the tap. The server
  // confirms a moment later; if it refuses, Convex rolls the local value back
  // and the toast explains why.
  const completeTask = useConvexMutation(
    api.portal.completeTask,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.portal.home, { portalToken })
    if (!current) return
    localStore.setQuery(
      api.portal.home,
      { portalToken },
      {
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === args.taskId ? { ...t, completedAt: Date.now() } : t,
        ),
      },
    )
  })
  const { upload } = usePortalUpload()
  const [isCompleting, setIsCompleting] = useState(false)
  const [showReplace, setShowReplace] = useState(false)

  const done = Boolean(task.completedAt)
  // Past due AND the organizer doesn't accept late work (Settings → Event
  // details → Speaker portal). The task stays on the list — you should see
  // what you missed — but nothing on it can be actioned.
  const locked = task.locked
  const isFileTask = (task.kind === "upload" || task.kind === "headshot") && !locked
  const canConfirm =
    (task.kind === "confirm" || task.kind === "profile") && !locked
  const latest: PortalUpload | undefined = uploads.length > 0 ? uploads[0] : undefined
  const needsChanges = latest?.approvalStatus === "changes_requested"
  // A finished file task keeps its drop zone folded away: the file is the
  // answer, and a big dashed rectangle under a ticked-off task reads as
  // unfinished work. One tap unfolds it to send a new version.
  const showDropZone = isFileTask && (!done || showReplace || needsChanges)

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
        // A task the organizer bound to one of my sessions files the upload
        // against that session too, so it shows up on their session Files tab
        // instead of only inside the task.
        submissionId: task.submissionId ?? undefined,
        isHeadshot: task.kind === "headshot" ? true : undefined,
      },
      onProgress,
    )
    setShowReplace(false)
    toast.success(
      uploads.length > 0
        ? "New version uploaded — the organizers will review it."
        : "Uploaded. The organizers will review it.",
    )
  }

  return (
    <li className="flex gap-3 px-6 py-4">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          done
            ? "bg-status-green-bg text-status-green-fg"
            : needsChanges
              ? "bg-status-red-bg text-status-red-fg"
              : locked
                ? "bg-muted text-muted-foreground"
                : "border border-dashed border-muted-foreground/50",
        )}
      >
        {done ? <RiCheckLine size={13} /> : null}
        {!done && needsChanges ? <RiAlertLine size={12} /> : null}
        {!done && !needsChanges && locked ? <RiLockLine size={11} /> : null}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
          ) : (
            <DueChip dueAt={task.dueAt} locked={locked} />
          )}
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
              >
                <SpeakerFileComments uploadId={file.id} />
              </FileRow>
            ))}
          </FileList>
        ) : null}

        {showDropZone ? (
          <FileDropZone
            size="sm"
            className="mt-3"
            imagesOnly={task.kind === "headshot"}
            maxBytes={
              task.kind === "headshot" ? MAX_IMAGE_BYTES : MAX_UPLOAD_BYTES
            }
            label={
              uploads.length > 0
                ? "Drop a new version here, or tap to choose one"
                : task.kind === "headshot"
                  ? "Drop your headshot here, or tap to choose one"
                  : "Drop your file here, or tap to choose one"
            }
            onUpload={handleUpload}
            onError={(message) => toast.error(message)}
          />
        ) : isFileTask && done ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setShowReplace(true)}
          >
            <RiUpload2Line aria-hidden />
            Send a new version
          </Button>
        ) : null}

        {!done && locked ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This task closed when its due date passed. Email the organizers if
            you still need to send it — they can reopen it for you.
          </p>
        ) : !done && (canConfirm || !isFileTask) ? (
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

/**
 * The speaker's half of a file's comment thread (sbek CNT-05). Same thread the
 * organizer reads on their side — so "can you re-export slide 12?" and the
 * answer stay attached to the file instead of scattering into email.
 */
function SpeakerFileComments({ uploadId }: { uploadId: Id<"uploads"> }) {
  const { portalToken } = usePortal()
  const [open, setOpen] = useState(false)
  const { data: comments, isPending } = useQuery(
    convexQuery(api.portal.uploadComments, { portalToken, uploadId }),
  )
  const addComment = useConvexMutation(api.portal.addUploadComment)
  const count = comments?.length ?? 0

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <RiChat1Line aria-hidden />
        {count === 0
          ? open
            ? "Hide comments"
            : "Comment on this file"
          : `${count} comment${count === 1 ? "" : "s"}`}
      </Button>
      {open ? (
        <FileComments
          className="mt-2"
          viewer="speaker"
          comments={comments}
          isPending={isPending}
          placeholder="Ask the organizers a question about this file…"
          onSubmit={(body) => addComment({ portalToken, uploadId, body })}
        />
      ) : null}
    </div>
  )
}

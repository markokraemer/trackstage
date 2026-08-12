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
  RiEditLine,
  RiLockLine,
  RiSendPlaneLine,
  RiUpload2Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { FileComments } from "@/components/shared/file-comments"
import { FileList, FileRow } from "@/components/shared/file-row"
import { FilePreviewDialog } from "@/components/shared/file-preview-dialog"
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/files"
import { DueChip } from "./due-chip"
import { usePortal } from "./portal-context"
import type { PortalTask, PortalUpload } from "./portal-context"
import { usePortalUpload } from "./use-portal-upload"
import { portalHomeArgs } from "./portal-query"
import { TASK_KIND_LABEL, formatDate } from "./portal-utils"
import { errorMessage } from "@/lib/errors"

export interface TaskItemProps {
  task: PortalTask
  /** Every upload recorded against this task, newest version first. */
  uploads: Array<PortalUpload>
}

/**
 * One task in the speaker checklist (docs/SPEC.md §4.7). Four shapes:
 * confirm/profile (a button), headshot/upload (a file), answer (a question and
 * a text box — sending the reply completes it), and anything else (guidance).
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
    const queryArgs = portalHomeArgs(portalToken)
    const current = localStore.getQuery(api.portal.home, queryArgs)
    if (!current) return
    localStore.setQuery(
      api.portal.home,
      queryArgs,
      {
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === args.taskId ? { ...t, completedAt: Date.now() } : t,
        ),
      },
    )
  })
  // "Collect an answer": sending the reply IS the completion, so the mutation
  // ticks the task off and stores the words in one write. Optimistic for the
  // same reason as completeTask — the checklist must move on the same frame.
  const answerTask = useConvexMutation(
    api.portal.answerTask,
  ).withOptimisticUpdate((localStore, args) => {
    const queryArgs = portalHomeArgs(portalToken)
    const current = localStore.getQuery(api.portal.home, queryArgs)
    if (!current) return
    localStore.setQuery(
      api.portal.home,
      queryArgs,
      {
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === args.taskId
            ? {
                ...t,
                response: args.response,
                completedAt: t.completedAt ?? Date.now(),
              }
            : t,
        ),
      },
    )
  })
  const { upload } = usePortalUpload()
  const [isCompleting, setIsCompleting] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [answer, setAnswer] = useState(task.response ?? "")
  const [isEditingAnswer, setIsEditingAnswer] = useState(false)
  /** Version open in the preview dialog — tap a file to look at what you sent. */
  const [previewId, setPreviewId] = useState<string | null>(null)

  const done = Boolean(task.completedAt)
  // Past due AND the organizer doesn't accept late work (Settings → Event
  // details → Speaker portal). The task stays on the list — you should see
  // what you missed — but nothing on it can be actioned.
  const locked = task.locked
  const isFileTask = (task.kind === "upload" || task.kind === "headshot") && !locked
  const canConfirm =
    (task.kind === "confirm" || task.kind === "profile") && !locked
  const isAnswerTask = task.kind === "answer"
  // A sent answer folds down to the words themselves, with one tap to revise
  // them — the same shape as a finished file task, for the same reason.
  const showAnswerBox = isAnswerTask && !locked && (!done || isEditingAnswer)
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
      toast.error(errorMessage(error, "We couldn't complete that task."))
    } finally {
      setIsCompleting(false)
    }
  }

  async function handleAnswer(event: React.FormEvent) {
    event.preventDefault()
    if (answer.trim().length === 0) {
      toast.error("Write your answer before sending it.")
      return
    }
    setIsCompleting(true)
    try {
      await answerTask({ portalToken, taskId: task.id, response: answer.trim() })
      setIsEditingAnswer(false)
      toast.success("Answer sent — the organizers can see it.")
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't send that answer."))
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

        {/* "Collect an answer": the instructions above ARE the question, so
            the reply sits directly under them. Once sent it reads back as
            plain words — what you told them, still true — with one tap to
            revise it, because people re-read a question and think better. */}
        {isAnswerTask && task.response && !showAnswerBox ? (
          <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              Your answer
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
              {task.response}
            </p>
            {!locked ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setAnswer(task.response ?? "")
                  setIsEditingAnswer(true)
                }}
              >
                <RiEditLine aria-hidden />
                Change my answer
              </Button>
            ) : null}
          </div>
        ) : null}

        {showAnswerBox ? (
          <form className="mt-3 flex flex-col gap-2" onSubmit={handleAnswer}>
            <Textarea
              rows={3}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              aria-label={`Your answer to "${task.title}"`}
              placeholder="Type your answer…"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isCompleting || answer.trim().length === 0}
              >
                <RiSendPlaneLine aria-hidden />
                {isCompleting
                  ? "Sending…"
                  : task.response
                    ? "Save my answer"
                    : "Send my answer"}
              </Button>
              {isEditingAnswer ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isCompleting}
                  onClick={() => {
                    setAnswer(task.response ?? "")
                    setIsEditingAnswer(false)
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}

        {uploads.length > 0 ? (
          <FileList className="mt-3">
            {uploads.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                onPreview={() => setPreviewId(file.id)}
                meta={`Uploaded ${formatDate(file.uploadedAt)}`}
              >
                <SpeakerFileComments uploadId={file.id} />
              </FileRow>
            ))}
          </FileList>
        ) : null}

        <FilePreviewDialog
          files={uploads.map((file) => ({
            id: file.id,
            filename: file.filename,
            contentType: file.contentType,
            size: file.size,
            url: file.url,
            meta: `Version ${file.version} · uploaded ${formatDate(file.uploadedAt)}`,
          }))}
          openId={previewId}
          onOpenChange={setPreviewId}
        />

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
        ) : !done && !isAnswerTask && (canConfirm || !isFileTask) ? (
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

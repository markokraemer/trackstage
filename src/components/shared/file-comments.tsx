import { useState } from "react"
import { RiChat1Line, RiSendPlane2Line } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The comment thread on one uploaded file (sbek CNT-05) — the same component
 * on both sides of the product, so an organizer and a speaker are looking at
 * one conversation, not two half-copies of it.
 *
 * Presentational on purpose: the organizer view feeds it
 * `tasksAdmin.listUploadComments` and the portal feeds it
 * `portal.uploadComments`, and neither has to reimplement the layout.
 */

export interface FileComment {
  id: string
  authorType: string
  authorLabel: string
  body: string
  createdAt: number
}

export interface FileCommentsProps {
  comments: Array<FileComment> | undefined
  /** Which side is writing — decides the "You" label and the alignment. */
  viewer: "organizer" | "speaker"
  onSubmit: (body: string) => Promise<unknown>
  /** Still loading the thread. */
  isPending?: boolean
  /** Placeholder for the composer. */
  placeholder?: string
  className?: string
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function FileComments({
  comments,
  viewer,
  onSubmit,
  isPending,
  placeholder = "Add a comment…",
  className,
}: FileCommentsProps) {
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const value = body.trim()
    if (!value || sending) return
    setSending(true)
    try {
      await onSubmit(value)
      setBody("")
    } catch (error) {
      toast.error("Couldn't post that comment", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {isPending ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : comments && comments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => {
            const mine = comment.authorType === viewer
            return (
              <li
                key={comment.id}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  mine
                    ? "border-primary/25 bg-primary/5"
                    : "border-border bg-muted/40",
                )}
              >
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-medium text-foreground">
                    {mine ? "You" : comment.authorLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {comment.authorType === "organizer" ? "Organizer" : "Speaker"}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {timeLabel(comment.createdAt)}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {comment.body}
                </p>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RiChat1Line size={13} aria-hidden />
          No comments yet — anything you write here is visible to{" "}
          {viewer === "organizer" ? "the speaker" : "the organizers"}.
        </p>
      )}

      <form onSubmit={(event) => void send(event)} className="flex gap-2">
        <Textarea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          aria-label="Write a comment"
          className="min-h-16 flex-1 text-sm"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="self-end"
          disabled={sending || body.trim().length === 0}
        >
          <RiSendPlane2Line aria-hidden />
          {sending ? "Posting…" : "Post"}
        </Button>
      </form>
    </div>
  )
}

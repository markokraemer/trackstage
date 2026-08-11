import { useState } from "react"
import { RiMailSendLine, RiStackLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * The two-phase decision commit (docs/SPEC.md §4.4, docs/ux/03 synthesis).
 *
 * Staging a submission into a queue never emails anyone. This banner is the
 * second phase: it says exactly how many decisions are staged and what pressing
 * the button will do, then confirms before anything leaves the building.
 *
 * Built on the shadcn `Alert` + `AlertDialog` primitives.
 */

export type DecisionQueue = "accept_queue" | "decline_queue"

const COPY: Record<
  DecisionQueue,
  {
    action: string
    title: (n: number) => string
    body: string
    confirmTitle: (n: number) => string
    confirmBody: (n: number) => string
  }
> = {
  accept_queue: {
    action: "Send acceptances",
    title: (n) =>
      `${n} submission${n === 1 ? "" : "s"} staged — ready to accept`,
    body: "Nothing has been emailed yet. Sending marks them Accepted, emails the speakers, and creates their onboarding tasks.",
    confirmTitle: (n) => `Send ${n} acceptance${n === 1 ? "" : "s"}?`,
    confirmBody: (n) =>
      `Emails the speakers on ${n} submission${n === 1 ? "" : "s"} and creates their onboarding tasks (headshot, bio, slides). Their status changes to Accepted and they become schedulable on your agenda. This can't be undone from here.`,
  },
  decline_queue: {
    action: "Send declines",
    title: (n) =>
      `${n} submission${n === 1 ? "" : "s"} staged — ready to decline`,
    body: "Nothing has been emailed yet. Sending marks them Declined and emails the speakers using your decline template.",
    confirmTitle: (n) => `Send ${n} decline${n === 1 ? "" : "s"}?`,
    confirmBody: (n) =>
      `Emails the speakers on ${n} submission${n === 1 ? "" : "s"} using your decline template. Their status changes to Declined. This can't be undone from here.`,
  },
}

export interface QueueBannerProps {
  queue: DecisionQueue
  /** How many submissions are staged in this queue. */
  count: number
  onCommit: () => Promise<unknown>
  /** Link/button shown next to the primary action (e.g. "Review the queue"). */
  secondaryAction?: React.ReactNode
  className?: string
}

export function QueueBanner({
  queue,
  count,
  onCommit,
  secondaryAction,
  className,
}: QueueBannerProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const copy = COPY[queue]

  if (count <= 0) return null

  async function handleConfirm() {
    setBusy(true)
    try {
      await onCommit()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Alert
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-3 border-border bg-accent",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <RiStackLine
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <div className="min-w-0">
            <AlertTitle className="text-foreground">
              {copy.title(count)}
            </AlertTitle>
            <AlertDescription className="text-foreground/70">
              {copy.body}
            </AlertDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {secondaryAction}
          <Button type="button" onClick={() => setOpen(true)}>
            <RiMailSendLine aria-hidden />
            {copy.action}
          </Button>
        </div>
      </Alert>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmTitle(count)}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.confirmBody(count)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              <RiMailSendLine aria-hidden />
              {busy ? "Sending…" : copy.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

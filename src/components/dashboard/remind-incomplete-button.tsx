import { useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiMailSendLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/errors"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export interface RemindIncompleteButtonProps {
  eventId: Id<"events">
  /** How many speakers still owe something — shown in the confirmation. */
  incompleteCount?: number
  label?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  className?: string
}

/**
 * "Remind all incomplete" (docs/SPEC.md §4.9) — queues a reminder email to
 * every speaker with an open task. Sending mail is irreversible, so it asks
 * first and then reports exactly what happened.
 */
export function RemindIncompleteButton({
  eventId,
  incompleteCount,
  label = "Remind all incomplete",
  variant = "outline",
  size = "sm",
  className,
}: RemindIncompleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const remind = useConvexMutation(api.comms.remindIncompleteSpeakers)

  async function send() {
    setSending(true)
    try {
      const result = await remind({ eventId })
      setOpen(false)
      if (result.queued === 0) {
        toast.success("No reminders needed", {
          description:
            result.skipped > 0
              ? `${result.skipped} speaker${result.skipped === 1 ? " was" : "s were"} reminded recently, so nobody was emailed twice.`
              : "Every speaker is up to date on their tasks.",
        })
      } else {
        toast.success(
          `Reminder queued for ${result.queued} speaker${result.queued === 1 ? "" : "s"}`,
          {
            description:
              result.skipped > 0
                ? `${result.skipped} skipped — already reminded in the last day.`
                : "Track delivery in Communications → Outbox.",
          },
        )
      }
    } catch (error) {
      toast.error("Couldn't send the reminders", {
        description:
          errorMessage(error, "Please try again."),
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant={variant} size={size} className={className} />}
      >
        <RiMailSendLine aria-hidden />
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send a reminder email?</AlertDialogTitle>
          <AlertDialogDescription>
            {incompleteCount !== undefined && incompleteCount > 0
              ? `${incompleteCount} speaker${incompleteCount === 1 ? "" : "s"} still have open tasks. `
              : ""}
            Every speaker with an unfinished task gets one email listing what's
            left, with a link to their portal. Anyone reminded in the last day is
            skipped automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={sending} onClick={() => void send()}>
            <RiMailSendLine aria-hidden />
            {sending ? "Sending…" : "Send reminders"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

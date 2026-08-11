import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LabeledField } from "@/components/settings/labeled-field"
import { errorMessage } from "@/lib/errors"
import { clearCurrentEventId, useCurrentEventId } from "@/lib/current-event"
import type { EventSummary } from "@/lib/current-event"

/**
 * Deleting an event removes its submissions, speakers, agenda and emails
 * (`convex/events.remove` cascades). Typing the event name is the
 * confirmation, so nobody deletes the wrong conference by muscle memory.
 */
export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: {
  event: EventSummary
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful delete — navigate away if you were inside it. */
  onDeleted?: () => void
}) {
  const [typed, setTyped] = useState("")
  const currentEventId = useCurrentEventId()
  const remove = useMutation({ mutationFn: useConvexMutation(api.events.remove) })

  const matches = typed.trim() === event.name.trim()

  async function confirm(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!matches) return
    try {
      await remove.mutateAsync({ eventId: event._id })
      // Only drop the stored context if it pointed at this event.
      if (currentEventId === event._id) clearCurrentEventId()
      onOpenChange(false)
      setTyped("")
      toast.success(`“${event.name}” was deleted`)
      onDeleted?.()
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete that event."))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={confirm} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Delete “{event.name}”?</DialogTitle>
            <DialogDescription>
              Everything in this event goes with it: submissions, speakers,
              forms, evaluations, the agenda and sent-mail history. Your other
              events are not affected. There is no undo.
            </DialogDescription>
          </DialogHeader>

          <LabeledField
            label="Type the event name to confirm"
            htmlFor={`delete-event-confirm-${event._id}`}
            required
            description={event.name}
          >
            <Input
              id={`delete-event-confirm-${event._id}`}
              value={typed}
              autoComplete="off"
              placeholder={event.name}
              onChange={(changeEvent) => setTyped(changeEvent.target.value)}
            />
          </LabeledField>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete this event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

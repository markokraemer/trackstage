import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { clearCurrentEventId } from "@/lib/current-event"
import type { EventSummary } from "@/lib/current-event"
import { errorMessage } from "@/components/settings/errors"

/**
 * Danger zone — deleting an event removes its submissions, speakers, agenda
 * and emails (`convex/events.remove` cascades). Typing the event name is the
 * confirmation, so nobody deletes the wrong conference by muscle memory.
 */
export function DeleteEventCard({ event }: { event: EventSummary }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const remove = useMutation({ mutationFn: useConvexMutation(api.events.remove) })

  const matches = typed.trim() === event.name.trim()

  async function confirm(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!matches) return
    try {
      await remove.mutateAsync({ eventId: event._id })
      clearCurrentEventId()
      setOpen(false)
      toast.success(`“${event.name}” was deleted`)
      await navigate({ to: "/app/events" })
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete that event."))
    }
  }

  return (
    <Card className="border-destructive/30 ring-destructive/20">
      <CardHeader>
        <CardTitle className="text-destructive">Delete this event</CardTitle>
        <CardDescription>
          Permanently removes {event.name} along with its submissions,
          speakers, forms, agenda and email history. Your other events are not
          affected. This can't be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setTyped("")
              setOpen(true)
            }}
          >
            <RiDeleteBinLine size={16} aria-hidden />
            Delete event
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={confirm} noValidate className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Delete “{event.name}”?</DialogTitle>
              <DialogDescription>
                Everything in this event goes with it: submissions, speakers,
                forms, evaluations, the agenda and sent-mail history. There is
                no undo.
              </DialogDescription>
            </DialogHeader>

            <LabeledField
              label="Type the event name to confirm"
              htmlFor="delete-event-confirm"
              required
              description={event.name}
            >
              <Input
                id="delete-event-confirm"
                value={typed}
                autoComplete="off"
                placeholder={event.name}
                onChange={(e) => setTyped(e.target.value)}
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
    </Card>
  )
}

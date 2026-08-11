import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { RiDeleteBinLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeleteEventDialog } from "@/components/settings/delete-event-dialog"
import type { EventSummary } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"

/**
 * Danger zone for the event in context. The confirmation (type the event
 * name) lives in `DeleteEventDialog`, shared with the Events list.
 */
export function DeleteEventCard({ event }: { event: EventSummary }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

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
            onClick={() => setOpen(true)}
          >
            <RiDeleteBinLine size={16} aria-hidden />
            Delete event
          </Button>
        </div>
      </CardContent>

      <DeleteEventDialog
        event={event}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => {
          void navigate({ to: appLink.events })
        }}
      />
    </Card>
  )
}

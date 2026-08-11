/**
 * Auto-place — one click that fills the first free slot for every session
 * still sitting in the tray (sbek AIA-08).
 *
 * It is deliberately explainable, not magic: the dialog states exactly what
 * the pass will do before it runs, and nothing already on the grid is moved.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { toast } from "sonner"
import { RiMagicLine } from "@remixicon/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
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
import { messageOf } from "./use-agenda-actions"
import { formatMinutes, zonedOffsetHours } from "./agenda-time"

/** Day window the pass fills, in event-local time. */
const DAY_START_HOUR = 9
const DAY_END_HOUR = 18
const DURATION_MINUTES = 45
const GAP_MINUTES = 15

export interface AutoPlaceDialogProps {
  eventId: string
  timeZone: string
  /** Anchor used to resolve the event's UTC offset (DST-correct). */
  anchorTs: number
  pendingCount: number
  hasRooms: boolean
}

export function AutoPlaceDialog({
  eventId,
  timeZone,
  anchorTs,
  pendingCount,
  hasRooms,
}: AutoPlaceDialogProps) {
  const autoPlace = useConvexMutation(api.agenda.autoPlace)
  const [open, setOpen] = React.useState(false)
  const [running, setRunning] = React.useState(false)

  // `agenda.autoPlace` builds its slots with `setUTCHours`, so we hand it the
  // UTC hours that correspond to 9:00–18:00 in the event's own timezone.
  const offsetHours = zonedOffsetHours(anchorTs, timeZone)
  const dayStartHour = DAY_START_HOUR - offsetHours
  const dayEndHour = DAY_END_HOUR - offsetHours

  async function run() {
    setRunning(true)
    try {
      const result = await autoPlace({
        eventId: eventId as Id<"events">,
        dayStartHour,
        dayEndHour,
        defaultDurationMinutes: DURATION_MINUTES,
        gapMinutes: GAP_MINUTES,
      })
      setOpen(false)
      if (result.placed === 0) {
        toast("Nothing could be placed", {
          description:
            "Every free slot is already taken, or the remaining speakers are busy at those times. Try adding a room or widening the event dates.",
        })
      } else {
        toast.success(
          `Placed ${result.placed} session${result.placed === 1 ? "" : "s"}`,
          {
            description:
              result.remaining > 0
                ? `${result.remaining} couldn't fit — place those by hand.`
                : "Everything is on the grid. Drag anything that needs moving.",
          }
        )
      }
    } catch (error) {
      toast.error("Auto-place didn't run", { description: messageOf(error) })
    } finally {
      setRunning(false)
    }
  }

  const disabled = pendingCount === 0 || !hasRooms

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="outline" disabled={disabled} />}
        title={
          disabled
            ? pendingCount === 0
              ? "Every accepted session already has a slot"
              : "Add a room first"
            : undefined
        }
      >
        <RiMagicLine aria-hidden />
        Auto-place
        {pendingCount > 0 ? ` (${pendingCount})` : ""}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Auto-place {pendingCount} unscheduled session
            {pendingCount === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Each one drops into the first free slot we can find, working through
            your event days from {formatMinutes(DAY_START_HOUR * 60)} to{" "}
            {formatMinutes(DAY_END_HOUR * 60)} ({timeZone}), {DURATION_MINUTES}{" "}
            minutes long with a {GAP_MINUTES}-minute gap between sessions.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="-mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          <li>Sessions you already placed are never moved.</li>
          <li>
            Slots that would double-book a room or a speaker are skipped
            automatically.
          </li>
          <li>
            Anything that doesn&apos;t fit stays in Not scheduled — nothing is
            lost.
          </li>
          <li>You can drag or edit every placement afterwards.</li>
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={running} onClick={() => void run()}>
            <RiMagicLine aria-hidden />
            {running
              ? "Placing…"
              : `Place ${pendingCount} session${pendingCount === 1 ? "" : "s"}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

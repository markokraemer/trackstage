/**
 * The two writes the agenda performs, wrapped once so every view reports
 * success and failure the same way (docs/SPEC.md §2.11 — mutations feel
 * instant; Convex reactivity repaints the board).
 */

import { useCallback } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { toast } from "sonner"
import type { Id } from "@convex/_generated/dataModel"
import { api } from "@convex/_generated/api"
import { formatTime } from "./agenda-time"

export interface SchedulePlacement {
  submissionId: string
  roomId: string
  startsAt: number
  durationMinutes: number
  /** Session title, for the confirmation toast. */
  title: string
  roomName?: string
  timeZone: string
}

export function useAgendaActions() {
  const scheduleSession = useConvexMutation(api.agenda.schedule)
  const unscheduleSession = useConvexMutation(api.agenda.unschedule)

  const place = useCallback(
    async (placement: SchedulePlacement) => {
      try {
        await scheduleSession({
          submissionId: placement.submissionId as Id<"submissions">,
          roomId: placement.roomId as Id<"rooms">,
          startsAt: placement.startsAt,
          durationMinutes: placement.durationMinutes,
        })
        toast.success(`"${placement.title}" scheduled`, {
          description: [
            formatTime(placement.startsAt, placement.timeZone),
            placement.roomName,
          ]
            .filter(Boolean)
            .join(" · "),
        })
        return true
      } catch (error) {
        toast.error("Couldn't move that session", {
          description: messageOf(error),
        })
        return false
      }
    },
    [scheduleSession]
  )

  const remove = useCallback(
    async (submissionId: string, title: string) => {
      try {
        await unscheduleSession({
          submissionId: submissionId as Id<"submissions">,
        })
        toast.success(`"${title}" moved back to Not scheduled`)
        return true
      } catch (error) {
        toast.error("Couldn't unschedule that session", {
          description: messageOf(error),
        })
        return false
      }
    },
    [unscheduleSession]
  )

  return { place, remove }
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    // Convex wraps thrown errors — keep only the organizer-facing sentence.
    const match = /Uncaught Error:\s*(.*?)(\n|$)/.exec(error.message)
    return (match?.[1] ?? error.message).trim()
  }
  return "Please try again."
}

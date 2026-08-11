/**
 * Every write the agenda performs, wrapped once so all six views report success
 * and failure the same way — and, more importantly, so all of them are
 * **optimistic** (docs/memory/RULES.md 26: "UI echoes immediately, server
 * confirms").
 *
 * A dropped card must be in its new slot on the same frame the organizer lets
 * go of the mouse. `useConvexMutation` is Convex's own `useMutation`, so each
 * mutation carries a `withOptimisticUpdate` that patches the `agenda.board`
 * query in the local store: the card moves, the tray count changes, and the
 * conflict badge recomputes (`computeBoardConflicts`, the same math the server
 * runs) before the request has left the tab. Convex drops the optimistic layer
 * the moment the real result lands — and rolls it back automatically if the
 * mutation throws, which is when we raise the toast.
 */

import { useCallback } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { toast } from "sonner"
import type { OptimisticLocalStore } from "convex/browser"
import type { Id } from "@convex/_generated/dataModel"
import { api } from "@convex/_generated/api"
import type { AgendaBoard } from "./agenda-model"
import { computeBoardConflicts } from "./agenda-model"
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
  /**
   * Drags, resizes and keyboard drops set this: the card visibly lands in the
   * slot, so a toast on top would only be noise. The pickers keep their
   * confirmation, because nothing else on screen moves.
   */
  silent?: boolean
}

/** Re-partition + re-derive a board after one session changed. */
function rebuild(
  board: AgendaBoard,
  next: Array<AgendaBoard["scheduled"][number]>
): AgendaBoard {
  const scheduled = next.filter((session) => session.startsAt !== undefined)
  const unscheduled = next.filter((session) => session.startsAt === undefined)
  return {
    ...board,
    scheduled,
    unscheduled,
    conflicts: computeBoardConflicts(scheduled, board.rooms),
  }
}

/** Apply `patch` to one session across every board query in the store. */
function patchSession(
  localStore: OptimisticLocalStore,
  submissionId: string,
  patch: (
    session: AgendaBoard["scheduled"][number]
  ) => AgendaBoard["scheduled"][number]
): void {
  for (const { args, value } of localStore.getAllQueries(api.agenda.board)) {
    if (!value) continue
    const board = value
    const all = [...board.scheduled, ...board.unscheduled]
    if (!all.some((session) => session.id === submissionId)) continue
    localStore.setQuery(
      api.agenda.board,
      args,
      rebuild(
        board,
        all.map((session) =>
          session.id === submissionId ? patch(session) : session
        )
      )
    )
  }
}

export function useAgendaActions() {
  const scheduleSession = useConvexMutation(
    api.agenda.schedule
  ).withOptimisticUpdate((localStore, args) => {
    patchSession(localStore, args.submissionId, (session) => ({
      ...session,
      roomId: args.roomId,
      startsAt: args.startsAt,
      durationMinutes: args.durationMinutes,
    }))
  })

  const unscheduleSession = useConvexMutation(
    api.agenda.unschedule
  ).withOptimisticUpdate((localStore, args) => {
    patchSession(localStore, args.submissionId, (session) => ({
      ...session,
      roomId: undefined,
      startsAt: undefined,
    }))
  })

  const updateDetails = useConvexMutation(
    api.submissions.updateDetails
  ).withOptimisticUpdate((localStore, args) => {
    const trackId = args.patch.trackId
    if (trackId === undefined) return
    for (const { args: queryArgs, value } of localStore.getAllQueries(
      api.agenda.board
    )) {
      if (!value) continue
      const board = value
      const all = [...board.scheduled, ...board.unscheduled]
      if (!all.some((session) => session.id === args.submissionId)) continue
      const track = trackId
        ? board.tracks.find((one) => one._id === trackId)
        : undefined
      localStore.setQuery(
        api.agenda.board,
        queryArgs,
        rebuild(
          board,
          all.map((session) =>
            session.id === args.submissionId
              ? {
                  ...session,
                  track: track
                    ? { name: track.name, color: track.color }
                    : null,
                }
              : session
          )
        )
      )
    }
  })

  const place = useCallback(
    async (placement: SchedulePlacement) => {
      try {
        await scheduleSession({
          submissionId: placement.submissionId as Id<"submissions">,
          roomId: placement.roomId as Id<"rooms">,
          startsAt: placement.startsAt,
          durationMinutes: placement.durationMinutes,
        })
        if (!placement.silent) {
          toast.success(`"${placement.title}" scheduled`, {
            description: [
              formatTime(placement.startsAt, placement.timeZone),
              placement.roomName,
            ]
              .filter(Boolean)
              .join(" · "),
          })
        }
        return true
      } catch (error) {
        // Convex has already rolled the optimistic move back — say why.
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

  /** Track view drops re-file the session — dropping in a column means it. */
  const setTrack = useCallback(
    async (submissionId: string, trackId: string | null, title: string) => {
      try {
        await updateDetails({
          submissionId: submissionId as Id<"submissions">,
          patch: { trackId: trackId ? (trackId as Id<"tracks">) : null },
        })
        return true
      } catch (error) {
        toast.error(`Couldn't move "${title}" to that track`, {
          description: messageOf(error),
        })
        return false
      }
    },
    [updateDetails]
  )

  return { place, remove, setTrack }
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    // Convex wraps thrown errors — keep only the organizer-facing sentence.
    const match = /Uncaught Error:\s*(.*?)(\n|$)/.exec(error.message)
    return (match?.[1] ?? error.message).trim()
  }
  return "Please try again."
}

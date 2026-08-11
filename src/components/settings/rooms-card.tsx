import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
  RiDoorOpenLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { errorMessage } from "@/lib/errors"

export interface RoomRecord {
  _id: string
  name: string
  capacity?: number
  order: number
}

/**
 * Rooms manager — SPEC §4.1: "Rooms & Tracks manager: inline add/rename/delete,
 * room capacity + order". Rooms become the columns of the agenda builder, so
 * order is explicit (up/down buttons: keyboard-, screen-reader- and
 * browser-agent-friendly, unlike drag-only ordering).
 */
export function RoomsCard({
  eventId,
  rooms,
}: {
  eventId: string
  rooms: Array<RoomRecord>
}) {
  const addRoom = useMutation({ mutationFn: useConvexMutation(api.roomsTracks.addRoom) })
  const updateRoom = useMutation({
    mutationFn: useConvexMutation(api.roomsTracks.updateRoom),
  })
  const deleteRoom = useMutation({
    mutationFn: useConvexMutation(api.roomsTracks.deleteRoom),
  })

  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the room a name first.")
      return
    }
    try {
      await addRoom.mutateAsync({
        eventId: eventId as Id<"events">,
        name: trimmed,
        capacity: capacity.trim() ? Number(capacity) : undefined,
      })
      setName("")
      setCapacity("")
      toast.success(`“${trimmed}” added`)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add that room."))
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const current = rooms.at(index)
    const swap = rooms.at(index + direction)
    if (!current || !swap) return
    try {
      await Promise.all([
        updateRoom.mutateAsync({
          roomId: current._id as Id<"rooms">,
          patch: { order: swap.order },
        }),
        updateRoom.mutateAsync({
          roomId: swap._id as Id<"rooms">,
          patch: { order: current.order },
        }),
      ])
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't reorder the rooms."))
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiDoorOpenLine size={18} aria-hidden className="text-primary" />
          Rooms
        </CardTitle>
        <CardDescription>
          The spaces sessions happen in. Each room becomes a column in your
          agenda, and its name appears in speaker calendar invites.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{rooms.length}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        {rooms.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiDoorOpenLine}
            title="No rooms yet"
            description="Add the rooms, stages or tracks-of-space your event uses — for example “Main Stage” or “Workshop A”. You can always add more later."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {rooms.map((room, index) => (
              <RoomRow
                key={room._id}
                room={room}
                isFirst={index === 0}
                isLast={index === rooms.length - 1}
                onMoveUp={() => void move(index, -1)}
                onMoveDown={() => void move(index, 1)}
                onRename={(value) =>
                  updateRoom.mutateAsync({
                    roomId: room._id as Id<"rooms">,
                    patch: { name: value },
                  })
                }
                onCapacity={(value) =>
                  updateRoom.mutateAsync({
                    roomId: room._id as Id<"rooms">,
                    patch: { capacity: value },
                  })
                }
                onDelete={() =>
                  deleteRoom.mutateAsync({ roomId: room._id as Id<"rooms"> })
                }
              />
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
        >
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="new-room-name" className="text-xs font-medium">
              Room name
            </Label>
            <Input
              id="new-room-name"
              value={name}
              placeholder="Main Stage"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label htmlFor="new-room-capacity" className="text-xs font-medium">
              Seats
            </Label>
            <Input
              id="new-room-capacity"
              type="number"
              min={0}
              inputMode="numeric"
              value={capacity}
              placeholder="300"
              onChange={(event) => setCapacity(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={addRoom.isPending}>
            <RiAddLine size={16} aria-hidden />
            Add room
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function RoomRow({
  room,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRename,
  onCapacity,
  onDelete,
}: {
  room: RoomRecord
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRename: (value: string) => Promise<unknown>
  onCapacity: (value: number | undefined) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  const [name, setName] = useState(room.name)
  const [capacity, setCapacity] = useState(
    room.capacity === undefined ? "" : String(room.capacity),
  )

  // Follow server updates (another organizer renaming a room, reordering, …).
  useEffect(() => setName(room.name), [room.name])
  useEffect(
    () => setCapacity(room.capacity === undefined ? "" : String(room.capacity)),
    [room.capacity],
  )

  async function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(room.name)
      return
    }
    if (trimmed === room.name) return
    try {
      await onRename(trimmed)
    } catch (error) {
      setName(room.name)
      toast.error(errorMessage(error, "Couldn't rename that room."))
    }
  }

  async function commitCapacity() {
    const next = capacity.trim() === "" ? undefined : Number(capacity)
    if (next !== undefined && (Number.isNaN(next) || next < 0)) {
      setCapacity(room.capacity === undefined ? "" : String(room.capacity))
      return
    }
    if (next === room.capacity) return
    try {
      await onCapacity(next)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't update the capacity."))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isFirst}
          aria-label={`Move ${room.name} up`}
          onClick={onMoveUp}
        >
          <RiArrowUpLine size={13} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          aria-label={`Move ${room.name} down`}
          onClick={onMoveDown}
        >
          <RiArrowDownLine size={13} aria-hidden />
        </Button>
      </div>

      <Input
        value={name}
        aria-label={`Room name (${room.name})`}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") setName(room.name)
        }}
        className="h-9 min-w-40 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus:border-input"
      />

      <Input
        type="number"
        min={0}
        inputMode="numeric"
        value={capacity}
        placeholder="Seats"
        aria-label={`Seats in ${room.name}`}
        onChange={(event) => setCapacity(event.target.value)}
        onBlur={() => void commitCapacity()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
        }}
        className="h-9 w-24 border-transparent bg-transparent shadow-none hover:border-input focus:border-input"
      />

      <ConfirmDeleteButton
        label={`Delete room ${room.name}`}
        title={`Delete “${room.name}”?`}
        description="Sessions already scheduled in this room have to be moved somewhere else first. This can't be undone."
        confirmLabel="Delete room"
        onConfirm={onDelete}
        fallbackError="Couldn't delete that room."
      >
        <RiDeleteBinLine size={15} aria-hidden />
      </ConfirmDeleteButton>
    </li>
  )
}

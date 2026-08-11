import { useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
  RiPriceTag3Line,
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
import {
  TRACK_COLORS,
  TrackColorPicker,
  nextTrackColor,
  trackColorName,
} from "@/components/settings/track-color-picker"
import { errorMessage } from "@/lib/errors"

export interface TrackRecord {
  _id: string
  name: string
  color: string
  order: number
}

/**
 * Tracks manager — SPEC §4.1. A track is the coloured single-select that
 * routes submissions and colours agenda cards, so name + colour is the whole
 * model; everything is edited inline.
 */
export function TracksCard({
  eventId,
  tracks,
}: {
  eventId: string
  tracks: Array<TrackRecord>
}) {
  const addTrack = useMutation({
    mutationFn: useConvexMutation(api.roomsTracks.addTrack),
  })
  const updateTrack = useMutation({
    mutationFn: useConvexMutation(api.roomsTracks.updateTrack),
  })
  const deleteTrack = useMutation({
    mutationFn: useConvexMutation(api.roomsTracks.deleteTrack),
  })

  const suggested = useMemo(
    () => nextTrackColor(tracks.map((track) => track.color)),
    [tracks],
  )
  const [name, setName] = useState("")
  const [color, setColor] = useState(suggested)

  // Keep the "new track" swatch on the next free colour until it's touched.
  useEffect(() => setColor(suggested), [suggested])

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the track a name first.")
      return
    }
    try {
      await addTrack.mutateAsync({
        eventId: eventId as Id<"events">,
        name: trimmed,
        color,
      })
      setName("")
      toast.success(`“${trimmed}” added`)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't add that track."))
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const current = tracks.at(index)
    const swap = tracks.at(index + direction)
    if (!current || !swap) return
    try {
      await Promise.all([
        updateTrack.mutateAsync({
          trackId: current._id as Id<"tracks">,
          patch: { order: swap.order },
        }),
        updateTrack.mutateAsync({
          trackId: swap._id as Id<"tracks">,
          patch: { order: current.order },
        }),
      ])
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't reorder the tracks."))
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiPriceTag3Line size={18} aria-hidden className="text-primary" />
          Tracks
        </CardTitle>
        <CardDescription>
          The themes speakers choose from — “AI Engineering”, “Infrastructure”.
          Each track gets a colour that follows it through the submissions table
          and the agenda.
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{tracks.length}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        {tracks.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiPriceTag3Line}
            title="No tracks yet"
            description="Tracks let speakers tell you which theme their talk fits, and they colour-code your agenda. Add your first one below."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-border">
            {tracks.map((track, index) => (
              <TrackRow
                key={track._id}
                track={track}
                isFirst={index === 0}
                isLast={index === tracks.length - 1}
                onMoveUp={() => void move(index, -1)}
                onMoveDown={() => void move(index, 1)}
                onRename={(value) =>
                  updateTrack.mutateAsync({
                    trackId: track._id as Id<"tracks">,
                    patch: { name: value },
                  })
                }
                onRecolor={(value) =>
                  updateTrack.mutateAsync({
                    trackId: track._id as Id<"tracks">,
                    patch: { color: value },
                  })
                }
                onDelete={() =>
                  deleteTrack.mutateAsync({ trackId: track._id as Id<"tracks"> })
                }
              />
            ))}
          </ul>
        )}

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 border-t border-border pt-4"
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Colour</Label>
            <div className="flex h-9 items-center">
              <TrackColorPicker
                value={color}
                onValueChange={setColor}
                trackName="the new track"
              />
            </div>
          </div>
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="new-track-name" className="text-xs font-medium">
              Track name
            </Label>
            <Input
              id="new-track-name"
              value={name}
              placeholder="AI Engineering"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={addTrack.isPending}>
            <RiAddLine size={16} aria-hidden />
            Add track
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function TrackRow({
  track,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRename,
  onRecolor,
  onDelete,
}: {
  track: TrackRecord
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRename: (value: string) => Promise<unknown>
  onRecolor: (value: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
}) {
  const [name, setName] = useState(track.name)
  useEffect(() => setName(track.name), [track.name])

  async function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(track.name)
      return
    }
    if (trimmed === track.name) return
    try {
      await onRename(trimmed)
    } catch (error) {
      setName(track.name)
      toast.error(errorMessage(error, "Couldn't rename that track."))
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
          aria-label={`Move ${track.name} up`}
          onClick={onMoveUp}
        >
          <RiArrowUpLine size={13} aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isLast}
          aria-label={`Move ${track.name} down`}
          onClick={onMoveDown}
        >
          <RiArrowDownLine size={13} aria-hidden />
        </Button>
      </div>

      <TrackColorPicker
        value={track.color}
        trackName={track.name}
        onValueChange={(value) => {
          void onRecolor(value).catch((error: unknown) =>
            toast.error(errorMessage(error, "Couldn't change that colour.")),
          )
        }}
      />

      <Input
        value={name}
        aria-label={`Track name (${track.name})`}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") setName(track.name)
        }}
        className="h-9 min-w-40 flex-1 border-transparent bg-transparent shadow-none hover:border-input focus:border-input"
      />

      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {TRACK_COLORS.some(
          (color) => color.value.toLowerCase() === track.color.toLowerCase(),
        )
          ? trackColorName(track.color)
          : null}
      </span>

      <ConfirmDeleteButton
        label={`Delete track ${track.name}`}
        title={`Delete “${track.name}”?`}
        description="Submissions already tagged with this track keep their answer but lose the colour coding. This can't be undone."
        confirmLabel="Delete track"
        onConfirm={onDelete}
        fallbackError="Couldn't delete that track."
      >
        <RiDeleteBinLine size={15} aria-hidden />
      </ConfirmDeleteButton>
    </li>
  )
}

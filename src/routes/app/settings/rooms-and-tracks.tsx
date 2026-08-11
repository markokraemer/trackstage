import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RoomsCard } from "@/components/settings/rooms-card"
import { TracksCard } from "@/components/settings/tracks-card"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/settings/rooms-and-tracks")({
  component: RoomsAndTracksPage,
})

/**
 * Settings → Rooms & tracks (SPEC §4.1, sbek AIA-02: "rooms/tracks
 * configurable; new ones immediately usable").
 */
function RoomsAndTracksPage() {
  const { event } = useCurrentEvent()
  const { data, isPending } = useQuery(
    convexQuery(
      api.roomsTracks.list,
      event ? { eventId: event._id } : "skip",
    ),
  )

  if (!event) return null

  if (isPending || !data) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="gap-3 pt-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <RoomsCard eventId={event._id} rooms={data.rooms} />
      <TracksCard eventId={event._id} tracks={data.tracks} />
    </div>
  )
}

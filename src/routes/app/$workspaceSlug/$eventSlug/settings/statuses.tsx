import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusesCard } from "@/components/settings/statuses-card"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/statuses")({
  component: StatusesPage,
})

/**
 * Settings → Statuses (docs/reference/sessionboard-product-map.md §2.2).
 * Every event ships with the seven built-ins; this is where an organizer
 * renames them, recolours them, reorders them and adds their own.
 */
function StatusesPage() {
  const { event } = useCurrentEvent()
  const { data, isPending } = useQuery(
    convexQuery(api.sessionStatuses.list, event ? { eventId: event._id } : "skip"),
  )

  if (!event) return null

  if (isPending || !data) {
    return (
      <Card>
        <CardContent className="gap-3 pt-2">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <StatusesCard
      eventId={event._id}
      statuses={data.statuses}
      initialized={data.initialized}
    />
  )
}

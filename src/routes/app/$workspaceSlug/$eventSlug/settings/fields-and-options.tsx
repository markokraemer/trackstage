import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { Card, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ValueListCard } from "@/components/settings/value-lists-card"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/fields-and-options")({
  component: FieldsAndOptionsPage,
})

/**
 * Settings → Fields & options (docs/reference/api-parity.md UI-census #16).
 * Format / Level / Language / Tags are shared value lists: each one IS the
 * option set on the matching form question, so an add/rename/remove here
 * writes through `convex/valueLists.ts` onto every form on the event.
 * Event-scoped, like every tab on this route — it reads context from
 * `useCurrentEvent`.
 */
function FieldsAndOptionsPage() {
  const { event, isLoading: eventLoading } = useCurrentEvent()
  const { data: lists, isPending: listsLoading } = useQuery(
    convexQuery(
      api.valueLists.list,
      event ? { eventId: event._id } : "skip",
    ),
  )

  const loading = eventLoading || !event || listsLoading || !lists

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          These options appear on your CFP form and throughout the app.
        </p>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        These options appear on your CFP form and throughout the app.
      </p>
      {lists.map((list) => (
        <ValueListCard key={list.key} eventId={event._id} list={list} />
      ))}
    </div>
  )
}

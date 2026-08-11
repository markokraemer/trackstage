import { createFileRoute } from "@tanstack/react-router"

import { EventDetailsForm } from "@/components/settings/event-details-form"
import { DeleteEventCard } from "@/components/settings/delete-event-card"
import { useCurrentEvent } from "@/components/settings/current-event"

export const Route = createFileRoute("/app/settings/")({
  component: EventDetailsPage,
})

/** Settings → Event details (SPEC §4.1, docs/ux/01 image25). */
function EventDetailsPage() {
  const { event } = useCurrentEvent()
  if (!event) return null
  return (
    <div className="flex flex-col gap-8">
      {/* Remount on event switch so the draft never leaks across events. */}
      <EventDetailsForm key={event._id} event={event} />
      <DeleteEventCard key={`danger-${event._id}`} event={event} />
    </div>
  )
}

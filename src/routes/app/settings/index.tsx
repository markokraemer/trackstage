import { createFileRoute } from "@tanstack/react-router"

import { EventDetailsForm } from "@/components/settings/event-details-form"
import { useCurrentEvent } from "@/components/settings/current-event"

export const Route = createFileRoute("/app/settings/")({
  component: EventDetailsPage,
})

/** Settings → Event details (SPEC §4.1, docs/ux/01 image25). */
function EventDetailsPage() {
  const { event } = useCurrentEvent()
  if (!event) return null
  // Remount on event switch so the draft never leaks across events.
  return <EventDetailsForm key={event._id} event={event} />
}

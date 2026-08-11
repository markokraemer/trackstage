import { createFileRoute } from "@tanstack/react-router"

import { EventDetailsForm } from "@/components/settings/event-details-form"
import { EventBrandingCard } from "@/components/settings/event-branding-card"
import { PortalBehaviorCard } from "@/components/settings/portal-behavior-card"
import { DeleteEventCard } from "@/components/settings/delete-event-card"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/")({
  component: EventDetailsPage,
})

/** Settings → Event details (SPEC §4.1, docs/ux/01 image25). */
function EventDetailsPage() {
  const { event } = useCurrentEvent()
  if (!event) return null
  return (
    <div className="flex flex-col gap-8">
      {/*
        The event's IDENTITY comes first, whole: what it is (details) and how
        it looks (branding) side by side above the fold (Marko, 2026-08-12:
        "move the branding up … it's also quite important"). On narrower
        screens branding stacks directly under the details card — never buried
        below portal behavior.
      */}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Remount on event switch so the draft never leaks across events. */}
        <EventDetailsForm key={event._id} event={event} />
        <EventBrandingCard key={`branding-${event._id}`} eventId={event._id} />
      </div>
      <PortalBehaviorCard key={`portal-${event._id}`} event={event} />
      {/* Who can open this event lives on its own Team tab now. */}
      <DeleteEventCard key={`danger-${event._id}`} event={event} />
    </div>
  )
}

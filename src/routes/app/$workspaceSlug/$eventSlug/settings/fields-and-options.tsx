import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { Card, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ValueListCard } from "@/components/settings/value-lists-card"
import { SponsorTiersCard } from "@/components/settings/sponsor-tiers-card"
import { SponsorFieldsCard } from "@/components/settings/sponsor-fields-card"
import { useScrollToHash } from "@/lib/use-scroll-to-hash"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/fields-and-options")({
  component: FieldsAndOptionsPage,
})

/**
 * Settings → Fields & options (docs/reference/api-parity.md UI-census #16).
 * Every option list and custom field on the event, grouped by what it
 * describes: SESSIONS (the CFP's shared value lists) and SPONSORS (tiers and
 * company fields — Marko, 2026-10-11: they belong here with the rest, not in
 * a slide-over on the Sponsors page).
 *
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

  const { data: sponsorSettings } = useQuery(
    convexQuery(api.sponsors.settings, event ? { eventId: event._id } : "skip"),
  )

  const loading = eventLoading || !event || listsLoading || !lists
  useScrollToHash(!loading && sponsorSettings !== undefined)

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
    <div className="flex flex-col gap-10">
      <section aria-labelledby="fields-sessions" className="flex flex-col gap-6">
        <SectionHeading
          id="fields-sessions"
          title="Sessions"
          description="These options appear on your CFP form and throughout the app."
        />
        {lists.map((list) => (
          <ValueListCard key={list.key} eventId={event._id} list={list} />
        ))}
      </section>

      <section id="sponsors" aria-labelledby="fields-sponsors" className="flex scroll-mt-24 flex-col gap-6">
        <SectionHeading
          id="fields-sponsors"
          title="Sponsors"
          description="Your sponsorship packages and what you collect from every sponsor. Sponsors see these in their portal."
        />
        {sponsorSettings ? (
          <>
            <SponsorTiersCard eventId={event._id} tiers={sponsorSettings.tiers} />
            <SponsorFieldsCard eventId={event._id} fields={sponsorSettings.fields} />
          </>
        ) : (
          Array.from({ length: 2 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full max-w-md" />
              </CardHeader>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className="text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

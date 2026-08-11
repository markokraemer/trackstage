import { createFileRoute } from "@tanstack/react-router"
import { RiPlugLine } from "@remixicon/react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AirtableCard } from "@/components/settings/airtable-card"
import { WebhooksCard } from "@/components/settings/webhooks-card"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/settings/integrations")({
  component: IntegrationsPage,
})

/**
 * Settings → Integrations (docs/memory/RULES.md 15). Event-scoped by design:
 * a connection points at ONE Airtable base, and organizers run several events
 * that each want their own base (or none at all).
 *
 * Deliberately self-contained — it reads event context from `useCurrentEvent`
 * and renders one card per integration, so adding the next one is a single
 * line here.
 */
function IntegrationsPage() {
  const { event, isLoading } = useCurrentEvent()

  if (isLoading || !event) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <AirtableCard eventId={event._id} />

      <WebhooksCard eventId={event._id} />

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <RiPlugLine size={16} aria-hidden className="text-muted-foreground" />
            Building your own?
          </CardTitle>
          <CardDescription>
            Anything Airtable can do, your own tools can too — the REST API, the
            MCP server and the calendar feed are all on the API &amp; MCP tab.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

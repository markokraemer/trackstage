import { Link } from "@tanstack/react-router"
import { RiCodeSSlashLine } from "@remixicon/react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Low-prominence mention of the plain REST API (`convex/http.ts`) — most
 * organizers only need the MCP connect flow above; this is for anyone
 * scripting against the data directly. Links to Embeds for the .ics feed,
 * which is already documented there.
 */
export function RestApiCard() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <RiCodeSSlashLine size={16} aria-hidden className="text-muted-foreground" />
          REST API
        </CardTitle>
        <CardDescription>
          Prefer plain HTTP? <code className="font-mono text-xs">GET /v1/event/&#123;slug&#125;/sessions</code>,{" "}
          <code className="font-mono text-xs">/speakers</code> and{" "}
          <code className="font-mono text-xs">/submissions</code> return JSON
          with the same bearer-token auth as the MCP endpoint above. The
          calendar feed at{" "}
          <code className="font-mono text-xs">/schedule.ics</code> needs no
          auth at all — grab it from{" "}
          <Link to="/app/embeds" className="text-primary underline underline-offset-3">
            Embeds
          </Link>
          .
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

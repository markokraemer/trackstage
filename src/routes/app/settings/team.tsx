import { createFileRoute } from "@tanstack/react-router"

import { TeamCard } from "@/components/settings/team-card"
import { useCurrentEvent } from "@/components/settings/current-event"

export const Route = createFileRoute("/app/settings/team")({
  component: TeamPage,
})

/**
 * Settings → Team. The enterprise multi-tenancy surface: workspaces own
 * events, members have roles (docs/memory/RULES.md 18c).
 */
function TeamPage() {
  const { event } = useCurrentEvent()
  return <TeamCard defaultOrganizationId={event?.organizationId} />
}

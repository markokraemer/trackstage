import { createFileRoute } from "@tanstack/react-router"

import { MembersCard } from "@/components/workspace/members-card"
import { useCurrentEvent } from "@/lib/current-event"
import { useSession } from "@/lib/session"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/team")({
  component: EventTeamPage,
})

/**
 * Settings → Team (Marko, 2026-08-12: "just have a Team tab instead" — no
 * more redirect-y copy pointing at Workspace settings; the data is right
 * here). The SAME member table the workspace-settings modal renders — person,
 * role, per-event access editor, status, invite — scoped to the people who
 * can open THIS event, with the invite CTA pre-selecting it. Team membership
 * is workspace-level data, so both hosts drive the identical component and
 * the identical mutations.
 */
function EventTeamPage() {
  const { event, workspace, workspaceEvents } = useCurrentEvent()
  const { session } = useSession()
  if (!event || !workspace) return null

  return (
    <MembersCard
      key={`team-${event._id}`}
      organizationId={workspace.id}
      workspaceName={workspace.name}
      myRole={workspace.role}
      myEmail={session?.email ?? ""}
      events={workspaceEvents}
      scopeEvent={{ id: event._id, name: event.name }}
    />
  )
}

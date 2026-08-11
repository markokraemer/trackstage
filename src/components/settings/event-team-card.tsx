import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiTeamLine, RiUserAddLine } from "@remixicon/react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { StatusPill } from "@/components/shared/status-pill"
import { canManageTeam, roleLabel } from "@/components/workspace/roles"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import type { EventSummary } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"

/**
 * Team — at the EVENT level (docs/memory/RULES.md 23, refinement 3).
 *
 * The workspace hub answers "who is on the team"; this card answers the
 * question an organizer actually has while standing inside an event: *who can
 * open THIS event?* That is the workspace's owners and admins (who run
 * everything by definition) plus the members whose access scope includes it —
 * exactly the rule `convex/lib/auth.ts memberCanSeeEvent` enforces, restated
 * in the UI so the two can be read against each other.
 *
 * "Invite to this event" deep-links into the workspace invite flow with the
 * role already set to Member and THIS event pre-selected, so granting someone
 * access to one event is two clicks and never a trip through the scope picker.
 */
export function EventTeamCard({ event }: { event: EventSummary }) {
  const { workspace } = useCurrentEvent()
  const { data: members, isPending } = useQuery(
    convexQuery(
      api.workspaces.members,
      event.organizationId ? { organizationId: event.organizationId } : "skip",
    ),
  )

  const workspaceHubLink = appLink.workspaceHub(eventRefOf(event).workspaceSlug)
  const canInvite = canManageTeam(workspace?.role ?? "member")
  const rows = (members ?? [])
    .filter((member) => {
      if (member.role === "owner" || member.role === "admin") return true
      if (member.eventIds === undefined) return true
      return member.eventIds.includes(event._id)
    })
    .sort((a, b) => {
      const order = { owner: 0, admin: 1, member: 2 } as Record<string, number>
      const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3)
      return diff !== 0 ? diff : a.email.localeCompare(b.email)
    })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiTeamLine size={18} aria-hidden className="text-primary" />
          Team
          {isPending ? null : <Badge variant="secondary">{rows.length}</Badge>}
        </CardTitle>
        <CardDescription>
          Who can open <strong className="font-medium">{event.name}</strong>.
          Owners and admins of {workspace?.name ?? "this workspace"} reach every
          event; members appear here only when their access includes this one.{" "}
          <Link to={workspaceHubLink as never} className="text-primary hover:underline">
            Manage the whole team
          </Link>
          .
        </CardDescription>
        {canInvite ? (
          <CardAction>
            <Link
              to={workspaceHubLink as never}
              search={{ invite: true, event: event._id } as never}
              className={buttonVariants({ size: "sm" })}
            >
              <RiUserAddLine size={15} aria-hidden />
              Invite to this event
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="gap-2 pt-2">
        {isPending ? (
          <>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </>
        ) : (
          rows.map((member) => (
            <div
              key={member._id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <Avatar className="size-7">
                <AvatarFallback className="text-[10px]">
                  {member.email.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {member.email}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {roleLabel(member.role)}
                  {" · "}
                  {member.role === "owner" || member.role === "admin"
                    ? "All events"
                    : member.eventIds === undefined
                      ? "All events"
                      : member.eventIds.length === 1
                        ? "This event only"
                        : `${member.eventIds.length} events`}
                </span>
              </span>
              <StatusPill
                size="sm"
                status={member.userId ? "active" : "incomplete"}
                label={member.userId ? "Active" : "Invited"}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

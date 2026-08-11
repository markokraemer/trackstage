import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog"
import {
  WorkspaceTile,
  workspaceMetaLabel,
} from "@/components/shell/workspace-switcher"
import type { WorkspaceOption } from "@/lib/current-event"

/**
 * "Your workspaces" — the hub's answer to *see every workspace I'm part of*
 * (Marko). A user gets invited into other teams' workspaces, so this is the
 * one place that names all of them at once, with the role you hold and how
 * many of their events you can reach.
 *
 * Switching here is the SAME store switch the sidebar picker performs
 * (src/lib/current-event.ts), so the hub, the sidebar and the avatar menu can
 * never show different answers. It deliberately does not repeat the Team list
 * below — that one is about people in ONE workspace, this one is about you
 * across all of them.
 */
export function WorkspacesCard({
  workspaces,
  onSwitch,
  onCreated,
}: {
  workspaces: Array<WorkspaceOption>
  onSwitch: (workspaceId: string) => void
  onCreated?: (workspaceId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          Your workspaces{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {workspaces.length}
          </span>
        </CardTitle>
        <CardDescription>
          Every workspace you belong to. Switch to one to manage its events and
          its team — nothing is shared between workspaces.
        </CardDescription>
        <CardAction>
          <NewWorkspaceDialog onCreated={onCreated} />
        </CardAction>
      </CardHeader>
      <CardContent className="gap-2 pt-2">
        {workspaces.map((row) => (
          <div
            key={row.id}
            data-current={row.isCurrent ? "" : undefined}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 data-current:bg-muted/40"
          >
            <WorkspaceTile name={row.name} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {row.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {workspaceMetaLabel(row.role, row.events.length)}
              </span>
            </span>
            {row.isCurrent ? (
              <Badge variant="secondary">Current</Badge>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Switch to ${row.name}`}
                onClick={() => onSwitch(row.id)}
              >
                Switch
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

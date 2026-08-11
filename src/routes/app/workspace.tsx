import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { RiCalendarEventLine, RiUserSettingsLine } from "@remixicon/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsLevelNav } from "@/components/shell/settings-level-nav"
import { WorkspaceNameCard } from "@/components/workspace/workspace-name-card"
import { MembersCard } from "@/components/workspace/members-card"
import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog"
import { useSession } from "@/lib/session"
import { useCurrentEvent } from "@/lib/current-event"
import type { WorkspaceSummary } from "@/lib/current-event"

export const Route = createFileRoute("/app/workspace")({
  component: WorkspaceSettingsPage,
})

/**
 * Workspace settings — the middle level of the hierarchy
 * (docs/memory/RULES.md 23c). A workspace owns its events and its people;
 * everything an event needs day to day lives one level down, in Event
 * settings. Sessionboard calls this level the "organization"; we say
 * workspace, and the switcher lives in the account menu next to Sign out.
 */
function WorkspaceSettingsPage() {
  const { session } = useSession()
  const { workspaces, workspace, events, selectWorkspace, isLoading } =
    useCurrentEvent()

  // The workspace being edited follows the app's current workspace, but can be
  // pointed at another one you belong to (including a brand-new, empty one).
  const [viewingId, setViewingId] = useState<string | undefined>(workspace?.id)

  useEffect(() => {
    setViewingId((current) => {
      if (current && workspaces.some((row) => row.id === current)) return current
      return workspace?.id ?? workspaces.at(0)?.id
    })
  }, [workspaces, workspace])

  const viewing: WorkspaceSummary | undefined =
    workspaces.find((row) => row.id === viewingId) ??
    workspace ??
    workspaces.at(0)
  const eventCount = viewing
    ? events.filter((row) => row.organizationId === viewing.id).length
    : 0

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <SettingsLevelNav level="workspace" />

        <PageHeader
          title={
            viewing ? `Workspace settings — ${viewing.name}` : "Workspace settings"
          }
          description="Your team and the events they run. Members added here can work on every event in this workspace."
          actions={
            <>
              {workspaces.length > 1 ? (
                <Select
                  value={viewing?.id}
                  onValueChange={(value) => {
                    const id = String(value)
                    setViewingId(id)
                    // Keep the whole app on the workspace you're managing.
                    selectWorkspace(id)
                  }}
                >
                  <SelectTrigger size="sm" aria-label="Workspace">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <NewWorkspaceDialog onCreated={(id) => setViewingId(id)} />
            </>
          }
        />

        {isLoading ? (
          <Card>
            <CardContent className="gap-4 pt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : !viewing ? (
          <Card>
            <CardHeader>
              <CardTitle>No workspace yet</CardTitle>
              <CardDescription>
                Reload the page — a workspace is created automatically the first
                time you sign in.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <WorkspaceNameCard
              key={`name-${viewing.id}`}
              organizationId={viewing.id}
              name={viewing.name}
              slug={viewing.slug}
              myRole={viewing.role}
            />
            <MembersCard
              key={`members-${viewing.id}`}
              organizationId={viewing.id}
              workspaceName={viewing.name}
              myRole={viewing.role}
              myEmail={session?.email ?? ""}
            />
            <LevelsCard eventCount={eventCount} workspaceName={viewing.name} />
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

/** Says, in one sentence, what belongs here versus one level up or down. */
function LevelsCard({
  eventCount,
  workspaceName,
}: {
  eventCount: number
  workspaceName: string
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>What lives where</CardTitle>
        <CardDescription>
          {workspaceName} holds {eventCount}{" "}
          {eventCount === 1 ? "event" : "events"} and the people who run them —
          each event keeps its own dates, rooms, tracks, submissions and agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3 pt-2 text-sm">
        <Link
          to="/app/settings"
          className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
        >
          <RiCalendarEventLine
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <span>
            <span className="block font-medium text-foreground">
              Event settings
            </span>
            <span className="block text-muted-foreground">
              Dates, venue, public web address, rooms and tracks — for the event
              you're working on.
            </span>
          </span>
        </Link>
        <Link
          to="/app/account"
          className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60"
        >
          <RiUserSettingsLine
            size={18}
            aria-hidden
            className="mt-0.5 shrink-0 text-primary"
          />
          <span>
            <span className="block font-medium text-foreground">
              Account settings
            </span>
            <span className="block text-muted-foreground">
              Your own name, email and password — personal to you.
            </span>
          </span>
        </Link>
      </CardContent>
    </Card>
  )
}

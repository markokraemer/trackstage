import { createFileRoute } from "@tanstack/react-router"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiTeamLine,
} from "@remixicon/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { WorkspaceNameCard } from "@/components/workspace/workspace-name-card"
import { MembersCard } from "@/components/workspace/members-card"
import { WorkspacesCard } from "@/components/workspace/workspaces-card"
import { WorkspaceEventsCard } from "@/components/workspace/events-card"
import { useSession } from "@/lib/session"
import { useWorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { useCurrentEvent } from "@/lib/current-event"
import type { WorkspaceSummary } from "@/lib/current-event"

const WORKSPACE_TABS = ["general", "team", "events"] as const
type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

function isWorkspaceTab(value: unknown): value is WorkspaceTab {
  return (
    typeof value === "string" &&
    (WORKSPACE_TABS as readonly string[]).includes(value)
  )
}

interface WorkspaceSearch {
  /** Which section is open. Absent ⇒ General (or Team when invite=1). */
  tab?: WorkspaceTab
  /** Open the Team tab's invite panel straight away. */
  invite?: boolean
  /** Pre-select that invite's event scope (Event settings → Team). */
  event?: string
}

export const Route = createFileRoute("/app/$workspaceSlug/workspace")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    ...(isWorkspaceTab(search.tab) ? { tab: search.tab } : {}),
    ...(search.invite === true || search.invite === "1" || search.invite === 1
      ? { invite: true }
      : {}),
    ...(typeof search.event === "string" && search.event
      ? { event: search.event }
      : {}),
  }),
  component: WorkspaceSettingsPage,
})

/**
 * Workspace settings — the level above your events (docs/memory/RULES.md
 * 23c): the workspace itself, every event it owns, and the people who run
 * them. A standalone PAGE (Marko, 2026-08-12: settings surfaces are pages;
 * dialogs are for atomic actions only, never stacked), with Team a
 * first-class tab right after General — the member table is the tab's whole
 * content, never something you scroll to find.
 *
 * The page always manages the workspace the app is IN — the URL slug is
 * cosmetic next to the store switch — so this page and the sidebar can never
 * name two different workspaces. Switching workspace from the General tab
 * stays ON this page, re-addressed to the new workspace.
 */
function WorkspaceSettingsPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { session } = useSession()
  const { workspaceEvents, selectEvent, selectWorkspace, isLoading } =
    useCurrentEvent()
  const { workspaceOptions, workspace, switchToCreated } =
    useWorkspaceSwitcher()

  const active: WorkspaceTab =
    search.tab ?? (search.invite ? "team" : "general")

  // `?invite=1&event=…` — arriving from an event's Team tab (pre-modal-era
  // deep links). Closing the invite panel drops the params so a reload
  // doesn't reopen it, but pins the Team tab.
  const inviteEventIds =
    search.event && workspaceEvents.some((row) => row._id === search.event)
      ? [search.event]
      : undefined

  const viewing: WorkspaceSummary | undefined = workspace

  /** Switch workspace WITHOUT leaving workspace settings. */
  const switchStayingHere = (workspaceId: string) => {
    const option = workspaceOptions.find((row) => row.id === workspaceId)
    selectWorkspace(workspaceId)
    if (!option) return
    void navigate({
      to: "/app/$workspaceSlug/workspace",
      params: { workspaceSlug: option.slug },
      search: {},
      replace: true,
    })
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={
            viewing ? `Workspace settings — ${viewing.name}` : "Workspace settings"
          }
          description="The level above your events: the workspace itself, every event it owns, and the people who run them."
        >
          <Tabs
            value={active}
            onValueChange={(value) => {
              if (!isWorkspaceTab(value)) return
              void navigate({
                search: { tab: value === "general" ? undefined : value },
                replace: true,
              })
            }}
          >
            <TabsList variant="line" className="h-auto flex-wrap">
              <TabsTrigger value="general" className="gap-1.5">
                <RiBuilding2Line size={15} aria-hidden />
                General
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-1.5">
                <RiTeamLine size={15} aria-hidden />
                Team
              </TabsTrigger>
              <TabsTrigger value="events" className="gap-1.5">
                <RiCalendarEventLine size={15} aria-hidden />
                Events
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </PageHeader>

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
          <Tabs value={active}>
            <TabsContent value="general" className="flex flex-col gap-6">
              <WorkspaceNameCard
                key={`name-${viewing.id}`}
                organizationId={viewing.id}
                name={viewing.name}
                slug={viewing.slug}
                myRole={viewing.role}
              />
              <WorkspacesCard
                workspaces={workspaceOptions}
                onSwitch={switchStayingHere}
                onCreated={switchToCreated}
              />
            </TabsContent>

            {/* Team is the WHOLE tab — the member table with the invite CTA
                in its header. Invite + access editing swap the card's content
                in place (never a dialog over anything). */}
            <TabsContent value="team">
              <MembersCard
                key={`members-${viewing.id}`}
                organizationId={viewing.id}
                workspaceName={viewing.name}
                myRole={viewing.role}
                myEmail={session?.email ?? ""}
                events={workspaceEvents}
                inviteOpen={search.invite === true}
                inviteEventIds={inviteEventIds}
                onInviteClosed={() => {
                  if (search.invite || search.event) {
                    void navigate({
                      to: "/app/$workspaceSlug/workspace",
                      params: { workspaceSlug: viewing.slug },
                      search: { tab: "team" },
                      replace: true,
                    })
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="events">
              <WorkspaceEventsCard
                key={`events-${viewing.id}`}
                events={workspaceEvents}
                onOpen={selectEvent}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  )
}

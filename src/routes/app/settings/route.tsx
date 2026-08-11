import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { RiBuilding2Line, RiCalendarEventLine } from "@remixicon/react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SettingsLevelNav } from "@/components/shell/settings-level-nav"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
})

const TABS = [
  { value: "details", label: "Event details", to: "/app/settings" },
  {
    value: "rooms",
    label: "Rooms & tracks",
    to: "/app/settings/rooms-and-tracks",
  },
  { value: "api-mcp", label: "API & MCP", to: "/app/settings/api-mcp" },
] as const

/**
 * Event settings — the deepest level of the hierarchy
 * (docs/memory/RULES.md 23d). Everything here belongs to ONE event; the team
 * that can reach it lives one level up in Workspace settings. The banner names
 * the event so the scope is never ambiguous, and the event switcher in the
 * sidebar changes which event these tabs are editing.
 */
function SettingsLayout() {
  const { event, isLoading } = useCurrentEvent()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const active =
    TABS.find((tab) => tab.to !== "/app/settings" && pathname.startsWith(tab.to))
      ?.value ?? "details"

  const dates = event
    ? formatZonedDateRange(event.startsAt, event.endsAt, event.timezone)
    : undefined

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <SettingsLevelNav level="event" />

        <PageHeader
          title={event ? `Event settings — ${event.name}` : "Event settings"}
          description={
            event
              ? `${dates ?? "Dates not set"} · Applies to this event only — switch events in the sidebar.`
              : "Set up your event: its dates, its public web address, and the rooms and tracks it uses."
          }
        >
          <Tabs value={active}>
            <TabsList variant="line" className="h-auto flex-wrap">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  nativeButton={false}
                  render={
                    <Link
                      to={tab.to}
                      activeOptions={{ exact: tab.to === "/app/settings" }}
                    />
                  }
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <p className="flex flex-wrap items-center gap-1.5 text-xs text-foreground/70">
            <RiBuilding2Line size={14} aria-hidden />
            Teammates, roles and invites moved to
            <Link
              to="/app/workspace"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Workspace settings
            </Link>
            — they apply to every event
            {event?.organizationName ? ` in ${event.organizationName}` : ""}.
          </p>
        </PageHeader>

        {isLoading ? (
          <Card>
            <CardContent className="gap-4">
              <Skeleton className="h-5 w-48" />
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : event ? (
          <Outlet />
        ) : (
          <EmptyState
            icon={RiCalendarEventLine}
            title="Create your first event"
            description="An event is one conference, summit or meetup. It holds its own call for speakers, submissions, speakers and agenda — nothing is shared with your other events."
            action={<NewEventDialog label="Create an event" />}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

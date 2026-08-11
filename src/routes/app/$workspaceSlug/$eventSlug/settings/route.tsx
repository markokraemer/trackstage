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
import { appLink, legacyAppLink } from "@/lib/app-links"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings")({
  component: SettingsLayout,
})

const TABS = [
  { value: "details", label: "Event details", section: undefined },
  { value: "rooms", label: "Rooms & tracks", section: "rooms-and-tracks" },
  {
    value: "fields",
    label: "Fields & options",
    section: "fields-and-options",
  },
  { value: "statuses", label: "Statuses", section: "statuses" },
  { value: "integrations", label: "Integrations", section: "integrations" },
  { value: "activity", label: "Activity", section: "activity" },
] as const

/**
 * Event settings — the deepest level of the hierarchy
 * (docs/memory/RULES.md 23d). Everything here belongs to ONE event; the team
 * that can reach it lives one level up in Workspace settings. The banner names
 * the event so the scope is never ambiguous, and the event switcher in the
 * sidebar changes which event these tabs are editing.
 */
function SettingsLayout() {
  const { event, eventRef, isLoading } = useCurrentEvent()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const tabHref = (section: (typeof TABS)[number]["section"]) =>
    eventRef
      ? section
        ? appLink.settingsSection(eventRef, section)
        : appLink.settings(eventRef)
      : legacyAppLink.settings

  const active =
    TABS.find(
      (tab) => tab.section !== undefined && pathname.startsWith(tabHref(tab.section)),
    )?.value ?? "details"

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
                      to={tabHref(tab.section)}
                      activeOptions={{ exact: tab.section === undefined }}
                    />
                  }
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/*
            The one line that keeps the three levels straight from the deepest
            one (docs/memory/RULES.md 23): everything on these tabs belongs to
            this event alone, and the two things that DON'T are named with a
            link to where they actually live.
          */}
          {/* Plain text flow, not a flex row: a flex gap would strand the
              sentence's punctuation a space away from the word before it. */}
          <p className="text-xs text-foreground/70">
            <RiBuilding2Line
              size={14}
              aria-hidden
              className="mr-1.5 inline-block align-text-bottom"
            />
            These tabs change this event only. Teammates and roles live in{" "}
            <Link
              to={
                eventRef
                  ? appLink.workspaceHub(eventRef.workspaceSlug)
                  : appLink.workspaceHubFallback
              }
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Workspace settings
            </Link>
            {event?.organizationName ? ` (${event.organizationName})` : ""}; your
            API keys and MCP connection live in{" "}
            <Link
              to={appLink.account}
              search={{ tab: "api-mcp" }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Account settings
            </Link>
            .
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

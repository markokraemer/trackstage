import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router"
import { RiCalendarEventLine } from "@remixicon/react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { EventSwitcher } from "@/components/settings/event-switcher"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { useCurrentEvent } from "@/components/settings/current-event"
import { formatZonedDateRange } from "@/components/settings/timezone"

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
  { value: "team", label: "Team", to: "/app/settings/team" },
] as const

/**
 * Settings shell — SPEC §4.1. A tinted page banner (docs/ux/01 image29) with
 * the event switcher on the right, then the sub-tabs. Each tab is a real link
 * with its own URL, so a browser agent can reach any of them directly.
 */
function SettingsLayout() {
  const { events, event, isLoading, selectEvent } = useCurrentEvent()
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
        <PageHeader
          title="Event settings"
          description={
            event
              ? `${event.name}${dates ? ` · ${dates}` : ""}${
                  event.organizationName ? ` · ${event.organizationName}` : ""
                }`
              : "Set up your event, the rooms and tracks it uses, and who on your team can help."
          }
          actions={
            <EventSwitcher
              events={events}
              current={event}
              onSelect={selectEvent}
            />
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

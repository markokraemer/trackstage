import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router"
import { RiCalendarEventLine } from "@remixicon/react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import { useCurrentEvent } from "@/lib/current-event"
import { appLink, legacyAppLink } from "@/lib/app-links"

export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings")({
  component: SettingsLayout,
})

const TABS = [
  { value: "details", label: "Event details", section: undefined },
  // Rooms & tracks sits RIGHT NEXT to Event details (Marko, 2026-08-12:
  // "quite important") — it is the event's physical/program shape, the first
  // thing set up after the basics.
  { value: "rooms", label: "Rooms & tracks", section: "rooms-and-tracks" },
  // Who can open this event — the same member table as Workspace settings,
  // scoped (Marko, 2026-08-12: "just have a Team tab instead").
  { value: "team", label: "Team", section: "team" },
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

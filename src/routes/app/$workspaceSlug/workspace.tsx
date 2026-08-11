import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiArrowRightSLine,
  RiCalendarEventLine,
  RiUserSettingsLine,
} from "@remixicon/react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsLevelNav } from "@/components/shell/settings-level-nav"
import { WorkspaceNameCard } from "@/components/workspace/workspace-name-card"
import { MembersCard } from "@/components/workspace/members-card"
import { WorkspacesCard } from "@/components/workspace/workspaces-card"
import { NewEventDialog } from "@/components/settings/new-event-dialog"
import { formatZonedDateRange } from "@/components/settings/timezone"
import { useSession } from "@/lib/session"
import { useWorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { useCurrentEvent, eventRefOf } from "@/lib/current-event"
import type { EventSummary, WorkspaceSummary } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"

interface WorkspaceSearch {
  /** Open the invite dialog straight away (Event settings → Team card). */
  invite?: boolean
  /** Pre-select that invite's event scope. */
  event?: string
}

export const Route = createFileRoute("/app/$workspaceSlug/workspace")({
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    invite:
      search.invite === true || search.invite === "1" || search.invite === 1
        ? true
        : undefined,
    event: typeof search.event === "string" ? search.event : undefined,
  }),
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
  const { workspaceEvents, selectEvent, isLoading } = useCurrentEvent()
  const { workspaceOptions, workspace, switchTo, switchToCreated } =
    useWorkspaceSwitcher()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // `?invite=1&event=…` — arriving from an event's Team card. Closing the
  // dialog drops the params so a reload doesn't reopen it.
  const inviteEventIds =
    search.event && workspaceEvents.some((row) => row._id === search.event)
      ? [search.event]
      : undefined

  // The hub always manages the workspace the app is IN — switching here moves
  // the whole app (sidebar included), so "Workspace settings" and the sidebar
  // can never name two different workspaces.
  const viewing: WorkspaceSummary | undefined = workspace

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <SettingsLevelNav level="workspace" />

        <PageHeader
          title={
            viewing ? `Workspace settings — ${viewing.name}` : "Workspace settings"
          }
          description="The level above your events: the workspace itself, every event it owns, and the people who run them."
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
            {/*
              Hub order = the hierarchy itself: which workspaces you belong to,
              then THIS workspace, then what it owns (events), then who runs
              them (team). Team comes last because the access column it carries
              refers to the events listed directly above it.
            */}
            <WorkspacesCard
              workspaces={workspaceOptions}
              onSwitch={switchTo}
              onCreated={switchToCreated}
            />
            <WorkspaceNameCard
              key={`name-${viewing.id}`}
              organizationId={viewing.id}
              name={viewing.name}
              slug={viewing.slug}
              myRole={viewing.role}
            />
            <EventsCard
              key={`events-${viewing.id}`}
              events={workspaceEvents}
              onOpen={selectEvent}
            />
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
                if (search.invite) {
                  void navigate({
                    href: appLink.workspaceHub(viewing.slug),
                  })
                }
              }}
            />
            <LevelsCard />
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * The workspace as the org hub (docs/memory/RULES.md 23, refinement 2): the
 * events this workspace owns, each one a click away from its own settings.
 * Opening a row also switches the whole app to that event — the same
 * `sb.currentEventId` store the sidebar's event switcher writes to — so
 * "Event settings" always means the event you just clicked.
 */
function EventsCard({
  events,
  onOpen,
}: {
  events: Array<EventSummary>
  onOpen: (eventId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>
          Events{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {events.length}
          </span>
        </CardTitle>
        <CardDescription>
          Each event keeps its own dates, rooms, tracks, submissions and agenda.
          Open one to manage its settings.
        </CardDescription>
        <CardAction>
          <NewEventDialog label="New event" variant="outline" size="sm" />
        </CardAction>
      </CardHeader>
      <CardContent className="gap-2 pt-2">
        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No events in this workspace yet. Create one to open a call for
            speakers and start collecting submissions.
          </p>
        ) : (
          events.map((row) => <EventRow key={row._id} event={row} onOpen={onOpen} />)
        )}
      </CardContent>
    </Card>
  )
}

function EventRow({
  event,
  onOpen,
}: {
  event: EventSummary
  onOpen: (eventId: string) => void
}) {
  const { data: counts } = useQuery(
    convexQuery(api.submissions.counts, { eventId: event._id }),
  )
  const dates = formatZonedDateRange(
    event.startsAt,
    event.endsAt,
    event.timezone,
  )

  return (
    <Link
      to={appLink.settings(eventRefOf(event))}
      onClick={() => onOpen(event._id)}
      aria-label={`${event.name} settings`}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <RiCalendarEventLine
        size={17}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {event.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {dates ?? "Dates not set"}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {counts ? (
          <>
            {counts.all} submission{counts.all === 1 ? "" : "s"}
          </>
        ) : (
          <Skeleton className="h-4 w-24" />
        )}
      </span>
      <RiArrowRightSLine
        size={17}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
    </Link>
  )
}

/** Says, in one sentence, what belongs here versus one level up. */
function LevelsCard() {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>What lives where</CardTitle>
        <CardDescription>
          This workspace holds your events and the people who run them. Anything
          personal to you sits one level up.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-3 pt-2 text-sm">
        <Link
          to={appLink.account}
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

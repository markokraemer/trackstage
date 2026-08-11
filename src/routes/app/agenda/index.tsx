/**
 * Agenda builder — `/app/agenda` (docs/SPEC.md §4.6).
 *
 * Four views over one reactive `api.agenda.board` query: List, Day (the
 * drag-and-drop grid), Rooms (swimlanes), and Conflicts. Because every view
 * reads the same live query, placing a session in one of them repaints the
 * conflict badge, the tray, and the other three views at once.
 */

import * as React from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import {
  RiAddLine,
  RiCalendarScheduleLine,
  RiDoorOpenLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiLayoutGridLine,
  RiListCheck2,
  RiTimeLine,
} from "@remixicon/react"

import { api } from "@convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { AutoPlaceDialog } from "@/components/agenda/auto-place-dialog"
import { ConflictsView } from "@/components/agenda/conflicts-view"
import { DayView } from "@/components/agenda/day-view"
import { ListView } from "@/components/agenda/list-view"
import { RoomsView } from "@/components/agenda/rooms-view"
import type { ScheduledSession } from "@/components/agenda/agenda-model"
import { useCurrentEvent } from "@/lib/current-event"
import {
  conflictedSessionIds,
  isScheduled,
  matchesSearch,
  sessionsOnDay,
  windowForDay,
} from "@/components/agenda/agenda-model"
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  dayKeyOf,
  dayKeysBetween,
  formatDayLabel,
  formatDayLabelLong,
  isDayKey,
  safeTimeZone,
  timeZoneAbbreviation,
} from "@/components/agenda/agenda-time"

/** Sibling routes are built in parallel — keep these as plain paths. */
const SUBMISSIONS_PATH = "/app/submissions" as string
const SETTINGS_PATH = "/app/settings" as string

const VIEWS = ["list", "day", "rooms", "conflicts"] as const
type AgendaView = (typeof VIEWS)[number]

interface AgendaSearch {
  view: AgendaView
  /** Selected day, `YYYY-MM-DD` in the event timezone. */
  day?: string
  /** Session to highlight after jumping from the Conflicts view. */
  focus?: string
}

export const Route = createFileRoute("/app/agenda/")({
  validateSearch: (search: Record<string, unknown>): AgendaSearch => {
    const view = String(search.view ?? "")
    const day = typeof search.day === "string" ? search.day : undefined
    const focus = typeof search.focus === "string" ? search.focus : undefined
    return {
      view: (VIEWS as ReadonlyArray<string>).includes(view)
        ? (view as AgendaView)
        : "day",
      day: isDayKey(day) ? day : undefined,
      focus,
    }
  },
  component: AgendaPage,
})

function AgendaPage() {
  const { view, day, focus } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [search, setSearch] = React.useState("")

  const { event, isLoading: eventsPending } = useCurrentEvent()

  const { data: board, isPending: boardPending } = useQuery(
    convexQuery(api.agenda.board, event ? { eventId: event._id } : "skip")
  )

  const timeZone = safeTimeZone(board?.event.timezone ?? event?.timezone)

  const scheduledAll = React.useMemo(
    () => (board?.scheduled ?? []).filter(isScheduled),
    [board]
  )
  const unscheduledAll = React.useMemo(() => board?.unscheduled ?? [], [board])
  const conflicts = board?.conflicts ?? []
  const conflictIds = React.useMemo(
    () => conflictedSessionIds(conflicts),
    [conflicts]
  )

  /** Every day the event covers, plus any day that already holds a session. */
  const dayKeys = React.useMemo(() => {
    const keys = new Set<string>()
    const startsAt = board?.event.startsAt
    const endsAt = board?.event.endsAt
    if (startsAt) {
      for (const key of dayKeysBetween(
        startsAt,
        endsAt ?? startsAt,
        timeZone
      )) {
        keys.add(key)
      }
    }
    for (const session of scheduledAll) {
      keys.add(dayKeyOf(session.startsAt, timeZone))
    }
    if (keys.size === 0) keys.add(dayKeyOf(Date.now(), timeZone))
    return [...keys].sort()
  }, [board, scheduledAll, timeZone])

  const firstBusyDay = dayKeys.find((key) =>
    scheduledAll.some((session) => dayKeyOf(session.startsAt, timeZone) === key)
  )
  const selectedDay =
    day && dayKeys.includes(day) ? day : (firstBusyDay ?? dayKeys[0])

  const filteredScheduled = scheduledAll.filter((session) =>
    matchesSearch(session, search)
  )
  const filteredUnscheduled = unscheduledAll.filter((session) =>
    matchesSearch(session, search)
  )

  const daySessionsUnfiltered = sessionsOnDay(
    scheduledAll,
    selectedDay,
    timeZone
  )
  const daySessions = sessionsOnDay(filteredScheduled, selectedDay, timeZone)
  const { startMinutes, endMinutes } = windowForDay(
    daySessionsUnfiltered,
    timeZone,
    GRID_START_HOUR,
    GRID_END_HOUR
  )

  const setView = (next: AgendaView) => {
    void navigate({
      search: (prev: AgendaSearch) => ({
        ...prev,
        view: next,
        focus: undefined,
      }),
    })
  }
  const setDay = (next: string) => {
    void navigate({
      search: (prev: AgendaSearch) => ({
        ...prev,
        day: next,
        focus: undefined,
      }),
    })
  }
  const showInDay = (session: ScheduledSession) => {
    void navigate({
      search: () => ({
        view: "day" as const,
        day: dayKeyOf(session.startsAt, timeZone),
        focus: session.id,
      }),
    })
  }

  const loading = eventsPending || (Boolean(event) && boardPending)

  const header = (
    <PageHeader
      title="Agenda"
      description="Build your programme: give every accepted session a room and a time, and catch clashes before your speakers do."
      actions={
        <>
          {event ? (
            <Button
              variant="outline"
              render={
                <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" />
              }
            >
              <RiExternalLinkLine aria-hidden />
              View public agenda
            </Button>
          ) : null}
          {event && board ? (
            <AutoPlaceDialog
              eventId={event._id}
              timeZone={timeZone}
              anchorTs={board.event.startsAt ?? Date.now()}
              pendingCount={unscheduledAll.length}
              hasRooms={board.rooms.length > 0}
            />
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={<Button render={<Link to={SUBMISSIONS_PATH} />} />}
            >
              <RiAddLine aria-hidden />
              Add session
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              Sessions come from your submissions. Add a keynote, break, or
              sponsor slot on the Submissions page, mark it Accepted, and it
              lands in Not scheduled here — ready to place.
            </TooltipContent>
          </Tooltip>
        </>
      }
    />
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-125 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={RiCalendarScheduleLine}
          title="Create your event first"
          description="The agenda is built from your event's days, rooms, and accepted sessions. Set up the event — name, dates, rooms and tracks — and this page fills itself in."
          action={
            <Button render={<Link to={SETTINGS_PATH} />}>
              Go to event settings
            </Button>
          }
        />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-125 w-full rounded-xl" />
      </div>
    )
  }

  const tabs: Array<{
    value: AgendaView
    label: string
    icon: typeof RiListCheck2
    badge?: number
  }> = [
    { value: "list", label: "List", icon: RiListCheck2 },
    { value: "day", label: "Day", icon: RiTimeLine },
    { value: "rooms", label: "Rooms", icon: RiDoorOpenLine },
    {
      value: "conflicts",
      label: "Conflicts",
      icon: RiErrorWarningLine,
      badge: conflicts.length,
    },
  ]

  const showDaySwitcher =
    dayKeys.length > 1 && (view === "day" || view === "rooms")

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {header}

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as AgendaView)}
            >
              <TabsList variant="line">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    <tab.icon aria-hidden />
                    {tab.label}
                    {tab.badge ? (
                      <Badge
                        variant="destructive"
                        className="ml-1 h-5 min-w-5 justify-center px-1 text-[11px]"
                      >
                        {tab.badge}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RiLayoutGridLine size={14} aria-hidden />
              All times in {timeZone.replace(/_/g, " ")} (
              {timeZoneAbbreviation(
                timeZone,
                board.event.startsAt ?? Date.now()
              )}
              )
            </p>
          </div>

          <DataToolbar
            value={search}
            onValueChange={setSearch}
            placeholder="Search sessions or speakers…"
            filters={
              showDaySwitcher ? (
                <Tabs
                  value={selectedDay}
                  onValueChange={(value) => setDay(String(value))}
                >
                  <TabsList>
                    {dayKeys.map((key) => (
                      <TabsTrigger
                        key={key}
                        value={key}
                        aria-label={formatDayLabelLong(key)}
                      >
                        {formatDayLabel(key)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : undefined
            }
          />

          {view === "list" ? (
            <ListView
              scheduled={filteredScheduled}
              unscheduled={filteredUnscheduled}
              rooms={board.rooms}
              dayKeys={dayKeys}
              defaultDayKey={selectedDay}
              timeZone={timeZone}
              conflicts={conflicts}
              conflictIds={conflictIds}
            />
          ) : null}

          {view === "day" ? (
            <DayView
              rooms={board.rooms}
              sessions={daySessions}
              unscheduled={filteredUnscheduled}
              conflicts={conflicts}
              conflictIds={conflictIds}
              dayKey={selectedDay}
              dayKeys={dayKeys}
              timeZone={timeZone}
              windowStartMinutes={startMinutes}
              windowEndMinutes={endMinutes}
              focusId={focus}
            />
          ) : null}

          {view === "rooms" ? (
            <RoomsView
              rooms={board.rooms}
              sessions={daySessions}
              conflicts={conflicts}
              conflictIds={conflictIds}
              dayKeys={dayKeys}
              timeZone={timeZone}
              windowStartMinutes={startMinutes}
              windowEndMinutes={endMinutes}
              focusId={focus}
            />
          ) : null}

          {view === "conflicts" ? (
            <ConflictsView
              conflicts={conflicts}
              scheduled={scheduledAll}
              rooms={board.rooms}
              timeZone={timeZone}
              onShowInDay={showInDay}
            />
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}

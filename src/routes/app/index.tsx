import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import {
  RiCalendarScheduleLine,
  RiFileList3Line,
  RiListCheck3,
  RiSettings3Line,
  RiTimeLine,
  RiUserVoiceLine,
} from "@remixicon/react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/lib/session"
import { useCurrentEvent } from "@/lib/current-event"
import { MetricCard, MetricCardSkeleton } from "@/components/dashboard/metric-card"
import {
  StatusCountBar,
  StatusCountBarSkeleton,
} from "@/components/dashboard/status-count-bar"
import { InsightBanner } from "@/components/dashboard/insight-banner"
import {
  TopSpeakersCard,
  TopSpeakersCardSkeleton,
} from "@/components/dashboard/top-speakers-card"
import {
  PacingChart,
  PacingChartSkeleton,
} from "@/components/dashboard/pacing-chart"
import { FormsCard, FormsCardSkeleton } from "@/components/dashboard/forms-card"
import { RemindIncompleteButton } from "@/components/dashboard/remind-incomplete-button"
import { APP_ROUTES } from "@/components/dashboard/app-routes"
import {
  countdownLabel,
  firstNameOf,
  greetingFor,
  longDate,
} from "@/components/dashboard/format"

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
})

/**
 * Organizer dashboard (docs/SPEC.md §4.8) — answers "who do I need to chase?"
 * in one glance, live. Everything on this page comes from a single reactive
 * Convex query, so counts move the moment a speaker acts in their portal.
 */
function DashboardPage() {
  const { session } = useSession()
  const { event, isLoading: eventLoading, isEmpty } = useCurrentEvent()

  // Frozen at first client render: keeps the query result cacheable and the
  // greeting stable while the page is open.
  const [now] = useState(() => Date.now())

  const { data } = useQuery(
    convexQuery(
      api.dashboard.overview,
      event ? { eventId: event._id, now } : "skip",
    ),
  )

  const name = firstNameOf(data?.viewer.name ?? session?.name ?? session?.email ?? "")
  const greeting = `${greetingFor(now)}, ${name}`

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={greeting}
          description="Set up your event and the dashboard fills itself in."
        />
        <EmptyState
          icon={RiSettings3Line}
          title="Create your event to get started"
          description="An event holds your call for papers, submissions, speakers and agenda. It takes under two minutes to set up."
          action={
            <Link to={APP_ROUTES.settings} className={buttonVariants()}>
              Go to settings
            </Link>
          }
        />
      </div>
    )
  }

  const contextLine = [
    longDate(now),
    event ? countdownLabel(now, event.startsAt) : undefined,
    event?.name,
  ]
    .filter(Boolean)
    .join(" · ")

  const missingProfileCount = data
    ? Math.max(data.speakersMissing.bio, data.speakersMissing.headshot)
    : 0
  const speakersWithOpenTasks = data
    ? data.topSpeakersByOutstandingTasks.filter((row) => row.openTaskCount > 0)
        .length
    : 0
  const awaitingDecision = data
    ? data.statusCounts.pending +
      data.statusCounts.accept_queue +
      data.statusCounts.decline_queue
    : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greeting}
        description={
          eventLoading && !event ? (
            <Skeleton className="h-4 w-72" />
          ) : (
            contextLine
          )
        }
        actions={
          event ? (
            <>
              <RemindIncompleteButton
                eventId={event._id}
                incompleteCount={speakersWithOpenTasks}
              />
              <Link
                to={APP_ROUTES.speakers}
                className={buttonVariants({ size: "sm" })}
              >
                <RiUserVoiceLine aria-hidden />
                View speakers
              </Link>
            </>
          ) : null
        }
      />

      {/* ——— Metric cards ——— */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data ? (
          <>
            <MetricCard
              label="Submissions"
              value={data.totalSubmissions}
              icon={RiFileList3Line}
              hint="Everything submitted so far."
              to={APP_ROUTES.submissions}
              linkLabel="Review"
            />
            <MetricCard
              label="Accepted speakers"
              value={data.acceptedSpeakerCount}
              icon={RiUserVoiceLine}
              hint="People confirmed on the program."
              to={APP_ROUTES.speakers}
              linkLabel="Open roster"
            />
            <MetricCard
              label="Outstanding tasks"
              value={data.outstandingTaskCount}
              icon={RiListCheck3}
              hint="Speaker to-dos still not done."
              to={APP_ROUTES.speakers}
              linkLabel="Chase them"
            />
            <MetricCard
              label="Unscheduled"
              value={data.unscheduledAccepted}
              icon={RiCalendarScheduleLine}
              hint="Accepted, but no room or time yet."
              to={APP_ROUTES.agenda}
              linkLabel="Open agenda"
            />
          </>
        ) : (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        )}
      </div>

      {/* ——— Status pill bar ——— */}
      {data ? (
        <StatusCountBar counts={data.statusCounts} />
      ) : (
        <StatusCountBarSkeleton />
      )}

      {/* ——— Insight banners: what needs a human today ——— */}
      {data && missingProfileCount > 0 ? (
        <InsightBanner
          title={`${missingProfileCount} accepted speaker${missingProfileCount === 1 ? " is" : "s are"} missing a bio or headshot`}
          description={`${data.speakersMissing.bio} without a bio · ${data.speakersMissing.headshot} without a headshot. Both show on the public agenda.`}
          to={APP_ROUTES.speakers}
          actionLabel="View speakers"
        />
      ) : null}

      {data && awaitingDecision > 0 ? (
        <InsightBanner
          title={`${awaitingDecision} submission${awaitingDecision === 1 ? " is" : "s are"} awaiting a decision`}
          description="Accept or decline them to send decisions and open speaker portals."
          to={APP_ROUTES.submissions}
          search={{ status: "pending" }}
          actionLabel="Review submissions"
          icon={RiTimeLine}
        />
      ) : null}

      {/* ——— Chase list + pacing ——— */}
      <div className="grid gap-4 lg:grid-cols-3">
        {data ? (
          <>
            <TopSpeakersCard
              rows={data.topSpeakersByOutstandingTasks}
              className="lg:col-span-2"
            />
            <PacingChart data={data.pacing} />
          </>
        ) : (
          <>
            <TopSpeakersCardSkeleton />
            <PacingChartSkeleton />
          </>
        )}
      </div>

      {/* ——— Your forms ——— */}
      {data ? <FormsCard forms={data.forms} /> : <FormsCardSkeleton />}
    </div>
  )
}

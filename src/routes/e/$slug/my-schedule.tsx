import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiBookmarkLine } from "@remixicon/react"

import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { WidgetHeader } from "@/components/public/public-shell"
import { SessionCard } from "@/components/public/session-card"
import { AddToCalendarButton } from "@/components/public/add-to-calendar-button"
import { useMySchedule } from "@/components/public/use-my-schedule"

/**
 * My schedule (sbek EMB-10/EMB-11).
 *
 * The sessions this visitor bookmarked, in time order, grouped by day. No
 * account required: the picks live in this browser and survive reloads, and
 * the whole personal agenda exports as one `.ics`.
 */
export const Route = createFileRoute("/e/$slug/my-schedule")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.schedule, { slug: params.slug }),
    ),
  component: MySchedulePage,
})

function MySchedulePage() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.schedule, { slug }),
  )
  const { ids, count, clear } = useMySchedule(slug)

  if (!data) return null
  const { event } = data

  const saved = new Set<string>(ids)
  const days = data.days
    .map((day) => ({
      ...day,
      sessions: day.sessions.filter((session) => saved.has(session._id)),
    }))
    .filter((day) => day.sessions.length > 0)
  const unscheduled = data.unscheduled.filter((session) =>
    saved.has(session._id),
  )
  const sessions = [...days.flatMap((day) => day.sessions), ...unscheduled]

  return (
    <div className="flex flex-col gap-5">
      <WidgetHeader
        title="My schedule"
        count={
          sessions.length > 0
            ? `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`
            : undefined
        }
        description="The sessions you saved, kept in this browser. Nothing to sign up for."
        actions={
          sessions.length > 0 ? (
            <>
              <AddToCalendarButton
                event={event}
                sessions={sessions}
                label="Add all to calendar"
                filename={`${event.slug}-my-schedule`}
                size="sm"
              />
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear all
              </Button>
            </>
          ) : null
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={RiBookmarkLine}
          title={
            count > 0
              ? "Your saved sessions aren't on the program anymore"
              : "You haven't saved any sessions yet"
          }
          description="Tap the bookmark on any session to build your own agenda. It stays in this browser — no account needed — and you can export it all to your calendar."
          action={
            <Link
              to="/e/$slug"
              params={{ slug }}
              search={(prev) => prev}
              className={buttonVariants({})}
            >
              Browse the schedule
            </Link>
          }
          secondaryAction={
            <Link
              to="/e/$slug/sessions"
              params={{ slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              See all sessions
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col">
          {days.map((day) => (
            <section
              key={day.date}
              className="flex flex-col gap-3 border-t border-border py-5 first:border-t-0 first:pt-0"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {day.label}
              </h3>
              {day.sessions.map((session) => (
                <SessionCard
                  key={session._id}
                  event={event}
                  session={session}
                  options={search}
                  showDate={false}
                />
              ))}
            </section>
          ))}

          {unscheduled.length > 0 ? (
            <section className="flex flex-col gap-3 border-t border-border py-5 first:border-t-0 first:pt-0">
              <h3 className="text-sm font-semibold text-foreground">
                Times to be announced
              </h3>
              {unscheduled.map((session) => (
                <SessionCard
                  key={session._id}
                  event={event}
                  session={session}
                  options={search}
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

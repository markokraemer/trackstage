import { Link, createFileRoute } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiBriefcase4Line,
  RiCalendarEventLine,
  RiUser3Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { DueChip } from "@/components/portal/due-chip"
import { PanelCard } from "@/components/portal/panel-card"
import { ProfileMeter } from "@/components/portal/profile-meter"
import { SubmissionCard } from "@/components/portal/submission-card"
import { SessionCalendarButton } from "@/components/portal/session-calendar-button"
import { usePortal } from "@/components/portal/portal-context"
import {
  fullName,
  initialsOf,
  profileCompleteness,
  submissionCode,
} from "@/components/portal/portal-utils"

export const Route = createFileRoute("/portal/")({
  component: PortalHomePage,
})

/**
 * Portal Home (docs/ux/03 image17): submissions on the left, profile on the
 * right, tasks across the bottom. Every card links to the tab that owns it.
 */
function PortalHomePage() {
  const { home } = usePortal()
  const { me, submissions, tasks, portal } = home
  const total = submissions.length
  const openTasks = tasks.filter((task) => !task.completedAt)
  const doneTasks = tasks.length - openTasks.length
  const completeness = profileCompleteness(me)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <PanelCard
          icon={RiCalendarEventLine}
          title="My submissions"
          count={total}
          action={
            total > 0 ? (
              <Link
                to="/portal/submissions"
                className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                View all
              </Link>
            ) : null
          }
          flush
          bodyClassName="gap-0"
        >
          {total === 0 ? (
            <EmptyState
              variant="plain"
              icon={RiCalendarEventLine}
              title="No submissions yet"
              description="When you submit a talk to this event it will appear here, with its status, from first review through to the final decision."
              className="px-6 py-6"
            />
          ) : (
            <ul className="divide-y divide-border">
              {submissions.slice(0, 3).map((submission, index) => (
                <li key={submission.id}>
                  <SubmissionCard
                    submission={submission}
                    code={submissionCode(index, total)}
                    bare
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/portal/submissions"
                          search={{ open: submission.id }}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                        >
                          View details
                          <RiArrowRightLine aria-hidden />
                        </Link>
                        {/* The home card is deliberately `bare` (no scheduled
                            line), but a speaker who is already on the program
                            should not have to open a drawer to save it. */}
                        <SessionCalendarButton
                          submission={submission}
                          event={home.event}
                          variant="ghost"
                          size="sm"
                        />
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {total > 3 ? (
            <Link
              to="/portal/submissions"
              className="border-t border-border px-6 py-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View all {total} submissions
            </Link>
          ) : null}
        </PanelCard>

        <PanelCard icon={RiUser3Line} title="My profile">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {me.headshotUrl ? <AvatarImage src={me.headshotUrl} alt="" /> : null}
              <AvatarFallback>
                {initialsOf(me.firstName, me.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {fullName(me)}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {me.email}
              </p>
              {me.jobTitle || me.company ? (
                <p className="truncate text-xs text-muted-foreground">
                  {[me.jobTitle, me.company].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          <ProfileMeter me={me} className="mt-1" />

          <Link
            to="/portal/profile"
            className={cn(
              buttonVariants({
                variant: completeness.percent === 100 ? "outline" : "default",
                size: "sm",
              }),
              "mt-1 w-fit",
            )}
          >
            {completeness.percent === 100
              ? "View my profile"
              : "Complete my profile"}
            <RiArrowRightLine aria-hidden />
          </Link>
        </PanelCard>
      </div>

      {/* No Tasks card at all when the organizer keeps the checklist for
          accepted speakers only — see convex/portal.ts `tasksVisible`. */}
      {!portal.tasksVisible ? null : (
      <PanelCard
        icon={RiBriefcase4Line}
        title="Tasks"
        action={
          tasks.length > 0 ? (
            <Link
              to="/portal/tasks"
              className="inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View all
            </Link>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium text-foreground">
            {openTasks.length === 0
              ? "You're all caught up"
              : `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}`}
          </span>
          <span className="text-muted-foreground">
            {doneTasks} of {tasks.length} complete
          </span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The organizers haven't asked you for anything yet. When they need a
            headshot, your slides, or a confirmation, it will show up here.
          </p>
        ) : openTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every task the organizers assigned you is done. Nothing to do right
            now.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {openTasks.slice(0, 4).map((task) => (
              <li key={task.id}>
                {/* The whole row is the tap target — 44px tall, which is what
                    a thumb needs. */}
                <Link
                  to="/portal/tasks"
                  className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border border-dashed border-muted-foreground/50"
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {task.title}
                  </span>
                  <DueChip dueAt={task.dueAt} locked={task.locked} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {openTasks.length > 0 ? (
          <Link to="/portal/tasks" className={buttonVariants({ size: "sm", className: "w-fit" })}>
            Go to my tasks
            <RiArrowRightLine aria-hidden />
          </Link>
        ) : null}
      </PanelCard>
      )}
    </div>
  )
}

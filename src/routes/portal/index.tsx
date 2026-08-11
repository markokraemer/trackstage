import { Link, createFileRoute } from "@tanstack/react-router"
import {
  RiArrowRightLine,
  RiBriefcase4Line,
  RiCalendarEventLine,
  RiCheckLine,
  RiUser3Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PanelCard } from "@/components/portal/panel-card"
import { SubmissionCard } from "@/components/portal/submission-card"
import { usePortal } from "@/components/portal/portal-context"
import {
  dueInfo,
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
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Home
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your submissions, your speaker profile, and anything the organizers
          still need from you.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <PanelCard
          icon={RiCalendarEventLine}
          title={`My Submissions (${total})`}
          action={
            total > 0 ? (
              <Link
                to="/portal/submissions"
                className="font-medium text-primary-foreground/90 underline-offset-4 hover:underline"
              >
                View All
              </Link>
            ) : null
          }
        >
          {total === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-foreground">
                No submissions yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                When you submit a talk to this event it will appear here, with
                its status, from first review through to the final decision.
              </p>
            </div>
          ) : (
            submissions.slice(0, 3).map((submission, index) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                code={submissionCode(index, total)}
                action={
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
                }
              />
            ))
          )}
          {total > 3 ? (
            <Link
              to="/portal/submissions"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View all {total} submissions
            </Link>
          ) : null}
        </PanelCard>

        <PanelCard icon={RiUser3Line} title="My Profile">
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

          <div className="mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                Profile {completeness.percent}% complete
              </span>
              <span className="text-muted-foreground">
                {completeness.done} of {completeness.total}
              </span>
            </div>
            <Progress
              value={completeness.percent}
              className="mt-1.5"
              aria-label="Profile completeness"
            />
            <ul className="mt-3 grid gap-1.5">
              {completeness.items.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full",
                      item.done
                        ? "bg-status-green-bg text-status-green-fg"
                        : "border border-dashed border-border",
                    )}
                  >
                    {item.done ? <RiCheckLine size={11} /> : null}
                  </span>
                  <span className={cn(item.done && "text-foreground")}>
                    {item.label}
                  </span>
                  <span className="sr-only">
                    {item.done ? "added" : "still missing"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

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
          <Link
            to="/portal/tasks"
            className="font-medium text-primary-foreground/90 underline-offset-4 hover:underline"
          >
            View All
          </Link>
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
          <ul className="divide-y divide-border rounded-lg border border-border">
            {openTasks.slice(0, 4).map((task) => {
              const due = dueInfo(task.dueAt)
              return (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"
                >
                  <span className="size-4 shrink-0 rounded-full border border-dashed border-border" />
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {task.title}
                  </span>
                  {due ? (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        due.tone === "overdue"
                          ? "text-destructive"
                          : due.tone === "soon"
                            ? "text-status-amber-fg"
                            : "text-muted-foreground",
                      )}
                    >
                      {due.label}
                    </span>
                  ) : null}
                </li>
              )
            })}
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

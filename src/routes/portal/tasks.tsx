import { useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiBriefcase4Line, RiCheckDoubleLine } from "@remixicon/react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PanelCard } from "@/components/portal/panel-card"
import { TaskItem } from "@/components/portal/task-item"
import { usePortal } from "@/components/portal/portal-context"
import type { PortalUpload } from "@/components/portal/portal-context"

export const Route = createFileRoute("/portal/tasks")({
  component: PortalTasksPage,
})

/**
 * Tasks tab (docs/SPEC.md §4.7): the speaker's checklist. Confirmations are one
 * click; file requests upload inline and keep every version with its approval
 * status, so "changes requested" never means starting an email thread.
 */
function PortalTasksPage() {
  const { portalToken, home } = usePortal()
  const tasks = home.tasks
  const tasksVisible = home.portal.tasksVisible

  const { data: uploads, isPending } = useQuery(
    convexQuery(api.portal.myUploads, { portalToken }),
  )

  const byTask = useMemo(() => {
    const map = new Map<string, Array<PortalUpload>>()
    for (const file of uploads ?? []) {
      if (!file.taskId) continue
      const list = map.get(file.taskId) ?? []
      list.push(file)
      map.set(file.taskId, list)
    }
    for (const list of map.values()) list.sort((a, b) => b.version - a.version)
    return map
  }, [uploads])

  const open = tasks.filter((task) => !task.completedAt)
  const done = tasks.filter((task) => task.completedAt)
  const percent =
    tasks.length === 0 ? 0 : Math.round((done.length / tasks.length) * 100)

  return (
    <div className="flex flex-col gap-4">
      {!tasksVisible ? (
        // The tab is hidden in this case, but the URL is still reachable —
        // explain rather than showing an empty list.
        <EmptyState
          icon={RiBriefcase4Line}
          title="Tasks open once a session is accepted"
          description="The organizers of this event only send tasks — headshots, slides, confirmations — to speakers whose session has been accepted. Keep an eye on your submissions; anything they need from you will appear here."
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={RiBriefcase4Line}
          title="Nothing to do right now"
          description="Tasks are the things the organizers need from you — a headshot, your slides, a confirmation. When they assign one, it appears here with its due date."
        />
      ) : (
        <>
          <Card size="sm">
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {open.length === 0
                    ? "You're all caught up"
                    : `${open.length} still to do`}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {done.length} of {tasks.length} complete
                </p>
              </div>
              <Progress
                value={percent}
                className="mt-2"
                aria-label={`${done.length} of ${tasks.length} tasks complete`}
              />
            </CardContent>
          </Card>

          {isPending ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <>
              <PanelCard
                icon={RiBriefcase4Line}
                title="To do"
                count={open.length}
                flush
                bodyClassName="gap-0"
              >
                {open.length === 0 ? (
                  <p className="px-6 py-6 text-center text-sm text-muted-foreground">
                    Every task is done. Nothing is waiting on you.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {open.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        uploads={byTask.get(task.id) ?? []}
                      />
                    ))}
                  </ul>
                )}
              </PanelCard>

              {done.length > 0 ? (
                <PanelCard
                  icon={RiCheckDoubleLine}
                  title="Completed"
                  count={done.length}
                  flush
                  bodyClassName="gap-0"
                >
                  <ul className="divide-y divide-border">
                    {done.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        uploads={byTask.get(task.id) ?? []}
                      />
                    ))}
                  </ul>
                </PanelCard>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  )
}

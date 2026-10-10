import { createFileRoute } from "@tanstack/react-router"

import { TasksPage } from "@/components/portal/tasks-page"

// Personal tasks the organizers assigned to this contact — the same checklist
// as the speaker portal's Tasks tab. The tab only appears when there are any.
export const Route = createFileRoute("/sponsor/tasks")({
  component: TasksPage,
})

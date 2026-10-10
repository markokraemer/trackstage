import { createFileRoute } from "@tanstack/react-router"

import { TasksPage } from "@/components/portal/tasks-page"

// Same checklist as the speaker portal's Tasks tab.
export const Route = createFileRoute("/sponsor/tasks")({
  component: TasksPage,
})

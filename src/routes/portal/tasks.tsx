import { createFileRoute } from "@tanstack/react-router"

import { TasksPage } from "@/components/portal/tasks-page"

// The page body is shared with the sponsor portal (`/sponsor/tasks`).
export const Route = createFileRoute("/portal/tasks")({
  component: TasksPage,
})

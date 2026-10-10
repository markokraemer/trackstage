import { createFileRoute } from "@tanstack/react-router"

import { ProfilePage } from "@/components/portal/profile-page"

// The page body is shared with the sponsor portal (`/sponsor/profile`).
export const Route = createFileRoute("/portal/profile")({
  component: ProfilePage,
})

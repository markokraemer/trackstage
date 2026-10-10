import { createFileRoute } from "@tanstack/react-router"

import { ProfilePage } from "@/components/portal/profile-page"

// Same page as the speaker portal's Profile tab — one person, one profile.
export const Route = createFileRoute("/sponsor/profile")({
  component: ProfilePage,
})

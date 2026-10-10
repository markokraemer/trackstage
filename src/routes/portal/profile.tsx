import { createFileRoute } from "@tanstack/react-router"

import { ProfilePage } from "@/components/portal/profile-page"

// The speaker profile — bio, headshot, links — lives only in the speaker portal.
export const Route = createFileRoute("/portal/profile")({
  component: ProfilePage,
})

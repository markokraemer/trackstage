// LEGACY bare path — see src/routes/app/speakers/index.tsx.
import { createFileRoute } from "@tanstack/react-router"

import { LegacyAppRedirect } from "@/components/shell/legacy-redirect"
import { appLink } from "@/lib/app-links"

export const Route = createFileRoute("/app/sponsors/")({
  component: () => <LegacyAppRedirect to={appLink.sponsors} section="sponsors" />,
})

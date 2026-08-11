// LEGACY bare path — pre-hierarchy shape, kept forever
// (docs/memory/DECISIONS.md, "URL architecture is fully hierarchical").
// Redirects to the canonical `/app/:ws/:event/…` address of the event in
// context via the stored pointer (src/components/shell/legacy-redirect.tsx).
import { createFileRoute } from "@tanstack/react-router"

import { LegacyAppRedirect } from "@/components/shell/legacy-redirect"
import { appLink } from "@/lib/app-links"

export const Route = createFileRoute("/app/files/")({
  component: () => <LegacyAppRedirect to={appLink.files} />,
})

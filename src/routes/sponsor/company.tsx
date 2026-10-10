import { createFileRoute } from "@tanstack/react-router"

import { CompanyProfileEditor } from "@/components/portal/sponsor/company-profile-editor"

/** Sponsor portal → Company: the public face the sponsor maintains itself. */
export const Route = createFileRoute("/sponsor/company")({
  component: CompanyProfileEditor,
})

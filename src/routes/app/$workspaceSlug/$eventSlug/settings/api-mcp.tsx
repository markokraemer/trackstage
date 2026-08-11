import { createFileRoute, redirect } from "@tanstack/react-router"

import { appLink } from "@/lib/app-links"

/**
 * `/app/…/settings/api-mcp` moved — API keys are personal, not event-level
 * (docs/memory/RULES.md 21 + 23b), so they live on the account-settings
 * page's API & MCP tab.
 *
 * The route file stays as a redirect so old bookmarks and deep links from the
 * eval kit keep resolving, landing straight on the right tab.
 */
export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/api-mcp")({
  beforeLoad: () => {
    throw redirect({ to: appLink.account, search: { tab: "api-mcp" } })
  },
})

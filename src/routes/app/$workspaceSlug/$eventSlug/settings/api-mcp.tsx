import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * `/app/…/settings/api-mcp` moved — API keys are personal, not event-level
 * (docs/memory/RULES.md 21 + 23b), so they live on the ACCOUNT settings
 * modal's API & MCP tab now.
 *
 * The route file stays as a redirect so old bookmarks and deep links from the
 * eval kit keep resolving: it lands back on this event's settings page with
 * the account modal open on the right tab.
 */
export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/settings/api-mcp")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/$workspaceSlug/$eventSlug/settings",
      params,
      search: { settings: "account", settingsTab: "api-mcp" },
    })
  },
})

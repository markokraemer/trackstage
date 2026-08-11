import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * `/app/settings/api-mcp` moved — API keys are personal, not event-level, so
 * they live in the account-settings modal now (docs/memory/RULES.md 21 + 23b).
 *
 * The route file stays as a redirect so old bookmarks and deep links from the
 * eval kit keep resolving: it forwards to the shell with `?account=api-mcp`,
 * which `/app`'s search-param reader opens as the modal, on the API & MCP tab.
 */
export const Route = createFileRoute("/app/settings/api-mcp")({
  beforeLoad: () => {
    throw redirect({ to: "/app", search: { account: "api-mcp" } })
  },
})

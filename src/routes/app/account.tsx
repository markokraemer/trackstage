import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * `/app/account` used to be a full page — it's a modal now, opened from the
 * avatar menu (docs/memory/RULES.md 23b: account settings is personal, so it
 * floats over whatever you were doing rather than navigating you away).
 *
 * The route file stays as a redirect so old bookmarks and deep links from the
 * eval kit keep resolving: it forwards to the shell with `?account=profile`,
 * which `/app`'s search-param reader opens as the modal.
 */
export const Route = createFileRoute("/app/account")({
  beforeLoad: () => {
    throw redirect({ to: "/app", search: { account: "profile" } })
  },
})

import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiCalendarEventLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { PublicShell } from "@/components/public/public-shell"
import { validateWidgetSearch } from "@/components/public/widget-search"

/**
 * Public event pages — canonical `/e/:workspaceSlug/:eventSlug`
 * (docs/memory/DECISIONS.md, "URL architecture is fully hierarchical").
 *
 * Everything under here is anonymous: no login, no organizer chrome. The same
 * routes double as embeddable widgets (`?embed=1` renders them bare for an
 * `<iframe>`), which is why the display options live in the search params and
 * are validated once, here, for the whole subtree.
 *
 * LEGACY: before workspaces entered the address, `/e/:eventSlug/…` was the
 * whole link and organizers printed it. A two-segment path that doesn't
 * resolve canonically is therefore re-read with its FIRST segment as an event
 * slug (`/e/summit/speakers`), resolved oldest-claimant, and 307'd to the
 * canonical address with the remainder of the path intact.
 */
export const Route = createFileRoute("/e/$workspaceSlug/$eventSlug")({
  validateSearch: validateWidgetSearch,
  loader: async ({ context, params, location }) => {
    const canonical = await context.queryClient.ensureQueryData(
      convexQuery(api.events.getBySlug, {
        slug: params.eventSlug,
        workspaceSlug: params.workspaceSlug,
      }),
    )
    if (canonical) return canonical
    const legacy = await context.queryClient.ensureQueryData(
      convexQuery(api.events.getBySlug, { slug: params.workspaceSlug }),
    )
    if (legacy) {
      const prefix = `/e/${params.workspaceSlug}`
      const rest = location.pathname.startsWith(prefix)
        ? location.pathname.slice(prefix.length)
        : ""
      throw redirect({
        href: `${legacy.canonicalPath}${rest}${location.searchStr}`,
        statusCode: 307,
        replace: true,
      })
    }
    return null
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — Schedule & Speakers`
          : "Event — Trackstage",
      },
      {
        name: "description",
        content: loaderData
          ? `Schedule, sessions and speakers for ${loaderData.name}.`
          : "Public event schedule and speakers.",
      },
    ],
  }),
  component: PublicEventLayout,
})

function PublicEventLayout() {
  const { workspaceSlug, eventSlug: slug } = Route.useParams()
  const { embed } = Route.useSearch()
  const { data: event } = useSuspenseQuery(
    convexQuery(api.events.getBySlug, { slug, workspaceSlug }),
  )

  if (!event) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <EmptyState
          icon={RiCalendarEventLine}
          title="We couldn't find that event"
          description={`No public event is published at "${slug}". Check the link with the organizer — it may have changed.`}
          action={
            <Link to="/" className={buttonVariants({ variant: "outline" })}>
              Go to Trackstage
            </Link>
          }
          className="max-w-lg"
        />
      </main>
    )
  }

  return (
    <PublicShell event={event} embed={Boolean(embed)}>
      <Outlet />
    </PublicShell>
  )
}

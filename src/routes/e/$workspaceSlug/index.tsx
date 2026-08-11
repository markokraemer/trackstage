import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiCalendarEventLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"

/**
 * `/e/:slug` — the LEGACY one-segment public event address.
 *
 * Before the hierarchical scheme (docs/memory/DECISIONS.md, "URL architecture
 * is fully hierarchical") an event slug WAS the whole address, and it went on
 * slides, in emails and into sbek's notes. The param is called
 * `workspaceSlug` only because it shares a directory with the canonical tree;
 * at THIS depth the one segment is an event slug. Oldest claimant wins (see
 * `convex/lib/publicLinks.ts`), then a 307 to `/e/:ws/:event`.
 */
export const Route = createFileRoute("/e/$workspaceSlug/")({
  loader: async ({ context, params, location }) => {
    const event = await context.queryClient.ensureQueryData(
      convexQuery(api.events.getBySlug, { slug: params.workspaceSlug }),
    )
    if (event) {
      throw redirect({
        href: `${event.canonicalPath}${location.searchStr}`,
        statusCode: 307,
        replace: true,
      })
    }
    return null
  },
  component: LegacyEventLink,
})

function LegacyEventLink() {
  // Only reachable when nothing matched — a match redirects from the loader.
  const { workspaceSlug: slug } = Route.useParams()
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

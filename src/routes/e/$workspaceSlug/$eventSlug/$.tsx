import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiCalendarEventLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"

/**
 * Deep LEGACY public paths — `/e/:eventSlug/sessions/:id`,
 * `/e/:eventSlug/itinerary/:personId`, and anything else printed before the
 * workspace segment existed.
 *
 * Such a path parses against the canonical tree as
 * `/e/$workspaceSlug/$eventSlug/<unknown child>`, which no leaf route claims —
 * so it lands here. If the FIRST segment resolves as a legacy event slug, the
 * whole remainder is carried onto the canonical address with a 307; otherwise
 * it is a genuine 404.
 */
export const Route = createFileRoute("/e/$workspaceSlug/$eventSlug/$")({
  loader: async ({ context, params, location }) => {
    // When the two parent segments DO resolve canonically, this splat is a
    // plain 404 inside that event's shell — re-reading the first segment as
    // an event slug there could hijack `/e/:ws/:event/typo` onto an unrelated
    // event that happens to share the workspace's name.
    const canonical = await context.queryClient.ensureQueryData(
      convexQuery(api.events.getBySlug, {
        slug: params.eventSlug,
        workspaceSlug: params.workspaceSlug,
      }),
    )
    if (canonical) return null
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
  component: LegacyDeepLink,
})

function LegacyDeepLink() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <EmptyState
        icon={RiCalendarEventLine}
        title="We couldn't find that page"
        description="This link doesn't match anything on the public schedule. Check it with the organizer — it may have changed."
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

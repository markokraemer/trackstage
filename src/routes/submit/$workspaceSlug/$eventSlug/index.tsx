import { createFileRoute, redirect } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { NotFoundCard, SubmitSkeleton } from "@/components/submit/outcome-cards"

/**
 * `/submit/:eventSlug/:formSlug` — the LEGACY two-segment call-for-speakers
 * address (canonical before workspaces entered the URL).
 *
 * Every link an organizer ever printed, emailed or put on a slide has to keep
 * working (docs/memory/DECISIONS.md, "URL architecture is fully
 * hierarchical"), so this resolves the pair across every workspace and 307s
 * to the canonical `/submit/:ws/:event/:form`. Where several events claim the
 * slug, the oldest claimant wins (see `convex/lib/publicLinks.ts` for why).
 *
 * The params are called `workspaceSlug`/`eventSlug` because this file sits in
 * the canonical directory; at THIS depth they are really event + form slugs.
 */
export const Route = createFileRoute("/submit/$workspaceSlug/$eventSlug/")({
  loader: async ({ context, params, location }) => {
    const resolved = await context.queryClient.ensureQueryData(
      convexQuery(api.submit.resolveLegacyLink, {
        slug: params.eventSlug,
        eventSlug: params.workspaceSlug,
      }),
    )
    if (resolved.status === "found") {
      throw redirect({
        to: "/submit/$workspaceSlug/$eventSlug/$formSlug",
        params: {
          workspaceSlug: resolved.workspaceSlug,
          eventSlug: resolved.eventSlug,
          formSlug: resolved.formSlug,
        },
        search: (current) => current,
        statusCode: 307,
        replace: true,
      })
    }
    // A one-segment legacy link may also parse here when someone appends a
    // trailing slash; nothing else claims the pair, so this is a miss.
    void location
    return resolved
  },
  pendingComponent: SubmitSkeleton,
  component: LegacySubmitLink,
})

function LegacySubmitLink() {
  // Only reachable when nothing matched — a match redirects from the loader.
  const { workspaceSlug, eventSlug } = Route.useParams()
  return <NotFoundCard slug={`${workspaceSlug}/${eventSlug}`} />
}

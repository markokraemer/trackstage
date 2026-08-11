import { createFileRoute, redirect } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { NotFoundCard, SubmitSkeleton } from "@/components/submit/outcome-cards"

/**
 * `/submit/:slug` — the LEGACY one-segment call-for-speakers address, from
 * before form slugs were namespaced at all.
 *
 * It resolves the slug across every event in every workspace (oldest claimant
 * wins — see `convex/lib/publicLinks.ts`) and 307s to the canonical
 * `/submit/:ws/:event/:form`. The param is called `workspaceSlug` because it
 * shares a directory with the canonical route; at THIS depth the one segment
 * is a form slug.
 */
export const Route = createFileRoute("/submit/$workspaceSlug/")({
  loader: async ({ context, params }) => {
    const resolved = await context.queryClient.ensureQueryData(
      convexQuery(api.submit.resolveLegacyLink, { slug: params.workspaceSlug }),
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
    return resolved
  },
  pendingComponent: SubmitSkeleton,
  component: LegacySubmitLink,
})

function LegacySubmitLink() {
  // Only reachable when nothing matched — a match redirects from the loader.
  const { workspaceSlug: slug } = Route.useParams()
  return <NotFoundCard slug={slug} />
}

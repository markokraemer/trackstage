import { createFileRoute, redirect } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"

import { NotFoundCard, SubmitSkeleton } from "@/components/submit/outcome-cards"

/**
 * `/submit/:slug` — the LEGACY one-segment call-for-speakers address.
 *
 * Every link an organizer ever printed, emailed or put on a slide has to keep
 * working (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical"), so
 * this resolves the slug across every event and sends the speaker on to the
 * canonical `/submit/:eventSlug/:formSlug`. When more than one event claims the
 * slug, the oldest claimant wins — the form that held the address when the link
 * was printed keeps it (see `convex/lib/publicLinks.ts` for why).
 *
 * The route param is called `eventSlug` because it shares a directory with the
 * canonical route; at THIS depth the segment is really "some slug", and it is
 * read as a form slug.
 */
export const Route = createFileRoute("/submit/$eventSlug/")({
  loader: async ({ context, params }) => {
    const resolved = await context.queryClient.ensureQueryData(
      convexQuery(api.submit.resolveLegacyLink, { slug: params.eventSlug }),
    )
    if (resolved.status === "found") {
      throw redirect({
        to: "/submit/$eventSlug/$formSlug",
        params: {
          eventSlug: resolved.eventSlug,
          formSlug: resolved.formSlug,
        },
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
  const { eventSlug: slug } = Route.useParams()
  return <NotFoundCard slug={slug} />
}

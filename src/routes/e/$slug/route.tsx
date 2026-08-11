import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiCalendarEventLine } from "@remixicon/react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { PublicShell } from "@/components/public/public-shell"
import { validateWidgetSearch } from "@/components/public/widget-search"

/**
 * Public event pages — `/e/$slug`.
 *
 * Everything under here is anonymous: no login, no organizer chrome. The same
 * routes double as embeddable widgets (`?embed=1` renders them bare for an
 * `<iframe>`), which is why the display options live in the search params and
 * are validated once, here, for the whole subtree.
 */
export const Route = createFileRoute("/e/$slug")({
  validateSearch: validateWidgetSearch,
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.events.getBySlug, { slug: params.slug }),
    ),
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
  const { slug } = Route.useParams()
  const { embed } = Route.useSearch()
  const { data: event } = useSuspenseQuery(
    convexQuery(api.events.getBySlug, { slug }),
  )

  if (!event) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-6">
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
      </div>
    )
  }

  return (
    <PublicShell event={event} embed={Boolean(embed)}>
      <Outlet />
    </PublicShell>
  )
}

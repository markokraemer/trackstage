import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiCalendarEventLine, RiEyeOffLine } from "@remixicon/react"

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
  const { embed, e: embedId, accent, brand } = Route.useSearch()
  const { data: event } = useSuspenseQuery(
    convexQuery(api.events.getBySlug, { slug, workspaceSlug }),
  )
  // Only snippets copied out of a SAVED embed carry `?e=` — everything else
  // skips this round-trip entirely. An unknown id answers "enabled", so a
  // hand-written link (or one whose saved row was deleted) keeps working.
  const { data: embedState } = useQuery(
    convexQuery(api.embeds.publicState, embedId ? { embedId } : "skip"),
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

  // The off switch (sbek EMB-15). The organizer flipped this embed off in
  // Embeds → Saved embeds, so every copy of the snippet already pasted around
  // the web says so — calmly, and without leaking the programme it used to
  // show. The colour and header options ride in from the same saved row, so a
  // widget looks like the site it lives on rather than like us.
  if (embedState && !embedState.enabled) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <EmptyState
          icon={RiEyeOffLine}
          title="This embed is turned off"
          description={`The organizers of ${event.name} have turned this widget off for now. It will reappear here the moment they turn it back on.`}
          className="max-w-lg"
        />
      </main>
    )
  }

  return (
    <PublicShell
      event={event}
      embed={Boolean(embed)}
      accent={accent ?? embedState?.accent ?? undefined}
      brandHeader={Boolean(brand) || embedState?.showHeader === true}
    >
      <Outlet />
    </PublicShell>
  )
}

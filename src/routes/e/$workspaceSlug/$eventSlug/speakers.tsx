import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiGalleryLine, RiListUnordered, RiUserVoiceLine } from "@remixicon/react"

import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { WidgetHeader } from "@/components/public/public-shell"
import {
  SpeakerDirectory,
  SpeakerGallery,
} from "@/components/public/speaker-gallery"
import { segmentedGroup, segmentedItem } from "@/components/public/segmented"
import { formatRange } from "@/components/public/format"
import {
  useSearchParamWriter,
  useUrlText,
} from "@/components/public/use-url-text"
import {
  matchesTrackFilter,
  trackFilter,
  trackFilterLabel,
} from "@/components/public/widget-search"
import type { PublicSpeakerRow } from "@/components/public/types"

/**
 * Speaker gallery + speaker directory (sbek EMB-04/05/12/13).
 *
 * Alphabetical by surname (the backend already sorts it that way), searchable
 * by name, with two presentations chosen by `?view=`: a photo grid (default)
 * or a directory that lists each speaker's sessions inline.
 */
export const Route = createFileRoute("/e/$workspaceSlug/$eventSlug/speakers")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.speakers, { slug: params.eventSlug, workspaceSlug: params.workspaceSlug }),
    ),
  component: SpeakersPage,
})

function SpeakersPage() {
  const { workspaceSlug, eventSlug: slug } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.speakers, { slug, workspaceSlug }),
  )
  const setParams = useSearchParamWriter()
  const [query, setQuery] = useUrlText(search.q, (value) =>
    setParams({ q: value }),
  )

  if (!data) return null
  const { event } = data
  const view = search.view === "list" ? "list" : "gallery"

  // One track name or several, comma-separated — a speaker stays if any of
  // their sessions is on one of them (sbek EMB-15).
  const wantedTracks = trackFilter(search.track)
  const needle = query.trim().toLowerCase()

  const speakers = data.speakers.filter((speaker: PublicSpeakerRow) => {
    if (
      wantedTracks.length > 0 &&
      !speaker.sessions.some((session) =>
        matchesTrackFilter(wantedTracks, session.track?.name),
      )
    ) {
      return false
    }
    if (!needle) return true
    const haystack = [
      speaker.name,
      speaker.jobTitle,
      speaker.company,
      ...speaker.sessions.map((session) => session.title),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(needle)
  })

  return (
    <div className="flex flex-col gap-5">
      <WidgetHeader
        title="Speakers"
        count={formatRange(speakers.length, data.totalResults)}
        description="Open a speaker to read their bio and see everything they're presenting."
        actions={
          <div className={segmentedGroup}>
            <ViewPill
              workspaceSlug={workspaceSlug}
              slug={slug}
              view="gallery"
              active={view === "gallery"}
              label="Gallery"
            />
            <ViewPill
              workspaceSlug={workspaceSlug}
              slug={slug}
              view="list"
              active={view === "list"}
              label="List"
            />
          </div>
        }
      />

      {search.hideSearch ? null : (
        <DataToolbar
          value={query}
          onValueChange={setQuery}
          placeholder="Search speaker by name"
          searchLabel="Search speakers"
        />
      )}

      {data.totalResults === 0 ? (
        <EmptyState
          icon={RiUserVoiceLine}
          title="No speakers announced yet"
          description="Speakers appear here once the organizer accepts their session. Check back soon — or browse the schedule in the meantime."
          action={
            <Link
              to="/e/$workspaceSlug/$eventSlug"
              params={{ workspaceSlug, eventSlug: slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              View the schedule
            </Link>
          }
        />
      ) : speakers.length === 0 ? (
        <EmptyState
          icon={RiUserVoiceLine}
          title={
            query
              ? `No speakers match "${query}"`
              : `No speakers on ${trackFilterLabel(search.track) ?? "this track"}`
          }
          description="Try part of a name, a company, or clear the search to see everyone."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setParams({ q: undefined, track: undefined })
              }}
            >
              Clear search
            </Button>
          }
        />
      ) : view === "gallery" ? (
        <SpeakerGallery
          workspaceSlug={workspaceSlug}
          event={event}
          speakers={speakers}
          options={search}
        />
      ) : (
        <SpeakerDirectory
          workspaceSlug={workspaceSlug}
          event={event}
          speakers={speakers}
          options={search}
        />
      )}
    </div>
  )
}

function ViewPill({
  workspaceSlug,
  slug,
  view,
  active,
  label,
}: {
  workspaceSlug: string
  slug: string
  view: "gallery" | "list"
  active: boolean
  label: string
}) {
  const Icon = view === "gallery" ? RiGalleryLine : RiListUnordered
  return (
    <Link
      to="/e/$workspaceSlug/$eventSlug/speakers"
      params={{ workspaceSlug, eventSlug: slug }}
      search={(prev) => ({ ...prev, view })}
      data-active={active ? "true" : undefined}
      className={segmentedItem(active)}
    >
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  )
}

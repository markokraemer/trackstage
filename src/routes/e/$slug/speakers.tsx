import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiGalleryLine, RiListUnordered, RiUserVoiceLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { WidgetHeader } from "@/components/public/public-shell"
import {
  SpeakerDirectory,
  SpeakerGallery,
} from "@/components/public/speaker-gallery"
import { formatRange } from "@/components/public/format"
import type { PublicSpeakerRow } from "@/components/public/types"

/**
 * Speaker gallery + speaker directory (sbek EMB-04/05/12/13).
 *
 * Alphabetical by surname (the backend already sorts it that way), searchable
 * by name, with two presentations chosen by `?view=`: a photo grid (default)
 * or a directory that lists each speaker's sessions inline.
 */
export const Route = createFileRoute("/e/$slug/speakers")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.speakers, { slug: params.slug }),
    ),
  component: SpeakersPage,
})

function SpeakersPage() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.speakers, { slug }),
  )
  const [query, setQuery] = useState(search.q ?? "")

  if (!data) return null
  const { event } = data
  const view = search.view === "list" ? "list" : "gallery"

  const trackFilter = search.track?.toLowerCase()
  const needle = query.trim().toLowerCase()

  const speakers = data.speakers.filter((speaker: PublicSpeakerRow) => {
    if (
      trackFilter &&
      !speaker.sessions.some(
        (session) => session.track?.name.toLowerCase() === trackFilter,
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
        description="Tap a speaker to read their bio and see everything they're presenting."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
            <ViewPill
              slug={slug}
              view="gallery"
              active={view === "gallery"}
              label="Gallery"
            />
            <ViewPill
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
            <Button nativeButton={false}
              variant="outline"
              render={
                <Link to="/e/$slug" params={{ slug }} search={(prev) => prev} />
              }
            >
              View the schedule
            </Button>
          }
        />
      ) : speakers.length === 0 ? (
        <EmptyState
          icon={RiUserVoiceLine}
          title={`No speakers match "${query}"`}
          description="Try part of a name, a company, or clear the search to see everyone."
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : view === "gallery" ? (
        <SpeakerGallery event={event} speakers={speakers} options={search} />
      ) : (
        <SpeakerDirectory event={event} speakers={speakers} options={search} />
      )}
    </div>
  )
}

function ViewPill({
  slug,
  view,
  active,
  label,
}: {
  slug: string
  view: "gallery" | "list"
  active: boolean
  label: string
}) {
  const Icon = view === "gallery" ? RiGalleryLine : RiListUnordered
  return (
    <Link
      to="/e/$slug/speakers"
      params={{ slug }}
      search={(prev) => ({ ...prev, view })}
      aria-current={active ? "true" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "gap-1.5 rounded-full px-3 text-muted-foreground",
        active && "bg-accent font-semibold text-accent-foreground",
      )}
    >
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  )
}

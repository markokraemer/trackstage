import { Link, createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiFileList3Line, RiFilter3Line } from "@remixicon/react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { WidgetHeader } from "@/components/public/public-shell"
import { SessionCard } from "@/components/public/session-card"
import { formatRange } from "@/components/public/format"
import {
  useSearchParamWriter,
  useUrlText,
} from "@/components/public/use-url-text"
import type { PublicSession } from "@/components/public/types"

/**
 * Sessions catalog (sbek EMB-01/02/03).
 *
 * The searchable, filterable list of everything on the program. Search matches
 * session titles AND speaker names — attendees look for both. Filters are real
 * dropdowns (Track / Format / Room), and the result count updates in place so
 * it is always obvious how much the filters removed.
 *
 * Every filter lives in the URL (`?q=&track=&format=&room=`): a filtered view
 * is a link you can send someone, the back button undoes one filter at a time,
 * and the organizer's embed builder can pre-seed any of them.
 */
export const Route = createFileRoute("/e/$slug/sessions/")({
  loader: async ({ context, params }) =>
    await context.queryClient.ensureQueryData(
      convexQuery(api.publicData.sessionsList, { slug: params.slug }),
    ),
  component: SessionsPage,
})

const ALL_TRACKS = "All tracks"
const ALL_FORMATS = "All formats"
const ALL_ROOMS = "All rooms"

function SessionsPage() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    convexQuery(api.publicData.sessionsList, { slug }),
  )
  const setParams = useSearchParamWriter()
  const [query, setQuery] = useUrlText(search.q, (value) =>
    setParams({ q: value }),
  )

  if (!data) return null
  const { event, facets } = data

  const track = search.track ?? ALL_TRACKS
  const format = search.format ?? ALL_FORMATS
  const room = search.room ?? ALL_ROOMS

  const needle = query.trim().toLowerCase()
  const eq = (a: string | undefined | null, b: string) =>
    (a ?? "").toLowerCase() === b.toLowerCase()

  const sessions = data.sessions.filter((session: PublicSession) => {
    if (track !== ALL_TRACKS && !eq(session.track?.name, track)) return false
    if (format !== ALL_FORMATS && !eq(session.format, format)) return false
    if (room !== ALL_ROOMS && !eq(session.room?.name, room)) return false
    if (!needle) return true
    const haystack = [
      session.title,
      session.description,
      session.track?.name,
      session.format,
      session.room?.name,
      ...session.speakers.flatMap((speaker) => [
        speaker.name,
        speaker.jobTitle,
        speaker.company,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(needle)
  })

  const filtered =
    needle !== "" ||
    track !== ALL_TRACKS ||
    format !== ALL_FORMATS ||
    room !== ALL_ROOMS

  const resetFilters = () => {
    setQuery("")
    setParams({ q: undefined, track: undefined, format: undefined, room: undefined })
  }

  return (
    <div className="flex flex-col gap-5">
      <WidgetHeader
        title="Sessions"
        count={formatRange(sessions.length, data.totalResults)}
        description="Everything on the program. Search by session title or speaker, or narrow it down by track."
      />

      {search.hideSearch ? null : (
        <DataToolbar
          value={query}
          onValueChange={setQuery}
          placeholder="Search by speaker details or session title"
          searchLabel="Search sessions"
          filters={
            <>
              {facets.tracks.length > 0 ? (
                <FacetSelect
                  label="Track"
                  value={track}
                  onChange={(value) =>
                    setParams({
                      track: value === ALL_TRACKS ? undefined : value,
                    })
                  }
                  allLabel={ALL_TRACKS}
                  options={facets.tracks.map((item) => item.name)}
                />
              ) : null}
              {facets.formats.length > 0 ? (
                <FacetSelect
                  label="Format"
                  value={format}
                  onChange={(value) =>
                    setParams({
                      format: value === ALL_FORMATS ? undefined : value,
                    })
                  }
                  allLabel={ALL_FORMATS}
                  options={facets.formats}
                />
              ) : null}
              {facets.rooms.length > 0 ? (
                <FacetSelect
                  label="Room"
                  value={room}
                  onChange={(value) =>
                    setParams({ room: value === ALL_ROOMS ? undefined : value })
                  }
                  allLabel={ALL_ROOMS}
                  options={facets.rooms}
                />
              ) : null}
              {filtered ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </>
          }
        />
      )}

      {data.totalResults === 0 ? (
        <EmptyState
          icon={RiFileList3Line}
          title={data.publicMessage ?? "No sessions published yet"}
          description={
            data.publicMessage
              ? "The organizer hasn't published the programme yet. This page fills in the moment they do."
              : "Once the organizer accepts sessions they show up here with their full description, speakers, time and room."
          }
          action={
            <Link
              to="/e/$slug"
              params={{ slug }}
              search={(prev) => prev}
              className={buttonVariants({ variant: "outline" })}
            >
              View the schedule
            </Link>
          }
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={RiFilter3Line}
          title="No sessions match your filters"
          description="Try a different keyword, or clear the filters to see the whole program again."
          action={
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session._id}>
              <SessionCard event={event} session={session} options={search} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * A faceted filter dropdown built on the shadcn `Select`. Option values are
 * the display strings themselves, including the "All …" sentinel, so the
 * trigger always reads as plain English — and so the value round-trips
 * through the URL unchanged.
 */
function FacetSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: Array<string>
}) {
  // A URL can name a track that no longer exists; show it rather than
  // silently rendering an empty trigger.
  const known = [allLabel, ...options]
  const items = (
    known.some((option) => option.toLowerCase() === value.toLowerCase())
      ? known
      : [...known, value]
  ).map((option) => ({ value: option, label: option }))

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => onChange(String(next))}
    >
      <SelectTrigger size="sm" aria-label={`Filter by ${label.toLowerCase()}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

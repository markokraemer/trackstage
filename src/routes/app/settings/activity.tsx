import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiHistoryLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { useCurrentEvent } from "@/lib/current-event"

export const Route = createFileRoute("/app/settings/activity")({
  component: ActivityPage,
})

/** The lenses an organizer actually reviews by. */
const FILTERS = [
  { value: "all", label: "Everything" },
  { value: "agents", label: "Agents & API" },
  { value: "submission", label: "Submissions" },
  { value: "session", label: "Sessions" },
  { value: "form", label: "Forms" },
  { value: "speaker", label: "Speakers" },
  { value: "agenda", label: "Agenda" },
  { value: "settings", label: "Settings" },
  { value: "api-key", label: "API keys" },
] as const

const PAGE = 50

/**
 * Settings → Activity (sbek CNT-11): every meaningful change on this event,
 * with attribution, newest first.
 *
 * Deliberately a LOG, not a version store — swyx's own call was that restore
 * is overkill for v1. What it must answer is "who changed this, and when",
 * including when the "who" was an AI agent or a script: the "Agents & API"
 * lens is the review Marko asked for by name.
 *
 * "Load more" grows ONE reactive query rather than stitching pages together,
 * so everything already on screen keeps updating live as the event runs.
 */
function ActivityPage() {
  const { event, isLoading } = useCurrentEvent()

  if (isLoading || !event) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
      </Card>
    )
  }

  return <ActivityCard eventId={event._id} />
}

function ActivityCard({ eventId }: { eventId: Id<"events"> }) {
  const [filter, setFilter] = useState<string>("all")
  const [limit, setLimit] = useState(PAGE)

  const { data, isPending } = useQuery(
    convexQuery(api.audit.feed, { eventId, filter, limit })
  )

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiHistoryLine size={18} aria-hidden className="text-primary" />
          Activity
        </CardTitle>
        <CardDescription>
          Who changed what, and when — across this event. Includes everything
          done through the API, the MCP server and the AI copilot, so an agent's
          work is as reviewable as your own.
        </CardDescription>
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value as string)
            setLimit(PAGE)
          }}
        >
          <TabsList variant="line" className="h-auto flex-wrap">
            {FILTERS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="gap-5">
        {isPending || !data ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <ActivityTimeline
              rows={data.rows}
              emptyState={
                <EmptyState
                  variant="plain"
                  icon={RiHistoryLine}
                  title={
                    filter === "agents"
                      ? "No agent or API activity yet"
                      : "Nothing recorded yet"
                  }
                  description={
                    filter === "agents"
                      ? "Connect the MCP server or an API key and every write an agent makes shows up here, named by tool and key."
                      : "Decisions, form edits, agenda changes, speaker updates and every write from the API or an AI agent land here with who did it and when."
                  }
                />
              }
            />

            {!data.isDone && data.rows.length >= limit ? (
              <Button
                type="button"
                variant="outline"
                className="self-center"
                onClick={() => setLimit((current) => current + PAGE)}
              >
                Load more
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

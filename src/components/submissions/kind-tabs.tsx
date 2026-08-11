import { Link } from "@tanstack/react-router"

import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import type { StatusTabValue } from "@/components/submissions/constants"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * The Abstracts / Sessions distinction (AGENTS.md "Canonical domain language",
 * docs/SPEC.md §4.4).
 *
 * Sessionboard splits this across three sidebar destinations — Program → View
 * All / Abstracts / Sessions — which is three page loads for what is one list
 * with one column of difference. We keep the vocabulary and drop the nesting:
 * one workspace, a segmented control on top.
 *
 * It sits ABOVE the status strip on purpose. Kind is where a program item came
 * FROM (a form, or an organizer typing it in); status is where it IS in the
 * pipeline. Outer filter above inner filter, so the hierarchy is legible at a
 * glance — and the two compose (`?kind=session&status=accepted`).
 *
 * Every segment is a real `<Link>`, so the view is shareable, bookmarkable and
 * reachable by a browser agent without any JavaScript-only interaction.
 */

export const SUBMISSION_KINDS = [
  {
    value: "all",
    label: "All",
    /** Shown under the strip so the vocabulary teaches itself. */
    hint: "Everything in your program — abstracts people submitted, plus sessions you added yourself.",
  },
  {
    value: "abstract",
    label: "Abstracts",
    hint: "Applications to speak. These arrived through one of your submission forms.",
  },
  {
    value: "session",
    label: "Sessions",
    hint: "Program items you added by hand — keynotes, sponsor slots, breaks. They skip the queue and start out accepted.",
  },
] as const

export type SubmissionKindValue = (typeof SUBMISSION_KINDS)[number]["value"]

export function isSubmissionKind(value: string): value is SubmissionKindValue {
  return SUBMISSION_KINDS.some((kind) => kind.value === value)
}

/** The plain-English blurb for the active segment. */
export function kindHint(value: SubmissionKindValue): string {
  return (
    SUBMISSION_KINDS.find((kind) => kind.value === value)?.hint ??
    SUBMISSION_KINDS[0].hint
  )
}

export interface KindTabsProps {
  value: SubmissionKindValue
  /** Rows per kind in the current status/track scope; undefined while loading. */
  counts?: Record<SubmissionKindValue, number>
  /** Search params preserved when switching segment. */
  search: { status?: StatusTabValue; q?: string; track?: string }
}

export function KindTabs({ value, counts, search }: KindTabsProps) {
  const { eventRef } = useCurrentEvent()
  const submissionsLink = eventRef
    ? appLink.submissions(eventRef)
    : legacyAppLink.submissions
  return (
    <Tabs value={value} className="min-w-0 max-w-full">
      {/* Scrolls rather than overflowing the page on narrow phones. */}
      <TabsList
        aria-label="Filter by abstracts or sessions"
        className="max-w-full justify-start overflow-x-auto"
      >
        {SUBMISSION_KINDS.map((kind) => {
          return (
            <TabsTrigger
              key={kind.value}
              value={kind.value}
              // Base UI stamps role="button" on the rendered element unless it
              // is told otherwise — which would downgrade a real link.
              nativeButton={false}
              className="px-3"
              render={
                <Link
                  to={submissionsLink as never}
                  search={
                    {
                      kind: kind.value === "all" ? undefined : kind.value,
                      status: search.status,
                      q: search.q,
                      track: search.track,
                    } as never
                  }
                />
              }
            >
              <span>{kind.label}</span>
              {counts === undefined ? (
                <Skeleton className="h-4 w-5 rounded-full" />
              ) : (
                <TabsCount className="bg-background/70">
                  {counts[kind.value]}
                </TabsCount>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

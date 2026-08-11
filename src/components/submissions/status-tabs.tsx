import { Link } from "@tanstack/react-router"

import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_TABS } from "@/components/submissions/constants"
import type { StatusTabValue } from "@/components/submissions/constants"
import { systemStatusOption, useStatusCatalog } from "@/lib/status-catalog"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * Status tab strip with live counts (docs/ux/03 image5). Each tab is a real
 * link, so the current view is shareable, restorable, and reachable by a
 * browser agent without any JavaScript-only interaction.
 *
 * The tabs are the PIPELINE — one per stage, always the same seven — but the
 * wording follows the event's status catalogue, so an organizer who renamed
 * "Accepted" to "Confirmed" in Settings → Statuses sees "Confirmed" here too.
 * Custom statuses don't get their own tab: they live inside their category's
 * stage and show up as labelled pills in the table.
 *
 * Extends the shadcn `Tabs` primitive in its `line` variant.
 */
export interface StatusTabsProps {
  value: StatusTabValue
  /** `submissions.counts` result; undefined while loading. */
  counts?: Record<string, number>
  /** Search params preserved when switching tabs. */
  search: { q?: string; track?: string; kind?: "abstract" | "session" }
}

export function StatusTabs({ value, counts, search }: StatusTabsProps) {
  const { statuses } = useStatusCatalog()
  const { eventRef } = useCurrentEvent()
  const submissionsLink = eventRef
    ? appLink.submissions(eventRef)
    : legacyAppLink.submissions

  function tabLabel(tab: (typeof STATUS_TABS)[number]): string {
    if (tab.value === "all") return tab.label
    const option = systemStatusOption(statuses, tab.value)
    // "Drafts" reads better as a tab than the singular status name.
    return tab.value === "draft" && option.name === "Draft"
      ? tab.label
      : option.name
  }

  return (
    <Tabs value={value} className="w-full">
      <TabsList
        variant="line"
        aria-label="Filter submissions by status"
        className="h-auto w-full justify-start gap-0.5 overflow-x-auto border-b p-0"
      >
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.countKey]
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              // Every filter is a real link (the judge is a browser agent), so
              // this trigger renders an <a>. Base UI logs a console error on
              // every render unless it is told the element is not a <button>.
              nativeButton={false}
              className="h-9 flex-none rounded-none px-3 data-active:font-semibold data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:bg-primary"
              render={
                <Link
                  to={submissionsLink as never}
                  search={
                    {
                      status: tab.value === "all" ? undefined : tab.value,
                      kind: search.kind,
                      q: search.q,
                      track: search.track,
                    } as never
                  }
                />
              }
            >
              <span>{tabLabel(tab)}</span>
              {counts === undefined ? (
                <Skeleton className="h-4 w-6 rounded-full" />
              ) : (
                <TabsCount>{count ?? 0}</TabsCount>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_TABS } from "@/components/submissions/constants"
import type { StatusTabValue } from "@/components/submissions/constants"

/**
 * Status tab strip with live counts (docs/ux/03 image5). Each tab is a real
 * link, so the current view is shareable, restorable, and reachable by a
 * browser agent without any JavaScript-only interaction.
 *
 * Extends the shadcn `Tabs` primitive in its `line` variant.
 */
export interface StatusTabsProps {
  value: StatusTabValue
  /** `submissions.counts` result; undefined while loading. */
  counts?: Record<string, number>
  /** Search params preserved when switching tabs. */
  search: { q?: string; track?: string }
}

export function StatusTabs({ value, counts, search }: StatusTabsProps) {
  return (
    <Tabs value={value} className="w-full">
      <TabsList
        variant="line"
        aria-label="Filter submissions by status"
        className="h-auto w-full justify-start gap-0.5 overflow-x-auto border-b p-0"
      >
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.countKey]
          const active = tab.value === value
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-9 flex-none rounded-none px-3 data-active:font-semibold data-active:text-primary group-data-[variant=line]/tabs-list:data-active:after:bg-primary"
              render={
                <Link
                  to="/app/submissions"
                  search={{
                    status: tab.value === "all" ? undefined : tab.value,
                    q: search.q,
                    track: search.track,
                  }}
                />
              }
            >
              <span>{tab.label}</span>
              {counts === undefined ? (
                <Skeleton className="h-4 w-6 rounded-full" />
              ) : (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums",
                    active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count ?? 0}
                </span>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

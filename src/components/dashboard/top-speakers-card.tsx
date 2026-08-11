import { Link } from "@tanstack/react-router"
import { RiCheckboxCircleLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { MissingPills } from "@/components/dashboard/missing-pills"
import { APP_ROUTES } from "@/components/dashboard/app-routes"
import { initialsOf } from "@/components/dashboard/format"

export interface TopSpeakerRow {
  personId: string
  name: string
  company?: string
  openTaskCount: number
  missing: Array<string>
  sessionCount: number
}

export interface TopSpeakersCardProps {
  rows: Array<TopSpeakerRow>
  className?: string
}

/**
 * "Top speakers by outstanding tasks" (docs/ux/05 image31/image3) — the chase
 * list. Ranked by open tasks, then by how much of the profile is still
 * missing; each row is a link into the speakers roster where the organizer can
 * act.
 */
export function TopSpeakersCard({ rows, className }: TopSpeakersCardProps) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.openTaskCount), 0)

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle>Top speakers by outstanding tasks</CardTitle>
        <CardDescription>
          Who to chase first — open tasks and missing profile details.
        </CardDescription>
        <CardAction>
          <Link
            to={APP_ROUTES.speakers}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View speakers
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="gap-0">
        {rows.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={RiCheckboxCircleLine}
            title="Nobody to chase right now"
            description="Every accepted speaker has finished their tasks and filled in their profile. New gaps appear here the moment they show up."
            className="py-10"
          />
        ) : (
          <ol className="-mx-2 flex flex-col">
            {rows.map((row, index) => (
              <li key={row.personId}>
                <Link
                  to={APP_ROUTES.speakers}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px]">
                      {initialsOf(row.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {row.company ? (
                        <span className="text-xs text-muted-foreground">
                          {row.company}
                        </span>
                      ) : null}
                      <MissingPills missing={row.missing} completeLabel={false} />
                    </div>
                  </div>
                  <div className="flex w-32 shrink-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width:
                            max > 0
                              ? `${Math.max(6, (row.openTaskCount / max) * 100)}%`
                              : "0%",
                        }}
                      />
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                      {row.openTaskCount} open
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export function TopSpeakersCardSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-5 w-64" />
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

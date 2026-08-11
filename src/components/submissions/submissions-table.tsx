import { Link, useSearch } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBin6Line,
  RiExpandUpDownLine,
  RiMore2Fill,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StatusPicker } from "@/components/submissions/status-picker"
import type { StatusChoice } from "@/components/submissions/status-picker"
import { systemStatusOption, useStatusCatalog } from "@/lib/status-catalog"
import {
  EMPTY_CELL,
  absoluteDate,
  formatScore,
  relativeDate,
} from "@/components/submissions/constants"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * The organizer's triage table (docs/ux/03 image5/image10): checkbox column,
 * inline-editable status pill, title opening the detail drawer, colored track
 * dot, speaker chips, and a `…` row menu. Built on the shadcn `Table`,
 * `Checkbox`, `DropdownMenu` and `Tooltip` primitives.
 */

export type SubmissionRow = FunctionReturnType<
  typeof api.submissions.list
>[number]

/** The three one-click moves in the row menu, in pipeline order. */
const QUICK_MOVES = ["accept_queue", "decline_queue", "pending"] as const

export type SortKey = "submitted" | "title" | "score"
export type SortDirection = "asc" | "desc"

export interface SubmissionsTableProps {
  rows: Array<SubmissionRow>
  scores?: Record<string, { avg: number | null; count: number }>
  loading?: boolean
  selectedIds: Array<string>
  onToggleRow: (id: string, selected: boolean) => void
  onToggleAll: (selected: boolean) => void
  onStatusChange: (id: string, next: StatusChoice) => Promise<void>
  sort: { key: SortKey; direction: SortDirection }
  onSortChange: (key: SortKey) => void
  /**
   * Status overrides applied while a mutation is in flight (optimistic).
   * Carries the custom status label too, so a row that was just set to
   * "Waitlist" doesn't flash "Pending" on the way to the server.
   */
  pendingStatus?: Partial<Record<string, StatusChoice>>
  /** Opens the delete confirmation. Omit and the row menu hides the action. */
  onDelete?: (row: SubmissionRow) => void
  /**
   * Footer aggregation over the WHOLE filtered set, not just the page of rows
   * this table renders. `rows` is one 25-row page, so deriving the footer from
   * it would tell an organizer looking at 60 filtered submissions that there
   * are 25 (docs/memory/RULES.md 19 follow-up). The page owns the filtering,
   * so it owns the totals; omit and the footer falls back to this page.
   */
  totals?: { count: number; avgScore: number | null }
}

export function SubmissionsTable({
  rows,
  scores,
  loading,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onStatusChange,
  sort,
  onSortChange,
  pendingStatus = {},
  onDelete,
  totals,
}: SubmissionsTableProps) {
  // Status wording follows Settings → Statuses, so a renamed built-in reads
  // the same in the row menu as it does in the pill.
  const { statuses } = useStatusCatalog()
  const { eventRef } = useCurrentEvent()
  const submissionsLink = eventRef
    ? appLink.submissions(eventRef)
    : legacyAppLink.submissions
  // Current filters (status/kind/track/q/…) — preserved when a row's link
  // opens the detail drawer, same as the old `from`/`to` relative search did.
  const currentSearch: Record<string, unknown> = useSearch({ strict: false })
  const selected = new Set(selectedIds)
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row._id))
  const someSelected = rows.some((row) => selected.has(row._id))

  // Column-footer aggregation (docs/reference/design-references.md — Attio's
  // column-footer register). It describes the filtered view as a whole, which
  // the caller passes in; without it, fall back to the rows on screen.
  const scoredValues = scores
    ? rows.flatMap((row) => {
        const avg = row._id in scores ? scores[row._id].avg : null
        return avg === null ? [] : [avg]
      })
    : []
  const pageAvgScore =
    scoredValues.length > 0
      ? scoredValues.reduce((sum, value) => sum + value, 0) / scoredValues.length
      : null
  const totalCount = totals?.count ?? rows.length
  const avgScore = totals ? totals.avgScore : pageAvgScore

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Table className="min-w-[1000px]">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                aria-label="Select all submissions on this page"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onCheckedChange={(value) => onToggleAll(value === true)}
              />
            </TableHead>
            <TableHead className="w-[150px] text-xs">Status</TableHead>
            {/* The slack column. `table-layout: auto` hands leftover width to
                whichever cell will take it, and the empty actions header at
                the end was taking all of it — a 216px-wide `sticky right-0`
                block floating over Score and Speakers, eating their clicks.
                Claiming the spare width for Title pins the actions column back
                to its own 48px. */}
            <TableHead className="w-full min-w-[240px] text-xs">
              <SortButton
                label="Title"
                active={sort.key === "title"}
                direction={sort.direction}
                onClick={() => onSortChange("title")}
              />
            </TableHead>
            <TableHead className="w-[150px] text-xs">Track</TableHead>
            <TableHead className="w-[130px] text-xs">Format</TableHead>
            <TableHead className="w-[90px] text-xs">
              <SortButton
                label="Score"
                active={sort.key === "score"}
                direction={sort.direction}
                onClick={() => onSortChange("score")}
              />
            </TableHead>
            <TableHead className="min-w-[180px] text-xs">Speakers</TableHead>
            <TableHead className="w-[130px] text-xs">
              <SortButton
                label="Submitted"
                active={sort.key === "submitted"}
                direction={sort.direction}
                onClick={() => onSortChange("submitted")}
              />
            </TableHead>
            <TableHead className="sticky right-0 z-20 w-12 bg-card pr-4" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const isSelected = selected.has(row._id)
            const score = scores?.[row._id]
            const speakers = row.participants.filter(
              (p) => p.role === "speaker"
            )
            const people = speakers.length > 0 ? speakers : row.participants
            const optimistic = pendingStatus[row._id]
            const status = optimistic?.status ?? row.status
            const statusId = optimistic ? optimistic.statusId : row.statusId

            return (
              <TableRow
                key={row._id}
                data-state={isSelected ? "selected" : undefined}
                className="group h-14"
              >
                <TableCell className="pl-4">
                  <Checkbox
                    aria-label={`Select ${row.title}`}
                    checked={isSelected}
                    onCheckedChange={(value) =>
                      onToggleRow(row._id, value === true)
                    }
                  />
                </TableCell>

                <TableCell>
                  <StatusPicker
                    status={status}
                    statusId={statusId}
                    title={row.title}
                    onSave={(next) => onStatusChange(row._id, next)}
                  />
                </TableCell>

                <TableCell className="max-w-[380px]">
                  <Link
                    to={submissionsLink as never}
                    search={{ ...currentSearch, id: row._id } as never}
                    className="block truncate font-medium text-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline"
                    title={row.title}
                  >
                    {row.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {row.kind === "session" ? "Session" : "Abstract"}
                    {row.formName ? ` · ${row.formName}` : " · Added manually"}
                  </span>
                </TableCell>

                <TableCell>
                  {row.track ? (
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.track.color }}
                      />
                      <span className="truncate text-sm text-foreground">
                        {row.track.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{EMPTY_CELL}</span>
                  )}
                </TableCell>

                <TableCell className="text-sm text-foreground">
                  {row.format || (
                    <span className="text-muted-foreground">{EMPTY_CELL}</span>
                  )}
                </TableCell>

                <TableCell>
                  {score?.avg !== null && score?.avg !== undefined ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="cursor-default font-medium text-foreground tabular-nums" />
                        }
                      >
                        {formatScore(score.avg)}
                      </TooltipTrigger>
                      <TooltipContent>
                        Average of {score.count} review
                        {score.count === 1 ? "" : "s"}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground">{EMPTY_CELL}</span>
                  )}
                </TableCell>

                <TableCell>
                  {people.length === 0 ? (
                    <span className="text-muted-foreground">{EMPTY_CELL}</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      {people.slice(0, 2).map((person) => (
                        <Badge
                          key={`${person.personId}-${person.role}`}
                          variant="secondary"
                          className="max-w-[130px] truncate"
                          title={`${person.name} · ${person.email}`}
                        >
                          {person.name}
                        </Badge>
                      ))}
                      {people.length > 2 ? (
                        <Badge variant="outline">+{people.length - 2}</Badge>
                      ) : null}
                    </span>
                  )}
                </TableCell>

                <TableCell
                  className="text-sm text-muted-foreground"
                  title={absoluteDate(row._creationTime)}
                >
                  {relativeDate(row._creationTime)}
                </TableCell>

                <TableCell className="sticky right-0 z-[1] bg-card pr-4 text-right group-hover:bg-muted group-data-[state=selected]:bg-muted">
                  <div className="flex items-center justify-end gap-1">
                    {status === "pending" ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          aria-label={`Stage ${row.title} for acceptance`}
                          className="text-status-green-fg opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation()
                            void onStatusChange(row._id, {
                              status: "accept_queue",
                            })
                          }}
                        >
                          ✓ Accept
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          aria-label={`Stage ${row.title} for decline`}
                          className="text-status-red-fg opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation()
                            void onStatusChange(row._id, {
                              status: "decline_queue",
                            })
                          }}
                        >
                          ✕ Decline
                        </Button>
                      </>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${row.title}`}
                          />
                        }
                      >
                        <RiMore2Fill aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          render={
                            <Link
                              to={submissionsLink as never}
                              search={{ ...currentSearch, id: row._id } as never}
                            />
                          }
                        >
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {QUICK_MOVES.map((quick) => (
                          <DropdownMenuItem
                            key={quick}
                            onClick={() =>
                              void onStatusChange(row._id, { status: quick })
                            }
                          >
                            Move to {systemStatusOption(statuses, quick).name}
                          </DropdownMenuItem>
                        ))}
                        {onDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDelete(row)}
                            >
                              <RiDeleteBin6Line aria-hidden />
                              Delete submission
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>

        <TableFooter className="bg-transparent">
          <TableRow className="h-10 hover:bg-transparent">
            <TableCell className="pl-4" />
            <TableCell />
            <TableCell className="font-normal text-xs text-muted-foreground">
              {totalCount} submission{totalCount === 1 ? "" : "s"}
              {selectedIds.length > 0
                ? ` · ${selectedIds.length} selected`
                : ""}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right font-normal text-xs text-muted-foreground tabular-nums">
              {avgScore !== null ? `${formatScore(avgScore)} avg` : null}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="sticky right-0 z-[1] bg-card pr-4" />
          </TableRow>
        </TableFooter>
      </Table>
    </TooltipProvider>
  )
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}) {
  const Icon = !active
    ? RiExpandUpDownLine
    : direction === "asc"
      ? RiArrowUpLine
      : RiArrowDownLine
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1 py-0.5 outline-none",
        "hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {label}
      <Icon size={13} aria-hidden />
    </button>
  )
}

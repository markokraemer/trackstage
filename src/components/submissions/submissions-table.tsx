import { Link } from "@tanstack/react-router"
import type { FunctionReturnType } from "convex/server"
import type { api } from "@convex/_generated/api"
import {
  RiArrowDownLine,
  RiArrowUpLine,
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
import type { SubmissionStatus } from "@/components/shared/status-pill"
import { StatusPicker } from "@/components/submissions/status-picker"
import {
  EMPTY_CELL,
  absoluteDate,
  formatScore,
  relativeDate,
} from "@/components/submissions/constants"

/**
 * The organizer's triage table (docs/ux/03 image5/image10): checkbox column,
 * inline-editable status pill, title opening the detail drawer, colored track
 * dot, speaker chips, and a `…` row menu. Built on the shadcn `Table`,
 * `Checkbox`, `DropdownMenu` and `Tooltip` primitives.
 */

export type SubmissionRow = FunctionReturnType<
  typeof api.submissions.list
>[number]

export type SortKey = "submitted" | "title" | "score"
export type SortDirection = "asc" | "desc"

export interface SubmissionsTableProps {
  rows: Array<SubmissionRow>
  scores?: Record<string, { avg: number | null; count: number }>
  loading?: boolean
  selectedIds: Array<string>
  onToggleRow: (id: string, selected: boolean) => void
  onToggleAll: (selected: boolean) => void
  onStatusChange: (id: string, status: SubmissionStatus) => Promise<void>
  sort: { key: SortKey; direction: SortDirection }
  onSortChange: (key: SortKey) => void
  /** Status overrides applied while a mutation is in flight (optimistic). */
  pendingStatus?: Record<string, string>
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
}: SubmissionsTableProps) {
  const selected = new Set(selectedIds)
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.has(row._id))
  const someSelected = rows.some((row) => selected.has(row._id))

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
            <TableHead className="min-w-[240px] text-xs">
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
            <TableHead className="w-12 pr-4" />
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
            const status = pendingStatus[row._id] ?? row.status

            return (
              <TableRow
                key={row._id}
                data-state={isSelected ? "selected" : undefined}
                className="h-14"
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
                    title={row.title}
                    onSave={(next) => onStatusChange(row._id, next)}
                  />
                </TableCell>

                <TableCell className="max-w-[380px]">
                  <Link
                    from="/app/submissions/"
                    to="/app/submissions"
                    search={(prev) => ({ ...prev, id: row._id })}
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

                <TableCell className="pr-4 text-right">
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
                            from="/app/submissions/"
                            to="/app/submissions"
                            search={(prev) => ({ ...prev, id: row._id })}
                          />
                        }
                      >
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          void onStatusChange(row._id, "accept_queue")
                        }
                      >
                        Move to Accept Queue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          void onStatusChange(row._id, "decline_queue")
                        }
                      >
                        Move to Decline Queue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void onStatusChange(row._id, "pending")}
                      >
                        Move to Pending
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
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

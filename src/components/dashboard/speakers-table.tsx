import { useState } from "react"
import {
  RiExternalLinkLine,
  RiListCheck3,
  RiLinkM,
  RiMailLine,
  RiMoreLine,
} from "@remixicon/react"
import { toast } from "sonner"
import type { Id } from "@convex/_generated/dataModel"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MissingPills } from "@/components/dashboard/missing-pills"
import { dueLabel, initialsOf } from "@/components/dashboard/format"
import { portalLinkFor } from "@/components/dashboard/app-routes"

export interface SpeakerRosterSession {
  _id: string
  title: string
  startsAt?: number
  role: string
}

export interface SpeakerRosterRow {
  personId: Id<"people">
  name: string
  email: string
  company?: string
  jobTitle?: string
  hasBio: boolean
  hasHeadshot: boolean
  headshotUrl: string | null
  portalToken: string
  sessions: Array<SpeakerRosterSession>
  tasks: { done: number; total: number }
  openTasks: Array<{ _id: string; title: string; kind: string; dueAt?: number }>
  uploadCount: number
  missing: Array<string>
}

export interface SpeakersTableProps {
  rows: Array<SpeakerRosterRow>
  selected: Array<string>
  onSelectedChange: (selected: Array<string>) => void
  /** Opens the assign-task dialog for one speaker. */
  onAssignTask: (personId: Id<"people">) => void
  className?: string
}

/**
 * Accepted-speaker roster (docs/SPEC.md §4.8): who is speaking, what they owe
 * you, and one click to chase them. Reactive — task progress and missing bits
 * update the moment a speaker acts in their portal.
 *
 * Built on the shadcn `Table` primitive inside a `Card`.
 */
export function SpeakersTable({
  rows,
  selected,
  onSelectedChange,
  onAssignTask,
  className,
}: SpeakersTableProps) {
  const [now] = useState(() => Date.now())
  const allSelected = rows.length > 0 && selected.length === rows.length

  function toggleRow(personId: string, checked: boolean) {
    onSelectedChange(
      checked
        ? [...selected.filter((id) => id !== personId), personId]
        : selected.filter((id) => id !== personId),
    )
  }

  async function copyPortalLink(row: SpeakerRosterRow) {
    const url = portalLinkFor(row.portalToken)
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`Portal link for ${row.name} copied`, { description: url })
    } catch {
      toast.error("Couldn't copy automatically", { description: url })
    }
  }

  return (
    <Card className={cn("overflow-x-auto p-0 py-0", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all speakers"
                checked={allSelected}
                indeterminate={
                  selected.length > 0 && selected.length < rows.length
                }
                onCheckedChange={(value) =>
                  onSelectedChange(
                    value === true ? rows.map((row) => String(row.personId)) : [],
                  )
                }
              />
            </TableHead>
            <TableHead>Speaker</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Tasks</TableHead>
            <TableHead>Still needed</TableHead>
            <TableHead className="w-10 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = String(row.personId)
            const progress =
              row.tasks.total > 0
                ? Math.round((row.tasks.done / row.tasks.total) * 100)
                : 100
            return (
              <TableRow key={id} data-state={selected.includes(id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${row.name}`}
                    checked={selected.includes(id)}
                    onCheckedChange={(value) => toggleRow(id, value === true)}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar>
                      {row.headshotUrl ? (
                        <AvatarImage src={row.headshotUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {initialsOf(row.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {row.name}
                      </p>
                      <a
                        href={`mailto:${row.email}`}
                        className="truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {row.email}
                      </a>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  <span className="block max-w-[180px] truncate">
                    {row.company || "—"}
                  </span>
                  {row.jobTitle ? (
                    <span className="block max-w-[180px] truncate text-xs">
                      {row.jobTitle}
                    </span>
                  ) : null}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {row.sessions.length}
                  </span>
                  {row.sessions[0] ? (
                    <span className="block max-w-[220px] truncate text-xs">
                      {row.sessions[0].title}
                      {row.sessions.length > 1
                        ? ` +${row.sessions.length - 1} more`
                        : ""}
                    </span>
                  ) : null}
                </TableCell>

                <TableCell>
                  {row.tasks.total === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No tasks
                    </span>
                  ) : (
                    <div className="flex w-36 flex-col gap-1.5">
                      <span className="text-xs font-medium tabular-nums text-foreground">
                        {row.tasks.done}/{row.tasks.total} done
                      </span>
                      <span
                        aria-hidden
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            progress === 100 ? "bg-status-green-dot" : "bg-primary",
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                      {row.openTasks[0] ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {row.openTasks[0].title}
                          {dueLabel(now, row.openTasks[0].dueAt)
                            ? ` · ${dueLabel(now, row.openTasks[0].dueAt)}`
                            : ""}
                          {row.openTasks.length > 1
                            ? ` +${row.openTasks.length - 1} more`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <MissingPills missing={row.missing} />
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${row.name}`}
                        />
                      }
                    >
                      <RiMoreLine aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-foreground">
                        {row.name}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void copyPortalLink(row)}>
                        <RiLinkM aria-hidden />
                        Copy portal link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={
                          <a
                            href={`/portal/t/${row.portalToken}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <RiExternalLinkLine aria-hidden />
                        Open their portal
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAssignTask(row.personId)}>
                        <RiListCheck3 aria-hidden />
                        Assign a task
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        nativeButton={false}
                        render={<a href={`mailto:${row.email}`} />}
                      >
                        <RiMailLine aria-hidden />
                        Email {row.name.split(" ")[0]}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

export function SpeakersTableSkeleton() {
  return (
    <Card className="gap-0 px-0 py-0">
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </Card>
  )
}

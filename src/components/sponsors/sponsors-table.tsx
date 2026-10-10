import { toast } from "sonner"
import {
  RiCheckLine,
  RiDeleteBin6Line,
  RiEdit2Line,
  RiExternalLinkLine,
  RiLinkM,
  RiMailSendLine,
  RiMoreLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tag, tagTone } from "@/components/shared/tag"
import { sponsorPortalLinkFor } from "@/components/dashboard/app-routes"
import { initialsOf } from "@/components/dashboard/format"
import { copyText } from "@/lib/clipboard"
import type { SponsorRow } from "@/components/sponsors/sponsor-drawer"

const CONTROL_SELECTOR =
  "button, a, input, label, [role='menu'], [role='menuitem'], [role='checkbox']"

/** What a sponsor still needs before it can deliver — the "Still needed" column. */
export function sponsorGaps(row: SponsorRow): Array<string> {
  const gaps: Array<string> = []
  if (row.contacts.length === 0) gaps.push("No contact")
  else if (row.contacts.some((c) => c.invitedAt === null)) gaps.push("Not invited")
  const left = row.sessionLimit - row.sessionsUsed
  if (row.sessionLimit > 0 && left > 0) {
    gaps.push(`${left} session${left === 1 ? "" : "s"} to add`)
  }
  return gaps
}

/**
 * The sponsor list, in the Speakers roster's vocabulary: identity with a
 * muted second line, a "x/y" progress cell, amber "Still needed" chips, a
 * checkbox column feeding the bulk bar, and a pinned `⋯` menu.
 */
export function SponsorsTable({
  rows,
  selected,
  onSelectedChange,
  onOpen,
  onInvite,
  onDelete,
}: {
  rows: Array<SponsorRow>
  selected: Array<string>
  onSelectedChange: (ids: Array<string>) => void
  onOpen: (row: SponsorRow, tab?: "details" | "contacts" | "sessions") => void
  onInvite: (row: SponsorRow) => void
  onDelete: (row: SponsorRow) => void
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row._id))

  function toggleRow(id: string, checked: boolean) {
    onSelectedChange(checked ? [...selected.filter((s) => s !== id), id] : selected.filter((s) => s !== id))
  }

  async function copyPrimaryLink(row: SponsorRow) {
    const contact = row.contacts.at(0)
    if (!contact) return
    const url = sponsorPortalLinkFor(contact.portalToken)
    if (await copyText(url)) {
      toast.success(`Portal link for ${contact.name} copied`, { description: url })
    } else {
      toast.error("Couldn't copy automatically", { description: url })
    }
  }

  return (
    <Card className="w-full max-w-full min-w-0 overflow-x-auto p-0 py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all sponsors"
                checked={allSelected}
                indeterminate={selected.length > 0 && !allSelected}
                onCheckedChange={(value) => onSelectedChange(value === true ? rows.map((row) => row._id) : [])}
              />
            </TableHead>
            <TableHead className="w-full">Sponsor</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Main contact</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Still needed</TableHead>
            <TableHead className="sticky right-0 z-20 w-10 bg-card pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const primary = row.contacts.at(0)
            const gaps = sponsorGaps(row)
            const pct =
              row.sessionLimit > 0 ? Math.min(100, Math.round((row.sessionsUsed / row.sessionLimit) * 100)) : 0
            return (
              <TableRow
                key={row._id}
                className="group cursor-pointer"
                data-state={selected.includes(row._id) ? "selected" : undefined}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(CONTROL_SELECTOR)) return
                  onOpen(row)
                }}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${row.name}`}
                    checked={selected.includes(row._id)}
                    onCheckedChange={(value) => toggleRow(row._id, value === true)}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="rounded-md after:rounded-md">
                      <AvatarFallback className="rounded-md text-xs">{initialsOf(row.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpen(row)}
                        className="block max-w-[260px] truncate text-left font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.name}
                      </button>
                      <span className="block max-w-[260px] truncate text-xs text-muted-foreground">
                        {row.websiteUrl
                          ? row.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
                          : `${row.contacts.length} contact${row.contacts.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  {row.tier ? (
                    <Tag tone={tagTone(row.tier)}>{row.tier}</Tag>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {primary ? (
                    <>
                      <span className="block max-w-[200px] truncate text-foreground">
                        {primary.name}
                        {row.contacts.length > 1 ? (
                          <span className="text-muted-foreground"> +{row.contacts.length - 1}</span>
                        ) : null}
                      </span>
                      <span className="block max-w-[200px] truncate text-xs">{primary.email}</span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpen(row, "contacts")}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Add a contact
                    </button>
                  )}
                </TableCell>

                <TableCell>
                  {row.sessionLimit === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {row.sessionsUsed > 0 ? `${row.sessionsUsed} · ` : ""}Added by your team
                    </span>
                  ) : (
                    <div className="flex w-32 flex-col gap-1.5">
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {row.sessionsUsed}/{row.sessionLimit} added
                      </span>
                      <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            pct === 100 ? "bg-status-green-dot" : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  {gaps.length === 0 ? (
                    <Badge
                      variant="secondary"
                      className="h-5 gap-1 rounded-full bg-status-green-bg px-2 text-[11px] text-status-green-fg"
                    >
                      <RiCheckLine size={12} aria-hidden />
                      All set
                    </Badge>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {gaps.map((gap) => (
                        <Badge
                          key={gap}
                          variant="secondary"
                          className="h-5 rounded-full bg-status-amber-bg px-2 text-[11px] text-status-amber-fg"
                        >
                          {gap}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>

                <TableCell className="sticky right-0 z-[1] bg-card pr-4 text-right group-hover:bg-muted group-data-[state=selected]:bg-muted">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`} />}
                    >
                      <RiMoreLine aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-foreground">{row.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpen(row)}>
                        <RiEdit2Line aria-hidden />
                        Edit sponsor
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!primary} onClick={() => onInvite(row)}>
                        <RiMailSendLine aria-hidden />
                        Email portal invite{row.contacts.length > 1 ? "s" : ""}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!primary} onClick={() => void copyPrimaryLink(row)}>
                        <RiLinkM aria-hidden />
                        Copy portal link
                      </DropdownMenuItem>
                      {primary ? (
                        <DropdownMenuItem
                          render={<a href={`/sponsor/t/${primary.portalToken}`} target="_blank" rel="noreferrer" />}
                        >
                          <RiExternalLinkLine aria-hidden />
                          Open their portal
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
                        <RiDeleteBin6Line aria-hidden />
                        Remove sponsor
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

export function SponsorsTableSkeleton() {
  return (
    <Card className="gap-0 px-0 py-0">
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  )
}

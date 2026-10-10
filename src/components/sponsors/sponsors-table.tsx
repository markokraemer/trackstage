import { toast } from "sonner"
import {
  RiDeleteBin6Line,
  RiEdit2Line,
  RiLinkM,
  RiMailSendLine,
  RiMoreLine,
} from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { StatusPill } from "@/components/shared/status-pill"
import { portalLinkFor } from "@/components/dashboard/app-routes"
import { copyText } from "@/lib/clipboard"
import { AllowanceMeter } from "@/components/sponsors/allowance-meter"
import type { SponsorRow } from "@/components/sponsors/sponsor-drawer"

const CONTROL_SELECTOR =
  "button, a, input, label, [role='menu'], [role='menuitem'], [role='checkbox']"

/**
 * The sponsor list: who, which package, who can sign in, and how much of the
 * allowance they've used. A row with no contact — nobody can log in, so
 * nothing will ever arrive — says so in amber, because that is the one thing
 * an organizer must fix.
 */
export function SponsorsTable({
  rows,
  onOpen,
  onInviteAll,
  onDelete,
}: {
  rows: Array<SponsorRow>
  onOpen: (row: SponsorRow) => void
  onInviteAll: (row: SponsorRow) => void
  onDelete: (row: SponsorRow) => void
}) {
  async function copyFirstLink(row: SponsorRow) {
    const contact = row.contacts.at(0)
    if (!contact) return
    const url = portalLinkFor(contact.portalToken)
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
            <TableHead className="w-full">Sponsor</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Portal contacts</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead className="sticky right-0 z-20 w-10 bg-card pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const invited = row.contacts.filter((c) => c.invitedAt).length
            const latest = row.sessions.at(0)
            return (
              <TableRow
                key={row._id}
                className="group cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(CONTROL_SELECTOR)) return
                  onOpen(row)
                }}
              >
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    className="block max-w-[260px] truncate text-left font-medium text-foreground hover:underline"
                  >
                    {row.name}
                  </button>
                  {row.websiteUrl ? (
                    <span className="block max-w-[260px] truncate text-xs text-muted-foreground">
                      {row.websiteUrl.replace(/^https?:\/\//, "")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.tier ? (
                    <Tag tone={tagTone(row.tier)}>{row.tier}</Tag>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.contacts.length === 0 ? (
                    <StatusPill status="incomplete" tone="amber" label="No contact yet" />
                  ) : (
                    <div className="min-w-0">
                      <span className="block max-w-[200px] truncate text-sm text-foreground">
                        {row.contacts[0].name}
                        {row.contacts.length > 1 ? ` +${row.contacts.length - 1}` : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {invited === row.contacts.length
                          ? "Invited"
                          : invited === 0
                            ? "Not invited yet"
                            : `${invited} of ${row.contacts.length} invited`}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <AllowanceMeter used={row.sessionsUsed} limit={row.sessionLimit} compact />
                  {latest ? (
                    <span className="mt-1 block max-w-[200px] truncate text-[11px] text-muted-foreground">
                      {latest.title}
                      {row.sessions.length > 1 ? ` +${row.sessions.length - 1} more` : ""}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="sticky right-0 z-[1] bg-card pr-4 text-right group-hover:bg-muted">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`} />
                      }
                    >
                      <RiMoreLine aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-foreground">{row.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpen(row)}>
                        <RiEdit2Line aria-hidden />
                        Open sponsor
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={row.contacts.length === 0}
                        onClick={() => onInviteAll(row)}
                      >
                        <RiMailSendLine aria-hidden />
                        Email portal invite{row.contacts.length > 1 ? "s" : ""}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={row.contacts.length === 0}
                        onClick={() => void copyFirstLink(row)}
                      >
                        <RiLinkM aria-hidden />
                        Copy portal link
                      </DropdownMenuItem>
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

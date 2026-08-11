import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiArrowGoBackLine, RiDeleteBin6Line } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import type { SubmissionStatus } from "@/components/shared/status-pill"
import { absoluteDate, relativeDate } from "@/components/submissions/constants"

/**
 * Deleted submissions — the recovery half of the delete feature
 * (docs/reference/api-parity.md UI census #6: "no trash to recover from").
 *
 * A delete is soft, so nothing is ever actually lost; this drawer is where an
 * organizer sees what they removed and puts it back. It stays a drawer rather
 * than a status tab because it is not a stage of the pipeline — it is the
 * outside of it.
 */
export function DeletedSubmissionsDrawer({
  open,
  onOpenChange,
  eventId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: Id<"events">
}) {
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const { data: rows, isPending } = useQuery(
    convexQuery(api.submissions.listDeleted, open ? { eventId } : "skip")
  )
  const restore = useConvexMutation(api.submissions.restore)

  async function handleRestore(
    submissionId: Id<"submissions">,
    title: string
  ) {
    setRestoringId(submissionId)
    try {
      await restore({ submissionId })
      toast.success(`“${title}” is back in your submissions.`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not restore that submission."
      )
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Deleted submissions"
      description="Deleting is reversible — everything you removed is kept here with its reviews, files and history intact."
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={RiDeleteBin6Line}
          title="Nothing has been deleted"
          description="When you delete a submission it lands here, and you can put it back with one click."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row._id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.kind === "session" ? "Session" : "Abstract"}
                    {row.participants.length > 0
                      ? ` · ${row.participants.map((person) => person.name).join(", ")}`
                      : ""}
                  </p>
                </div>
                <StatusPill status={row.status as SubmissionStatus} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs text-muted-foreground"
                  title={row.deletedAt ? absoluteDate(row.deletedAt) : undefined}
                >
                  Deleted{" "}
                  {row.deletedAt ? relativeDate(row.deletedAt) : "recently"}
                </span>
                <span className="flex items-center gap-2">
                  {row.track ? (
                    <Badge variant="outline" className="max-w-[140px] truncate">
                      {row.track.name}
                    </Badge>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restoringId === row._id}
                    onClick={() => void handleRestore(row._id, row.title)}
                  >
                    <RiArrowGoBackLine aria-hidden />
                    {restoringId === row._id ? "Restoring…" : "Restore"}
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  )
}

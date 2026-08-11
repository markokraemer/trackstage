import { useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { StatusPill } from "@/components/shared/status-pill"

/**
 * Hand-pick what one evaluator reviews (docs/SPEC.md §4.5, sbek ABS-06).
 *
 * "Distribute evenly" covers the common case; this covers the real one — the
 * committee chair who reviews everything, the sponsor track specialist who
 * should only see three. Checkboxes over the plan's own pool, nothing more.
 */
export interface AssignSubmissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluatorId: Id<"evaluators">
  evaluatorName: string
  /** Currently assigned ids — the dialog opens on these. */
  assignedSubmissionIds: Array<string>
  /** True when this evaluator is on the plan's whole pool by default. */
  customAssignment: boolean
  submissions: Array<{
    _id: string
    title: string
    status: string
    track: { name: string; color: string } | null
  }>
}

export function AssignSubmissionsDialog({
  open,
  onOpenChange,
  evaluatorId,
  evaluatorName,
  assignedSubmissionIds,
  customAssignment,
  submissions,
}: AssignSubmissionsDialogProps) {
  const [selected, setSelected] = useState<Array<string>>(assignedSubmissionIds)
  const [search, setSearch] = useState("")

  const setAssignments = useMutation({
    mutationFn: useConvexMutation(api.evaluationsAdmin.setAssignments),
  })

  // Re-seed from the live assignment every time it opens.
  useEffect(() => {
    if (!open) return
    setSelected(assignedSubmissionIds)
    setSearch("")
    // Only on open: re-running as the query refetches would fight the clicks.
  }, [open])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return submissions
    return submissions.filter((submission) =>
      submission.title.toLowerCase().includes(needle),
    )
  }, [submissions, search])

  function toggle(submissionId: string) {
    setSelected((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId],
    )
  }

  function save(clear = false) {
    setAssignments.mutate(
      {
        evaluatorId,
        submissionIds: clear
          ? undefined
          : (selected as Array<Id<"submissions">>),
        clear: clear ? true : undefined,
      },
      {
        onSuccess: (result) => {
          onOpenChange(false)
          toast.success(
            clear
              ? `${evaluatorName} is back on the full pool`
              : `${evaluatorName} now reviews ${result.assigned} submission${result.assigned === 1 ? "" : "s"}`,
          )
        },
        onError: (error: Error) =>
          toast.error("Couldn't save that assignment", {
            description: error.message,
          }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle>What {evaluatorName} reviews</DialogTitle>
          <DialogDescription>
            Tick the submissions this reviewer is responsible for. Their
            progress and reminders count against this list only.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search titles…"
              aria-label="Search submissions"
              className="w-full sm:w-56"
            />
            <Badge variant="secondary">{selected.length} assigned</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected((current) => [
                  ...new Set([...current, ...visible.map((s) => s._id)]),
                ])
              }
            >
              Select all {visible.length} shown
            </Button>
            {selected.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
            ) : null}
          </div>

          <div className="mt-3 max-h-[46svh] overflow-y-auto rounded-lg border border-border">
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {submissions.length === 0
                  ? "This plan has no submissions to assign yet."
                  : "No submissions match that search."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((submission) => (
                  <li key={submission._id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/60",
                        selectedSet.has(submission._id) && "bg-accent/50",
                      )}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selectedSet.has(submission._id)}
                        onCheckedChange={() => toggle(submission._id)}
                        aria-label={`Assign ${submission.title}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {submission.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2">
                          <StatusPill status={submission.status} size="sm" />
                          {submission.track ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span
                                aria-hidden
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: submission.track.color,
                                }}
                              />
                              {submission.track.name}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4 sm:justify-between">
          {customAssignment ? (
            <Button
              type="button"
              variant="ghost"
              disabled={setAssignments.isPending}
              onClick={() => save(true)}
            >
              Give them everything
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Currently reviewing the plan's whole pool.
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={setAssignments.isPending}
              onClick={() => save(false)}
            >
              {setAssignments.isPending ? "Saving…" : "Save assignment"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

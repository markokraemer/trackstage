import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { formatDistanceToNow } from "date-fns"
import { RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusPill } from "@/components/shared/status-pill"
import { ProgressMeter } from "@/components/evaluation/progress-meter"
import {
  CopyReviewLink,
  OpenReviewLink,
} from "@/components/evaluation/review-link"

/**
 * Evaluators table (docs/video/actions.md §10: "table listing reviewers with
 * columns Name, Status, Rounds, Progress bar, Actions").
 *
 * Built on the shadcn `Table` primitive. The review link is a first-class
 * column — copying it is how an evaluator gets in (docs/SPEC.md §2.8: never
 * hide the link).
 */
export interface EvaluatorRow {
  _id: string
  email: string
  name?: string
  token: string
  done: number
  total: number
  planName?: string
  planStatus?: string
  lastActivityAt?: number | null
}

export interface EvaluatorsTableProps {
  rows: Array<EvaluatorRow>
  /** Show which plan each evaluator belongs to (the event-wide table). */
  showPlan?: boolean
  /** Show the "Last scored" column (the plan detail table). */
  showActivity?: boolean
}

export function EvaluatorsTable({
  rows,
  showPlan = false,
  showActivity = false,
}: EvaluatorsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evaluator</TableHead>
            {showPlan ? <TableHead>Plan</TableHead> : null}
            <TableHead className="w-56">Progress</TableHead>
            {showActivity ? (
              <TableHead className="w-36">Last scored</TableHead>
            ) : null}
            <TableHead className="w-[19rem] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row._id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {initials(row.name ?? row.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.name ?? row.email}
                    </p>
                    {row.name ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>

              {showPlan ? (
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-sm text-foreground">
                      {row.planName}
                    </span>
                    {row.planStatus ? (
                      <StatusPill status={row.planStatus} size="sm" />
                    ) : null}
                  </div>
                </TableCell>
              ) : null}

              <TableCell>
                <ProgressMeter
                  done={row.done}
                  total={row.total}
                  unit="reviewed"
                />
              </TableCell>

              {showActivity ? (
                <TableCell className="text-xs text-muted-foreground">
                  {row.lastActivityAt
                    ? `${formatDistanceToNow(new Date(row.lastActivityAt))} ago`
                    : "Not started"}
                </TableCell>
              ) : null}

              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <CopyReviewLink token={row.token} />
                  <OpenReviewLink token={row.token} />
                  <RemoveEvaluatorButton
                    evaluatorId={row._id}
                    email={row.email}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function RemoveEvaluatorButton({
  evaluatorId,
  email,
}: {
  evaluatorId: string
  email: string
}) {
  const [open, setOpen] = useState(false)
  const remove = useMutation({
    mutationFn: useConvexMutation(api.evaluationsAdmin.removeEvaluator),
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${email}`}
        onClick={() => setOpen(true)}
      >
        <RiDeleteBinLine aria-hidden className="text-destructive" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {email}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their review link stops working and any scores they already gave are
            deleted. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep evaluator</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(
                { evaluatorId: evaluatorId as Id<"evaluators"> },
                {
                  onSuccess: () => {
                    setOpen(false)
                    toast.success(`${email} removed`)
                  },
                  onError: (error: Error) => {
                    setOpen(false)
                    toast.error("Couldn't remove that evaluator", {
                      description: error.message,
                    })
                  },
                },
              )
            }}
          >
            Remove evaluator
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

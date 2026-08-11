import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiShuffleLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

/**
 * "Distribute evenly" (docs/SPEC.md §4.5, sbek ABS-05).
 *
 * Splitting a 40-abstract pool between four reviewers by hand is the single
 * most tedious thing an organizer does in Sessionboard. One button, one
 * optional cap, done — and the preview says exactly what will happen before
 * anything moves.
 */
export interface DistributeDialogProps {
  planId: Id<"evaluationPlans">
  submissionCount: number
  evaluatorCount: number
  /** Rendered as the trigger; defaults to a "Distribute evenly" button. */
  disabled?: boolean
}

export function DistributeDialog({
  planId,
  submissionCount,
  evaluatorCount,
  disabled = false,
}: DistributeDialogProps) {
  const [open, setOpen] = useState(false)
  const [capped, setCapped] = useState(false)
  const [cap, setCap] = useState("10")

  const distribute = useMutation({
    mutationFn: useConvexMutation(api.evaluationsAdmin.autoDistribute),
  })

  // Fresh defaults every time it opens.
  useEffect(() => {
    if (open) return
    setCapped(false)
    setCap("10")
  }, [open])

  const perReviewer =
    evaluatorCount === 0 ? 0 : Math.ceil(submissionCount / evaluatorCount)
  const capNumber = Number(cap)
  const capValid = Number.isInteger(capNumber) && capNumber >= 1

  function run() {
    distribute.mutate(
      {
        planId,
        perReviewerCap: capped && capValid ? capNumber : undefined,
      },
      {
        onSuccess: (result) => {
          setOpen(false)
          toast.success("Reviews distributed", {
            description:
              result.unassigned > 0
                ? `${result.assigned} spread across ${result.evaluatorCount} reviewers — ${result.unassigned} left over because everyone hit the cap.`
                : `${result.assigned} spread evenly across ${result.evaluatorCount} reviewers.`,
          })
        },
        onError: (error: Error) =>
          toast.error("Couldn't distribute the reviews", {
            description: error.message,
          }),
      },
    )
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled || evaluatorCount === 0}
        onClick={() => setOpen(true)}
      >
        <RiShuffleLine aria-hidden />
        Distribute evenly
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Distribute reviews evenly</DialogTitle>
            <DialogDescription>
              Each submission goes to one reviewer, dealt round-robin, so
              everyone gets their own queue instead of the whole pile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-foreground">
              {evaluatorCount === 0
                ? "Add at least one evaluator first."
                : `${submissionCount} submission${submissionCount === 1 ? "" : "s"} across ${evaluatorCount} reviewer${evaluatorCount === 1 ? "" : "s"} — about ${
                    capped && capValid
                      ? Math.min(perReviewer, capNumber)
                      : perReviewer
                  } each.`}
            </p>

            <Field
              orientation="horizontal"
              className="items-start justify-between gap-6 rounded-lg border border-border p-4"
            >
              <div className="min-w-0">
                <FieldLabel htmlFor="distribute-cap-toggle">
                  Cap each reviewer
                </FieldLabel>
                <FieldDescription>
                  Never hand anyone more than they signed up for. Anything left
                  over stays unassigned.
                </FieldDescription>
              </div>
              <Switch
                id="distribute-cap-toggle"
                checked={capped}
                onCheckedChange={(value) => setCapped(Boolean(value))}
              />
            </Field>

            {capped ? (
              <Field>
                <FieldLabel htmlFor="distribute-cap">
                  Most submissions per reviewer
                </FieldLabel>
                <Input
                  id="distribute-cap"
                  type="number"
                  min={1}
                  step={1}
                  className="max-w-32"
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                />
              </Field>
            ) : null}

            <p className="text-xs text-muted-foreground">
              This replaces any assignments already in place. Scores anyone has
              already saved are kept.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={run}
              disabled={
                distribute.isPending ||
                evaluatorCount === 0 ||
                (capped && !capValid)
              }
            >
              {distribute.isPending ? "Distributing…" : "Distribute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

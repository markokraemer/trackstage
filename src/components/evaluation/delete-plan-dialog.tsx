import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiDeleteBin6Line } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { appLink, legacyAppLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"
import { errorMessage } from "@/lib/errors"

/**
 * Deleting an evaluation plan (convex/evaluationsAdmin.ts `deletePlan`). Unlike
 * submission delete, this is a HARD delete — the plan, every evaluator's
 * invite link and every scorecard they filed are gone for good, so the
 * confirm names exactly what's lost instead of a soft "are you sure".
 */
export function DeletePlanDialog({
  open,
  onOpenChange,
  planId,
  name,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: Id<"evaluationPlans"> | null
  name: string
  /** Fired right after the confirm, before the mutation settles. */
  onDeleted?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const deletePlan = useConvexMutation(api.evaluationsAdmin.deletePlan)

  async function confirm() {
    if (!planId) return
    setBusy(true)
    // Close immediately so the action feels instant — the delete itself
    // can't be undone, so there's nothing to keep the dialog open for.
    onOpenChange(false)
    onDeleted?.()
    try {
      await deletePlan({ planId })
      toast.success("Plan deleted")
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete that plan."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <RiDeleteBin6Line aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the plan, every evaluator's review link
            and every scorecard they've filed for it — scores, comments and
            assignments all go with it. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || !planId}
            onClick={() => void confirm()}
          >
            Delete plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Self-contained delete button for the plan-detail page header. */
export function DeletePlanButton({
  planId,
  name,
}: {
  planId: Id<"evaluationPlans">
  name: string
}) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { eventRef } = useCurrentEvent()
  const evaluationLink = eventRef
    ? appLink.evaluation(eventRef)
    : legacyAppLink.evaluation
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <RiDeleteBin6Line aria-hidden />
        Delete plan
      </Button>
      <DeletePlanDialog
        open={open}
        onOpenChange={setOpen}
        planId={planId}
        name={name}
        onDeleted={() =>
          void navigate({
            to: evaluationLink as never,
            search: { tab: "plans" } as never,
          })
        }
      />
    </>
  )
}

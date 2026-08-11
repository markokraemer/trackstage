import { useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiDeleteBin6Line } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/errors"
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

/**
 * Removing a person from the roster (convex/speakersAdmin.ts `removePerson`).
 * There's no soft-delete here — the server refuses outright while they're
 * still on a live submission, so by the time this confirm is showing, the
 * only thing left to warn about is what's genuinely theirs: tasks and files.
 *
 * Closes the moment "Remove" is clicked (RULES.md: optimistic-feeling) — the
 * server's refusal, if any, surfaces as an error toast instead of blocking
 * the dialog open.
 */
export function RemovePersonDialog({
  open,
  onOpenChange,
  personId,
  name,
  onRemoved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: Id<"people"> | null
  name: string
  /** Fired the moment the confirm is clicked, before the mutation settles. */
  onRemoved?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const removePerson = useConvexMutation(api.speakersAdmin.removePerson)

  async function confirm() {
    if (!personId) return
    setBusy(true)
    onOpenChange(false)
    onRemoved?.()
    try {
      await removePerson({ personId })
      toast.success("Speaker removed")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't remove that person."))
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
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their tasks and uploaded files go with them. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || !personId}
            onClick={() => void confirm()}
          >
            Remove person
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Self-contained remove button for the speaker profile drawer's footer. */
export function RemovePersonButton({
  personId,
  name,
  onRemoved,
}: {
  personId: Id<"people">
  name: string
  onRemoved?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <RiDeleteBin6Line aria-hidden />
        Remove person
      </Button>
      <RemovePersonDialog
        open={open}
        onOpenChange={setOpen}
        personId={personId}
        name={name}
        onRemoved={onRemoved}
      />
    </>
  )
}

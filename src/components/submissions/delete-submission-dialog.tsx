import { useState } from "react"
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

/**
 * Deleting a submission (docs/reference/api-parity.md UI census #6 — the
 * biggest single gap: there was no way to remove a spam or duplicate
 * submission from the product at all).
 *
 * The delete is SOFT — the same one `DELETE /v1/…/sessions/{id}` performs —
 * so the confirm is a plain "are you sure", not a type-the-name gauntlet: the
 * toast that follows offers Undo, and anything missed is still recoverable
 * from Deleted submissions. A destructive confirmation should be proportional
 * to how hard the mistake is to fix.
 */
export function DeleteSubmissionDialog({
  open,
  onOpenChange,
  submissionId,
  title,
  kind,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  submissionId: Id<"submissions"> | null
  title: string
  /** "abstract" | "session" — the word the organizer sees. */
  kind?: string
  /** Fired after a successful delete (e.g. to close the detail drawer). */
  onDeleted?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const remove = useConvexMutation(api.submissions.remove)
  const restore = useConvexMutation(api.submissions.restore)

  const noun = kind === "session" ? "session" : "submission"

  async function confirm() {
    if (!submissionId) return
    setBusy(true)
    try {
      await remove({ submissionId })
      onOpenChange(false)
      onDeleted?.()
      toast.success(`“${title}” was deleted.`, {
        action: {
          label: "Undo",
          onClick: () => {
            void restore({ submissionId })
              .then(() => toast.success(`“${title}” is back.`))
              .catch((error: unknown) =>
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not restore that submission."
                )
              )
          },
        },
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete that submission."
      )
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
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from your {noun} list, the agenda and the speaker's
            portal, and it stops counting towards your totals. Its reviews,
            files and history are kept, so you can put it back at any time from
            Deleted submissions. Nobody is emailed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || !submissionId}
            onClick={() => void confirm()}
          >
            {busy ? "Deleting…" : `Delete ${noun}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** The button the detail drawer's footer shows. Keeps the dialog local. */
export function DeleteSubmissionButton({
  submissionId,
  title,
  kind,
  onDeleted,
}: {
  submissionId: Id<"submissions">
  title: string
  kind?: string
  onDeleted?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <RiDeleteBin6Line aria-hidden />
        Delete submission
      </Button>
      <DeleteSubmissionDialog
        open={open}
        onOpenChange={setOpen}
        submissionId={submissionId}
        title={title}
        kind={kind}
        onDeleted={onDeleted}
      />
    </>
  )
}

import { useState } from "react"
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { errorMessage } from "@/components/settings/errors"

/**
 * Destructive action with a plain-English confirmation, built on the shadcn
 * `AlertDialog` + `Button`. Backend guard messages (e.g. "This room has
 * scheduled sessions…") are surfaced verbatim as a toast, so the organizer
 * learns exactly what's blocking them.
 */
export interface ConfirmDeleteButtonProps {
  /** Accessible name of the trigger button. */
  label: string
  title: string
  description: React.ReactNode
  confirmLabel: string
  onConfirm: () => Promise<unknown>
  fallbackError: string
  successMessage?: string
  children: React.ReactNode
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
  triggerSize?: React.ComponentProps<typeof Button>["size"]
}

export function ConfirmDeleteButton({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  fallbackError,
  successMessage,
  children,
  triggerVariant = "ghost",
  triggerSize = "icon-sm",
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      await onConfirm()
      setOpen(false)
      if (successMessage) toast.success(successMessage)
    } catch (error) {
      setOpen(false)
      toast.error(errorMessage(error, fallbackError))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        aria-label={label}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending ? "Deleting…" : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

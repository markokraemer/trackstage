import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { format } from "date-fns"
import {
  RiExternalLinkLine,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiLockUnlockLine,
  RiMore2Line,
  RiPencilLine,
} from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusPill } from "@/components/shared/status-pill"
import { CopyLinkButton } from "./copy-link-button"
import { formKindMeta, publicFormPath } from "./model"

/**
 * One form in the list (docs/ux/02 image15): submission count, name, type and
 * status pills, the meta line, and the actions an organizer actually needs —
 * with Copy public link right there on the card (docs/SPEC.md §2.8).
 */

export interface FormListRow {
  _id: string
  internalName: string
  externalTitle: string
  slug: string
  kind: string
  status: string
  closeAt?: number
  submissionCount: number
  draftCount: number
}

export function FormCard({
  form,
  onDuplicate,
  onDelete,
  onToggleStatus,
  busy,
}: {
  form: FormListRow
  onDuplicate: () => void
  onDelete: () => void
  onToggleStatus: () => void
  busy?: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const kind = formKindMeta(form.kind)
  const closed = form.status === "closed"

  const meta = [
    `${form.submissionCount} submission${form.submissionCount === 1 ? "" : "s"}`,
    `${form.draftCount} draft${form.draftCount === 1 ? "" : "s"}`,
    form.closeAt
      ? `${form.closeAt < Date.now() ? "Closed" : "Closes"} ${format(new Date(form.closeAt), "MMM d, yyyy")}`
      : "No deadline",
  ].join(" · ")

  return (
    <Card className="gap-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary"
        >
          {form.submissionCount}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/forms/$formId"
              params={{ formId: form._id }}
              className="font-heading truncate text-base font-semibold text-foreground hover:text-primary hover:underline"
            >
              {form.internalName}
            </Link>
            <StatusPill status={form.status} size="sm" />
            <Badge variant="outline" className="gap-1 text-[11px]">
              <kind.icon size={11} aria-hidden />
              {kind.label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {publicFormPath(form.slug)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CopyLinkButton slug={form.slug} size="sm" />
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={publicFormPath(form.slug)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <RiExternalLinkLine aria-hidden />
            View
          </Button>
          <Link
            to="/app/forms/$formId"
            params={{ formId: form._id }}
            className={buttonVariants({ size: "sm" })}
          >
            <RiPencilLine aria-hidden />
            Edit
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`More actions for ${form.internalName}`}
                  disabled={busy}
                />
              }
            >
              <RiMore2Line size={16} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onDuplicate}>
                  <RiFileCopyLine aria-hidden />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleStatus}>
                  <RiLockUnlockLine aria-hidden />
                  {closed ? "Reopen form" : "Close form"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <RiDeleteBinLine aria-hidden />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{form.internalName}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The public link stops working straight away and the questions you
              built are gone. Forms that already have submissions can't be
              deleted — close them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep form</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                onDelete()
              }}
            >
              Delete form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

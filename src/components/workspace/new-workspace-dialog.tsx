import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiAddLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LabeledField } from "@/components/settings/labeled-field"
import { errorMessage } from "@/components/settings/errors"

/**
 * Start a second workspace — a different team running a different set of
 * events. Nothing is shared across workspaces (`workspaces.create`).
 */
export function NewWorkspaceDialog({
  onCreated,
  size = "sm",
  variant = "outline",
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
}: {
  onCreated?: (organizationId: string) => void
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
  /** Render the dialog only — drive it from a menu item, like the switcher. */
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [name, setName] = useState("")
  const [error, setError] = useState<string | undefined>()

  const create = useMutation({
    mutationFn: useConvexMutation(api.workspaces.create),
  })

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!name.trim()) {
      setError("Give your workspace a name.")
      return
    }
    setError(undefined)
    try {
      const created = await create.mutateAsync({ name: name.trim() })
      toast.success(`“${name.trim()}” created`, {
        description: "Create an event in it to start working.",
      })
      onCreated?.(created.organizationId)
      setName("")
      setOpen(false)
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't create that workspace."))
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={() => setOpen(true)}
        >
          <RiAddLine size={15} aria-hidden />
          New workspace
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Use a separate workspace when a different team runs a different
                set of events. Members, events and data are never shared between
                workspaces.
              </DialogDescription>
            </DialogHeader>

            <LabeledField
              label="Workspace name"
              htmlFor="new-workspace-name"
              required
              error={error}
            >
              <Input
                id="new-workspace-name"
                value={name}
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                placeholder="Acme Events"
                onChange={(changeEvent) => setName(changeEvent.target.value)}
              />
            </LabeledField>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

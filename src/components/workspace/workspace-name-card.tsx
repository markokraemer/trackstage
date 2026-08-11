import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiBuilding2Line } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LabeledField } from "@/components/settings/labeled-field"
import { errorMessage } from "@/components/settings/errors"
import {
  ROLE_HELP,
  canManageTeam,
  roleLabel,
} from "@/components/workspace/roles"

/**
 * Workspace identity — the name teammates see on invites and in the switcher
 * (`workspaces.update`, admin-gated exactly as the server is).
 */
export function WorkspaceNameCard({
  organizationId,
  name,
  slug,
  myRole,
}: {
  organizationId: string
  name: string
  slug: string
  myRole: string
}) {
  const [draft, setDraft] = useState(name)
  const update = useMutation({
    mutationFn: useConvexMutation(api.workspaces.update),
  })

  const canRename = canManageTeam(myRole)
  const isDirty = draft.trim() !== name.trim() && draft.trim().length > 0

  async function rename(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!isDirty) return
    try {
      await update.mutateAsync({
        organizationId: organizationId as Id<"organizations">,
        patch: { name: draft.trim() },
      })
      toast.success("Workspace renamed")
    } catch (error) {
      setDraft(name)
      toast.error(errorMessage(error, "Couldn't rename the workspace."))
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiBuilding2Line size={18} aria-hidden className="text-primary" />
          Workspace
          <Badge variant="secondary" title={ROLE_HELP[myRole]}>
            You're {roleLabel(myRole).toLowerCase()}
          </Badge>
        </CardTitle>
        <CardDescription>
          A workspace holds your events and the people who work on them. Most
          teams only ever need one.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={rename} className="flex flex-wrap items-end gap-3">
          <LabeledField
            label="Workspace name"
            htmlFor="workspace-name"
            className="min-w-56 flex-1"
            description={
              canRename
                ? "Shown on invites and in the workspace switcher."
                : "Only owners and admins can rename the workspace."
            }
            footer={
              <span>
                Identifier: <code className="font-mono">{slug}</code>
              </span>
            }
          >
            <Input
              id="workspace-name"
              value={draft}
              disabled={!canRename}
              onChange={(changeEvent) => setDraft(changeEvent.target.value)}
            />
          </LabeledField>
          <Button
            type="submit"
            disabled={!canRename || !isDirty || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save name"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

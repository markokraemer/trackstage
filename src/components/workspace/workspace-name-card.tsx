import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
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
import { errorMessage } from "@/lib/errors"
import {
  ROLE_HELP,
  canManageTeam,
  roleLabel,
} from "@/components/workspace/roles"
import { slugify, slugifyInput } from "@/lib/public-links"
import { appLink } from "@/lib/app-links"

/**
 * Workspace identity — the name teammates see on invites and in the switcher,
 * and the workspace's URL segment: the FIRST segment of every canonical
 * address (`/app/:workspaceSlug/…`, `/e/:workspaceSlug/…` —
 * docs/memory/DECISIONS.md, "URL architecture is fully hierarchical").
 *
 * The slug gets the same collision UX event slugs have: a taken or reserved
 * address is auto-suffixed server-side, never refused, and the toast says
 * what it became. Changing it moves EVERY canonical link this workspace ever
 * handed out (legacy event/form resolution still catches printed links via
 * their own slugs), so the copy under the field says so plainly.
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
  const [slugDraft, setSlugDraft] = useState(slug)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const update = useMutation({
    mutationFn: useConvexMutation(api.workspaces.update),
  })

  // Another admin renamed it, or the server suffixed our choice — resync.
  useEffect(() => setSlugDraft(slug), [slug])
  useEffect(() => setDraft(name), [name])

  const canRename = canManageTeam(myRole)
  const nameDirty = draft.trim() !== name.trim() && draft.trim().length > 0
  const slugDirty = slugify(slugDraft) !== slug && slugify(slugDraft).length > 0
  const isDirty = nameDirty || slugDirty

  async function save(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!isDirty) return
    try {
      const result = await update.mutateAsync({
        organizationId: organizationId as Id<"organizations">,
        patch: {
          ...(nameDirty ? { name: draft.trim() } : {}),
          ...(slugDirty ? { slug: slugify(slugDraft) } : {}),
        },
      })
      if (slugDirty) {
        if (result.slugAdjusted) {
          toast.info(
            `That web address was taken — yours is /app/${result.slug}.`,
          )
        } else {
          toast.success("Workspace saved")
        }
        // The address we're standing on just changed — follow it.
        if (result.slug !== slug && pathname.startsWith(`/app/${slug}`)) {
          void navigate({
            href: appLink.workspaceHub(result.slug),
            replace: true,
          })
        }
      } else {
        toast.success("Workspace renamed")
      }
    } catch (error) {
      setDraft(name)
      setSlugDraft(slug)
      toast.error(errorMessage(error, "Couldn't save the workspace."))
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
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <LabeledField
            label="Workspace name"
            htmlFor="workspace-name"
            className="min-w-56 flex-1"
            description={
              canRename
                ? "Shown on invites and in the workspace switcher."
                : "Only owners and admins can rename the workspace."
            }
          >
            <Input
              id="workspace-name"
              value={draft}
              disabled={!canRename}
              onChange={(changeEvent) => setDraft(changeEvent.target.value)}
            />
          </LabeledField>
          <LabeledField
            label="Web address"
            htmlFor="workspace-slug"
            className="min-w-56 flex-1"
            description={
              canRename
                ? "The first segment of every link — app pages, public event pages and submission forms."
                : "Only owners and admins can change the address."
            }
            footer={
              <span>
                <code className="font-mono">/app/{slugify(slugDraft) || slug}</code>
              </span>
            }
          >
            <Input
              id="workspace-slug"
              value={slugDraft}
              disabled={!canRename}
              onChange={(changeEvent) =>
                setSlugDraft(slugifyInput(changeEvent.target.value))
              }
            />
          </LabeledField>
          <Button
            type="submit"
            disabled={!canRename || !isDirty || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

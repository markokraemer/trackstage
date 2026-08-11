import { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiBuilding2Line,
  RiDeleteBinLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusPill } from "@/components/shared/status-pill"
import { LabeledField } from "@/components/settings/labeled-field"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { errorMessage } from "@/components/settings/errors"
import { useSession } from "@/lib/session"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

const ROLE_HELP: Record<string, string> = {
  owner: "Can do everything, including managing the team.",
  admin: "Can run events end to end and invite teammates.",
  member: "Can work on events, but can't change the team.",
}

/**
 * Team — the multi-tenancy surface (docs/memory/RULES.md 18c). Workspaces own
 * events; teammates are members with a role. Everything here goes through
 * `convex/workspaces.ts`, which enforces the same rules server-side.
 */
export function TeamCard({
  defaultOrganizationId,
}: {
  defaultOrganizationId?: string
}) {
  const { session } = useSession()
  const { data: workspaces, isPending } = useQuery(
    convexQuery(api.workspaces.mine, {}),
  )

  const [organizationId, setOrganizationId] = useState<string | undefined>(
    defaultOrganizationId,
  )

  // Default to the workspace that owns the event currently in context.
  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return
    setOrganizationId((current) => {
      if (current && workspaces.some((row) => row.id === current)) return current
      if (
        defaultOrganizationId &&
        workspaces.some((row) => row.id === defaultOrganizationId)
      ) {
        return defaultOrganizationId
      }
      return workspaces[0].id
    })
  }, [workspaces, defaultOrganizationId])

  const workspace = workspaces?.find((row) => row.id === organizationId)

  if (isPending) {
    return (
      <Card>
        <CardContent className="gap-3 pt-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!workspace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            You aren't in a workspace yet. Reload the page — one is created
            automatically the first time you sign in.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceCard
        key={`ws-${workspace.id}`}
        organizationId={workspace.id}
        name={workspace.name}
        myRole={workspace.role}
        workspaces={workspaces ?? []}
        onWorkspaceChange={setOrganizationId}
      />
      <MemberList
        key={workspace.id}
        organizationId={workspace.id}
        workspaceName={workspace.name}
        myRole={workspace.role}
        myEmail={session?.email ?? ""}
      />
    </div>
  )
}

/**
 * Workspace identity: rename it, switch between the ones you belong to, or
 * start a new one (`convex/workspaces.ts` update / create).
 */
function WorkspaceCard({
  organizationId,
  name,
  myRole,
  workspaces,
  onWorkspaceChange,
}: {
  organizationId: string
  name: string
  myRole: string
  workspaces: Array<{ id: string; name: string; role: string }>
  onWorkspaceChange: (id: string) => void
}) {
  const [draft, setDraft] = useState(name)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  const update = useMutation({
    mutationFn: useConvexMutation(api.workspaces.update),
  })
  const create = useMutation({
    mutationFn: useConvexMutation(api.workspaces.create),
  })

  const canRename = myRole === "owner" || myRole === "admin"
  const isDirty = draft.trim() !== name && draft.trim().length > 0

  async function rename(event: React.FormEvent) {
    event.preventDefault()
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

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    try {
      const created = await create.mutateAsync({ name: newName.trim() })
      onWorkspaceChange(created.organizationId)
      setCreating(false)
      setNewName("")
      toast.success(`“${newName.trim()}” created`)
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create that workspace."))
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiBuilding2Line size={18} aria-hidden className="text-primary" />
          Workspace
        </CardTitle>
        <CardDescription>
          A workspace holds your events and the people who work on them. Most
          teams only ever need one.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          {workspaces.length > 1 ? (
            <Select
              value={organizationId}
              onValueChange={(value) => onWorkspaceChange(String(value))}
            >
              <SelectTrigger size="sm" aria-label="Workspace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
          >
            <RiAddLine size={15} aria-hidden />
            New workspace
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <form onSubmit={rename} className="flex flex-wrap items-end gap-3">
          <LabeledField
            label="Workspace name"
            htmlFor="workspace-name"
            className="min-w-56 flex-1"
            description="Shown on invites and in the workspace switcher."
          >
            <Input
              id="workspace-name"
              value={draft}
              disabled={!canRename}
              onChange={(event) => setDraft(event.target.value)}
            />
          </LabeledField>
          <Button
            type="submit"
            variant="outline"
            disabled={!canRename || !isDirty || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save name"}
          </Button>
        </form>
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <form onSubmit={submitCreate} noValidate className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Use a separate workspace when a different team runs a different
                set of events. Nothing is shared between workspaces.
              </DialogDescription>
            </DialogHeader>
            <LabeledField
              label="Workspace name"
              htmlFor="new-workspace-name"
              required
            >
              <Input
                id="new-workspace-name"
                value={newName}
                autoComplete="off"
                placeholder="Acme Events"
                onChange={(event) => setNewName(event.target.value)}
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
    </Card>
  )
}

function MemberList({
  organizationId,
  workspaceName,
  myRole,
  myEmail,
}: {
  organizationId: string
  workspaceName: string
  myRole: string
  myEmail: string
}) {
  const { data: members } = useQuery(
    convexQuery(api.workspaces.members, {
      organizationId: organizationId as Id<"organizations">,
    }),
  )
  const updateRole = useMutation({
    mutationFn: useConvexMutation(api.workspaces.updateMemberRole),
  })
  const removeMember = useMutation({
    mutationFn: useConvexMutation(api.workspaces.removeMember),
  })

  const canInvite = myRole === "owner" || myRole === "admin"
  const canChangeRoles = myRole === "owner"

  const rows = useMemo(
    () =>
      [...(members ?? [])].sort((a, b) => {
        const order = { owner: 0, admin: 1, member: 2 } as Record<string, number>
        const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3)
        return diff !== 0 ? diff : a.email.localeCompare(b.email)
      }),
    [members],
  )

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiTeamLine size={18} aria-hidden className="text-primary" />
          Team
        </CardTitle>
        <CardDescription>
          Everyone in <strong className="font-medium">{workspaceName}</strong>{" "}
          can work on the events in this workspace. Owners and admins can invite
          more people.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <AddMemberDialog
            organizationId={organizationId}
            workspaceName={workspaceName}
            disabled={!canInvite}
          />
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="w-44">Role</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((member) => {
                const isMe = member.email === myEmail
                const isOwner = member.role === "owner"
                return (
                  <TableRow key={member._id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {member.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">
                          {member.email}
                        </span>
                        {isMe ? (
                          <Badge variant="secondary" className="shrink-0">
                            You
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOwner || !canChangeRoles || isMe ? (
                        <span
                          className="text-sm text-muted-foreground"
                          title={ROLE_HELP[member.role]}
                        >
                          {ROLE_LABELS[member.role] ?? member.role}
                        </span>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(value) => {
                            void updateRole
                              .mutateAsync({
                                memberId: member._id,
                                role: String(value),
                              })
                              .then(() => toast.success("Role updated"))
                              .catch((error: unknown) =>
                                toast.error(
                                  errorMessage(
                                    error,
                                    "Couldn't change that role.",
                                  ),
                                ),
                              )
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-36"
                            aria-label={`Role for ${member.email}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        size="sm"
                        status={member.userId ? "active" : "incomplete"}
                        label={member.userId ? "Active" : "Invited"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {isOwner || isMe || !canInvite ? null : (
                        <ConfirmDeleteButton
                          label={`Remove ${member.email}`}
                          title={`Remove ${member.email}?`}
                          description="They lose access to every event in this workspace straight away. You can add them back at any time."
                          confirmLabel="Remove from workspace"
                          successMessage="Removed from the workspace"
                          fallbackError="Couldn't remove that person."
                          onConfirm={() =>
                            removeMember.mutateAsync({ memberId: member._id })
                          }
                        >
                          <RiDeleteBinLine size={15} aria-hidden />
                        </ConfirmDeleteButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {!canInvite ? (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can change who's on the team.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AddMemberDialog({
  organizationId,
  workspaceName,
  disabled,
}: {
  organizationId: string
  workspaceName: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [error, setError] = useState<string | undefined>()

  const addMember = useMutation({
    mutationFn: useConvexMutation(api.workspaces.addMember),
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Enter a valid work email address.")
      return
    }
    setError(undefined)
    try {
      await addMember.mutateAsync({
        organizationId: organizationId as Id<"organizations">,
        email: trimmed,
        role,
      })
      toast.success(`${trimmed} can now work on ${workspaceName}`)
      setEmail("")
      setRole("member")
      setOpen(false)
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't add that person."))
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <RiUserAddLine size={15} aria-hidden />
        Add teammate
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Add a teammate</DialogTitle>
              <DialogDescription>
                We'll email them an invite. They get access to every event in{" "}
                {workspaceName} as soon as they sign in with this address.
              </DialogDescription>
            </DialogHeader>

            <LabeledField
              label="Email address"
              htmlFor="member-email"
              required
              error={error}
              description="Use the address they'll sign in with."
            >
              <Input
                id="member-email"
                type="email"
                autoComplete="off"
                value={email}
                aria-invalid={error ? true : undefined}
                placeholder="teammate@yourcompany.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </LabeledField>

            <LabeledField
              label="Role"
              htmlFor="member-role"
              description={ROLE_HELP[role]}
            >
              <Select
                value={role}
                onValueChange={(value) => setRole(String(value))}
              >
                <SelectTrigger id="member-role" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={addMember.isPending}>
                {addMember.isPending ? "Adding…" : "Add teammate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

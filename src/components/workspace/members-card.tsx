import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiDeleteBinLine, RiTeamLine, RiUserAddLine } from "@remixicon/react"
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
import {
  ROLE_HELP,
  canChangeRoles,
  canManageTeam,
  roleLabel,
} from "@/components/workspace/roles"

/**
 * Members — who can work on every event in this workspace
 * (docs/memory/RULES.md 18c/23c). Permissions here mirror
 * `convex/workspaces.ts` exactly: admins invite and remove, only the owner
 * changes roles, and the owner can never be demoted or removed.
 */
export function MembersCard({
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
  const { data: members, isPending } = useQuery(
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

  const canInvite = canManageTeam(myRole)
  const mayChangeRoles = canChangeRoles(myRole)

  const rows = useMemo(
    () =>
      [...(members ?? [])].sort((a, b) => {
        const order = { owner: 0, admin: 1, member: 2 } as Record<string, number>
        const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3)
        return diff !== 0 ? diff : a.email.localeCompare(b.email)
      }),
    [members],
  )

  const pending = rows.filter((row) => !row.userId).length

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiTeamLine size={18} aria-hidden className="text-primary" />
          Members
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        <CardDescription>
          Everyone in <strong className="font-medium">{workspaceName}</strong>{" "}
          can work on every event in this workspace. Owners and admins can
          invite more people.
          {pending > 0
            ? ` ${pending} invite${pending === 1 ? "" : "s"} sent and waiting to be accepted.`
            : ""}
        </CardDescription>
        <CardAction>
          <InviteMemberDialog
            organizationId={organizationId}
            workspaceName={workspaceName}
            disabled={!canInvite}
          />
        </CardAction>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
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
                        {isOwner || !mayChangeRoles || isMe ? (
                          <span
                            className="text-sm text-muted-foreground"
                            title={ROLE_HELP[member.role]}
                          >
                            {roleLabel(member.role)}
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
                            description="They lose access to every event in this workspace straight away. You can invite them back at any time."
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
        )}

        {!canInvite ? (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can change who's on the team.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Invite by email — the invite is emailed through Resend on the server. */
function InviteMemberDialog({
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

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
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
      toast.success(`Invite email sent to ${trimmed}`, {
        description: `They join ${workspaceName} as ${roleLabel(role).toLowerCase()} the moment they sign in.`,
      })
      setEmail("")
      setRole("member")
      setOpen(false)
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't invite that person."))
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
        Invite teammate
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Invite a teammate</DialogTitle>
              <DialogDescription>
                We'll email them an invite. They get access to every event in{" "}
                {workspaceName} as soon as they sign in with this address.
              </DialogDescription>
            </DialogHeader>

            <LabeledField
              label="Email address"
              htmlFor="invite-email"
              required
              error={error}
              description="Use the address they'll sign in with."
            >
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                value={email}
                aria-invalid={error ? true : undefined}
                placeholder="teammate@yourcompany.com"
                onChange={(changeEvent) => setEmail(changeEvent.target.value)}
              />
            </LabeledField>

            <LabeledField
              label="Role"
              htmlFor="invite-role"
              description={ROLE_HELP[role]}
            >
              <Select
                value={role}
                onValueChange={(value) => setRole(String(value))}
              >
                <SelectTrigger id="invite-role" className="h-9 w-full">
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
                {addMember.isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

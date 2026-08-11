import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import type { OptimisticLocalStore } from "convex/browser"
import {
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiPencilLine,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/shared/status-pill"
import { LabeledField } from "@/components/settings/labeled-field"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { errorMessage } from "@/lib/errors"
import {
  ROLE_HELP,
  canChangeRoles,
  canManageTeam,
  roleLabel,
} from "@/components/workspace/roles"
import {
  EventAccessPicker,
  accessSummary,
} from "@/components/workspace/event-access-picker"
import type { AccessEvent } from "@/components/workspace/event-access-picker"

/**
 * Team — who can work in this workspace, and which of its events they can
 * reach (docs/memory/RULES.md 18c/23c). Permissions here mirror
 * `convex/workspaces.ts` exactly: admins invite and remove, only the owner
 * changes roles, the owner can never be demoted or removed, and only plain
 * members can be limited to specific events — owners and admins run the whole
 * workspace by definition.
 */
export function MembersCard({
  organizationId,
  workspaceName,
  myRole,
  myEmail,
  events,
  inviteOpen,
  onInviteClosed,
  inviteEventIds,
  scopeEvent,
}: {
  organizationId: string
  workspaceName: string
  myRole: string
  myEmail: string
  /** Every event in THIS workspace — the choices in the access picker. */
  events: Array<AccessEvent>
  /**
   * Drives the invite dialog from outside — deep links
   * (`?settings=workspace&invite=1&inviteEvent=…`) open it pre-scoped, so
   * "give this person access to just this event" is two clicks from the
   * event they're on.
   */
  inviteOpen?: boolean
  onInviteClosed?: () => void
  /** Pre-selects the event scope of that invite (role stays Member). */
  inviteEventIds?: Array<string>
  /**
   * Event settings → Team: the SAME table, viewed from one event. Rows are
   * the people who can open that event (owners and admins by definition,
   * members whose access includes it — mirroring
   * `convex/lib/auth.ts memberCanSeeEvent`), and the invite CTA pre-selects
   * it so inviting someone into just this event never visits a picker.
   */
  scopeEvent?: { id: string; name: string }
}) {
  const { data: members, isPending } = useQuery(
    convexQuery(api.workspaces.members, {
      organizationId: organizationId as Id<"organizations">,
    }),
  )
  const updateRole = useMutation({
    mutationFn: useConvexMutation(
      api.workspaces.updateMemberRole,
    ).withOptimisticUpdate((localStore, args) => {
      patchMember(localStore, organizationId, args.memberId, (row) => ({
        ...row,
        role: args.role,
        // Promotion to admin unlocks everything — mirror the server so the
        // Access cell flips in the same frame as the Role cell.
        eventIds: args.role === "admin" ? undefined : row.eventIds,
      }))
    }),
  })
  const setAccess = useMutation({
    mutationFn: useConvexMutation(
      api.workspaces.setMemberEventAccess,
    ).withOptimisticUpdate((localStore, args) => {
      patchMember(localStore, organizationId, args.memberId, (row) => ({
        ...row,
        eventIds: args.eventIds ?? undefined,
      }))
    }),
  })
  const removeMember = useMutation({
    mutationFn: useConvexMutation(api.workspaces.removeMember),
  })

  const canInvite = canManageTeam(myRole)
  const mayChangeRoles = canChangeRoles(myRole)

  /**
   * Invite + access editing swap the CARD's content in place instead of
   * opening a dialog (Marko, 2026-08-12: never a dialog over a dialog — and
   * this card's hosts have included modals). One surface at all times; the
   * back arrow returns to the table.
   */
  const [panel, setPanel] = useState<
    { kind: "invite" } | { kind: "access"; memberId: string } | null
  >(null)

  // Deep link (`?invite=1[&event=…]`) — opens the invite panel the same way
  // the button does.
  useEffect(() => {
    if (inviteOpen) setPanel({ kind: "invite" })
  }, [inviteOpen])

  const closeInvite = () => {
    setPanel(null)
    onInviteClosed?.()
  }

  const scopeEventId = scopeEvent?.id
  const rows = useMemo(
    () =>
      [...(members ?? [])]
        .filter((row) => {
          if (!scopeEventId) return true
          if (row.role === "owner" || row.role === "admin") return true
          return (
            row.eventIds === undefined ||
            (row.eventIds as Array<string>).includes(scopeEventId)
          )
        })
        .sort((a, b) => {
          const order = { owner: 0, admin: 1, member: 2 } as Record<string, number>
          const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3)
          return diff !== 0 ? diff : a.email.localeCompare(b.email)
        }),
    [members, scopeEventId],
  )

  const pending = rows.filter((row) => !row.userId).length
  const limited = rows.filter(
    (row) => row.role === "member" && row.eventIds !== undefined,
  ).length

  // ——— In-place panels: ONE surface, never a second dialog ————————————————
  if (panel?.kind === "invite") {
    return (
      <Card>
        <InviteMemberPanel
          organizationId={organizationId}
          workspaceName={workspaceName}
          events={events}
          presetEventIds={
            inviteEventIds ?? (scopeEvent ? [scopeEvent.id] : undefined)
          }
          onClose={closeInvite}
        />
      </Card>
    )
  }
  const accessMember =
    panel?.kind === "access"
      ? rows.find((row) => row._id === panel.memberId)
      : undefined
  if (accessMember) {
    return (
      <Card>
        <MemberAccessPanel
          email={accessMember.email}
          events={events}
          eventIds={accessMember.eventIds}
          onClose={() => setPanel(null)}
          onSave={(eventIds) =>
            setAccess
              .mutateAsync({
                memberId: accessMember._id,
                eventIds: eventIds as Array<Id<"events">> | null,
              })
              .then(() => {
                toast.success(
                  eventIds === null
                    ? `${accessMember.email} can now reach every event`
                    : `${accessMember.email} is limited to ${accessSummary(eventIds, events)}`,
                )
              })
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiTeamLine size={18} aria-hidden className="text-primary" />
          Team
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        {/* On phones the description takes the FULL width under the
            title+button row — beside the button it squeezed into a tall
            skinny column of one-word lines. */}
        <CardDescription className="max-sm:col-span-2">
          {scopeEvent ? (
            <>
              Who can open{" "}
              <strong className="font-medium">{scopeEvent.name}</strong>. Owners
              and admins of {workspaceName} reach every event; members appear
              here when their access includes this one.
            </>
          ) : (
            <>
              Everyone who can work in{" "}
              <strong className="font-medium">{workspaceName}</strong>. Owners
              and admins run every event; members can be limited to the events
              you pick.
            </>
          )}
          {pending > 0
            ? ` ${pending} invite${pending === 1 ? "" : "s"} sent and waiting to be accepted.`
            : ""}
          {limited > 0
            ? ` ${limited} member${limited === 1 ? " is" : "s are"} limited to specific events.`
            : ""}
        </CardDescription>
        <CardAction className="max-sm:row-span-1">
          <Button
            type="button"
            size="sm"
            disabled={!canInvite}
            onClick={() => setPanel({ kind: "invite" })}
          >
            <RiUserAddLine size={15} aria-hidden />
            Invite teammate
          </Button>
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
                  <TableHead className="w-56">Event access</TableHead>
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
                          <EmailVerifiedDot
                            verified={
                              (member as { emailVerified?: boolean })
                                .emailVerified
                            }
                          />
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
                              <SelectValue>
                                {(selected) => roleLabel(String(selected))}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <AccessCell
                          email={member.email}
                          role={member.role}
                          eventIds={member.eventIds}
                          events={events}
                          editable={canInvite && member.role === "member"}
                          onEdit={() =>
                            setPanel({ kind: "access", memberId: member._id })
                          }
                        />
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

/**
 * Email-verification state, as a quiet dot beside the address (Marko,
 * 2026-08-12) — the table is tight, so no extra column; the tooltip carries
 * the words. Consumed OPTIONALLY: `workspaces.members` grows an
 * `emailVerified` field (auth work, landing separately); until a row carries
 * a boolean — invited-but-never-signed-in rows never will — nothing renders.
 */
function EmailVerifiedDot({ verified }: { verified: boolean | undefined }) {
  if (typeof verified !== "boolean") return null
  const label = verified ? "Email verified" : "Email not verified yet"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className={cn(
              "inline-block size-2 shrink-0 rounded-full",
              verified ? "bg-emerald-500" : "bg-amber-400",
            )}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

type MemberRow = FunctionReturnType<typeof api.workspaces.members>[number]

/**
 * Patches one member row inside the cached `workspaces.members` query so the
 * table redraws in the same frame as the click (docs/memory/RULES.md 26).
 * Convex drops the layer when the real result lands, and rolls it back by
 * itself if the mutation throws — which is when the caller raises a toast.
 */
function patchMember(
  localStore: OptimisticLocalStore,
  organizationId: string,
  memberId: Id<"members">,
  patch: (row: MemberRow) => MemberRow,
): void {
  const args = { organizationId: organizationId as Id<"organizations"> }
  const current = localStore.getQuery(api.workspaces.members, args)
  if (!current) return
  localStore.setQuery(
    api.workspaces.members,
    args,
    current.map((row) => (row._id === memberId ? patch(row) : row)),
  )
}

/**
 * The Access cell: a quiet statement of fact for owners and admins, and an
 * editable control for members. Scoping is a member-only tool, so the cell
 * says so rather than offering an edit that would only fail.
 */
function AccessCell({
  email,
  role,
  eventIds,
  events,
  editable,
  onEdit,
}: {
  email: string
  role: string
  eventIds: Array<string> | undefined
  events: Array<AccessEvent>
  editable: boolean
  /** Swaps the card to the in-place access panel — never a dialog. */
  onEdit: () => void
}) {
  if (role === "owner" || role === "admin") {
    return (
      <span className="text-sm text-muted-foreground">
        All events{" "}
        <span className="text-xs">({role === "owner" ? "owner" : "admin"})</span>
      </span>
    )
  }

  const label = accessSummary(eventIds, events)

  if (!editable) {
    return <span className="text-sm text-muted-foreground">{label}</span>
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 max-w-full justify-start gap-1.5 font-normal"
      aria-label={`Change event access for ${email}`}
      onClick={onEdit}
    >
      <span className="truncate">{label}</span>
      <RiPencilLine
        size={13}
        aria-hidden
        className="shrink-0 text-muted-foreground"
      />
    </Button>
  )
}

/**
 * Header both in-place panels share: back arrow ← returns to the table, a
 * REAL heading (role=heading, which CardTitle's div is not), description
 * below. The card stays the one and only surface.
 */
function PanelHeader({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <CardHeader className="border-b">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Back to team"
          onClick={onBack}
        >
          <RiArrowLeftLine size={16} aria-hidden />
        </Button>
        <h3 className="font-heading text-base leading-none font-medium">
          {title}
        </h3>
      </div>
      <CardDescription>{children}</CardDescription>
    </CardHeader>
  )
}

/** Per-member event access, edited in place of the table. */
function MemberAccessPanel({
  email,
  events,
  eventIds,
  onSave,
  onClose,
}: {
  email: string
  events: Array<AccessEvent>
  eventIds: Array<string> | undefined
  onSave: (eventIds: Array<string> | null) => Promise<unknown>
  onClose: () => void
}) {
  const [value, setValue] = useState<Array<string> | null>(eventIds ?? null)
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (value !== null && value.length === 0) {
      setError("Pick at least one event, or give them all events.")
      return
    }
    setError(undefined)
    setSaving(true)
    try {
      await onSave(value)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't change that person's access."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PanelHeader title="Event access" onBack={onClose}>
        Which events <strong className="font-medium">{email}</strong> can open.
        Events they aren't given simply don't exist for them — not in the event
        switcher, not by direct link.
      </PanelHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <EventAccessPicker
            idPrefix={`access-${email}`}
            events={events}
            value={value}
            onChange={(next) => {
              setValue(next)
              setError(undefined)
            }}
          />

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save access"}
            </Button>
          </div>
        </form>
      </CardContent>
    </>
  )
}

/**
 * Invite by email, in place of the table — the invite is emailed through
 * Resend on the server. Mounts fresh on every open, so the form always starts
 * reset with the caller's pre-scoped events.
 */
function InviteMemberPanel({
  organizationId,
  workspaceName,
  events,
  presetEventIds,
  onClose,
}: {
  organizationId: string
  workspaceName: string
  events: Array<AccessEvent>
  /** Arriving from an event's Team tab, the scope is already decided. */
  presetEventIds?: Array<string>
  onClose: () => void
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [access, setAccess] = useState<Array<string> | null>(
    presetEventIds ?? null,
  )
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
    const scoped = role === "member" ? access : null
    if (scoped !== null && scoped.length === 0) {
      setError("Pick at least one event, or give them all events.")
      return
    }
    setError(undefined)
    try {
      await addMember.mutateAsync({
        organizationId: organizationId as Id<"organizations">,
        email: trimmed,
        role,
        ...(scoped !== null
          ? { eventIds: scoped as Array<Id<"events">> }
          : {}),
      })
      toast.success(`Invite email sent to ${trimmed}`, {
        description: `They join ${workspaceName} as ${roleLabel(role).toLowerCase()} with access to ${
          scoped === null ? "every event" : accessSummary(scoped, events)
        } the moment they sign in.`,
      })
      // Back to the table, where the new row shows as "Invited".
      onClose()
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't invite that person."))
    }
  }

  return (
    <>
      <PanelHeader title="Invite a teammate" onBack={onClose}>
        We'll email them an invite. They join {workspaceName} as soon as they
        sign in with this address.
      </PanelHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-6">
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
                {/* Base UI hands the trigger the raw value — spell out the
                    label, otherwise the closed select reads "member". */}
                <SelectValue>
                  {(selected) => roleLabel(String(selected))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </LabeledField>

          {/* Admins always run the whole workspace, so the picker only
              appears for the role it can actually apply to. */}
          {role === "member" ? (
            <LabeledField
              label="Event access"
              description="Events they aren't given stay completely hidden from them."
            >
              <EventAccessPicker
                idPrefix="invite-access"
                events={events}
                value={access}
                onChange={(next) => {
                  setAccess(next)
                  setError(undefined)
                }}
              />
            </LabeledField>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMember.isPending}>
              {addMember.isPending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      </CardContent>
    </>
  )
}

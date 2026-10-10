import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiTeamLine, RiUserAddLine } from "@remixicon/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PanelCard } from "@/components/portal/panel-card"
import { usePortal } from "@/components/portal/portal-context"
import { initialsOf } from "@/components/portal/portal-utils"
import { errorMessage } from "@/lib/errors"

export const Route = createFileRoute("/sponsor/team")({
  component: TeamPage,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function TeamPage() {
  return <TeamCard />
}

/** Everyone who can manage this sponsor's sessions — and a way to add one. */
function TeamCard() {
  const { home } = usePortal()
  const sponsor = home.sponsor
  const [inviting, setInviting] = React.useState(false)
  if (!sponsor) return null

  return (
    <PanelCard
      icon={RiTeamLine}
      title="People with access"
      count={sponsor.contacts.length}
      action={
        sponsor.canInviteColleagues ? (
          <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
            <RiUserAddLine aria-hidden />
            Invite
          </Button>
        ) : null
      }
      flush
      bodyClassName="gap-0"
    >
      <ul className="divide-y divide-border">
        {sponsor.contacts.map((contact) => (
          <li key={contact.id} className="flex items-center gap-3 px-6 py-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-[11px]">{initialsOf(...contact.name.split(" "))}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {contact.name}
                {contact.isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
            </div>
          </li>
        ))}
      </ul>
      {sponsor.canInviteColleagues ? null : (
        <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
          Need someone else to have access? Email the organizers and they'll add them.
        </p>
      )}
      <InviteColleagueDialog open={inviting} onOpenChange={setInviting} />
    </PanelCard>
  )
}

function InviteColleagueDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { home, portalToken } = usePortal()
  const addColleague = useConvexMutation(api.portal.addSponsorColleague)
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "" })
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setForm({ firstName: "", lastName: "", email: "" })
    setShowErrors(false)
  }, [open])

  const firstMissing = !form.firstName.trim()
  const emailInvalid = !EMAIL_PATTERN.test(form.email.trim())

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (firstMissing || emailInvalid) {
      setShowErrors(true)
      toast.error("Add their first name and a valid email")
      return
    }
    setSaving(true)
    try {
      await addColleague({
        portalToken,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
      })
      toast.success(`${form.firstName.trim()} has been invited`, {
        description: "They'll get an email with their own sign-in link.",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error("Couldn't invite your colleague", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a colleague</DialogTitle>
          <DialogDescription>
            They'll be able to add and edit {home.sponsor?.name ?? "your company"}'s sessions. We
            email them their own sign-in link — no password needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="colleague-first">
                  First name<span className="required-asterisk">*</span>
                </FieldLabel>
                <Input
                  id="colleague-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  aria-invalid={showErrors && firstMissing ? true : undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="colleague-last">Last name</FieldLabel>
                <Input
                  id="colleague-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="colleague-email">
                Work email<span className="required-asterisk">*</span>
              </FieldLabel>
              <Input
                id="colleague-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@company.com"
                aria-invalid={showErrors && emailInvalid ? true : undefined}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <RiUserAddLine aria-hidden />
              {saving ? "Inviting…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

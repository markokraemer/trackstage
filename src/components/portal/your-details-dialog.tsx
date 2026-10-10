import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usePortal } from "@/components/portal/portal-context"
import { errorMessage } from "@/lib/errors"

/**
 * "Your details" — the sponsor portal's answer to Profile. A sponsor contact
 * isn't a speaker, so they don't get the speaker profile (bio, headshot,
 * links for the programme); they need the organizers to know who they are
 * and how to reach them. If they ever present a session they become a
 * speaker too, and the full speaker profile opens up in `/portal`.
 */
export function YourDetailsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { home, portalToken } = usePortal()
  const me = home.me
  const save = useConvexMutation(api.portal.updateProfile)
  const [form, setForm] = React.useState({ firstName: "", lastName: "", jobTitle: "", phone: "" })
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setForm({
      firstName: me.firstName,
      lastName: me.lastName,
      jobTitle: me.jobTitle ?? "",
      phone: me.phone ?? "",
    })
  }, [open, me.firstName, me.lastName, me.jobTitle, me.phone])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.firstName.trim()) {
      toast.error("Add your first name")
      return
    }
    setSaving(true)
    try {
      await save({
        portalToken,
        patch: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          jobTitle: form.jobTitle.trim(),
          phone: form.phone.trim(),
        },
      })
      toast.success("Your details are saved")
      onOpenChange(false)
    } catch (error) {
      toast.error("Couldn't save your details", { description: errorMessage(error, "Please try again.") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your details</DialogTitle>
          <DialogDescription>
            How the organizers know and reach you. Your colleagues see your name and email on the
            Team page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="details-first">
                  First name<span className="required-asterisk">*</span>
                </FieldLabel>
                <Input
                  id="details-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="details-last">Last name</FieldLabel>
                <Input
                  id="details-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="details-title">Job title</FieldLabel>
              <Input
                id="details-title"
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder="Head of Developer Relations"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="details-phone">Phone number</FieldLabel>
              <Input
                id="details-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 123 4567"
              />
              <FieldDescription>Only used by the organizers, for anything urgent.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="details-email">Email</FieldLabel>
              <Input id="details-email" value={me.email} disabled />
              <FieldDescription>Ask the organizers to change this.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

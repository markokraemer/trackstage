/**
 * Add a speaker by hand (sbek SPK-02).
 *
 * The roster is otherwise derived from accepted submissions, which covers the
 * CFP path and nothing else. Real programmes are half invited: a keynote
 * booked over email, a sponsor's speaker, a panel moderator. This is the door
 * for those — and because it creates a real person with a real portal token,
 * the speaker portal, tasks, reminders and comms all work for them from the
 * moment they're added.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiUserAddLine } from "@remixicon/react"
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  WORKFLOW_OPTIONS,
  isWorkflowStatus,
} from "@/components/dashboard/speaker-workflow-select"

export interface AddSpeakerDialogProps {
  eventId: Id<"events">
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AddSpeakerDialog({
  eventId,
  open,
  onOpenChange,
}: AddSpeakerDialogProps) {
  const addManual = useConvexMutation(api.speakersAdmin.addManual)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [company, setCompany] = React.useState("")
  const [jobTitle, setJobTitle] = React.useState("")
  const [bio, setBio] = React.useState("")
  const [workflowStatus, setWorkflowStatus] = React.useState("confirmed")
  const [showErrors, setShowErrors] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setFirstName("")
    setLastName("")
    setEmail("")
    setCompany("")
    setJobTitle("")
    setBio("")
    setWorkflowStatus("confirmed")
    setShowErrors(false)
  }, [open])

  const firstNameMissing = firstName.trim().length === 0
  const emailInvalid = !EMAIL_PATTERN.test(email.trim())

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (firstNameMissing || emailInvalid) {
      setShowErrors(true)
      toast.error("Add a first name and a valid email address")
      return
    }
    setSubmitting(true)
    try {
      const result = await addManual({
        eventId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        bio: bio.trim() || undefined,
        workflowStatus: isWorkflowStatus(workflowStatus)
          ? workflowStatus
          : "confirmed",
      })
      onOpenChange(false)
      toast.success(
        result.created
          ? `${firstName.trim()} added to your speakers`
          : `${firstName.trim()} was already on this event — details updated`,
        {
          description: result.created
            ? "They have a speaker portal already: open their row's menu to copy the link."
            : undefined,
        },
      )
    } catch (error) {
      toast.error("Couldn't add the speaker", {
        description:
          errorMessage(error, "Please try again."),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a speaker</DialogTitle>
          <DialogDescription>
            For the people who never went through the call for speakers —
            keynotes, sponsors, moderators. They get a speaker portal
            immediately, so you can assign them tasks like anyone else.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)}>
          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="speaker-first">
                  First name<span className="required-asterisk">*</span>
                </FieldLabel>
                <Input
                  id="speaker-first"
                  name="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Ada"
                  aria-invalid={
                    showErrors && firstNameMissing ? true : undefined
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="speaker-last">Last name</FieldLabel>
                <Input
                  id="speaker-last"
                  name="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Lovelace"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="speaker-email">
                Email address<span className="required-asterisk">*</span>
              </FieldLabel>
              <FieldDescription>
                Where their portal link and every reminder goes. Adding an email
                that already exists on this event updates that person instead of
                creating a duplicate.
              </FieldDescription>
              <Input
                id="speaker-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ada@example.com"
                aria-invalid={showErrors && emailInvalid ? true : undefined}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="speaker-company">Company</FieldLabel>
                <Input
                  id="speaker-company"
                  name="company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Analytical Engines Ltd"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="speaker-title">Job title</FieldLabel>
                <Input
                  id="speaker-title"
                  name="jobTitle"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="Principal Engineer"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="speaker-status">Status</FieldLabel>
              <FieldDescription>
                Use <span className="font-medium">Invited</span> while you're
                still waiting on a yes.
              </FieldDescription>
              <Select
                items={WORKFLOW_OPTIONS}
                value={workflowStatus}
                onValueChange={(next) => setWorkflowStatus(String(next))}
              >
                <SelectTrigger id="speaker-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="speaker-bio">Bio</FieldLabel>
              <FieldDescription>
                Optional — the speaker can write their own in their portal, and
                you can edit it later from their row.
              </FieldDescription>
              <Textarea
                id="speaker-bio"
                name="bio"
                rows={4}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Two or three sentences for the public speaker page."
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <RiUserAddLine aria-hidden />
              {submitting ? "Adding…" : "Add speaker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

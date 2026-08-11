/**
 * People on a submission, editable after the fact (sbek ABS-11).
 *
 * Co-speakers are not a submit-time-only fact. A panel gains a moderator two
 * weeks out, a co-author drops out, the person the form called a "speaker"
 * turns out to be the chairperson. Sessionboard makes you rebuild the session
 * for that; here it is three controls on the People tab — and every change
 * lands in the submission's History with who did it.
 *
 * Adding is by EMAIL, deliberately: email is the identity of a person on an
 * event everywhere else in the product, so adding someone who already exists
 * attaches THEM (portal, tasks, files intact) rather than making a twin. Their
 * own words are never overwritten — a name typed here only fills a blank.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiAddLine, RiCloseLine, RiTeamLine, RiUserAddLine } from "@remixicon/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { initialsOf } from "@/components/dashboard/format"

/** The three roles a person can hold on a session (docs/SPEC.md §2.3). */
export const PARTICIPANT_ROLE_VALUES = [
  "speaker",
  "chairperson",
  "moderator",
] as const

export type ParticipantRole = (typeof PARTICIPANT_ROLE_VALUES)[number]

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  speaker: "Speaker",
  chairperson: "Chairperson",
  moderator: "Moderator",
}

export const PARTICIPANT_ROLES = PARTICIPANT_ROLE_VALUES.map((value) => ({
  value,
  label: PARTICIPANT_ROLE_LABELS[value],
}))

function isRole(value: string): value is ParticipantRole {
  return (PARTICIPANT_ROLE_VALUES as ReadonlyArray<string>).includes(value)
}

export interface SubmissionParticipant {
  personId: Id<"people">
  name: string
  email: string
  role: string
  company?: string
}

export interface ParticipantsEditorProps {
  submissionId: Id<"submissions">
  participants: Array<SubmissionParticipant>
}

export function ParticipantsEditor({
  submissionId,
  participants,
}: ParticipantsEditorProps) {
  const addParticipant = useConvexMutation(
    api.speakersAdmin.addSubmissionParticipant,
  )
  const setRole = useConvexMutation(api.speakersAdmin.setParticipantRole)
  const removeParticipant = useConvexMutation(
    api.speakersAdmin.removeSubmissionParticipant,
  )

  const [adding, setAdding] = React.useState(false)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setNewRole] = React.useState<string>("speaker")
  const [submitting, setSubmitting] = React.useState(false)
  /** Person id currently being changed — disables just that row. */
  const [busyPerson, setBusyPerson] = React.useState<string | null>(null)

  function resetForm() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setNewRole("speaker")
  }

  async function submitNew(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    if (!email.trim()) {
      toast.error("An email address is required")
      return
    }
    setSubmitting(true)
    try {
      const result = await addParticipant({
        submissionId,
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role: isRole(role) ? role : "speaker",
      })
      resetForm()
      setAdding(false)
      toast.success(
        `${firstName.trim() || email.trim()} added to this submission`,
        {
          description: result.created
            ? "They're a speaker on this event now, with their own portal."
            : "They were already on this event — same person, same portal.",
        },
      )
    } catch (error) {
      toast.error("Couldn't add them", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function changeRole(person: SubmissionParticipant, next: string) {
    if (!isRole(next) || next === person.role) return
    setBusyPerson(person.personId)
    try {
      await setRole({ submissionId, personId: person.personId, role: next })
    } catch (error) {
      toast.error("Couldn't change their role", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setBusyPerson(null)
    }
  }

  async function remove(person: SubmissionParticipant) {
    setBusyPerson(person.personId)
    try {
      await removeParticipant({ submissionId, personId: person.personId })
      toast.success(`${person.name} removed from this submission`, {
        description:
          "They keep their speaker record, portal and any other sessions.",
      })
    } catch (error) {
      toast.error("Couldn't remove them", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setBusyPerson(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {participants.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={RiTeamLine}
          title="No people on this submission yet"
          description="Speakers who came through your form appear here with their role. Add co-speakers, a chairperson or a moderator below — they get a speaker portal straight away."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {participants.map((person) => (
            <li
              key={person.personId}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">
                  {initialsOf(person.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {person.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {person.email}
                  {person.company ? ` · ${person.company}` : ""}
                </p>
              </div>
              <Select
                items={PARTICIPANT_ROLES}
                value={person.role}
                onValueChange={(next) => void changeRole(person, String(next))}
                disabled={busyPerson === person.personId}
              >
                <SelectTrigger
                  size="sm"
                  className="w-36"
                  aria-label={`Role for ${person.name}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_ROLES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${person.name} from this submission`}
                disabled={busyPerson === person.personId}
                onClick={() => void remove(person)}
              >
                <RiCloseLine aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(formEvent) => void submitNew(formEvent)}
          className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4"
        >
          <p className="text-sm font-medium text-foreground">
            Add someone to this submission
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="participant-first">First name</FieldLabel>
              <Input
                id="participant-first"
                value={firstName}
                onChange={(inputEvent) => setFirstName(inputEvent.target.value)}
                placeholder="Marcus"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="participant-last">Last name</FieldLabel>
              <Input
                id="participant-last"
                value={lastName}
                onChange={(inputEvent) => setLastName(inputEvent.target.value)}
                placeholder="Okafor"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="participant-email">
              Email<span className="required-asterisk">*</span>
            </FieldLabel>
            <FieldDescription>
              If they're already on this event we'll attach that person — same
              portal, no duplicate.
            </FieldDescription>
            <Input
              id="participant-email"
              type="email"
              value={email}
              onChange={(inputEvent) => setEmail(inputEvent.target.value)}
              placeholder="marcus@example.com"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="participant-role">Role</FieldLabel>
            <Select
              items={PARTICIPANT_ROLES}
              value={role}
              onValueChange={(next) => setNewRole(String(next))}
            >
              <SelectTrigger id="participant-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPANT_ROLES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => {
                setAdding(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              <RiUserAddLine aria-hidden />
              {submitting ? "Adding…" : "Add to submission"}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setAdding(true)}
        >
          <RiAddLine aria-hidden />
          Add a person
        </Button>
      )}
    </div>
  )
}


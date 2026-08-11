import { RiDeleteBinLine, RiUserLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  collectableParticipantFields,
  participantFieldKey,
  participantFieldValue,
} from "@/components/submit/form-logic"
import { ROLE_LABELS } from "@/components/submit/types"
import type {
  ParticipantConfig,
  ParticipantDraft,
} from "@/components/submit/types"

/**
 * One participant on the Participants step (docs/SPEC.md §4.3). Participant 1
 * is the person filling the form — it is labelled "(You)" and its email is
 * locked to the account email so the submission always ties back to the right
 * portal.
 *
 * Only the fields the organizer enabled are shown, and the role picker only
 * appears when the form actually offers more than one role — defaults never
 * block (docs/SPEC.md §2.9).
 */

const FIELD_ORDER = [
  "firstName",
  "lastName",
  "email",
  "jobTitle",
  "company",
  "phone",
  "bio",
]

const PLACEHOLDERS: Record<string, string> = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  jobTitle: "Staff Engineer",
  company: "Analytical Engines",
  phone: "+1 555 010 0123",
  bio: "A short speaker bio, in the third person.",
}

export interface ParticipantCardProps {
  index: number
  participant: ParticipantDraft
  config: ParticipantConfig
  /** True for participant 1 — the person completing the form. */
  isSelf: boolean
  /** `${index}-${fieldId}` keys flagged by validation. */
  invalidKeys: Array<string>
  onChange: (patch: Partial<ParticipantDraft>) => void
  onRemove?: () => void
}

export function ParticipantCard({
  index,
  participant,
  config,
  isSelf,
  invalidKeys,
  onChange,
  onRemove,
}: ParticipantCardProps) {
  const order = (fieldId: string) => {
    const at = FIELD_ORDER.indexOf(fieldId)
    return at === -1 ? FIELD_ORDER.length : at
  }
  const fields = collectableParticipantFields(config).sort(
    (a, b) => order(a.id) - order(b.id),
  )
  const headshotField = config.fields.find((field) => field.id === "headshot")

  const setField = (fieldId: string, value: string) =>
    onChange({ [fieldId]: value })

  const roles = [
    "speaker",
    ...(config.chairpersonEnabled ? ["chairperson"] : []),
    ...(config.moderatorEnabled ? ["moderator"] : []),
  ]

  const isInvalid = (fieldId: string) =>
    invalidKeys.includes(participantFieldKey(index, fieldId))

  const renderField = (fieldId: string, label: string, required: boolean, help?: string) => {
    const id = `participant-${index}-${fieldId}`
    const invalid = isInvalid(fieldId)
    const value = participantFieldValue(participant, fieldId)
    const lockedSelfEmail = isSelf && fieldId === "email"

    return (
      <Field key={fieldId} data-invalid={invalid || undefined}>
        <FieldLabel htmlFor={id} className="text-foreground">
          {label}
          {required ? (
            <span className="required-asterisk" aria-hidden>
              *
            </span>
          ) : null}
          {required ? <span className="sr-only">(required)</span> : null}
        </FieldLabel>
        {help ? <FieldDescription>{help}</FieldDescription> : null}
        {lockedSelfEmail ? (
          <FieldDescription>
            This is the email you entered on the Account step — your submission
            and speaker portal are tied to it.
          </FieldDescription>
        ) : null}

        {fieldId === "bio" ? (
          <Textarea
            id={id}
            rows={4}
            value={value}
            aria-invalid={invalid || undefined}
            placeholder={PLACEHOLDERS[fieldId]}
            onChange={(event) => setField(fieldId, event.target.value)}
          />
        ) : (
          <Input
            id={id}
            type={
              fieldId === "email" ? "email" : fieldId === "phone" ? "tel" : "text"
            }
            value={value}
            readOnly={lockedSelfEmail}
            aria-invalid={invalid || undefined}
            placeholder={PLACEHOLDERS[fieldId]}
            className={cn(lockedSelfEmail && "bg-muted/60 text-muted-foreground")}
            onChange={(event) => setField(fieldId, event.target.value)}
          />
        )}

        {invalid ? <FieldError>This field is required.</FieldError> : null}
      </Field>
    )
  }

  const nameFields = fields.filter((field) =>
    ["firstName", "lastName"].includes(field.id),
  )
  const restFields = fields.filter(
    (field) => !["firstName", "lastName"].includes(field.id),
  )

  return (
    <Card size="sm" className="gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <RiUserLine size={14} aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-foreground">
            Participant {index + 1}
            {isSelf ? " (You)" : ""}
          </h3>
        </div>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <RiDeleteBinLine aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>

      <FieldGroup className="gap-5">
        {roles.length > 1 ? (
          <Field>
            <FieldLabel
              htmlFor={`participant-${index}-role`}
              className="text-foreground"
            >
              Role
            </FieldLabel>
            <FieldDescription>
              How this person will take part in the session.
            </FieldDescription>
            <Select
              value={participant.role}
              onValueChange={(next) => onChange({ role: String(next) })}
            >
              <SelectTrigger id={`participant-${index}-role`} className="w-full">
                <SelectValue placeholder="Select a role…" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role] ?? role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        {nameFields.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {nameFields.map((field) =>
              renderField(field.id, field.label, field.required, field.help),
            )}
          </div>
        ) : null}

        {restFields.map((field) =>
          renderField(field.id, field.label, field.required, field.help),
        )}

        {headshotField?.enabled ? (
          <FieldDescription>
            {headshotField.label}: no upload needed now — you can add it in your
            speaker portal after you submit.
          </FieldDescription>
        ) : null}
      </FieldGroup>
    </Card>
  )
}

import { useId } from "react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { InfoNote, SectionHeading, StepIntro } from "../builder-controls"
import { PublicLinkCard } from "../public-link-card"
import { FORM_KINDS } from "../model"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 1 — Setup. Two big choice cards for what the form collects, plus the
 * public link, front and centre (docs/SPEC.md §2.8: swyx hunted for it).
 */
export function SetupStep({
  draft,
  formId,
  eventSlug,
  slug,
  patch,
}: {
  draft: FormDraft
  formId: string
  /** Form slugs are unique per event, so the link needs both segments. */
  eventSlug: string
  slug: string
  patch: (values: Partial<FormDraft>) => void
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Setup"
        description="What this form collects, and where people fill it in."
      />

      <SectionHeading
        title="What kind of submissions do you want to collect?"
        description="Abstracts get reviewed before you decide. Sessions are already confirmed and go straight onto the agenda."
      />

      <RadioGroup
        value={draft.kind}
        onValueChange={(value) => patch({ kind: String(value) })}
        className="sm:grid-cols-2"
      >
        {FORM_KINDS.map((kind) => (
          <FieldLabel key={kind.value} htmlFor={`${id}-${kind.value}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle className="gap-2">
                  <kind.icon size={16} aria-hidden className="text-primary" />
                  {kind.label}
                </FieldTitle>
                <FieldDescription>{kind.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                id={`${id}-${kind.value}`}
                value={kind.value}
                aria-label={kind.label}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      <InfoNote>
        You can change any of this later — nothing here is locked in once people
        start submitting.
      </InfoNote>

      <PublicLinkCard formId={formId} eventSlug={eventSlug} slug={slug} />
    </div>
  )
}

import { useId } from "react"
import { RiExternalLinkLine } from "@remixicon/react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { InfoNote, SectionHeading, StepIntro } from "../builder-controls"
import { CopyLinkButton } from "../copy-link-button"
import { FORM_KINDS, publicFormPath } from "../model"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 1 — Setup. Two big choice cards for what the form collects, plus the
 * public link, front and centre (docs/SPEC.md §2.8: swyx hunted for it).
 */
export function SetupStep({
  draft,
  slug,
  patch,
}: {
  draft: FormDraft
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

      <div className="rounded-xl border border-border bg-card p-4">
        <SectionHeading
          title="Public link"
          description="Share this anywhere — no account needed to open it."
        />
        <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 font-mono text-sm break-all text-foreground">
          {publicFormPath(slug)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyLinkButton slug={slug} />
          <Button
            variant="outline"
            render={
              <a
                href={publicFormPath(slug)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <RiExternalLinkLine aria-hidden />
            View form
          </Button>
        </div>
      </div>
    </div>
  )
}

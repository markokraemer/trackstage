import { useId } from "react"

import { Input } from "@/components/ui/input"
import {
  BuilderField,
  CharCounter,
  SectionHeading,
  SettingRow,
  StepIntro,
} from "../builder-controls"
import { RichTextField } from "../rich-text-field"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 2 — Welcome screen: the first thing a submitter sees
 * (docs/ux/02 image23).
 */
export function WelcomeStep({
  draft,
  patch,
}: {
  draft: FormDraft
  patch: (values: Partial<FormDraft>) => void
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Welcome screen"
        description="The first page people see before they start filling anything in."
      />

      <SectionHeading
        title="Names"
        description="One name for your team, one for the people submitting."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <BuilderField
          htmlFor={`${id}-internal`}
          label="Internal form name"
          required
          description="Only your team sees this — it's how the form is listed."
          hint={<CharCounter value={draft.internalName} max={120} />}
        >
          <Input
            id={`${id}-internal`}
            value={draft.internalName}
            maxLength={120}
            onChange={(event) => patch({ internalName: event.target.value })}
          />
        </BuilderField>

        <BuilderField
          htmlFor={`${id}-external`}
          label="Public form title"
          required
          description="Shown at the top of the public form."
          hint={<CharCounter value={draft.externalTitle} max={120} />}
        >
          <Input
            id={`${id}-external`}
            value={draft.externalTitle}
            maxLength={120}
            onChange={(event) => patch({ externalTitle: event.target.value })}
          />
        </BuilderField>
      </div>

      <BuilderField
        htmlFor={`${id}-heading`}
        label="Page heading"
        required
        description="The big line on the welcome page, e.g. “Call for Speakers”."
        hint={<CharCounter value={draft.pageHeading} max={60} />}
        className="sm:max-w-md"
      >
        <Input
          id={`${id}-heading`}
          value={draft.pageHeading}
          maxLength={60}
          onChange={(event) => patch({ pageHeading: event.target.value })}
        />
      </BuilderField>

      <SettingRow
        id={`${id}-show-welcome`}
        title="Show a welcome message"
        description="A short intro under the heading — what you're looking for, and by when."
        checked={draft.showWelcomeMessage}
        onCheckedChange={(value) => patch({ showWelcomeMessage: value })}
      >
        <RichTextField
          label="Welcome message"
          value={draft.welcomeMessage}
          onValueChange={(value) => patch({ welcomeMessage: value })}
          placeholder="<p>We're looking for practical talks from people who've shipped something.</p>"
          description="Use the buttons to add bold text, links and bullet points."
          rows={7}
        />
      </SettingRow>
    </div>
  )
}

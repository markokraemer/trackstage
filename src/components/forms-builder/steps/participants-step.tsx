import { useId } from "react"
import { RiAlertLine, RiLockLine } from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import {
  BuilderField,
  InfoNote,
  SectionHeading,
  SettingRow,
  StepIntro,
} from "../builder-controls"
import type { ParticipantField } from "../model"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 4 — Participants (docs/SPEC.md §4.2 step 4).
 *
 * Sessionboard's min-2-speakers default is exactly the trap swyx complained
 * about in the video, so the default here is 1 and anything higher gets an
 * explicit warning.
 */
export function ParticipantsStep({
  draft,
  update,
}: {
  draft: FormDraft
  update: (updater: (draft: FormDraft) => FormDraft) => void
}) {
  const id = useId()
  const config = draft.participantConfig

  function patchConfig(patch: Partial<FormDraft["participantConfig"]>) {
    update((current) => ({
      ...current,
      participantConfig: { ...current.participantConfig, ...patch },
    }))
  }

  function patchField(fieldId: string, patch: Partial<ParticipantField>) {
    update((current) => ({
      ...current,
      participantConfig: {
        ...current.participantConfig,
        fields: current.participantConfig.fields.map((field) =>
          field.id === fieldId ? { ...field, ...patch } : field,
        ),
      },
    }))
  }

  const minWarning = config.speakerMin > 1

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Participants"
        description="Who's presenting, and what you need to know about them."
      />

      <SectionHeading
        title="How many speakers per submission?"
        description="This is what submitters are allowed to add on the participants step."
      />

      <div className="grid gap-5 sm:max-w-md sm:grid-cols-2">
        <BuilderField
          htmlFor={`${id}-min`}
          label="Minimum speakers"
          description="1 lets people submit solo."
        >
          <Input
            id={`${id}-min`}
            type="number"
            min={1}
            max={10}
            value={config.speakerMin}
            aria-invalid={minWarning ? true : undefined}
            onChange={(event) => {
              const next = Math.max(1, Number(event.target.value) || 1)
              patchConfig({
                speakerMin: next,
                speakerMax: Math.max(next, config.speakerMax),
              })
            }}
          />
        </BuilderField>

        <BuilderField
          htmlFor={`${id}-max`}
          label="Maximum speakers"
          description="Co-speakers, panellists — the cap per submission."
        >
          <Input
            id={`${id}-max`}
            type="number"
            min={config.speakerMin}
            max={10}
            value={config.speakerMax}
            onChange={(event) => {
              const next = Math.max(
                config.speakerMin,
                Number(event.target.value) || config.speakerMin,
              )
              patchConfig({ speakerMax: next })
            }}
          />
        </BuilderField>
      </div>

      {minWarning ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-status-amber-dot/30 bg-status-amber-bg px-3.5 py-3 text-sm text-status-amber-fg">
          <RiAlertLine size={16} aria-hidden className="mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            Most events allow solo speakers. With a minimum of{" "}
            {config.speakerMin}, anyone submitting on their own will be blocked
            from finishing the form.
          </p>
        </div>
      ) : null}

      <SectionHeading
        title="Other roles"
        description="Turn these on if a submission can list more than just speakers."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingRow
          id={`${id}-chair`}
          title="Chairperson"
          description="Someone who introduces and runs the session."
          checked={config.chairpersonEnabled}
          onCheckedChange={(value) => patchConfig({ chairpersonEnabled: value })}
        />
        <SettingRow
          id={`${id}-moderator`}
          title="Moderator"
          description="Someone who facilitates a panel or Q&A."
          checked={config.moderatorEnabled}
          onCheckedChange={(value) => patchConfig({ moderatorEnabled: value })}
        />
      </div>

      <SectionHeading
        title="What to collect about each participant"
        description="Name and email are always required — that's how you reach them."
      />

      <Card className="gap-0 divide-y p-0">
        {config.fields.map((field) => (
          <div
            key={field.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                {field.label}
                {field.locked ? (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <RiLockLine size={11} aria-hidden />
                    Locked
                  </Badge>
                ) : null}
              </p>
              {field.help ? (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              ) : null}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Required
              <Switch
                size="sm"
                checked={field.required}
                disabled={field.locked || !field.enabled}
                aria-label={`${field.label} is required`}
                onCheckedChange={(value) =>
                  patchField(field.id, { required: value })
                }
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Enabled
              <Switch
                size="sm"
                checked={field.enabled}
                disabled={field.locked}
                aria-label={`${field.label} is shown on the form`}
                onCheckedChange={(value) =>
                  patchField(
                    field.id,
                    value ? { enabled: true } : { enabled: false, required: false },
                  )
                }
              />
            </label>
          </div>
        ))}
      </Card>

      <InfoNote>
        Everything collected here fills in the speaker's portal profile, so they
        never have to type it twice.
      </InfoNote>
    </div>
  )
}

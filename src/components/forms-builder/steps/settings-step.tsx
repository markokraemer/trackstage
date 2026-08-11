import { useId } from "react"
import { format } from "date-fns"

import { Input } from "@/components/ui/input"
import {
  BuilderField,
  InfoNote,
  SectionHeading,
  SettingRow,
  StepIntro,
} from "../builder-controls"
import { DateTimePicker } from "../date-time-picker"
import { RichTextField } from "../rich-text-field"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 5 — Form settings: deadline, limits, and what happens after someone
 * hits Submit (docs/SPEC.md §4.2 step 5; docs/ux/02 image36 + image9).
 */
export function SettingsStep({
  draft,
  patch,
  update,
  timezone,
}: {
  draft: FormDraft
  patch: (values: Partial<FormDraft>) => void
  update: (updater: (draft: FormDraft) => FormDraft) => void
  timezone?: string
}) {
  const id = useId()
  const settings = draft.settings

  function patchSettings(values: Partial<FormDraft["settings"]>) {
    update((current) => ({
      ...current,
      settings: { ...current.settings, ...values },
    }))
  }

  const closed = draft.status === "closed"
  const closesInPast =
    draft.closeAt !== null && draft.closeAt < Date.now() && !closed

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Form settings"
        description="Deadline, limits, and what submitters see after they send it."
      />

      <SectionHeading
        title="Accepting submissions"
        description="Close the form the moment you want it to stop taking new entries."
      />

      <SettingRow
        id={`${id}-status`}
        title="This form is open"
        description={
          closed
            ? "The public link shows a friendly “submissions are closed” message."
            : "Anyone with the link can submit right now."
        }
        checked={!closed}
        onCheckedChange={(value) => patch({ status: value ? "open" : "closed" })}
      />

      <BuilderField
        htmlFor={`${id}-close`}
        label="Close date"
        description="Optional. After this moment the form stops accepting new and updated submissions."
      >
        <DateTimePicker
          id={`${id}-close`}
          value={draft.closeAt}
          onValueChange={(value) => patch({ closeAt: value })}
          placeholder="No deadline set"
          timezoneLabel={timezone}
        />
      </BuilderField>

      {draft.closeAt !== null ? (
        <InfoNote>
          {closesInPast
            ? `This deadline passed on ${format(new Date(draft.closeAt), "EEE, MMM d, yyyy 'at' h:mm a")} — the form is no longer accepting submissions.`
            : `Submissions close ${format(new Date(draft.closeAt), "EEE, MMM d, yyyy 'at' h:mm a")}. Speakers see the deadline on the welcome page.`}
        </InfoNote>
      ) : null}

      <SettingRow
        id={`${id}-reminder`}
        title="Send a deadline reminder"
        description="Emails anyone still holding an unfinished draft, once, in the three days before this form closes. Needs a close date; edit the wording under Communications → Draft deadline reminder."
        checked={settings.sendReminderEmail}
        disabled={draft.closeAt === null}
        onCheckedChange={(value) => patchSettings({ sendReminderEmail: value })}
      />

      <SectionHeading
        title="Limits"
        description="How much one person can send you."
      />

      <SettingRow
        id={`${id}-limit`}
        title="Limit submissions per person"
        description="Stops one submitter flooding the call. Drafts count towards the limit."
        checked={settings.limitPerUser !== undefined}
        onCheckedChange={(value) =>
          patchSettings({ limitPerUser: value ? 3 : undefined })
        }
      >
        <BuilderField
          htmlFor={`${id}-limit-count`}
          label="Maximum per person"
          description="Including saved drafts."
        >
          <Input
            id={`${id}-limit-count`}
            type="number"
            min={1}
            max={50}
            className="w-32"
            value={settings.limitPerUser ?? 3}
            onChange={(event) =>
              patchSettings({
                limitPerUser: Math.max(1, Number(event.target.value) || 1),
              })
            }
          />
        </BuilderField>
      </SettingRow>

      <SettingRow
        id={`${id}-drafts`}
        title="Let people save drafts"
        description="Submitters can start now and finish later from their speaker portal."
        checked={settings.allowDrafts}
        onCheckedChange={(value) => patchSettings({ allowDrafts: value })}
      />

      <SectionHeading
        title="After submitting"
        description="The confirmation page, in your words."
      />

      <RichTextField
        label="Success message"
        required
        value={settings.successMessage ?? ""}
        onValueChange={(value) => patchSettings({ successMessage: value })}
        description="Shown on the confirmation page right after someone submits."
        placeholder="<p>Thanks! We'll review your talk and get back to you by 30 September.</p>"
        rows={6}
      />

      <SettingRow
        id={`${id}-redirect`}
        title="Send them to their speaker portal"
        description="After the confirmation page, submitters land in the portal where they can edit, add co-speakers and complete tasks."
        checked={settings.autoRedirectToPortal}
        onCheckedChange={(value) =>
          patchSettings({ autoRedirectToPortal: value })
        }
      />
    </div>
  )
}

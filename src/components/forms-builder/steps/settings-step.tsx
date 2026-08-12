import { useId } from "react"
import { format } from "date-fns"

import { Input } from "@/components/ui/input"
import {
  BuilderField,
  InfoNote,
  SectionHeading,
  SettingRow,
  StepIntro,
  WarningNote,
} from "../builder-controls"
import { DateTimePicker } from "../date-time-picker"
import { RichTextField } from "../rich-text-field"
import { releaseBlockers } from "../model"
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
  trackNames,
}: {
  draft: FormDraft
  patch: (values: Partial<FormDraft>) => void
  update: (updater: (draft: FormDraft) => FormDraft) => void
  timezone?: string
  /** The event's tracks — a track question's answers, and a release condition. */
  trackNames: Array<string>
}) {
  const id = useId()
  const settings = draft.settings
  // A form may not be opened while a required question has nothing to offer:
  // that is a public link nobody can submit through. `convex/forms.ts` refuses
  // it too — this is so the organizer never gets that far (docs/memory/
  // DECISIONS.md, "A required dropdown with no options is not shippable").
  const blockers = releaseBlockers(draft.questions, trackNames)

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

      {/* The switch owns `status` and nothing else — flipping it on must not
          quietly undo a deadline the organizer set. But it may not claim the
          form is open while the close date below says otherwise, so when the
          deadline has already passed the row says which of the two is winning
          and what to do about it. */}
      {blockers.length > 0 ? (
        <WarningNote>
          <span className="font-medium">
            This form can&rsquo;t be opened yet.
          </span>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {blockers.map((blocker) => (
              <li key={blocker.questionId}>{blocker.message}</li>
            ))}
          </ul>
          <span className="mt-1 block text-muted-foreground">
            Fix it under <span className="font-medium">Questions</span> — nobody
            can submit through a required question with nothing to pick from.
          </span>
        </WarningNote>
      ) : null}

      <SettingRow
        id={`${id}-status`}
        title="This form is open"
        description={
          blockers.length > 0 && closed
            ? "Switched off until the questions above have answers to offer."
            : closed
              ? "The public link shows a friendly “submissions are closed” message."
              : closesInPast
                ? "Switched on — but the close date below has already passed, so the form is not accepting anything. Move or clear the deadline to reopen it."
                : "Anyone with the link can submit right now."
        }
        checked={!closed}
        disabled={closed && blockers.length > 0}
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

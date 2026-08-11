import { useId } from "react"
import { RiMailSendLine } from "@remixicon/react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  InfoNote,
  SectionHeading,
  SettingRow,
  StepIntro,
} from "../builder-controls"
import { EmailChipsInput } from "../email-chips-input"
import type { FormDraft } from "../use-form-draft"

/**
 * Step 6 — Notifications (docs/ux/02 image7). The submitter confirmation email
 * is the annotated "must have"; admin recipients are the "nice to have".
 */
export function NotificationsStep({
  draft,
  patch,
  update,
}: {
  draft: FormDraft
  patch: (values: Partial<FormDraft>) => void
  update: (updater: (draft: FormDraft) => FormDraft) => void
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Notifications"
        description="Who hears about it when a submission arrives."
      />

      <SectionHeading
        title="Submitter emails"
        description="What the person submitting receives from you."
      />

      <SettingRow
        id={`${id}-confirmation`}
        title="Send a confirmation email"
        description="Sent the moment someone submits, with their session title and a link to their speaker portal."
        checked={draft.participantConfig.sendConfirmationEmail}
        onCheckedChange={(value) =>
          update((current) => ({
            ...current,
            participantConfig: {
              ...current.participantConfig,
              sendConfirmationEmail: value,
            },
          }))
        }
      >
        <Card size="sm" className="gap-2 bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <RiMailSendLine size={15} aria-hidden className="text-primary" />
            Submission received — {draft.externalTitle || "your event"}
            <Badge variant="secondary" className="text-[11px]">
              Preview
            </Badge>
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            “Thanks for submitting <em>[session title]</em>. You can edit it any
            time from your speaker portal until submissions close.”
          </p>
        </Card>
      </SettingRow>

      <SectionHeading
        title="Team alerts"
        description="Your side of the inbox."
      />

      <EmailChipsInput
        label="Email these people when a submission arrives"
        description="They also get a note when a submitter updates an existing entry."
        value={draft.notifyEmails}
        onValueChange={(value) => patch({ notifyEmails: value })}
        emptyHint="No one is alerted yet — add an address to get a nudge for every new submission."
      />

      <InfoNote>
        Every email sent from Trackstage is recorded in Communications, so you
        can always check what went out and to whom.
      </InfoNote>
    </div>
  )
}

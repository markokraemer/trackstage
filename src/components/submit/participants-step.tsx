import { RiAddLine, RiErrorWarningLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ParticipantCard } from "@/components/submit/participant-card"
import type {
  ParticipantConfig,
  ParticipantDraft,
} from "@/components/submit/types"

/**
 * Step 4 — Participants (docs/SPEC.md §4.3). Participant 1 is prefilled from
 * the account step and marked "(You)"; co-speakers are added up to the max the
 * organizer set. The minimum is never used to block progress silently — if the
 * form demands two speakers we say so in plain English (the exact trap swyx
 * fell into in the video).
 */

export interface ParticipantsStepProps {
  config: ParticipantConfig
  participants: Array<ParticipantDraft>
  onChange: (index: number, patch: Partial<ParticipantDraft>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  invalidKeys: Array<string>
  issues: Array<string>
}

export function ParticipantsStep({
  config,
  participants,
  onChange,
  onAdd,
  onRemove,
  invalidKeys,
  issues,
}: ParticipantsStepProps) {
  const speakerCount = participants.filter((p) => p.role === "speaker").length
  const atMax = participants.length >= config.speakerMax
  const rolesLabel =
    config.chairpersonEnabled || config.moderatorEnabled
      ? "Everyone taking part in this session — speakers, and any chairperson or moderator."
      : "Everyone who will be on stage for this session."

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Participants
        </h1>
        <p className="text-sm text-muted-foreground">
          {rolesLabel} You are participant 1 — add co-speakers below if you have
          any.
        </p>
        <p className="text-sm text-muted-foreground">
          This form accepts{" "}
          <strong className="font-medium text-foreground">
            {config.speakerMin === config.speakerMax
              ? `exactly ${config.speakerMax}`
              : `${config.speakerMin}–${config.speakerMax}`}{" "}
            speaker{config.speakerMax === 1 ? "" : "s"}
          </strong>
          . You currently have {speakerCount}.
        </p>
      </div>

      {issues.length > 0 ? (
        <Alert variant="destructive">
          <RiErrorWarningLine aria-hidden />
          <AlertTitle>Check the participants below</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {participants.map((participant, index) => (
          <ParticipantCard
            key={index}
            index={index}
            participant={participant}
            config={config}
            isSelf={index === 0}
            invalidKeys={invalidKeys}
            onChange={(patch) => onChange(index, patch)}
            onRemove={index === 0 ? undefined : () => onRemove(index)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Button type="button" variant="outline" onClick={onAdd} disabled={atMax}>
          <RiAddLine aria-hidden />
          Add speaker
        </Button>
        {atMax ? (
          <p className="text-sm text-muted-foreground">
            You&rsquo;ve reached the maximum of {config.speakerMax} participant
            {config.speakerMax === 1 ? "" : "s"} for this form.
          </p>
        ) : null}
      </div>
    </div>
  )
}

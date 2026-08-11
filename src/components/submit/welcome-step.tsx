import {
  RiCalendarLine,
  RiMapPin2Line,
  RiTimeLine,
  RiUserStarLine,
} from "@remixicon/react"

import { Badge } from "@/components/ui/badge"
import { RichText } from "@/components/submit/rich-text"
import { formatDeadline, formatEventDates } from "@/components/submit/form-logic"
import type { SubmitForm } from "@/components/submit/types"

/**
 * Step 1 — Welcome (docs/ux/01 §7, docs/SPEC.md §4.3).
 *
 * Order matters here: the constraints a speaker needs *before* investing time
 * (deadline, per-user cap) sit at the top in a bordered callout, then the
 * organizer's own welcome copy, then what we're actually looking for — the
 * tracks and formats on offer, surfaced on this logged-out screen rather than
 * hidden behind the account step.
 */

export interface WelcomeStepProps {
  form: SubmitForm
}

function optionsFor(form: SubmitForm, matcher: (id: string) => boolean) {
  const question = form.questions.find(
    (item) => matcher(item.id) && (item.options?.length ?? 0) > 0,
  )
  return question?.options ?? []
}

export function WelcomeStep({ form }: WelcomeStepProps) {
  const { event } = form
  const dates = formatEventDates(event.startsAt, event.endsAt, event.timezone)
  const tracks =
    form.questions.find(
      (question) => question.isTrackQuestion && (question.options?.length ?? 0) > 0,
    )?.options ?? optionsFor(form, (id) => id === "track")
  const formats = optionsFor(form, (id) => id === "format")

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {form.pageHeading?.trim() || "Welcome!"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {form.externalTitle} · {event.name}
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {dates ? (
          <div className="flex items-center gap-2">
            <RiCalendarLine size={16} aria-hidden className="text-primary" />
            <dt className="sr-only">Event dates</dt>
            <dd>{dates}</dd>
          </div>
        ) : null}
        {event.venue ? (
          <div className="flex items-center gap-2">
            <RiMapPin2Line size={16} aria-hidden className="text-primary" />
            <dt className="sr-only">Venue</dt>
            <dd>{event.venue}</dd>
          </div>
        ) : null}
      </dl>

      {form.closeAt || form.limitPerUser ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center text-sm">
          {form.closeAt ? (
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-foreground">
              <RiTimeLine
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground"
              />
              Submissions will be accepted until{" "}
              <strong className="font-semibold">
                {formatDeadline(form.closeAt, event.timezone)}
              </strong>
              .
            </p>
          ) : null}
          {form.limitPerUser ? (
            <p className="mt-1 text-muted-foreground">
              Submission limit: {form.limitPerUser} submission
              {form.limitPerUser === 1 ? "" : "s"} per person.
            </p>
          ) : null}
          {form.allowDrafts ? (
            <p className="mt-1 text-muted-foreground">
              You can save a draft at any point and finish it later.
            </p>
          ) : null}
        </div>
      ) : null}

      <RichText content={form.welcomeMessage} />

      {tracks.length > 0 || formats.length > 0 ? (
        <div className="space-y-4 rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-center gap-2">
            <RiUserStarLine size={16} aria-hidden className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              What we&rsquo;re looking for
            </h2>
          </div>
          {tracks.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Tracks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tracks.map((track) => (
                  <Badge key={track} variant="secondary" className="font-normal">
                    {track}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {formats.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Session formats
              </p>
              <div className="flex flex-wrap gap-1.5">
                {formats.map((format) => (
                  <Badge key={format} variant="secondary" className="font-normal">
                    {format}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        It takes about three minutes. You&rsquo;ll enter your email next — no
        password needed — and after submitting you&rsquo;ll get a speaker portal
        where you can track the status of your proposal.
      </p>
    </div>
  )
}

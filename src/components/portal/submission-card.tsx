import {
  RiCalendarEventLine,
  RiLockLine,
  RiMapPin2Line,
  RiUser3Line,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/shared/status-pill"
import type { PortalSubmission } from "./portal-context"
import { formatDateTime } from "./portal-utils"

/** Small colored dot + name for the submission's track. */
export function TrackDot({
  name,
  color,
  className,
}: {
  name: string
  color?: string | null
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--color-muted-foreground)" }}
      />
      {name}
    </span>
  )
}

export interface SubmissionCardProps {
  submission: PortalSubmission
  /** "SESS-4" — the code Sessionboard shows next to every title. */
  code: string
  /** Right-hand action (a link on Home, a details button on Submissions). */
  action?: React.ReactNode
  /** Show the abstract excerpt and scheduling line. */
  detailed?: boolean
  className?: string
}

/**
 * One submission, as the speaker sees it (docs/ux/03 image17): code + title,
 * the format/track beneath, and the exact same status wording the organizer
 * sees — never a friendlier paraphrase.
 */
export function SubmissionCard({
  submission,
  code,
  action,
  detailed = false,
  className,
}: SubmissionCardProps) {
  const participants = submission.participants
  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{code}</p>
          <h3 className="font-heading mt-0.5 text-sm font-semibold text-foreground">
            {submission.title}
          </h3>
        </div>
        <StatusPill status={submission.status} size="sm" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {submission.format ? <span>{submission.format}</span> : null}
        {submission.track ? (
          <TrackDot
            name={submission.track.name}
            color={submission.track.color}
          />
        ) : null}
        {participants.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <RiUser3Line size={13} aria-hidden />
            {participants.length === 1
              ? participants[0].name
              : `${participants.length} participants`}
          </span>
        ) : null}
      </div>

      {detailed && submission.description ? (
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {submission.description}
        </p>
      ) : null}

      {detailed && submission.scheduled ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <RiCalendarEventLine size={14} aria-hidden />
            {formatDateTime(submission.scheduled.startsAt)}
          </span>
          <span className="text-muted-foreground">
            {submission.scheduled.durationMinutes} min
          </span>
          {submission.scheduled.room ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <RiMapPin2Line size={14} aria-hidden />
              {submission.scheduled.room}
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Editing closed for a reason the status pill doesn't already tell them
          (a passed CFP deadline, or an event that takes changes by email). Said
          here, on the list, so opening the drawer is never a surprise. */}
      {detailed &&
      submission.editLock &&
      submission.editLock.code !== "declined" &&
      submission.editLock.code !== "withdrawn" ? (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <RiLockLine size={13} aria-hidden />
          {submission.editLock.title}
        </p>
      ) : null}

      {action ? <div className="mt-3">{action}</div> : null}
    </article>
  )
}

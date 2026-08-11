import {
  RiMailSendLine,
  RiPresentationLine,
  RiStarLine,
  RiTimeLine,
} from "@remixicon/react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusPill, statusLabel } from "@/components/shared/status-pill"
import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  MoreLink,
  Note,
  Panel,
  Row,
  Rows,
  StatRow,
  Tile,
  TrackTag,
  asArray,
  formatWhen,
  initials,
  isRecord,
  num,
  speakerName,
  str,
  strList,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { AppLinkTarget } from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * Submissions, decisions and manually-added programme items.
 *
 * The list view is capped at eight rows on purpose: a chat panel is not a
 * data grid, and the honest move when there are forty matches is to show the
 * shape of the answer and hand the organizer a link that lands on the SAME
 * filter they just asked about — which is why the "view all" target is built
 * from the tool's own input rather than a bare /app/submissions.
 */

const MAX_ROWS = 8

/** The tool's filter arguments, re-encoded as the Submissions screen's URL. */
function submissionsTarget(base: string, input: unknown): AppLinkTarget {
  const args = isRecord(input) ? input : {}
  return {
    to: base,
    search: {
      status: str(args.status) ?? undefined,
      q: str(args.search) ?? undefined,
      track: str(args.track) ?? undefined,
    },
  }
}

function submissionTarget(
  base: string,
  submissionId: string | null,
): AppLinkTarget {
  return {
    to: base,
    search: submissionId ? { id: submissionId } : undefined,
  }
}

function Speakers({ value }: { value: unknown }) {
  const names = Array.isArray(value)
    ? value.map(speakerName).filter(Boolean)
    : []
  if (names.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar className="size-5 shrink-0">
        <AvatarFallback className="text-[9px]">
          {initials(names[0])}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">
        {names[0]}
        {names.length > 1 ? ` +${names.length - 1}` : ""}
      </span>
    </span>
  )
}

// ——— list_submissions ————————————————————————————————————————————————————

export function SubmissionsListView({ input, output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const rows = asArray(output.submissions) ?? []
  const total = num(output.total) ?? rows.length
  const args = isRecord(input) ? input : {}
  const filterLabel = [
    str(args.status) ? statusLabel(str(args.status)!) : null,
    str(args.track),
    str(args.search) ? `“${str(args.search)}”` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  if (rows.length === 0) {
    return (
      <EmptyRow>
        No submissions match{filterLabel ? ` ${filterLabel}` : " that"}.{" "}
        <GoLink {...submissionsTarget(submissionsLink, input)}>
          Open Submissions
        </GoLink>
      </EmptyRow>
    )
  }

  const shown = rows.slice(0, MAX_ROWS)

  return (
    <Panel
      title={filterLabel ? `Submissions · ${filterLabel}` : "Submissions"}
      meta={
        shown.length < total ? `${shown.length} of ${total}` : `${total} total`
      }
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 px-3 text-[11px] tracking-wide uppercase">
                Title
              </TableHead>
              <TableHead className="h-8 px-3 text-[11px] tracking-wide uppercase">
                Speakers
              </TableHead>
              <TableHead className="h-8 px-3 text-right text-[11px] tracking-wide uppercase">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row, index) => {
              const track = str(row.track)
              const scheduled = isRecord(row.scheduled) ? row.scheduled : null
              return (
                <TableRow key={str(row.submissionId) ?? index}>
                  <TableCell className="max-w-[18rem] px-3 py-2 align-top">
                    <div className="truncate font-medium text-foreground">
                      {str(row.title) ?? "Untitled"}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {track ? <TrackTag track={track} /> : null}
                      {scheduled ? (
                        <span className="inline-flex items-center gap-1">
                          <RiTimeLine size={12} aria-hidden />
                          {formatWhen(scheduled.startsAt) ?? "scheduled"}
                          {str(scheduled.room)
                            ? ` · ${str(scheduled.room)}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[10rem] px-3 py-2 align-top text-xs text-foreground">
                    <Speakers value={row.speakers} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right align-top whitespace-nowrap">
                    <StatusPill status={str(row.status) ?? "draft"} size="sm" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <MoreLink target={submissionsTarget(submissionsLink, input)}>
        {shown.length < total
          ? `View all ${total} in Submissions`
          : "Open in Submissions"}
      </MoreLink>
    </Panel>
  )
}

// ——— get_submission ——————————————————————————————————————————————————————

export function SubmissionDetailView({ output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const submissionId = str(output.submissionId)
  const track = str(output.track)
  const scheduled = isRecord(output.scheduled) ? output.scheduled : null
  const participants = asArray(output.participants) ?? []
  const uploads = asArray(output.uploads) ?? []
  const evaluation = isRecord(output.evaluation) ? output.evaluation : null
  const comments = strList(evaluation?.comments)
  const tags = strList(output.tags)
  const description = str(output.description)

  return (
    <Panel>
      <Tile className="space-y-3">
        <div className="flex min-w-0 items-start gap-2">
          <RiPresentationLine
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 text-sm font-medium text-foreground">
                {str(output.title) ?? "Untitled"}
              </span>
              <StatusPill status={str(output.status) ?? "draft"} size="sm" />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {track ? <TrackTag track={track} /> : null}
              {str(output.format) ? <span>{str(output.format)}</span> : null}
              {str(output.level) ? <span>{str(output.level)}</span> : null}
              {str(output.formName) ? (
                <span>via {str(output.formName)}</span>
              ) : null}
            </div>
          </div>
        </div>

        {description ? (
          <p className="line-clamp-4 text-sm text-muted-foreground">
            {description.replace(/<[^>]*>/g, " ").trim()}
          </p>
        ) : null}

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Chip key={tag} tone="muted">
                {tag}
              </Chip>
            ))}
          </div>
        ) : null}

        {participants.length > 0 ? (
          <Rows>
            {participants.map((person, index) => (
              <Row
                key={str(person.email) ?? index}
                className="items-center py-2"
              >
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {initials(str(person.name) ?? str(person.email) ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {str(person.name) ?? str(person.email)}
                </span>
                <Chip tone="muted">{str(person.role) ?? "speaker"}</Chip>
                <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:inline">
                  {str(person.email)}
                </span>
              </Row>
            ))}
          </Rows>
        ) : null}

        {scheduled ? (
          <FieldGrid
            entries={[
              {
                label: "Scheduled",
                value: `${formatWhen(scheduled.startsAt) ?? "—"}${
                  str(scheduled.room) ? ` · ${str(scheduled.room)}` : ""
                } · ${num(scheduled.durationMinutes) ?? 45} min`,
              },
            ]}
          />
        ) : null}

        {evaluation && (num(evaluation.completedReviews) ?? 0) > 0 ? (
          <div className="space-y-1.5">
            <StatRow
              stats={[
                {
                  label: "Reviews",
                  value: num(evaluation.completedReviews) ?? 0,
                },
                {
                  label: "Avg score",
                  value: (
                    <span className="inline-flex items-center gap-1">
                      <RiStarLine size={14} aria-hidden />
                      {num(evaluation.averageScore) ?? "—"}
                    </span>
                  ),
                },
              ]}
            />
            {comments.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-foreground">
                {comments.slice(0, 3).map((comment, index) => (
                  <li key={index}>“{comment}”</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {uploads.length > 0 ? (
          <Rows>
            {uploads.map((upload, index) => (
              <Row
                key={str(upload.filename) ?? index}
                className="items-center py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {str(upload.filename) ?? "file"}
                </span>
                <Chip tone="muted">v{num(upload.version) ?? 1}</Chip>
                <StatusPill
                  status={str(upload.approvalStatus) ?? "pending"}
                  size="sm"
                />
              </Row>
            ))}
          </Rows>
        ) : null}

        <GoLink {...submissionTarget(submissionsLink, submissionId)}>
          Open in Submissions
        </GoLink>
      </Tile>
    </Panel>
  )
}

// ——— set_submission_status ———————————————————————————————————————————————

export function StatusChangedView({ output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const previous = str(output.previousStatus)
  const next = str(output.status) ?? "pending"
  const staged = next === "accept_queue" || next === "decline_queue"

  return (
    <Panel>
      <Tile tone={staged ? "warn" : "default"} className="space-y-2">
        <p className="truncate text-sm font-medium text-foreground">
          {str(output.title) ?? "Submission"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {previous ? (
            <>
              <StatusPill status={previous} size="sm" />
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </>
          ) : null}
          <StatusPill status={next} size="sm" />
        </div>
        {str(output.note) ? <Note>{str(output.note)}</Note> : null}
        <GoLink {...submissionTarget(submissionsLink, str(output.submissionId))}>
          Open in Submissions
        </GoLink>
      </Tile>
    </Panel>
  )
}

// ——— commit_decision_queue ———————————————————————————————————————————————

export function DecisionQueueCommittedView({ output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const communicationsLink = useSectionLink("communications")
  const committed = num(output.committed) ?? 0
  const emails = num(output.emailsQueued) ?? 0
  const titles = strList(output.titles)
  const accepting = str(output.queue) === "accept_queue"

  if (committed === 0) {
    return (
      <Banner
        tone="neutral"
        icon={<RiMailSendLine size={16} />}
        title="Nothing was staged in that queue"
      >
        <Note>
          Stage decisions first — ask me to move submissions into the accept or
          decline queue.
        </Note>
        <GoLink
          to={submissionsLink}
          search={{ status: accepting ? "accept_queue" : "decline_queue" }}
        >
          Open the queue
        </GoLink>
      </Banner>
    )
  }

  return (
    <Banner
      icon={<RiMailSendLine size={16} />}
      title={`${committed} ${accepting ? "acceptance" : "decline"}${
        committed === 1 ? "" : "s"
      } committed · ${emails} email${emails === 1 ? "" : "s"} queued`}
    >
      {titles.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-foreground">
          {titles.slice(0, 5).map((title) => (
            <li key={title} className="truncate">
              {title}
            </li>
          ))}
          {titles.length > 5 ? (
            <li className="text-muted-foreground">+{titles.length - 5} more</li>
          ) : null}
        </ul>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <GoLink to={communicationsLink} search={{ tab: "outbox" }}>
          Check the outbox
        </GoLink>
        <GoLink
          to={submissionsLink}
          search={{ status: accepting ? "accepted" : "declined" }}
        >
          {accepting ? "Accepted" : "Declined"} submissions
        </GoLink>
      </div>
    </Banner>
  )
}

// ——— add_manual_session ——————————————————————————————————————————————————

export function ManualSessionView({ input, output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const agendaLink = useSectionLink("agenda")
  const args = isRecord(input) ? input : {}
  const speakers = strList(output.speakers)
  const track = str(args.track)

  return (
    <Banner
      icon={<RiPresentationLine size={16} />}
      title={str(output.title) ?? "Session added"}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={str(output.status) ?? "accepted"} size="sm" />
        <Chip tone="muted">{str(output.kind) ?? "session"}</Chip>
        {track ? (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            <TrackTag track={track} />
          </span>
        ) : null}
        {str(args.format) ? <Chip tone="muted">{str(args.format)}</Chip> : null}
      </div>
      {speakers.length > 0 ? (
        <Note>Speakers: {speakers.join(", ")}</Note>
      ) : (
        <Note>No speakers attached yet.</Note>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <GoLink {...submissionTarget(submissionsLink, str(output.submissionId))}>
          Open in Submissions
        </GoLink>
        <GoLink to={agendaLink} search={{ view: "day" }}>
          Place it on the agenda
        </GoLink>
      </div>
    </Banner>
  )
}

// ——— update_submission ———————————————————————————————————————————————————

/** The `{data: …}` REST envelope these apiV1-backed tools answer with. */
function apiRecord(output: Record<string, unknown>): Record<string, unknown> {
  return isRecord(output.data) ? output.data : output
}

/**
 * `update_submission` proxies the REST session resource, so the reply is the
 * WHOLE session — dozens of fields, most of them untouched. Echoing all of it
 * would bury the one thing the organizer wants confirmed: that the fields they
 * just asked to change actually changed. So the card is driven by the tool's
 * INPUT (what was asked for) and reads the new values out of the output.
 */
const SUBMISSION_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Abstract",
  track: "Track",
  format: "Format",
  level: "Level",
  language: "Language",
  tags: "Tags",
  durationMinutes: "Duration",
  notes: "Internal notes",
}

export function SubmissionUpdatedView({ input, output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const session = apiRecord(output)
  const args = isRecord(input) ? input : {}
  const changed = Object.keys(args).filter(
    (key) => key in SUBMISSION_FIELD_LABELS && args[key] !== undefined,
  )
  const title = str(session.title) ?? str(args.title) ?? "Submission"
  const track = isRecord(session.track)
    ? str(session.track.name)
    : str(session.track)

  return (
    <Banner icon={<RiPresentationLine size={16} />} title={`${title} updated`}>
      <FieldGrid
        entries={
          changed.length > 0
            ? changed.map((key) => ({
                label: SUBMISSION_FIELD_LABELS[key],
                value:
                  key === "track"
                    ? (track ?? String(args[key]))
                    : key === "tags"
                      ? strList(session.tags ?? args.tags).join(", ") || "—"
                      : key === "durationMinutes"
                        ? `${num(session.duration_minutes) ?? num(args.durationMinutes) ?? 0} min`
                        : (str(session[key]) ?? String(args[key] ?? "—")),
              }))
            : [
                {
                  label: "Status",
                  value: (
                    <StatusPill
                      status={str(session.status) ?? "pending"}
                      size="sm"
                    />
                  ),
                },
              ]
        }
      />
      <GoLink {...submissionTarget(submissionsLink, str(session.id))}>
        Open in Submissions
      </GoLink>
    </Banner>
  )
}

// ——— add_participant / remove_participant ————————————————————————————————

const ROLE_LABELS: Record<string, string> = {
  speaker: "Speaker",
  chairperson: "Chairperson",
  moderator: "Moderator",
}

export function ParticipantChangedView({
  input,
  output,
  toolName,
}: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const removing = toolName === "remove_participant"
  const person = apiRecord(output)
  const args = isRecord(input) ? input : {}
  const who =
    str(person.full_name) ??
    str(person.name) ??
    str(person.email) ??
    str(args.speaker) ??
    "That person"
  const role = str(person.role) ?? str(args.role) ?? "speaker"
  const submissionId = str(person.session_id) ?? str(args.submissionId)

  if (removing) {
    return (
      <Banner
        tone="neutral"
        icon={<RiPresentationLine size={16} />}
        title={`${who} removed from the line-up`}
      >
        <Note>
          They are still in the event — profile, tasks and files untouched.
          Only their place on this session went.
        </Note>
        <GoLink {...submissionTarget(submissionsLink, submissionId)}>
          Open in Submissions
        </GoLink>
      </Banner>
    )
  }

  return (
    <Banner
      icon={<RiPresentationLine size={16} />}
      title={`${who} added as ${(ROLE_LABELS[role] ?? role).toLowerCase()}`}
    >
      <FieldGrid
        entries={[
          ...(str(person.email)
            ? [{ label: "Email", value: str(person.email)! }]
            : []),
          { label: "Role", value: ROLE_LABELS[role] ?? role },
        ]}
      />
      {output.created === false ? (
        <Note>
          They were already on this session, so this moved them to the new role
          rather than adding them twice.
        </Note>
      ) : null}
      <GoLink {...submissionTarget(submissionsLink, submissionId)}>
        Open in Submissions
      </GoLink>
    </Banner>
  )
}

// ——— delete_submission / restore_submission ——————————————————————————————

export function SubmissionTrashedView({ output, toolName }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const restoring = toolName === "restore_submission"
  const session = apiRecord(output)
  const title = str(session.title) ?? "Submission"
  return (
    <Banner
      tone={restoring ? "good" : "warn"}
      icon={<RiPresentationLine size={16} />}
      title={restoring ? `${title} restored` : `${title} moved to the trash`}
    >
      {restoring ? (
        <Note>
          It is back in every list, on the agenda and on public pages, with its
          status, participants and files intact.
        </Note>
      ) : (
        <Note>
          It has left every list, the agenda and all public pages — but nothing
          is destroyed. Find it with list_trash and bring it back with
          restore_submission.
        </Note>
      )}
      <GoLink {...submissionTarget(submissionsLink, str(session.id))}>
        Open in Submissions
      </GoLink>
    </Banner>
  )
}

// ——— list_trash ——————————————————————————————————————————————————————————

export function TrashView({ output }: ToolOutputProps) {
  const submissionsLink = useSectionLink("submissions")
  const rows = asArray(output.trashed) ?? []
  if (rows.length === 0) {
    return (
      <EmptyRow>
        The trash is empty — nothing has been deleted on this event.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Trash" meta={`${num(output.total) ?? rows.length}`}>
      <Rows>
        {rows.slice(0, MAX_ROWS).map((row, index) => (
          <Row key={str(row.submissionId) ?? index} className="items-start">
            <RiTimeLine
              size={15}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {str(row.title) ?? "Untitled"}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <Speakers value={row.speakers} />
                {formatWhen(row.deletedAt) ? (
                  <span>deleted {formatWhen(row.deletedAt)}</span>
                ) : null}
              </div>
            </div>
            <StatusPill status={str(row.status) ?? "pending"} size="sm" />
          </Row>
        ))}
      </Rows>
      {rows.length > MAX_ROWS ? (
        <Note>+{rows.length - MAX_ROWS} more in the trash.</Note>
      ) : null}
      <Note>
        Ask me to restore any of these — nothing here shows on a public page or
        counts towards a total.
      </Note>
      <GoLink to={submissionsLink}>Open Submissions</GoLink>
    </Panel>
  )
}

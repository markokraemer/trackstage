import {
  RiCheckboxCircleLine,
  RiCheckLine,
  RiDeleteBin6Line,
  RiFile3Line,
  RiTaskLine,
  RiTimeLine,
} from "@remixicon/react"

import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  MiniProgress,
  Note,
  Panel,
  Row,
  Rows,
  StatRow,
  asArray,
  formatDate,
  formatWhen,
  isRecord,
  num,
  str,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * Speaker tasks and the file-review gate.
 *
 * Both surfaces answer the same organizer question — "what is still owed, and
 * by whom?" — so both lead with the count that matters (overdue tasks, files
 * awaiting review) and only then list rows. An OVERDUE task is the single most
 * actionable thing on either screen, so it is never just another row: it gets
 * the amber treatment and sorts to the top of the reader's eye via its own
 * count in the stat row.
 */

function record(output: Record<string, unknown>): Record<string, unknown> {
  return isRecord(output.data) ? output.data : output
}

function rowsOf(
  output: Record<string, unknown>,
  key: string
): Array<Record<string, unknown>> {
  return asArray(output.data) ?? asArray(output[key]) ?? []
}

/** The person a task or file belongs to, however the payload spells them. */
function personLabel(value: unknown): string | null {
  if (typeof value === "string") return value
  if (!isRecord(value)) return null
  return str(value.full_name) ?? str(value.name) ?? str(value.email)
}

const TASK_KIND_LABEL: Record<string, string> = {
  profile: "Profile",
  headshot: "Headshot",
  upload: "Upload",
  answer: "Question",
  confirm: "Confirm",
}

// ——— list_tasks ——————————————————————————————————————————————————————————

export function TasksView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const rows = rowsOf(output, "tasks")
  if (rows.length === 0) {
    return (
      <EmptyRow>
        No tasks match that filter — nothing outstanding, or nothing assigned
        yet.
      </EmptyRow>
    )
  }
  const done = rows.filter((row) => row.is_complete === true).length
  const overdue = rows.filter(
    (row) => row.is_overdue === true && row.is_complete !== true
  ).length
  const shown = rows.slice(0, 8)

  return (
    <Panel title="Speaker tasks" meta={`${rows.length}`}>
      <StatRow
        stats={[
          { label: "Total", value: rows.length },
          {
            label: "Done",
            value: done,
            tone: done === rows.length ? "good" : "default",
          },
          {
            label: "Overdue",
            value: overdue,
            tone: overdue > 0 ? "bad" : "good",
          },
        ]}
      />
      <MiniProgress
        value={rows.length > 0 ? (done / rows.length) * 100 : 0}
        tone={done === rows.length ? "good" : "default"}
      />
      <Rows>
        {shown.map((row, index) => {
          const complete = row.is_complete === true
          const overdueRow = row.is_overdue === true && !complete
          const who = personLabel(row.speaker)
          const due = formatDate(row.due_at)
          return (
            <Row key={str(row.id) ?? index} className="items-start">
              {complete ? (
                <RiCheckboxCircleLine
                  size={15}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-status-green-fg"
                />
              ) : (
                <RiTaskLine
                  size={15}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={
                    complete
                      ? "truncate text-sm text-muted-foreground line-through"
                      : "truncate text-sm text-foreground"
                  }
                >
                  {str(row.title) ?? "Task"}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {who ? <span className="truncate">{who}</span> : null}
                  {str(row.session_title) ? (
                    <span className="truncate">{str(row.session_title)}</span>
                  ) : null}
                </div>
              </div>
              {str(row.kind) ? (
                <Chip tone="muted">
                  {TASK_KIND_LABEL[str(row.kind)!] ?? str(row.kind)}
                </Chip>
              ) : null}
              {due ? (
                <span
                  className={
                    overdueRow
                      ? "shrink-0 text-xs font-medium text-status-red-fg"
                      : "shrink-0 text-xs text-muted-foreground"
                  }
                >
                  {overdueRow ? "overdue " : "due "}
                  {due}
                </span>
              ) : null}
            </Row>
          )
        })}
      </Rows>
      {rows.length > shown.length ? (
        <Note>+{rows.length - shown.length} more.</Note>
      ) : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Panel>
  )
}

// ——— update_task —————————————————————————————————————————————————————————

export function TaskUpdatedView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const task = record(output)
  const complete = task.is_complete === true
  const who = personLabel(task.speaker)
  return (
    <Banner
      tone={complete ? "good" : "neutral"}
      icon={complete ? <RiCheckLine size={16} /> : <RiTaskLine size={16} />}
      title={
        complete
          ? `“${str(task.title) ?? "Task"}” marked done`
          : `“${str(task.title) ?? "Task"}” updated`
      }
    >
      <FieldGrid
        entries={[
          ...(who ? [{ label: "Speaker", value: who }] : []),
          ...(str(task.kind)
            ? [
                {
                  label: "Kind",
                  value: TASK_KIND_LABEL[str(task.kind)!] ?? str(task.kind)!,
                },
              ]
            : []),
          ...(formatDate(task.due_at)
            ? [{ label: "Due", value: formatDate(task.due_at)! }]
            : []),
          {
            label: "State",
            value: complete ? "Complete" : "Still open",
          },
        ]}
      />
      {str(task.instructions) ? (
        <Note>{str(task.instructions)}</Note>
      ) : null}
      {complete ? (
        <Note>
          Marking it done here is on the organizer&apos;s word — the speaker
          normally ticks it themselves in the portal.
        </Note>
      ) : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Banner>
  )
}

// ——— delete_task_template ————————————————————————————————————————————————

export function TaskTemplateDeletedView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`“${str(output.title) ?? "Template"}” removed from the library`}
    >
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Banner>
  )
}

// ——— list_files ——————————————————————————————————————————————————————————

const APPROVAL_LABEL: Record<string, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  changes_requested: "Changes requested",
}

function approvalTone(status: string | null): "muted" | "warn" {
  return status === "changes_requested" || status === "pending" ? "warn" : "muted"
}

export function FilesView({ output }: ToolOutputProps) {
  const filesLink = useSectionLink("files")
  const rows = asArray(output.files) ?? []
  const counts = isRecord(output.countsByApprovalStatus)
    ? output.countsByApprovalStatus
    : {}
  if (rows.length === 0) {
    return (
      <EmptyRow>
        No files match that filter —{" "}
        <GoLink to={filesLink}>open the Files library</GoLink>.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Files" meta={`${num(output.total) ?? rows.length}`}>
      <StatRow
        stats={[
          {
            label: "Awaiting review",
            value: num(counts.pending) ?? 0,
            tone: (num(counts.pending) ?? 0) > 0 ? "warn" : "good",
          },
          { label: "Approved", value: num(counts.approved) ?? 0, tone: "good" },
          {
            label: "Changes asked",
            value: num(counts.changes_requested) ?? 0,
            tone:
              (num(counts.changes_requested) ?? 0) > 0 ? "bad" : "default",
          },
        ]}
      />
      <Rows>
        {rows.slice(0, 8).map((row, index) => {
          const status = str(row.approvalStatus)
          const version = num(row.version)
          return (
            <Row key={str(row.fileId) ?? index} className="items-start">
              <RiFile3Line
                size={15}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {str(row.filename) ?? "File"}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {str(row.speaker) ? (
                    <span className="truncate">{str(row.speaker)}</span>
                  ) : null}
                  {/* The Session column is "—" for profile uploads by design;
                      the task title is what actually identifies those. */}
                  {str(row.task) ? (
                    <span className="truncate">{str(row.task)}</span>
                  ) : null}
                  {formatWhen(row.uploadedAt) ? (
                    <span>{formatWhen(row.uploadedAt)}</span>
                  ) : null}
                </div>
                {str(row.reviewNote) ? (
                  <p className="mt-0.5 truncate text-xs text-foreground italic">
                    “{str(row.reviewNote)}”
                  </p>
                ) : null}
              </div>
              {version !== null && version > 1 ? (
                <Chip tone="muted">v{version}</Chip>
              ) : null}
              {status ? (
                <Chip tone={approvalTone(status)}>
                  {APPROVAL_LABEL[status] ?? status}
                </Chip>
              ) : null}
            </Row>
          )
        })}
      </Rows>
      {rows.length > 8 ? <Note>+{rows.length - 8} more.</Note> : null}
      <GoLink to={filesLink}>Open Files</GoLink>
    </Panel>
  )
}

// ——— review_file —————————————————————————————————————————————————————————

export function FileReviewedView({ output }: ToolOutputProps) {
  const filesLink = useSectionLink("files")
  const status = str(output.approvalStatus) ?? "pending"
  const approved = status === "approved"
  const reopened = output.taskReopened === true
  return (
    <Banner
      tone={approved ? "good" : "warn"}
      icon={
        approved ? <RiCheckLine size={16} /> : <RiTimeLine size={16} />
      }
      title={`${str(output.filename) ?? "File"} — ${APPROVAL_LABEL[status] ?? status}`}
    >
      <FieldGrid
        entries={[
          ...(str(output.speaker)
            ? [{ label: "Speaker", value: str(output.speaker)! }]
            : []),
          ...(str(output.reviewNote)
            ? [{ label: "Your note", value: str(output.reviewNote)! }]
            : []),
        ]}
      />
      {reopened ? (
        <Note>
          Their task reopened, so it is back on the speaker&apos;s portal
          to-do list with your note attached.
        </Note>
      ) : null}
      <GoLink to={filesLink}>Open Files</GoLink>
    </Banner>
  )
}

// ——— delete_file —————————————————————————————————————————————————————————

export function FileDeletedView({ output }: ToolOutputProps) {
  const filesLink = useSectionLink("files")
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(output.filename) ?? "File"} deleted`}
    >
      {str(output.note) ? (
        <Note>{str(output.note)}</Note>
      ) : (
        <Note>The file row and its stored bytes are gone. No undo.</Note>
      )}
      <GoLink to={filesLink}>Open Files</GoLink>
    </Banner>
  )
}

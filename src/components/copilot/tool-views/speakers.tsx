import {
  RiCheckboxCircleLine,
  RiDeleteBin6Line,
  RiKey2Line,
  RiMailSendLine,
  RiTaskLine,
  RiUserAddLine,
} from "@remixicon/react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  LinkRow,
  MiniProgress,
  MoreLink,
  Note,
  Panel,
  Row,
  Rows,
  StatRow,
  Tile,
  asArray,
  formatDate,
  initials,
  isRecord,
  num,
  str,
  strList,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * The speaker roster and the two things organizers actually do with it:
 * chase people, and get them into their portal.
 *
 * Every row answers "how far along is this person?" before it answers "who is
 * this person?" — the roster exists to find the stragglers, so readiness is
 * the primary column and the name is the label on it.
 */

/** Bio + headshot + slides, plus whatever tasks are still open. */
const PROFILE_ITEMS = 3

function readiness(missing: number, openTasks: number) {
  const total = PROFILE_ITEMS + openTasks
  const done = Math.max(0, PROFILE_ITEMS - missing)
  return {
    done,
    total,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
  }
}

// ——— list_speakers ———————————————————————————————————————————————————————

export function SpeakersView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const rows = asArray(output.speakers) ?? []

  if (rows.length === 0) {
    return (
      <EmptyRow>
        Nobody matches — every confirmed speaker is done.{" "}
        <GoLink to={speakersLink}>Open Speakers</GoLink>
      </EmptyRow>
    )
  }

  const behind = rows.filter(
    (row) =>
      (asArray(row.outstandingTasks) ?? []).length > 0 ||
      strList(row.missingProfileItems).length > 0
  ).length

  return (
    <Panel
      title="Speakers"
      meta={`${num(output.speakerCount) ?? rows.length} people`}
    >
      <StatRow
        stats={[
          { label: "Speakers", value: rows.length },
          {
            label: "Behind",
            value: behind,
            tone: behind > 0 ? "warn" : "good",
          },
        ]}
      />
      <Rows>
        {rows.map((row, index) => {
          const name = str(row.name) ?? "Unknown"
          const tasks = asArray(row.outstandingTasks) ?? []
          const missing = strList(row.missingProfileItems)
          const sessions = strList(row.sessions)
          const progress = readiness(missing.length, tasks.length)
          return (
            <Row key={str(row.personId) ?? index}>
              <Avatar className="mt-0.5 size-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {name}
                  </span>
                  {str(row.company) ? (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {str(row.company)}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <MiniProgress
                  value={progress.percent}
                  tone={progress.percent === 100 ? "good" : "warn"}
                />
                {sessions.length > 0 ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {sessions.join(" · ")}
                  </div>
                ) : null}
                {tasks.length > 0 || missing.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tasks.map((task, taskIndex) => (
                      <Chip key={str(task.taskId) ?? taskIndex} tone="warn">
                        {str(task.title) ?? "Task"}
                        {str(task.dueAt) ? ` · ${formatDate(task.dueAt)}` : ""}
                      </Chip>
                    ))}
                    {missing.map((item) => (
                      <Chip key={item} tone="muted">
                        no {item}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-status-green-fg">
                    <RiCheckboxCircleLine size={13} aria-hidden />
                    All done
                  </div>
                )}
              </div>
            </Row>
          )
        })}
      </Rows>
      <MoreLink target={{ to: speakersLink }}>Open Speakers</MoreLink>
    </Panel>
  )
}

// ——— get_speaker_portal_link —————————————————————————————————————————————

export function SpeakerPortalLinkView({ output }: ToolOutputProps) {
  const url = str(output.portalUrl)
  const name = str(output.name) ?? "Speaker"

  return (
    <Panel>
      <Tile className="space-y-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[10px]">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {str(output.email)}
            </p>
          </div>
          <Chip tone="warn" className="gap-1">
            <RiKey2Line size={11} aria-hidden />
            private
          </Chip>
        </div>
        {url ? <LinkRow url={url} label="Magic link" /> : null}
        <Note>
          {str(output.note) ??
            "This link signs them straight in — send it only to them."}
        </Note>
      </Tile>
    </Panel>
  )
}

// ——— assign_task —————————————————————————————————————————————————————————

export function TaskAssignedView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const assigned = strList(output.assignedTo)
  const created = num(output.created) ?? assigned.length

  return (
    <Banner
      icon={<RiTaskLine size={16} />}
      title={`${str(output.title) ?? "Task"} assigned to ${created} speaker${
        created === 1 ? "" : "s"
      }`}
    >
      <FieldGrid
        entries={[
          { label: "Kind", value: str(output.kind) ?? "confirm" },
          ...(str(output.dueAt)
            ? [{ label: "Due", value: formatDate(output.dueAt) ?? "—" }]
            : []),
        ]}
      />
      {assigned.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {assigned.slice(0, 8).map((email) => (
            <Chip key={email} tone="muted">
              {email}
            </Chip>
          ))}
          {assigned.length > 8 ? (
            <Chip tone="muted">+{assigned.length - 8} more</Chip>
          ) : null}
        </div>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Banner>
  )
}

// ——— list_task_library / save_task_template ——————————————————————————————

/**
 * The reusable task library: wording an organizer saved once and assigns all
 * season. Each row leads with the words the speaker will read, because that —
 * not the id — is how an organizer recognises the task they mean.
 */
export function TaskLibraryView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const rows = asArray(output.templates) ?? []
  if (rows.length === 0) {
    return (
      <EmptyRow>
        Nothing saved yet — ticking &ldquo;Save this task to your library&rdquo;
        when you assign a task puts it here.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Task library" meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => (
          <Row key={str(row.templateId) ?? index}>
            <RiTaskLine
              size={15}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {str(row.alias) ?? str(row.title) ?? "Task"}
              </span>
              {str(row.instructions) ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {str(row.instructions)}
                </span>
              ) : null}
            </div>
            <Chip tone="muted">{str(row.kind) ?? "confirm"}</Chip>
          </Row>
        ))}
      </Rows>
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <MoreLink target={{ to: speakersLink }}>Open Speakers</MoreLink>
    </Panel>
  )
}

/** One saved (or re-saved) library entry — a receipt, not a celebration. */
export function TaskTemplateSavedView({ output }: ToolOutputProps) {
  const updated = output.updated === true
  return (
    <Banner
      icon={<RiCheckboxCircleLine size={16} />}
      tone="good"
      title={`${str(output.title) ?? "Task"} ${updated ? "updated in" : "saved to"} your library`}
    >
      <FieldGrid
        entries={[{ label: "Kind", value: str(output.kind) ?? "confirm" }]}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
    </Banner>
  )
}

// ——— send_reminders ——————————————————————————————————————————————————————

export function RemindersSentView({ output }: ToolOutputProps) {
  const communicationsLink = useSectionLink("communications")
  const queued = num(output.queued) ?? 0
  const skipped = num(output.skipped) ?? 0

  return (
    <Banner
      icon={<RiMailSendLine size={16} />}
      tone={queued === 0 ? "neutral" : "good"}
      title={
        queued === 0
          ? "No reminders needed to go out"
          : `${queued} reminder${queued === 1 ? "" : "s"} queued`
      }
    >
      <StatRow
        stats={[
          {
            label: "Queued",
            value: queued,
            tone: queued > 0 ? "good" : "default",
          },
          { label: "Skipped", value: skipped },
        ]}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={communicationsLink} search={{ tab: "outbox" }}>
        Check the outbox
      </GoLink>
    </Banner>
  )
}

// ——— remove_task —————————————————————————————————————————————————————————

/**
 * The inverse of `assign_task`: a task retracted from a speaker's portal. It
 * leads with WHOSE portal changed, because that is the fact an organizer needs
 * if it turns out to have been the wrong call.
 */
export function TaskRemovedView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(output.title) ?? "Task"} removed`}
    >
      <FieldGrid
        entries={[
          { label: "Speaker", value: str(output.speaker) ?? "—" },
          {
            label: "Was completed",
            value: output.wasCompleted === true ? "Yes" : "No",
          },
        ]}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Banner>
  )
}

// ——— add_speaker / update_speaker ————————————————————————————————————————

/** The `{data: …}` REST envelope the apiV1-backed speaker tools answer with. */
function speakerRecord(output: Record<string, unknown>): Record<string, unknown> {
  return isRecord(output.data) ? output.data : output
}

/**
 * One receipt for both add and update, because the payload is identical and
 * the organizer's follow-up is identical too: check what the person's public
 * card now says, and send them their portal link if they haven't got one.
 */
export function SpeakerSavedView({ output, toolName }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const person = speakerRecord(output)
  const added = toolName === "add_speaker"
  const name =
    str(person.full_name) ??
    str([str(person.first_name), str(person.last_name)].filter(Boolean).join(" ")) ??
    str(person.email) ??
    "Speaker"
  const affiliation = [str(person.title), str(person.company_name)]
    .filter(Boolean)
    .join(" · ")
  return (
    <Banner
      icon={<RiUserAddLine size={16} />}
      title={`${name} ${added ? "added" : "updated"}`}
    >
      <FieldGrid
        entries={[
          ...(str(person.email)
            ? [{ label: "Email", value: str(person.email)! }]
            : []),
          ...(affiliation ? [{ label: "Role", value: affiliation }] : []),
          ...(str(person.workflow_status)
            ? [{ label: "Stage", value: str(person.workflow_status)! }]
            : []),
          {
            label: "Public profile",
            value: person.is_public === false ? "Hidden" : "Visible",
          },
        ]}
      />
      {added ? (
        <Note>
          They can&apos;t see anything yet — ask me for their portal link to let
          them in.
        </Note>
      ) : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Banner>
  )
}

// ——— remove_speaker ——————————————————————————————————————————————————————

export function SpeakerRemovedView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const person = speakerRecord(output)
  const name = str(person.full_name) ?? str(person.name) ?? str(output.name)
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${name ?? "Speaker"} removed from the event`}
    >
      <Note>
        Their tasks, uploads and headshot went with them. Emails already sent
        stay in the outbox for the record.
      </Note>
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Banner>
  )
}

// ——— bulk_add_speakers ———————————————————————————————————————————————————

const OUTCOME_TONE: Record<string, "good" | "muted" | "warn"> = {
  added: "good",
  updated: "muted",
  skipped: "warn",
}

/**
 * A bulk import is only trustworthy if it says what it did to EACH row — an
 * "18 imported" headline hides the three addresses that silently matched
 * someone who already existed. So the per-row outcomes are the body of the
 * card, not a footnote.
 */
export function BulkSpeakersView({ output }: ToolOutputProps) {
  const speakersLink = useSectionLink("speakers")
  const added = num(output.added) ?? 0
  const updated = num(output.updated) ?? 0
  const skipped = num(output.skipped) ?? 0
  const rows = asArray(output.results) ?? []
  return (
    <Panel title="Bulk speaker import" meta={`${num(output.total) ?? rows.length} row(s)`}>
      <StatRow
        stats={[
          { label: "Added", value: added, tone: added > 0 ? "good" : "default" },
          { label: "Filled in", value: updated },
          {
            label: "Skipped",
            value: skipped,
            tone: skipped > 0 ? "warn" : "default",
          },
        ]}
      />
      {rows.length > 0 ? (
        <Rows>
          {rows.slice(0, 8).map((row, index) => {
            const outcome = str(row.outcome) ?? "added"
            const key = outcome.split(" ")[0]
            return (
              <Row key={str(row.email) ?? index} className="items-center">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {str(row.email) ?? "—"}
                </span>
                <Chip tone={OUTCOME_TONE[key] === "good" ? "muted" : (OUTCOME_TONE[key] ?? "muted")}>
                  {outcome}
                </Chip>
              </Row>
            )
          })}
        </Rows>
      ) : null}
      {rows.length > 8 ? (
        <Note>
          +{rows.length - 8} more rows
          {str(output.resultsTruncated) ? ` (${str(output.resultsTruncated)})` : ""}.
        </Note>
      ) : null}
      {skipped > 0 ? (
        <Note>
          Skipped rows already existed with nothing blank left to fill — an
          import never overwrites what a speaker wrote themselves.
        </Note>
      ) : null}
      <GoLink to={speakersLink}>Open Speakers</GoLink>
    </Panel>
  )
}

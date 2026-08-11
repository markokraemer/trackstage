import {
  RiCheckboxCircleLine,
  RiDeleteBin6Line,
  RiKey2Line,
  RiMailSendLine,
  RiTaskLine,
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

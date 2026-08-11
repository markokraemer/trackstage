import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiMapPin2Line,
} from "@remixicon/react"

import { StatusPill, statusLabel } from "@/components/shared/status-pill"
import { useCurrentEventId } from "@/lib/current-event"
import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  MoreLink,
  Note,
  OpenLink,
  Panel,
  Row,
  Rows,
  StatRow,
  Tile,
  asArray,
  formatDate,
  num,
  str,
  strList,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * Workspaces, events and the two "how is my event doing?" tools.
 *
 * `get_event_summary` and `get_event_overview` answer the same question with
 * different payloads, so they share one view that reads whichever fields are
 * present — the organizer should not be able to tell which tool the model
 * happened to pick.
 */

// ——— list_workspaces —————————————————————————————————————————————————————

export function WorkspacesView({ output }: ToolOutputProps) {
  const rows = asArray(output.workspaces) ?? []
  if (rows.length === 0) {
    return <EmptyRow>You don&apos;t belong to a workspace yet.</EmptyRow>
  }
  return (
    <Panel title="Workspaces" meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => (
          <Row key={str(row.organizationId) ?? index} className="items-center">
            <RiBuilding2Line
              size={15}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {str(row.name) ?? "Untitled workspace"}
            </span>
            <Chip tone="muted">{str(row.yourRole) ?? "member"}</Chip>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {num(row.eventCount) ?? 0} event
              {(num(row.eventCount) ?? 0) === 1 ? "" : "s"}
            </span>
          </Row>
        ))}
      </Rows>
      <MoreLink target={{ to: "/app/workspace" }}>Workspace settings</MoreLink>
    </Panel>
  )
}

// ——— list_events —————————————————————————————————————————————————————————

export function EventsView({ output }: ToolOutputProps) {
  const currentEventId = useCurrentEventId()
  const rows = asArray(output.events) ?? []
  if (rows.length === 0) {
    return (
      <EmptyRow>
        No events yet — ask me to create one, or{" "}
        <GoLink to="/app/events">open Events</GoLink>.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Events" meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => {
          const id = str(row.eventId)
          const dates = [formatDate(row.startsAt), formatDate(row.endsAt)]
            .filter(Boolean)
            .join(" – ")
          return (
            <Row key={id ?? index}>
              <RiCalendarEventLine
                size={15}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {str(row.name) ?? "Untitled event"}
                  </span>
                  {id && id === currentEventId ? (
                    <Chip className="border-primary/40 bg-primary/10 text-primary">
                      Current
                    </Chip>
                  ) : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {dates ? <span>{dates}</span> : null}
                  {str(row.venue) ? (
                    <span className="inline-flex items-center gap-1">
                      <RiMapPin2Line size={12} aria-hidden />
                      {str(row.venue)}
                    </span>
                  ) : null}
                  {str(row.organizationName) ? (
                    <span className="truncate">
                      {str(row.organizationName)}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {str(row.slug)}
              </span>
            </Row>
          )
        })}
      </Rows>
      <MoreLink target={{ to: "/app/events" }}>Manage events</MoreLink>
    </Panel>
  )
}

// ——— create_event ————————————————————————————————————————————————————————

export function EventCreatedView({ output }: ToolOutputProps) {
  const name = str(output.name) ?? "New event"
  return (
    <Banner icon={<RiCalendarEventLine size={16} />} title={`${name} created`}>
      <FieldGrid
        entries={[
          {
            label: "Slug",
            value: <code className="font-mono">{str(output.slug) ?? "—"}</code>,
          },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <GoLink to="/app/events">Open Events</GoLink>
        <GoLink to="/app/settings">Event settings</GoLink>
      </div>
      <Note>
        Switch to it in the sidebar event switcher to point the rest of the app
        at it.
      </Note>
    </Banner>
  )
}

// ——— get_event_summary / get_event_overview ——————————————————————————————

/** Statuses worth a pill even at zero — the rest only show when non-empty. */
const ALWAYS_SHOWN = new Set(["pending", "accepted"])

export function EventStatsView({ output }: ToolOutputProps) {
  const event = (output.event ?? null) as Record<string, unknown> | null
  const counts =
    (output.submissions as Record<string, unknown> | undefined) ??
    (output.statusCounts as Record<string, unknown> | undefined) ??
    null
  const agenda = (output.agenda ?? null) as Record<string, unknown> | null

  const scheduled = num(agenda?.scheduled) ?? num(output.scheduledSessions)
  const waiting =
    num(agenda?.acceptedNotScheduled) ?? num(output.acceptedNotYetScheduled)
  const conflicts = Array.isArray(agenda?.conflicts)
    ? agenda.conflicts.length
    : num(output.agendaConflicts)
  const conflictLabels = strList(agenda?.conflicts)
  const openTasks =
    num((output.speakerTasks as Record<string, unknown> | undefined)?.open) ??
    num(output.openTaskCount)

  const statusEntries = counts
    ? Object.entries(counts)
        .map(([status, value]) => [status, num(value) ?? 0] as const)
        .filter(([status, value]) => value > 0 || ALWAYS_SHOWN.has(status))
    : []
  const total =
    num(output.totalSubmissions) ??
    statusEntries.reduce((sum, [, value]) => sum + value, 0)
  const accepted = num(counts?.accepted)

  const needsAttention = strList(output.needsAttention)
  const deadlines = asArray(output.upcomingDeadlines) ?? []
  const forms = asArray(output.forms) ?? []
  const outbox = (output.outbox ?? null) as Record<string, unknown> | null

  return (
    <Panel
      title={str(event?.name) ?? "Event"}
      meta={str(event?.slug) ?? undefined}
    >
      {str(output.headline) ? (
        <p className="text-sm text-muted-foreground">{str(output.headline)}</p>
      ) : null}

      <StatRow
        stats={[
          { label: "Submissions", value: total },
          ...(accepted !== null
            ? [{ label: "Accepted", value: accepted } as const]
            : []),
          ...(scheduled !== null
            ? [{ label: "Scheduled", value: scheduled } as const]
            : []),
          ...(waiting !== null
            ? [
                {
                  label: "Awaiting slot",
                  value: waiting,
                  tone: waiting > 0 ? ("warn" as const) : ("default" as const),
                },
              ]
            : []),
          ...(conflicts !== null
            ? [
                {
                  label: "Conflicts",
                  value: conflicts,
                  tone: conflicts > 0 ? ("bad" as const) : ("good" as const),
                },
              ]
            : []),
          ...(openTasks !== null
            ? [
                {
                  label: "Open tasks",
                  value: openTasks,
                  tone:
                    openTasks > 0 ? ("warn" as const) : ("default" as const),
                },
              ]
            : []),
        ]}
      />

      {statusEntries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {statusEntries.map(([status, value]) => (
            <StatusPill
              key={status}
              status={status}
              size="sm"
              label={`${statusLabel(status)} · ${value}`}
            />
          ))}
        </div>
      ) : null}

      {needsAttention.length > 0 ? (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Needs attention
          </h4>
          <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {needsAttention.map((entry) => (
              <li key={entry} className="flex gap-2 text-foreground">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-status-amber-dot"
                />
                <span className="min-w-0">{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {conflictLabels.length > 0 ? (
        <Tile tone="bad" className="space-y-1">
          <p className="text-xs font-medium text-status-red-fg">
            {conflictLabels.length} agenda conflict
            {conflictLabels.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-0.5 text-xs text-foreground">
            {conflictLabels.slice(0, 4).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
          <GoLink to="/app/agenda" search={{ view: "conflicts" }}>
            Resolve in Agenda
          </GoLink>
        </Tile>
      ) : null}

      {forms.length > 0 ? (
        <Rows>
          {forms.map((form, index) => {
            const url = str(form.publicUrl)
            return (
              <Row
                key={str(form.formId) ?? str(form.name) ?? index}
                className="items-center"
              >
                <StatusPill status={str(form.status) ?? "open"} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {str(form.name) ?? "CFP form"}
                </span>
                {(str(form.closesAt) ?? str(form.closeAt)) ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    closes {formatDate(form.closesAt ?? form.closeAt)}
                  </span>
                ) : null}
                {url ? <OpenLink href={url}>Public link</OpenLink> : null}
              </Row>
            )
          })}
        </Rows>
      ) : null}

      {deadlines.length > 0 ? (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Next up
          </h4>
          <Rows>
            {deadlines.slice(0, 4).map((deadline, index) => {
              const days = num(deadline.daysAway)
              return (
                <Row
                  key={str(deadline.what) ?? index}
                  className="items-center py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {str(deadline.what) ?? "Deadline"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {days === null
                      ? (formatDate(deadline.when) ?? "")
                      : days < 0
                        ? `${Math.abs(days)}d ago`
                        : days === 0
                          ? "today"
                          : `in ${days}d`}
                  </span>
                </Row>
              )
            })}
          </Rows>
        </div>
      ) : null}

      {outbox && Object.keys(outbox).length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(outbox).map(([status, value]) => (
            <StatusPill
              key={status}
              status={status}
              size="sm"
              label={`${statusLabel(status)} · ${String(value)}`}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <GoLink to="/app">Dashboard</GoLink>
        <GoLink to="/app/submissions">Submissions</GoLink>
        <GoLink to="/app/agenda" search={{ view: "day" }}>
          Agenda
        </GoLink>
        <GoLink to="/app/speakers">Speakers</GoLink>
      </div>
    </Panel>
  )
}

import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiDeleteBin6Line,
  RiMapPin2Line,
} from "@remixicon/react"

import { StatusPill, statusLabel } from "@/components/shared/status-pill"
import { useCurrentEventId } from "@/lib/current-event"
import { appLink, legacyAppLink, workspaceSlugFromPathname } from "@/lib/app-links"
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
  isRecord,
  num,
  str,
  strList,
  useCopilotEventRef,
  useSectionLink,
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
  // Provider-free (see useCopilotEventRef): the canonical URL carries the
  // workspace segment; anywhere else the bare hub path redirects.
  const workspaceSlug =
    typeof window === "undefined"
      ? undefined
      : workspaceSlugFromPathname(window.location.pathname)
  const workspaceLink = workspaceSlug
    ? appLink.workspaceHub(workspaceSlug)
    : appLink.workspaceHubFallback
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
      <MoreLink target={{ to: workspaceLink }}>Workspace settings</MoreLink>
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
        <GoLink to={appLink.events}>open Events</GoLink>.
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
      <MoreLink target={{ to: appLink.events }}>Manage events</MoreLink>
    </Panel>
  )
}

// ——— create_event ————————————————————————————————————————————————————————

export function EventCreatedView({ output }: ToolOutputProps) {
  const name = str(output.name) ?? "New event"
  // create_event returns the workspace slug alongside the event slug, so the
  // NEW event's own settings page is addressable straight from the receipt.
  // Without both halves the canonical `/app/:ws/:event` path cannot be built,
  // and we fall back to the bare legacy path (it redirects through whichever
  // event is currently in context — right section, wrong event).
  const workspaceSlug = str(output.workspaceSlug)
  const eventSlug = str(output.slug)
  const settingsLink =
    workspaceSlug && eventSlug
      ? appLink.settings({ workspaceSlug, eventSlug })
      : legacyAppLink.settings
  const publicUrl = str(output.publicUrl)
  return (
    <Banner icon={<RiCalendarEventLine size={16} />} title={`${name} created`}>
      <FieldGrid
        entries={[
          {
            label: "Slug",
            value: <code className="font-mono">{eventSlug ?? "—"}</code>,
          },
          ...(publicUrl
            ? [
                {
                  label: "Public page",
                  value: <OpenLink href={publicUrl}>{publicUrl}</OpenLink>,
                },
              ]
            : []),
        ]}
      />
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <GoLink to={appLink.events}>Open Events</GoLink>
        <GoLink to={settingsLink}>Event settings</GoLink>
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
  const eventRef = useCopilotEventRef()
  const dashboardLink = eventRef ? appLink.dashboard(eventRef) : legacyAppLink.dashboard
  const agendaLink = useSectionLink("agenda")
  const submissionsLink = useSectionLink("submissions")
  const speakersLink = useSectionLink("speakers")
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
          <GoLink to={agendaLink} search={{ view: "conflicts" }}>
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
        <GoLink to={dashboardLink}>Dashboard</GoLink>
        <GoLink to={submissionsLink}>Submissions</GoLink>
        <GoLink to={agendaLink} search={{ view: "day" }}>
          Agenda
        </GoLink>
        <GoLink to={speakersLink}>Speakers</GoLink>
      </div>
    </Panel>
  )
}

// ——— delete_event ————————————————————————————————————————————————————————

/**
 * A receipt, not a celebration. `delete_event` is the most destructive thing
 * on the MCP surface, so the view's whole job is to state plainly what is now
 * gone — the tally the mutation counted BEFORE the cascade ran — rather than
 * congratulate anyone. (The confirmation itself happens upstream, on the
 * approval card: this only ever renders after a human said yes.)
 */
export function EventDeletedView({ output }: ToolOutputProps) {
  const removed = isRecord(output.removed) ? output.removed : {}
  const entries = [
    { label: "Submissions", value: String(num(removed.submissions) ?? 0) },
    { label: "Speakers", value: String(num(removed.people) ?? 0) },
    { label: "Forms", value: String(num(removed.forms) ?? 0) },
    { label: "Tasks", value: String(num(removed.tasks) ?? 0) },
    { label: "Rooms", value: String(num(removed.rooms) ?? 0) },
  ]
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(output.name) ?? "Event"} deleted`}
    >
      <FieldGrid entries={entries} />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      {/* The event just deleted may still be "in context" for a moment —
          the bare legacy dashboard path re-resolves against whatever event
          is left, never the one that's gone. */}
      <GoLink to={legacyAppLink.dashboard}>Dashboard</GoLink>
    </Banner>
  )
}

// ——— update_event ————————————————————————————————————————————————————————

/**
 * `update_event` proxies the REST event resource, so the reply is the entire
 * event record — thirty-odd fields where two changed. The card is therefore
 * driven by the INPUT (what the organizer asked for) and reads the new values
 * from the output: a receipt for the edit, not a dump of the row.
 *
 * The three portal toggles are called out separately because they are the only
 * fields here that change what a SPEAKER can do, and an organizer who flips
 * `allowSubmissionEdits` deserves to see that stated in speaker terms.
 */
const EVENT_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  venue: "Venue",
  timezone: "Timezone",
  description: "Description",
  websiteUrl: "Website",
  startsAt: "Starts",
  endsAt: "Ends",
}

const PORTAL_TOGGLES: Record<string, { label: string; on: string; off: string }> = {
  allowSubmissionEdits: {
    label: "Editing after the CFP closes",
    on: "Speakers can still edit their submissions after the deadline.",
    off: "Editing closes with the CFP — for everyone, accepted included.",
  },
  alwaysShowTasks: {
    label: "Tasks always visible",
    on: "Every speaker sees their task list, accepted or not.",
    off: "Tasks appear once a speaker is accepted.",
  },
  extendTaskDeadlines: {
    label: "Late task submissions",
    on: "Speakers can still complete tasks after the due date.",
    off: "Tasks lock on their due date.",
  },
}

export function EventUpdatedView({ input, output }: ToolOutputProps) {
  const eventRef = useCopilotEventRef()
  const settingsLink = eventRef ? appLink.settings(eventRef) : legacyAppLink.settings
  const event = isRecord(output.data) ? output.data : output
  const args = isRecord(input) ? input : {}

  const changed = Object.keys(args).filter(
    (key) => key in EVENT_FIELD_LABELS && args[key] !== undefined
  )
  const toggles = Object.keys(args).filter(
    (key) => key in PORTAL_TOGGLES && typeof args[key] === "boolean"
  )

  const entries = changed.map((key) => {
    const raw = event[key === "websiteUrl" ? "website_url" : key] ?? args[key]
    const value =
      key === "startsAt" || key === "endsAt"
        ? (formatDate(
            event[key === "startsAt" ? "starts_at" : "ends_at"] ?? args[key]
          ) ?? String(args[key]))
        : String(raw ?? "—")
    return { label: EVENT_FIELD_LABELS[key], value }
  })

  return (
    <Banner
      icon={<RiCalendarEventLine size={16} />}
      title={`${str(event.name) ?? "Event"} updated`}
    >
      {entries.length > 0 ? <FieldGrid entries={entries} /> : null}
      {toggles.length > 0 ? (
        <div className="space-y-1 pt-0.5">
          {toggles.map((key) => {
            const toggle = PORTAL_TOGGLES[key]
            const on = args[key] === true
            return (
              <div key={key} className="flex items-start gap-2 text-xs">
                <Chip tone={on ? "muted" : "warn"}>
                  {toggle.label}: {on ? "on" : "off"}
                </Chip>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {on ? toggle.on : toggle.off}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
      {entries.length === 0 && toggles.length === 0 ? (
        <Note>Nothing visible changed — the event is as it was.</Note>
      ) : null}
      <GoLink to={settingsLink}>Event settings</GoLink>
    </Banner>
  )
}

import {
  RiAlarmWarningLine,
  RiCalendarScheduleLine,
  RiInboxUnarchiveLine,
  RiMagicLine,
} from "@remixicon/react"

import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  Note,
  Panel,
  Row,
  Rows,
  StatRow,
  Tile,
  TrackTag,
  asArray,
  formatTime,
  groupByDay,
  isRecord,
  num,
  str,
  strList,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * The agenda: what's placed, what isn't, and what clashes.
 *
 * Conflicts get the loudest treatment in the whole copilot — red border, red
 * icon, every clash spelled out — because a double-booked room is the one
 * agenda fact that ruins a conference day, and it is exactly the thing an
 * organizer skims past in a wall of text.
 */

function ConflictList({
  conflicts,
}: {
  conflicts: Array<Record<string, unknown>>
}) {
  const agendaLink = useSectionLink("agenda")
  if (conflicts.length === 0) return null
  return (
    <Tile tone="bad" className="space-y-2">
      <div className="flex items-center gap-2">
        <RiAlarmWarningLine
          size={16}
          aria-hidden
          className="shrink-0 text-status-red-fg"
        />
        <p className="text-sm font-medium text-status-red-fg">
          {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"} to
          resolve
        </p>
      </div>
      <ul className="space-y-1.5">
        {conflicts.map((conflict, index) => {
          const sessions = strList(conflict.sessions)
          return (
            <li key={index} className="text-xs text-foreground">
              <span className="font-medium">
                {str(conflict.problem) ?? str(conflict.kind) ?? "Clash"}
              </span>
              {sessions.length > 0 ? (
                <span className="text-muted-foreground">
                  {" — "}
                  {sessions.join("  ×  ")}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      <GoLink to={agendaLink} search={{ view: "conflicts" }}>
        Resolve in Agenda
      </GoLink>
    </Tile>
  )
}

// ——— get_agenda ——————————————————————————————————————————————————————————

export function AgendaView({ output }: ToolOutputProps) {
  const agendaLink = useSectionLink("agenda")
  const event = isRecord(output.event) ? output.event : null
  const rooms = asArray(output.rooms) ?? []
  const scheduled = asArray(output.scheduled) ?? []
  const unscheduled = asArray(output.unscheduled) ?? []
  const conflicts = asArray(output.conflicts) ?? []
  const days = groupByDay(scheduled)

  if (scheduled.length === 0 && unscheduled.length === 0) {
    return (
      <EmptyRow>
        Nothing on the agenda yet — accept some sessions first, then ask me to
        auto-fill it.
      </EmptyRow>
    )
  }

  return (
    <Panel
      title={str(event?.name) ? `${str(event?.name)} agenda` : "Agenda"}
      meta={str(event?.timezone) ?? undefined}
    >
      <StatRow
        stats={[
          { label: "Scheduled", value: scheduled.length },
          {
            label: "Unscheduled",
            value: unscheduled.length,
            tone: unscheduled.length > 0 ? "warn" : "good",
          },
          { label: "Rooms", value: rooms.length },
          {
            label: "Conflicts",
            value: conflicts.length,
            tone: conflicts.length > 0 ? "bad" : "good",
          },
        ]}
      />

      <ConflictList conflicts={conflicts} />

      {days.map((day) => {
        const perRoom = new Map<string, number>()
        for (const session of day.rows) {
          const room = str(session.room) ?? "Unassigned"
          perRoom.set(room, (perRoom.get(room) ?? 0) + 1)
        }
        const first = day.rows[0]
        const last = day.rows[day.rows.length - 1]
        return (
          <div key={day.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {day.heading}
              </h4>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatTime(first.startsAt)}
                {last !== first ? ` – ${formatTime(last.startsAt)}` : ""}
                {" · "}
                {day.rows.length} session{day.rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...perRoom.entries()].map(([room, count]) => (
                <Chip key={room} tone="muted" className="h-6 px-2 text-[11px]">
                  {room} · {count}
                </Chip>
              ))}
            </div>
            <Rows>
              {day.rows.slice(0, 5).map((session, index) => (
                <Row
                  key={str(session.submissionId) ?? index}
                  className="items-center py-2"
                >
                  <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatTime(session.startsAt) ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {str(session.title) ?? "Session"}
                  </span>
                  {str(session.track) ? (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      <TrackTag track={str(session.track)!} />
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {str(session.room) ?? "—"}
                  </span>
                </Row>
              ))}
            </Rows>
            {day.rows.length > 5 ? (
              <Note>+{day.rows.length - 5} more on this day.</Note>
            ) : null}
          </div>
        )
      })}

      {unscheduled.length > 0 ? (
        <Tile tone="warn" className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RiInboxUnarchiveLine
              size={15}
              aria-hidden
              className="shrink-0 text-status-amber-fg"
            />
            <p className="text-sm font-medium text-status-amber-fg">
              {unscheduled.length} accepted session
              {unscheduled.length === 1 ? "" : "s"} waiting for a slot
            </p>
          </div>
          <ul className="space-y-0.5 text-xs text-foreground">
            {unscheduled.slice(0, 5).map((session, index) => (
              <li key={str(session.submissionId) ?? index} className="truncate">
                {str(session.title) ?? "Session"}
              </li>
            ))}
            {unscheduled.length > 5 ? (
              <li className="text-muted-foreground">
                +{unscheduled.length - 5} more
              </li>
            ) : null}
          </ul>
        </Tile>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <GoLink to={agendaLink} search={{ view: "day" }}>
          Open Agenda
        </GoLink>
        <GoLink to={agendaLink} search={{ view: "rooms" }}>
          Rooms view
        </GoLink>
      </div>
    </Panel>
  )
}

// ——— schedule_session ————————————————————————————————————————————————————

export function SessionScheduledView({ output }: ToolOutputProps) {
  const agendaLink = useSectionLink("agenda")
  const conflicts = strList(output.conflicts)
  const submissionId = str(output.submissionId)

  return (
    <Banner
      icon={<RiCalendarScheduleLine size={16} />}
      tone={conflicts.length > 0 ? "warn" : "good"}
      title={str(output.title) ?? "Session scheduled"}
    >
      <FieldGrid
        entries={[
          { label: "Room", value: str(output.room) ?? "—" },
          {
            label: "Starts",
            value: `${formatTime(output.startsAt) ?? "—"}`,
          },
          {
            label: "Duration",
            value: `${num(output.durationMinutes) ?? 45} min`,
          },
        ]}
      />
      {conflicts.length > 0 ? (
        <ul className="space-y-0.5 rounded-md border border-status-red-dot/40 bg-status-red-bg/40 p-2 text-xs text-status-red-fg">
          {conflicts.map((conflict) => (
            <li key={conflict}>{conflict}</li>
          ))}
        </ul>
      ) : (
        <Note>No clashes with anything already placed.</Note>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <GoLink
          to={agendaLink}
          search={{ view: "day", focus: submissionId ?? undefined }}
        >
          See it on the agenda
        </GoLink>
      </div>
    </Banner>
  )
}

// ——— unschedule_session ——————————————————————————————————————————————————

export function SessionUnscheduledView({ output }: ToolOutputProps) {
  const agendaLink = useSectionLink("agenda")
  return (
    <Banner
      tone="neutral"
      icon={<RiInboxUnarchiveLine size={16} />}
      title={`${str(output.title) ?? "Session"} moved back to the tray`}
    >
      <Note>
        {str(output.note) ??
          "It stays accepted — it just has no room or time any more."}
      </Note>
      <GoLink to={agendaLink} search={{ view: "day" }}>
        Open Agenda
      </GoLink>
    </Banner>
  )
}

// ——— auto_place_sessions —————————————————————————————————————————————————

export function AutoPlaceView({ output }: ToolOutputProps) {
  const agendaLink = useSectionLink("agenda")
  const placed = num(output.placed) ?? 0
  const remaining = num(output.couldNotFit) ?? 0
  const conflicts = num(output.conflictsAfterwards) ?? 0

  return (
    <Banner
      icon={<RiMagicLine size={16} />}
      tone={placed === 0 ? "warn" : "good"}
      title={
        placed === 0
          ? "Nothing could be placed"
          : `${placed} session${placed === 1 ? "" : "s"} placed`
      }
    >
      <StatRow
        stats={[
          {
            label: "Placed",
            value: placed,
            tone: placed > 0 ? "good" : "warn",
          },
          {
            label: "Wouldn't fit",
            value: remaining,
            tone: remaining > 0 ? "warn" : "default",
          },
          {
            label: "Conflicts",
            value: conflicts,
            tone: conflicts > 0 ? "bad" : "good",
          },
        ]}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <GoLink to={agendaLink} search={{ view: "day" }}>
          Open Agenda
        </GoLink>
        {conflicts > 0 ? (
          <GoLink to={agendaLink} search={{ view: "conflicts" }}>
            Review conflicts
          </GoLink>
        ) : null}
      </div>
    </Banner>
  )
}

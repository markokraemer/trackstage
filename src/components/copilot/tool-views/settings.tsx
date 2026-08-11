import {
  RiBuilding2Line,
  RiCodeSSlashLine,
  RiDeleteBin6Line,
  RiDoorOpenLine,
  RiHistoryLine,
  RiMailAddLine,
  RiSettings3Line,
  RiShieldUserLine,
  RiWebhookLine,
} from "@remixicon/react"

import { StatusPill } from "@/components/shared/status-pill"
import { appLink, workspaceSlugFromPathname } from "@/lib/app-links"
import {
  Banner,
  Chip,
  EmptyRow,
  FieldGrid,
  GoLink,
  LinkRow,
  Note,
  OpenLink,
  Panel,
  Row,
  Rows,
  TrackDot,
  asArray,
  formatWhen,
  isRecord,
  num,
  str,
  strList,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * Event setup and workspace administration — the "plumbing" tools.
 *
 * Rooms, tracks, tag/format/level/language option lists, custom statuses,
 * webhooks, embeds, workspace members and the activity feed. Individually
 * small; together they are the half of the MCP surface an organizer reaches for
 * when something is configured wrong, which is exactly when a wall of JSON is
 * least welcome.
 *
 * Two things every view here does deliberately:
 *
 *  - **Colour carries the data** (RULES #22). A track without its colour is
 *    just a word; `manage_track` and the tracks listing render the real hex the
 *    organizer picked, not a hashed stand-in.
 *  - **Secrets are handled, not printed.** A webhook's signing secret is
 *    returned exactly once, at creation. The create receipt gives it the
 *    copyable LinkRow treatment and says so; every other view masks it.
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

/** A real colour swatch when the payload carries one, else the hashed dot. */
function Swatch({ color, name }: { color: string | null; name: string }) {
  if (!color) return <TrackDot track={name} />
  return (
    <span
      aria-hidden
      data-slot="track-dot"
      className="size-2 shrink-0 rounded-full ring-1 ring-black/10 ring-inset"
      style={{ backgroundColor: color }}
    />
  )
}

// ——— list_field_options ——————————————————————————————————————————————————

const RESOURCE_LABELS: Record<string, string> = {
  rooms: "Rooms",
  tracks: "Tracks",
  tags: "Tags",
  formats: "Formats",
  levels: "Levels",
  languages: "Languages",
  statuses: "Submission statuses",
}

export function FieldOptionsView({ output, input }: ToolOutputProps) {
  const settingsLink = useSectionLink("settings")
  const resource = isRecord(input)
    ? (str(input.resource) ?? "options")
    : "options"
  const rows = rowsOf(output, "options")
  const label = RESOURCE_LABELS[resource] ?? "Options"

  if (rows.length === 0) {
    return (
      <EmptyRow>
        No {label.toLowerCase()} yet —{" "}
        <GoLink to={settingsLink}>set them up in Settings</GoLink>.
      </EmptyRow>
    )
  }

  // Statuses and tracks are records with colour and meaning; tags, formats,
  // levels and languages are just words — a chip cloud reads far better than a
  // seven-row table of one-word rows.
  const plain = ["tags", "formats", "levels", "languages"].includes(resource)
  if (plain) {
    return (
      <Panel title={label} meta={`${rows.length}`}>
        <div className="flex flex-wrap gap-1">
          {rows.map((row, index) => (
            <Chip key={str(row.id) ?? index} tone="muted">
              {str(row.name) ?? str(row.value) ?? str(row.label) ?? "—"}
            </Chip>
          ))}
        </div>
        <GoLink to={settingsLink}>Event settings</GoLink>
      </Panel>
    )
  }

  return (
    <Panel title={label} meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => {
          const name = str(row.name) ?? str(row.value) ?? "—"
          const capacity = num(row.capacity)
          const pipeline = str(row.pipeline_status)
          return (
            <Row key={str(row.id) ?? index} className="items-center">
              {resource === "rooms" ? (
                <RiDoorOpenLine
                  size={15}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
              ) : (
                <Swatch color={str(row.color)} name={name} />
              )}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {name}
              </span>
              {capacity !== null ? (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {capacity} seats
                </span>
              ) : null}
              {row.system === true ? <Chip tone="muted">Built-in</Chip> : null}
              {pipeline ? <StatusPill status={pipeline} size="sm" /> : null}
            </Row>
          )
        })}
      </Rows>
      <GoLink to={settingsLink}>Event settings</GoLink>
    </Panel>
  )
}

// ——— manage_room / manage_track / manage_field_option / manage_session_status

const MANAGED_LABEL: Record<string, string> = {
  manage_room: "Room",
  manage_track: "Track",
  manage_field_option: "Option",
  manage_session_status: "Status",
}

/**
 * One receipt for all four `manage_*` tools — they are the same verb over
 * different tables, and the organizer should not have to learn four card
 * layouts for "created / renamed / deleted".
 */
export function ManagedSettingView({
  output,
  input,
  toolName,
}: ToolOutputProps) {
  const settingsLink = useSectionLink("settings")
  const what = MANAGED_LABEL[toolName] ?? "Setting"
  const action = isRecord(input) ? (str(input.action) ?? "update") : "update"
  const row = record(output)
  const name =
    str(row.name) ??
    str(row.value) ??
    str(row.label) ??
    (isRecord(input) ? (str(input.name) ?? str(input.value)) : null) ??
    what

  if (action === "delete") {
    return (
      <Banner
        tone="bad"
        icon={<RiDeleteBin6Line size={16} />}
        title={`${what} “${name}” deleted`}
      >
        <Note>
          Anything already using it keeps the value it was saved with — only the
          option list changed.
        </Note>
        <GoLink to={settingsLink}>Event settings</GoLink>
      </Banner>
    )
  }

  const capacity = num(row.capacity)
  const color = str(row.color)
  return (
    <Banner
      icon={<RiSettings3Line size={16} />}
      title={`${what} “${name}” ${action === "create" ? "created" : "updated"}`}
    >
      <FieldGrid
        entries={[
          ...(color
            ? [
                {
                  label: "Colour",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <Swatch color={color} name={name} />
                      <code className="font-mono">{color}</code>
                    </span>
                  ),
                },
              ]
            : []),
          ...(capacity !== null
            ? [{ label: "Capacity", value: `${capacity} seats` }]
            : []),
          ...(str(row.pipeline_status)
            ? [
                {
                  label: "Behaves as",
                  value: (
                    <StatusPill status={str(row.pipeline_status)!} size="sm" />
                  ),
                },
              ]
            : []),
          ...(num(row.order) !== null
            ? [{ label: "Position", value: String((num(row.order) ?? 0) + 1) }]
            : []),
        ]}
      />
      <GoLink to={settingsLink}>Event settings</GoLink>
    </Banner>
  )
}

// ——— list_webhooks ———————————————————————————————————————————————————————

export function WebhooksView({ output }: ToolOutputProps) {
  const settingsLink = useSectionLink("settings")
  const rows = rowsOf(output, "webhooks")
  if (rows.length === 0) {
    return (
      <EmptyRow>
        No webhooks on this event —{" "}
        <GoLink to={settingsLink}>add one in Settings</GoLink> to push changes
        into another system.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Webhooks" meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => {
          const failures = num(row.consecutive_failures) ?? 0
          const events = strList(row.events)
          return (
            <Row key={str(row.id) ?? index} className="flex-col gap-1">
              <div className="flex w-full min-w-0 items-center gap-2">
                <RiWebhookLine
                  size={15}
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {str(row.url) ?? "—"}
                </span>
                {row.enabled === false ? (
                  <Chip tone="muted">Paused</Chip>
                ) : failures > 0 ? (
                  <Chip tone="warn">{failures} failing</Chip>
                ) : (
                  <Chip tone="muted">Live</Chip>
                )}
              </div>
              <div className="flex w-full flex-wrap items-center gap-1 pl-[23px]">
                {events.slice(0, 5).map((event) => (
                  <Chip key={event} tone="muted">
                    {event}
                  </Chip>
                ))}
                {events.length > 5 ? (
                  <Chip tone="muted">+{events.length - 5}</Chip>
                ) : null}
              </div>
              {str(row.last_error) ? (
                <p className="w-full pl-[23px] text-xs text-status-red-fg">
                  Last error: {str(row.last_error)}
                </p>
              ) : formatWhen(row.last_delivery_at) ? (
                <p className="w-full pl-[23px] text-xs text-muted-foreground">
                  Last delivered {formatWhen(row.last_delivery_at)}
                </p>
              ) : null}
            </Row>
          )
        })}
      </Rows>
      <GoLink to={settingsLink}>Event settings</GoLink>
    </Panel>
  )
}

// ——— manage_webhook ——————————————————————————————————————————————————————

export function WebhookSavedView({ output, input }: ToolOutputProps) {
  const settingsLink = useSectionLink("settings")
  const action = isRecord(input) ? (str(input.action) ?? "update") : "update"
  const row = record(output)
  const url = str(row.url) ?? (isRecord(input) ? str(input.url) : null)

  if (action === "delete") {
    return (
      <Banner
        tone="bad"
        icon={<RiDeleteBin6Line size={16} />}
        title="Webhook deleted"
      >
        <Note>
          {url ? `${url} ` : "It "}
          stops receiving events immediately. Deliveries already sent stay in
          the log.
        </Note>
        <GoLink to={settingsLink}>Event settings</GoLink>
      </Banner>
    )
  }

  const secret = str(row.secret)
  const events = strList(row.events)
  return (
    <Banner
      icon={<RiWebhookLine size={16} />}
      title={`Webhook ${action === "create" ? "created" : "updated"}`}
    >
      <FieldGrid
        entries={[
          {
            label: "Endpoint",
            value: <code className="font-mono break-all">{url ?? "—"}</code>,
          },
          {
            label: "Events",
            value: events.length > 0 ? events.join(", ") : "—",
          },
          {
            label: "State",
            value: row.enabled === false ? "Paused" : "Live",
          },
        ]}
      />
      {action === "create" && secret ? (
        <>
          <LinkRow url={secret} label="Signing secret" openLabel="Docs" />
          <Note>
            This is the only time the secret is shown. Store it now — every
            delivery is signed with it, and verifying that signature is how your
            receiver knows the payload really came from us.
          </Note>
        </>
      ) : null}
      <GoLink to={settingsLink}>Event settings</GoLink>
    </Banner>
  )
}

// ——— list_embeds / save_embed / delete_embed —————————————————————————————

export function EmbedsView({ output }: ToolOutputProps) {
  const embedsLink = useSectionLink("embeds")
  const rows = asArray(output.embeds) ?? []
  if (rows.length === 0) {
    return (
      <EmptyRow>
        No saved embeds — <GoLink to={embedsLink}>build one in Embeds</GoLink>{" "}
        to drop the agenda or speaker list onto your own site.
      </EmptyRow>
    )
  }
  return (
    <Panel title="Saved embeds" meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => {
          const options = isRecord(row.options) ? row.options : {}
          // ABSENT ⇒ ON, the same rule the schema and the public page use.
          const off = row.enabled === false
          const accent = str(options.accent)
          return (
            <Row key={str(row.embedId) ?? index} className="items-center">
              <RiCodeSSlashLine
                size={15}
                aria-hidden
                className={
                  off
                    ? "mt-0.5 shrink-0 text-muted-foreground/50"
                    : "mt-0.5 shrink-0 text-muted-foreground"
                }
              />
              <span
                className={
                  off
                    ? "min-w-0 flex-1 truncate text-sm text-muted-foreground"
                    : "min-w-0 flex-1 truncate text-sm text-foreground"
                }
              >
                {str(row.name) ?? "Untitled embed"}
              </span>
              {accent ? <Swatch color={accent} name={accent} /> : null}
              {/* An embed that is switched off answers "turned off" on every
                    page it was pasted into — the loudest fact about the row. */}
              {off ? <Chip tone="warn">Off</Chip> : null}
              <Chip tone="muted">{str(row.widget) ?? "agenda"}</Chip>
              <Chip tone="muted">{str(options.format) ?? "iframe"}</Chip>
            </Row>
          )
        })}
      </Rows>
      <GoLink to={embedsLink}>Open Embeds</GoLink>
    </Panel>
  )
}

export function EmbedSavedView({ output }: ToolOutputProps) {
  const embedsLink = useSectionLink("embeds")
  const updated = output.updated === true
  return (
    <Banner
      icon={<RiCodeSSlashLine size={16} />}
      title={`${str(output.name) ?? "Embed"} ${updated ? "updated" : "saved"}`}
    >
      <FieldGrid
        entries={[{ label: "Widget", value: str(output.widget) ?? "agenda" }]}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      {/* The copyable snippet lives on the Embeds page, where it can be
          previewed against the real widget before anyone pastes it. */}
      <GoLink to={embedsLink}>Copy the snippet in Embeds</GoLink>
    </Banner>
  )
}

export function EmbedDeletedView({ output }: ToolOutputProps) {
  const embedsLink = useSectionLink("embeds")
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(output.name) ?? "Embed"} deleted`}
    >
      <Note>
        Only the saved preset went — snippets already pasted into websites keep
        working, because they carry their own settings in the URL.
      </Note>
      <GoLink to={embedsLink}>Open Embeds</GoLink>
    </Banner>
  )
}

// ——— Workspace members ———————————————————————————————————————————————————

function workspaceHubLink(): string {
  const slug =
    typeof window === "undefined"
      ? undefined
      : workspaceSlugFromPathname(window.location.pathname)
  return slug ? appLink.workspaceHub(slug) : appLink.workspaceHubFallback
}

export function WorkspaceMembersView({ output }: ToolOutputProps) {
  const hub = workspaceHubLink()
  const workspace = isRecord(output.workspace) ? output.workspace : {}
  const rows = asArray(output.members) ?? []
  if (rows.length === 0) {
    return <EmptyRow>Nobody in this workspace yet.</EmptyRow>
  }
  const pending = rows.filter((row) => row.accepted === false).length
  return (
    <Panel
      title={str(workspace.name) ?? "Workspace members"}
      meta={`${rows.length}`}
    >
      <Rows>
        {rows.map((row, index) => {
          // `eventScope: null` means every event, now and in future — the
          // difference between "all events" and "3 events" is the whole point
          // of the roster, so it is never left implicit.
          const scope = row.eventScope
          const scopeLabel = Array.isArray(scope)
            ? scope.length === 0
              ? "No events"
              : scope.join(", ")
            : "All events"
          return (
            <Row key={str(row.memberId) ?? index} className="items-center">
              <RiShieldUserLine
                size={15}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {str(row.email) ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {scopeLabel}
                </p>
              </div>
              {row.accepted === false ? <Chip tone="warn">Invited</Chip> : null}
              <Chip tone="muted">{str(row.role) ?? "member"}</Chip>
            </Row>
          )
        })}
      </Rows>
      {pending > 0 ? (
        <Note>
          {pending} invite{pending === 1 ? "" : "s"} not accepted yet — access
          starts the moment they sign up with that address.
        </Note>
      ) : null}
      <GoLink to={hub}>Workspace settings</GoLink>
    </Panel>
  )
}

export function MemberInvitedView({ output }: ToolOutputProps) {
  const hub = workspaceHubLink()
  const scope = output.eventScope
  return (
    <Banner
      icon={<RiMailAddLine size={16} />}
      title={`Invite emailed to ${str(output.email) ?? "them"}`}
    >
      <FieldGrid
        entries={[
          { label: "Role", value: str(output.role) ?? "member" },
          {
            label: "Sees",
            value:
              typeof scope === "string"
                ? scope
                : Array.isArray(scope)
                  ? scope.join(", ")
                  : "All events",
          },
        ]}
      />
      <Note>
        Their access starts the moment they sign up with that address — nothing
        for you to approve afterwards.
      </Note>
      <GoLink to={hub}>Workspace settings</GoLink>
    </Banner>
  )
}

export function MemberUpdatedView({ output }: ToolOutputProps) {
  const hub = workspaceHubLink()
  return (
    <Banner
      icon={<RiShieldUserLine size={16} />}
      title={`${str(output.email) ?? "Member"} updated`}
    >
      <FieldGrid
        entries={[
          { label: "Role", value: str(output.role) ?? "member" },
          { label: "Sees", value: str(output.eventScope) ?? "All events" },
        ]}
      />
      <GoLink to={hub}>Workspace settings</GoLink>
    </Banner>
  )
}

export function MemberRemovedView({ output }: ToolOutputProps) {
  const hub = workspaceHubLink()
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(output.email) ?? "Member"} removed`}
    >
      {str(output.note) ? (
        <Note>{str(output.note)}</Note>
      ) : (
        <Note>Their access ended immediately.</Note>
      )}
      <GoLink to={hub}>Workspace settings</GoLink>
    </Banner>
  )
}

// ——— update_workspace ————————————————————————————————————————————————————

export function WorkspaceUpdatedView({ output }: ToolOutputProps) {
  const url = str(output.url)
  const adjusted = output.slugAdjusted === true
  return (
    <Banner
      tone={adjusted ? "warn" : "good"}
      icon={<RiBuilding2Line size={16} />}
      title={`${str(output.name) ?? "Workspace"} updated`}
    >
      <FieldGrid
        entries={[
          {
            label: "Address",
            value: (
              <code className="font-mono">/{str(output.slug) ?? "—"}</code>
            ),
          },
        ]}
      />
      {url ? <OpenLink href={url}>{url}</OpenLink> : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
    </Banner>
  )
}

// ——— list_activity ———————————————————————————————————————————————————————

export function ActivityView({ output }: ToolOutputProps) {
  const settingsLink = useSectionLink("settings")
  const rows = asArray(output.activity) ?? []
  if (rows.length === 0) {
    return (
      <EmptyRow>Nothing in the activity feed for that filter yet.</EmptyRow>
    )
  }
  return (
    <Panel title="Activity" meta={`${rows.length}`}>
      <Rows>
        {rows.map((row, index) => {
          const via = str(row.source) ?? str(row.via) ?? str(row.channel)
          return (
            <Row key={str(row.id) ?? index} className="items-start">
              <RiHistoryLine
                size={15}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  {str(row.summary) ??
                    str(row.description) ??
                    str(row.action) ??
                    "Change"}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {str(row.actor) ? <span>{str(row.actor)}</span> : null}
                  {formatWhen(row.at ?? row.createdAt ?? row.created_at) ? (
                    <span>
                      {formatWhen(row.at ?? row.createdAt ?? row.created_at)}
                    </span>
                  ) : null}
                  {str(row.entity) ? <span>{str(row.entity)}</span> : null}
                </div>
              </div>
              {via ? <Chip tone="muted">{via}</Chip> : null}
            </Row>
          )
        })}
      </Rows>
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={settingsLink} search={{ tab: "activity" }}>
        Full activity log
      </GoLink>
    </Panel>
  )
}

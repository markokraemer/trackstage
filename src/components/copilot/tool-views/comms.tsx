import type { ReactNode } from "react"
import {
  RiAttachment2,
  RiMailCheckLine,
  RiMailLine,
  RiMailSendLine,
} from "@remixicon/react"

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
  Tile,
  ToolAlert,
  asArray,
  bool,
  formatWhen,
  str,
  strList,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * Email — templates, the outbox and proofs.
 *
 * Email bodies arrive as HTML with `{{placeholders}}` in them. Rendering that
 * HTML inside the chat would be both a styling accident and an injection
 * surface, so every body here is flattened to text and clipped; the full copy
 * lives one link away in Communications.
 */

/** HTML body → a readable one-paragraph preview. */
function preview(html: unknown, max = 160): string | null {
  const text = str(html)
  if (!text) return null
  const flat = text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!flat) return null
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function TemplateCard({
  name,
  templateKey,
  subject,
  body,
  customized,
  children,
}: {
  name: string
  templateKey?: string | null
  subject?: string | null
  body?: unknown
  customized?: boolean | null
  children?: ReactNode
}) {
  const bodyText = preview(body)
  return (
    <Tile className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <RiMailLine
          size={15}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {name}
        </span>
        {templateKey ? (
          <code className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {templateKey}
          </code>
        ) : null}
        <Chip tone={customized ? "default" : "muted"}>
          {customized ? "Customised" : "Default"}
        </Chip>
      </div>
      {subject ? (
        <p className="truncate text-sm text-foreground">{subject}</p>
      ) : null}
      {bodyText ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{bodyText}</p>
      ) : null}
      {children}
    </Tile>
  )
}

// ——— list_templates ——————————————————————————————————————————————————————

export function TemplatesView({ output }: ToolOutputProps) {
  const rows = asArray(output.templates) ?? []
  const variables = strList(output.variables)

  if (rows.length === 0) {
    return <EmptyRow>No email templates on this event.</EmptyRow>
  }

  return (
    <Panel title="Email templates" meta={`${rows.length}`}>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <TemplateCard
            key={str(row.key) ?? index}
            name={str(row.name) ?? str(row.key) ?? "Template"}
            templateKey={str(row.key)}
            subject={str(row.subject)}
            // list_templates ships a 200-char `bodyPreview` (the full body is
            // get_template's job); `body` is kept as a fallback so a captured
            // pre-cap payload still renders.
            body={row.bodyPreview ?? row.body}
            customized={bool(row.customized)}
          />
        ))}
      </div>
      {variables.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Placeholders:</span>
          {variables.map((variable) => (
            <Chip key={variable} tone="muted" className="font-mono">
              {`{{${variable}}}`}
            </Chip>
          ))}
        </div>
      ) : null}
      <MoreLink
        target={{ to: "/app/communications", search: { tab: "templates" } }}
      >
        Open Communications
      </MoreLink>
    </Panel>
  )
}

// ——— update_template —————————————————————————————————————————————————————

export function TemplateUpdatedView({ output }: ToolOutputProps) {
  return (
    <Panel>
      <Banner
        icon={<RiMailCheckLine size={16} />}
        title={`${str(output.name) ?? str(output.key) ?? "Template"} updated`}
      >
        <TemplateCard
          name={str(output.name) ?? "Template"}
          templateKey={str(output.key)}
          subject={str(output.subject)}
          body={output.body}
          customized
        />
        {str(output.note) ? <Note>{str(output.note)}</Note> : null}
        <GoLink to="/app/communications" search={{ tab: "templates" }}>
          Open Communications
        </GoLink>
      </Banner>
    </Panel>
  )
}

// ——— list_outbox —————————————————————————————————————————————————————————

export function OutboxView({ input, output }: ToolOutputProps) {
  const rows = asArray(output.messages) ?? []
  const counts = (output.counts ?? null) as Record<string, unknown> | null
  const requestedStatus =
    typeof input === "object" && input !== null
      ? str((input as Record<string, unknown>).status)
      : null

  if (rows.length === 0) {
    return (
      <EmptyRow>
        Nothing in the outbox
        {requestedStatus ? ` with status “${requestedStatus}”` : ""}.{" "}
        <GoLink to="/app/communications" search={{ tab: "outbox" }}>
          Open the outbox
        </GoLink>
      </EmptyRow>
    )
  }

  return (
    <Panel title="Outbox" meta={`${rows.length} shown`}>
      {counts && Object.keys(counts).length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(counts).map(([status, value]) => (
            <StatusPill
              key={status}
              status={status}
              size="sm"
              label={`${statusLabel(status)} · ${String(value)}`}
            />
          ))}
        </div>
      ) : null}

      <Rows>
        {rows.slice(0, 8).map((row, index) => (
          <Row
            key={`${str(row.to) ?? index}-${index}`}
            className="items-start py-2"
          >
            <RiMailSendLine
              size={15}
              aria-hidden
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-foreground">
                {str(row.subject) ?? "(no subject)"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="truncate">{str(row.to) ?? "—"}</span>
                {str(row.templateKey) ? (
                  <code className="font-mono">{str(row.templateKey)}</code>
                ) : null}
                {str(row.sentAt) ? <span>{formatWhen(row.sentAt)}</span> : null}
                {bool(row.calendarInviteAttached) ? (
                  <span className="inline-flex items-center gap-1">
                    <RiAttachment2 size={12} aria-hidden />
                    invite
                  </span>
                ) : null}
              </div>
              {str(row.error) ? (
                <p className="mt-1 text-xs text-destructive">
                  {str(row.error)}
                </p>
              ) : null}
            </div>
            <StatusPill status={str(row.status) ?? "scheduled"} size="sm" />
          </Row>
        ))}
      </Rows>

      {rows.length > 8 ? (
        <Note>+{rows.length - 8} more in this result.</Note>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}

      <MoreLink
        target={{
          to: "/app/communications",
          search: { tab: "outbox", status: requestedStatus ?? undefined },
        }}
      >
        Open the outbox
      </MoreLink>
    </Panel>
  )
}

// ——— send_test_email —————————————————————————————————————————————————————

export function TestEmailView({ output }: ToolOutputProps) {
  const to = str(output.to)
  if (!to) {
    return <ToolAlert title="The test email had no recipient." />
  }
  return (
    <Banner
      icon={<RiMailCheckLine size={16} />}
      title={`Test email sent to ${to}`}
    >
      <FieldGrid
        entries={[
          { label: "Template", value: str(output.templateKey) ?? "—" },
          { label: "Subject", value: str(output.subject) ?? "—" },
        ]}
      />
      {preview(output.body, 220) ? (
        <p className="rounded-md border border-border bg-card p-2.5 text-xs text-muted-foreground">
          {preview(output.body, 220)}
        </p>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to="/app/communications" search={{ tab: "outbox" }}>
        Check delivery in the outbox
      </GoLink>
    </Banner>
  )
}

// ——— get_template ————————————————————————————————————————————————————————

/**
 * One template, read in full — the escape hatch that lets `list_templates`
 * ship 200-character previews instead of several KB of prose. Reuses the same
 * TemplateCard the list draws, so a template looks identical wherever it is
 * read from.
 */
export function TemplateDetailView({ output }: ToolOutputProps) {
  const customized = bool(output.customized) === true
  return (
    <Panel>
      <TemplateCard
        name={str(output.name) ?? "Template"}
        templateKey={str(output.key)}
        subject={str(output.subject)}
        body={output.body}
        customized={customized}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to="/app/communications" search={{ tab: "templates" }}>
        Open Communications
      </GoLink>
    </Panel>
  )
}

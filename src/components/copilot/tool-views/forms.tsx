import type { ReactNode } from "react"
import {
  RiDeleteBin6Line,
  RiFileList3Line,
  RiQuestionAnswerLine,
} from "@remixicon/react"

import { StatusPill } from "@/components/shared/status-pill"
import {
  Banner,
  Chip,
  DiffRow,
  EmptyRow,
  FieldGrid,
  GoLink,
  LinkRow,
  MoreLink,
  Note,
  OpenLink,
  Panel,
  Row,
  Rows,
  StatRow,
  Tile,
  ToolAlert,
  asArray,
  bool,
  formatDate,
  isRecord,
  num,
  str,
  strList,
  useCopilotEventRef,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import { appLink, legacyAppLink } from "@/lib/app-links"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

/**
 * CFP forms — and the one place where a tool result is genuinely a HANDOFF.
 *
 * "Create a form" ends with a URL the organizer has to paste into a tweet, a
 * Slack channel, a website. So the create/link views lead with the link as a
 * real affordance (monospace, copy, open) and then offer the two next steps:
 * edit the questions in the builder, or look at what a speaker will see.
 */

function kindLabel(kind: unknown): string {
  return str(kind) === "session" ? "Sessions" : "Abstracts"
}

/** The card every form-shaped payload renders as. */
function FormCard({
  name,
  slug,
  kind,
  status,
  closeAt,
  publicUrl,
  formId,
  submissionCount,
  draftCount,
  children,
}: {
  name: string
  slug?: string | null
  kind?: unknown
  status?: string | null
  closeAt?: unknown
  publicUrl?: string | null
  formId?: string | null
  submissionCount?: number | null
  draftCount?: number | null
  children?: ReactNode
}) {
  const eventRef = useCopilotEventRef()
  const formsLink = useSectionLink("forms")
  const editLink = formId
    ? eventRef
      ? appLink.form(eventRef, formId)
      : // The legacy deep path is a real route that redirects with the id kept.
        `${legacyAppLink.forms}/${formId}`
    : formsLink
  return (
    <Tile className="space-y-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <RiFileList3Line
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {name}
            </span>
            <Chip tone="muted">{kindLabel(kind)}</Chip>
            {status ? <StatusPill status={status} size="sm" /> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {slug ? <code className="font-mono">{slug}</code> : null}
            {closeAt ? <span>closes {formatDate(closeAt)}</span> : null}
            {submissionCount !== null && submissionCount !== undefined ? (
              <span className="tabular-nums">
                {submissionCount} submission
                {submissionCount === 1 ? "" : "s"}
                {draftCount ? ` · ${draftCount} draft` : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {publicUrl ? <LinkRow url={publicUrl} openLabel="View" /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {formId ? (
          <GoLink to={editLink}>Edit in form builder</GoLink>
        ) : (
          <GoLink to={formsLink}>Open Forms</GoLink>
        )}
        {publicUrl ? (
          <OpenLink href={publicUrl}>View public form</OpenLink>
        ) : null}
      </div>

      {children}
    </Tile>
  )
}

// ——— list_forms ——————————————————————————————————————————————————————————

export function FormsListView({ output }: ToolOutputProps) {
  const formsLink = useSectionLink("forms")
  const rows = asArray(output.forms) ?? []
  if (rows.length === 0) {
    return (
      <EmptyRow>
        No CFP forms on this event yet — ask me to create one.
      </EmptyRow>
    )
  }
  return (
    <Panel title="CFP forms" meta={`${rows.length}`}>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <FormCard
            key={str(row.formId) ?? index}
            name={str(row.name) ?? str(row.externalTitle) ?? "CFP form"}
            slug={str(row.slug)}
            kind={row.kind}
            status={str(row.status)}
            closeAt={row.closeAt}
            publicUrl={str(row.publicUrl)}
            formId={str(row.formId)}
            submissionCount={num(row.submissionCount)}
            draftCount={num(row.draftCount)}
          />
        ))}
      </div>
      <MoreLink target={{ to: formsLink }}>All forms</MoreLink>
    </Panel>
  )
}

// ——— get_form ————————————————————————————————————————————————————————————

export function FormDetailView({ output }: ToolOutputProps) {
  const questions = asArray(output.questions) ?? []
  const participants = isRecord(output.participantConfig)
    ? output.participantConfig
    : null
  const settings = isRecord(output.settings) ? output.settings : null
  const fields = asArray(participants?.fields) ?? []
  const enabledQuestions = questions.filter((q) => bool(q.enabled) !== false)

  return (
    <Panel>
      <FormCard
        name={str(output.name) ?? str(output.externalTitle) ?? "CFP form"}
        slug={str(output.slug)}
        kind={output.kind}
        status={str(output.status)}
        closeAt={output.closeAt}
        publicUrl={str(output.publicUrl)}
        formId={str(output.formId)}
      >
        <StatRow
          stats={[
            { label: "Questions", value: enabledQuestions.length },
            {
              label: "Speaker fields",
              value: fields.filter((f) => bool(f.enabled) !== false).length,
            },
            ...(num(participants?.speakerMax) !== null
              ? [
                  {
                    label: "Speakers",
                    value: `${num(participants?.speakerMin) ?? 1}–${num(participants?.speakerMax)}`,
                  } as const,
                ]
              : []),
          ]}
        />

        {enabledQuestions.length > 0 ? (
          <Rows>
            {enabledQuestions.slice(0, 10).map((question, index) => {
              const options = strList(question.options)
              return (
                <Row key={str(question.id) ?? index} className="py-2">
                  <RiQuestionAnswerLine
                    size={14}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {str(question.label) ?? str(question.id) ?? "Question"}
                      </span>
                      {bool(question.required) ? (
                        <Chip tone="warn">required</Chip>
                      ) : null}
                      {bool(question.isTrackQuestion) ? (
                        <Chip>routes tracks</Chip>
                      ) : null}
                      {isRecord(question.showIf) ? (
                        <Chip tone="muted">conditional</Chip>
                      ) : null}
                    </div>
                    {options.length > 0 ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {options.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {str(question.type) ?? ""}
                  </span>
                </Row>
              )
            })}
          </Rows>
        ) : null}

        {enabledQuestions.length > 10 ? (
          <Note>
            +{enabledQuestions.length - 10} more question
            {enabledQuestions.length - 10 === 1 ? "" : "s"} — open the builder
            to see them all.
          </Note>
        ) : null}

        {settings ? (
          <FieldGrid
            entries={[
              {
                label: "Drafts",
                value: bool(settings.allowDrafts) ? "Allowed" : "Off",
              },
              {
                label: "Reminders",
                value: bool(settings.sendReminderEmail) ? "On" : "Off",
              },
              ...(num(settings.limitPerUser) !== null
                ? [
                    {
                      label: "Limit",
                      value: `${num(settings.limitPerUser)} per person`,
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </FormCard>
    </Panel>
  )
}

// ——— create_form —————————————————————————————————————————————————————————

export function FormCreatedView({ input, output }: ToolOutputProps) {
  const eventRef = useCopilotEventRef()
  const formsLink = useSectionLink("forms")
  const requested = isRecord(input) ? input : {}
  const name = str(output.name) ?? str(requested.name) ?? "New CFP form"
  const url = str(output.publicUrl)
  const formId = str(output.formId)
  const editLink = formId
    ? eventRef
      ? appLink.form(eventRef, formId)
      : `${legacyAppLink.forms}/${formId}`
    : null

  return (
    <Banner icon={<RiFileList3Line size={16} />} title={`${name} is live`}>
      <p className="text-sm text-muted-foreground">
        The form is open and accepting submissions right now. Share this link:
      </p>
      {url ? <LinkRow url={url} openLabel="Open" /> : null}
      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        {editLink ? <GoLink to={editLink}>Edit in form builder</GoLink> : null}
        {url ? <OpenLink href={url}>View public form</OpenLink> : null}
        <GoLink to={formsLink}>All forms</GoLink>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <StatusPill status={str(output.status) ?? "open"} size="sm" />
        <Chip tone="muted">{kindLabel(requested.kind)}</Chip>
        {str(output.slug) ? (
          <code className="font-mono text-[11px] text-muted-foreground">
            /{str(output.slug)}
          </code>
        ) : null}
      </div>
    </Banner>
  )
}

// ——— update_form_settings ————————————————————————————————————————————————

const SETTING_LABELS: Record<string, string> = {
  status: "Status",
  closeAt: "Close date",
  externalTitle: "Public title",
  limitPerUser: "Limit per person",
  allowDrafts: "Drafts",
  sendReminderEmail: "Reminder emails",
  successMessage: "Success message",
}

function settingValue(key: string, value: unknown): ReactNode {
  if (value === undefined || value === null || value === "") return "not set"
  if (key === "status") return <StatusPill status={String(value)} size="sm" />
  if (typeof value === "boolean") return value ? "On" : "Off"
  if (key === "closeAt") return formatDate(value) ?? String(value)
  if (key === "successMessage") {
    const text = String(value)
      .replace(/<[^>]*>/g, " ")
      .trim()
    return text.length > 60 ? `${text.slice(0, 59)}…` : text
  }
  return String(value)
}

export function FormSettingsUpdatedView({ input, output }: ToolOutputProps) {
  const requested = isRecord(input) ? input : {}
  const previous = isRecord(output.previous) ? output.previous : null
  const settings = isRecord(output.settings) ? output.settings : {}
  const previousSettings = isRecord(previous?.settings) ? previous.settings : {}

  const now: Record<string, unknown> = {
    status: output.status,
    closeAt: output.closeAt,
    ...settings,
  }
  const before: Record<string, unknown> = previous
    ? {
        status: previous.status,
        closeAt: previous.closeAt,
        ...previousSettings,
      }
    : {}

  const changed = Object.keys(requested).filter(
    (key) => key !== "form" && key in SETTING_LABELS
  )

  return (
    <Panel title="Form settings updated">
      {changed.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {changed.map((key) => (
            <div key={key} className="border-b border-border last:border-0">
              <DiffRow
                label={SETTING_LABELS[key]}
                before={
                  previous ? settingValue(key, before[key]) : "previously"
                }
                after={settingValue(key, now[key] ?? requested[key])}
              />
            </div>
          ))}
        </div>
      ) : (
        <Note>Nothing changed.</Note>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={str(output.status) ?? "open"} size="sm" />
        {str(output.closeAt) ? (
          <span className="text-xs text-muted-foreground">
            closes {formatDate(output.closeAt)}
          </span>
        ) : null}
      </div>

      {str(output.publicUrl) ? (
        <LinkRow url={str(output.publicUrl)!} label="Public submission link" />
      ) : null}
    </Panel>
  )
}

// ——— get_public_form_link ————————————————————————————————————————————————

export function PublicFormLinkView({ output }: ToolOutputProps) {
  const url = str(output.publicUrl)
  const accepting = bool(output.acceptingSubmissions)

  if (!url) {
    return <ToolAlert title="That form has no public link yet." />
  }

  return (
    <Panel>
      <Tile className="space-y-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {str(output.name) ?? "CFP form"}
          </span>
          <StatusPill
            status={accepting === false ? "closed" : "open"}
            size="sm"
            label={accepting === false ? "Not accepting" : "Accepting"}
          />
        </div>
        <LinkRow url={url} label="Share this link" />
        {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      </Tile>
    </Panel>
  )
}

// ——— delete_form —————————————————————————————————————————————————————————

/**
 * `delete_form` only ever succeeds on a form that collected nothing (anything
 * with submissions is refused server-side and surfaces as a tool error), so
 * the view can be a plain receipt: which form went, and the one consequence an
 * organizer cares about — the public URL is now dead.
 */
export function FormDeletedView({ output }: ToolOutputProps) {
  const formsLink = useSectionLink("forms")
  return (
    <Banner
      tone="bad"
      icon={<RiDeleteBin6Line size={16} />}
      title={`${str(output.name) ?? "Form"} deleted`}
    >
      <FieldGrid
        entries={[{ label: "Slug", value: str(output.slug) ?? "—" }]}
      />
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={formsLink}>Open Forms</GoLink>
    </Banner>
  )
}

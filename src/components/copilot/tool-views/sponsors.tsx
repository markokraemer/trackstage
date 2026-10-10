import {
  RiBuilding2Line,
  RiDeleteBin6Line,
  RiInputField,
  RiLinkM,
  RiStackLine,
  RiMailSendLine,
  RiSettings3Line,
  RiUserAddLine,
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
  asArray,
  formatWhen,
  isRecord,
  num,
  str,
  strList,
  useSectionLink,
} from "@/components/copilot/tool-views/shared"
import type { ToolOutputProps } from "@/components/copilot/tool-views/registry"

function allowance(used: number, limit: number): string {
  if (limit === 0) return "Added by organizers"
  return `${used} of ${limit} session${limit === 1 ? "" : "s"} added`
}

function SponsorRowView({ sponsor }: { sponsor: Record<string, unknown> }) {
  const name = str(sponsor.name) ?? "Sponsor"
  const used = num(sponsor.sessionsUsed) ?? 0
  const limit = num(sponsor.sessionLimit) ?? 0
  const contacts = asArray(sponsor.contacts) ?? []
  const uninvited = contacts.filter((c) => !str(c.invitedAt)).length
  return (
    <Row>
      <RiBuilding2Line size={15} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {str(sponsor.tier) ? <Chip tone="muted">{str(sponsor.tier)}</Chip> : null}
          {contacts.length === 0 ? <Chip tone="warn">no contact</Chip> : null}
          {contacts.length > 0 && uninvited > 0 ? (
            <Chip tone="warn">{uninvited} not invited</Chip>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {allowance(used, limit)}
          {contacts.length > 0
            ? ` · ${contacts.map((c) => str(c.name) ?? str(c.email)).filter(Boolean).join(", ")}`
            : ""}
        </p>
        {limit > 0 ? (
          <MiniProgress value={(used / limit) * 100} tone={used >= limit ? "good" : "default"} />
        ) : null}
      </div>
    </Row>
  )
}

// ——— list_sponsors ————————————————————————————————————————————————————————

export function SponsorsView({ output }: ToolOutputProps) {
  const link = useSectionLink("sponsors")
  const sponsors = asArray(output.sponsors) ?? []
  const settings = isRecord(output.portalSettings) ? output.portalSettings : {}
  if (sponsors.length === 0) {
    return (
      <Panel>
        <EmptyRow>No sponsors on this event yet.</EmptyRow>
        <GoLink to={link}>Open Sponsors</GoLink>
      </Panel>
    )
  }
  return (
    <Panel title="Sponsors" meta={`${sponsors.length}`}>
      <Rows>
        {sponsors.slice(0, 12).map((sponsor, index) => (
          <SponsorRowView key={str(sponsor.id) ?? index} sponsor={sponsor} />
        ))}
      </Rows>
      <Note>
        New sponsor sessions start as{" "}
        {str(settings.newSessionStatus) === "accepted" ? "Accepted" : "Pending"}
        {str(settings.closeAt) ? ` · closes ${formatWhen(settings.closeAt) ?? ""}` : " · no deadline"}
      </Note>
      <GoLink to={link}>Open Sponsors</GoLink>
    </Panel>
  )
}

// ——— manage_sponsor ———————————————————————————————————————————————————————

export function SponsorSavedView({ output }: ToolOutputProps) {
  const link = useSectionLink("sponsors")
  if (output.deleted === true) {
    return (
      <Banner icon={<RiDeleteBin6Line size={16} />} tone="neutral" title={`${str(output.name) ?? "Sponsor"} removed`}>
        <Note>
          {str(output.note) ??
            "Its sessions stay on the program; its contacts just lost the sponsor link."}
        </Note>
      </Banner>
    )
  }
  const sponsor = isRecord(output.sponsor) ? output.sponsor : output
  return (
    <Panel>
      <Banner
        icon={<RiBuilding2Line size={16} />}
        title={`${str(sponsor.name) ?? "Sponsor"} ${output.created === true ? "added" : "saved"}`}
      >
        <FieldGrid
          entries={[
            { label: "Tier", value: str(sponsor.tier) ?? "—" },
            {
              label: "Sessions",
              value: allowance(num(sponsor.sessionsUsed) ?? 0, num(sponsor.sessionLimit) ?? 0),
            },
          ]}
        />
      </Banner>
      <GoLink to={link}>Open Sponsors</GoLink>
    </Panel>
  )
}

// ——— manage_sponsor_contact ———————————————————————————————————————————————

export function SponsorContactView({ output }: ToolOutputProps) {
  const removed = output.removed === true
  return (
    <Banner
      icon={removed ? <RiDeleteBin6Line size={16} /> : <RiUserAddLine size={16} />}
      tone={removed ? "neutral" : "good"}
      title={
        removed
          ? `${str(output.email) ?? "Contact"} removed from the sponsor`
          : output.created === false
            ? "Existing person linked as a sponsor contact"
            : "Sponsor contact added"
      }
    >
      {!removed ? (
        <div className="flex flex-wrap gap-1">
          <Chip tone={output.invited === true ? "default" : "warn"}>
            {output.invited === true ? "invite sent" : "not invited yet"}
          </Chip>
        </div>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
    </Banner>
  )
}

// ——— invite_sponsor_contacts —————————————————————————————————————————————

export function SponsorInvitesView({ output }: ToolOutputProps) {
  const commsLink = useSectionLink("communications")
  const recipients = strList(output.recipients)
  const queued = num(output.queued) ?? recipients.length
  return (
    <Banner
      icon={<RiMailSendLine size={16} />}
      title={`Sponsor portal invite queued for ${queued} contact${queued === 1 ? "" : "s"}`}
    >
      {recipients.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {recipients.slice(0, 8).map((email) => (
            <Chip key={email} tone="muted">
              {email}
            </Chip>
          ))}
        </div>
      ) : null}
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
      <GoLink to={commsLink}>Open the outbox</GoLink>
    </Banner>
  )
}

// ——— manage_sponsor_tier ——————————————————————————————————————————————————

export function SponsorTierView({ output }: ToolOutputProps) {
  const name = str(output.name) ?? "Tier"
  const deleted = output.deleted === true
  return (
    <Banner
      icon={deleted ? <RiDeleteBin6Line size={16} /> : <RiStackLine size={16} />}
      tone={deleted ? "neutral" : "good"}
      title={deleted ? `${name} tier removed` : output.created === true ? `${name} tier added` : `${name} tier saved`}
    >
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
    </Banner>
  )
}

// ——— manage_sponsor_field ——————————————————————————————————————————————————

export function SponsorFieldView({ output }: ToolOutputProps) {
  const label = str(output.label) ?? "Field"
  const deleted = output.deleted === true
  return (
    <Banner
      icon={deleted ? <RiDeleteBin6Line size={16} /> : <RiInputField size={16} />}
      tone={deleted ? "neutral" : "good"}
      title={
        deleted
          ? `“${label}” field removed`
          : output.created === true
            ? `“${label}” field added to every sponsor`
            : `“${label}” field saved`
      }
    >
      {str(output.note) ? <Note>{str(output.note)}</Note> : null}
    </Banner>
  )
}

// ——— set_session_sponsor ——————————————————————————————————————————————————

export function SessionSponsorView({ output }: ToolOutputProps) {
  const sponsor = str(output.sponsor)
  return (
    <Banner
      icon={<RiLinkM size={16} />}
      tone={sponsor ? "good" : "neutral"}
      title={
        sponsor
          ? `“${str(output.title) ?? "Session"}” linked to ${sponsor}`
          : `Sponsor link removed from “${str(output.title) ?? "the session"}”`
      }
    >
      {sponsor ? <Note>Every {sponsor} contact can now see and edit it in their portal.</Note> : null}
    </Banner>
  )
}

// ——— update_sponsor_portal_settings ———————————————————————————————————————

export function SponsorPortalSettingsView({ output }: ToolOutputProps) {
  return (
    <Banner icon={<RiSettings3Line size={16} />} title="Sponsor portal settings saved">
      <FieldGrid
        entries={[
          {
            label: "New sessions",
            value: str(output.newSessionStatus) === "accepted" ? "Accepted" : "Pending review",
          },
          { label: "Deadline", value: formatWhen(output.closeAt) ?? "None" },
          {
            label: "Colleague invites",
            value: output.allowColleagueInvites === false ? "Organizers only" : "Allowed",
          },
        ]}
      />
    </Banner>
  )
}

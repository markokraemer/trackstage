import * as React from "react"
import { Link } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import {
  RiDeleteBin6Line,
  RiExternalLinkLine,
  RiLinkM,
  RiMailSendLine,
  RiUserAddLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsCount, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { portalLinkFor } from "@/components/dashboard/app-routes"
import { copyText } from "@/lib/clipboard"
import { errorMessage } from "@/lib/errors"
import type { EventRef } from "@/lib/app-links"
import { appLink } from "@/lib/app-links"
import { AllowanceMeter } from "@/components/sponsors/allowance-meter"

export type SponsorRow = FunctionReturnType<typeof api.sponsors.list>["sponsors"][number]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type DrawerTab = "details" | "contacts" | "sessions"

/**
 * One sponsor, end to end: its package (name, tier, how many sessions it may
 * add itself), the people who can sign into its portal, and the sessions it
 * has. `sponsor === null` ⇒ the create flow, which asks for the first contact
 * too — a sponsor nobody can log in for is a sponsor that adds nothing.
 */
export function SponsorDrawer({
  eventId,
  eventRef,
  sponsor,
  tiers,
  open,
  onOpenChange,
  onCreated,
  onDelete,
}: {
  eventId: Id<"events">
  eventRef: EventRef | undefined
  sponsor: SponsorRow | null
  /** Tiers already used on this event — offered as suggestions. */
  tiers: Array<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (sponsorId: Id<"sponsors">) => void
  onDelete?: (sponsor: SponsorRow) => void
}) {
  const [tab, setTab] = React.useState<DrawerTab>("details")
  React.useEffect(() => {
    if (open) setTab("details")
  }, [open, sponsor?._id])

  const isCreate = sponsor === null
  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={isCreate ? "Add a sponsor" : sponsor.name}
      description={
        isCreate
          ? "A company with a package on your event. Its contacts get a portal where they add their sessions themselves — no call for papers."
          : [sponsor.tier, `${sponsor.contacts.length} contact${sponsor.contacts.length === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" · ")
      }
      tabs={
        isCreate ? undefined : (
          <Tabs value={tab} onValueChange={(value) => setTab(value as DrawerTab)}>
            <TabsList variant="line" className="h-auto">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="contacts">
                Contacts
                <TabsCount>{sponsor.contacts.length}</TabsCount>
              </TabsTrigger>
              <TabsTrigger value="sessions">
                Sessions
                <TabsCount>{sponsor.sessions.length}</TabsCount>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )
      }
    >
      {isCreate ? (
        <CreateSponsorForm
          eventId={eventId}
          tiers={tiers}
          onDone={(id) => {
            onOpenChange(false)
            onCreated?.(id)
          }}
          onCancel={() => onOpenChange(false)}
        />
      ) : tab === "details" ? (
        <SponsorDetailsForm
          key={sponsor._id}
          sponsor={sponsor}
          tiers={tiers}
          onDelete={onDelete ? () => onDelete(sponsor) : undefined}
        />
      ) : tab === "contacts" ? (
        <SponsorContacts sponsor={sponsor} />
      ) : (
        <SponsorSessions sponsor={sponsor} eventRef={eventRef} />
      )}
    </DrawerShell>
  )
}

// ——— Shared package fields —————————————————————————————————————————————

interface PackageValues {
  name: string
  tier: string
  websiteUrl: string
  sessionLimit: string
  notes: string
}

function PackageFields({
  values,
  onChange,
  tiers,
  showErrors,
  idPrefix,
}: {
  values: PackageValues
  onChange: (patch: Partial<PackageValues>) => void
  tiers: Array<string>
  showErrors: boolean
  idPrefix: string
}) {
  const limit = Number(values.sessionLimit)
  const limitInvalid =
    values.sessionLimit.trim() === "" || !Number.isInteger(limit) || limit < 0 || limit > 50
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>
          Company name<span className="required-asterisk">*</span>
        </FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Acme AI"
          aria-invalid={showErrors && !values.name.trim() ? true : undefined}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-tier`}>Tier</FieldLabel>
          <Input
            id={`${idPrefix}-tier`}
            name="tier"
            list={`${idPrefix}-tiers`}
            value={values.tier}
            onChange={(e) => onChange({ tier: e.target.value })}
            placeholder="Platinum"
          />
          <datalist id={`${idPrefix}-tiers`}>
            {tiers.map((tier) => (
              <option key={tier} value={tier} />
            ))}
          </datalist>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-limit`}>
            Sessions included<span className="required-asterisk">*</span>
          </FieldLabel>
          <Input
            id={`${idPrefix}-limit`}
            name="sessionLimit"
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            step={1}
            value={values.sessionLimit}
            onChange={(e) => onChange({ sessionLimit: e.target.value })}
            aria-invalid={showErrors && limitInvalid ? true : undefined}
          />
        </Field>
      </div>
      <FieldDescription className="-mt-3">
        Sessions included is how many their contacts can add from the portal.
        Use 0 if you'll add their sessions yourself.
      </FieldDescription>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-website`}>Website</FieldLabel>
        <Input
          id={`${idPrefix}-website`}
          name="websiteUrl"
          type="url"
          value={values.websiteUrl}
          onChange={(e) => onChange({ websiteUrl: e.target.value })}
          placeholder="https://acme.ai"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-notes`}>Internal notes</FieldLabel>
        <FieldDescription>Only your team sees these.</FieldDescription>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Contract signed 3 Aug — keynote slot promised on day 1."
        />
      </Field>
    </>
  )
}

function packageValid(values: PackageValues): boolean {
  const limit = Number(values.sessionLimit)
  return (
    values.name.trim() !== "" &&
    values.sessionLimit.trim() !== "" &&
    Number.isInteger(limit) &&
    limit >= 0 &&
    limit <= 50
  )
}

// ——— Create ————————————————————————————————————————————————————————————————

function CreateSponsorForm({
  eventId,
  tiers,
  onDone,
  onCancel,
}: {
  eventId: Id<"events">
  tiers: Array<string>
  onDone: (sponsorId: Id<"sponsors">) => void
  onCancel: () => void
}) {
  const create = useConvexMutation(api.sponsors.create)
  const sendInvites = useConvexMutation(api.sponsors.sendInvites)
  const [values, setValues] = React.useState<PackageValues>({
    name: "",
    tier: "",
    websiteUrl: "",
    sessionLimit: "1",
    notes: "",
  })
  const [contact, setContact] = React.useState({ firstName: "", lastName: "", email: "" })
  const [invite, setInvite] = React.useState(true)
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const hasContact = contact.email.trim() !== ""
  const contactInvalid = hasContact && !EMAIL_PATTERN.test(contact.email.trim())

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!packageValid(values) || contactInvalid) {
      setShowErrors(true)
      toast.error(
        contactInvalid ? "That contact email doesn't look right" : "Add a name and a session allowance (0–50)",
      )
      return
    }
    setSaving(true)
    try {
      const sponsorId = await create({
        eventId,
        name: values.name.trim(),
        tier: values.tier.trim() || undefined,
        websiteUrl: values.websiteUrl.trim() || undefined,
        sessionLimit: Number(values.sessionLimit),
        notes: values.notes.trim() || undefined,
        contacts: hasContact
          ? [
              {
                email: contact.email.trim(),
                firstName: contact.firstName.trim() || undefined,
                lastName: contact.lastName.trim() || undefined,
              },
            ]
          : [],
      })
      if (hasContact && invite) {
        await sendInvites({ sponsorId })
      }
      toast.success(`${values.name.trim()} added`, {
        description: hasContact
          ? invite
            ? `${contact.email.trim()} has been emailed their sponsor portal link.`
            : "Send their portal invite from the Contacts tab when you're ready."
          : "Add a contact so someone can sign in and add sessions.",
      })
      onDone(sponsorId)
    } catch (error) {
      toast.error("Couldn't add the sponsor", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-6">
      <FieldGroup className="gap-5">
        <PackageFields
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          tiers={tiers}
          showErrors={showErrors}
          idPrefix="new-sponsor"
        />
        <FieldSeparator>Main contact</FieldSeparator>
        <FieldDescription className="-mt-2">
          The person who signs into the sponsor portal. You can add colleagues
          later — and so can they.
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="new-sponsor-first">First name</FieldLabel>
            <Input
              id="new-sponsor-first"
              value={contact.firstName}
              onChange={(e) => setContact((c) => ({ ...c, firstName: e.target.value }))}
              placeholder="Grace"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-sponsor-last">Last name</FieldLabel>
            <Input
              id="new-sponsor-last"
              value={contact.lastName}
              onChange={(e) => setContact((c) => ({ ...c, lastName: e.target.value }))}
              placeholder="Hopper"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="new-sponsor-email">Email address</FieldLabel>
          <Input
            id="new-sponsor-email"
            type="email"
            value={contact.email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            placeholder="grace@acme.ai"
            aria-invalid={showErrors && contactInvalid ? true : undefined}
          />
        </Field>
        {hasContact ? (
          <Field orientation="horizontal">
            <Checkbox
              id="new-sponsor-invite"
              checked={invite}
              onCheckedChange={(value) => setInvite(value === true)}
            />
            <FieldLabel htmlFor="new-sponsor-invite" className="font-normal">
              Email them their sponsor portal link now
            </FieldLabel>
          </Field>
        ) : null}
      </FieldGroup>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add sponsor"}
        </Button>
      </div>
    </form>
  )
}

// ——— Details ———————————————————————————————————————————————————————————————

function SponsorDetailsForm({
  sponsor,
  tiers,
  onDelete,
}: {
  sponsor: SponsorRow
  tiers: Array<string>
  onDelete?: () => void
}) {
  const update = useConvexMutation(api.sponsors.update)
  const initial: PackageValues = {
    name: sponsor.name,
    tier: sponsor.tier ?? "",
    websiteUrl: sponsor.websiteUrl ?? "",
    sessionLimit: String(sponsor.sessionLimit),
    notes: sponsor.notes ?? "",
  }
  const [values, setValues] = React.useState<PackageValues>(initial)
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const dirty = (Object.keys(initial) as Array<keyof PackageValues>).some(
    (key) => initial[key] !== values[key],
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!packageValid(values)) {
      setShowErrors(true)
      toast.error("Add a name and a session allowance (0–50)")
      return
    }
    setSaving(true)
    try {
      await update({
        sponsorId: sponsor._id,
        name: values.name.trim(),
        // Empty strings clear the optional fields server-side.
        tier: values.tier.trim(),
        websiteUrl: values.websiteUrl.trim(),
        notes: values.notes.trim(),
        sessionLimit: Number(values.sessionLimit),
      })
      toast.success("Sponsor saved")
    } catch (error) {
      toast.error("Couldn't save the sponsor", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-6">
      <AllowanceMeter used={sponsor.sessionsUsed} limit={sponsor.sessionLimit} />
      <FieldGroup className="gap-5">
        <PackageFields
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          tiers={tiers}
          showErrors={showErrors}
          idPrefix={`sponsor-${sponsor._id}`}
        />
      </FieldGroup>
      <div className="flex items-center gap-2 border-t pt-4">
        {onDelete ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete}>
            <RiDeleteBin6Line aria-hidden />
            Remove sponsor
          </Button>
        ) : null}
        <Button type="submit" className="ml-auto" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

// ——— Contacts ——————————————————————————————————————————————————————————————

function formatInvited(ms: number | null): string {
  if (!ms) return "Not invited yet"
  return `Invited ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(ms)}`
}

function SponsorContacts({ sponsor }: { sponsor: SponsorRow }) {
  const addContact = useConvexMutation(api.sponsors.addContact)
  const removeContact = useConvexMutation(api.sponsors.removeContact)
  const sendInvites = useConvexMutation(api.sponsors.sendInvites)
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "" })
  const [invite, setInvite] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      toast.error("Enter a valid email address")
      return
    }
    setBusy("add")
    try {
      const result = await addContact({
        sponsorId: sponsor._id,
        email: form.email.trim(),
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        sendInvite: invite,
      })
      toast.success(
        result.created ? `${form.email.trim()} added` : `${form.email.trim()} linked to ${sponsor.name}`,
        { description: result.invited ? "Their portal invite is on its way." : undefined },
      )
      setForm({ firstName: "", lastName: "", email: "" })
    } catch (error) {
      toast.error("Couldn't add the contact", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setBusy(null)
    }
  }

  async function inviteOne(personId: Id<"people">, email: string) {
    setBusy(personId)
    try {
      await sendInvites({ sponsorId: sponsor._id, personIds: [personId] })
      toast.success(`Portal invite sent to ${email}`)
    } catch (error) {
      toast.error("Couldn't send the invite", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setBusy(null)
    }
  }

  async function remove(personId: Id<"people">, name: string) {
    setBusy(personId)
    try {
      await removeContact({ personId })
      toast.success(`${name} removed from ${sponsor.name}`, {
        description: "They keep any sessions they speak on, but lose the sponsor tab in their portal.",
      })
    } catch (error) {
      toast.error("Couldn't remove the contact", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setBusy(null)
    }
  }

  async function copyLink(token: string, name: string) {
    const url = portalLinkFor(token)
    if (await copyText(url)) {
      toast.success(`Portal link for ${name} copied`, { description: url })
    } else {
      toast.error("Couldn't copy automatically", { description: url })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {sponsor.contacts.length === 0 ? (
        <EmptyState
          icon={RiUserAddLine}
          title="No contacts yet"
          description="Contacts sign into the sponsor portal to add sessions. Add the person who handles this sponsorship."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {sponsor.contacts.map((contact) => (
            <li key={contact.personId} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{contact.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {contact.email} · {formatInvited(contact.invitedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === contact.personId}
                  onClick={() => void inviteOne(contact.personId, contact.email)}
                >
                  <RiMailSendLine aria-hidden />
                  {contact.invitedAt ? "Resend invite" : "Send invite"}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Copy portal link for ${contact.name}`}
                  onClick={() => void copyLink(contact.portalToken, contact.name)}
                >
                  <RiLinkM aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Open ${contact.name}'s portal`}
                  nativeButton={false}
                  render={
                    <a href={`/portal/t/${contact.portalToken}`} target="_blank" rel="noreferrer" />
                  }
                >
                  <RiExternalLinkLine aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${contact.name} from ${sponsor.name}`}
                  disabled={busy === contact.personId}
                  onClick={() => void remove(contact.personId, contact.name)}
                >
                  <RiDeleteBin6Line aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void add(e)} className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">Add a contact</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contact-first">First name</FieldLabel>
            <Input
              id="contact-first"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-last">Last name</FieldLabel>
            <Input
              id="contact-last"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="contact-email">
            Email address<span className="required-asterisk">*</span>
          </FieldLabel>
          <Input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="name@company.com"
            required
          />
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="contact-invite"
            checked={invite}
            onCheckedChange={(value) => setInvite(value === true)}
          />
          <FieldLabel htmlFor="contact-invite" className="font-normal">
            Email them their portal link now
          </FieldLabel>
        </Field>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy === "add"}>
            <RiUserAddLine aria-hidden />
            {busy === "add" ? "Adding…" : "Add contact"}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ——— Sessions ——————————————————————————————————————————————————————————————

function SponsorSessions({
  sponsor,
  eventRef,
}: {
  sponsor: SponsorRow
  eventRef: EventRef | undefined
}) {
  return (
    <div className="flex flex-col gap-4">
      <AllowanceMeter used={sponsor.sessionsUsed} limit={sponsor.sessionLimit} />
      {sponsor.sessions.length === 0 ? (
        <EmptyState
          icon={RiUserAddLine}
          title="No sessions yet"
          description="Sessions this sponsor's contacts add from their portal appear here. You can also link an existing session from its Submissions drawer."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {sponsor.sessions.map((session) => (
            <li key={session._id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                {eventRef ? (
                  <Link
                    to={appLink.submissions(eventRef)}
                    search={{ id: String(session._id) } as never}
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {session.title}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {session.scheduled ? "On the agenda" : "Not scheduled yet"}
                </p>
              </div>
              <StatusPill status={session.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

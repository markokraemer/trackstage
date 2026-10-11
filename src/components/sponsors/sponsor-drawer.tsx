import * as React from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiBuilding2Line,
  RiCalendarEventLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiHistoryLine,
  RiLinkM,
  RiMailSendLine,
  RiMoreLine,
  RiStarLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusPill } from "@/components/shared/status-pill"
import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { sponsorPortalLinkFor } from "@/components/dashboard/app-routes"
import { initialsOf } from "@/components/dashboard/format"
import { absoluteDate, relativeDate } from "@/components/submissions/constants"
import { AllowanceMeter } from "@/components/sponsors/allowance-meter"
import { SponsorLogoUploader } from "@/components/sponsors/sponsor-logo-uploader"
import {
  CompanyFieldInputs,
  changedFieldValues,
  fieldValueMap,
} from "@/components/sponsors/company-field-inputs"
import type { CompanyField } from "@/components/sponsors/company-field-inputs"
import { copyText } from "@/lib/clipboard"
import { errorMessage } from "@/lib/errors"
import type { EventRef } from "@/lib/app-links"
import { appLink } from "@/lib/app-links"
import { useCurrentEvent } from "@/lib/current-event"

export type SponsorRow = FunctionReturnType<typeof api.sponsors.list>["sponsors"][number]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_TIER = "__none__"
const MAX_DESCRIPTION = 600

/** Drawer tabs — real values so the page can deep-link into one. */
export type SponsorDrawerTab = "details" | "contacts" | "sessions" | "history"

/**
 * One sponsor, end to end, in the same slide-over the rest of the app uses
 * (the submission drawer is the reference): segmented tabs with icons, every
 * action in the footer, a status strip at the top of Details. `sponsor ===
 * null` is the create flow, which asks for the first contact too — a sponsor
 * nobody can sign in for is a sponsor that never adds a session.
 */
export function SponsorDrawer({
  eventId,
  eventRef,
  sponsor,
  tiers,
  open,
  onOpenChange,
  initialTab = "details",
  onCreated,
  onDelete,
}: {
  eventId: Id<"events">
  eventRef: EventRef | undefined
  sponsor: SponsorRow | null
  /** The event's managed tiers, in order. */
  tiers: Array<SponsorTier>
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: SponsorDrawerTab
  onCreated?: (sponsorId: Id<"sponsors">) => void
  onDelete?: (sponsor: SponsorRow) => void
}) {
  if (sponsor === null) {
    return (
      <CreateSponsorDrawer
        eventId={eventId}
        tiers={tiers}
        open={open}
        onOpenChange={onOpenChange}
        onCreated={onCreated}
      />
    )
  }
  return (
    <EditSponsorDrawer
      key={sponsor._id}
      eventId={eventId}
      eventRef={eventRef}
      sponsor={sponsor}
      tiers={tiers}
      open={open}
      onOpenChange={onOpenChange}
      initialTab={initialTab}
      onDelete={onDelete}
    />
  )
}

// ——— Shared: the package + profile fields ———————————————————————————————

/** A managed tier (Settings → Fields & options → Sponsor tiers). */
export interface SponsorTier {
  _id: Id<"sponsorTiers">
  name: string
  sessionLimit: number
}

/** "Manage tiers" / "Manage fields": where the event-wide sponsor setup lives. */
function SettingsLink({ hash, children }: { hash: string; children: React.ReactNode }) {
  const { eventRef } = useCurrentEvent()
  if (!eventRef) return null
  return (
    <Link
      to={appLink.settingsSection(eventRef, "fields-and-options")}
      hash={hash}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  )
}

interface PackageValues {
  name: string
  tier: string
  sessionLimit: string
  websiteUrl: string
  description: string
  notes: string
}

function packageProblem(values: PackageValues): string | null {
  if (!values.name.trim()) return "Give the sponsor a name."
  const limit = Number(values.sessionLimit)
  if (values.sessionLimit.trim() === "" || !Number.isInteger(limit) || limit < 0 || limit > 50) {
    return "Sessions included must be a whole number from 0 to 50."
  }
  if (values.description.length > MAX_DESCRIPTION) {
    return `Keep the description under ${MAX_DESCRIPTION} characters.`
  }
  return null
}

/** Tier picker: the managed list, plus a legacy free-text tier if one is set. */
function TierSelect({
  id,
  value,
  tiers,
  onChange,
}: {
  id: string
  value: string
  tiers: Array<SponsorTier>
  onChange: (tier: string, sessionLimit: number | null) => void
}) {
  const items = [
    { value: NO_TIER, label: "No tier" },
    ...tiers.map((t) => ({ value: t.name, label: t.name })),
    ...(value && !tiers.some((t) => t.name === value) ? [{ value, label: value }] : []),
  ]
  return (
    <Select
      items={items}
      value={value || NO_TIER}
      onValueChange={(next) => {
        const name = next === NO_TIER ? "" : String(next)
        onChange(name, tiers.find((t) => t.name === name)?.sessionLimit ?? null)
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PackageFields({
  values,
  onChange,
  tiers,
  showErrors,
  idPrefix,
  withProfile,
  companyFields = [],
  fieldValues = {},
  onFieldChange,
}: {
  values: PackageValues
  onChange: (patch: Partial<PackageValues>) => void
  tiers: Array<SponsorTier>
  showErrors: boolean
  idPrefix: string
  /** Show the public profile fields (description + links). */
  withProfile: boolean
  /** The event's own company fields (Settings → Fields & options). */
  companyFields?: Array<CompanyField>
  fieldValues?: Record<string, string>
  onFieldChange?: (fieldId: string, value: string) => void
}) {
  const limit = Number(values.sessionLimit)
  const limitInvalid =
    values.sessionLimit.trim() === "" || !Number.isInteger(limit) || limit < 0 || limit > 50
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>
          Company name
          <span className="required-asterisk" aria-hidden>
            *
          </span>
          <span className="sr-only">(required)</span>
        </FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Acme AI"
          aria-invalid={showErrors && !values.name.trim() ? true : undefined}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-tier`}>Tier</FieldLabel>
          <TierSelect
            id={`${idPrefix}-tier`}
            value={values.tier}
            tiers={tiers}
            onChange={(tier, sessionLimit) =>
              onChange({
                tier,
                // The package decides what's included — pre-fill it.
                ...(sessionLimit !== null ? { sessionLimit: String(sessionLimit) } : {}),
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-limit`}>
            Sessions included
            <span className="required-asterisk" aria-hidden>
              *
            </span>
            <span className="sr-only">(required)</span>
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
        Sessions included is how many their contacts can add from the sponsor portal — 0 if
        you add them yourself.{" "}
        <SettingsLink hash="sponsor-tiers">
          {tiers.length === 0 ? "Set up tiers" : "Manage tiers"}
        </SettingsLink>
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
      {withProfile ? (
        <>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-description`}>Description</FieldLabel>
            <Textarea
              id={`${idPrefix}-description`}
              rows={3}
              value={values.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="One or two sentences for the sponsor wall on your event site."
              aria-invalid={values.description.length > MAX_DESCRIPTION ? true : undefined}
            />
            <FieldDescription className="flex justify-between gap-2">
              <span>Shown on the event site. The sponsor can edit it from their portal too.</span>
              <span className="shrink-0 tabular-nums">
                {values.description.length} / {MAX_DESCRIPTION}
              </span>
            </FieldDescription>
          </Field>
          {onFieldChange ? (
            <>
              <CompanyFieldInputs
                fields={companyFields}
                values={fieldValues}
                onChange={onFieldChange}
                idPrefix={idPrefix}
              />
              <p className="-mt-3 text-xs text-muted-foreground">
                {companyFields.length === 0
                  ? "Need a LinkedIn, booth number or anything else from every sponsor? "
                  : "These fields are the same for every sponsor. "}
                <SettingsLink hash="sponsor-fields">
                  {companyFields.length === 0 ? "Add company fields" : "Manage fields"}
                </SettingsLink>
              </p>
            </>
          ) : null}
        </>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-notes`}>Internal notes</FieldLabel>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Contract signed 3 Aug — keynote slot promised on day 1."
        />
        <FieldDescription>Only your team sees these.</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

/** The bordered switch card the submission drawer uses for "Show on public schedule". */
function ToggleCard({
  id,
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  icon: typeof RiMailSendLine
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
      <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** "Still needed" chips — amber for the sponsor's to-dos, gray for yours. */
export function StillNeededChips({
  items,
  max = 4,
}: {
  items: SponsorRow["stillNeeded"]
  max?: number
}) {
  if (items.length === 0) {
    return (
      <Badge
        variant="secondary"
        className="h-5 gap-1 rounded-full bg-status-green-bg px-2 text-[11px] text-status-green-fg"
      >
        <RiCheckboxCircleLine size={12} aria-hidden />
        All set
      </Badge>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.slice(0, max).map((item) => (
        <Badge
          key={item.key}
          variant="secondary"
          title={item.owner === "organizer" ? "Waiting on your team" : "Waiting on the sponsor"}
          className={cn(
            "h-5 max-w-[180px] truncate rounded-full px-2 text-[11px]",
            item.owner === "organizer"
              ? "bg-muted text-muted-foreground"
              : "bg-status-amber-bg text-status-amber-fg",
          )}
        >
          {item.label}
        </Badge>
      ))}
      {items.length > max ? (
        <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px]">
          +{items.length - max}
        </Badge>
      ) : null}
    </div>
  )
}

// ——— Create ————————————————————————————————————————————————————————————————

function CreateSponsorDrawer({
  eventId,
  tiers,
  open,
  onOpenChange,
  onCreated,
}: {
  eventId: Id<"events">
  tiers: Array<SponsorTier>
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (sponsorId: Id<"sponsors">) => void
}) {
  const create = useConvexMutation(api.sponsors.create)
  const sendInvites = useConvexMutation(api.sponsors.sendInvites)
  const blank = (): PackageValues => ({
    name: "",
    tier: tiers.at(0)?.name ?? "",
    sessionLimit: String(tiers.at(0)?.sessionLimit ?? 1),
    websiteUrl: "",
    description: "",
    notes: "",
  })
  const [values, setValues] = React.useState<PackageValues>(blank)
  const [contact, setContact] = React.useState({ firstName: "", lastName: "", email: "" })
  const [invite, setInvite] = React.useState(true)
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setValues(blank())
    setContact({ firstName: "", lastName: "", email: "" })
    setInvite(true)
    setShowErrors(false)
  }, [open])

  const hasContact = contact.email.trim() !== ""
  const contactInvalid = hasContact && !EMAIL_PATTERN.test(contact.email.trim())

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    const problem = packageProblem(values) ?? (contactInvalid ? "That contact email doesn't look right." : null)
    if (problem) {
      setShowErrors(true)
      toast.error(problem)
      return
    }
    setSaving(true)
    try {
      const name = values.name.trim()
      const sponsorId = await create({
        eventId,
        name,
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
      if (hasContact && invite) await sendInvites({ sponsorId })
      toast.success(`${name} added`, {
        description: hasContact
          ? invite
            ? `${contact.email.trim()} has been emailed their sponsor portal link.`
            : "Send their portal invite from the Contacts tab when you're ready."
          : "Add a contact so someone can sign in and add sessions.",
      })
      onCreated?.(sponsorId)
    } catch (error) {
      toast.error(errorMessage(error, "Could not add the sponsor."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add a sponsor"
      description="A company with a package on your event. Its contacts get a portal where they add their sessions and keep their company profile up to date."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="create-sponsor" disabled={saving}>
            {saving ? "Adding…" : "Add sponsor"}
          </Button>
        </>
      }
    >
      <form id="create-sponsor" onSubmit={(e) => void submit(e)} noValidate>
        <PackageFields
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          tiers={tiers}
          showErrors={showErrors}
          idPrefix="new-sponsor"
          withProfile={false}
        />

        <Separator className="my-6" />

        <SectionHeading
          title="Main contact"
          description="The person who signs into the sponsor portal. They'll add the logo, description and sessions themselves — and can bring colleagues."
        />
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
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
            <FieldLabel htmlFor="new-sponsor-email">Email</FieldLabel>
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
            <ToggleCard
              id="new-sponsor-invite"
              icon={RiMailSendLine}
              title="Email their portal link now"
              description={
                invite
                  ? "They get the Sponsor portal invite (Communications → Templates) with a link that signs them straight in."
                  : "Nothing is sent. Invite them from the Contacts tab whenever you're ready."
              }
              checked={invite}
              onCheckedChange={setInvite}
            />
          ) : null}
        </FieldGroup>
      </form>
    </DrawerShell>
  )
}

// ——— Edit ——————————————————————————————————————————————————————————————————

function valuesOf(sponsor: SponsorRow): PackageValues {
  return {
    name: sponsor.name,
    tier: sponsor.tier ?? "",
    sessionLimit: String(sponsor.sessionLimit),
    websiteUrl: sponsor.websiteUrl ?? "",
    description: sponsor.description ?? "",
    notes: sponsor.notes ?? "",
  }
}

function EditSponsorDrawer({
  eventId,
  eventRef,
  sponsor,
  tiers,
  open,
  onOpenChange,
  initialTab,
  onDelete,
}: {
  eventId: Id<"events">
  eventRef: EventRef | undefined
  sponsor: SponsorRow
  tiers: Array<SponsorTier>
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab: SponsorDrawerTab
  onDelete?: (sponsor: SponsorRow) => void
}) {
  const update = useConvexMutation(api.sponsors.update)
  const setLogo = useConvexMutation(api.sponsors.setLogo)
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const [tab, setTab] = React.useState<SponsorDrawerTab>(initialTab)
  React.useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  const saved = valuesOf(sponsor)
  const [values, setValues] = React.useState<PackageValues>(saved)
  const [publicVisible, setPublicVisible] = React.useState(sponsor.publicVisible)
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const savedFields = fieldValueMap(sponsor.fields)
  const [fieldDraft, setFieldDraft] = React.useState<Record<string, string>>(savedFields)
  const changedFields = changedFieldValues(savedFields, fieldDraft)
  const dirty =
    (Object.keys(saved) as Array<keyof PackageValues>).some((key) => saved[key] !== values[key]) ||
    Object.keys(changedFields).length > 0

  async function save() {
    const problem = packageProblem(values)
    if (problem) {
      setShowErrors(true)
      toast.error(problem)
      return
    }
    setSaving(true)
    try {
      // Empty strings clear the optional fields server-side.
      await update({
        sponsorId: sponsor._id,
        name: values.name.trim(),
        tier: values.tier.trim(),
        sessionLimit: Number(values.sessionLimit),
        websiteUrl: values.websiteUrl.trim(),
        fields: changedFields,
        description: values.description.trim(),
        notes: values.notes.trim(),
      })
      toast.success("Sponsor updated.")
    } catch (error) {
      toast.error(errorMessage(error, "Could not save your changes."))
    } finally {
      setSaving(false)
    }
  }

  /** Visibility saves on flip — the submission drawer's rule for its own switch. */
  async function flipVisibility(next: boolean) {
    setPublicVisible(next)
    try {
      await update({ sponsorId: sponsor._id, publicVisible: next })
      toast.success(next ? "Showing on the event site." : "Hidden from the event site.")
    } catch (error) {
      setPublicVisible(!next)
      toast.error(errorMessage(error, "Could not change the visibility."))
    }
  }

  const sponsorTodo = sponsor.stillNeeded.filter((item) => item.owner === "sponsor").length

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as SponsorDrawerTab)} className="contents">
      <DrawerShell
        open={open}
        onOpenChange={onOpenChange}
        title={<span className="min-w-0 truncate">{sponsor.name}</span>}
        description={`${sponsor.tier ? `${sponsor.tier} sponsor` : "Sponsor"} · Added ${relativeDate(sponsor._creationTime)}`}
        tabs={
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">
              <RiBuilding2Line aria-hidden />
              Details
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <RiTeamLine aria-hidden />
              People
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <RiCalendarEventLine aria-hidden />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="history">
              <RiHistoryLine aria-hidden />
              History
            </TabsTrigger>
          </TabsList>
        }
        footer={
          <>
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(sponsor)}
              >
                <RiDeleteBin6Line aria-hidden />
                Remove
              </Button>
            ) : null}
            <span className="flex-1" />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <TabsContent value="details">
          {/* The status strip — same surface as the submission drawer's. */}
          <div className="mb-5 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <AllowanceMeter
                used={sponsor.sessionsUsed}
                limit={sponsor.sessionLimit}
                className="max-w-56 flex-1"
              />
              <span className="ml-auto text-xs text-muted-foreground">
                {sponsorTodo === 0
                  ? "Nothing outstanding from them"
                  : `${sponsorTodo} thing${sponsorTodo === 1 ? "" : "s"} still to come from them`}
              </span>
            </div>
            {sponsor.stillNeeded.length > 0 ? <StillNeededChips items={sponsor.stillNeeded} max={6} /> : null}
          </div>

          <div className="mb-5">
            <ToggleCard
              id={`sponsor-visible-${sponsor._id}`}
              icon={publicVisible ? RiEyeLine : RiEyeOffLine}
              title="Show on the event site"
              description={
                publicVisible
                  ? "On the sponsor wall and next to their sessions once your program is published."
                  : "Hidden everywhere public — keep it off until the announcement."
              }
              checked={publicVisible}
              onCheckedChange={(next) => void flipVisibility(next)}
            />
          </div>

          <SectionHeading title="Logo" description="Shown on the sponsor wall and next to their sessions." />
          <SponsorLogoUploader
            className="mb-6"
            logoUrl={sponsor.logoUrl}
            name={sponsor.name}
            getUploadUrl={() => generateUploadUrl({ eventId })}
            onSave={async (storageId, filename) => {
              await setLogo({
                sponsorId: sponsor._id,
                storageId: storageId as Id<"_storage"> | null,
                filename,
              })
            }}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (dirty) void save()
            }}
            noValidate
          >
            <PackageFields
              values={values}
              onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
              tiers={tiers}
              showErrors={showErrors}
              idPrefix={`sponsor-${sponsor._id}`}
              withProfile
              companyFields={sponsor.fields}
              fieldValues={fieldDraft}
              onFieldChange={(fieldId, value) => setFieldDraft((prev) => ({ ...prev, [fieldId]: value }))}
            />
          </form>

          <Separator className="my-6" />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <MetaRow label="Added" value={absoluteDate(sponsor._creationTime)} />
            <MetaRow
              label="Sessions"
              value={
                sponsor.sessionLimit === 0
                  ? "Added by your team"
                  : `${sponsor.sessionsUsed} of ${sponsor.sessionLimit} used`
              }
            />
            <MetaRow
              label="Primary contact"
              value={sponsor.contacts.find((c) => c.isPrimary)?.name ?? "—"}
            />
            <MetaRow label="Contacts" value={String(sponsor.contacts.length)} />
          </dl>
        </TabsContent>

        <TabsContent value="contacts">
          <SponsorContacts sponsor={sponsor} />
        </TabsContent>

        <TabsContent value="sessions">
          <SponsorSessions sponsor={sponsor} eventRef={eventRef} />
        </TabsContent>

        <TabsContent value="history">
          <SponsorHistory sponsor={sponsor} active={tab === "history"} />
        </TabsContent>
      </DrawerShell>
    </Tabs>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="truncate text-sm text-foreground">{value}</dd>
    </div>
  )
}

// ——— Contacts ——————————————————————————————————————————————————————————————

function SponsorContacts({ sponsor }: { sponsor: SponsorRow }) {
  const addContact = useConvexMutation(api.sponsors.addContact)
  const removeContact = useConvexMutation(api.sponsors.removeContact)
  const setPrimary = useConvexMutation(api.sponsors.setPrimaryContact)
  const sendInvites = useConvexMutation(api.sponsors.sendInvites)
  const [adding, setAdding] = React.useState(false)
  const [form, setForm] = React.useState({ firstName: "", lastName: "", email: "" })
  const [invite, setInvite] = React.useState(true)
  /** Person id (or "add" / "all") currently being changed. */
  const [busy, setBusy] = React.useState<string | null>(null)

  function resetForm() {
    setForm({ firstName: "", lastName: "", email: "" })
    setInvite(true)
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      toast.error("An email address is required")
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
      toast.success(`${form.firstName.trim() || form.email.trim()} added to ${sponsor.name}`, {
        description: result.invited
          ? "Their sponsor portal invite is on its way."
          : result.created
            ? "Not emailed yet — send the invite from their row."
            : "They were already on this event — same person, same portal.",
      })
      resetForm()
      setAdding(false)
    } catch (error) {
      toast.error("Couldn't add them", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(null)
    }
  }

  async function inviteSome(personIds: Array<Id<"people">> | undefined, key: string) {
    setBusy(key)
    try {
      const result = await sendInvites({ sponsorId: sponsor._id, personIds })
      toast.success(
        result.queued === 1
          ? `Portal invite sent to ${result.recipients[0]}`
          : `Portal invites sent to ${result.queued} contacts`,
      )
    } catch (error) {
      toast.error("Couldn't send the invite", { description: errorMessage(error, "Please try again.") })
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
      toast.error("Couldn't remove them", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(null)
    }
  }

  async function copyLink(token: string, name: string) {
    const url = sponsorPortalLinkFor(token)
    if (await copyText(url)) {
      toast.success(`Portal link for ${name} copied`, { description: url })
    } else {
      toast.error("Couldn't copy automatically", { description: url })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sponsor.contacts.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={RiTeamLine}
          title="No contacts yet"
          description="Contacts sign into the sponsor portal to add sessions. Add the person who handles this sponsorship — they get a portal straight away."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sponsor.contacts.map((contact) => (
            <li
              key={contact.personId}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">{initialsOf(contact.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  <span className="truncate">{contact.name}</span>
                  {contact.isPrimary ? (
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">Primary</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {contact.invitedAt ? `Invited ${relativeDate(contact.invitedAt)}` : "Not invited yet"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === contact.personId}
                title={
                  contact.invitedAt
                    ? `Last invited ${relativeDate(contact.invitedAt)}`
                    : "They haven't been sent their portal link yet"
                }
                onClick={() => void inviteSome([contact.personId], contact.personId)}
              >
                <RiMailSendLine aria-hidden />
                {contact.invitedAt ? "Resend" : "Send invite"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label={`More for ${contact.name}`} />
                  }
                >
                  <RiMoreLine aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {contact.isPrimary ? null : (
                    <DropdownMenuItem
                      onClick={() =>
                        void setPrimary({ sponsorId: sponsor._id, personId: contact.personId }).then(
                          () => toast.success(`${contact.name} is now the primary contact`),
                          (error: unknown) => toast.error(errorMessage(error, "Could not change it.")),
                        )
                      }
                    >
                      <RiStarLine aria-hidden />
                      Make primary contact
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => void copyLink(contact.portalToken, contact.name)}>
                    <RiLinkM aria-hidden />
                    Copy portal link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<a href={`/sponsor/t/${contact.portalToken}`} target="_blank" rel="noreferrer" />}
                  >
                    <RiExternalLinkLine aria-hidden />
                    Open their portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={busy === contact.personId}
                    onClick={() => void remove(contact.personId, contact.name)}
                  >
                    <RiCloseLine aria-hidden />
                    Remove from {sponsor.name}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(e) => void add(e)}
          className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4"
        >
          <p className="text-sm font-medium text-foreground">Add a contact to {sponsor.name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contact-first">First name</FieldLabel>
              <Input
                id="contact-first"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Grace"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contact-last">Last name</FieldLabel>
              <Input
                id="contact-last"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Hopper"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="contact-email">
              Email<span className="required-asterisk">*</span>
            </FieldLabel>
            <FieldDescription>
              If they're already on this event we'll link that person — same portal, no duplicate.
            </FieldDescription>
            <Input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="grace@acme.ai"
              required
            />
          </Field>
          <ToggleCard
            id="contact-invite"
            icon={RiMailSendLine}
            title="Email their portal link now"
            description="They get a link that signs them straight into the sponsor portal."
            checked={invite}
            onCheckedChange={setInvite}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy === "add"}
              onClick={() => {
                setAdding(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy === "add"}>
              <RiUserAddLine aria-hidden />
              {busy === "add" ? "Adding…" : "Add contact"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setAdding(true)}>
            <RiAddLine aria-hidden />
            Add a contact
          </Button>
          {sponsor.contacts.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy === "all"}
              onClick={() => void inviteSome(undefined, "all")}
            >
              <RiMailSendLine aria-hidden />
              Email everyone their link
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ——— Sessions ——————————————————————————————————————————————————————————————

function SponsorSessions({ sponsor, eventRef }: { sponsor: SponsorRow; eventRef: EventRef | undefined }) {
  const submissionsPath = eventRef ? appLink.submissions(eventRef) : null
  return (
    <div className="flex flex-col gap-4">
      {sponsor.sessions.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={RiCalendarEventLine}
          title="No sessions yet"
          description="Sessions this sponsor's contacts add from their portal appear here. To link one you already have, open it in Submissions and pick the sponsor."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sponsor.sessions.map((session) => (
            <li
              key={session._id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{session.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.kind === "session" ? "Session" : "Abstract"} ·{" "}
                  {session.scheduled ? "On the agenda" : "Not scheduled yet"}
                </p>
              </div>
              <StatusPill status={session.status} />
              {submissionsPath ? (
                <Link
                  to={submissionsPath as never}
                  search={{ id: String(session._id) } as never}
                  aria-label={`Open ${session.title} in Submissions`}
                  title="Open in Submissions"
                  className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                >
                  <RiArrowRightUpLine aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Withdrawn and declined sessions don't count toward the {sponsor.sessionLimit}-session
        allowance, so the sponsor can propose another.
      </p>
    </div>
  )
}

// ——— History ——————————————————————————————————————————————————————————————

function SponsorHistory({ sponsor, active }: { sponsor: SponsorRow; active: boolean }) {
  const { data: rows, isPending } = useQuery(
    convexQuery(
      api.audit.forEntity,
      active ? { eventId: sponsor.eventId, entity: "sponsor", entityId: sponsor._id } : "skip",
    ),
  )
  if (isPending || !rows) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    )
  }
  return (
    <ActivityTimeline
      rows={rows}
      emptyState={
        <EmptyState
          variant="plain"
          icon={RiHistoryLine}
          title="Nothing has happened yet"
          description="Package changes, contacts added or removed, and anything an AI agent or the API does to this sponsor appear here with who did it and when."
        />
      }
    />
  )
}

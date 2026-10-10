import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiCloseLine,
  RiMailSendLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { DateTimePicker } from "@/components/settings/date-time-picker"
import { errorMessage } from "@/lib/errors"

export interface SponsorPortalRules {
  newSessionStatus: "pending" | "accepted"
  closeAt: number | null
  allowColleagueInvites: boolean
}

export interface SponsorTier {
  _id: Id<"sponsorTiers">
  name: string
  sessionLimit: number
}

export interface SponsorFieldDef {
  _id: Id<"sponsorFields">
  label: string
  kind: "text" | "longText" | "url"
  public: boolean
}

const FIELD_KINDS = [
  { value: "text", label: "Short text" },
  { value: "longText", label: "Long text" },
  { value: "url", label: "Link" },
] as const

const STATUS_CHOICES: Array<{ value: SponsorPortalRules["newSessionStatus"]; title: string; body: string }> = [
  {
    value: "pending",
    title: "Pending — you review them first",
    body: "Sponsor sessions land in Submissions as Pending, like any proposal.",
  },
  {
    value: "accepted",
    title: "Accepted — straight onto the program",
    body: "For packages that guarantee a slot: they go to the agenda's unscheduled tray.",
  },
]

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/**
 * Sponsor settings — everything event-wide about sponsors, in the same
 * slide-over every other settings-ish panel uses: the TIERS (packages, in the
 * order the sponsor wall shows them, each with the sessions it includes) and
 * the sponsor PORTAL rules. Tiers save as you go; portal rules with Save.
 */
export function SponsorSettingsDrawer({
  eventId,
  timezone,
  rules,
  tiers,
  fields,
  open,
  onOpenChange,
}: {
  eventId: Id<"events">
  timezone: string
  rules: SponsorPortalRules
  tiers: Array<SponsorTier>
  fields: Array<SponsorFieldDef>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveRules = useConvexMutation(api.sponsors.updatePortalRules)
  const [status, setStatus] = React.useState(rules.newSessionStatus)
  const [closeAt, setCloseAt] = React.useState<number | undefined>(rules.closeAt ?? undefined)
  const [invites, setInvites] = React.useState(rules.allowColleagueInvites)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setStatus(rules.newSessionStatus)
    setCloseAt(rules.closeAt ?? undefined)
    setInvites(rules.allowColleagueInvites)
  }, [open, rules.newSessionStatus, rules.closeAt, rules.allowColleagueInvites])

  const dirty =
    status !== rules.newSessionStatus ||
    (closeAt ?? null) !== rules.closeAt ||
    invites !== rules.allowColleagueInvites

  async function save() {
    setSaving(true)
    try {
      await saveRules({ eventId, newSessionStatus: status, closeAt: closeAt ?? null, allowColleagueInvites: invites })
      toast.success("Sponsor portal settings saved")
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the settings."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Sponsor settings"
      description="Your sponsorship packages, the fields you collect from sponsors, and how the sponsor portal behaves — for every sponsor on this event."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Section
          title="Tiers"
          description="Your packages, most prominent first — the order sponsors appear on the event site. Picking a tier pre-fills how many sessions a sponsor can add."
        >
          <TierList eventId={eventId} tiers={tiers} />
        </Section>

        <Separator />

        <Section
          title="Company fields"
          description="What you collect about every sponsor beyond logo, website and description — LinkedIn, booth number, industry. Sponsors fill them in from their portal; public ones appear on the sponsor wall."
        >
          <FieldList eventId={eventId} fields={fields} />
        </Section>

        <Separator />

        <Section
          title="Sponsor portal"
          description="Saved with “Save changes” below."
        >
          <Field>
            <FieldLabel>New sponsor sessions start as</FieldLabel>
            <RadioGroup
              value={status}
              onValueChange={(value) => setStatus(value === "accepted" ? "accepted" : "pending")}
              aria-label="New sponsor sessions start as"
              className="gap-2"
            >
              {STATUS_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  htmlFor={`sponsor-status-${choice.value}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
                >
                  <RadioGroupItem id={`sponsor-status-${choice.value}`} value={choice.value} className="mt-0.5" />
                  <span className="text-sm">
                    <span className="block font-medium text-foreground">{choice.title}</span>
                    <span className="block text-muted-foreground">{choice.body}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="sponsor-close-at">Sponsors can add and edit sessions until</FieldLabel>
            <FieldDescription>
              Leave empty to keep it open. After this, the portal shows their sessions read-only.
            </FieldDescription>
            <DateTimePicker
              id="sponsor-close-at"
              value={closeAt}
              onChange={setCloseAt}
              timezone={timezone}
              placeholder="No deadline"
            />
          </Field>

          <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
            <RiMailSendLine size={18} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <label htmlFor="sponsor-colleagues" className="text-sm font-medium text-foreground">
                Contacts can invite colleagues
              </label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {invites
                  ? "A sponsor can bring a teammate into their portal themselves."
                  : "Only your team adds sponsor contacts."}
              </p>
            </div>
            <Switch id="sponsor-colleagues" checked={invites} onCheckedChange={setInvites} />
          </div>
        </Section>
      </div>
    </DrawerShell>
  )
}

/** Tier rows: rename / sessions on blur, move up/down, remove, add. */
function TierList({ eventId, tiers }: { eventId: Id<"events">; tiers: Array<SponsorTier> }) {
  const saveTier = useConvexMutation(api.sponsors.saveTier)
  const removeTier = useConvexMutation(api.sponsors.removeTier)
  const reorder = useConvexMutation(api.sponsors.reorderTiers)
  const [draft, setDraft] = React.useState({ name: "", sessionLimit: "1" })

  async function persist(tier: SponsorTier, patch: { name?: string; sessionLimit?: number }) {
    const name = (patch.name ?? tier.name).trim()
    const sessionLimit = patch.sessionLimit ?? tier.sessionLimit
    if (name === tier.name && sessionLimit === tier.sessionLimit) return
    try {
      await saveTier({ eventId, tierId: tier._id, name, sessionLimit })
      toast.success(name !== tier.name ? `Renamed to ${name} — its sponsors moved with it` : "Tier saved")
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the tier."))
    }
  }

  async function move(index: number, delta: number) {
    const ids = tiers.map((t) => t._id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    try {
      await reorder({ eventId, tierIds: ids })
    } catch (error) {
      toast.error(errorMessage(error, "Could not reorder."))
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    const limit = Number(draft.sessionLimit)
    if (!draft.name.trim()) {
      toast.error("Give the tier a name")
      return
    }
    if (!Number.isInteger(limit) || limit < 0 || limit > 50) {
      toast.error("Sessions included must be 0–50")
      return
    }
    try {
      await saveTier({ eventId, name: draft.name.trim(), sessionLimit: limit })
      setDraft({ name: "", sessionLimit: "1" })
    } catch (error) {
      toast.error(errorMessage(error, "Could not add the tier."))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {tiers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No tiers yet. Add your packages — Platinum, Gold, Community partner.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tiers.map((tier, index) => (
            <li key={tier._id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{index + 1}</span>
              <Input
                key={`${tier._id}-${tier.name}`}
                aria-label="Tier name"
                defaultValue={tier.name}
                onBlur={(e) => void persist(tier, { name: e.target.value })}
                className="h-8 min-w-0 flex-1"
              />
              <Input
                key={`${tier._id}-${tier.sessionLimit}`}
                aria-label={`Sessions included in ${tier.name}`}
                title="Sessions included"
                type="number"
                min={0}
                max={50}
                defaultValue={tier.sessionLimit}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (Number.isInteger(value) && value >= 0 && value <= 50) {
                    void persist(tier, { sessionLimit: value })
                  }
                }}
                className="h-8 w-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${tier.name} up`}
                disabled={index === 0}
                onClick={() => void move(index, -1)}
              >
                <RiArrowUpLine aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${tier.name} down`}
                disabled={index === tiers.length - 1}
                onClick={() => void move(index, 1)}
              >
                <RiArrowDownLine aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${tier.name}`}
                onClick={() =>
                  void removeTier({ tierId: tier._id }).then(
                    () => toast.success(`${tier.name} removed — its sponsors are now untiered`),
                    (error: unknown) => toast.error(errorMessage(error, "Could not remove the tier.")),
                  )
                }
              >
                <RiCloseLine aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void add(e)} className="flex items-end gap-2">
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="new-tier-name" className="text-xs">
            New tier
          </FieldLabel>
          <Input
            id="new-tier-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Silver"
            className="h-8"
          />
        </Field>
        <Field className="w-24">
          <FieldLabel htmlFor="new-tier-sessions" className="text-xs">
            Sessions
          </FieldLabel>
          <Input
            id="new-tier-sessions"
            type="number"
            min={0}
            max={50}
            value={draft.sessionLimit}
            onChange={(e) => setDraft((d) => ({ ...d, sessionLimit: e.target.value }))}
            className="h-8"
          />
        </Field>
        <Button type="submit" variant="outline" size="sm">
          <RiAddLine aria-hidden />
          Add
        </Button>
      </form>
    </div>
  )
}

/** Company field rows: label on blur, kind + visibility instantly, reorder, remove, add. */
function FieldList({ eventId, fields }: { eventId: Id<"events">; fields: Array<SponsorFieldDef> }) {
  const saveField = useConvexMutation(api.sponsors.saveField)
  const removeField = useConvexMutation(api.sponsors.removeField)
  const reorder = useConvexMutation(api.sponsors.reorderFields)
  const [draft, setDraft] = React.useState<{ label: string; kind: SponsorFieldDef["kind"] }>({
    label: "",
    kind: "url",
  })

  async function persist(field: SponsorFieldDef, patch: Partial<Omit<SponsorFieldDef, "_id">>) {
    const next = { ...field, ...patch, label: (patch.label ?? field.label).trim() }
    if (next.label === field.label && next.kind === field.kind && next.public === field.public) return
    try {
      await saveField({ eventId, fieldId: field._id, label: next.label, kind: next.kind, public: next.public })
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the field."))
    }
  }

  async function move(index: number, delta: number) {
    const ids = fields.map((f) => f._id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    try {
      await reorder({ eventId, fieldIds: ids })
    } catch (error) {
      toast.error(errorMessage(error, "Could not reorder."))
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.label.trim()) {
      toast.error("Give the field a label")
      return
    }
    try {
      await saveField({ eventId, label: draft.label.trim(), kind: draft.kind, public: draft.kind === "url" })
      setDraft({ label: "", kind: "url" })
    } catch (error) {
      toast.error(errorMessage(error, "Could not add the field."))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No extra fields. Add one for anything you need from every sponsor.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <li key={field._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
              <Input
                key={`${field._id}-${field.label}`}
                aria-label="Field label"
                defaultValue={field.label}
                onBlur={(e) => void persist(field, { label: e.target.value })}
                className="h-8 min-w-0 flex-1"
              />
              <Select
                items={FIELD_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                value={field.kind}
                onValueChange={(value) => void persist(field, { kind: value as SponsorFieldDef["kind"] })}
              >
                <SelectTrigger size="sm" aria-label={`Type of ${field.label}`} className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Shown on the sponsor wall">
                <Switch
                  size="sm"
                  checked={field.public}
                  onCheckedChange={(value) => void persist(field, { public: value })}
                  aria-label={`Show ${field.label} on the event site`}
                />
                Public
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${field.label} up`}
                disabled={index === 0}
                onClick={() => void move(index, -1)}
              >
                <RiArrowUpLine aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${field.label} down`}
                disabled={index === fields.length - 1}
                onClick={() => void move(index, 1)}
              >
                <RiArrowDownLine aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${field.label}`}
                onClick={() =>
                  void removeField({ fieldId: field._id }).then(
                    () => toast.success(`${field.label} removed from every sponsor`),
                    (error: unknown) => toast.error(errorMessage(error, "Could not remove the field.")),
                  )
                }
              >
                <RiCloseLine aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void add(e)} className="flex items-end gap-2">
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="new-field-label" className="text-xs">
            New field
          </FieldLabel>
          <Input
            id="new-field-label"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            placeholder="LinkedIn"
            className="h-8"
          />
        </Field>
        <Field className="w-32">
          <FieldLabel htmlFor="new-field-kind" className="text-xs">
            Type
          </FieldLabel>
          <Select
            items={FIELD_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            value={draft.kind}
            onValueChange={(value) => setDraft((d) => ({ ...d, kind: value as SponsorFieldDef["kind"] }))}
          >
            <SelectTrigger id="new-field-kind" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button type="submit" variant="outline" size="sm">
          <RiAddLine aria-hidden />
          Add
        </Button>
      </form>
    </div>
  )
}

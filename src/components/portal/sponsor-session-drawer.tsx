import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiLockLine,
  RiUserAddLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { StatusPill } from "@/components/shared/status-pill"
import { errorMessage } from "@/lib/errors"
import { usePortal } from "./portal-context"
import type { PortalSubmission } from "./portal-context"

/** Mirrors convex/portal.ts DURATIONS — the server refuses anything else. */
const DURATIONS = [10, 15, 20, 25, 30, 40, 45, 50, 60, 90, 120] as const
const DURATION_ITEMS = DURATIONS.map((m) => ({ value: String(m), label: `${m} minutes` }))
const NO_FORMAT = "__none__"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SpeakerDraft {
  key: number
  firstName: string
  lastName: string
  email: string
}

let nextKey = 1
function blankSpeaker(): SpeakerDraft {
  return { key: nextKey++, firstName: "", lastName: "", email: "" }
}

function FormatAndLength({
  format,
  onFormat,
  duration,
  onDuration,
  formats,
  idPrefix,
  disabled,
}: {
  format: string
  onFormat: (value: string) => void
  duration: string
  onDuration: (value: string) => void
  formats: Array<string>
  idPrefix: string
  disabled?: boolean
}) {
  const formatItems = [
    { value: NO_FORMAT, label: "Not sure yet" },
    ...formats.map((f) => ({ value: f, label: f })),
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {formats.length > 0 ? (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-format`}>Format</FieldLabel>
          <Select
            items={formatItems}
            value={format || NO_FORMAT}
            onValueChange={(value) => onFormat(value === NO_FORMAT ? "" : String(value))}
            disabled={disabled}
          >
            <SelectTrigger id={`${idPrefix}-format`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formatItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-duration`}>Length</FieldLabel>
        <Select
          items={DURATION_ITEMS}
          value={duration}
          onValueChange={(value) => onDuration(String(value))}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-duration`} className="w-full">
            <SelectValue placeholder="Pick a length" />
          </SelectTrigger>
          <SelectContent>
            {DURATION_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

function SpeakerRow({
  speaker,
  index,
  onChange,
  onRemove,
}: {
  speaker: SpeakerDraft
  index: number
  onChange: (patch: Partial<SpeakerDraft>) => void
  onRemove?: () => void
}) {
  const id = `speaker-${speaker.key}`
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium text-foreground">Speaker {index + 1}</legend>
        {onRemove ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Remove speaker ${index + 1}`}
            onClick={onRemove}
          >
            <RiCloseLine aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-first`}>
            First name<span className="required-asterisk">*</span>
          </FieldLabel>
          <Input
            id={`${id}-first`}
            value={speaker.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-last`}>Last name</FieldLabel>
          <Input
            id={`${id}-last`}
            value={speaker.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-email`}>
          Email<span className="required-asterisk">*</span>
        </FieldLabel>
        <Input
          id={`${id}-email`}
          type="email"
          value={speaker.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="name@company.com"
        />
      </Field>
    </fieldset>
  )
}

function speakerProblem(speakers: Array<SpeakerDraft>): string | null {
  for (const s of speakers) {
    const blank = !s.firstName.trim() && !s.lastName.trim() && !s.email.trim()
    if (blank) continue
    if (!s.firstName.trim()) return "Every speaker needs a first name."
    if (!EMAIL_PATTERN.test(s.email.trim())) return `"${s.email.trim() || "(empty)"}" isn't a valid email.`
  }
  return null
}

// ——— Add ——————————————————————————————————————————————————————————————————

/**
 * "Add a session" for a sponsor contact — the whole point of the sponsor
 * portal. Everything the organizer needs to place it on the agenda, nothing
 * a CFP would ask a stranger: title, description, format, length, speakers.
 */
export function AddSponsorSessionDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { portalToken, home } = usePortal()
  const sponsor = home.sponsor
  const add = useConvexMutation(api.portal.addSponsorSession)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [format, setFormat] = React.useState("")
  const [duration, setDuration] = React.useState("30")
  const [includeMe, setIncludeMe] = React.useState(true)
  const [speakers, setSpeakers] = React.useState<Array<SpeakerDraft>>([])
  const [showErrors, setShowErrors] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setFormat("")
    setDuration("30")
    setIncludeMe(true)
    setSpeakers([])
    setShowErrors(false)
  }, [open])

  if (!sponsor) return null

  const filled = speakers.filter((s) => s.firstName.trim() || s.lastName.trim() || s.email.trim())
  const problem = speakerProblem(speakers)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !description.trim()) {
      setShowErrors(true)
      toast.error("Add a title and a description")
      return
    }
    if (problem) {
      toast.error(problem)
      return
    }
    if (!includeMe && filled.length === 0) {
      toast.error("Add at least one speaker — or tick “I'm presenting this session”.")
      return
    }
    setSaving(true)
    try {
      await add({
        portalToken,
        title: title.trim(),
        description: description.trim(),
        format: format || undefined,
        durationMinutes: Number(duration),
        includeMe,
        speakers: filled.map((s) => ({
          firstName: s.firstName.trim(),
          lastName: s.lastName.trim(),
          email: s.email.trim(),
        })),
      })
      toast.success("Session added", {
        description:
          sponsor?.newSessionStatus === "accepted"
            ? "It's on the program — the organizers will give it a time and room."
            : "The organizers will review it and let you know.",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error("Couldn't add the session", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add a session"
      description={`For ${sponsor.name}. ${
        sponsor.newSessionStatus === "accepted"
          ? "It goes straight onto the program; the organizers set the time and room."
          : "The organizers review it before it goes on the program."
      }`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="add-sponsor-session" disabled={saving}>
            {saving ? "Adding…" : "Add session"}
          </Button>
        </>
      }
    >
      <form id="add-sponsor-session" onSubmit={(e) => void submit(e)}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="sponsor-session-title">
              Session title<span className="required-asterisk">*</span>
            </FieldLabel>
            <Input
              id="sponsor-session-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Shipping agents to production with Acme"
              aria-invalid={showErrors && !title.trim() ? true : undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="sponsor-session-description">
              Description<span className="required-asterisk">*</span>
            </FieldLabel>
            <FieldDescription>What attendees read on the agenda — two or three sentences.</FieldDescription>
            <Textarea
              id="sponsor-session-description"
              name="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={showErrors && !description.trim() ? true : undefined}
            />
          </Field>
          <FormatAndLength
            format={format}
            onFormat={setFormat}
            duration={duration}
            onDuration={setDuration}
            formats={sponsor.formatOptions}
            idPrefix="sponsor-session"
          />

          <Separator className="my-1" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Speakers</h3>
            <p className="text-xs text-muted-foreground">
              Who presents it. Each speaker gets their own portal for their bio and photo.
            </p>
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="sponsor-session-me"
              checked={includeMe}
              onCheckedChange={(value) => setIncludeMe(value === true)}
            />
            <FieldLabel htmlFor="sponsor-session-me" className="font-normal">
              I'm presenting this session
            </FieldLabel>
          </Field>
          {speakers.map((speaker, index) => (
            <SpeakerRow
              key={speaker.key}
              speaker={speaker}
              index={index + (includeMe ? 1 : 0)}
              onChange={(patch) =>
                setSpeakers((prev) => prev.map((s) => (s.key === speaker.key ? { ...s, ...patch } : s)))
              }
              onRemove={() => setSpeakers((prev) => prev.filter((s) => s.key !== speaker.key))}
            />
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSpeakers((prev) => [...prev, blankSpeaker()])}
            >
              <RiUserAddLine aria-hidden />
              {includeMe || speakers.length > 0 ? "Add another speaker" : "Add a speaker"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </DrawerShell>
  )
}

// ——— Manage ———————————————————————————————————————————————————————————————

export function ManageSponsorSessionDrawer({
  session,
  open,
  onOpenChange,
}: {
  session: PortalSubmission
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { portalToken, home } = usePortal()
  const update = useConvexMutation(api.portal.updateSponsorSession)
  const addSpeaker = useConvexMutation(api.portal.addSponsorSessionSpeaker)
  const removeSpeaker = useConvexMutation(api.portal.removeSponsorSessionSpeaker)
  const withdraw = useConvexMutation(api.portal.withdrawSubmission)
  const [title, setTitle] = React.useState(session.title)
  const [description, setDescription] = React.useState(session.description ?? "")
  const [format, setFormat] = React.useState(session.format ?? "")
  const [duration, setDuration] = React.useState(String(session.durationMinutes ?? 30))
  const [newSpeaker, setNewSpeaker] = React.useState<SpeakerDraft>(blankSpeaker)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [confirmWithdraw, setConfirmWithdraw] = React.useState(false)

  const locked = session.editLock
  const formats = home.sponsor?.formatOptions ?? []
  const dirty =
    title !== session.title ||
    description !== (session.description ?? "") ||
    format !== (session.format ?? "") ||
    duration !== String(session.durationMinutes ?? 30)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !description.trim()) {
      toast.error("A session needs a title and a description")
      return
    }
    setBusy("save")
    try {
      await update({
        portalToken,
        submissionId: session.id,
        patch: {
          title: title.trim(),
          description: description.trim(),
          format,
          durationMinutes: Number(duration),
        },
      })
      toast.success("Session saved")
    } catch (error) {
      toast.error("Couldn't save the session", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(null)
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault()
    const problem = speakerProblem([newSpeaker])
    if (problem || !newSpeaker.email.trim()) {
      toast.error(problem ?? "Add the speaker's name and email")
      return
    }
    setBusy("add")
    try {
      await addSpeaker({
        portalToken,
        submissionId: session.id,
        speaker: {
          firstName: newSpeaker.firstName.trim(),
          lastName: newSpeaker.lastName.trim(),
          email: newSpeaker.email.trim(),
        },
      })
      toast.success(`${newSpeaker.firstName.trim()} added to the session`)
      setNewSpeaker(blankSpeaker())
    } catch (error) {
      toast.error("Couldn't add the speaker", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(null)
    }
  }

  async function remove(personId: string, name: string) {
    setBusy(personId)
    try {
      await removeSpeaker({
        portalToken,
        submissionId: session.id,
        personId: personId as Id<"people">,
      })
      toast.success(`${name} removed from the session`)
    } catch (error) {
      toast.error("Couldn't remove the speaker", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(null)
    }
  }

  async function doWithdraw() {
    setBusy("withdraw")
    try {
      await withdraw({ portalToken, submissionId: session.id })
      toast.success("Session withdrawn", {
        description: "Its slot in your package is free again.",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error("Couldn't withdraw the session", { description: errorMessage(error, "Please try again.") })
    } finally {
      setBusy(null)
      setConfirmWithdraw(false)
    }
  }

  const canWithdraw = !locked && session.status !== "accepted"

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={session.title}
      description={
        <span className="inline-flex items-center gap-2">
          <StatusPill status={session.status} size="sm" />
          {session.scheduled ? "On the agenda" : "Time and room set by the organizers"}
        </span>
      }
      footer={
        locked ? undefined : (
          <>
            {canWithdraw ? (
              confirmWithdraw ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto"
                  disabled={busy === "withdraw"}
                  onClick={() => void doWithdraw()}
                >
                  {busy === "withdraw" ? "Withdrawing…" : "Yes, withdraw it"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-auto text-destructive"
                  onClick={() => setConfirmWithdraw(true)}
                >
                  <RiDeleteBin6Line aria-hidden />
                  Withdraw
                </Button>
              )
            ) : null}
            <Button type="submit" form="manage-sponsor-session" disabled={busy === "save" || !dirty}>
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {locked ? (
          <Alert>
            <RiLockLine aria-hidden />
            <AlertTitle>{locked.title}</AlertTitle>
            <AlertDescription>{locked.message}</AlertDescription>
          </Alert>
        ) : session.status === "accepted" ? (
          <p className="text-sm text-muted-foreground">
            This session is accepted. You can still polish the wording and speakers; to
            withdraw it, email the organizers.
          </p>
        ) : null}

        <form id="manage-sponsor-session" onSubmit={(e) => void save(e)}>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="manage-title">Session title</FieldLabel>
              <Input
                id="manage-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                disabled={!!locked}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="manage-description">Description</FieldLabel>
              <Textarea
                id="manage-description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!!locked}
              />
            </Field>
            <FormatAndLength
              format={format}
              onFormat={setFormat}
              duration={duration}
              onDuration={setDuration}
              formats={formats}
              idPrefix="manage"
              disabled={!!locked}
            />
          </FieldGroup>
        </form>

        <div className="flex flex-col gap-3">
          <Separator />
          <h3 className="text-sm font-semibold text-foreground">Speakers</h3>
          <ul className="divide-y rounded-lg border">
            {session.participants.map((p) => (
              <li key={p.personId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  {p.company ? (
                    <p className="truncate text-xs text-muted-foreground">{p.company}</p>
                  ) : null}
                </div>
                {!locked && session.participants.length > 1 ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${p.name}`}
                    disabled={busy === p.personId}
                    onClick={() => void remove(p.personId, p.name)}
                  >
                    <RiCloseLine aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {!locked ? (
            <form onSubmit={(e) => void add(e)} className="flex flex-col gap-3">
              <SpeakerRow
                speaker={newSpeaker}
                index={session.participants.length}
                onChange={(patch) => setNewSpeaker((s) => ({ ...s, ...patch }))}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="outline" disabled={busy === "add"}>
                  <RiAddLine aria-hidden />
                  {busy === "add" ? "Adding…" : "Add speaker"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </DrawerShell>
  )
}

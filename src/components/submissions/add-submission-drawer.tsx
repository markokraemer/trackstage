import { useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiFileTextLine,
  RiTeamLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { StatusPill } from "@/components/shared/status-pill"
import { PersonPicker } from "@/components/dashboard/person-picker"
import { TagInput } from "@/components/submissions/tag-input"
import { ChoiceValue, TrackValue } from "@/components/submissions/field-bits"
import {
  FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  LEVEL_OPTIONS,
} from "@/components/submissions/constants"

/**
 * Manual "+ Add submission" slide-over (docs/ux/03 image8): two tabs, Details
 * then Participants, Title the only required field, Status defaulting to
 * Pending, and the primary button disabled until the form is valid.
 *
 * Built on the shared `DrawerShell` + shadcn `Tabs`/`Select`/`Field` primitives.
 *
 * Each speaker slot leads with a `PersonPicker`: an event has one person per
 * email, so booking a second talk for someone already on the programme must
 * attach THAT person (portal, tasks, profile intact) rather than mint a twin.
 * `submissions.addManual` has always done that on the server — the picker is
 * how the organizer can see it. The email field underneath stays a plain
 * input, so typing an address straight in works exactly as it always did.
 */

const NONE = "none"

interface SpeakerRow {
  firstName: string
  lastName: string
  email: string
}

const EMPTY_SPEAKER: SpeakerRow = { firstName: "", lastName: "", email: "" }

export interface AddSubmissionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: Id<"events">
  tracks: Array<{ _id: Id<"tracks">; name: string; color: string }>
  onCreated?: (submissionId: Id<"submissions">) => void
}

export function AddSubmissionDrawer({
  open,
  onOpenChange,
  eventId,
  tracks,
  onCreated,
}: AddSubmissionDrawerProps) {
  const addManual = useConvexMutation(api.submissions.addManual)

  const [tab, setTab] = useState("details")
  const [kind, setKind] = useState("abstract")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState("pending")
  const [description, setDescription] = useState("")
  const [trackId, setTrackId] = useState<string>(NONE)
  const [format, setFormat] = useState<string>(NONE)
  const [level, setLevel] = useState<string>(NONE)
  const [language, setLanguage] = useState<string>(NONE)
  const [tags, setTags] = useState<Array<string>>([])
  const [speakers, setSpeakers] = useState<Array<SpeakerRow>>([EMPTY_SPEAKER])
  const [saving, setSaving] = useState(false)

  const canSave = title.trim().length > 0 && !saving

  function reset() {
    setTab("details")
    setKind("abstract")
    setTitle("")
    setStatus("pending")
    setDescription("")
    setTrackId(NONE)
    setFormat(NONE)
    setLevel(NONE)
    setLanguage(NONE)
    setTags([])
    setSpeakers([EMPTY_SPEAKER])
  }

  function updateSpeaker(index: number, patch: Partial<SpeakerRow>) {
    setSpeakers((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  async function handleSave() {
    if (!canSave) return
    const filled = speakers.filter((s) => s.email.trim().length > 0)
    const invalid = filled.find((s) => !s.email.includes("@"))
    if (invalid) {
      setTab("participants")
      toast.error("Check the speaker email addresses.")
      return
    }
    setSaving(true)
    try {
      const submissionId = await addManual({
        eventId,
        kind,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        trackId: trackId === NONE ? undefined : (trackId as Id<"tracks">),
        format: format === NONE ? undefined : format,
        level: level === NONE ? undefined : level,
        language: language === NONE ? undefined : language,
        tags,
        speakerEmails: filled.map((s) => ({
          email: s.email.trim(),
          firstName: s.firstName.trim(),
          lastName: s.lastName.trim(),
        })),
      })
      toast.success(`“${title.trim()}” added.`)
      reset()
      onOpenChange(false)
      onCreated?.(submissionId)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add the submission."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as string)}
      className="contents"
    >
      <DrawerShell
        open={open}
        onOpenChange={(next) => {
          if (!next) reset()
          onOpenChange(next)
        }}
        title="Add submission"
        description="For invited talks, sponsor sessions, and anything that didn't come through your form."
        tabs={
          <TabsList className="w-full">
            <TabsTrigger value="details">
              <RiFileTextLine aria-hidden />
              Details
            </TabsTrigger>
            <TabsTrigger value="participants">
              <RiTeamLine aria-hidden />
              Participants
            </TabsTrigger>
          </TabsList>
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSave}
              onClick={() => void handleSave()}
            >
              {saving ? "Adding…" : "Add submission"}
            </Button>
          </>
        }
      >
        <TabsContent value="details">
          <FieldGroup>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <ToggleGroup
                value={[kind]}
                variant="outline"
                spacing={0}
                onValueChange={(value) => {
                  const next = value[0]
                  if (typeof next === "string") setKind(next)
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="abstract"
                  className="flex-1 aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                >
                  Abstract
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="session"
                  className="flex-1 aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary"
                >
                  Session
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                Abstracts are applications to speak. Sessions are program items
                you've already confirmed, like a sponsor keynote.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-title">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="add-title"
                required
                maxLength={255}
                value={title}
                placeholder="Enter the session title…"
                onChange={(event) => setTitle(event.target.value)}
              />
              <FieldDescription>{title.length}/255 characters</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-status">Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as string)}
              >
                <SelectTrigger id="add-status" className="w-full">
                  <SelectValue>
                    {(value) => <StatusPill status={String(value)} size="sm" />}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[
                    "pending",
                    "accept_queue",
                    "decline_queue",
                    "accepted",
                    "declined",
                    "draft",
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      <StatusPill status={value} size="sm" />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Queue statuses stage a decision — no email is sent until you
                commit the queue.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-description">Description</FieldLabel>
              <Textarea
                id="add-description"
                rows={4}
                value={description}
                placeholder="What is this session about?"
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="add-track">Track</FieldLabel>
              <Select
                value={trackId}
                onValueChange={(value) => setTrackId(value as string)}
              >
                <SelectTrigger id="add-track" className="w-full">
                  <SelectValue>
                    {(value) => (
                      <TrackValue
                        tracks={tracks}
                        value={value}
                        empty="No track"
                      />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No track</SelectItem>
                  {tracks.map((track) => (
                    <SelectItem key={track._id} value={track._id}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: track.color }}
                        />
                        {track.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-format">Format</FieldLabel>
              <Select
                value={format}
                onValueChange={(value) => setFormat(value as string)}
              >
                <SelectTrigger id="add-format" className="w-full">
                  <SelectValue>
                    {(value) => <ChoiceValue value={value} empty="No format" />}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No format</SelectItem>
                  {FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-level">Level</FieldLabel>
              <Select
                value={level}
                onValueChange={(value) => setLevel(value as string)}
              >
                <SelectTrigger id="add-level" className="w-full">
                  <SelectValue>
                    {(value) => <ChoiceValue value={value} empty="No level" />}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No level</SelectItem>
                  {LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-language">Language</FieldLabel>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as string)}
              >
                <SelectTrigger id="add-language" className="w-full">
                  <SelectValue>
                    {(value) => (
                      <ChoiceValue value={value} empty="No language" />
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No language</SelectItem>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="add-tags">Tags</FieldLabel>
              <TagInput id="add-tags" value={tags} onChange={setTags} />
              <FieldDescription>
                Free-form labels for your own filtering, e.g. “sponsored” or
                “first-time speaker”.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value="participants">
          <FieldGroup>
            <p className="text-sm text-muted-foreground">
              Add the people presenting this session — pick someone already on
              this event, or enter a new email. They get a speaker portal
              account automatically, and you can add more later.
            </p>

            {speakers.map((speaker, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Speaker {index + 1}
                  </p>
                  {speakers.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove speaker ${index + 1}`}
                      onClick={() =>
                        setSpeakers((rows) =>
                          rows.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <RiDeleteBinLine aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor={`speaker-${index}-person`}>
                      Person
                    </FieldLabel>
                    <PersonPicker
                      id={`speaker-${index}-person`}
                      eventId={eventId}
                      email={speaker.email}
                      excludeEmails={speakers
                        .filter((_, i) => i !== index)
                        .map((row) => row.email)}
                      onPick={(person) =>
                        updateSpeaker(index, {
                          email: person.email,
                          firstName: person.firstName,
                          lastName: person.lastName,
                        })
                      }
                      onNewEmail={(value) =>
                        updateSpeaker(index, { email: value })
                      }
                      hint="Search the people already on this event, or add a brand new email."
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor={`speaker-${index}-first`}>
                        First name
                      </FieldLabel>
                      <Input
                        id={`speaker-${index}-first`}
                        value={speaker.firstName}
                        onChange={(event) =>
                          updateSpeaker(index, {
                            firstName: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`speaker-${index}-last`}>
                        Last name
                      </FieldLabel>
                      <Input
                        id={`speaker-${index}-last`}
                        value={speaker.lastName}
                        onChange={(event) =>
                          updateSpeaker(index, { lastName: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`speaker-${index}-email`}>
                      Email
                    </FieldLabel>
                    <Input
                      id={`speaker-${index}-email`}
                      type="email"
                      value={speaker.email}
                      placeholder="speaker@example.com"
                      onChange={(event) =>
                        updateSpeaker(index, { email: event.target.value })
                      }
                    />
                    <FieldDescription>
                      Leave blank to add this session without a speaker for now.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSpeakers((rows) => [...rows, { ...EMPTY_SPEAKER }])
              }
            >
              <RiAddLine aria-hidden />
              Add another speaker
            </Button>
          </FieldGroup>
        </TabsContent>
      </DrawerShell>
    </Tabs>
  )
}

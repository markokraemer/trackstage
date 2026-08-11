/**
 * Organizer-side speaker profile (sbek CNT-10).
 *
 * Speakers own their profile in their portal — but the person who has to ship
 * the public site at 6pm cannot wait for someone to fix their own typo. This
 * drawer gives the organizer the same fields: name, company, title, bio, the
 * headshot itself, plus two internal-only notes — what's wrong with the photo,
 * and the travel/logistics detail the ops team needs on the day (sbek SPK-15).
 *
 * The photo can be uploaded here too (sbek CNT-10): it goes through the same
 * storage path as the portal's own uploader, replaces cleanly, and closes any
 * open "upload a headshot" task — because by the time an organizer is fixing
 * someone's profile, the photo is usually already sitting in their inbox.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiEyeOffLine,
  RiImageLine,
  RiSaveLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { FileDropZone } from "@/components/shared/file-drop-zone"
import { uploadToStorage } from "@/lib/files"
import { FileList, FileRow } from "@/components/shared/file-row"
import { Skeleton } from "@/components/ui/skeleton"
import { initialsOf, relativeTime } from "@/components/dashboard/format"
import { useCurrentEvent } from "@/lib/current-event"
import { SpeakerWorkflowSelect } from "@/components/dashboard/speaker-workflow-select"
import type { SpeakerRosterRow } from "@/components/dashboard/speakers-table"
import { RemovePersonButton } from "@/components/dashboard/remove-person-dialog"

export interface SpeakerProfileDrawerProps {
  speaker: SpeakerRosterRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Whether this speaker currently appears on the public pages (CNT-12). */
  publicVisible?: boolean
}

export function SpeakerProfileDrawer({
  speaker,
  open,
  onOpenChange,
  publicVisible = true,
}: SpeakerProfileDrawerProps) {
  // Renamed: `event` is the DOM event in every input handler below.
  const { event: currentEvent } = useCurrentEvent()
  const updateProfile = useConvexMutation(api.speakersAdmin.updateProfile)
  const setPublicVisibility = useConvexMutation(
    api.speakersAdmin.setPublicVisibility,
  )
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl)
  const setHeadshot = useConvexMutation(api.speakersAdmin.setHeadshot)
  const clearHeadshot = useConvexMutation(api.speakersAdmin.clearHeadshot)
  const [removingPhoto, setRemovingPhoto] = React.useState(false)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [jobTitle, setJobTitle] = React.useState("")
  const [company, setCompany] = React.useState("")
  const [bio, setBio] = React.useState("")
  const [headshotNote, setHeadshotNote] = React.useState("")
  const [logistics, setLogistics] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // Reload the draft whenever a different speaker is opened. Reactive updates
  // to the row while it is open are deliberately NOT merged in — nothing is
  // more hostile than a text field that rewrites itself under the cursor.
  const personId = speaker?.personId
  const draftSource = open ? speaker : null
  React.useEffect(() => {
    if (!draftSource) return
    const [first, ...rest] = draftSource.name.split(" ")
    setFirstName(draftSource.firstName ?? first)
    setLastName(draftSource.lastName ?? rest.join(" "))
    setJobTitle(draftSource.jobTitle ?? "")
    setCompany(draftSource.company ?? "")
    setBio(draftSource.bio ?? "")
    setHeadshotNote(draftSource.headshotNote ?? "")
    // Keyed on `personId` alone on purpose: `draftSource` gets a new identity
    // on every reactive roster update, and re-seeding then would rewrite the
    // organizer's text under their cursor.
  }, [personId])

  // Travel notes and the current photo aren't on the roster row — they live in
  // their own tiny reactive query so an upload echoes here immediately
  // (sbek SPK-15 / CNT-10).
  const { data: extras } = useQuery(
    convexQuery(
      api.speakersAdmin.profile,
      personId && open ? { personId } : "skip",
    ),
  )
  // Seeded EXACTLY ONCE per speaker, on the query's first arrival: re-seeding
  // on later reactive updates would rewrite the organizer's text mid-sentence.
  const seededFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!personId || !open) {
      seededFor.current = null
      return
    }
    if (!extras || seededFor.current === personId) return
    seededFor.current = personId
    setLogistics(extras.logistics ?? "")
  }, [personId, open, extras])

  const headshotUrl = extras?.headshotUrl ?? speaker?.headshotUrl ?? null

  // Optimistic echo for the eye toggle: the switch flips instantly, the
  // reactive `publicVisible` prop takes over the moment the server confirms.
  const [pendingVisible, setPendingVisible] = React.useState<boolean | null>(
    null,
  )
  React.useEffect(() => {
    setPendingVisible(null)
  }, [personId, publicVisible])
  const shownPublicly = pendingVisible ?? publicVisible

  async function toggleVisibility(next: boolean) {
    if (!speaker) return
    setPendingVisible(next)
    try {
      await setPublicVisibility({ personId: speaker.personId, publicVisible: next })
      toast.success(
        next
          ? `${speaker.name} is shown publicly`
          : `${speaker.name} is hidden from public pages`,
        {
          description: next
            ? "They're back on the speaker gallery and their sessions."
            : "Useful while a keynote is still under embargo. Nothing else changes.",
        },
      )
    } catch (error) {
      setPendingVisible(null)
      toast.error("Couldn't change their visibility", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    }
  }

  /**
   * Upload the speaker's photo FOR them (sbek CNT-10). Same three steps and
   * the same storage rules as the portal's own uploader — signed URL, push the
   * bytes, record it — because the photo an organizer was emailed is the same
   * photo, and chasing someone to re-upload it is not a workflow.
   */
  async function uploadHeadshot(file: File, onProgress: (n: number) => void) {
    if (!speaker || !currentEvent) throw new Error("No speaker selected.")
    const uploadUrl = await generateUploadUrl({ eventId: currentEvent._id })
    const storageId = await uploadToStorage(uploadUrl, file, onProgress)
    await setHeadshot({
      personId: speaker.personId,
      storageId: storageId as Id<"_storage">,
      filename: file.name,
    })
    toast.success(`${speaker.name}'s photo was updated`, {
      description: "It's on the public speaker page and in their portal now.",
    })
  }

  async function removeHeadshot() {
    if (!speaker) return
    setRemovingPhoto(true)
    try {
      await clearHeadshot({ personId: speaker.personId })
      toast.success("Photo removed", {
        description: `${speaker.name} shows as initials until a new one is uploaded.`,
      })
    } catch (error) {
      toast.error("Couldn't remove the photo", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setRemovingPhoto(false)
    }
  }

  async function save() {
    if (!speaker) return
    if (firstName.trim().length === 0) {
      toast.error("A first name is required")
      return
    }
    setSaving(true)
    try {
      await updateProfile({
        personId: speaker.personId,
        patch: {
          firstName,
          lastName,
          jobTitle,
          company,
          bio,
          headshotNote,
          logistics,
        },
      })
      toast.success("Speaker profile saved", {
        description: "The public speaker page updates straight away.",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error("Couldn't save the profile", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={speaker ? `Edit ${speaker.name}` : "Edit speaker"}
      description="Your changes overwrite what's on the public speaker page. The speaker can still edit the same fields in their own portal."
      footer={
        <>
          {speaker ? (
            <RemovePersonButton
              personId={speaker.personId}
              name={speaker.name}
              onRemoved={() => onOpenChange(false)}
            />
          ) : null}
          <span className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !speaker}>
            <RiSaveLine aria-hidden />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {speaker ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {headshotUrl ? <AvatarImage src={headshotUrl} alt="" /> : null}
              <AvatarFallback>{initialsOf(speaker.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {speaker.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {speaker.sessions.length === 0
                  ? "No sessions yet"
                  : `${speaker.sessions.length} session${speaker.sessions.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <SpeakerWorkflowSelect
              personId={speaker.personId}
              value={speaker.workflowStatus}
              name={speaker.name}
            />
          </div>

          <Separator />

          <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
            {shownPublicly ? (
              <RiEyeLine
                size={18}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
            ) : (
              <RiEyeOffLine
                size={18}
                aria-hidden
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
            )}
            <div className="min-w-0 flex-1">
              <label
                htmlFor="edit-public-visible"
                className="text-sm font-medium text-foreground"
              >
                Show in public gallery
              </label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {shownPublicly
                  ? "They appear on the public speaker pages and next to their sessions."
                  : "Hidden from the speaker gallery, their sessions and the calendar feed. Their portal, tasks and emails still work."}
              </p>
            </div>
            <Switch
              id="edit-public-visible"
              checked={shownPublicly}
              onCheckedChange={(value) => void toggleVisibility(value)}
            />
          </div>

          <Separator />

          {/* Headshot (sbek CNT-10). The organizer usually has the photo in
              their inbox before the speaker ever opens their portal — so they
              can put it in, through exactly the same storage path. */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">Headshot</h3>
              {headshotUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removingPhoto}
                  onClick={() => void removeHeadshot()}
                >
                  <RiDeleteBinLine aria-hidden />
                  {removingPhoto ? "Removing…" : "Remove photo"}
                </Button>
              ) : null}
            </div>
            <div className="flex items-start gap-4">
              <Avatar className="size-20 shrink-0 ring-1 ring-border">
                {headshotUrl ? (
                  <AvatarImage src={headshotUrl} alt={speaker.name} />
                ) : null}
                <AvatarFallback className="text-lg">
                  {initialsOf(speaker.name)}
                </AvatarFallback>
              </Avatar>
              <FileDropZone
                className="min-w-0 flex-1"
                imagesOnly
                size="sm"
                label={
                  headshotUrl
                    ? "Drop a new photo here to replace it"
                    : "Drop their photo here, or click to choose one"
                }
                hint={`PNG, JPG or WebP · square works best${
                  extras?.headshotFilename ? ` · now: ${extras.headshotFilename}` : ""
                }`}
                onUpload={uploadHeadshot}
                onError={(message) =>
                  toast.error("Couldn't upload that photo", {
                    description: message,
                  })
                }
              />
            </div>
          </section>

          <Separator />

          <FieldGroup className="gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-first">
                  First name<span className="required-asterisk">*</span>
                </FieldLabel>
                <Input
                  id="edit-first"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-last">Last name</FieldLabel>
                <Input
                  id="edit-last"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-title">Job title</FieldLabel>
                <Input
                  id="edit-title"
                  value={jobTitle}
                  onChange={(event) => setJobTitle(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-company">Company</FieldLabel>
                <Input
                  id="edit-company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="edit-bio">Biography</FieldLabel>
              <FieldDescription>
                Shown on the public speaker page and next to their sessions.
              </FieldDescription>
              <Textarea
                id="edit-bio"
                rows={7}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Two or three sentences in the third person."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-headshot-note">
                Headshot note
              </FieldLabel>
              <FieldDescription>
                Internal only — never shown publicly.{" "}
                {headshotUrl
                  ? "There's a photo on file."
                  : "No photo yet — upload one above, or assign them a headshot task to chase it."}
              </FieldDescription>
              <Input
                id="edit-headshot-note"
                value={headshotNote}
                onChange={(event) => setHeadshotNote(event.target.value)}
                placeholder="Needs a higher-res file for the banner"
              />
            </Field>

            {/* Travel & logistics (sbek SPK-15). One free-text field on
                purpose: real arrival/hotel/dietary notes never fit the columns
                a CRM would force on you, and a field nobody fills in is worse
                than no field at all. */}
            <Field>
              <FieldLabel htmlFor="edit-logistics">
                Logistics &amp; travel
              </FieldLabel>
              <FieldDescription>
                Internal only — arrival and departure, hotel nights, dietary
                needs, AV requests, anything the ops team needs on the day.
              </FieldDescription>
              <Textarea
                id="edit-logistics"
                rows={4}
                value={logistics}
                onChange={(event) => setLogistics(event.target.value)}
                placeholder="Arrives Tue 14:00 LHR · hotel Tue + Wed · vegetarian · needs an HDMI adapter"
              />
            </Field>
          </FieldGroup>

          <Separator />

          {/* What they've actually sent in (sbek SPK-10) — the answer to "did
              their slides ever arrive?", without leaving this drawer. */}
          <SpeakerFiles personId={speaker.personId} name={speaker.name} />

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/portal/t/${speaker.portalToken}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <RiExternalLinkLine aria-hidden />
              Open their portal
            </a>
            {speaker.missing.length > 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RiImageLine size={14} aria-hidden />
                Still needed: {speaker.missing.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </DrawerShell>
  )
}

/**
 * Every file this speaker has uploaded, newest first — the same rows the Files
 * library and their own portal show (`shared/file-row.tsx`), scoped to them.
 * Read-only here: reviewing happens where the file's context is, on the
 * session's Files tab or in /app/files.
 */
function SpeakerFiles({
  personId,
  name,
}: {
  personId: Id<"people">
  name: string
}) {
  const { event } = useCurrentEvent()
  const { data: files, isPending } = useQuery(
    convexQuery(
      api.tasksAdmin.listUploads,
      event ? { eventId: event._id, personId } : "skip",
    ),
  )

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Files</h3>
        {files && files.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : !files || files.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {name.split(" ")[0]} hasn't uploaded anything yet. Assign them an
          upload task and it will appear here the moment it lands.
        </p>
      ) : (
        <FileList>
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              // `block whitespace-normal` so the session title and the time
              // wrap onto a second line instead of being clipped by the
              // drawer's narrow column.
              meta={
                <span className="block whitespace-normal">
                  {[
                    file.submissionTitle ?? file.task?.title,
                    `uploaded ${relativeTime(file.uploadedAt)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              }
            />
          ))}
        </FileList>
      )}
    </section>
  )
}

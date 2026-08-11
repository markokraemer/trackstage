/**
 * Organizer-side speaker profile (sbek CNT-10).
 *
 * Speakers own their profile in their portal — but the person who has to ship
 * the public site at 6pm cannot wait for someone to fix their own typo. This
 * drawer gives the organizer the same fields: name, company, title, bio, plus
 * an internal note about the headshot (never shown publicly) for the very
 * common "photo is fine but low-res" case.
 *
 * The headshot IMAGE itself stays the speaker's to upload — an organizer notes
 * what they need and chases with a task rather than impersonating them.
 */

import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiExternalLinkLine, RiImageLine, RiSaveLine } from "@remixicon/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { initialsOf } from "@/components/dashboard/format"
import { SpeakerWorkflowSelect } from "@/components/dashboard/speaker-workflow-select"
import type { SpeakerRosterRow } from "@/components/dashboard/speakers-table"

export interface SpeakerProfileDrawerProps {
  speaker: SpeakerRosterRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SpeakerProfileDrawer({
  speaker,
  open,
  onOpenChange,
}: SpeakerProfileDrawerProps) {
  const updateProfile = useConvexMutation(api.speakersAdmin.updateProfile)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [jobTitle, setJobTitle] = React.useState("")
  const [company, setCompany] = React.useState("")
  const [bio, setBio] = React.useState("")
  const [headshotNote, setHeadshotNote] = React.useState("")
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
              {speaker.headshotUrl ? (
                <AvatarImage src={speaker.headshotUrl} alt="" />
              ) : null}
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
                {speaker.hasHeadshot
                  ? "They've uploaded a photo."
                  : "No photo uploaded yet — assign them a headshot task to chase it."}
              </FieldDescription>
              <Input
                id="edit-headshot-note"
                value={headshotNote}
                onChange={(event) => setHeadshotNote(event.target.value)}
                placeholder="Needs a higher-res file for the banner"
              />
            </Field>
          </FieldGroup>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Button nativeButton={false}
              variant="outline"
              size="sm"
              render={
                <a
                  href={`/portal/t/${speaker.portalToken}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <RiExternalLinkLine aria-hidden />
              Open their portal
            </Button>
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

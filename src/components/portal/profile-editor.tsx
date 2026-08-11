import { useCallback, useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import { RiImageLine, RiLinksLine, RiUser3Line } from "@remixicon/react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PanelCard } from "./panel-card"
import { HeadshotUploader } from "./headshot-uploader"
import { usePortal } from "./portal-context"
import type { PortalMe } from "./portal-context"
import { initialsOf } from "./portal-utils"

const BIO_MAX = 5000

const SALUTATIONS = ["Mr.", "Ms.", "Mx.", "Dr.", "Prof."]
const PRONOUNS = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "Prefer not to say",
]

interface Draft {
  salutation: string
  firstName: string
  lastName: string
  pronouns: string
  jobTitle: string
  company: string
  phone: string
  bio: string
  linkedin: string
  twitter: string
  website: string
}

type LinkField = "linkedin" | "twitter" | "website"
const LINK_FIELDS: Array<LinkField> = ["linkedin", "twitter", "website"]

/** Mirrors `convex/portal.ts` → `updateProfile.args.patch`. */
interface ProfilePatch {
  firstName?: string
  lastName?: string
  salutation?: string
  pronouns?: string
  jobTitle?: string
  company?: string
  phone?: string
  bio?: string
  links?: { linkedin?: string; twitter?: string; website?: string }
}

function draftFrom(me: PortalMe): Draft {
  return {
    salutation: me.salutation ?? "",
    firstName: me.firstName,
    lastName: me.lastName,
    pronouns: me.pronouns ?? "",
    jobTitle: me.jobTitle ?? "",
    company: me.company ?? "",
    phone: me.phone ?? "",
    bio: me.bio ?? "",
    linkedin: me.links?.linkedin ?? "",
    twitter: me.links?.twitter ?? "",
    website: me.links?.website ?? "",
  }
}

/**
 * The speaker's own profile (docs/ux/03 image40): a General panel with the
 * biography and personal fields, a headshot uploader, and My Links.
 *
 * Everything saves on blur — speakers fill this in on a phone between talks,
 * and a "Save" button they might miss is how bios go missing.
 */
export function ProfileEditor() {
  const { portalToken, home } = usePortal()
  const me = home.me
  const updateProfile = useConvexMutation(api.portal.updateProfile)

  const [draft, setDraft] = useState<Draft>(() => draftFrom(me))
  const savedRef = useRef<Draft>(draftFrom(me))
  const [saving, setSaving] = useState(false)

  const set = useCallback(
    <TKey extends keyof Draft>(key: TKey, value: Draft[TKey]) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const commit = useCallback(
    async (key: keyof Draft, value: string) => {
      if (savedRef.current[key] === value) return

      if ((key === "firstName" || key === "lastName") && value.trim() === "") {
        setDraft((prev) => ({ ...prev, [key]: savedRef.current[key] }))
        toast.error(
          key === "firstName"
            ? "Your first name can't be empty."
            : "Your last name can't be empty.",
        )
        return
      }

      const next = { ...savedRef.current, [key]: value }
      const patch: ProfilePatch = LINK_FIELDS.includes(key as LinkField)
        ? {
            links: {
              linkedin: next.linkedin.trim() || undefined,
              twitter: next.twitter.trim() || undefined,
              website: next.website.trim() || undefined,
            },
          }
        : { [key]: value }

      setSaving(true)
      try {
        await updateProfile({ portalToken, patch })
        savedRef.current = next
        toast.success("Profile saved", { id: "portal-profile-save" })
      } catch (error) {
        setDraft((prev) => ({ ...prev, [key]: savedRef.current[key] }))
        toast.error(
          error instanceof Error
            ? error.message
            : "We couldn't save that just now.",
        )
      } finally {
        setSaving(false)
      }
    },
    [portalToken, updateProfile],
  )

  const textField = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      set(key, event.target.value),
    onBlur: () => void commit(key, draft[key]),
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <PanelCard icon={RiUser3Line} title="General" bodyClassName="gap-5 p-4">
        <Field>
          <FieldLabel htmlFor="profile-bio">Biography</FieldLabel>
          <FieldDescription>
            A short introduction in the third person — this is what the host
            reads out before your talk.
          </FieldDescription>
          <Textarea
            id="profile-bio"
            rows={8}
            maxLength={BIO_MAX}
            placeholder="Enter text here…"
            value={draft.bio}
            onChange={(event) => set("bio", event.target.value)}
            onBlur={() => void commit("bio", draft.bio)}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {draft.bio.length.toLocaleString()} / {BIO_MAX.toLocaleString()}{" "}
            characters
          </p>
        </Field>

        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="profile-salutation">Salutation</FieldLabel>
            <Select
              value={draft.salutation || null}
              onValueChange={(value: unknown) => {
                const next = value ? String(value) : ""
                set("salutation", next)
                void commit("salutation", next)
              }}
            >
              <SelectTrigger id="profile-salutation" className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {SALUTATIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-first-name">
              First name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="profile-first-name"
              autoComplete="given-name"
              {...textField("firstName")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-last-name">
              Last name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="profile-last-name"
              autoComplete="family-name"
              {...textField("lastName")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-pronouns">Pronouns</FieldLabel>
            <Select
              value={draft.pronouns || null}
              onValueChange={(value: unknown) => {
                const next = value ? String(value) : ""
                set("pronouns", next)
                void commit("pronouns", next)
              }}
            >
              <SelectTrigger id="profile-pronouns" className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {PRONOUNS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-job-title">Job title</FieldLabel>
            <Input
              id="profile-job-title"
              autoComplete="organization-title"
              placeholder="Staff Engineer"
              {...textField("jobTitle")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-company">Company</FieldLabel>
            <Input
              id="profile-company"
              autoComplete="organization"
              placeholder="Acme Inc."
              {...textField("company")}
            />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="profile-phone">Phone number</FieldLabel>
            <FieldDescription>
              Only used by the on-site team on the day of your talk.
            </FieldDescription>
            <Input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              {...textField("phone")}
            />
          </Field>

          <Field className="sm:col-span-1">
            <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
            <FieldDescription>
              Ask the organizers to change this.
            </FieldDescription>
            <Input id="profile-email" value={me.email} readOnly disabled />
          </Field>
        </div>

        <p
          className="text-xs text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          {saving ? "Saving…" : "Changes save automatically when you finish a field."}
        </p>
      </PanelCard>

      <div className="flex flex-col gap-4">
        <PanelCard icon={RiImageLine} title="Headshot" bodyClassName="p-4">
          <HeadshotUploader
            headshotUrl={me.headshotUrl}
            initials={initialsOf(me.firstName, me.lastName)}
          />
        </PanelCard>

        <PanelCard icon={RiLinksLine} title="My Links" bodyClassName="gap-4 p-4">
          <Field>
            <FieldLabel htmlFor="profile-linkedin">LinkedIn URL</FieldLabel>
            <Input
              id="profile-linkedin"
              type="url"
              inputMode="url"
              placeholder="https://linkedin.com/in/you"
              {...textField("linkedin")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-twitter">X (Twitter) URL</FieldLabel>
            <Input
              id="profile-twitter"
              type="url"
              inputMode="url"
              placeholder="https://x.com/you"
              {...textField("twitter")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-website">Website</FieldLabel>
            <Input
              id="profile-website"
              type="url"
              inputMode="url"
              placeholder="https://your-site.com"
              {...textField("website")}
            />
          </Field>
        </PanelCard>
      </div>
    </div>
  )
}

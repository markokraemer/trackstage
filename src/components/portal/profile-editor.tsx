import { useCallback, useEffect, useRef, useState } from "react"
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
import { portalHomeArgs } from "./portal-query"
import { errorMessage } from "@/lib/errors"

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

type Links = NonNullable<ProfilePatch["links"]>

/** The server's `links` merge (convex/portal.ts), mirrored for the optimistic
 * pass: a key that is present replaces, an empty string clears, an absent key
 * leaves the stored value alone. */
function mergeLinks(current: Links | undefined, patch: Links): Links {
  const merged: Links = { ...(current ?? {}) }
  for (const key of LINK_FIELDS) {
    const value = patch[key]
    if (value === undefined) continue
    if (value.trim() === "") delete merged[key]
    else merged[key] = value.trim()
  }
  return merged
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
  // Optimistic (docs/memory/RULES.md #26): the completeness meter, the header
  // avatar and the name in the account menu all read from `portal.home`, so
  // they must move the moment a field is left — not when the round-trip lands.
  const updateProfile = useConvexMutation(
    api.portal.updateProfile,
  ).withOptimisticUpdate((localStore, args) => {
    const queryArgs = portalHomeArgs(portalToken)
    const current = localStore.getQuery(api.portal.home, queryArgs)
    if (!current) return
    const { links, ...fields } = args.patch
    localStore.setQuery(
      api.portal.home,
      queryArgs,
      {
        ...current,
        me: {
          ...current.me,
          ...fields,
          // `links` is a partial patch (see `commit` below) — merge it exactly
          // the way the server does, or the optimistic pass would blank the two
          // links this save never mentioned.
          links: links
            ? mergeLinks(current.me.links, links)
            : current.me.links,
        },
      },
    )
  })

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

      // ONE field per save, links included. Rebuilding all three links from a
      // client snapshot is what made a fast second blur overwrite the URL the
      // first one had just stored: the snapshot only advanced after the
      // round-trip, so the second save carried a stale twitter/website and the
      // server (which replaced the whole `links` object) believed it. Now each
      // link is patched on its own and merged server-side — an empty string
      // means "clear this one" — so two saves in flight can never disagree
      // about a field neither of them touched. (adversarial-review F9)
      const patch: ProfilePatch = LINK_FIELDS.includes(key as LinkField)
        ? { links: { [key]: value.trim() } }
        : { [key]: value }

      setSaving(true)
      try {
        await updateProfile({ portalToken, patch })
        savedRef.current = { ...savedRef.current, [key]: value }
        toast.success("Profile saved", { id: "portal-profile-save" })
      } catch (error) {
        setDraft((prev) => ({ ...prev, [key]: savedRef.current[key] }))
        toast.error(errorMessage(error, "We couldn't save that just now."))
      } finally {
        setSaving(false)
      }
    },
    [portalToken, updateProfile],
  )

  /**
   * Autosave while they type, not only when they leave the field.
   *
   * Blur alone looked fine and lost work: typing a bio and then reloading, or
   * closing the tab, never fires a blur, so the edit vanished with no error —
   * the speaker's own words, gone, and nothing on screen ever said so. A quiet
   * second and a half after the last keystroke is enough to be sure they have
   * stopped, and blur still commits immediately so nothing waits when they
   * move on deliberately.
   *
   * Names are left to blur: they are required, and a debounce would scold
   * someone mid-way through clearing a field they were about to retype.
   */
  useEffect(() => {
    const pending = (Object.keys(draft) as Array<keyof Draft>).filter((key) => {
      if (draft[key] === savedRef.current[key]) return false
      if (key === "firstName" || key === "lastName") return false
      return true
    })
    if (pending.length === 0) return

    const timer = window.setTimeout(() => {
      for (const key of pending) void commit(key, draft[key])
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [draft, commit])

  const textField = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      set(key, event.target.value),
    onBlur: () => void commit(key, draft[key]),
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <PanelCard
        icon={RiUser3Line}
        title="General"
        description="Your name as it should appear in the programme, and the bio the host reads out."
        bodyClassName="gap-5"
      >
        {/* `scroll-mt` clears the sticky portal header when the completeness
            meter links straight to the missing field. */}
        <Field id="bio" className="scroll-mt-24">
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

        <div
          id="details"
          className="grid scroll-mt-24 gap-4 border-t border-border pt-5 sm:grid-cols-3"
        >
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
              First name
              <span className="required-asterisk" aria-hidden>
                *
              </span>
              <span className="sr-only">(required)</span>
            </FieldLabel>
            <Input
              id="profile-first-name"
              autoComplete="given-name"
              {...textField("firstName")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="profile-last-name">
              Last name
              <span className="required-asterisk" aria-hidden>
                *
              </span>
              <span className="sr-only">(required)</span>
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

          <Field className="sm:col-span-1">
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

          {/* Two columns, because a truncated email address is worse than an
              extra-wide field. */}
          <Field className="sm:col-span-2">
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
        <PanelCard
          id="headshot"
          icon={RiImageLine}
          title="Headshot"
          className="scroll-mt-24"
        >
          <HeadshotUploader
            headshotUrl={me.headshotUrl}
            initials={initialsOf(me.firstName, me.lastName)}
          />
        </PanelCard>

        <PanelCard
          id="links"
          icon={RiLinksLine}
          title="My links"
          description="Optional — shown next to your talk so people can find you afterwards."
          className="scroll-mt-24"
          bodyClassName="gap-4"
        >
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

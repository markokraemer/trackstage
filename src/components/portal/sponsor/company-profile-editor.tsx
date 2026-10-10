import { useCallback, useEffect, useRef, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"
import { RiBuilding2Line, RiImageLine } from "@remixicon/react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PanelCard } from "@/components/portal/panel-card"
import { usePortal } from "@/components/portal/portal-context"
import { portalHomeArgs } from "@/components/portal/portal-query"
import { errorMessage } from "@/lib/errors"
import { LogoUploader } from "./logo-uploader"
import { SponsorPreviewCard } from "./sponsor-preview-card"
import { CompanyFieldInputs, fieldValueMap } from "@/components/sponsors/company-field-inputs"

/** Mirrors `convex/lib/sponsors.ts → cleanDescription`. */
const DESCRIPTION_MAX = 600

interface Draft {
  description: string
  websiteUrl: string
}
type DraftKey = keyof Draft

/**
 * Sponsor portal → Company: the public face the sponsor owns — description,
 * website, logo and the event's own company fields (whatever the organizers
 * defined: LinkedIn, booth number…) — beside a live preview of the sponsor-wall
 * card. Saves exactly like the speaker ProfileEditor: on blur, and after a
 * quiet moment while typing, one field per save, so nothing typed is lost to
 * a closed tab.
 */
export function CompanyProfileEditor() {
  const { home, portalToken } = usePortal()
  const sponsor = home.sponsor
  // Optimistic: the preview card and the Overview checklist read `portal.home`,
  // so they move the moment a field is left — not when the round-trip lands.
  const save = useConvexMutation(api.sponsorProfile.updateCompanyProfile).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = portalHomeArgs(portalToken)
      const current = localStore.getQuery(api.portal.home, queryArgs)
      if (!current?.sponsor) return
      const { portalToken: _token, fields, ...patch } = args
      const next = { ...current.sponsor }
      for (const key of ["description", "websiteUrl"] as const) {
        const value = patch[key]
        if (value !== undefined) next[key] = value.trim() === "" ? null : value.trim()
      }
      if (fields) {
        next.fields = next.fields.map((f) =>
          f.id in fields ? { ...f, value: fields[f.id].trim() === "" ? null : fields[f.id].trim() } : f,
        )
      }
      localStore.setQuery(api.portal.home, queryArgs, { ...current, sponsor: next })
    },
  )

  const initial: Draft = {
    description: sponsor?.description ?? "",
    websiteUrl: sponsor?.websiteUrl ?? "",
  }
  const [fieldDraft, setFieldDraft] = useState<Record<string, string>>(
    () => fieldValueMap(sponsor?.fields ?? []),
  )
  const savedFieldsRef = useRef<Record<string, string>>(fieldValueMap(sponsor?.fields ?? []))

  const commitField = useCallback(
    async (fieldId: string) => {
      const value = fieldDraft[fieldId] ?? ""
      if ((savedFieldsRef.current[fieldId] ?? "") === value) return
      try {
        await save({ portalToken, fields: { [fieldId]: value } })
        savedFieldsRef.current = { ...savedFieldsRef.current, [fieldId]: value }
        toast.success("Company profile saved", { id: "sponsor-profile-save" })
      } catch (error) {
        setFieldDraft((prev) => ({ ...prev, [fieldId]: savedFieldsRef.current[fieldId] ?? "" }))
        toast.error(errorMessage(error, "We couldn't save that just now."))
      }
    },
    [fieldDraft, portalToken, save],
  )
  const [draft, setDraft] = useState<Draft>(initial)
  const savedRef = useRef<Draft>(initial)
  const [saving, setSaving] = useState(false)

  const commit = useCallback(
    async (key: DraftKey, value: string) => {
      if (savedRef.current[key] === value) return
      setSaving(true)
      try {
        await save({ portalToken, [key]: value })
        savedRef.current = { ...savedRef.current, [key]: value }
        toast.success("Company profile saved", { id: "sponsor-profile-save" })
      } catch (error) {
        setDraft((prev) => ({ ...prev, [key]: savedRef.current[key] }))
        toast.error(errorMessage(error, "We couldn't save that just now."))
      } finally {
        setSaving(false)
      }
    },
    [portalToken, save],
  )

  // Autosave a quiet moment after the last keystroke, as well as on blur.
  useEffect(() => {
    const pending = (Object.keys(draft) as Array<DraftKey>).filter(
      (key) => draft[key] !== savedRef.current[key],
    )
    if (pending.length === 0) return
    const timer = window.setTimeout(() => {
      for (const key of pending) void commit(key, draft[key])
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [draft, commit])

  if (!sponsor) return null

  const field = (key: DraftKey) => ({
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((prev) => ({ ...prev, [key]: event.target.value })),
    onBlur: () => void commit(key, draft[key]),
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <div className="flex flex-col gap-4">
        <PanelCard
          icon={RiBuilding2Line}
          title={sponsor.name}
          description="What attendees read about you on the event site. Your company name and package are set by the organizers."
          bodyClassName="gap-5"
        >
          <Field id="description" className="scroll-mt-24">
            <FieldLabel htmlFor="company-description">Description</FieldLabel>
            <FieldDescription>
              One or two sentences — what you do, for the people in the room.
            </FieldDescription>
            <Textarea
              id="company-description"
              rows={5}
              maxLength={DESCRIPTION_MAX}
              placeholder="Acme builds the evaluation layer for teams shipping LLM agents to production."
              {...field("description")}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {draft.description.length} / {DESCRIPTION_MAX} characters
            </p>
          </Field>

          <div className="flex flex-col gap-5 border-t border-border pt-5">
            <Field>
              <FieldLabel htmlFor="company-website">Website</FieldLabel>
              <Input
                id="company-website"
                type="url"
                inputMode="url"
                placeholder="https://acme.ai"
                {...field("websiteUrl")}
              />
            </Field>
            {/* The event's own company fields — defined by the organizers. */}
            <CompanyFieldInputs
              fields={sponsor.fields}
              values={fieldDraft}
              onChange={(fieldId, value) => setFieldDraft((prev) => ({ ...prev, [fieldId]: value }))}
              onBlurField={(fieldId) => void commitField(fieldId)}
              idPrefix="company"
            />
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite" role="status">
            {saving ? "Saving…" : "Changes save automatically when you finish a field."}
          </p>
        </PanelCard>
      </div>

      <div className="flex flex-col gap-4">
        <PanelCard id="logo" icon={RiImageLine} title="Logo" className="scroll-mt-24">
          <LogoUploader />
        </PanelCard>
        <SponsorPreviewCard />
      </div>
    </div>
  )
}

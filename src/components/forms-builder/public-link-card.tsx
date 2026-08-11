import { useEffect, useId, useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiExternalLinkLine, RiPencilLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { slugify } from "@/lib/public-links"
import { BuilderField, SectionHeading } from "./builder-controls"
import { CopyLinkButton } from "./copy-link-button"
import { friendlyError, publicFormPath, publicFormUrl } from "./model"

/**
 * The form's public address — shown, copyable, and editable in place
 * (docs/SPEC.md §2.8: swyx hunted for this link; docs/memory/DECISIONS.md:
 * the address is `/submit/:eventSlug/:formSlug`).
 *
 * Editing writes on its own, NOT through the wizard's autosave: a taken address
 * is refused with a suggestion, and an autosave that can be refused would keep
 * failing in the background while the organizer types something unrelated.
 */
export function PublicLinkCard({
  formId,
  eventSlug,
  slug,
}: {
  formId: string
  eventSlug: string
  slug: string
}) {
  const id = useId()
  const updateForm = useConvexMutation(api.forms.update)

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(slug)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The reactive query is the truth; a slug changed elsewhere lands here.
  useEffect(() => {
    if (!editing) setValue(slug)
  }, [slug, editing])

  async function save() {
    const next = slugify(value)
    if (!next) {
      setError("A web address needs at least one letter or number.")
      return
    }
    if (next === slug) {
      setEditing(false)
      setError(null)
      return
    }
    setSaving(true)
    try {
      const result = await updateForm({
        formId: formId as Id<"forms">,
        patch: { slug: next },
      })
      setEditing(false)
      setError(null)
      toast.success("Public link updated", {
        description: publicFormUrl(eventSlug, result.slug),
      })
    } catch (caught) {
      setError(friendlyError(caught, "We couldn't change that address."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionHeading
        title="Public link"
        description="Share this anywhere — no account needed to open it."
      />

      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <BuilderField
            htmlFor={`${id}-slug`}
            label="Web address"
            description={
              <>
                Lowercase letters, numbers and dashes. It only has to be unique
                inside this event, so short names like{" "}
                <code className="rounded bg-muted px-1">cfp</code> are fine.
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                /submit/{eventSlug}/
              </span>
              <Input
                id={`${id}-slug`}
                value={value}
                autoFocus
                aria-invalid={error ? true : undefined}
                className="max-w-[16rem] font-mono"
                onChange={(event) => {
                  setValue(event.target.value)
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void save()
                  }
                  if (event.key === "Escape") {
                    setEditing(false)
                    setValue(slug)
                    setError(null)
                  }
                }}
              />
            </div>
          </BuilderField>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save address"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setValue(slug)
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/50 px-3 py-2 font-mono text-sm break-all text-foreground">
            {publicFormPath(eventSlug, slug)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyLinkButton eventSlug={eventSlug} slug={slug} />
            <a
              href={publicFormPath(eventSlug, slug)}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <RiExternalLinkLine aria-hidden />
              View form
            </a>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(true)}
            >
              <RiPencilLine aria-hidden />
              Edit address
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

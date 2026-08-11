import { useEffect, useId, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiArrowRightLine } from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { eventRefOf, useCurrentEvent } from "@/lib/current-event"
import { appLink } from "@/lib/app-links"
import {
  BuilderField,
  InfoNote,
} from "@/components/forms-builder/builder-controls"
import { FORM_KINDS, friendlyError } from "@/components/forms-builder/model"
import type { FormKind } from "@/components/forms-builder/model"

/**
 * "New form" as a MODAL over the Forms list (Marko, 2026-08-12): two quick
 * choices — a name and what the form collects — never deserved a full page.
 * The dialog opens where the organizer already is; Create lands straight in
 * the builder, same destination as before.
 *
 * State is a `?new=1` search param on the Forms list (validated there), same
 * Linear-style URL-addressable convention as the settings modals
 * (src/components/shell/settings-dialogs.tsx) — so the old `/forms/new`
 * address and the ⌘K quick action both simply open this dialog.
 */
export function NewFormDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const id = useId()
  const navigate = useNavigate()
  const { event } = useCurrentEvent()

  const [name, setName] = useState("Call for Speakers")
  const [kind, setKind] = useState<FormKind>("abstract")
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // A reopened dialog is a fresh start, not last time's leftovers.
  useEffect(() => {
    if (!open) return
    setName("Call for Speakers")
    setKind("abstract")
    setError(null)
    setCreating(false)
  }, [open])

  const createForm = useConvexMutation(api.forms.create)

  async function submit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault()
    if (!event) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError("Give your form a name so your team can find it.")
      return
    }
    setCreating(true)
    setError(null)
    try {
      const formId = await createForm({
        eventId: event._id,
        internalName: trimmed,
        kind,
      })
      toast.success("Form created — now build your questions.")
      await navigate({ to: appLink.form(eventRefOf(event), formId) })
    } catch (caught) {
      const message = friendlyError(caught, "We couldn't create that form.")
      setError(message)
      toast.error(message)
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(formEvent) => void submit(formEvent)}
          noValidate
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>New submission form</DialogTitle>
            <DialogDescription>
              Two quick choices and you're in the builder — you can change both
              later.
            </DialogDescription>
          </DialogHeader>

          <BuilderField
            htmlFor={`${id}-name`}
            label="Form name"
            required
            description="Only your team sees this — for example “2026 Call for Speakers”."
          >
            <Input
              id={`${id}-name`}
              value={name}
              autoFocus
              maxLength={120}
              aria-invalid={error ? true : undefined}
              onChange={(changeEvent) => {
                setName(changeEvent.target.value)
                setError(null)
              }}
            />
          </BuilderField>

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              What will this form collect?
            </p>
            <RadioGroup
              value={kind}
              onValueChange={(value) => setKind(String(value) as FormKind)}
            >
              {FORM_KINDS.map((option) => (
                <FieldLabel
                  key={option.value}
                  htmlFor={`${id}-${option.value}`}
                >
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle className="gap-2">
                        <option.icon
                          size={16}
                          aria-hidden
                          className="text-primary"
                        />
                        {option.label}
                      </FieldTitle>
                      <FieldDescription>{option.description}</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem
                      id={`${id}-${option.value}`}
                      value={option.value}
                      aria-label={option.label}
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </div>

          <InfoNote>
            We'll start you off with the questions most events ask — title,
            description, format, track, level, language and tags — plus speaker
            details. Keep what you need, change the rest.
          </InfoNote>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={creating || !event}>
              {creating ? "Creating…" : "Create form"}
              <RiArrowRightLine aria-hidden />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

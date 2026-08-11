import { useId, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiArrowLeftLine, RiArrowRightLine, RiSettings3Line } from "@remixicon/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { useCurrentEvent } from "@/components/dashboard/use-current-event"
import { BuilderField, InfoNote } from "@/components/forms-builder/builder-controls"
import { FORM_KINDS, friendlyError } from "@/components/forms-builder/model"
import type { FormKind } from "@/components/forms-builder/model"

export const Route = createFileRoute("/app/forms/new")({
  component: NewFormPage,
})

/**
 * Create a form: a name and what it collects. Everything else has a sensible
 * default, so the organizer lands straight in the editor (docs/SPEC.md §4.2 —
 * "build a working CFP form in under five minutes").
 */
function NewFormPage() {
  const id = useId()
  const navigate = useNavigate()
  const { event, isEmpty } = useCurrentEvent()

  const [name, setName] = useState("Call for Speakers")
  const [kind, setKind] = useState<FormKind>("abstract")
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
      await navigate({ to: "/app/forms/$formId", params: { formId } })
    } catch (caught) {
      const message = friendlyError(caught, "We couldn't create that form.")
      setError(message)
      toast.error(message)
      setCreating(false)
    }
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="New submission form"
          description="Forms belong to an event."
        />
        <EmptyState
          icon={RiSettings3Line}
          title="Create your event first"
          description="Your event holds the deadline, tracks and speakers a form needs."
          action={
            <Link to="/app/settings" className={buttonVariants()}>
              Go to settings
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/forms"
        className={buttonVariants({ variant: "ghost", size: "sm" }) + " w-fit"}
      >
        <RiArrowLeftLine aria-hidden />
        Back to forms
      </Link>

      <PageHeader
        title="New submission form"
        description="Two quick choices and you're in the builder — you can change both later."
      />

      <Card className="max-w-2xl gap-6 p-6">
        <form onSubmit={(formEvent) => void submit(formEvent)} className="flex flex-col gap-6">
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
              className="sm:grid-cols-2"
            >
              {FORM_KINDS.map((option) => (
                <FieldLabel key={option.value} htmlFor={`${id}-${option.value}`}>
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

          <div className="flex items-center justify-end gap-2">
            <Link to="/app/forms" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <Button type="submit" disabled={creating || !event}>
              {creating ? "Creating…" : "Create form"}
              <RiArrowRightLine aria-hidden />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

import { useMemo, useRef, useState } from "react"
import { useBlocker } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { RiErrorWarningLine, RiSaveLine } from "@remixicon/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LabeledField } from "@/components/settings/labeled-field"
import { TimezoneSelect } from "@/components/settings/timezone-select"
import { DateTimePicker } from "@/components/settings/date-time-picker"
import { CopyLinkButton } from "@/components/settings/copy-link-button"
import { isValidSlug, publicEventUrl, slugify } from "@/components/settings/slug"
import type { EventSummary } from "@/components/settings/current-event"

/** Plain-English event types — the select in docs/ux/01 image25. */
export const EVENT_TYPES = [
  "Conference",
  "Summit",
  "Meetup",
  "Workshop",
  "Webinar",
  "Festival",
  "Training",
  "Other",
] as const

const DESCRIPTION_LIMIT = 1000

interface EventDraft {
  name: string
  slug: string
  type: string
  websiteUrl: string
  timezone: string
  venue: string
  description: string
  startsAt: number | undefined
  endsAt: number | undefined
}

type FieldKey = keyof EventDraft

function toDraft(event: EventSummary): EventDraft {
  return {
    name: event.name,
    slug: event.slug,
    type: event.type ?? "",
    websiteUrl: event.websiteUrl ?? "",
    timezone: event.timezone,
    venue: event.venue ?? "",
    description: event.description ?? "",
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  }
}

function validate(draft: EventDraft): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}
  if (!draft.name.trim()) {
    errors.name = "Give your event a name."
  }
  if (!draft.slug.trim()) {
    errors.slug = "The slug is your public web address — it can't be empty."
  } else if (!isValidSlug(draft.slug)) {
    errors.slug = "Use lowercase letters, numbers and dashes only."
  }
  if (!draft.timezone) {
    errors.timezone = "Pick the timezone your event runs in."
  }
  if (draft.websiteUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(draft.websiteUrl.trim())) {
    errors.websiteUrl = "Include the full address, starting with https://"
  }
  if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) {
    errors.endsAt = "The end has to come after the start."
  }
  return errors
}

/**
 * Event details — SPEC §4.1 / docs/ux/01 image25: a two-column stacked-label
 * form with real pickers, a live public-URL preview, a dirty-state guard and a
 * single Save at the bottom.
 *
 * Mount with `key={event._id}` so switching events remounts a clean draft.
 */
export function EventDetailsForm({ event }: { event: EventSummary }) {
  const initial = useRef<EventDraft>(toDraft(event))
  const [draft, setDraft] = useState<EventDraft>(initial.current)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [submitted, setSubmitted] = useState(false)

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial.current),
    [draft],
  )

  const save = useMutation({
    mutationFn: useConvexMutation(api.events.update),
  })

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty && !save.isPending,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  })

  function set<TKey extends FieldKey>(key: TKey, value: EventDraft[TKey]) {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (submitted) setErrors(validate(next))
      return next
    })
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault()
    setSubmitted(true)
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error("Missing required fields — check the highlighted boxes.")
      return
    }

    try {
      await save.mutateAsync({
        eventId: event._id,
        patch: {
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          type: draft.type || undefined,
          websiteUrl: draft.websiteUrl.trim() || undefined,
          timezone: draft.timezone,
          venue: draft.venue.trim() || undefined,
          description: draft.description.trim() || undefined,
          startsAt: draft.startsAt,
          endsAt: draft.endsAt,
        },
      })
      // New object identity so `isDirty` recomputes and the guard stands down.
      const saved = { ...draft }
      initial.current = saved
      setDraft(saved)
      toast.success("Event settings saved")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't save your changes. Please try again.",
      )
    }
  }

  function discard() {
    setDraft(initial.current)
    setErrors({})
    setSubmitted(false)
  }

  const publicUrl = publicEventUrl(draft.slug || event.slug)

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Event details</CardTitle>
            <CardDescription>
              The basics: what your event is called, when it happens, and where.
              Speakers see this on your public page and in every email.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <LabeledField
                label="Event name"
                htmlFor="event-name"
                required
                error={errors.name}
                hint="The name speakers and attendees will recognise, e.g. “AI Engineer Summit 2026”."
              >
                <Input
                  id="event-name"
                  value={draft.name}
                  aria-invalid={errors.name ? true : undefined}
                  placeholder="AI Engineer Sandbox Event"
                  onChange={(e) => set("name", e.target.value)}
                />
              </LabeledField>

              <LabeledField
                label="Event slug"
                htmlFor="event-slug"
                required
                error={errors.slug}
                hint="The short, lowercase name used in your public web address. Changing it changes the link you've shared."
                description={
                  <span className="flex flex-wrap items-center gap-1">
                    <span>Public page:</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      {publicUrl}
                    </code>
                  </span>
                }
              >
                <Input
                  id="event-slug"
                  value={draft.slug}
                  aria-invalid={errors.slug ? true : undefined}
                  placeholder="ai-engineer-sandbox-event"
                  onChange={(e) => set("slug", slugify(e.target.value))}
                />
              </LabeledField>

              <LabeledField
                label="Event type"
                htmlFor="event-type"
                hint="Helps us word your emails and public page. Purely descriptive."
              >
                <Select
                  value={draft.type}
                  onValueChange={(value) => set("type", String(value ?? ""))}
                >
                  <SelectTrigger id="event-type" className="h-9 w-full">
                    <SelectValue placeholder="Choose a type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>

              <LabeledField
                label="Event website"
                htmlFor="event-website"
                error={errors.websiteUrl}
                hint="Where people can read more about the event. Linked from your public page."
              >
                <Input
                  id="event-website"
                  type="url"
                  inputMode="url"
                  value={draft.websiteUrl}
                  aria-invalid={errors.websiteUrl ? true : undefined}
                  placeholder="https://ai.engineer"
                  onChange={(e) => set("websiteUrl", e.target.value)}
                />
              </LabeledField>

              <LabeledField
                label="Venue or location"
                htmlFor="event-venue"
                hint="Shown to speakers and included in calendar invites, e.g. “Convene, 117 W 46th St, New York”."
              >
                <Input
                  id="event-venue"
                  value={draft.venue}
                  placeholder="New York, NY"
                  onChange={(e) => set("venue", e.target.value)}
                />
              </LabeledField>

              <LabeledField
                label="Timezone"
                htmlFor="event-timezone"
                required
                error={errors.timezone}
                hint="Every date and time in Sessionboard — deadlines, agenda slots, calendar invites — is shown in this timezone."
              >
                <TimezoneSelect
                  id="event-timezone"
                  value={draft.timezone}
                  invalid={Boolean(errors.timezone)}
                  onValueChange={(value) => set("timezone", value)}
                />
              </LabeledField>

              <LabeledField
                label="Starts at"
                htmlFor="event-starts"
                error={errors.startsAt}
                hint="The first session of your event, in the event timezone."
              >
                <DateTimePicker
                  id="event-starts"
                  value={draft.startsAt}
                  timezone={draft.timezone}
                  defaultTime="09:00"
                  placeholder="Pick the first day"
                  onChange={(value) => set("startsAt", value)}
                />
              </LabeledField>

              <LabeledField
                label="Ends at"
                htmlFor="event-ends"
                error={errors.endsAt}
                hint="When the last session wraps up, in the event timezone."
              >
                <DateTimePicker
                  id="event-ends"
                  value={draft.endsAt}
                  timezone={draft.timezone}
                  defaultTime="17:00"
                  placeholder="Pick the last day"
                  invalid={Boolean(errors.endsAt)}
                  onChange={(value) => set("endsAt", value)}
                />
              </LabeledField>
            </div>

            <LabeledField
              label="Description"
              htmlFor="event-description"
              description="A short paragraph about your event. It appears on the public page and at the top of your call for speakers."
            >
              <div className="relative">
                <Textarea
                  id="event-description"
                  rows={5}
                  maxLength={DESCRIPTION_LIMIT}
                  value={draft.description}
                  placeholder="A hands-on gathering for AI engineers — two days of talks, workshops and hallway track."
                  onChange={(e) => set("description", e.target.value)}
                  className="min-h-32 pb-7"
                />
                <span className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-muted-foreground">
                  {draft.description.length} / {DESCRIPTION_LIMIT}
                </span>
              </div>
            </LabeledField>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending || !isDirty}>
              <RiSaveLine size={16} aria-hidden />
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!isDirty || save.isPending}
              onClick={discard}
            >
              Discard
            </Button>
            <CopyLinkButton url={publicUrl} variant="outline" size="default" />
            <span
              className={cn(
                "ml-auto flex items-center gap-1.5 text-xs",
                isDirty ? "text-status-amber-fg" : "text-muted-foreground",
              )}
            >
              {isDirty ? (
                <>
                  <RiErrorWarningLine size={14} aria-hidden />
                  You have unsaved changes
                </>
              ) : (
                "All changes saved"
              )}
            </span>
          </div>
        </div>
      </form>

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You've changed your event details but haven't saved yet. If you
              leave now those changes are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Stay on this page
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => blocker.proceed?.()}
            >
              Leave and discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { RiAddLine } from "@remixicon/react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LabeledField } from "@/components/settings/labeled-field"
import { TimezoneSelect } from "@/components/settings/timezone-select"
import { browserTimezone } from "@/components/settings/timezone"
import { isValidSlug, publicEventUrl, slugify } from "@/components/settings/slug"
import { setCurrentEventId } from "@/lib/current-event"
import { errorMessage } from "@/components/settings/errors"

/**
 * "New event" — the multi-event entry point (sbek CFP-17). Three fields only:
 * name, public slug, timezone. Everything else is set later in Settings, so
 * creating a second event never feels like a project.
 */
export function NewEventDialog({
  label = "New event",
  variant = "default",
  size = "default",
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
}: {
  label?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  /** Render the dialog only — drive it with `open` / `onOpenChange`. */
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const navigate = useNavigate()
  const { data: workspaces } = useQuery(convexQuery(api.workspaces.mine, {}))
  const create = useMutation({ mutationFn: useConvexMutation(api.events.create) })

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [timezone, setTimezone] = useState(browserTimezone)
  const [organizationId, setOrganizationId] = useState<string | undefined>()
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({})

  const workspaceId = organizationId ?? workspaces?.[0]?.id

  function handleName(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors: { name?: string; slug?: string } = {}
    if (!name.trim()) nextErrors.name = "Give your event a name."
    if (!slug.trim()) {
      nextErrors.slug = "We need a short name for the public web address."
    } else if (!isValidSlug(slug)) {
      nextErrors.slug = "Use lowercase letters, numbers and dashes only."
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (!workspaceId) {
      toast.error("Your workspace is still being set up — reload and try again.")
      return
    }

    try {
      const eventId = await create.mutateAsync({
        organizationId: workspaceId as Id<"organizations">,
        name: name.trim(),
        slug: slug.trim(),
        timezone,
      })
      setCurrentEventId(eventId)
      toast.success(`“${name.trim()}” created — you're now working on it`)
      setOpen(false)
      setName("")
      setSlug("")
      setSlugTouched(false)
      setErrors({})
      await navigate({ to: "/app/settings" })
    } catch (caught) {
      const message = errorMessage(caught, "Couldn't create that event.")
      if (message.toLowerCase().includes("slug")) {
        setErrors({ slug: message })
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant={variant}
          size={size}
          onClick={() => setOpen(true)}
        >
          <RiAddLine size={16} aria-hidden />
          {label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Create an event</DialogTitle>
              <DialogDescription>
                Each event keeps its own submissions, speakers, agenda and
                settings. Nothing is shared between events.
              </DialogDescription>
            </DialogHeader>

            <LabeledField
              label="Event name"
              htmlFor="new-event-name"
              required
              error={errors.name}
            >
              <Input
                id="new-event-name"
                value={name}
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                placeholder="AI Engineer Summit 2027"
                onChange={(event) => handleName(event.target.value)}
              />
            </LabeledField>

            <LabeledField
              label="Public web address"
              htmlFor="new-event-slug"
              required
              error={errors.slug}
              description="We fill this in from the name — change it if you like."
              footer={
                slug ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {publicEventUrl(slug)}
                  </code>
                ) : null
              }
            >
              <Input
                id="new-event-slug"
                value={slug}
                autoComplete="off"
                aria-invalid={errors.slug ? true : undefined}
                placeholder="ai-engineer-summit-2027"
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(slugify(event.target.value))
                }}
              />
            </LabeledField>

            <LabeledField
              label="Timezone"
              htmlFor="new-event-timezone"
              required
              description="All dates and deadlines are shown in this timezone."
            >
              <TimezoneSelect
                id="new-event-timezone"
                value={timezone}
                onValueChange={setTimezone}
              />
            </LabeledField>

            {workspaces && workspaces.length > 1 ? (
              <LabeledField
                label="Workspace"
                htmlFor="new-event-workspace"
                description="Everyone in this workspace will be able to work on the event."
              >
                <Select
                  value={workspaceId}
                  onValueChange={(value) => setOrganizationId(String(value))}
                >
                  <SelectTrigger id="new-event-workspace" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

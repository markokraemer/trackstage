import * as React from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { DateTimePicker } from "@/components/settings/date-time-picker"
import { errorMessage } from "@/lib/errors"

export interface SponsorPortalRules {
  newSessionStatus: "pending" | "accepted"
  closeAt: number | null
  allowColleagueInvites: boolean
}

const STATUS_CHOICES: Array<{
  value: SponsorPortalRules["newSessionStatus"]
  title: string
  body: string
}> = [
  {
    value: "pending",
    title: "Pending — I review them first",
    body: "Sponsor sessions land in Submissions as Pending, like any proposal. Accept them when you're happy.",
  },
  {
    value: "accepted",
    title: "Accepted — straight onto the program",
    body: "For packages that guarantee a slot: sessions go directly to the agenda's unscheduled tray.",
  },
]

/**
 * The two event-wide sponsor portal rules: what a session a sponsor adds
 * starts as, and the date after which sponsors can no longer add or edit
 * them (the agenda freeze). Everything else is per sponsor, in its drawer.
 */
export function SponsorPortalSettingsDialog({
  eventId,
  timezone,
  rules,
  open,
  onOpenChange,
}: {
  eventId: Id<"events">
  timezone: string
  rules: SponsorPortalRules
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useConvexMutation(api.sponsors.updatePortalRules)
  const [status, setStatus] = React.useState(rules.newSessionStatus)
  const [closeAt, setCloseAt] = React.useState<number | undefined>(
    rules.closeAt ?? undefined,
  )
  const [invites, setInvites] = React.useState(rules.allowColleagueInvites)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setStatus(rules.newSessionStatus)
    setCloseAt(rules.closeAt ?? undefined)
    setInvites(rules.allowColleagueInvites)
  }, [open, rules.newSessionStatus, rules.closeAt, rules.allowColleagueInvites])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await save({
        eventId,
        newSessionStatus: status,
        closeAt: closeAt ?? null,
        allowColleagueInvites: invites,
      })
      toast.success("Sponsor portal settings saved")
      onOpenChange(false)
    } catch (error) {
      toast.error("Couldn't save the settings", {
        description: errorMessage(error, "Please try again."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] grid-rows-[auto_minmax(0,1fr)] gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sponsor portal settings</DialogTitle>
          <DialogDescription>
            Applies to every sponsor on this event. Each sponsor's own session
            allowance is set in its drawer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-col">
          <FieldGroup className="-mr-2 min-h-0 flex-1 gap-6 overflow-y-auto pr-2">
            <FieldSet>
              <FieldLegend variant="label">New sponsor sessions start as</FieldLegend>
              <RadioGroup
                value={status}
                onValueChange={(value) =>
                  setStatus(value === "accepted" ? "accepted" : "pending")
                }
                aria-label="New sponsor sessions start as"
                className="gap-2"
              >
                {STATUS_CHOICES.map((choice) => (
                  <label
                    key={choice.value}
                    htmlFor={`sponsor-status-${choice.value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
                  >
                    <RadioGroupItem
                      id={`sponsor-status-${choice.value}`}
                      value={choice.value}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      <span className="block font-medium text-foreground">
                        {choice.title}
                      </span>
                      <span className="block text-muted-foreground">{choice.body}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="sponsor-close-at">Sponsors can add and edit sessions until</FieldLabel>
              <FieldDescription>
                Leave empty to keep it open. After this moment the portal shows
                their sessions read-only and points them to you for changes.
              </FieldDescription>
              <DateTimePicker
                id="sponsor-close-at"
                value={closeAt}
                onChange={setCloseAt}
                timezone={timezone}
                placeholder="No deadline"
              />
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="sponsor-colleagues">Contacts can add colleagues</FieldLabel>
                <FieldDescription>
                  Lets a sponsor bring in a teammate themselves. Turn off to add
                  every contact yourself.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="sponsor-colleagues"
                checked={invites}
                onCheckedChange={(value) => setInvites(value === true)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

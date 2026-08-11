import { useState } from "react"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import type { EventSummary } from "@/lib/current-event"
import { errorMessage } from "@/lib/errors"

/**
 * Settings → Event details → Speaker portal (product-map delta #6, the
 * high-value subset of Sessionboard's per-portal Configuration step).
 *
 * Three switches, each an opt-in restriction: everything is ON until the
 * organizer decides otherwise, so nobody has to visit this card to get a
 * working portal. Saving is instant (rule 26) — the switch moves, the write
 * goes out behind it, and only a failure moves it back.
 */

export interface PortalBehaviorFlags {
  alwaysShowTasks: boolean
  allowSubmissionEdits: boolean
  extendTaskDeadlines: boolean
}

/** The permissive defaults — must match `portalBehavior` in convex/portal.ts. */
export function portalBehaviorOf(event: EventSummary): PortalBehaviorFlags {
  const settings = event.portalSettings
  return {
    alwaysShowTasks: settings?.alwaysShowTasks ?? true,
    allowSubmissionEdits: settings?.allowSubmissionEdits ?? true,
    extendTaskDeadlines: settings?.extendTaskDeadlines ?? true,
  }
}

const SWITCHES: Array<{
  key: keyof PortalBehaviorFlags
  label: string
  on: string
  off: string
}> = [
  {
    key: "alwaysShowTasks",
    label: "Show tasks to everyone with portal access",
    on: "Everyone who submits can see their task list as soon as they sign in.",
    off: "Only speakers with an accepted session see the Tasks tab. Everyone else sees their submissions and profile.",
  },
  {
    key: "allowSubmissionEdits",
    label: "Let speakers edit their own submissions",
    on: "Speakers can update the title, description and answers of a talk from their portal.",
    off: "Submissions are read-only in the portal. Speakers are told to email you with changes instead.",
  },
  {
    key: "extendTaskDeadlines",
    label: "Accept tasks after the due date",
    on: "A speaker who misses a due date can still upload or tick the task off.",
    off: "Once a task is past due it closes, and only you can reopen it by changing the date.",
  },
]

export function PortalBehaviorCard({ event }: { event: EventSummary }) {
  const [flags, setFlags] = useState<PortalBehaviorFlags>(() =>
    portalBehaviorOf(event),
  )
  const update = useConvexMutation(api.events.update)

  async function toggle(key: keyof PortalBehaviorFlags, value: boolean) {
    const previous = flags
    const next = { ...flags, [key]: value }
    setFlags(next) // instant echo; the write follows
    try {
      await update({ eventId: event._id, patch: { portalSettings: next } })
    } catch (error) {
      setFlags(previous)
      toast.error(errorMessage(error, "Couldn't save that. Please try again."))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speaker portal</CardTitle>
        <CardDescription>
          What your speakers can do once they sign in to their portal. Changes
          take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        {SWITCHES.map((row) => {
          const id = `portal-${row.key}`
          const checked = flags[row.key]
          return (
            <Field key={row.key} orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={id} className="text-sm font-medium">
                  {row.label}
                </FieldLabel>
                <FieldDescription>
                  {checked ? row.on : row.off}
                </FieldDescription>
              </FieldContent>
              <Switch
                id={id}
                checked={checked}
                onCheckedChange={(value) => void toggle(row.key, Boolean(value))}
              />
            </Field>
          )
        })}
      </CardContent>
    </Card>
  )
}

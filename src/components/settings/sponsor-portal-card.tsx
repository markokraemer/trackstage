import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import { toast } from "sonner"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateTimePicker } from "@/components/settings/date-time-picker"
import type { EventSummary } from "@/lib/current-event"
import { errorMessage } from "@/lib/errors"

type SponsorPortalRules = FunctionReturnType<typeof api.sponsors.settings>["rules"]

/** Select sentinel for "no explicit pick — the primary CFP". */
const PRIMARY = "__primary__"

const STATUS_CHOICES: Array<{
  value: SponsorPortalRules["newSessionStatus"]
  title: string
  body: string
}> = [
  {
    value: "pending",
    title: "Pending — you review them first",
    body: "Sponsor sessions land in Submissions as Pending, like any proposal.",
  },
  {
    value: "accepted",
    title: "Accepted — straight onto the program",
    body: "For packages that guarantee a slot: they go to the agenda's unscheduled tray.",
  },
]

/**
 * Settings → Event details → Sponsor portal: the sponsor-side twin of the
 * Speaker portal card beside it, and saved the same way — instantly (rule
 * 26): the control moves, the write goes out behind it, and only a failure
 * moves it back.
 */
export function SponsorPortalCard({ event }: { event: EventSummary }) {
  const { data } = useQuery(
    convexQuery(api.sponsors.settings, { eventId: event._id }),
  )
  const update = useConvexMutation(api.sponsors.updatePortalRules)
  const [rules, setRules] = useState<SponsorPortalRules | null>(null)

  // Follow the server until the organizer touches something here.
  useEffect(() => {
    if (data) setRules(data.rules)
  }, [data])

  async function save(patch: Partial<SponsorPortalRules>) {
    if (!rules) return
    const previous = rules
    setRules({ ...rules, ...patch }) // instant echo; the write follows
    try {
      await update({ eventId: event._id, ...patch })
    } catch (error) {
      setRules(previous)
      toast.error(errorMessage(error, "Couldn't save that. Please try again."))
    }
  }

  return (
    <Card id="sponsor-portal" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Sponsor portal</CardTitle>
        <CardDescription>
          What sponsor contacts can do once they sign in to add their sessions.
          Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="gap-5">
        {!rules ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : (
          <>
            <Field>
              <FieldLabel>New sponsor sessions start as</FieldLabel>
              <RadioGroup
                value={rules.newSessionStatus}
                onValueChange={(value) =>
                  void save({ newSessionStatus: value === "accepted" ? "accepted" : "pending" })
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
                      <span className="block font-medium text-foreground">{choice.title}</span>
                      <span className="block text-muted-foreground">{choice.body}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </Field>

            {data && data.forms.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="sponsor-session-form">Sponsor sessions answer the questions on</FieldLabel>
                <FieldDescription>
                  The same title, description, track, format, level, tags and custom questions
                  your speakers answer — with the same required fields. File uploads are left
                  out; collect those with tasks.
                </FieldDescription>
                <Select
                  items={[
                    {
                      value: PRIMARY,
                      label: `Your main call for speakers${primaryName(data) ? ` — ${primaryName(data)}` : ""}`,
                    },
                    ...data.forms.map((f) => ({ value: f._id, label: f.name })),
                  ]}
                  value={rules.formId ?? PRIMARY}
                  onValueChange={(value) =>
                    void save({ formId: value === PRIMARY ? null : (value as SponsorPortalRules["formId"]) })
                  }
                >
                  <SelectTrigger id="sponsor-session-form" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PRIMARY}>
                      Your main call for speakers{primaryName(data) ? ` — ${primaryName(data)}` : ""}
                    </SelectItem>
                    {data.forms.map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="sponsor-close-at">
                Sponsors can add and edit sessions until
              </FieldLabel>
              <FieldDescription>
                Leave empty to keep it open. After this, their sessions are read-only in the portal.
              </FieldDescription>
              <DateTimePicker
                id="sponsor-close-at"
                value={rules.closeAt ?? undefined}
                onChange={(value) => void save({ closeAt: value ?? null })}
                timezone={event.timezone}
                placeholder="No deadline"
              />
            </Field>

            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="sponsor-colleagues" className="text-sm font-medium">
                  Let sponsor contacts invite colleagues
                </FieldLabel>
                <FieldDescription>
                  {rules.allowColleagueInvites
                    ? "A contact can bring a teammate into their company's portal themselves."
                    : "Only your team adds sponsor contacts."}
                </FieldDescription>
              </FieldContent>
              <Switch
                id="sponsor-colleagues"
                checked={rules.allowColleagueInvites}
                onCheckedChange={(value) => void save({ allowColleagueInvites: Boolean(value) })}
              />
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** The form sponsor sessions use when nothing is picked. */
function primaryName(data: FunctionReturnType<typeof api.sponsors.settings>): string | undefined {
  return data.forms.find((f) => f._id === data.primaryFormId)?.name
}

import { RiCalendarEventLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatZonedDateRange } from "@/components/settings/timezone"

export interface AccessEvent {
  _id: string
  name: string
  startsAt?: number
  endsAt?: number
  timezone: string
}

/**
 * "All events" or "only these events" — the picker behind per-member event
 * scoping (docs/memory/RULES.md 23). Shared by the invite dialog and the
 * per-member edit dialog so an invite and a later change offer exactly the
 * same choice, worded the same way.
 *
 * `value === null` means all events, now and in future — which is what an
 * absent `member.eventIds` means on the server. The checkbox list is disabled
 * rather than hidden while "All events" is selected, so the shape of the
 * decision stays visible.
 */
export function EventAccessPicker({
  events,
  value,
  onChange,
  idPrefix,
}: {
  events: Array<AccessEvent>
  value: Array<string> | null
  onChange: (next: Array<string> | null) => void
  /** Namespaces the input ids when two pickers can be mounted at once. */
  idPrefix: string
}) {
  const limited = value !== null
  const selected = new Set(value ?? [])

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={limited ? "some" : "all"}
        onValueChange={(next) => {
          onChange(next === "all" ? null : (value ?? []))
        }}
        aria-label="Event access"
      >
        <label
          htmlFor={`${idPrefix}-all`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
        >
          <RadioGroupItem value="all" id={`${idPrefix}-all`} className="mt-0.5" />
          <span className="text-sm">
            <span className="block font-medium text-foreground">All events</span>
            <span className="block text-muted-foreground">
              Everything in this workspace, including events created later.
            </span>
          </span>
        </label>

        <label
          htmlFor={`${idPrefix}-some`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
        >
          <RadioGroupItem
            value="some"
            id={`${idPrefix}-some`}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="block font-medium text-foreground">
              Only selected events
            </span>
            <span className="block text-muted-foreground">
              Every other event is hidden from them completely.
            </span>
          </span>
        </label>
      </RadioGroup>

      <div
        className={cn(
          "flex flex-col gap-1 rounded-lg border border-border p-1.5 transition-opacity",
          !limited && "pointer-events-none opacity-45",
        )}
        aria-hidden={!limited}
      >
        {events.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            This workspace has no events yet.
          </p>
        ) : (
          events.map((event) => {
            const dates = formatZonedDateRange(
              event.startsAt,
              event.endsAt,
              event.timezone,
            )
            const checked = selected.has(event._id)
            return (
              <label
                key={event._id}
                htmlFor={`${idPrefix}-event-${event._id}`}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
              >
                <Checkbox
                  id={`${idPrefix}-event-${event._id}`}
                  checked={checked}
                  disabled={!limited}
                  onCheckedChange={(next) => {
                    const nextSet = new Set(selected)
                    if (next) nextSet.add(event._id)
                    else nextSet.delete(event._id)
                    onChange([...nextSet])
                  }}
                />
                <RiCalendarEventLine
                  size={16}
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-medium text-foreground">
                    {event.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {dates ?? "Dates not set"}
                  </span>
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

/** The one-line summary shown in the Access column and in toasts. */
export function accessSummary(
  eventIds: Array<string> | undefined,
  events: Array<AccessEvent>,
): string {
  if (eventIds === undefined) return "All events"
  if (eventIds.length === 1) {
    return events.find((row) => row._id === eventIds[0])?.name ?? "1 event"
  }
  return `${eventIds.length} events`
}

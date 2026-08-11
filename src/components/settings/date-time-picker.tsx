import { useMemo, useState } from "react"
import { RiCalendar2Line, RiCloseLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatTimeValue,
  formatZonedDateTime,
  minutesToTimeValue,
  timeOptions,
  timeValueToParts,
  timezoneAbbreviation,
  utcMsToZoned,
  zonedToUtcMs,
} from "@/components/settings/timezone"

/**
 * Date + time picker that thinks in the event's timezone (docs/ux/01 image25:
 * "October 12th, 2026 at 9:00 AM" + a "PDT" chip + a clear button).
 *
 * Composes the shadcn `Calendar`, `Popover` and `Select` primitives — never a
 * raw text field for a date (docs/SPEC.md §2.2).
 */
export interface DateTimePickerProps {
  id?: string
  /** Epoch milliseconds, or undefined when nothing is picked yet. */
  value?: number
  onChange: (value: number | undefined) => void
  /** IANA zone the wall-clock time is expressed in. */
  timezone: string
  placeholder?: string
  /** Default time-of-day applied when a date is picked first. */
  defaultTime?: string
  invalid?: boolean
  className?: string
}

const OPTIONS = timeOptions(15)

export function DateTimePicker({
  id,
  value,
  onChange,
  timezone,
  placeholder = "Pick a date and time",
  defaultTime = "09:00",
  invalid,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)

  const zoned = useMemo(
    () => (value === undefined ? undefined : utcMsToZoned(timezone, value)),
    [value, timezone],
  )

  // The calendar renders in browser-local time, so feed it a "floating" date
  // carrying only the event-timezone calendar day.
  const selectedDay = useMemo(
    () =>
      zoned ? new Date(zoned.year, zoned.month - 1, zoned.day, 12, 0, 0) : undefined,
    [zoned],
  )

  const timeValue = zoned
    ? minutesToTimeValue(zoned.hour, zoned.minute)
    : defaultTime

  // A picker step never produces a half-set value: picking a day keeps the
  // current time, picking a time keeps the current day (or today).
  function commit(day: Date | undefined, time: string) {
    if (!day) {
      onChange(undefined)
      return
    }
    const { hour, minute } = timeValueToParts(time)
    onChange(
      zonedToUtcMs(timezone, {
        year: day.getFullYear(),
        month: day.getMonth() + 1,
        day: day.getDate(),
        hour,
        minute,
      }),
    )
  }

  const abbreviation = timezoneAbbreviation(timezone, value ?? Date.now())

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              aria-invalid={invalid || undefined}
              className={cn(
                "h-9 min-w-0 flex-1 justify-between px-3 font-normal",
                invalid && "border-destructive ring-3 ring-destructive/20",
              )}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <RiCalendar2Line
              size={16}
              aria-hidden
              className="shrink-0 text-muted-foreground"
            />
            <span
              className={cn("truncate", value === undefined && "text-muted-foreground")}
            >
              {value === undefined
                ? placeholder
                : formatZonedDateTime(value, timezone)}
            </span>
          </span>
          {abbreviation ? (
            <Badge
              variant="secondary"
              className="ml-2 shrink-0 rounded-md px-1.5 text-[11px] font-medium"
            >
              {abbreviation}
            </Badge>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            autoFocus
            selected={selectedDay}
            defaultMonth={selectedDay}
            onSelect={(day) => commit(day ?? undefined, timeValue)}
          />
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Label
              htmlFor={id ? `${id}-time` : undefined}
              className="text-xs font-medium text-muted-foreground"
            >
              Time
            </Label>
            <Select
              value={timeValue}
              onValueChange={(next) =>
                commit(selectedDay ?? new Date(), String(next))
              }
            >
              <SelectTrigger
                id={id ? `${id}-time` : undefined}
                className="h-8 flex-1"
                aria-label="Time"
              >
                <SelectValue>
                  {(current) => formatTimeValue(String(current ?? timeValue))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="shrink-0 text-xs text-muted-foreground">
              {abbreviation}
            </span>
          </div>
        </PopoverContent>
      </Popover>

      {value === undefined ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date"
          onClick={() => onChange(undefined)}
        >
          <RiCloseLine size={16} aria-hidden />
        </Button>
      )}
    </div>
  )
}

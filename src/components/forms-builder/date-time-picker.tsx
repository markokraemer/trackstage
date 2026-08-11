import { useId, useState } from "react"
import { format } from "date-fns"
import { RiCalendarLine, RiCloseLine, RiTimeLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

/**
 * Date + time picker — a real calendar in a popover and a real time select,
 * never a raw text field (docs/SPEC.md §2.2, Marko's rule 3).
 *
 * Value is an epoch millisecond timestamp, or `null` when unset.
 */

/** Every half hour, plus 11:59 PM — the deadline organizers actually pick. */
const TIME_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const options: Array<{ value: string; label: string }> = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const date = new Date(2000, 0, 1, hour, minute)
    options.push({
      value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      label: format(date, "h:mm a"),
    })
  }
  options.push({ value: "23:59", label: "11:59 PM" })
  return options
})()

/** value → label, so the trigger reads "11:59 PM" and not "23:59". */
const TIME_LABELS: Record<string, string> = Object.fromEntries(
  TIME_OPTIONS.map((option) => [option.value, option.label]),
)

function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export interface DateTimePickerProps {
  value: number | null
  onValueChange: (value: number | null) => void
  /** Text on the empty date button. */
  placeholder?: string
  /** Small chip after the controls, e.g. the event timezone. */
  timezoneLabel?: string
  clearLabel?: string
  id?: string
}

export function DateTimePicker({
  value,
  onValueChange,
  placeholder = "Select a date",
  timezoneLabel,
  clearLabel = "Clear",
  id,
}: DateTimePickerProps) {
  const generatedId = useId()
  const buttonId = id ?? generatedId
  const [open, setOpen] = useState(false)

  const selected = value === null ? null : new Date(value)
  const timeValue = selected ? toTimeValue(selected) : "23:59"

  function handleDaySelect(day: Date | undefined) {
    if (!day) {
      onValueChange(null)
      setOpen(false)
      return
    }
    const [hours, minutes] = timeValue.split(":").map(Number)
    const next = new Date(day)
    next.setHours(hours, minutes, 0, 0)
    onValueChange(next.getTime())
    setOpen(false)
  }

  function handleTimeChange(next: string) {
    const [hours, minutes] = next.split(":").map(Number)
    const base = selected ? new Date(selected) : new Date()
    base.setHours(hours, minutes, 0, 0)
    onValueChange(base.getTime())
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={buttonId}
              type="button"
              variant="outline"
              className="min-w-[190px] justify-start font-normal"
            />
          }
        >
          <RiCalendarLine size={16} aria-hidden className="text-primary" />
          {selected ? (
            format(selected, "EEE, MMM d, yyyy")
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            autoFocus
            selected={selected ?? undefined}
            onSelect={handleDaySelect}
            className="p-2"
          />
        </PopoverContent>
      </Popover>

      <Select
        value={timeValue}
        items={TIME_LABELS}
        onValueChange={(next) => handleTimeChange(String(next))}
      >
        <SelectTrigger
          aria-label="Time"
          className="min-w-[130px] font-normal"
          disabled={!selected}
        >
          <RiTimeLine size={15} aria-hidden className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {TIME_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {timezoneLabel ? (
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          {timezoneLabel}
        </span>
      ) : null}

      {selected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onValueChange(null)}
        >
          <RiCloseLine size={15} aria-hidden />
          {clearLabel}
        </Button>
      ) : null}
    </div>
  )
}

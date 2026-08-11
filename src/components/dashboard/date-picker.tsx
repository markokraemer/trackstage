import { useState } from "react"
import { format } from "date-fns"
import { RiCalendar2Line, RiCloseLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerProps {
  /** Selected day as an epoch timestamp (local midnight). */
  value?: number
  onValueChange: (value: number | undefined) => void
  id?: string
  placeholder?: string
  /** Days before this are not selectable. Defaults to today. */
  fromDate?: Date
  className?: string
}

/**
 * Date picker: a real calendar in a popover, never a raw text field
 * (docs/SPEC.md §2.2). Composes the shadcn `Popover` + `Calendar` primitives.
 */
export function DatePicker({
  value,
  onValueChange,
  id,
  placeholder = "Pick a date",
  fromDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(value) : undefined

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start font-normal",
                !selected && "text-muted-foreground",
              )}
            />
          }
        >
          <RiCalendar2Line aria-hidden />
          {selected ? format(selected, "EEE, MMM d, yyyy") : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={fromDate ? { before: fromDate } : undefined}
            onSelect={(day) => {
              onValueChange(day ? day.getTime() : undefined)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date"
          onClick={() => onValueChange(undefined)}
        >
          <RiCloseLine aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

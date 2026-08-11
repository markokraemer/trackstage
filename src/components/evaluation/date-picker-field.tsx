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

/**
 * Date picker — a real calendar in a popover, never a raw text field
 * (docs/SPEC.md §2.2). Built on the shadcn `Calendar` + `Popover` + `Button`
 * primitives.
 */
export interface DatePickerFieldProps {
  id?: string
  /** Selected day, or `undefined` for "not set". */
  value: Date | undefined
  onChange: (value: Date | undefined) => void
  placeholder?: string
  /** Show the little "clear" button when a date is set. */
  clearable?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  clearable = true,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={ariaLabel ?? placeholder}
              className="h-9 w-full justify-start gap-2 px-3 font-normal"
            />
          }
        >
          <RiCalendar2Line aria-hidden className="text-muted-foreground" />
          {value ? (
            format(value, "EEE, MMM d, yyyy")
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            autoFocus
            onSelect={(day) => {
              onChange(day ?? undefined)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      {clearable && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear date"
          onClick={() => onChange(undefined)}
        >
          <RiCloseLine aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}

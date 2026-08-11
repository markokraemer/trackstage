import { useState } from "react"
import { RiCheckLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { STATUS_TONE_DOT_CLASS } from "@/components/shared/status-pill"
import { STATUS_TONE_OPTIONS } from "@/lib/status-catalog"
import type { StatusTone } from "@/lib/status-catalog"

/**
 * Colour-dot picker for a session status (Settings → Statuses).
 *
 * The five choices are the status tones from the design system, never raw
 * hexes — so a status pill in the submissions table and its swatch here are
 * literally the same token.
 *
 * Built on the shadcn `Popover` + `Button`: the trigger IS the dot, so the
 * swatch doubles as the current value. Same shape as `TrackColorPicker`.
 */
export function StatusColorPicker({
  value,
  onValueChange,
  statusName,
  disabled,
}: {
  value: StatusTone
  onValueChange: (color: StatusTone) => void
  /** Used for the accessible name, e.g. "Colour for Waitlist". */
  statusName?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const currentLabel =
    STATUS_TONE_OPTIONS.find((tone) => tone.value === value)?.label ?? value

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              statusName
                ? `Colour for ${statusName} — currently ${currentLabel}`
                : `Status colour — currently ${currentLabel}`
            }
          />
        }
      >
        <span
          aria-hidden
          className={cn(
            "size-4 rounded-full ring-1 ring-foreground/15",
            STATUS_TONE_DOT_CLASS[value],
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <PopoverHeader>
          <PopoverTitle>Status colour</PopoverTitle>
          <PopoverDescription>
            Used on every status pill — the table, the drawer and the portal.
          </PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {STATUS_TONE_OPTIONS.map((tone) => {
            const selected = tone.value === value
            return (
              <button
                key={tone.value}
                type="button"
                aria-label={tone.label}
                aria-pressed={selected}
                onClick={() => {
                  onValueChange(tone.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg ring-1 ring-foreground/10 outline-none transition hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50",
                  STATUS_TONE_DOT_CLASS[tone.value],
                )}
              >
                {selected ? (
                  <RiCheckLine size={16} aria-hidden className="text-white" />
                ) : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

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

/** The eight track colours (docs/SPEC.md §4.1 "track color dots"). */
export const TRACK_COLORS = [
  { value: "#2F5CE0", name: "Blue" },
  { value: "#7C3AED", name: "Violet" },
  { value: "#DB2777", name: "Pink" },
  { value: "#DC2626", name: "Red" },
  { value: "#EA580C", name: "Orange" },
  { value: "#CA8A04", name: "Amber" },
  { value: "#059669", name: "Green" },
  { value: "#0891B2", name: "Teal" },
] as const

export function trackColorName(value: string): string {
  return (
    TRACK_COLORS.find(
      (color) => color.value.toLowerCase() === value.toLowerCase(),
    )?.name ?? "Custom"
  )
}

/** Next unused colour — so two new tracks never look identical. */
export function nextTrackColor(used: Array<string>): string {
  const taken = new Set(used.map((color) => color.toLowerCase()))
  const free = TRACK_COLORS.find((color) => !taken.has(color.value.toLowerCase()))
  return (free ?? TRACK_COLORS[used.length % TRACK_COLORS.length]).value
}

/**
 * Colour-dot picker for a track. Built on the shadcn `Popover` + `Button`:
 * the trigger IS the dot, so the swatch doubles as the current value.
 */
export function TrackColorPicker({
  value,
  onValueChange,
  trackName,
}: {
  value: string
  onValueChange: (color: string) => void
  /** Used for the accessible name, e.g. "Colour for AI Engineering". */
  trackName?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              trackName
                ? `Colour for ${trackName} — currently ${trackColorName(value)}`
                : `Track colour — currently ${trackColorName(value)}`
            }
          />
        }
      >
        <span
          aria-hidden
          className="size-4 rounded-full ring-1 ring-foreground/15"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56">
        <PopoverHeader>
          <PopoverTitle>Track colour</PopoverTitle>
          <PopoverDescription>
            Used on agenda cards and submission tables.
          </PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {TRACK_COLORS.map((color) => {
            const selected = color.value.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={color.value}
                type="button"
                aria-label={color.name}
                aria-pressed={selected}
                onClick={() => {
                  onValueChange(color.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg ring-1 ring-foreground/10 outline-none transition hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
                style={{ backgroundColor: color.value }}
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

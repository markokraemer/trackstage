import { useMemo, useState } from "react"
import { RiArrowDownSLine, RiGlobalLine } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  allTimezones,
  browserTimezone,
  timezoneAbbreviation,
  timezoneLabel,
} from "@/components/settings/timezone"

/**
 * Searchable timezone picker — "Timezone" in the event settings form
 * (docs/SPEC.md §4.1: "Timezone (select with search)").
 *
 * Composes the shadcn `Popover` + `Command` combobox pattern rather than a
 * plain `Select`: there are ~430 IANA zones, so typing "new york" has to work.
 */
export interface TimezoneSelectProps {
  id?: string
  value: string
  onValueChange: (timezone: string) => void
  /** Marks the trigger invalid (red outline). */
  invalid?: boolean
  className?: string
}

const MAX_RESULTS = 80

export function TimezoneSelect({
  id,
  value,
  onValueChange,
  invalid,
  className,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const zones = useMemo(() => allTimezones(), [])
  const local = useMemo(() => browserTimezone(), [])

  const results = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/\s+/g, " ")
    const matches = query
      ? zones.filter((zone) =>
          `${zone.replace(/_/g, " ")} ${timezoneLabel(zone)}`
            .toLowerCase()
            .includes(query),
        )
      : [
          ...(zones.includes(local) ? [local] : []),
          ...zones.filter((zone) => zone !== local),
        ]
    return matches.slice(0, MAX_RESULTS)
  }, [search, zones, local])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            aria-invalid={invalid || undefined}
            className={cn(
              "h-9 w-full justify-between px-3 font-normal",
              invalid && "border-destructive ring-3 ring-destructive/20",
              className,
            )}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <RiGlobalLine size={16} aria-hidden className="text-muted-foreground" />
          <span className="truncate">
            {value ? timezoneLabel(value) : "Choose a timezone…"}
          </span>
        </span>
        <RiArrowDownSLine
          size={16}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cities or regions…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              No timezone matches “{search}”. Try a city, like “Berlin”.
            </CommandEmpty>
            {results.map((zone) => (
              <CommandItem
                key={zone}
                value={zone}
                data-checked={zone === value ? true : undefined}
                onSelect={() => {
                  onValueChange(zone)
                  setSearch("")
                  setOpen(false)
                }}
              >
                <span className="truncate">{timezoneLabel(zone)}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {timezoneAbbreviation(zone)}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

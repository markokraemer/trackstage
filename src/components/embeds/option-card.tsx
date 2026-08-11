/**
 * One selectable tile, shared by "Choose a widget" and "Choose a format".
 *
 * Both steps are the same question — pick one of these — so they get the same
 * control instead of two different-looking grids. Selection reads three ways at
 * once (primary border + ring, a filled icon chip, a check disc), which is what
 * makes the two-step choice legible at a glance: an organizer can see what is
 * picked without reading a word.
 */

import type { ReactNode } from "react"
import { RiCheckLine } from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"

export interface OptionCardProps {
  icon: RemixiconComponentType
  name: string
  description: string
  selected: boolean
  onSelect: () => void
  /** Small tag beside the name — "Recommended", "Snapshot". */
  badge?: ReactNode
}

export function OptionCard({
  icon: Icon,
  name,
  description,
  selected,
  onSelect,
  badge,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex h-full w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-foreground/20 hover:bg-muted/50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-foreground">{name}</span>
          {badge}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card",
        )}
      >
        {selected ? <RiCheckLine size={13} /> : null}
      </span>
    </button>
  )
}

/** The heading above a shelf of option cards. */
export function OptionGroupLabel({
  label,
  hint,
}: {
  label: string
  hint?: string
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-medium text-muted-foreground">
      <span className="tracking-wide uppercase">{label}</span>
      {hint ? <span className="font-normal normal-case">{hint}</span> : null}
    </p>
  )
}

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Track chip — the colored single-select that drives the whole program
 * (docs/AGENTS.md "canonical domain language"). Extends the shadcn `Badge`
 * with the track's own color as a dot, so a track reads the same on the public
 * pages as it does in the organizer's agenda.
 */
export interface TrackChipProps
  extends Omit<React.ComponentProps<typeof Badge>, "children" | "color"> {
  name: string
  color?: string | null
  /** Prefix the value with its field name, e.g. "Track: AI Engineering". */
  withLabel?: boolean
}

export function TrackChip({
  name,
  color,
  withLabel = false,
  className,
  ...props
}: TrackChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 gap-1.5 bg-card px-2 text-xs font-medium", className)}
      {...props}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
      />
      {withLabel ? `Track: ${name}` : name}
    </Badge>
  )
}

/** Neutral "Field: value" chip (Format, Level, Language, Room). */
export function MetaChip({
  label,
  value,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "children"> & {
  label: string
  value: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 bg-card px-2 text-xs font-normal text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span className="font-medium text-foreground">{label}:</span>&nbsp;{value}
    </Badge>
  )
}

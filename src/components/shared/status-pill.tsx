import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Status pill — the single source of truth for how a status looks and reads,
 * organizer-side and speaker-side (docs/SPEC.md §2.4, docs/ux/03).
 *
 * Extends the shadcn `Badge` primitive (pill shape, focus ring, icon sizing)
 * with the Trackstage status tone system.
 *
 * Color families: green = "will speak" (Accepted + Accept Queue), amber =
 * "undecided" (Pending + Decline Queue), red = final decline, gray = Draft /
 * Withdrawn. Queue states are staged decisions, so they carry a ring to read as
 * provisional next to their committed sibling.
 *
 * DEFAULT IS `variant="dot"` (RULES.md #22): a coloured dot plus a plain ink
 * label. Filled pills are opt-in via `variant="pill"` and are reserved for the
 * places where staged emphasis is the message.
 */

/** Submission pipeline statuses, in pipeline order. Matches `convex/schema.ts`. */
export const SUBMISSION_STATUSES = [
  "draft",
  "pending",
  "accept_queue",
  "decline_queue",
  "accepted",
  "declined",
  "withdrawn",
] as const

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

/** Generic lifecycle statuses used by forms, plans, portals, tasks. */
export const GENERIC_STATUSES = [
  "open",
  "closed",
  "active",
  "scheduled",
  "sent",
  "failed",
  "complete",
  "incomplete",
] as const

export type GenericStatus = (typeof GENERIC_STATUSES)[number]

export type StatusValue = SubmissionStatus | GenericStatus

export const STATUS_LABELS: Record<StatusValue, string> = {
  draft: "Draft",
  pending: "Pending",
  accept_queue: "Accept Queue",
  decline_queue: "Decline Queue",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  open: "Open",
  closed: "Closed",
  active: "Active",
  scheduled: "Scheduled",
  sent: "Sent",
  failed: "Failed",
  complete: "Complete",
  incomplete: "Incomplete",
}

type Tone = "green" | "amber" | "red" | "gray" | "blue"

const STATUS_TONES: Record<StatusValue, Tone> = {
  draft: "gray",
  pending: "amber",
  accept_queue: "green",
  decline_queue: "amber",
  accepted: "green",
  declined: "red",
  withdrawn: "gray",
  open: "green",
  closed: "gray",
  active: "blue",
  scheduled: "blue",
  sent: "green",
  failed: "red",
  complete: "green",
  incomplete: "amber",
}

/** Queue states are staged, not committed — shown with an outline. */
const STAGED: ReadonlySet<StatusValue> = new Set<StatusValue>([
  "accept_queue",
  "decline_queue",
])

/** Human label for any status value (falls back to the raw key). */
export function statusLabel(status: string): string {
  return status in STATUS_LABELS ? STATUS_LABELS[status as StatusValue] : status
}

/** Ordered `{ value, label }` list for status pickers / tabs. */
export const SUBMISSION_STATUS_OPTIONS: Array<{
  value: SubmissionStatus
  label: string
}> = SUBMISSION_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}))

/** Tone/size/staged layer applied on top of the shadcn `Badge` base classes. */
const statusPillVariants = cva("gap-1.5 rounded-full", {
  variants: {
    tone: {
      green: "bg-status-green-bg text-status-green-fg",
      amber: "bg-status-amber-bg text-status-amber-fg",
      red: "bg-status-red-bg text-status-red-fg",
      gray: "bg-status-gray-bg text-status-gray-fg",
      blue: "bg-status-blue-bg text-status-blue-fg",
    },
    size: {
      sm: "h-5 px-2 text-[11px]",
      default: "h-6 px-2.5 text-xs",
    },
    staged: {
      true: "ring-1 ring-inset",
      false: "",
    },
  },
  compoundVariants: [
    { tone: "green", staged: true, className: "ring-status-green-dot/40" },
    { tone: "amber", staged: true, className: "ring-status-amber-dot/40" },
    { tone: "red", staged: true, className: "ring-status-red-dot/40" },
    { tone: "gray", staged: true, className: "ring-status-gray-dot/40" },
    { tone: "blue", staged: true, className: "ring-status-blue-dot/40" },
  ],
  defaultVariants: { tone: "gray", size: "default", staged: false },
})

const DOT_CLASS: Record<Tone, string> = {
  green: "bg-status-green-dot",
  amber: "bg-status-amber-dot",
  red: "bg-status-red-dot",
  gray: "bg-status-gray-dot",
  blue: "bg-status-blue-dot",
}

export interface StatusPillProps
  extends Omit<React.ComponentProps<typeof Badge>, "children" | "variant">,
    Pick<VariantProps<typeof statusPillVariants>, "size"> {
  /** Any `SubmissionStatus` or `GenericStatus`; unknown values render gray. */
  status: StatusValue | (string & {})
  /** Override the label (defaults to the canonical wording). */
  label?: string
  /** Leading dot. On by default — it carries the meaning at a glance. */
  dot?: boolean
  /**
   * `dot` (default, RULES.md #22) = a small coloured dot plus a plain ink
   * label, which is how Attio renders state in tables and detail panes. It
   * keeps rows calm and reserves filled surfaces for real emphasis.
   * `pill` = the filled tinted pill; use it where the emphasis is the point
   * (accept/decline queue banners, drawer headers, a lone status in a card).
   */
  variant?: "dot" | "pill"
}

export function StatusPill({
  status,
  label,
  dot = true,
  size = "default",
  variant = "dot",
  className,
  ...props
}: StatusPillProps) {
  const key = status as StatusValue
  const tone: Tone = key in STATUS_TONES ? STATUS_TONES[key] : "gray"
  const staged = STAGED.has(key)

  if (variant === "dot") {
    return (
      <Badge
        variant="ghost"
        data-slot="status-pill"
        data-variant="dot"
        data-status={status}
        className={cn(
          "gap-1.5 bg-transparent px-0 font-medium text-foreground hover:bg-transparent",
          size === "sm" ? "h-5 text-[11px]" : "h-6 text-xs",
          className,
        )}
        {...props}
      >
        {dot ? (
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", DOT_CLASS[tone])}
          />
        ) : null}
        {label ?? statusLabel(status)}
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      data-slot="status-pill"
      data-variant="pill"
      data-status={status}
      className={cn(statusPillVariants({ tone, size, staged }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[tone])}
        />
      ) : null}
      {label ?? statusLabel(status)}
    </Badge>
  )
}

export { statusPillVariants }

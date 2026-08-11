import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/**
 * Tag — the categorical pill (track, format, level, language, free tags).
 *
 * After the Attio revamp (docs/memory/RULES.md #22) colour carries DATA, not
 * chrome: this is the ONE place a soft tint is allowed outside the status
 * ramp. Tones map to the `--tag-*` tokens in `src/styles.css`; every pair is
 * ≥5.6:1, so a tag is readable at 11px.
 *
 * Never use a Tag for state — state is `StatusPill`, which is a dot plus a
 * label. A row that shows two tinted pills has lost the plot.
 */

export const TAG_TONES = [
  "gray",
  "blue",
  "green",
  "amber",
  "purple",
] as const

export type TagTone = (typeof TAG_TONES)[number]

const tagVariants = cva(
  "rounded-md border-transparent font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        gray: "bg-tag-gray-bg text-tag-gray-fg",
        blue: "bg-tag-blue-bg text-tag-blue-fg",
        green: "bg-tag-green-bg text-tag-green-fg",
        amber: "bg-tag-amber-bg text-tag-amber-fg",
        purple: "bg-tag-purple-bg text-tag-purple-fg",
      },
      size: {
        sm: "h-5 px-1.5 text-[11px]",
        default: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: { tone: "gray", size: "default" },
  },
)

/**
 * Deterministic tone for a free-text value, so the same track keeps the same
 * tint on every screen without anyone storing a colour.
 */
export function tagTone(value: string): TagTone {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return TAG_TONES[hash % TAG_TONES.length]
}

export interface TagProps
  extends Omit<React.ComponentProps<typeof Badge>, "variant">,
    VariantProps<typeof tagVariants> {}

export function Tag({ tone, size, className, ...props }: TagProps) {
  return (
    <Badge
      variant="secondary"
      data-slot="tag"
      className={cn(tagVariants({ tone, size }), className)}
      {...props}
    />
  )
}

export { tagVariants }

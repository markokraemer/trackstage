import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"

/**
 * Layout primitives for the marketing homepage.
 *
 * `MarketingSection` owns the page rhythm (max width, horizontal padding,
 * vertical spacing, sticky-nav scroll offset) so every band on the landing page
 * lines up on the same grid; `SectionIntro` owns the glyph/title/description
 * stack. Every band on the page goes through these two — no bespoke wrappers.
 *
 * The visual language is Attio's (docs/memory/RULES.md #25): white bands,
 * hairline rules instead of boxes, one very large tight-tracked heading per
 * band, muted supporting copy, and generous air between sections.
 */

/**
 * The display type for this page: tight tracking, tight leading, semibold —
 * Attio's headline voice. Kept as a constant rather than a global utility so
 * the marketing pass never reaches into `src/styles.css`.
 */
export const DISPLAY_HEADING =
  "font-heading font-semibold tracking-[-0.032em] text-foreground"

export interface MarketingSectionProps extends React.ComponentProps<"section"> {
  /** `muted` paints the band on the page background instead of white. */
  tone?: "default" | "muted"
  /** Vertical rhythm. `tight` is for strips (logo row), `default` for bands. */
  spacing?: "default" | "tight"
  /** Bottom hairline. Off for the last band before the footer. */
  bordered?: boolean
  containerClassName?: string
}

const SPACING = {
  default: "py-20 sm:py-28",
  tight: "py-10 sm:py-14",
} as const

export function MarketingSection({
  tone = "default",
  spacing = "default",
  bordered = true,
  className,
  containerClassName,
  children,
  ...props
}: MarketingSectionProps) {
  return (
    <section
      className={cn(
        "w-full scroll-mt-16",
        SPACING[spacing],
        tone === "muted" ? "bg-background" : "bg-card",
        bordered && "border-b border-border/70",
        className
      )}
      {...props}
    >
      {/* One width for every band — `--container-page` (docs/memory/RULES.md #20e). */}
      <div className={cn("container-page", containerClassName)}>{children}</div>
    </section>
  )
}

export interface SectionIntroProps {
  /**
   * Attio sets a small outlined glyph to the left of the heading rather than a
   * coloured tile — neutral chrome, colour saved for data (RULES.md #22).
   */
  icon?: RemixiconComponentType
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "start" | "center"
  className?: string
}

export function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
  align = "start",
  className,
}: SectionIntroProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {Icon || eyebrow ? (
        <div
          className={cn(
            "mb-5 flex items-center gap-2.5",
            align === "center" && "justify-center"
          )}
        >
          {Icon ? (
            <span className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <Icon size={16} aria-hidden />
            </span>
          ) : null}
          {eyebrow ? (
            <p className="text-sm font-medium text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
        </div>
      ) : null}

      <h2
        className={cn(
          DISPLAY_HEADING,
          "text-3xl leading-[1.05] text-balance sm:text-4xl lg:text-[2.75rem]"
        )}
      >
        {title}
      </h2>

      {description ? (
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The faint graph-paper wash behind the hero — Attio's signature backdrop.
 * Two hairline gradients on the border token, fading out before the fold ends.
 */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 select-none",
        "[background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)]",
        "[background-size:72px_72px] opacity-50",
        "[mask-image:radial-gradient(120%_90%_at_50%_0%,black_5%,transparent_75%)]",
        className
      )}
    />
  )
}

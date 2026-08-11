import { cn } from "@/lib/utils"

/**
 * Layout primitives for the marketing homepage.
 *
 * `MarketingSection` owns the page rhythm (max width, horizontal padding,
 * vertical spacing, sticky-nav scroll offset) so every band on the landing page
 * lines up on the same grid; `SectionIntro` owns the eyebrow/title/description
 * stack. Every band on the page goes through these two — no bespoke wrappers.
 */

export interface MarketingSectionProps extends React.ComponentProps<"section"> {
  /** `muted` paints the band on the page background instead of white. */
  tone?: "default" | "muted"
  /** Vertical rhythm. `tight` is for strips (logo row), `default` for bands. */
  spacing?: "default" | "tight"
  /** Container width. `wide` fits product graphics, `default` fits prose. */
  width?: "default" | "wide"
  /** Bottom hairline. Off for the last band before the footer. */
  bordered?: boolean
  containerClassName?: string
}

const SPACING = {
  default: "py-16 sm:py-24",
  tight: "py-10 sm:py-12",
} as const

const WIDTH = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const

export function MarketingSection({
  tone = "default",
  spacing = "default",
  width = "default",
  bordered = true,
  className,
  containerClassName,
  children,
  ...props
}: MarketingSectionProps) {
  return (
    <section
      className={cn(
        "w-full scroll-mt-16 px-4 sm:px-6",
        SPACING[spacing],
        tone === "muted" ? "bg-background" : "bg-card",
        bordered && "border-b border-border/70",
        className,
      )}
      {...props}
    >
      <div className={cn("mx-auto w-full", WIDTH[width], containerClassName)}>
        {children}
      </div>
    </section>
  )
}

export interface SectionIntroProps {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "start" | "center"
  className?: string
}

export function SectionIntro({
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
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-heading mt-2.5 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
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

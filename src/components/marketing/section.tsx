import { cn } from "@/lib/utils"

/**
 * Layout primitives for the marketing homepage.
 *
 * `MarketingSection` owns the page rhythm (max width, horizontal padding,
 * vertical spacing) so every band on the landing page lines up on the same
 * grid; `SectionIntro` owns the eyebrow/title/description stack.
 */

export interface MarketingSectionProps extends React.ComponentProps<"section"> {
  /** `muted` paints the band on the page background instead of white. */
  tone?: "default" | "muted"
}

export function MarketingSection({
  tone = "default",
  className,
  children,
  ...props
}: MarketingSectionProps) {
  return (
    <section
      className={cn(
        "w-full border-b border-border/70 px-4 py-16 sm:px-6 sm:py-20",
        tone === "muted" ? "bg-background" : "bg-card",
        className,
      )}
      {...props}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  )
}

export interface SectionIntroProps {
  eyebrow?: string
  title: string
  description?: string
  className?: string
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: SectionIntroProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-heading mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

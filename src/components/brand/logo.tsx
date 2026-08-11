import { cn } from "@/lib/utils"
import { MARK_RECTS, MARK_VIEWBOX, WORDMARK } from "@/components/brand/assets"

/**
 * Sessionboard brand mark.
 *
 * The logomark is an abstract agenda: a solid time rail on the left with three
 * session blocks of varying length beside it. It is built from four rounded
 * rectangles only (geometry lives in `assets.ts` so the React component and the
 * downloadable SVG/PNG assets never drift), so it stays legible down to 16px,
 * and it paints in `currentColor` so it inherits the surface it sits on.
 *
 * - `LogoMark` — the mark alone (`plain` or `boxed`).
 * - `Wordmark` — the "Sessionboard" wordmark alone.
 * - `Logo` — the full lockup (mark + wordmark).
 */

export interface LogoMarkProps extends React.ComponentProps<"span"> {
  /** Pixel size of the mark (the box, when boxed). Default 28. */
  size?: number
  /** `boxed` = white mark on a primary-blue rounded square. */
  variant?: "plain" | "boxed"
}

export function LogoMark({
  size = 28,
  variant = "boxed",
  className,
  ...props
}: LogoMarkProps) {
  const glyph = Math.round(size * (variant === "boxed" ? 0.62 : 1))

  return (
    <span
      data-slot="logo-mark"
      role="img"
      aria-label="Sessionboard"
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        variant === "boxed"
          ? "rounded-lg bg-primary text-primary-foreground"
          : "text-primary",
        className,
      )}
      {...props}
    >
      <svg
        viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
        width={glyph}
        height={glyph}
        fill="none"
        aria-hidden
        focusable="false"
      >
        {MARK_RECTS.map((rect, index) => (
          <rect
            key={index}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={rect.rx}
            fill="currentColor"
            opacity={rect.opacity}
          />
        ))}
      </svg>
    </span>
  )
}

const WORD_SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-4xl",
} as const

export interface WordmarkProps extends React.ComponentProps<"span"> {
  size?: keyof typeof WORD_SIZE
}

/** The wordmark on its own — tight tracking is part of the mark. */
export function Wordmark({ size = "md", className, ...props }: WordmarkProps) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        "font-heading font-semibold tracking-tight text-foreground",
        WORD_SIZE[size],
        className,
      )}
      {...props}
    >
      {WORDMARK}
    </span>
  )
}

export interface LogoProps extends React.ComponentProps<"span"> {
  size?: keyof typeof WORD_SIZE
  variant?: "plain" | "boxed"
  /** Hide the wordmark (still announced to screen readers). */
  markOnly?: boolean
}

const MARK_SIZE = { sm: 22, md: 28, lg: 40, xl: 56 } as const

export function Logo({
  size = "md",
  variant = "boxed",
  markOnly = false,
  className,
  ...props
}: LogoProps) {
  return (
    <span
      data-slot="logo"
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      <LogoMark size={MARK_SIZE[size]} variant={variant} />
      <Wordmark size={size} className={cn(markOnly && "sr-only")} />
    </span>
  )
}

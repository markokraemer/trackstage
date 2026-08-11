import { cn } from "@/lib/utils"

/**
 * Sessionboard brand mark.
 *
 * The logomark is an abstract agenda: a solid time rail on the left with three
 * session blocks of varying length beside it. It is built from four rounded
 * rectangles only, so it stays legible down to 16px, and it paints in
 * `currentColor` so it inherits the surface it sits on.
 *
 * - `LogoMark` — the mark alone (`plain` or `boxed`).
 * - `Logo` — the full lockup (mark + "Sessionboard" wordmark).
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

  const svg = (
    <svg
      viewBox="0 0 24 24"
      width={glyph}
      height={glyph}
      fill="none"
      aria-hidden
      focusable="false"
    >
      <rect x="2" y="3" width="3.2" height="18" rx="1.6" fill="currentColor" />
      <rect
        x="7.8"
        y="3"
        width="14.2"
        height="4.6"
        rx="2"
        fill="currentColor"
        opacity="0.4"
      />
      <rect
        x="7.8"
        y="9.7"
        width="9.6"
        height="4.6"
        rx="2"
        fill="currentColor"
      />
      <rect
        x="7.8"
        y="16.4"
        width="12.4"
        height="4.6"
        rx="2"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  )

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
      {svg}
    </span>
  )
}

export interface LogoProps extends React.ComponentProps<"span"> {
  size?: "sm" | "md" | "lg"
  variant?: "plain" | "boxed"
  /** Hide the wordmark (still announced to screen readers). */
  markOnly?: boolean
}

const MARK_SIZE = { sm: 22, md: 28, lg: 40 } as const
const WORD_SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
} as const

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
      <span
        className={cn(
          "font-heading font-semibold tracking-tight text-foreground",
          WORD_SIZE[size],
          markOnly && "sr-only",
        )}
      >
        Sessionboard
      </span>
    </span>
  )
}

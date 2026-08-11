import { motion, useReducedMotion } from "motion/react"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { usePressDepth } from "@/components/interior/press-depth"

/**
 * PepButton — opt-in "pressable" button.
 *
 * interior.dev's press-depth mechanic (a real 3D key travel with a pointer-origin
 * tilt) grafted onto our canonical shadcn `buttonVariants`, so the face is exactly
 * a normal Sessionboard button — same variants, sizes, tokens, focus ring.
 *
 * This is deliberately NOT the default `Button`: press-depth needs a plinth under
 * the face, so it changes an element's box model. Use it on the one or two hero
 * actions per screen (landing CTA, "Submit talk", "Commit queue"), never as a
 * blanket replacement.
 */

const PRESS = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.45,
} as const

/** The plinth under the face — reads as the button's own shadow, per variant. */
const PLINTH: Record<string, string> = {
  default: "bg-[color-mix(in_oklch,var(--primary),var(--foreground)_45%)]",
  outline: "bg-input",
  secondary: "bg-input",
  ghost: "bg-input",
  destructive: "bg-destructive/25",
  link: "bg-transparent",
}

export type PepButtonProps = {
  children: React.ReactNode
  /** Travel distance in px — also the height of the plinth. */
  depth?: number
  /** Max tilt in degrees away from the pointer origin. 0 disables the lean. */
  tilt?: number
  disabled?: boolean
  type?: "button" | "submit" | "reset"
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
  "aria-label"?: string
} & VariantProps<typeof buttonVariants>

export function PepButton({
  children,
  depth = 4,
  tilt = 6,
  disabled = false,
  type = "button",
  onClick,
  variant = "default",
  size = "default",
  className,
  "aria-label": ariaLabel,
}: PepButtonProps) {
  const reduced = useReducedMotion()
  const { pressed, origin, ref, bind } = usePressDepth({ disabled })

  const lean = pressed && origin && !reduced ? origin : null

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      data-slot="pep-button"
      data-pressed={pressed ? "" : undefined}
      onClick={onClick}
      style={{
        paddingBottom: depth,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
      className="group/pep relative inline-flex rounded-md align-middle outline-none select-none disabled:pointer-events-none disabled:opacity-50"
      {...bind}
    >
      <span
        aria-hidden
        style={{ top: depth }}
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-md",
          PLINTH[variant ?? "default"]
        )}
      />
      <motion.span
        initial={false}
        animate={{
          y: pressed ? depth : 0,
          rotateX: lean ? -lean.y * tilt : 0,
          rotateY: lean ? lean.x * tilt : 0,
        }}
        transition={reduced ? { duration: 0 } : PRESS}
        style={{ transformPerspective: 340 }}
        className={cn(
          buttonVariants({ variant, size }),
          "relative w-full group-focus-visible/pep:ring-3 group-focus-visible/pep:ring-ring/50 active:translate-y-0",
          className
        )}
      >
        {children}
      </motion.span>
    </button>
  )
}

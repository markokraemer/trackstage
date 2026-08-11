import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { useBlurUpImage } from "@/components/interactions"

/**
 * ProductShot — the product imagery for the marketing page.
 *
 * Every shot is a REAL screenshot of the running app (docs/memory/RULES.md #25),
 * captured by driving the seeded demo through Playwright:
 *
 * ```sh
 * node scripts/capture-screenshots.mjs   # → public/screenshots/*.png
 * ```
 *
 * See `scripts/capture-screenshots.md` for the refresh procedure. Nothing here
 * is drawn or mocked, so the landing page cannot advertise a product we don't
 * ship — and re-running the script is the only way to update it.
 *
 * The frame is a neutral browser chrome plus a hairline ring; the image itself
 * fades up from a flat tint via `BlurUpImage` (interior.dev, per
 * docs/memory/INTERACTIONS.md).
 */

export type ProductShotVariant =
  | "dashboard"
  | "submissions"
  | "agenda"
  | "agendaList"
  | "form"
  | "portal"
  | "program"

interface ShotMeta {
  src: string
  url: string
  alt: string
}

/** Source of truth for what each capture shows. Alt text describes the pixels. */
const SHOTS: Record<ProductShotVariant, ShotMeta> = {
  dashboard: {
    src: "/screenshots/dashboard.png",
    url: "app.sessionboard.dev/app",
    alt: "The organizer dashboard: submission, accepted-speaker and outstanding-task counts, the submission status pipeline, and a list of which speakers to chase first.",
  },
  submissions: {
    src: "/screenshots/submissions.png",
    url: "app.sessionboard.dev/app/submissions",
    alt: "The submissions table: status tabs, staged accept and decline queues waiting to be sent, and every submission with its status, track, format and speakers.",
  },
  agenda: {
    src: "/screenshots/agenda.png",
    url: "app.sessionboard.dev/app/agenda",
    alt: "The agenda day view: rooms as columns, sessions placed on a time grid, and a tray of accepted sessions still waiting for a slot.",
  },
  agendaList: {
    src: "/screenshots/agenda-list.png",
    url: "app.sessionboard.dev/app/agenda",
    alt: "The agenda list view: every scheduled session in running order with its time, room and speakers.",
  },
  form: {
    src: "/screenshots/form-builder.png",
    url: "app.sessionboard.dev/app/forms",
    alt: "The call-for-speakers form builder: a six-step rail, the submission questions with Required and Enabled toggles, and a note explaining how the Track answer routes a submission.",
  },
  portal: {
    src: "/screenshots/portal.png",
    url: "sessionboard.dev/portal",
    alt: "The speaker portal: a speaker's own submissions with their statuses, a profile-completeness checklist, and the tasks they still owe the organizers.",
  },
  program: {
    src: "/screenshots/public-schedule.png",
    url: "sessionboard.dev/e/ai-summit-2026",
    alt: "The published public schedule: day tabs, sessions with track and format tags, times, rooms and speakers, and an add-to-calendar action.",
  },
}

/** Captures are taken at 1440×900 CSS pixels on a 2× device pixel ratio. */
const NATIVE = { width: 1440, height: 900 } as const

export interface ProductShotProps extends React.ComponentProps<"figure"> {
  variant?: ProductShotVariant
  /**
   * `full` shows the whole capture. `top` crops it to a wide band anchored to
   * the top of the screenshot — Attio's trick for letting a shot bleed out of
   * the bottom of the block that holds it.
   */
  crop?: "full" | "top"
  /** `lg` gives the hero shot a deeper shadow; `flush` drops the ring entirely. */
  elevation?: "default" | "lg" | "flush"
  /** Hide the browser chrome when the shot sits inside another frame. */
  chrome?: boolean
  priority?: boolean
}

const CROP = {
  full: NATIVE.height,
  top: 620,
} as const

export function ProductShot({
  variant = "dashboard",
  crop = "full",
  elevation = "default",
  chrome = true,
  priority = false,
  className,
  ...props
}: ProductShotProps) {
  const shot = SHOTS[variant]

  return (
    <figure
      data-slot="product-shot"
      data-variant={variant}
      className={cn(
        "overflow-hidden rounded-xl bg-card",
        elevation !== "flush" && "ring-1 ring-foreground/10",
        elevation === "lg" &&
          "shadow-[0_32px_80px_-32px_rgb(27_30_39/0.38)] ring-foreground/12",
        elevation === "default" &&
          "shadow-[0_12px_32px_-18px_rgb(27_30_39/0.30)]",
        className
      )}
      {...props}
    >
      {chrome ? <BrowserChrome url={shot.url} /> : null}
      <BlurUpShot
        src={shot.src}
        alt={shot.alt}
        height={CROP[crop]}
        anchorTop={crop === "top"}
        priority={priority}
      />
    </figure>
  )
}

const DEVELOP = { duration: 0.65, ease: [0.23, 1, 0.32, 1] } as const

/**
 * `useBlurUpImage` (interior.dev) driving our own markup — per
 * docs/memory/INTERACTIONS.md the hook is the reusable half, so the frame keeps
 * square corners and a token background instead of the packaged component's
 * rounded, fixed-radius box.
 */
function BlurUpShot({
  src,
  alt,
  height,
  anchorTop,
  priority,
}: {
  src: string
  alt: string
  height: number
  anchorTop: boolean
  priority: boolean
}) {
  const reduced = useReducedMotion()
  const { ref, status, instant } = useBlurUpImage({ src })
  const shown = status !== "loading"
  const still = reduced === true || instant

  return (
    <div
      style={{ aspectRatio: `${NATIVE.width} / ${height}` }}
      className="relative w-full overflow-hidden bg-muted"
    >
      <motion.img
        ref={ref}
        src={src}
        alt={alt}
        width={NATIVE.width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        draggable={false}
        className={cn(
          "absolute inset-0 size-full object-cover",
          anchorTop ? "object-top" : "object-center"
        )}
        initial={false}
        animate={
          still
            ? { opacity: shown ? 1 : 0 }
            : shown
              ? { opacity: 1, filter: "blur(0px)", scale: 1 }
              : { opacity: 0, filter: "blur(16px)", scale: 1.04 }
        }
        transition={still ? { duration: 0 } : DEVELOP}
      />
    </div>
  )
}

/** Neutral browser chrome — three dots and the address, nothing else. */
function BrowserChrome({ url }: { url: string }) {
  return (
    <div
      aria-hidden
      className="flex h-9 items-center gap-2 border-b border-border/70 bg-muted/60 px-3 select-none"
    >
      <div className="flex gap-1.5">
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
        <span className="size-2 rounded-full bg-foreground/15" />
      </div>
      <div className="mx-auto hidden max-w-[60%] min-w-0 truncate rounded-full bg-card px-3 py-0.5 text-[11px] text-muted-foreground ring-1 ring-foreground/10 sm:block">
        {url}
      </div>
    </div>
  )
}

export interface ProductGifProps extends React.ComponentProps<"figure"> {
  /** Path under `public/screenshots`. */
  src: string
  alt: string
  url: string
}

/**
 * A captured flow, played back. Same frame as `ProductShot` — the GIF is built
 * by the capture script from sequential screenshots of one real interaction.
 */
export function ProductGif({
  src,
  alt,
  url,
  className,
  ...props
}: ProductGifProps) {
  return (
    <figure
      data-slot="product-gif"
      className={cn(
        "overflow-hidden rounded-xl bg-card shadow-[0_12px_32px_-18px_rgb(27_30_39/0.30)] ring-1 ring-foreground/10",
        className
      )}
      {...props}
    >
      <BrowserChrome url={url} />
      <img
        src={src}
        alt={alt}
        width={NATIVE.width}
        height={NATIVE.height}
        loading="lazy"
        decoding="async"
        className="block w-full bg-muted"
      />
    </figure>
  )
}

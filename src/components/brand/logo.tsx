import {
  RiCodeSSlashLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImageLine,
} from "@remixicon/react"

import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"
import {
  MARK_RECTS,
  MARK_VIEWBOX,
  WORDMARK,
  brandSvg,
  downloadBrandPng,
  downloadSvg,
} from "@/components/brand/assets"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

/**
 * Trackstage brand mark.
 *
 * The logomark is an abstract agenda: a solid time rail on the left with three
 * session blocks of varying length beside it. It is built from four rounded
 * rectangles only (geometry lives in `assets.ts` so the React component and the
 * downloadable SVG/PNG assets never drift), so it stays legible down to 16px,
 * and it paints in `currentColor` so it inherits the surface it sits on.
 *
 * - `LogoMark` — the mark alone (`plain` or `boxed`).
 * - `Wordmark` — the "Trackstage" wordmark alone.
 * - `Logo` — the full lockup (mark + wordmark).
 *
 * Right-clicking any logo opens a small BRAND MENU at the cursor — view the
 * design system, download the lockup as SVG or PNG, copy the SVG — which is the
 * classic "where do I get the logo?" affordance (docs/memory/RULES.md #20d) as
 * Vercel and Linear ship it. It offers, it never navigates on its own: a
 * right-click that teleports you to another page is a trap. Left click is
 * untouched, so a logo inside a link still just links. Opt out per instance with
 * `disableBrandMenu` when a surface needs the browser's own context menu.
 */

/** Where the brand asset kit lives. */
export const BRAND_ASSETS_HREF = "/design-system"

const BRAND_MENU_TITLE = "Right-click for brand assets"

/** The lockup is what people actually want when they ask for "the logo". */
const DOWNLOAD_VARIANT = "lockup"
const DOWNLOAD_PX = 512

export interface BrandMenuProps {
  /** Keep the browser's own context menu on this instance. */
  disableBrandMenu?: boolean
}

/**
 * Wraps a brand element in the right-click menu.
 *
 * Navigation goes through `window.location.assign` on purpose: the brand
 * components render inside and outside the router (error boundaries, preview
 * shells, the downloads page), so they must not depend on a router context
 * being mounted.
 */
function BrandMenu({
  disabled,
  children,
}: {
  disabled?: boolean
  children: React.ReactNode
}) {
  if (disabled) return <>{children}</>

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={<span className="contents" title={BRAND_MENU_TITLE} />}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>{WORDMARK} brand</ContextMenuLabel>
        <ContextMenuItem
          onClick={() => window.location.assign(BRAND_ASSETS_HREF)}
        >
          <RiCodeSSlashLine aria-hidden />
          View design system
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() =>
            downloadSvg(
              brandSvg(DOWNLOAD_VARIANT, "color", 96),
              "trackstage-logo.svg"
            )
          }
        >
          <RiDownloadLine aria-hidden />
          Download logo (SVG)
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            void downloadBrandPng(
              DOWNLOAD_VARIANT,
              "color",
              DOWNLOAD_PX,
              `trackstage-logo-${DOWNLOAD_PX}.png`
            )
          }}
        >
          <RiImageLine aria-hidden />
          Download logo (PNG)
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            void copyText(brandSvg(DOWNLOAD_VARIANT, "color", 96))
          }}
        >
          <RiFileCopyLine aria-hidden />
          Copy logo as SVG
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export interface LogoMarkProps
  extends React.ComponentProps<"span">, BrandMenuProps {
  /** Pixel size of the mark (the box, when boxed). Default 28. */
  size?: number
  /** `boxed` = white mark on a primary-blue rounded square. */
  variant?: "plain" | "boxed"
}

export function LogoMark({
  size = 28,
  variant = "boxed",
  disableBrandMenu,
  className,
  ...props
}: LogoMarkProps) {
  const glyph = Math.round(size * (variant === "boxed" ? 0.62 : 1))

  return (
    <BrandMenu disabled={disableBrandMenu}>
      <span
        data-slot="logo-mark"
        role="img"
        aria-label="Trackstage"
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          variant === "boxed"
            ? "rounded-lg bg-primary text-primary-foreground"
            : "text-primary",
          className
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
    </BrandMenu>
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
        className
      )}
      {...props}
    >
      {WORDMARK}
    </span>
  )
}

export interface LogoProps
  extends React.ComponentProps<"span">, BrandMenuProps {
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
  disableBrandMenu,
  className,
  ...props
}: LogoProps) {
  return (
    <BrandMenu disabled={disableBrandMenu}>
      <span
        data-slot="logo"
        className={cn("inline-flex items-center gap-2", className)}
        {...props}
      >
        {/* The lockup owns the right-click; the nested mark must not open a
            second menu on top of it. */}
        <LogoMark size={MARK_SIZE[size]} variant={variant} disableBrandMenu />
        <Wordmark size={size} className={cn(markOnly && "sr-only")} />
      </span>
    </BrandMenu>
  )
}

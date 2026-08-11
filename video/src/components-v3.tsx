/**
 * V3 building blocks — each one is a landing-page primitive
 * (src/components/marketing/*) transcribed for film:
 *
 *   GridWash      → section.tsx `GridBackdrop` (72px graph paper, radial mask)
 *   Chip          → hero.tsx announcement chip (dot · label · arrow)
 *   EyebrowRow    → section.tsx `SectionIntro` glyph box + muted label
 *   BrowserFrameV3→ product-shot.tsx `BrowserChrome` + `elevation="lg"` figure
 *   CtaButton     → ui/button.tsx `default` / `outline` at hero size
 *
 * Values are the app's tokens (styles.css) scaled ~4/3 from the landing's
 * desktop rem sizes so they read the same at 1920×1080.
 */
import React from "react"
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { FONT, color } from "./theme"

/** The hero's faint graph-paper wash. Sits on the white card ground. */
export const GridWash: React.FC = () => {
  const mask = "radial-gradient(120% 90% at 50% 0%, black 5%, transparent 75%)"
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.5,
        backgroundImage: `linear-gradient(to right, ${color.border} 1px, transparent 1px), linear-gradient(to bottom, ${color.border} 1px, transparent 1px)`,
        backgroundSize: "72px 72px",
        WebkitMaskImage: mask,
        maskImage: mask,
        pointerEvents: "none",
      }}
    />
  )
}

export const ArrowIcon: React.FC<{ size?: number; color: string }> = ({
  size = 18,
  color: stroke,
}) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M2.5 8h10.2M8.6 3.8 12.8 8l-4.2 4.2"
      stroke={stroke}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** The GitHub octicon mark (16×16). */
export const GithubIcon: React.FC<{ size?: number; fill: string }> = ({
  size = 20,
  fill,
}) => (
  <svg width={size} height={size} viewBox="0 0 16 16">
    <path
      fillRule="evenodd"
      fill={fill}
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
    />
  </svg>
)

/** The hero announcement chip: primary dot · label · arrow, in a pill. */
export const Chip: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 0,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const appear = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.8 },
  })
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 11,
        padding: "9px 19px",
        borderRadius: 999,
        border: `1px solid ${color.border}`,
        background: color.card,
        fontFamily: FONT,
        fontSize: 19,
        fontWeight: 500,
        color: color.muted,
        opacity: appear,
        translate: `0 ${interpolate(appear, [0, 1], [10, 0])}px`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          background: color.primary,
        }}
      />
      {text}
      <ArrowIcon size={16} color={color.muted} />
    </div>
  )
}

/**
 * SectionIntro's eyebrow row: a hairline-bordered glyph box beside a muted
 * medium label. The glyph is the chapter's step number (or a custom node).
 */
export const EyebrowRow: React.FC<{
  glyph: React.ReactNode
  label: string
  delay?: number
}> = ({ glyph, label, delay = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const appear = spring({
    frame: frame - delay,
    fps,
    config: { damping: 19, stiffness: 120, mass: 0.7 },
  })
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        opacity: appear,
        translate: `0 ${interpolate(appear, [0, 1], [8, 0])}px`,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 13,
          border: `1px solid ${color.border}`,
          background: color.card,
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 600,
          color: color.muted,
          letterSpacing: "0.01em",
        }}
      >
        {glyph}
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 500,
          color: color.muted,
        }}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * The landing's browser frame, exactly: rounded-xl figure with a
 * foreground/10 ring and the lg elevation shadow; a muted 60% chrome bar with
 * three foreground/15 dots and a white rounded-full URL pill.
 */
export const BrowserFrameV3: React.FC<{
  width: number
  url: string
  children: React.ReactNode
}> = ({ width, url, children }) => {
  const bar = 48
  return (
    <div
      style={{
        width,
        borderRadius: 16,
        background: color.card,
        boxShadow:
          "0 0 0 1px rgba(23,23,26,0.12), 0 32px 80px -32px rgba(27,30,39,0.38)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: bar,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid rgba(234,234,236,0.7)",
          background: "rgba(247,247,248,0.6)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 10,
                background: "rgba(23,23,26,0.15)",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            translate: "-50% 0",
            height: 28,
            padding: "0 18px",
            borderRadius: 999,
            background: color.card,
            boxShadow: "0 0 0 1px rgba(23,23,26,0.10)",
            display: "flex",
            alignItems: "center",
            fontFamily: FONT,
            fontSize: 15,
            color: color.muted,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}

/** The house button at hero ("lg") size. */
export const CtaButton: React.FC<{
  variant: "primary" | "outline"
  children: React.ReactNode
}> = ({ variant, children }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 58,
      padding: "0 26px",
      borderRadius: 11,
      fontFamily: FONT,
      fontSize: 20,
      fontWeight: 500,
      ...(variant === "primary"
        ? { background: color.primary, color: "#FFFFFF", border: "1px solid transparent" }
        : {
            background: color.background,
            color: color.foreground,
            border: `1px solid ${color.border}`,
            boxShadow: "0 1px 2px rgba(23,23,26,0.05)",
          }),
    }}
  >
    {children}
  </div>
)

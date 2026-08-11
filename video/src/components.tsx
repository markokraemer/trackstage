/**
 * Shared building blocks: the animated brand mark, word-by-word text reveal
 * (the homepage's TextReveal, re-timed for film), and the browser frame every
 * footage chapter sits in.
 */
import React from "react"
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { EASE_OUT, FONT, MARK_RECTS, MARK_VIEWBOX, color } from "./theme"

/**
 * The Trackstage logomark — a time rail plus three session blocks — animated:
 * the rail draws down, the blocks slide in with a stagger. Geometry is the
 * brand kit's, verbatim.
 */
export const AnimatedMark: React.FC<{
  size: number
  delay?: number
  tint?: string
}> = ({ size, delay = 0, tint = color.primary }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
      {MARK_RECTS.map((r, i) => {
        const appear = spring({
          frame: frame - delay - i * 4,
          fps,
          config: { damping: 16, stiffness: 120, mass: 0.7 },
        })
        const slide = interpolate(appear, [0, 1], [i === 0 ? -6 : 8, 0])
        return (
          <rect
            key={i}
            x={r.x + (i === 0 ? 0 : slide)}
            y={r.y + (i === 0 ? slide : 0)}
            width={r.width}
            height={r.height}
            rx={r.rx}
            fill={tint}
            opacity={r.opacity * appear}
          />
        )
      })}
    </svg>
  )
}

/** Word-by-word rise-and-fade reveal, matching the homepage's TextReveal. */
export const TextReveal: React.FC<{
  text: string
  delay?: number
  perWord?: number
  style?: React.CSSProperties
}> = ({ text, delay = 0, perWord = 3, style }) => {
  const frame = useCurrentFrame()
  const words = text.split(" ")
  return (
    <span style={style}>
      {words.map((word, i) => {
        const t = frame - delay - i * perWord
        const opacity = interpolate(t, [0, 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        })
        const rise = interpolate(t, [0, 14], [14, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        })
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity,
              translate: `0 ${rise}px`,
            }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        )
      })}
    </span>
  )
}

/**
 * The browser chrome the footage lives in: neutral dots, a quiet URL pill —
 * Attio-calm, no color that does not mean something.
 */
export const BrowserFrame: React.FC<{
  width: number
  url: string
  children: React.ReactNode
}> = ({ width, url, children }) => {
  const bar = 44
  return (
    <div
      style={{
        width,
        borderRadius: 14,
        background: color.card,
        border: `1px solid ${color.border}`,
        boxShadow:
          "0 32px 80px rgba(23,23,26,0.12), 0 4px 16px rgba(23,23,26,0.05)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: bar,
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          borderBottom: `1px solid ${color.border}`,
          background: color.card,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 11,
                height: 11,
                borderRadius: 11,
                background: "#E4E4E7",
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            translate: "-50% 0",
            height: 27,
            minWidth: 380,
            padding: "0 16px",
            borderRadius: 8,
            background: "#F4F4F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 500,
            color: color.muted,
            letterSpacing: "-0.01em",
          }}
        >
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}

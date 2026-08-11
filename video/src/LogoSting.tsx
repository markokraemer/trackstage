/**
 * A 4-second logo sting: mark animates in, wordmark rises, domain fades.
 * Useful as an outro/intro bumper on social cuts.
 */
import React from "react"
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { AnimatedMark } from "./components"
import { body, color, heading } from "./theme"

export const LogoSting: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 90 } })
  const domain = interpolate(frame, [46, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  const out = interpolate(frame, [104, 118], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  return (
    <AbsoluteFill
      style={{
        background: color.background,
        alignItems: "center",
        justifyContent: "center",
        opacity: out,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <AnimatedMark size={96} delay={2} />
          <div
            style={{
              ...heading(104),
              opacity: wordmark,
              translate: `0 ${interpolate(wordmark, [0, 1], [16, 0])}px`,
            }}
          >
            Trackstage
          </div>
        </div>
        <div style={{ ...body(28), marginTop: 30, color: color.muted, opacity: domain }}>
          trackstage.app — open-source speaker & program management
        </div>
      </div>
    </AbsoluteFill>
  )
}

/**
 * 1080×1080 social cut: logo reveal, one-liner, dashboard shot rising from
 * the bottom edge — the homepage hero, as a square.
 */
import React from "react"
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { AnimatedMark } from "./components"
import { EASE_OUT, body, color, heading } from "./theme"

export const HeroSquare: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 90 } })
  const tagline = interpolate(frame, [26, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...EASE_OUT),
  })
  const shot = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 60 } })
  return (
    <AbsoluteFill style={{ background: color.background, alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginTop: 120,
        }}
      >
        <AnimatedMark size={72} delay={0} />
        <div
          style={{
            ...heading(76),
            opacity: wordmark,
            translate: `0 ${interpolate(wordmark, [0, 1], [12, 0])}px`,
          }}
        >
          Trackstage
        </div>
      </div>
      <div
        style={{
          ...heading(38),
          fontWeight: 500,
          marginTop: 34,
          opacity: tagline,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        Run your call for speakers.{" "}
        <span style={{ color: "rgba(23,23,26,0.42)" }}>Not your inbox.</span>
      </div>
      <div style={{ ...body(24), marginTop: 16, opacity: tagline, color: color.faint }}>
        Open source · trackstage.app
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -300,
          width: 1040,
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${color.border}`,
          boxShadow: "0 32px 80px rgba(23,23,26,0.14)",
          translate: `0 ${interpolate(shot, [0, 1], [140, 0])}px`,
          opacity: interpolate(shot, [0, 0.4], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Img
          src={staticFile("captures/dashboard.png")}
          style={{ width: "100%", display: "block" }}
        />
      </div>
    </AbsoluteFill>
  )
}

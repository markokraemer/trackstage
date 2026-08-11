/**
 * V2 building blocks — the hype cut. 3D-tilted browser frames, word punches,
 * beat shakes. Reuses the V1 BrowserFrame chrome and brand tokens; adds a dark
 * bookend palette for the cold open / punch sections.
 */
import React from "react"
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { FONT, color } from "./theme"

/** Dark bookend palette (cold open, word punches, climax). */
export const dark = {
  background: "#0C0D10",
  surface: "#16171C",
  foreground: "#F7F7F8",
  muted: "#8B8B93",
  accent: "#7BA1FF",
  red: "#E5484D",
} as const

export const DarkGround: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1100px 700px at 50% 42%, ${dark.surface}, ${dark.background})`,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
)

export const LightGround: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1300px 850px at 50% 38%, #FFFFFF, ${color.background})`,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
)

/**
 * Word-by-word PUNCH reveal: each word slams from oversized to rest on a
 * tight spring. The kinetic-type counterpart of V1's gentle TextReveal.
 */
export const PunchWords: React.FC<{
  text: string
  delay?: number
  perWord?: number
  style?: React.CSSProperties
}> = ({ text, delay = 0, perWord = 3, style }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(" ")
  return (
    <span style={style}>
      {words.map((word, i) => {
        const s = spring({
          frame: frame - delay - i * perWord,
          fps,
          config: { damping: 14, stiffness: 260, mass: 0.5 },
        })
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: s,
              scale: String(interpolate(s, [0, 1], [1.45, 1])),
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
 * Deterministic impact shake: sharp on the hit frame, dead ~10 frames later.
 * Returns a CSS translate string.
 */
export const impactShake = (frame: number, at: number, amp = 9): string => {
  const t = frame - at
  if (t < 0 || t > 12) return "0px 0px"
  const decay = (1 - t / 12) ** 2
  const x = Math.sin(t * 12.9898) * amp * decay
  const y = Math.cos(t * 78.233) * amp * 0.7 * decay
  return `${x.toFixed(2)}px ${y.toFixed(2)}px`
}

/**
 * 3D-tilted stage for a browser frame. Slams in from a hard rotation, settles
 * on a spring into a resting lean (alternating per chapter), keeps a slow
 * deterministic float so nothing is ever frozen.
 */
export const TiltStage: React.FC<{
  tilt: 1 | -1
  children: React.ReactNode
}> = ({ tilt, children }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 130, mass: 0.8 },
  })
  const rotY = interpolate(enter, [0, 1], [tilt * 26, tilt * 9])
  const rotX = interpolate(enter, [0, 1], [10, 5])
  const slideX = interpolate(enter, [0, 1], [tilt * 210, 0])
  const rise = interpolate(enter, [0, 1], [70, 0])
  // Slow float so the frame breathes between the entrance and the cut.
  const floatY = Math.sin(frame / 34) * 0.7
  const floatZ = Math.sin(frame / 47) * 0.4
  return (
    <AbsoluteFill
      style={{
        perspective: 2600,
        perspectiveOrigin: "50% 42%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: interpolate(enter, [0, 0.35], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translate3d(${slideX}px, ${rise}px, 0) rotateY(${
            rotY + floatY
          }deg) rotateX(${rotX + floatZ}deg) rotateZ(${tilt * 0.6}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

/** Soft elliptical ground shadow under a tilted frame. */
export const GroundShadow: React.FC<{ width: number }> = ({ width }) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      bottom: 64,
      translate: "-50% 0",
      width: width * 0.82,
      height: 60,
      borderRadius: "50%",
      background:
        "radial-gradient(50% 50% at 50% 50%, rgba(23,23,26,0.16), rgba(23,23,26,0))",
      filter: "blur(6px)",
    }}
  />
)

/** Tiny numbered chip used by chapter labels and word punches. */
export const IndexChip: React.FC<{
  text: string
  tone?: "light" | "dark"
  style?: React.CSSProperties
}> = ({ text, tone = "light", style }) => (
  <span
    style={{
      fontFamily: FONT,
      fontWeight: 600,
      fontSize: 17,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: tone === "light" ? color.primary : dark.accent,
      background:
        tone === "light" ? color.primarySurface : "rgba(123,161,255,0.14)",
      border: `1px solid ${
        tone === "light" ? "rgba(47,92,224,0.22)" : "rgba(123,161,255,0.3)"
      }`,
      borderRadius: 999,
      padding: "6px 16px",
      display: "inline-block",
      ...style,
    }}
  >
    {text}
  </span>
)

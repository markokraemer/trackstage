/**
 * The V2 launch film — hard cuts only, every one on the kick. Assembled 1:1
 * from `storyboard-v2.ts`. Music: Mixkit "Infected Mushroom Vibes" (see
 * CREDITS.md), trimmed so a kick lands on frame 0.
 */
import React from "react"
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { AnimatedMark } from "./components"
import { DarkGround, dark, impactShake } from "./components-v2"
import { FONT, heading } from "./theme"
import {
  AUDIO_FILE,
  AUDIO_TRIM_FRAMES,
  storyboardV2,
  totalDurationInFramesV2,
} from "./storyboard-v2"
import type { SceneV2 } from "./storyboard-v2"
import {
  ChapterV2,
  ClimaxV2,
  CloseV2,
  ColdOpenA,
  ColdOpenB,
  RevealV2,
  UniverseV2,
  WordPunch,
} from "./scenes-v2"

const render = (scene: SceneV2) => {
  switch (scene.kind) {
    case "cold-open-a":
      return <ColdOpenA />
    case "cold-open-b":
      return <ColdOpenB />
    case "reveal":
      return <RevealV2 />
    case "chapter":
      return <ChapterV2 scene={scene} />
    case "universe":
      return <UniverseV2 scene={scene} />
    case "word":
      return <WordPunch scene={scene} />
    case "climax":
      return <ClimaxV2 />
    case "close":
      return <CloseV2 scene={scene} />
  }
}

export const MainV2: React.FC = () => {
  const total = totalDurationInFramesV2
  return (
    <AbsoluteFill style={{ background: "#0C0D10" }}>
      <Audio
        src={staticFile(AUDIO_FILE)}
        trimBefore={AUDIO_TRIM_FRAMES}
        volume={(f) =>
          interpolate(f, [0, 6, total - 55, total - 5], [0, 0.95, 0.95, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      {storyboardV2.map(({ scene, id, from, durationInFrames }) => (
        <Sequence
          key={id}
          from={from}
          durationInFrames={durationInFrames}
          name={id}
          layout="absolute-fill"
        >
          {render(scene)}
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

/** 3-second beat-styled sting: mark slam → wordmark → domain. */
export const StingV2: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0C0D10" }}>
      <Sequence durationInFrames={90} name="sting" layout="absolute-fill">
        <StingInner />
      </Sequence>
    </AbsoluteFill>
  )
}

const StingInner: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const wordmark = spring({ frame: frame - 3, fps, config: { damping: 14, stiffness: 220, mass: 0.6 } })
  const domain = spring({ frame: frame - 26, fps, config: { damping: 15, stiffness: 230, mass: 0.5 } })
  const out = interpolate(frame, [76, 88], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  return (
    <DarkGround>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: out,
          translate: impactShake(frame, 5, 8),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <AnimatedMark size={92} delay={0} tint={dark.accent} />
          <div
            style={{
              ...heading(100),
              color: dark.foreground,
              opacity: wordmark,
              scale: String(interpolate(wordmark, [0, 1], [1.25, 1])),
            }}
          >
            Trackstage
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 30,
            color: dark.accent,
            marginTop: 30,
            opacity: domain,
            scale: String(interpolate(domain, [0, 1], [1.3, 1])),
          }}
        >
          trackstage.app — open source, free, fast
        </div>
      </div>
    </DarkGround>
  )
}

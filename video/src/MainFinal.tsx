/**
 * The launch film that ships on the landing page, assembled 1:1 from
 * `storyboard-final.ts`. Same scene vocabulary as V3 (the landing page's own
 * design language), fresh footage, landing-matched copy, V1's calm pacing.
 *
 * Audio is two tracks: the ElevenLabs voiceover (one line per scene, placed at
 * that scene's absolute start + its `vo.delay`) over the Mixkit "Digital
 * Clouds" bed (CREDITS.md), which ducks to a third of its level whenever a
 * line is speaking and swells back in the gaps. The film still ends on the
 * end card with the bed fading to silence.
 */
import React from "react"
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
} from "remotion"
import { TransitionSeries, linearTiming } from "@remotion/transitions"
import { fade } from "@remotion/transitions/fade"
import {
  storyboardFinal,
  totalDurationInFramesFinal,
} from "./storyboard-final"
import type { SceneV3 } from "./storyboard-v3"
import { Chapter, Close, Mcp, Reveal, Stats, Stills, Title } from "./scenes-v3"
import { color } from "./theme"

const render = (scene: SceneV3) => {
  switch (scene.kind) {
    case "title":
      return <Title scene={scene} />
    case "reveal":
      return <Reveal scene={scene} />
    case "chapter":
      return <Chapter scene={scene} />
    case "mcp":
      return <Mcp scene={scene} />
    case "stills":
      return <Stills scene={scene} />
    case "stats":
      return <Stats scene={scene} />
    case "close":
      return <Close scene={scene} />
  }
}

/**
 * Absolute start frame of every scene: each crossfade overlaps the incoming
 * scene with the outgoing one, so start_i = Σ dur_j (j<i) − Σ fade_j (j≤i).
 */
const sceneStarts = (() => {
  const starts: number[] = []
  let pos = 0
  for (const { scene, fadeIn } of storyboardFinal) {
    pos -= fadeIn
    starts.push(pos)
    pos += scene.durationInFrames
  }
  return starts
})()

/** [start, end] of every voiceover line, in absolute composition frames. */
const voWindows = storyboardFinal.flatMap(({ vo }, i) =>
  vo ? [[sceneStarts[i] + vo.delay, sceneStarts[i] + vo.delay + vo.frames]] : [],
)

const BED = 0.62
const DUCKED = 0.22

/** The bed ducks under speech with short ramps, and swells in the gaps. */
const bedVolume = (f: number, total: number) => {
  const duck = Math.max(
    0,
    ...voWindows.map(([a, b]) =>
      interpolate(f, [a - 12, a, b, b + 18], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  )
  const master = interpolate(f, [0, 18, total - 80, total - 6], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  return (BED - (BED - DUCKED) * duck) * master
}

export const MainFinal: React.FC = () => {
  const total = totalDurationInFramesFinal
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <Audio
        src={staticFile("audio/digital-clouds.mp3")}
        volume={(f) => bedVolume(f, total)}
      />
      {storyboardFinal.map(({ scene, vo }, i) =>
        vo ? (
          <Sequence
            key={`vo-${scene.id}`}
            from={sceneStarts[i] + vo.delay}
            durationInFrames={vo.frames + 6}
            name={`vo-${scene.id}`}
          >
            <Audio src={staticFile(vo.file)} />
          </Sequence>
        ) : null,
      )}
      <TransitionSeries>
        {storyboardFinal.flatMap(({ scene, fadeIn }, i) => {
          const parts: React.ReactNode[] = []
          if (fadeIn > 0 && i > 0) {
            parts.push(
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: fadeIn })}
              />,
            )
          }
          parts.push(
            <TransitionSeries.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
              name={scene.id}
            >
              {render(scene)}
            </TransitionSeries.Sequence>,
          )
          return parts
        })}
      </TransitionSeries>
    </AbsoluteFill>
  )
}

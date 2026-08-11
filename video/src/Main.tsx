/**
 * The launch film, assembled 1:1 from `storyboard.ts` via TransitionSeries.
 * Music: Mixkit "Digital Clouds" (see CREDITS.md), faded in and out, no VO.
 */
import React from "react"
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion"
import { TransitionSeries, linearTiming } from "@remotion/transitions"
import { fade } from "@remotion/transitions/fade"
import { storyboard, totalDurationInFrames } from "./storyboard"
import type { Scene } from "./storyboard"
import { Cards, Chapter, Close, Reveal, Stills, Title } from "./scenes"
import { color } from "./theme"

const render = (scene: Scene) => {
  switch (scene.kind) {
    case "title":
      return <Title scene={scene} />
    case "reveal":
      return <Reveal scene={scene} />
    case "chapter":
      return <Chapter scene={scene} />
    case "stills":
      return <Stills scene={scene} />
    case "cards":
      return <Cards scene={scene} />
    case "close":
      return <Close scene={scene} />
  }
}

export const Main: React.FC = () => {
  const total = totalDurationInFrames
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <Audio
        src={staticFile("audio/digital-clouds.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 18, total - 80, total - 6],
            [0, 0.85, 0.85, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <TransitionSeries>
        {storyboard.flatMap(({ scene, fadeIn }, i) => {
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

/**
 * The definitive launch film, assembled 1:1 from `storyboard-v3.ts` via
 * TransitionSeries. V1's calm, tightened. Music: Mixkit "Digital Clouds"
 * (CREDITS.md), faded in and out, no VO.
 */
import React from "react"
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion"
import { TransitionSeries, linearTiming } from "@remotion/transitions"
import { fade } from "@remotion/transitions/fade"
import { storyboardV3, totalDurationInFramesV3 } from "./storyboard-v3"
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

export const MainV3: React.FC = () => {
  const total = totalDurationInFramesV3
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <Audio
        src={staticFile("audio/digital-clouds.mp3")}
        volume={(f) =>
          interpolate(f, [0, 18, total - 80, total - 6], [0, 0.85, 0.85, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <TransitionSeries>
        {storyboardV3.flatMap(({ scene, fadeIn }, i) => {
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

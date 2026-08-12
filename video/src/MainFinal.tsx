/**
 * The launch film that ships on the landing page, assembled 1:1 from
 * `storyboard-final.ts`. Same scene vocabulary as V3 (the landing page's own
 * design language), fresh footage, landing-matched copy, V1's calm pacing.
 * Music: Mixkit "Digital Clouds" (CREDITS.md), faded in and out, no VO.
 */
import React from "react"
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion"
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

export const MainFinal: React.FC = () => {
  const total = totalDurationInFramesFinal
  return (
    <AbsoluteFill style={{ background: color.background }}>
      <Audio
        src={staticFile("audio/digital-clouds.mp3")}
        volume={(f) =>
          interpolate(f, [0, 18, total - 90, total - 6], [0, 0.85, 0.85, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
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

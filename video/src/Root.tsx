import "./index.css"
import React from "react"
import { Composition } from "remotion"
import { Main } from "./Main"
import { LogoSting } from "./LogoSting"
import { HeroSquare } from "./HeroSquare"
import { FPS, totalDurationInFrames } from "./storyboard"

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TrackstageLaunch"
        component={Main}
        durationInFrames={totalDurationInFrames}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="HeroSquare"
        component={HeroSquare}
        durationInFrames={210}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="LogoSting"
        component={LogoSting}
        durationInFrames={120}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  )
}

import "./index.css"
import React from "react"
import { Composition } from "remotion"
import { Main } from "./Main"
import { MainV2, StingV2 } from "./MainV2"
import { MainV3 } from "./MainV3"
import { LogoSting } from "./LogoSting"
import { HeroSquare } from "./HeroSquare"
import { FPS, totalDurationInFrames } from "./storyboard"
import { totalDurationInFramesV2 } from "./storyboard-v2"
import { totalDurationInFramesV3 } from "./storyboard-v3"

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
        id="TrackstageLaunchV2"
        component={MainV2}
        durationInFrames={totalDurationInFramesV2}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="TrackstageLaunchV3"
        component={MainV3}
        durationInFrames={totalDurationInFramesV3}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="TrackstageStingV2"
        component={StingV2}
        durationInFrames={90}
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

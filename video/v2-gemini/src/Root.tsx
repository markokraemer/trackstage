import React from "react";
import { Composition } from "remotion";
import "./index.css";
import { Main } from "./Main";
import { STORYBOARD } from "./storyboard";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TrackstageLaunch"
      component={Main}
      durationInFrames={STORYBOARD.durationInFrames}
      fps={STORYBOARD.fps}
      width={STORYBOARD.width}
      height={STORYBOARD.height}
    />
  );
};

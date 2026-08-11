import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { ColdOpenScene } from "./scenes/ColdOpenScene";
import { EndCardScene } from "./scenes/EndCardScene";
import { KineticDiffScene } from "./scenes/KineticDiffScene";
import { LogoBeatScene } from "./scenes/LogoBeatScene";
import { ProductMontageScene } from "./scenes/ProductMontageScene";
import { STORYBOARD } from "./storyboard";

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAFA" }}>
      {/* Background Energetic Music Track */}
      <Audio
        src={staticFile(STORYBOARD.audioPath)}
        volume={STORYBOARD.audioVolume}
      />

      {/* Render Scenes Sequentially according to Storyboard timeline */}
      {STORYBOARD.scenes.map((scene) => {
        return (
          <Sequence
            key={scene.id}
            from={scene.startFrame}
            durationInFrames={scene.durationInFrames}
            name={scene.title}
          >
            {scene.type === "cold-open" && <ColdOpenScene scene={scene} />}
            {scene.type === "logo-beat" && <LogoBeatScene scene={scene} />}
            {scene.type === "product-montage" && <ProductMontageScene scene={scene} />}
            {scene.type === "kinetic-diff" && <KineticDiffScene scene={scene} />}
            {scene.type === "end-card" && <EndCardScene scene={scene} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

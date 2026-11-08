import React from "react";
import { Composition } from "remotion";
import { Scene, SceneProps } from "./Scene";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Scene"
    component={Scene}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={300}
    defaultProps={{} as SceneProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.round(props.timing.dur * 30),
    })}
  />
);

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, MARK_RECTS, MARK_VIEWBOX } from "../theme";

export const TrackstageMark: React.FC<{
  size: number;
  delay?: number;
  tint?: string;
}> = ({ size, delay = 0, tint = color.primary }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
      {MARK_RECTS.map((r, i) => {
        const appear = spring({
          frame: frame - delay - i * 3,
          fps,
          config: { damping: 14, stiffness: 130, mass: 0.6 },
        });
        const slide = interpolate(appear, [0, 1], [i === 0 ? -6 : 8, 0]);
        return (
          <rect
            key={i}
            x={r.x + (i === 0 ? 0 : slide)}
            y={r.y + (i === 0 ? slide : 0)}
            width={r.width}
            height={r.height}
            rx={r.rx}
            fill={tint}
            opacity={r.opacity * appear}
          />
        );
      })}
    </svg>
  );
};

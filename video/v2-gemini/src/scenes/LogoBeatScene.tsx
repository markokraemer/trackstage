import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TrackstageMark } from "../components/TrackstageLogo";
import { SceneConfig } from "../storyboard";
import { color, FONT, heading } from "../theme";

export const LogoBeatScene: React.FC<{ scene: SceneConfig }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo Spring Entry
  const markSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.6 },
  });

  const markScale = interpolate(markSpring, [0, 1], [0.6, 1]);

  // Wordmark Reveal
  const textSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const textY = interpolate(textSpring, [0, 1], [30, 0]);

  // Badge Spring
  const badgeSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FAFAFA 60%, #EEF2FC 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background Glowing Orb */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(47, 92, 224, 0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          transform: `scale(${interpolate(frame, [0, 60], [0.8, 1.2])})`,
        }}
      />

      <div
        style={{
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Badge */}
        {scene.badge && (
          <div
            style={{
              opacity: badgeSpring,
              transform: `scale(${badgeSpring})`,
              background: color.primarySurface,
              color: color.primary,
              border: "1px solid rgba(47, 92, 224, 0.25)",
              padding: "6px 20px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.14em",
              fontFamily: FONT,
            }}
          >
            {scene.badge}
          </div>
        )}

        {/* Logo Mark & Wordmark Horizontal Row */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ transform: `scale(${markScale})` }}>
            <TrackstageMark size={110} />
          </div>

          <div
            style={{
              opacity: textSpring,
              transform: `translateY(${textY}px)`,
              ...heading(96),
              color: "#0F172A",
              letterSpacing: "-0.04em",
            }}
          >
            Trackstage
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: textSpring,
            transform: `translateY(${textY * 0.5}px)`,
            fontFamily: FONT,
            fontSize: 32,
            fontWeight: 500,
            color: color.muted,
            letterSpacing: "-0.01em",
          }}
        >
          {scene.subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

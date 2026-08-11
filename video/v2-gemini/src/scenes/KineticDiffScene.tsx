import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneConfig } from "../storyboard";
import { FONT, heading } from "../theme";

export const KineticDiffScene: React.FC<{ scene: SceneConfig }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring Pop for Badge
  const badgeSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.5 },
  });

  // Spring Pop for Main Title
  const titleSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 11, stiffness: 110, mass: 0.5 },
  });

  const titleScale = interpolate(titleSpring, [0, 1], [0.8, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);

  // Spring Pop for Subtitle
  const subSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 15, stiffness: 90 },
  });

  // Background 3D Card Rotation
  const bgCardRotateY = interpolate(frame, [0, scene.durationInFrames], [-15, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accentColor = scene.highlightColor || "#2F5CE0";

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FAFAFA 60%, #F1F5F9 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "1200px",
        overflow: "hidden",
      }}
    >
      {/* Background Decorative 3D Glass Surface */}
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 650,
          borderRadius: 32,
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          border: `2px solid ${accentColor}30`,
          boxShadow: `0 30px 80px -20px ${accentColor}25`,
          transform: `rotateY(${bgCardRotateY}deg) rotateX(6deg) scale(0.95)`,
          transformStyle: "preserve-3d",
        }}
      />

      {/* Main Content Container */}
      <div
        style={{
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "0 60px",
          maxWidth: 1300,
        }}
      >
        {/* Badge Pill */}
        <div
          style={{
            opacity: badgeSpring,
            transform: `scale(${badgeSpring})`,
            background: `${accentColor}15`,
            color: accentColor,
            border: `1.5px solid ${accentColor}40`,
            padding: "8px 24px",
            borderRadius: 999,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.14em",
            fontFamily: FONT,
            marginBottom: 36,
            boxShadow: `0 8px 20px -5px ${accentColor}30`,
          }}
        >
          {scene.badge}
        </div>

        {/* Huge Hero Title */}
        <div
          style={{
            opacity: titleSpring,
            transform: `scale(${titleScale}) translateY(${titleY}px)`,
            marginBottom: 28,
          }}
        >
          <h1
            style={{
              ...heading(110),
              color: "#0F172A",
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              textShadow: "0 10px 30px rgba(0,0,0,0.05)",
            }}
          >
            {scene.title}
          </h1>
        </div>

        {/* Subtitle Line */}
        <div
          style={{
            opacity: subSpring,
            transform: `translateY(${interpolate(subSpring, [0, 1], [25, 0])}px)`,
            fontFamily: FONT,
            fontSize: 34,
            fontWeight: 500,
            color: "#475569",
            maxWidth: 1000,
            lineHeight: 1.4,
          }}
        >
          {scene.subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

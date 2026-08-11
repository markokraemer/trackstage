import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneConfig } from "../storyboard";
import { color, FONT, heading } from "../theme";

export const ColdOpenScene: React.FC<{ scene: SceneConfig }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Typography Spring Entry
  const popSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.5 },
  });

  const textScale = interpolate(popSpring, [0, 1], [0.85, 1]);
  const textY = interpolate(popSpring, [0, 1], [30, 0]);

  // Strike-through line draw
  const strikeProgress = interpolate(frame, [18, 32], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle reveal
  const subSpring = spring({
    frame: frame - 28,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  // Background pulse
  const bgPulse = interpolate(frame, [0, 65], [1, 1.05]);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 40%, #FFFFFF 0%, #FAFAFA 70%, #F1F5F9 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      {/* Background Subtle Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          transform: `scale(${bgPulse})`,
          opacity: 0.7,
        }}
      />

      {/* Main Content Card */}
      <div
        style={{
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 1300,
          transform: `scale(${textScale}) translateY(${textY}px)`,
        }}
      >
        {/* Warning Badge */}
        <div
          style={{
            background: "#FEE2E2",
            color: "#DC2626",
            border: "1px solid #FCA5A5",
            padding: "6px 20px",
            borderRadius: 999,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: FONT,
            marginBottom: 32,
            boxShadow: "0 4px 12px rgba(220, 38, 38, 0.15)",
          }}
        >
          THE SAAS TAX
        </div>

        {/* Question Heading with Red Strike-Through */}
        <div
          style={{
            position: "relative",
            display: "inline-block",
            marginBottom: 28,
          }}
        >
          <h1
            style={{
              ...heading(78),
              color: "#0F172A",
              lineHeight: 1.1,
            }}
          >
            <span style={{ position: "relative", display: "inline-block" }}>
              $40,000/yr
              {/* Red Strike-through line */}
              <div
                style={{
                  position: "absolute",
                  top: "52%",
                  left: -8,
                  width: `${strikeProgress}%`,
                  height: 10,
                  background: "#EF4444",
                  borderRadius: 5,
                  transform: "rotate(-3deg)",
                  boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
                }}
              />
            </span>{" "}
            for slow speaker software?
          </h1>
        </div>

        {/* Subtitle Reveal */}
        <div
          style={{
            opacity: subSpring,
            transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0])}px)`,
            fontFamily: FONT,
            fontSize: 36,
            fontWeight: 600,
            color: color.primary,
            letterSpacing: "-0.02em",
          }}
        >
          Event organizers deserve better.
        </div>
      </div>
    </AbsoluteFill>
  );
};

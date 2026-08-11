import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TrackstageMark } from "../components/TrackstageLogo";
import { SceneConfig } from "../storyboard";
import { color, FONT, heading } from "../theme";

export const EndCardScene: React.FC<{ scene: SceneConfig }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo Spring Entry
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 100, mass: 0.6 },
  });

  // URL Spring Entry
  const urlSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Bullets Spring
  const bulletsSpring = spring({
    frame: frame - 24,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // CTA Button Pulse
  const buttonPulse = interpolate(frame, [40, 160], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const bullets = ["Open Source", "Free Forever", "Lightning Fast"];

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FAFAFA 55%, #EEF2FC 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Animated Glow Orb */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(47, 92, 224, 0.18) 0%, transparent 70%)",
          filter: "blur(50px)",
          transform: `scale(${interpolate(frame, [0, 160], [0.8, 1.25])})`,
        }}
      />

      <div
        style={{
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 32,
        }}
      >
        {/* Logo Mark + Brand Name */}
        <div
          style={{
            opacity: logoSpring,
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.85, 1])})`,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <TrackstageMark size={90} />
          <span
            style={{
              ...heading(80),
              color: "#0F172A",
              letterSpacing: "-0.04em",
            }}
          >
            Trackstage
          </span>
        </div>

        {/* Primary Domain URL Highlight */}
        <div
          style={{
            opacity: urlSpring,
            transform: `translateY(${interpolate(urlSpring, [0, 1], [25, 0])}px)`,
            background: "#FFFFFF",
            border: "2px solid #2F5CE0",
            borderRadius: 20,
            padding: "16px 44px",
            boxShadow: "0 20px 50px -10px rgba(47, 92, 224, 0.3), 0 0 0 4px rgba(47, 92, 224, 0.1)",
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 52,
              fontWeight: 800,
              color: color.primary,
              letterSpacing: "-0.03em",
            }}
          >
            trackstage.app
          </span>
        </div>

        {/* 3 Pillar Bullets */}
        <div
          style={{
            opacity: bulletsSpring,
            transform: `translateY(${interpolate(bulletsSpring, [0, 1], [20, 0])}px)`,
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: 8,
          }}
        >
          {bullets.map((b, i) => (
            <React.Fragment key={i}>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 26,
                  fontWeight: 600,
                  color: "#334155",
                  letterSpacing: "-0.01em",
                }}
              >
                {b}
              </span>
              {i < bullets.length - 1 && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color.primary,
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Action Button CTA */}
        <div
          style={{
            opacity: bulletsSpring,
            transform: `scale(${buttonPulse}) translateY(10px)`,
            marginTop: 16,
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "16px 40px",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 700,
            boxShadow: "0 15px 35px rgba(15, 23, 42, 0.25)",
          }}
        >
          <span>Get Started on GitHub</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, FONT } from "../theme";

interface BrowserFrame3DProps {
  width?: number;
  height?: number;
  url?: string;
  badge?: string;
  rotateYStart?: number;
  rotateYEnd?: number;
  rotateXStart?: number;
  rotateXEnd?: number;
  zoomStart?: number;
  zoomEnd?: number;
  focusPoint?: { x: number; y: number };
  durationInFrames: number;
  children: React.ReactNode;
}

export const BrowserFrame3D: React.FC<BrowserFrame3DProps> = ({
  width = 1520,
  height = 920,
  url = "app.trackstage.app",
  badge,
  rotateYStart = -20,
  rotateYEnd = 2,
  rotateXStart = 10,
  rotateXEnd = 0,
  zoomStart = 0.95,
  zoomEnd = 1.2,
  focusPoint = { x: 50, y: 50 },
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3D Perspective Rotation Spring Settle
  const settleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85, mass: 0.7 },
  });

  const rotateY = interpolate(settleSpring, [0, 1], [rotateYStart, rotateYEnd]);
  const rotateX = interpolate(settleSpring, [0, 1], [rotateXStart, rotateXEnd]);

  // Zoom Punch effect
  const zoom = interpolate(frame, [0, durationInFrames], [zoomStart, zoomEnd], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade-in spring
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
        opacity,
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: 16,
          background: "#FFFFFF",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          boxShadow: `
            0 45px 100px -15px rgba(23, 23, 26, 0.22),
            0 15px 35px -10px rgba(47, 92, 224, 0.12),
            0 0 0 1px rgba(255, 255, 255, 0.8) inset
          `,
          transformStyle: "preserve-3d",
          transformOrigin: `${focusPoint.x}% ${focusPoint.y}%`,
          transform: `scale(${zoom}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0px)`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Browser Top Navigation Bar */}
        <div
          style={{
            height: 48,
            minHeight: 48,
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            position: "relative",
            userSelect: "none",
          }}
        >
          {/* Mac Window Controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F56" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFBD2E" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27C93F" }} />
          </div>

          {/* Address Bar */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              height: 28,
              padding: "0 18px",
              borderRadius: 8,
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 500,
              color: color.muted,
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C8A5A" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ color: "#0F172A", fontWeight: 600 }}>https://</span>
            <span>{url}</span>
          </div>

          {/* Optional Stage Badge Tag */}
          {badge && (
            <div
              style={{
                marginLeft: "auto",
                background: color.primarySurface,
                color: color.primary,
                border: "1px solid rgba(47, 92, 224, 0.2)",
                padding: "3px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontFamily: FONT,
              }}
            >
              {badge}
            </div>
          )}
        </div>

        {/* Content Container */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: "#F1F5F9",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

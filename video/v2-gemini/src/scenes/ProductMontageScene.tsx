import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame3D } from "../components/BrowserFrame3D";
import { SceneConfig } from "../storyboard";
import { color, FONT, heading } from "../theme";

export const ProductMontageScene: React.FC<{ scene: SceneConfig }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Banner Overlay Spring Entry
  const bannerSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.6 },
  });

  const bannerY = interpolate(bannerSpring, [0, 1], [40, 0]);

  // URL formatting from asset path
  const urlPath = scene.id.replace("montage-", "");
  const browserUrl = `app.trackstage.app/events/demo/${urlPath}`;

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 50%, #FFFFFF 0%, #FAFAFA 70%, #E2E8F0 100%)",
        overflow: "hidden",
      }}
    >
      {/* Background Radial Pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(47, 92, 224, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(47, 92, 224, 0.05) 0%, transparent 40%)
          `,
        }}
      />

      {/* Main 3D Browser Frame Container */}
      <div style={{ position: "absolute", inset: 0, padding: "50px 80px 140px 80px" }}>
        <BrowserFrame3D
          url={browserUrl}
          badge={scene.badge}
          rotateYStart={scene.perspective?.rotateYStart}
          rotateYEnd={scene.perspective?.rotateYEnd}
          zoomStart={scene.perspective?.zoomStart}
          zoomEnd={scene.perspective?.zoomEnd}
          focusPoint={scene.perspective?.focusPoint}
          durationInFrames={scene.durationInFrames}
        >
          {/* Render Asset Content */}
          {scene.assetType === "video" && scene.assetPath && (
            <OffthreadVideo
              src={staticFile(scene.assetPath)}
              startFrom={scene.videoStartFrom || 0}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}

          {scene.assetType === "image" && scene.assetPath && !scene.secondaryAssetPath && (
            <Img
              src={staticFile(scene.assetPath)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}

          {/* Dual Image Layout (for MCP + Embeds) */}
          {scene.assetType === "image" && scene.assetPath && scene.secondaryAssetPath && (
            <div style={{ display: "flex", width: "100%", height: "100%" }}>
              <div style={{ flex: 1, borderRight: "2px solid #E2E8F0", overflow: "hidden" }}>
                <Img
                  src={staticFile(scene.assetPath)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <Img
                  src={staticFile(scene.secondaryAssetPath)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
          )}
        </BrowserFrame3D>
      </div>

      {/* Bottom Floating Title Banner Glass Card */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 80,
          right: 80,
          zIndex: 50,
          opacity: bannerSpring,
          transform: `translateY(${bannerY}px)`,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          borderRadius: 16,
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.8) inset",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                background: color.primarySurface,
                color: color.primary,
                padding: "3px 10px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                fontFamily: FONT,
              }}
            >
              {scene.badge}
            </span>
            <h2 style={{ ...heading(28), color: "#0F172A" }}>{scene.title}</h2>
          </div>
          <p
            style={{
              fontFamily: FONT,
              fontSize: 18,
              fontWeight: 500,
              color: color.muted,
              margin: 0,
            }}
          >
            {scene.subtitle}
          </p>
        </div>

        {/* Brand Watermark / Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: color.muted }}>
            Trackstage OS
          </span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color.primary }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

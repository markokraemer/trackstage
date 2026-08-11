export interface SceneConfig {
  id: string;
  title: string;
  subtitle?: string;
  startFrame: number;
  durationInFrames: number;
  type: 'cold-open' | 'logo-beat' | 'product-montage' | 'kinetic-diff' | 'end-card';
  assetType?: 'video' | 'image' | 'dual-image';
  assetPath?: string;
  secondaryAssetPath?: string;
  videoStartFrom?: number; // frame in video to start playing
  perspective?: {
    rotateYStart: number;
    rotateYEnd: number;
    rotateXStart?: number;
    rotateXEnd?: number;
    zoomStart?: number;
    zoomEnd?: number;
    focusPoint?: { x: number; y: number }; // focus coordinates for zoom punch (percentage 0-100)
  };
  highlightColor?: string;
  badge?: string;
}

export interface Storyboard {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  audioPath: string;
  audioVolume: number;
  scenes: SceneConfig[];
}

export const STORYBOARD: Storyboard = {
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 1260, // 42 seconds
  audioPath: "audio/energetic-launch.mp3",
  audioVolume: 0.85,
  scenes: [
    {
      id: "cold-open",
      type: "cold-open",
      title: "$40,000/yr for slow speaker software?",
      subtitle: "Event organizers deserve better.",
      startFrame: 0,
      durationInFrames: 65, // ~2.17s
      highlightColor: "#EF4444", // Red strike/glow
    },
    {
      id: "logo-beat",
      type: "logo-beat",
      title: "TRACKSTAGE",
      subtitle: "The Modern Open-Source Event OS",
      startFrame: 65,
      durationInFrames: 60, // ~2.0s
      badge: "SaaS REIMAGINED",
    },
    {
      id: "montage-cfp",
      type: "product-montage",
      title: "Custom CFP Form Builder",
      subtitle: "Conditional logic, multi-track routing & custom fields",
      assetType: "video",
      assetPath: "clips/form-builder.mp4",
      videoStartFrom: 15,
      startFrame: 125,
      durationInFrames: 90, // 3s
      badge: "COLLECT",
      perspective: {
        rotateYStart: -22,
        rotateYEnd: 3,
        zoomStart: 0.95,
        zoomEnd: 1.15,
        focusPoint: { x: 50, y: 40 },
      },
    },
    {
      id: "montage-triage",
      type: "product-montage",
      title: "Lightning Submissions Triage",
      subtitle: "Filter, evaluate & stage accept/decline decisions instantly",
      assetType: "video",
      assetPath: "clips/triage.mp4",
      videoStartFrom: 30,
      startFrame: 215,
      durationInFrames: 90, // 3s
      badge: "REVIEW",
      perspective: {
        rotateYStart: 25,
        rotateYEnd: -2,
        zoomStart: 0.98,
        zoomEnd: 1.22,
        focusPoint: { x: 65, y: 45 },
      },
    },
    {
      id: "montage-commit",
      type: "product-montage",
      title: "Staged Queues & Templated Comms",
      subtitle: "Bulk commit queued decisions with personalized speaker emails",
      assetType: "video",
      assetPath: "clips/commit.mp4",
      videoStartFrom: 20,
      startFrame: 305,
      durationInFrames: 90, // 3s
      badge: "COMMUNICATE",
      perspective: {
        rotateYStart: -20,
        rotateYEnd: 4,
        zoomStart: 1.0,
        zoomEnd: 1.25,
        focusPoint: { x: 75, y: 35 },
      },
    },
    {
      id: "montage-portal",
      type: "product-montage",
      title: "Self-Serve Speaker Portal",
      subtitle: "Track deadlines, submit bio, upload slides & manage tasks",
      assetType: "video",
      assetPath: "clips/portal.mp4",
      videoStartFrom: 10,
      startFrame: 395,
      durationInFrames: 90, // 3s
      badge: "PORTAL",
      perspective: {
        rotateYStart: 22,
        rotateYEnd: -3,
        zoomStart: 0.96,
        zoomEnd: 1.18,
        focusPoint: { x: 50, y: 50 },
      },
    },
    {
      id: "montage-agenda",
      type: "product-montage",
      title: "Drag-&-Drop Agenda Grid",
      subtitle: "Real-time conflict detection with instant red flashing alerts",
      assetType: "video",
      assetPath: "clips/agenda.mp4",
      videoStartFrom: 45,
      startFrame: 485,
      durationInFrames: 100, // 3.33s
      badge: "AGENDA",
      perspective: {
        rotateYStart: -26,
        rotateYEnd: 2,
        zoomStart: 1.0,
        zoomEnd: 1.35,
        focusPoint: { x: 45, y: 55 },
      },
    },
    {
      id: "montage-publish",
      type: "product-montage",
      title: "One-Click Public Event Page",
      subtitle: "Instant responsive schedule, speaker bios & session details",
      assetType: "video",
      assetPath: "clips/publish.mp4",
      videoStartFrom: 30,
      startFrame: 585,
      durationInFrames: 90, // 3s
      badge: "PUBLISH",
      perspective: {
        rotateYStart: 20,
        rotateYEnd: -4,
        zoomStart: 0.96,
        zoomEnd: 1.2,
        focusPoint: { x: 50, y: 40 },
      },
    },
    {
      id: "montage-copilot",
      type: "product-montage",
      title: "AI Copilot & Smart Auto-Placement",
      subtitle: "Automate scheduling rules & resolve room conflicts with AI",
      assetType: "video",
      assetPath: "clips/copilot.mp4",
      videoStartFrom: 20,
      startFrame: 675,
      durationInFrames: 95, // 3.17s
      badge: "AI COPILOT",
      perspective: {
        rotateYStart: -24,
        rotateYEnd: 3,
        zoomStart: 0.98,
        zoomEnd: 1.3,
        focusPoint: { x: 70, y: 45 },
      },
    },
    {
      id: "montage-mcp",
      type: "product-montage",
      title: "Full API, MCP Tools & Embeds",
      subtitle: "Connect Claude, Cursor, or custom AI agents directly to event data",
      assetType: "image",
      assetPath: "captures/mcp.png",
      secondaryAssetPath: "captures/embeds.png",
      startFrame: 770,
      durationInFrames: 100, // 3.33s
      badge: "INTEGRATION",
      perspective: {
        rotateYStart: 28,
        rotateYEnd: -2,
        zoomStart: 0.95,
        zoomEnd: 1.15,
        focusPoint: { x: 50, y: 50 },
      },
    },
    {
      id: "diff-instant",
      type: "kinetic-diff",
      title: "Instant Everything.",
      subtitle: "Sub-100ms reactive database & zero loading spinners.",
      startFrame: 870,
      durationInFrames: 55, // ~1.83s
      badge: "01 / SPEED",
      highlightColor: "#2F5CE0",
    },
    {
      id: "diff-opensource",
      type: "kinetic-diff",
      title: "Open Source MIT.",
      subtitle: "Full codebase transparency. Host anywhere, customize anything.",
      startFrame: 925,
      durationInFrames: 55, // ~1.83s
      badge: "02 / FREEDOM",
      highlightColor: "#10B981",
    },
    {
      id: "diff-mcp",
      type: "kinetic-diff",
      title: "Full API + MCP.",
      subtitle: "Expose your event schedule directly to LLM agents.",
      startFrame: 980,
      durationInFrames: 60, // ~2.0s
      badge: "03 / AI NATIVE",
      highlightColor: "#8B5CF6",
    },
    {
      id: "diff-zero",
      type: "kinetic-diff",
      title: "$0.",
      subtitle: "No expensive per-speaker seats or booking commissions. Ever.",
      startFrame: 1040,
      durationInFrames: 60, // ~2.0s
      badge: "04 / PRICE",
      highlightColor: "#F59E0B",
    },
    {
      id: "end-card",
      type: "end-card",
      title: "trackstage.app",
      subtitle: "Open source. Free. Fast.",
      startFrame: 1100,
      durationInFrames: 160, // ~5.33s
      badge: "READY TO LAUNCH",
    },
  ],
};

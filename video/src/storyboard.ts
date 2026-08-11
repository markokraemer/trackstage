/**
 * The storyboard — the single source of truth the composition renders from.
 *
 * Narrative arc:
 *   cold open (the problem) → reveal (Trackstage) → THE PRODUCT IN DEPTH
 *   (nine real-footage chapters following the actual organizer/speaker
 *   journey) → capability flash (MCP · embeds · dashboard) → differentiator
 *   cards → close.
 *
 * All footage in `public/clips/*.mp4` is real: captured live from the seeded
 * demo app with Playwright (see `capture/`), lightly retimed. Durations are
 * the exact clip lengths at 30 fps.
 */

export const FPS = 30

export type TitleScene = {
  kind: "title"
  id: string
  durationInFrames: number
  overline?: string
  /** Each entry is a line; lines reveal word by word. */
  headline: string[]
  /** Line index rendered in muted ink (the homepage's two-tone headline). */
  mutedLine?: number
  sub?: string
}

export type RevealScene = {
  kind: "reveal"
  id: string
  durationInFrames: number
  tagline: string
  sub: string
}

export type ChapterScene = {
  kind: "chapter"
  id: string
  durationInFrames: number
  overline: string
  headline: string
  /** File under public/clips/ */
  clip: string
  /** Shown in the browser-frame URL pill. */
  url: string
}

export type StillsScene = {
  kind: "stills"
  id: string
  durationInFrames: number
  shots: Array<{ src: string; label: string; url: string; framesEach: number }>
}

export type CardsScene = {
  kind: "cards"
  id: string
  durationInFrames: number
  cards: Array<{ text: string; accent?: string }>
}

export type CloseScene = {
  kind: "close"
  id: string
  durationInFrames: number
  domain: string
  sub: string
  wink: string
}

export type Scene =
  | TitleScene
  | RevealScene
  | ChapterScene
  | StillsScene
  | CardsScene
  | CloseScene

/** Transition INTO each scene (frames of crossfade; 0 = hard cut). */
export const FADE_DEFAULT = 10

export const storyboard: Array<{ scene: Scene; fadeIn: number }> = [
  {
    fadeIn: 0,
    scene: {
      kind: "title",
      id: "cold-open",
      durationInFrames: 100,
      overline: "Every conference runs on this",
      headline: ["Event teams pay $40,000 a year", "for slow speaker software."],
      mutedLine: 1,
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "reveal",
      id: "reveal",
      durationInFrames: 126,
      tagline: "Run your call for speakers. Not your inbox.",
      sub: "Open-source speaker & program management",
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "chapter",
      id: "form-builder",
      durationInFrames: 209,
      overline: "01 · Collect",
      headline: "Build your CFP form",
      clip: "form-builder.mp4",
      url: "trackstage.app/app/forms",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "cfp",
      durationInFrames: 338,
      overline: "02 · Submit",
      headline: "Speakers apply in minutes — with live conditional logic",
      clip: "cfp.mp4",
      url: "trackstage.app/submit/ai-summit-2026",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "triage",
      durationInFrames: 206,
      overline: "03 · Review",
      headline: "Stage decisions — nothing sends by accident",
      clip: "triage.mp4",
      url: "trackstage.app/app/submissions",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "commit",
      durationInFrames: 188,
      overline: "04 · Decide",
      headline: "Commit the queue — every email goes out",
      clip: "commit.mp4",
      url: "trackstage.app/app/submissions",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "portal",
      durationInFrames: 186,
      overline: "05 · Speakers",
      headline: "Every speaker gets a portal — tasks included",
      clip: "portal.mp4",
      url: "trackstage.app/portal",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "agenda",
      durationInFrames: 278,
      overline: "06 · Schedule",
      headline: "Drag the agenda together — clashes flagged live",
      clip: "agenda.mp4",
      url: "trackstage.app/app/agenda",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "autoplace",
      durationInFrames: 164,
      overline: "07 · Auto-place",
      headline: "Or let it build itself",
      clip: "autoplace.mp4",
      url: "trackstage.app/app/agenda",
    },
  },
  {
    fadeIn: 0,
    scene: {
      kind: "chapter",
      id: "publish",
      durationInFrames: 240,
      overline: "08 · Publish",
      headline: "One click to a public schedule — .ics included",
      clip: "publish.mp4",
      url: "trackstage.app/e/ai-summit-2026",
    },
  },
  {
    fadeIn: 10,
    scene: {
      kind: "chapter",
      id: "copilot",
      durationInFrames: 300,
      overline: "09 · Copilot",
      headline: "Ask the AI. You approve. It runs.",
      clip: "copilot.mp4",
      url: "trackstage.app/app/copilot",
    },
  },
  {
    fadeIn: 10,
    scene: {
      kind: "stills",
      id: "capabilities",
      durationInFrames: 132,
      shots: [
        {
          src: "captures/mcp.png",
          label: "Operate it from Claude — MCP built in",
          url: "trackstage.app/app/account?tab=api",
          framesEach: 44,
        },
        {
          src: "captures/embeds.png",
          label: "Embed your program anywhere",
          url: "trackstage.app/app/embeds",
          framesEach: 44,
        },
        {
          src: "captures/dashboard.png",
          label: "Everything live on one dashboard",
          url: "trackstage.app/app",
          framesEach: 44,
        },
      ],
    },
  },
  {
    fadeIn: 10,
    scene: {
      kind: "cards",
      id: "differentiators",
      durationInFrames: 164,
      cards: [
        { text: "Instant everything" },
        { text: "Open source · MIT" },
        { text: "Full API + MCP" },
        { text: "$0", accent: "vs $40,000 a year" },
      ],
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "close",
      id: "close",
      durationInFrames: 152,
      domain: "trackstage.app",
      sub: "Open source. Launch-ready. Free.",
      wink: "A Kill My SaaS entry. Sessionboard — it's not you, it's your invoice.",
    },
  },
]

/** Total duration accounting for transition overlaps. */
export const totalDurationInFrames = storyboard.reduce(
  (sum, { scene, fadeIn }) => sum + scene.durationInFrames - fadeIn,
  0,
)

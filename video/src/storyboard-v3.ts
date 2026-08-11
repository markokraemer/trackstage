/**
 * Storyboard V3 — the definitive cut. V1's composure, V2's economy, and the
 * landing page's exact design language (src/components/marketing/*):
 *
 *   · title/reveal/close scenes are the hero fold come alive — white ground,
 *     graph-paper wash, announcement chip, DISPLAY_HEADING two-tone type
 *   · chapters are landing feature sections — eyebrow row (numbered glyph box
 *     + muted label, SectionIntro's language) over the real footage in the
 *     landing's own browser chrome
 *   · differentiators are the open-source section's hairline stat wall
 *
 * Footage is the V1 capture library (public/clips — real, seeded-demo,
 * Playwright-captured, already gently retimed by capture/prep-clips.mjs).
 * V3 tightens each hold with per-chapter segment trims: a segment plays the
 * source from `trimBefore` (clip frames) at `rate` (≤1.35 extra — calm, never
 * speedrun) for `hold` composition frames. Two segments in one chapter is an
 * in-frame jump cut — reads as the app navigating, not as an edit.
 *
 * Target runtime ~60s. Music: Mixkit "Digital Clouds" (CREDITS.md), no VO.
 */

export const FPS = 30

export type SegmentV3 = {
  /** Clip frames to skip before playback. */
  trimBefore: number
  /** Extra playback rate on top of the clip's baked-in retime. */
  rate: number
  /** Composition frames this segment holds. */
  hold: number
}

export type TitleSceneV3 = {
  kind: "title"
  id: string
  durationInFrames: number
  eyebrow?: string
  /** Lines; `mutedFrom` marks the first line rendered in the hero's muted ink. */
  headline: string[]
  mutedFrom?: number
}

export type RevealSceneV3 = {
  kind: "reveal"
  id: string
  durationInFrames: number
  chip: string
  tagline: string
  taglineMuted: string
  sub: string
}

export type ChapterSceneV3 = {
  kind: "chapter"
  id: string
  durationInFrames: number
  /** Step number shown in the eyebrow glyph box ("01"). */
  step: string
  /** Muted eyebrow label ("Collect"). */
  label: string
  headline: string
  clip: string
  url: string
  segments: SegmentV3[]
}

/**
 * The MCP beat — Marko: the copilot + MCP story is THE flagship
 * differentiator and gets its own proper beat, not a blink. A slow pan down
 * the real connect surface (API keys → "Connect from your AI assistant" →
 * Claude / ChatGPT / Codex tabs → the one-command connect).
 */
export type McpSceneV3 = {
  kind: "mcp"
  id: string
  durationInFrames: number
  step: string
  label: string
  headline: string
  /** File under public/captures/. */
  src: string
  url: string
}

export type StillsSceneV3 = {
  kind: "stills"
  id: string
  durationInFrames: number
  eyebrow: string
  shots: Array<{ src: string; label: string; url: string; framesEach: number }>
}

export type StatsSceneV3 = {
  kind: "stats"
  id: string
  durationInFrames: number
  eyebrow: string
  headline: string
  headlineMuted: string
  stats: Array<{ value: string; label: string; accent?: boolean }>
}

export type CloseSceneV3 = {
  kind: "close"
  id: string
  durationInFrames: number
  chip: string
  domain: string
  sub: string
  wink: string
}

export type SceneV3 =
  | TitleSceneV3
  | RevealSceneV3
  | ChapterSceneV3
  | McpSceneV3
  | StillsSceneV3
  | StatsSceneV3
  | CloseSceneV3

const chapterHold = (segments: SegmentV3[]) =>
  segments.reduce((sum, s) => sum + s.hold, 0)

const chapter = (
  scene: Omit<ChapterSceneV3, "kind" | "durationInFrames">,
): ChapterSceneV3 => ({
  kind: "chapter",
  durationInFrames: chapterHold(scene.segments),
  ...scene,
})

/** Transition INTO each scene (frames of crossfade; 0 = hard cut). */
export const storyboardV3: Array<{ scene: SceneV3; fadeIn: number }> = [
  {
    fadeIn: 0,
    scene: {
      kind: "title",
      id: "cold-open",
      durationInFrames: 90,
      eyebrow: "Every conference runs on this",
      headline: ["Event teams pay $40,000 a year", "for slow speaker software."],
      mutedFrom: 1,
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "reveal",
      id: "reveal",
      durationInFrames: 118,
      chip: "Open source, MIT licensed",
      tagline: "Run your call for speakers.",
      taglineMuted: "Not your inbox.",
      sub: "Speaker & program management for people who produce events",
    },
  },
  {
    fadeIn: 12,
    scene: chapter({
      id: "form-builder",
      step: "01",
      label: "Collect",
      headline: "Build your CFP form in an afternoon",
      clip: "form-builder.mp4",
      url: "trackstage.app/app/forms",
      segments: [{ trimBefore: 16, rate: 1.35, hold: 132 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "cfp",
      step: "02",
      label: "Submit",
      headline: "Speakers apply in minutes — conditional logic included",
      clip: "cfp.mp4",
      url: "trackstage.app/submit/ai-summit-2026",
      segments: [
        { trimBefore: 10, rate: 1.35, hold: 80 }, // welcome → email → continue
        { trimBefore: 166, rate: 1.35, hold: 132 }, // conditional → review → submitted
      ],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "triage",
      step: "03",
      label: "Review",
      headline: "Stage decisions — nothing sends by accident",
      clip: "triage.mp4",
      url: "trackstage.app/app/submissions",
      segments: [{ trimBefore: 30, rate: 1.25, hold: 130 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "commit",
      step: "04",
      label: "Decide",
      headline: "Commit the queue — every email goes out",
      clip: "commit.mp4",
      url: "trackstage.app/app/submissions",
      segments: [{ trimBefore: 30, rate: 1.2, hold: 126 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "portal",
      step: "05",
      label: "Speakers",
      headline: "Every speaker gets a portal — tasks included",
      clip: "portal.mp4",
      url: "trackstage.app/portal",
      segments: [{ trimBefore: 24, rate: 1.25, hold: 124 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "agenda",
      step: "06",
      label: "Schedule",
      headline: "Drag the agenda together — clashes flagged live",
      clip: "agenda.mp4",
      url: "trackstage.app/app/agenda",
      segments: [{ trimBefore: 76, rate: 1.3, hold: 148 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "autoplace",
      step: "07",
      label: "Auto-place",
      headline: "Or let it build itself",
      clip: "autoplace.mp4",
      url: "trackstage.app/app/agenda",
      segments: [{ trimBefore: 28, rate: 1.2, hold: 108 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "publish",
      step: "08",
      label: "Publish",
      headline: "One click to a public schedule — .ics included",
      clip: "publish.mp4",
      url: "trackstage.app/e/ai-summit-2026",
      segments: [{ trimBefore: 52, rate: 1.3, hold: 140 }],
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "copilot",
      step: "09",
      label: "Copilot",
      headline: "Ask the AI. You approve. It runs.",
      clip: "copilot.mp4",
      url: "trackstage.app/app/copilot",
      // Ask already sent → tools run → approval card → Approve & run → result.
      // (Source frames 0–88 are the empty copilot state — dead air, skipped.)
      segments: [{ trimBefore: 88, rate: 1.3, hold: 170 }],
    }),
  },
  {
    // The flagship differentiator gets its own beat (Marko): the same brain
    // from anywhere — a slow pan down the real MCP connect surface.
    fadeIn: 0,
    scene: {
      kind: "mcp",
      id: "mcp",
      durationInFrames: 116,
      step: "10",
      label: "Connect",
      headline: "Or drive it all from Claude, ChatGPT or Codex",
      src: "captures/mcp.png",
      url: "trackstage.app/app/account?tab=api",
    },
  },
  {
    // Hard cut — the browser frame persists from the copilot chapter, so a
    // crossfade would double-expose two headlines over two screens.
    fadeIn: 0,
    scene: {
      kind: "stills",
      id: "capabilities",
      durationInFrames: 96,
      eyebrow: "Also inside",
      shots: [
        {
          src: "captures/embeds.png",
          label: "Embed your program anywhere",
          url: "trackstage.app/app/embeds",
          framesEach: 48,
        },
        {
          src: "captures/dashboard.png",
          label: "Everything live on one dashboard",
          url: "trackstage.app/app",
          framesEach: 48,
        },
      ],
    },
  },
  {
    fadeIn: 10,
    scene: {
      kind: "stats",
      id: "differentiators",
      durationInFrames: 140,
      eyebrow: "The difference",
      headline: "The same jobs.",
      headlineMuted: "None of the invoice.",
      stats: [
        { value: "$0", label: "Instead of $40,000 a year", accent: true },
        { value: "MIT", label: "Open source, end to end" },
        { value: "API + MCP", label: "Operate it from anywhere" },
        { value: "Fast", label: "Instant everything" },
      ],
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "close",
      id: "close",
      durationInFrames: 152,
      chip: "Open source, MIT licensed",
      domain: "trackstage.app",
      sub: "Open source. Launch-ready. Free.",
      wink: "A Kill My SaaS entry. Sessionboard — it's not you, it's your invoice.",
    },
  },
]

export const totalDurationInFramesV3 = storyboardV3.reduce(
  (sum, { scene, fadeIn }) => sum + scene.durationInFrames - fadeIn,
  0,
)

/**
 * Storyboard FINAL — the cut that ships on the landing page.
 *
 * Taste: V1's calm (Marko's favourite), tightened with V2's rhythm where it
 * helps. Language: the landing page's own, section for section, so the film and
 * the page say the same words —
 *
 *   hero          → the reveal (headline verbatim, chip verbatim)
 *   the four jobs → chapters 01–06 (collect · submit · review · decide ·
 *                   speakers · schedule), each headline lifted from
 *                   `src/components/marketing/feature-sections.tsx`
 *   AI & devs     → chapters 09–11 (copilot · MCP connect · embeds), from
 *                   `platform-section.tsx`
 *   open source   → the stat wall + close, from `open-source.tsx` and
 *                   `closing-cta.tsx`
 *
 * Footage is a fresh capture of the product as it stands (2026-08-12): the
 * hierarchical `/app/:workspace/:event` URLs, the one-click status picker, the
 * revamped copilot, the Connect-a-client sheet, the embeds builder, the new
 * landing page. Every clip in `public/clips/final/` is ALREADY retimed and cut
 * by `capture/prep-clips-final.mjs`, so segments here play from frame 0 at
 * rate 1 — one clip, one chapter, no second retime.
 *
 * Target runtime ~81s. Music: Mixkit "Digital Clouds" (CREDITS.md), no VO.
 */

export const FPS = 30

export type {
  SegmentV3 as Segment,
  TitleSceneV3 as TitleScene,
  RevealSceneV3 as RevealScene,
  ChapterSceneV3 as ChapterScene,
  McpSceneV3 as McpScene,
  StillsSceneV3 as StillsScene,
  StatsSceneV3 as StatsScene,
  CloseSceneV3 as CloseScene,
  SceneV3 as Scene,
} from "./storyboard-v3"

import type { ChapterSceneV3, SceneV3, SegmentV3 } from "./storyboard-v3"

const chapterHold = (segments: SegmentV3[]) =>
  segments.reduce((sum, s) => sum + s.hold, 0)

const chapter = (
  scene: Omit<ChapterSceneV3, "kind" | "durationInFrames">,
): ChapterSceneV3 => ({
  kind: "chapter",
  durationInFrames: chapterHold(scene.segments),
  ...scene,
})

/**
 * One clip, played whole. `frames` is the clip's own length as printed by
 * prep-clips-final.mjs, minus two frames of safety so a chapter can never run
 * past its source onto a frozen tail.
 */
const whole = (frames: number): SegmentV3[] => [
  { trimBefore: 0, rate: 1, hold: frames - 2 },
]

/** Transition INTO each scene (frames of crossfade; 0 = hard cut). */
export const storyboardFinal: Array<{ scene: SceneV3; fadeIn: number }> = [
  {
    fadeIn: 0,
    scene: {
      kind: "title",
      id: "cold-open",
      durationInFrames: 84,
      eyebrow: "Made for the people who run events",
      headline: [
        "Software for running a call for papers",
        "has always been sold the same way.",
      ],
      mutedFrom: 1,
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "reveal",
      id: "reveal",
      durationInFrames: 130,
      chip: "Open source, MIT licensed",
      tagline: "Call for papers, agenda and speaker management.",
      taglineMuted: "In one fast, simple tool.",
      sub: "The open-source Sessionboard alternative",
    },
  },
  {
    fadeIn: 12,
    scene: chapter({
      id: "form-builder",
      step: "01",
      label: "Collect",
      headline: "Collect proposals with a form you build yourself",
      clip: "final/form-builder.mp4",
      url: "trackstage.app/app/ai-engineer/ai-summit-2026/forms",
      segments: whole(152),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "cfp",
      step: "02",
      label: "Submit",
      headline: "Speakers apply in minutes — no password needed",
      clip: "final/cfp.mp4",
      url: "trackstage.app/submit/ai-engineer/ai-summit-2026/cfp",
      segments: whole(240),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "triage",
      step: "03",
      label: "Review",
      headline: "Stage your decisions — nothing sends by accident",
      clip: "final/triage.mp4",
      url: "trackstage.app/app/ai-engineer/ai-summit-2026/submissions",
      segments: whole(156),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "commit",
      step: "04",
      label: "Decide",
      headline: "Then send the news — every email at once",
      clip: "final/commit.mp4",
      url: "trackstage.app/app/ai-engineer/ai-summit-2026/submissions",
      segments: whole(138),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "portal",
      step: "05",
      label: "Speakers",
      headline: "Every speaker gets their own portal",
      clip: "final/portal.mp4",
      url: "trackstage.app/portal",
      segments: whole(144),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "agenda",
      step: "06",
      label: "Schedule",
      headline: "Build the agenda by dragging talks into place",
      clip: "final/agenda.mp4",
      url: "trackstage.app/app/ai-engineer/ai-summit-2026/agenda",
      segments: whole(210),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "autoplace",
      step: "07",
      label: "Auto-place",
      headline: "Or let it place the rest for you",
      clip: "final/autoplace.mp4",
      url: "trackstage.app/app/ai-engineer/ai-summit-2026/agenda",
      segments: whole(141),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "publish",
      step: "08",
      label: "Publish",
      headline: "Publish the schedule when you're ready",
      clip: "final/publish.mp4",
      url: "trackstage.app/e/ai-engineer/ai-summit-2026",
      segments: whole(168),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "copilot",
      step: "09",
      label: "Copilot",
      headline: "Ask an AI to run your event. It asks you first.",
      clip: "final/copilot.mp4",
      url: "trackstage.app/app/copilot",
      segments: whole(222),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "mcp",
      step: "10",
      label: "Connect",
      headline: "Or drive it from Claude, ChatGPT or Codex",
      clip: "final/mcp.mp4",
      url: "trackstage.app/app/copilot",
      segments: whole(150),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "embeds",
      step: "11",
      label: "Embed",
      headline: "Put your program on your own website",
      clip: "final/embeds.mp4",
      url: "trackstage.app/app/ai-engineer/ai-summit-2026/embeds",
      segments: whole(167),
    }),
  },
  {
    fadeIn: 0,
    scene: chapter({
      id: "landing",
      step: "12",
      label: "Try it",
      headline: "Free, open source, and live right now",
      clip: "final/landing.mp4",
      url: "trackstage.app",
      segments: whole(108),
    }),
  },
  {
    fadeIn: 10,
    scene: {
      kind: "stats",
      id: "open-source",
      durationInFrames: 150,
      eyebrow: "The difference",
      headline: "Open source,",
      headlineMuted: "and yours to keep.",
      stats: [
        { value: "MIT", label: "The whole product, no strings" },
        { value: "100%", label: "Of the source, in the open" },
        { value: "$0", label: "Self-host or cloud beta", accent: true },
      ],
    },
  },
  {
    fadeIn: 12,
    scene: {
      kind: "close",
      id: "close",
      durationInFrames: 168,
      chip: "Open source, MIT licensed",
      domain: "trackstage.app",
      sub: "Ready to open your call for papers?",
      wink: "A Kill My SaaS entry. Sessionboard — it's not you, it's your invoice.",
    },
  },
]

export const totalDurationInFramesFinal = storyboardFinal.reduce(
  (sum, { scene, fadeIn }) => sum + scene.durationInFrames - fadeIn,
  0,
)

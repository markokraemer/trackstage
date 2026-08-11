/**
 * Storyboard V2 — "MOG HARD" cut. Same product truth as V1, half the runtime,
 * every cut on the beat.
 *
 * Music: Mixkit #136 "Infected Mushroom Vibes" (EDM, Alejandro Magaña) — see
 * CREDITS.md. Beat grid measured from the waveform: 145.0 BPM, first kick at
 * 0.255 s. We trim the first 244 frames (8.133 s) of audio so a kick lands on
 * video frame 0, then every scene boundary sits on a beat:
 *
 *   beat length  = 60/145 s      = 12.4138 frames @ 30 fps
 *   bar (4 beats)                = 49.655 frames
 *
 * All scene durations below are expressed in BEATS and accumulated with exact
 * (unrounded) arithmetic so no drift builds up across the film.
 *
 * All footage is the V1 capture library (public/clips, public/captures) —
 * real, seeded-demo, Playwright-captured. Nothing re-shot.
 */

export const FPS = 30

/** Frames per beat at 145 BPM / 30 fps. */
export const BEAT = (60 / 145) * FPS // 12.41379…
export const BAR = BEAT * 4

/** Audio: frames trimmed off the front so a kick hits video frame 0. */
export const AUDIO_TRIM_FRAMES = 244
export const AUDIO_FILE = "audio/infected-mushroom-vibes.mp3"

/** Frame number of beat n (video-relative). */
export const beatF = (n: number): number => Math.round(n * BEAT)

// ——— Scene types ————————————————————————————————————————————————————————————

export type ColdOpenAScene = { kind: "cold-open-a" }
export type ColdOpenBScene = { kind: "cold-open-b" }
export type RevealScene = { kind: "reveal" }

export type ChapterScene = {
  kind: "chapter"
  overline: string
  headline: string
  /** File under public/clips/ */
  clip: string
  /** Shown in the browser-frame URL pill. */
  url: string
  /** Seconds of source footage to skip (money-moment selection). */
  trimSec: number
  /** Source playback speed — montage runs the app at speedrun pace. */
  rate: number
  /** Tilt direction of the 3D browser frame: +1 leans right, -1 leans left. */
  tilt: 1 | -1
  /** Optional zoom punch into a UI detail. */
  punch?: { atBeat: number; origin: string }
}

export type UniverseScene = {
  kind: "universe"
  headline: string
  sub: string
  /** Files under public/captures/, laid out as a 3-column parallax wall. */
  columns: string[][]
}

export type WordScene = { kind: "word"; index: string; text: string }
export type ClimaxScene = { kind: "climax" }
export type CloseScene = {
  kind: "close"
  domain: string
  sub: string
  wink: string
}

export type SceneV2 =
  | ColdOpenAScene
  | ColdOpenBScene
  | RevealScene
  | ChapterScene
  | UniverseScene
  | WordScene
  | ClimaxScene
  | CloseScene

export type TimedScene = {
  scene: SceneV2
  id: string
  /** Composition frame the scene cuts in on (a beat, by construction). */
  from: number
  durationInFrames: number
}

// ——— The cut list (durations in beats — every cut lands on the kick) ————————

const cuts: Array<{ id: string; beats: number; scene: SceneV2 }> = [
  { id: "cold-open-a", beats: 4, scene: { kind: "cold-open-a" } },
  { id: "cold-open-b", beats: 4, scene: { kind: "cold-open-b" } },
  { id: "reveal", beats: 8, scene: { kind: "reveal" } },
  {
    id: "form-builder",
    beats: 6,
    scene: {
      kind: "chapter",
      overline: "01 · Collect",
      headline: "Build the CFP",
      clip: "form-builder.mp4",
      url: "trackstage.app/app/forms",
      trimSec: 2.2,
      rate: 1.9,
      tilt: 1,
    },
  },
  {
    id: "cfp",
    beats: 6,
    scene: {
      kind: "chapter",
      overline: "02 · Submit",
      headline: "Speakers apply in minutes",
      clip: "cfp.mp4",
      url: "trackstage.app/submit/ai-summit-2026",
      trimSec: 5.8,
      rate: 2.4,
      tilt: -1,
    },
  },
  {
    id: "triage",
    beats: 6,
    scene: {
      kind: "chapter",
      overline: "03 · Review",
      headline: "Stage every decision",
      clip: "triage.mp4",
      url: "trackstage.app/app/submissions",
      trimSec: 2.95,
      rate: 0.95,
      tilt: 1,
      punch: { atBeat: 2, origin: "13% 60%" },
    },
  },
  {
    id: "commit",
    beats: 4,
    scene: {
      kind: "chapter",
      overline: "04 · Decide",
      headline: "Commit — emails go out",
      clip: "commit.mp4",
      url: "trackstage.app/app/submissions",
      trimSec: 2.6,
      rate: 2.0,
      tilt: -1,
      punch: { atBeat: 2, origin: "25% 58%" },
    },
  },
  {
    id: "portal",
    beats: 4,
    scene: {
      kind: "chapter",
      overline: "05 · Speakers",
      headline: "Every speaker gets a portal",
      clip: "portal.mp4",
      url: "trackstage.app/portal",
      trimSec: 3.0,
      rate: 2.0,
      tilt: 1,
    },
  },
  {
    id: "agenda",
    beats: 6,
    scene: {
      kind: "chapter",
      overline: "06 · Schedule",
      headline: "Clashes flagged live",
      clip: "agenda.mp4",
      url: "trackstage.app/app/agenda",
      trimSec: 3.3,
      rate: 2.5,
      tilt: -1,
      punch: { atBeat: 3, origin: "16% 26%" },
    },
  },
  {
    id: "autoplace",
    beats: 4,
    scene: {
      kind: "chapter",
      overline: "07 · Auto-place",
      headline: "Or it builds itself",
      clip: "autoplace.mp4",
      url: "trackstage.app/app/agenda",
      trimSec: 1.8,
      rate: 2.2,
      tilt: 1,
    },
  },
  {
    id: "publish",
    beats: 6,
    scene: {
      kind: "chapter",
      overline: "08 · Publish",
      headline: "One click to public — .ics included",
      clip: "publish.mp4",
      url: "trackstage.app/e/ai-summit-2026",
      trimSec: 2.8,
      rate: 2.2,
      tilt: -1,
    },
  },
  {
    id: "copilot",
    beats: 6,
    scene: {
      kind: "chapter",
      overline: "09 · Copilot",
      headline: "Ask. Approve. Done.",
      clip: "copilot.mp4",
      url: "trackstage.app/app/copilot",
      trimSec: 3.6,
      rate: 2.6,
      tilt: 1,
      punch: { atBeat: 2.5, origin: "24% 52%" },
    },
  },
  {
    id: "universe",
    beats: 12,
    scene: {
      kind: "universe",
      headline: "Your whole program. One fast home.",
      sub: "Dashboard · Speakers · Evaluation · Comms · Embeds · MCP",
      columns: [
        ["captures/dashboard.png", "captures/speakers.png", "captures/evaluation.png"],
        ["captures/communications.png", "captures/public-event.png", "captures/embeds.png"],
        ["captures/mcp.png", "captures/dashboard.png", "captures/speakers.png"],
      ],
    },
  },
  { id: "word-instant", beats: 4, scene: { kind: "word", index: "01", text: "INSTANT" } },
  { id: "word-oss", beats: 4, scene: { kind: "word", index: "02", text: "OPEN SOURCE" } },
  { id: "word-api", beats: 4, scene: { kind: "word", index: "03", text: "FULL API + MCP" } },
  { id: "climax", beats: 10, scene: { kind: "climax" } },
  {
    id: "close",
    beats: 12,
    scene: {
      kind: "close",
      domain: "trackstage.app",
      sub: "Open source. Free. Fast.",
      wink: "A Kill My SaaS entry. Sessionboard — it's not you, it's your invoice.",
    },
  },
]

// ——— Exact accumulation: cut frames are rounded, spans are not ————————————————

export const storyboardV2: TimedScene[] = (() => {
  const out: TimedScene[] = []
  let acc = 0 // beats
  for (const { id, beats, scene } of cuts) {
    const from = beatF(acc)
    const to = beatF(acc + beats)
    out.push({ scene, id, from, durationInFrames: to - from })
    acc += beats
  }
  return out
})()

export const totalDurationInFramesV2 = beatF(
  cuts.reduce((sum, c) => sum + c.beats, 0),
)

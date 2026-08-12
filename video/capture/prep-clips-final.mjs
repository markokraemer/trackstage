/**
 * FINAL cut clip prep. Turns the raw Playwright webms into tight, already
 * retimed 30fps H.264 clips that the composition plays 1:1 from frame 0 — no
 * second retime in Remotion, so what you see here is exactly what lands in the
 * film. Dead time (page loads, waits, the walk between two controls) is cut and
 * a cut inside a clip reads as the app navigating, not as an edit.
 *
 * Each clip is [inSec, outSec, speed] segments of the raw recording, optionally
 * cropped (the MCP dialog is a small centred sheet — cropping to it is what
 * makes the endpoint and the one-line connect command legible at 1080p).
 *
 *   node video/capture/prep-clips-final.mjs [name…]
 *
 * The printed durations are what `storyboard-final.ts` holds each chapter for.
 */
import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { HERE } from "./lib.mjs"

const RAW = resolve(HERE, "raw")
const OUT = resolve(HERE, "../public/clips/final")
mkdirSync(OUT, { recursive: true })

/** name → { src, crop?: "w:h:x:y", segments: [inSec, outSec, speed][] } */
const CLIPS = {
  "form-builder": {
    src: "form-builder.webm",
    segments: [
      [2.6, 4.4, 1.4], // the forms list
      [5.3, 8.0, 1.45], // open the builder — Setup step
      [8.6, 11.4, 1.45], // Submission questions, toggles and all
    ],
  },
  cfp: {
    src: "cfp-submit.webm",
    segments: [
      [1.4, 2.8, 1.3], // the welcome card
      [5.2, 7.4, 1.4], // email address → continue
      [8.6, 10.2, 1.5], // typing the talk title
      [14.6, 18.4, 1.4], // Format → Workshop reveals the follow-up question
      [32.8, 35.2, 1.5], // review → submit → thank you
    ],
  },
  triage: {
    src: "triage.webm",
    segments: [
      [2.8, 5.4, 1.4], // the table, then the Pending tab
      [6.8, 11.8, 1.5], // search → status picker → staged, with the receipt
    ],
  },
  commit: {
    src: "commit-queue.webm",
    segments: [
      [2.6, 7.2, 1.5], // Send acceptances → the confirm sheet
      [10.0, 12.2, 1.4], // the templates the emails are written from
    ],
  },
  portal: {
    src: "portal.webm",
    segments: [
      [2.6, 6.4, 1.5], // portal home: submission, profile, tasks
      [7.6, 10.8, 1.4], // the task list → mark one complete
    ],
  },
  agenda: {
    src: "agenda-drag.webm",
    segments: [
      [3.2, 9.4, 1.4], // pick the talk out of the tray, drop it on a clash
      [10.8, 14.4, 1.4], // drag it down to a free slot — resolved
    ],
  },
  autoplace: {
    src: "auto-place.webm",
    segments: [
      [2.6, 4.4, 1.3], // Auto-place → the dialog
      [4.6, 9.6, 1.5], // place them → the grid fills in, with the receipt
    ],
  },
  publish: {
    src: "publish.webm",
    segments: [
      [2.4, 7.6, 1.5], // Publish agenda → confirm → Published pill
      [10.4, 13.6, 1.5], // the public program
    ],
  },
  copilot: {
    src: "copilot.webm",
    segments: [
      [3.8, 6.6, 1.45], // type the ask, send it
      [16.8, 21.4, 1.3], // the approval card → Approve & run
      [23.6, 26.2, 1.35], // what it did, in plain words
    ],
  },
  mcp: {
    src: "mcp-connect.webm",
    // The dialog sits at x 465–1135, y 270–730 of the 1600×1000 capture. This
    // crop keeps it (plus a little air) and drops the sidebar, the header and
    // the getting-started card — everything outside is blurred backdrop.
    crop: "1120:700:240:150",
    segments: [
      [9.8, 12.4, 1.35], // Claude: endpoint + the one-line CLI connect
      [12.6, 14.4, 1.3], // ChatGPT
      [15.0, 17.2, 1.3], // Codex
    ],
  },
  embeds: {
    src: "embeds.webm",
    segments: [
      [2.6, 5.4, 1.4], // the builder, live agenda preview
      [8.6, 11.4, 1.4], // swap the widget — the speaker gallery redraws
      [12.4, 14.6, 1.4], // the snippet you paste into your own site
    ],
  },
  landing: {
    src: "landing.webm",
    segments: [[1.4, 6.8, 1.5]], // the hero, then a calm scroll
  },
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS)

for (const name of names) {
  const clip = CLIPS[name]
  if (!clip) throw new Error(`unknown clip ${name}`)
  const src = resolve(RAW, clip.src)
  const pre = clip.crop ? `crop=${clip.crop},` : ""
  const parts = []
  const filters = []
  clip.segments.forEach(([a, b, speed], i) => {
    filters.push(
      `[0:v]${pre}trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${speed}[v${i}]`,
    )
    parts.push(`[v${i}]`)
  })
  const graph = `${filters.join(";")};${parts.join("")}concat=n=${parts.length}:v=1:a=0,fps=30,scale=1600:1000:flags=lanczos[out]`
  const dst = resolve(OUT, `${name}.mp4`)
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", src,
    "-filter_complex", graph,
    "-map", "[out]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    dst,
  ])
  const dur = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst,
  ]).toString().trim()
  console.log(`${name}: ${Number(dur).toFixed(2)}s  (${Math.floor(Number(dur) * 30)} frames)`)
}

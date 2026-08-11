/**
 * Turn the raw Playwright webms into tight, retimed, 30fps H.264 clips the
 * composition can play 1:1. Each clip is a list of [in, out, speed] segments
 * of the raw recording; dead time (page loads, waits) is cut, slow UI walks
 * are gently sped up. Durations of the outputs are printed at the end — the
 * storyboard hardcodes them.
 *
 *   node video/capture/prep-clips.mjs [name…]
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { HERE } from "./lib.mjs"

const RAW = resolve(HERE, "raw")
const OUT = resolve(HERE, "../public/clips")
mkdirSync(OUT, { recursive: true })

/** name → { src, segments: [inSec, outSec, speed][] } */
const CLIPS = {
  "form-builder": {
    src: "form-builder.webm",
    segments: [[9.4, 20.2, 1.55]],
  },
  cfp: {
    src: "cfp-submit.webm",
    segments: [
      [2.8, 9.0, 1.6], // welcome → email → continue
      [10.2, 13.4, 1.7], // title typing
      [17.8, 21.2, 1.35], // Format→Workshop, conditional question appears
      [34.4, 39.5, 1.45], // review → submit → success
    ],
  },
  triage: {
    src: "triage.webm",
    segments: [[4.8, 15.8, 1.55]],
  },
  commit: {
    src: "commit-queue.webm",
    segments: [
      [3.0, 8.4, 1.3], // Send acceptances → dialog
      [12.9, 15.2, 1.0], // communications templates
    ],
  },
  portal: {
    src: "portal.webm",
    segments: [[3.0, 11.9, 1.4]],
  },
  copilot: {
    src: "copilot.webm",
    segments: [
      [2.9, 7.2, 1.45], // typing the ask
      [10.8, 16.6, 1.15], // approval card + approve
      [17.2, 20.8, 1.5], // staged result
    ],
  },
  agenda: {
    src: "agenda-drag.webm",
    segments: [[3.0, 15.4, 1.3]],
  },
  autoplace: {
    src: "auto-place.webm",
    segments: [[2.9, 10.3, 1.35]],
  },
  publish: {
    src: "publish.webm",
    segments: [
      [2.8, 9.4, 1.5], // publish → dialog → confirm → pill
      [12.0, 17.4, 1.4], // public event page scroll
    ],
  },
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS)

for (const name of names) {
  const clip = CLIPS[name]
  if (!clip) throw new Error(`unknown clip ${name}`)
  const src = resolve(RAW, clip.src)
  const parts = []
  const filters = []
  clip.segments.forEach(([a, b, speed], i) => {
    filters.push(
      `[0:v]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${speed}[v${i}]`,
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
  console.log(`${name}: ${Number(dur).toFixed(2)}s`)
}

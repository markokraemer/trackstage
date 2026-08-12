/**
 * Generate the launch-film voiceover with ElevenLabs.
 *
 * Reads vo/lines.json, synthesizes each line (passing previous/next text so
 * prosody flows line-to-line), trims edge silence, loudness-normalizes to
 * -16 LUFS, and writes public/audio/vo/<id>.mp3. Prints a duration table in
 * both seconds and 30fps frames, and writes it to vo/durations.json for the
 * storyboard retime.
 *
 * Usage:  XI_API_KEY=... node vo/generate.mjs [id ...]
 *         (with ids, regenerates only those lines)
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const key = process.env.XI_API_KEY
if (!key) throw new Error("XI_API_KEY not set")

const { voice, lines } = JSON.parse(readFileSync(join(here, "lines.json"), "utf8"))
const only = process.argv.slice(2)
const rawDir = join(here, "raw")
const outDir = join(here, "..", "public", "audio", "vo")
mkdirSync(rawDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const FPS = 30

const tts = async (line, i) => {
  const body = {
    text: line.text,
    model_id: voice.model,
    voice_settings: voice.settings,
    previous_text: i > 0 ? lines[i - 1].text : undefined,
    next_text: i < lines.length - 1 ? lines[i + 1].text : undefined,
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) throw new Error(`${line.id}: ${res.status} ${await res.text()}`)
  return Buffer.from(await res.arrayBuffer())
}

const durations = existsSync(join(here, "durations.json"))
  ? JSON.parse(readFileSync(join(here, "durations.json"), "utf8"))
  : {}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (only.length && !only.includes(line.id)) continue
  const raw = join(rawDir, `${line.id}.mp3`)
  writeFileSync(raw, await tts(line, i))
  const out = join(outDir, `${line.id}.mp3`)
  // Trim leading/trailing silence below -45dB, then normalize to -16 LUFS.
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", raw,
    "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05," +
      "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse," +
      "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ar", "44100", "-b:a", "192k",
    out,
  ])
  const secs = parseFloat(
    execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out,
    ]).toString(),
  )
  durations[line.id] = { seconds: secs, frames: Math.ceil(secs * FPS) }
  console.log(`${line.id.padEnd(14)} ${secs.toFixed(2)}s  ${durations[line.id].frames}f`)
}

writeFileSync(join(here, "durations.json"), JSON.stringify(durations, null, 2) + "\n")

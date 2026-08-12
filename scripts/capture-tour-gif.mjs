/**
 * Builds `public/screenshots/platform-tour.gif` — the social-ready tour of the
 * whole product: landing → dashboard → submissions → agenda (a real drag) →
 * speaker portal → public CFP → copilot → embeds → public schedule → "See it
 * working, right now."
 *
 *   pnpm dev                                   # dev server on :3000
 *   pnpm exec convex run seed:setup            # seeded demo data
 *   node scripts/capture-tour-gif.mjs          # capture + assemble
 *   node scripts/capture-tour-gif.mjs --frames # capture stills only
 *   node scripts/capture-tour-gif.mjs --gif    # re-assemble from cached stills
 *
 * Everything is driven through the real UI, exactly like
 * scripts/capture-screenshots.mjs (which this borrows its sign-in, event
 * selection and settle helpers from) — so the tour can never drift from what a
 * visitor actually gets.
 *
 * READ-ONLY on the demo data: the agenda drag is CANCELLED with Escape, and no
 * copilot message is ever sent that writes (the copilot's own confirm gate
 * would stop it anyway).
 */
import { chromium } from "@playwright/test"
import { mkdir, rm, readdir, readFile, copyFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const exec = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = resolve(root, "public/screenshots")
const FRAMES = resolve(root, ".tour-frames")
const GIF = resolve(OUT, "platform-tour.gif")
const DOWNLOAD = resolve(homedir(), "Downloads/trackstage-tour.gif")

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const ORGANIZER = { email: "organizer@demo.sessionboard.dev", password: "demo2026" }
const PORTAL_TOKEN = process.env.PORTAL_TOKEN ?? "demo-ava-nakamura"
const EVENT_NAME = "AI Engineer Summit 2026"
const EVENT_SLUG = "ai-summit-2026"
const CFP_FORM_SLUG = "cfp"

/** 1600×1000 at retina — the same frame the launch-video pipeline shoots. */
const VIEWPORT = { width: 1600, height: 1000 }
const CONTEXT_OPTS = {
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  colorScheme: "light",
  reducedMotion: "reduce",
}

const args = process.argv.slice(2)
const ONLY_FRAMES = args.includes("--frames")
const ONLY_GIF = args.includes("--gif")

const log = (...a) => console.log("·", ...a)

/** Frames land as `NN-name.png`; ffmpeg consumes them in that sorted order. */
let frameNo = 0
const shots = []

async function settle(page, ms = 1400) {
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(ms)
}

async function chrome(page) {
  // The TanStack devtools bubble must never appear in a shot; neither should a
  // focus ring left over from a click, or an entry animation mid-flight.
  await page
    .addStyleTag({
      content: `
        [data-testid="tanstack_devtools"]{display:none !important}
        *:focus-visible{outline:none !important;box-shadow:none !important}
      `,
    })
    .catch(() => {})
}

/**
 * The caption pill.
 *
 * Rendered INSIDE the page rather than burned in by ffmpeg's drawtext so it
 * inherits the product's own font stack and reads as part of the brand instead
 * of a generic subtitle. Bottom-left, out of the way of every screen's content.
 */
async function caption(page, text) {
  await page
    .evaluate((label) => {
      document.getElementById("__tour_caption__")?.remove()
      if (!label) return
      const el = document.createElement("div")
      el.id = "__tour_caption__"
      el.textContent = label
      Object.assign(el.style, {
        position: "fixed",
        left: "28px",
        bottom: "28px",
        zIndex: "2147483647",
        padding: "10px 18px",
        borderRadius: "999px",
        background: "rgba(27,30,39,0.92)",
        color: "#fff",
        font: "600 17px/1.2 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        letterSpacing: "-0.01em",
        boxShadow: "0 8px 24px rgba(15,23,42,0.28)",
        pointerEvents: "none",
      })
      document.body.appendChild(el)
    }, text)
    .catch(() => {})
}

async function shot(page, name, label, opts = {}) {
  if (!opts.raw) await settle(page, opts.settle ?? 1200)
  await chrome(page)
  await caption(page, label)
  await page.waitForTimeout(120)
  const file = `${String(++frameNo).padStart(2, "0")}-${name}.png`
  await page.screenshot({ path: resolve(FRAMES, file) })
  shots.push({ file, name, label, hold: opts.hold ?? 1.2 })
  log(`frame ${file}${label ? ` — "${label}"` : ""}`)
}

async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  for (let attempt = 0; attempt < 4; attempt++) {
    const email = page.getByLabel("Email").first()
    const password = page.getByLabel("Password").first()
    await email.fill(ORGANIZER.email)
    await password.fill(ORGANIZER.password)
    await page.waitForTimeout(300)
    if ((await email.inputValue()) !== ORGANIZER.email) continue
    await page.getByRole("button", { name: /^sign in$/i }).first().click()
    try {
      await page.waitForURL(/\/app/, { timeout: 10000 })
      return
    } catch {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
    }
  }
  throw new Error("could not sign in as the demo organizer")
}

let demoRef = null

async function selectDemoEvent(page) {
  try {
    await page.goto(`${BASE}/app/events`, { waitUntil: "networkidle" })
    await settle(page, 800)
    const card = page.locator('[data-slot="card"]').filter({ hasText: EVENT_NAME }).first()
    await card.getByRole("button", { name: /open event|go to dashboard/i }).click({ timeout: 6000 })
    await page.waitForURL(/\/app\/[^/]+\/[^/]+/, { timeout: 8000 }).catch(() => {})
    await settle(page, 500)
    const match = new URL(page.url()).pathname.match(/^\/app\/([^/]+)\/([^/]+)/)
    if (match && match[2] !== "workspace") demoRef = { workspaceSlug: match[1], eventSlug: match[2] }
    log(`demo event: ${demoRef ? `/app/${demoRef.workspaceSlug}/${demoRef.eventSlug}` : "(default)"}`)
  } catch {
    log(`could not select "${EVENT_NAME}" — continuing with the default event`)
  }
}

const EVENT_SECTIONS = [
  "submissions", "forms", "evaluation", "agenda", "speakers",
  "files", "communications", "embeds", "settings",
]

function canonical(path) {
  if (!demoRef) return path
  const base = `/app/${demoRef.workspaceSlug}/${demoRef.eventSlug}`
  if (path === "/app") return base
  const rest = path.replace(/^\/app\//, "")
  const section = rest.split(/[/?]/)[0]
  return EVENT_SECTIONS.includes(section) ? `${base}/${rest}` : path
}

async function gotoSafe(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle" })
  } catch {
    await page.waitForTimeout(800)
    await page.goto(url, { waitUntil: "networkidle" })
  }
}

async function gotoOrganizer(page, path) {
  await gotoSafe(page, `${BASE}${canonical(path)}`)
  await settle(page, 500)
  const onDemo = await page.locator("aside").getByText(EVENT_NAME).count().catch(() => 0)
  if (onDemo === 0) {
    await selectDemoEvent(page)
    await gotoSafe(page, `${BASE}${canonical(path)}`)
    await settle(page, 500)
  }
}

async function tryClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 4000 })
    await page.waitForTimeout(600)
    return true
  } catch {
    log(`skipped: ${label}`)
    return false
  }
}

// ——————————————————————————————————————————————————————————————————————————
// The tour
// ——————————————————————————————————————————————————————————————————————————

async function captureFrames() {
  const browser = await chromium.launch()
  const context = await browser.newContext(CONTEXT_OPTS)
  const page = await context.newPage()

  // 1 — Landing hero. Shot signed-OUT so the nav reads "Sign in", i.e. what a
  //     visitor arriving from the tweet actually sees.
  await gotoSafe(page, `${BASE}/`)
  await settle(page, 1600)
  await shot(page, "landing", "Trackstage — run your whole conference", { hold: 1.5 })

  await signIn(page)
  await selectDemoEvent(page)

  // 2 — Organizer dashboard
  await gotoOrganizer(page, "/app")
  await shot(page, "dashboard", "One dashboard for the whole event")

  // 3 — Submissions table, sorted by score (see capture-screenshots.mjs: this
  //     floats the seeded programme above any transient e2e fixtures).
  await gotoOrganizer(page, "/app/submissions")
  await settle(page)
  await tryClick(page, page.locator("thead").getByText(/^score$/i), "sort by Score")
  await shot(page, "submissions", "Triage every abstract in one table")

  // 4 — Agenda: a real drag, three frames, held short so it reads as motion.
  await gotoOrganizer(page, "/app/agenda")
  await settle(page)
  await tryClick(page, page.getByText(/^day$/i), "agenda Day view")
  await settle(page)
  await scrollGridToProgramme(page)
  await captureAgendaDrag(page)

  // 5 — Speaker portal (the token link signs the speaker in)
  await gotoSafe(page, `${BASE}/portal/t/${PORTAL_TOKEN}`)
  await settle(page, 1400)
  await shot(page, "portal", "Speakers get their own portal")

  // 6 — Public CFP form. The bare `/submit/:ws/:event` address is a form INDEX;
  //     the call itself lives at `/…/:formSlug` (seed prints it as `cfpPath`).
  await gotoSafe(
    page,
    demoRef
      ? `${BASE}/submit/${demoRef.workspaceSlug}/${demoRef.eventSlug}/${CFP_FORM_SLUG}`
      : `${BASE}/submit/${EVENT_SLUG}/${CFP_FORM_SLUG}`
  )
  await settle(page, 1400)
  await shot(page, "cfp", "A call for papers anyone can fill in")

  // 7 — Copilot, mid-answer with a tool card on screen.
  await captureCopilot(page)

  // 8 — Embeds builder
  await gotoOrganizer(page, "/app/embeds")
  await shot(page, "embeds", "Embed the agenda anywhere")

  // 9 — The published public schedule, in the wall-planner room grid
  //     (`?view=rooms`); the by-time list is the same information but reads as
  //     a wall of text at GIF size. Both are plain links, so the view is a
  //     query param rather than a click.
  const publicBase = demoRef
    ? `${BASE}/e/${demoRef.workspaceSlug}/${demoRef.eventSlug}`
    : `${BASE}/e/${EVENT_SLUG}`
  await gotoSafe(page, `${publicBase}?view=rooms`)
  await settle(page, 1400)
  await shot(page, "public-schedule", "…and publish the programme")

  // 10 — Back to the landing page, on the live-demo entries. Loops cleanly into
  //      frame 1, which is the same page scrolled to the top.
  await gotoSafe(page, `${BASE}/`)
  await settle(page, 1600)
  await page.evaluate(() => {
    const section = document.querySelector("#demos")
    if (!section) return
    // `block:"start"` lands the section heading just under the sticky nav
    // instead of leaving a sliver of the previous section across the top.
    const top = section.getBoundingClientRect().top + window.scrollY - 72
    window.scrollTo({ top, behavior: "instant" })
  })
  await page.waitForTimeout(700)
  await shot(page, "try-it", "Open source. Try it live.", { hold: 1.8 })

  await browser.close()
}

/** Day grid opens at midnight — scroll it onto the actual programme. */
async function scrollGridToProgramme(page) {
  await page
    .evaluate(() => {
      const card = document.querySelector("[data-session-card], .cursor-grab")
      let node = card?.parentElement ?? null
      while (node && node !== document.body) {
        const style = getComputedStyle(node)
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
          node.scrollTop = Math.max(0, (card?.offsetTop ?? 0) - 48)
          return
        }
        node = node.parentElement
      }
    })
    .catch(() => {})
  await page.waitForTimeout(400)
}

/**
 * Three frames of a real drag — idle, picked up, over a clash (everything goes
 * red) — then Escape, so the shared demo agenda is left exactly as we found it.
 * Same technique as capture-screenshots.mjs::captureAgendaFlow.
 */
async function captureAgendaDrag(page) {
  await chrome(page)
  const label = "Drag-and-drop agenda, with live conflict checks"
  const card = page.locator('[data-slot="agenda-grid-block"] button, .cursor-grab').first()
  try {
    const box = await card.boundingBox({ timeout: 3000 })
    if (!box) throw new Error("no draggable")
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await shot(page, "agenda-a", label, { raw: true, hold: 0.9 })
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (const dy of [6, 18, 34]) await page.mouse.move(x, y + dy, { steps: 3 })
    await page.waitForTimeout(350)

    const columns = await page.locator("[data-room]").all()
    const neighbour = columns.length > 1 ? await columns[1].boundingBox() : null
    const nx = neighbour ? neighbour.x + neighbour.width / 2 : x + 10
    for (const dy of [60, 96, 130]) await page.mouse.move(nx, y + dy, { steps: 4 })
    await page.waitForTimeout(400)
    await shot(page, "agenda-b", label, { raw: true, hold: 0.7 })

    // Over an occupied slot: the pre-warning turns the ghost and the chip red
    // and names the session it would double-book. The target has to be a block
    // in a DIFFERENT column from the one in hand — `.last()` frequently returns
    // the dragged block's own placeholder, which produces a frame identical to
    // the idle one.
    const blocks = await page.locator(`[data-slot="agenda-grid-block"]`).all()
    let clash = null
    for (const block of blocks) {
      const b = await block.boundingBox().catch(() => null)
      if (b && Math.abs(b.x - box.x) > 120) clash = b
    }
    if (clash) {
      await page.mouse.move(clash.x + clash.width / 2, clash.y + 14, { steps: 10 })
      await page.waitForTimeout(600)
      await shot(page, "agenda-c", label, { raw: true, hold: 1.1 })
    } else {
      log("no cross-column block to clash with — skipping the conflict frame")
    }
    await page.keyboard.press("Escape")
    await page.mouse.up()
    await page.waitForTimeout(700)
    log("agenda drag captured (cancelled — nothing moved)")
  } catch {
    log("drag unavailable — falling back to the Conflicts view")
    await shot(page, "agenda-a", label)
    await tryClick(page, page.getByRole("button", { name: /^conflicts$/i }), "Conflicts view")
    await shot(page, "agenda-c", label)
  }
}

/**
 * The copilot answering a real question, caught while a tool card is on screen.
 *
 * The prompt is deliberately READ-shaped: every write tool in the copilot is
 * behind a confirm gate, and this script has no business changing the demo
 * event. If the model is unreachable (no OPENROUTER_API_KEY on the dev server)
 * the empty state is still a fine frame, so a failure here never aborts.
 */
async function captureCopilot(page) {
  const label = "Ask the copilot — it runs the same tools you do"
  try {
    await gotoOrganizer(page, "/app/copilot")
    await settle(page, 1200)
    const input = page.locator("textarea").first()
    await input.click({ timeout: 5000 })
    await input.fill("Which sessions are still missing a room, and how is the CFP doing overall?")
    await page.waitForTimeout(300)
    await page.keyboard.press("Enter")

    // Wait for a tool card to render, then let the answer stream in under it.
    const toolCard = page.locator('[data-slot="tool-frame"]').first()
    await toolCard.waitFor({ timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(12000)
    // Frame the TOOL CARD, not the tail of the answer: the point of this screen
    // is that the copilot runs the same tools the organizer does, and the card
    // naming the tool is the only thing that says so. Scrolling to the bottom
    // pushes it off the top and leaves prose.
    await toolCard
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
      .catch(() => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)))
    await page.waitForTimeout(500)
    await shot(page, "copilot", label, { hold: 1.6 })
  } catch (error) {
    log(`copilot frame degraded: ${String(error).slice(0, 120)}`)
    await shot(page, "copilot", label, { hold: 1.4 })
  }
}

// ——————————————————————————————————————————————————————————————————————————
// Assembly
// ——————————————————————————————————————————————————————————————————————————

const WIDTH = 1200
const HEIGHT = 750
const FPS = 14
const FADE = 0.3

/**
 * Stills → looping GIF.
 *
 * Two passes on purpose: an intermediate near-lossless MP4 carries the xfade
 * crossfades, and only then does palettegen/paletteuse quantise the whole thing
 * with ONE palette computed over every frame — which is what keeps the UI's
 * flat greys from banding across a cut.
 *
 * NO Ken Burns push. It was tried and reverted: a slow zoom repaints every
 * pixel of every frame, which defeats the GIF encoder's changed-rectangle
 * coding entirely — the same tour came out at 19 MB with it and under 5 MB
 * without. Holding the frames still is also simply easier to read at 1.2s a
 * screen, and the crossfades already carry the motion.
 */
async function buildGif(frames) {
  const inputs = []
  const filters = []

  frames.forEach((frame, i) => {
    const dur = frame.hold + FADE
    inputs.push("-loop", "1", "-t", String(dur.toFixed(2)), "-i", resolve(FRAMES, frame.file))
    filters.push(
      `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=${WIDTH}:${HEIGHT},fps=${FPS},setsar=1[v${i}]`
    )
  })

  // Chain the crossfades. Each xfade eats FADE seconds of overlap, so the
  // running offset is the sum of holds so far.
  let prev = "[v0]"
  let offset = frames[0].hold
  for (let i = 1; i < frames.length; i++) {
    const out = i === frames.length - 1 ? "[vout]" : `[x${i}]`
    filters.push(
      `${prev}[v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}${out}`
    )
    prev = `[x${i}]`
    offset += frames[i].hold
  }

  const mp4 = resolve(FRAMES, "tour.mp4")
  await exec(
    "ffmpeg",
    [
      "-y", ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[vout]",
      "-r", String(FPS),
      "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p",
      mp4,
    ],
    { maxBuffer: 1 << 26 }
  )
  log(`intermediate: ${mp4.replace(`${root}/`, "")}`)

  // One global palette over the whole tour, Bayer-dithered — the UI is flat
  // colour, so a per-frame palette would shimmer on every crossfade.
  await exec(
    "ffmpeg",
    [
      "-y", "-i", mp4,
      "-filter_complex",
      `[0:v]split[a][b];[a]palettegen=max_colors=${process.env.TOUR_COLORS ?? 128}:stats_mode=diff[p];` +
        `[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
      "-loop", "0",
      GIF,
    ],
    { maxBuffer: 1 << 26 }
  )

  const { size } = await stat(GIF)
  log(`saved ${GIF.replace(`${root}/`, "")} — ${(size / 1e6).toFixed(2)} MB`)
  await copyFile(GIF, DOWNLOAD)
  log(`copied to ${DOWNLOAD}`)
  return size
}

/** Rebuild the frame list from disk (so `--gif` works on cached stills). */
async function framesFromDisk() {
  const files = (await readdir(FRAMES)).filter((f) => f.endsWith(".png")).sort()
  return files.map((file) => ({
    file,
    hold: /agenda-a/.test(file) ? 0.9
      : /agenda-b/.test(file) ? 0.7
      : /agenda-c/.test(file) ? 1.1
      : /landing/.test(file) ? 1.5
      : /copilot/.test(file) ? 1.6
      : /try-it/.test(file) ? 1.8
      : 1.2,
  }))
}

/**
 * Byte-identical frames are a dead second in a GIF that only runs for fifteen.
 * They happen when an interaction silently no-ops — a drag that never engaged,
 * a view that never switched — so fold them into the frame before rather than
 * shipping a stutter, and say so.
 */
async function dropDuplicates(frames) {
  const kept = []
  let lastHash = null
  for (const frame of frames) {
    const buf = await readFile(resolve(FRAMES, frame.file))
    const hash = createHash("sha1").update(buf).digest("hex")
    if (hash === lastHash && kept.length) {
      kept[kept.length - 1].hold += frame.hold
      log(`duplicate frame folded into the one before it: ${frame.file}`)
      continue
    }
    lastHash = hash
    kept.push(frame)
  }
  return kept
}

async function main() {
  await mkdir(OUT, { recursive: true })
  if (!ONLY_GIF) {
    await rm(FRAMES, { recursive: true, force: true })
    await mkdir(FRAMES, { recursive: true })
    await captureFrames()
  }
  if (ONLY_FRAMES) return
  if (!existsSync(FRAMES)) throw new Error("no cached frames — run without --gif first")
  const frames = await dropDuplicates(ONLY_GIF ? await framesFromDisk() : shots)
  if (!frames.length) throw new Error("no frames captured")
  await buildGif(frames)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

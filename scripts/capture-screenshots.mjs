/**
 * Captures the real product screenshots used on the marketing landing page.
 *
 *   pnpm dev                                   # dev server on :3000
 *   pnpm exec convex run seed:setup            # seeded demo data
 *   node scripts/capture-screenshots.mjs       # writes public/screenshots/*
 *
 * Everything is driven through the real UI (sign in, click, navigate) so the
 * shots can never drift from what a visitor actually gets. Re-run it after any
 * design change — it overwrites in place. See scripts/capture-screenshots.md.
 */
import { chromium } from "@playwright/test"
import { mkdir, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const exec = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = resolve(root, "public/screenshots")
const FRAMES = resolve(root, ".screenshot-frames")

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const ORGANIZER = { email: "organizer@demo.sessionboard.dev", password: "demo2026" }
const PORTAL_TOKEN = process.env.PORTAL_TOKEN ?? "demo-ava-nakamura"
const EVENT_SLUG = "ai-summit-2026"
const VIEWPORT = { width: 1440, height: 900 }

const log = (...a) => console.log("·", ...a)

/** Give Convex subscriptions + entry animations time to settle. */
async function settle(page, ms = 1400) {
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(ms)
}

/** The TanStack devtools bubble must never show up in a marketing shot. */
async function hideDevtools(page) {
  await page
    .addStyleTag({
      content: `[data-testid="tanstack_devtools"]{display:none !important}`,
    })
    .catch(() => {})
}

async function shot(page, name, dir = OUT) {
  await settle(page)
  await hideDevtools(page)
  const path = resolve(dir, `${name}.png`)
  await page.screenshot({ path })
  log(`saved ${path.replace(`${root}/`, "")}`)
}

async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  // Controlled inputs get wiped if filled pre-hydration — refill until it sticks.
  for (let attempt = 0; attempt < 4; attempt++) {
    const email = page.getByLabel("Email").first()
    const password = page.getByLabel("Password").first()
    await email.fill(ORGANIZER.email)
    await password.fill(ORGANIZER.password)
    await page.waitForTimeout(300)
    if ((await email.inputValue()) !== ORGANIZER.email) continue
    await page
      .getByRole("button", { name: /^sign in$/i })
      .first()
      .click()
    try {
      await page.waitForURL(/\/app/, { timeout: 8000 })
      return
    } catch {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
    }
  }
  throw new Error("could not sign in as the demo organizer")
}

/** Best-effort click — a missing control must not abort the whole run. */
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

async function main() {
  await mkdir(OUT, { recursive: true })
  await rm(FRAMES, { recursive: true, force: true })
  await mkdir(FRAMES, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // retina — the landing renders these at half size
    colorScheme: "light",
    reducedMotion: "reduce",
  })
  const page = await context.newPage()

  const consoleErrors = []
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()))

  // 1 — Organizer dashboard
  await signIn(page)
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" })
  await shot(page, "dashboard")

  // 2 — Submissions table
  await page.goto(`${BASE}/app/submissions`, { waitUntil: "networkidle" })
  await shot(page, "submissions")

  // 3 — Agenda: list view (dense) + day grid scrolled onto the programme
  await page.goto(`${BASE}/app/agenda`, { waitUntil: "networkidle" })
  await settle(page)
  await tryClick(page, page.getByText(/^list$/i), "agenda List view")
  await shot(page, "agenda-list")
  await tryClick(page, page.getByText(/^day$/i), "agenda Day view")
  await settle(page)
  await scrollGridToProgramme(page)
  await shot(page, "agenda")

  // 3b — Agenda drag frames for the flow GIF
  await captureAgendaFlow(page)

  // 4 — Form builder, question step
  await page.goto(`${BASE}/app/forms`, { waitUntil: "networkidle" })
  await tryClick(page, page.getByRole("link", { name: /call for speakers|cfp|edit/i }), "open form")
  if (!page.url().match(/\/app\/forms\/[^/]+$/)) {
    await tryClick(page, page.locator("a[href*='/app/forms/']"), "open form (href)")
  }
  await settle(page)
  await tryClick(page, page.getByText(/submission questions/i), "form step: Submission questions")
  await shot(page, "form-builder")

  // 5 — Speaker portal (token link signs the speaker in)
  await page.goto(`${BASE}/portal/t/${PORTAL_TOKEN}`, { waitUntil: "networkidle" })
  await settle(page)
  await shot(page, "portal")

  // 6 — Public schedule
  await page.goto(`${BASE}/e/${EVENT_SLUG}`, { waitUntil: "networkidle" })
  await shot(page, "public-schedule")

  await browser.close()

  await buildGif()

  if (consoleErrors.length) {
    console.log("\nconsole errors seen while capturing:")
    for (const e of consoleErrors.slice(0, 10)) console.log("  !", e.slice(0, 200))
  }
}

/**
 * The day grid opens at midnight; scroll its container so the first scheduled
 * session sits near the top instead of shooting an empty overnight block.
 */
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
 * Four frames of a real agenda drag: idle → lifted → moved → dropped.
 * dnd-kit needs a mousedown plus several small moves before it activates.
 */
async function captureAgendaFlow(page) {
  await hideDevtools(page)
  const card = page.locator("[data-session-card], .cursor-grab").first()
  try {
    const box = await card.boundingBox({ timeout: 3000 })
    if (!box) throw new Error("no draggable")
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await page.screenshot({ path: resolve(FRAMES, "f1.png") })
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (const dy of [6, 18, 34]) await page.mouse.move(x, y + dy, { steps: 3 })
    await page.waitForTimeout(250)
    await page.screenshot({ path: resolve(FRAMES, "f2.png") })
    for (const dy of [60, 96, 130]) await page.mouse.move(x + 10, y + dy, { steps: 4 })
    await page.waitForTimeout(250)
    await page.screenshot({ path: resolve(FRAMES, "f3.png") })
    await page.mouse.up()
    await page.waitForTimeout(900)
    await page.screenshot({ path: resolve(FRAMES, "f4.png") })
    log("captured 4 agenda drag frames")
  } catch {
    // Fallback: cycle the view switcher so the GIF still shows real product.
    log("drag frames unavailable — falling back to view-switch frames")
    let i = 1
    for (const view of ["List", "Day", "Week", "Conflicts"]) {
      await tryClick(page, page.getByRole("button", { name: new RegExp(`^${view}$`, "i") }), view)
      await page.waitForTimeout(700)
      await page.screenshot({ path: resolve(FRAMES, `f${i++}.png`) })
    }
  }
}

/** Assemble the frames into a small looping GIF (needs ffmpeg on PATH). */
async function buildGif() {
  if (!existsSync(resolve(FRAMES, "f1.png"))) return log("no frames — skipping GIF")
  try {
    await exec("ffmpeg", ["-version"])
  } catch {
    return log("ffmpeg not found — skipping GIF")
  }
  const out = resolve(OUT, "agenda-flow.gif")
  await exec("ffmpeg", [
    "-y",
    "-framerate", "1.2",
    "-i", resolve(FRAMES, "f%d.png"),
    "-vf", "scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer",
    "-loop", "0",
    out,
  ])
  await rm(FRAMES, { recursive: true, force: true })
  log(`saved ${out.replace(`${root}/`, "")}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Captures the real product screenshots used on the marketing landing page,
 * and (separately) the screenshots used in the /docs user guide.
 *
 *   pnpm dev                                   # dev server on :3000
 *   pnpm exec convex run seed:setup            # seeded demo data
 *   node scripts/capture-screenshots.mjs             # marketing + docs shots
 *   node scripts/capture-screenshots.mjs --marketing # public/screenshots/* only
 *   node scripts/capture-screenshots.mjs --docs       # public/docs/* only
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
const DOCS_OUT = resolve(root, "public/docs")
const FRAMES = resolve(root, ".screenshot-frames")

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const ORGANIZER = { email: "organizer@demo.sessionboard.dev", password: "demo2026" }
const PORTAL_TOKEN = process.env.PORTAL_TOKEN ?? "demo-ava-nakamura"
const SPEAKER_EMAIL = "ava.nakamura@example.com" // same person as PORTAL_TOKEN — identify() is a no-op read
const EVENT_SLUG = "ai-summit-2026"
const EVENT_NAME = "AI Engineer Summit 2026" // convex/seed.ts DEMO_EVENT_SLUG's display name
const CFP_FORM_SLUG = "cfp" // the open call for papers on the demo event
const VIEWPORT = { width: 1440, height: 900 }
const CONTEXT_OPTS = {
  viewport: VIEWPORT,
  deviceScaleFactor: 2, // retina — everything renders these at half size
  colorScheme: "light",
  reducedMotion: "reduce",
}

const args = process.argv.slice(2)
const MODE = args.includes("--docs")
  ? "docs"
  : args.includes("--marketing")
    ? "marketing"
    : "all"

const log = (...a) => console.log("·", ...a)

/** Give Convex subscriptions + entry animations time to settle. */
async function settle(page, ms = 1400) {
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(ms)
}

/** The TanStack devtools bubble must never show up in a shot. */
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

/** Crop shot of one element (dialog, drawer, card) instead of the full page. */
async function elementShot(page, locator, name, dir = DOCS_OUT) {
  await settle(page, 900)
  await hideDevtools(page)
  const path = resolve(dir, `${name}.png`)
  await locator.first().screenshot({ path })
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

/**
 * Point the app at the seeded demo event. Accounts can accumulate other
 * events (test/verification events from other agents' runs), and
 * `useCurrentEvent` defaults to whichever one loaded first — which is not
 * reliably the demo event. Every organizer-side shot depends on this.
 */
async function selectDemoEvent(page) {
  try {
    await page.goto(`${BASE}/app/events`, { waitUntil: "networkidle" })
    await settle(page, 800)
    const card = page.locator('[data-slot="card"]').filter({ hasText: EVENT_NAME }).first()
    const button = card.getByRole("button", { name: /open event|go to dashboard/i })
    await button.click({ timeout: 5000 })
    await page.waitForURL(/\/app$/, { timeout: 5000 }).catch(() => {})
    await settle(page, 500)
    log(`selected demo event: ${EVENT_NAME}`)
  } catch {
    log(`could not select "${EVENT_NAME}" explicitly — continuing with the default event`)
  }
}

/** Retry a navigation once — `net::ERR_ABORTED` from a racing client-side redirect is transient. */
async function gotoSafe(page, url, opts = { waitUntil: "networkidle" }) {
  try {
    await page.goto(url, opts)
  } catch {
    await page.waitForTimeout(800)
    await page.goto(url, opts)
  }
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
  await mkdir(DOCS_OUT, { recursive: true })
  if (MODE !== "docs") {
    await rm(FRAMES, { recursive: true, force: true })
    await mkdir(FRAMES, { recursive: true })
  }

  const browser = await chromium.launch()
  const context = await browser.newContext(CONTEXT_OPTS)
  const page = await context.newPage()

  const consoleErrors = []
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()))

  await signIn(page)
  await selectDemoEvent(page)

  if (MODE === "marketing" || MODE === "all") {
    await captureMarketingShots(page)
  }
  if (MODE === "docs" || MODE === "all") {
    await captureDocsShots(page)
  }

  await browser.close()

  if (MODE !== "docs") await buildGif()

  if (consoleErrors.length) {
    console.log("\nconsole errors seen while capturing:")
    for (const e of consoleErrors.slice(0, 10)) console.log("  !", e.slice(0, 200))
  }
}

/** The seven marketing shots (unchanged behaviour) + the agenda drag GIF frames. */
async function captureMarketingShots(page) {
  // 1 — Organizer dashboard
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
}

/**
 * The docs user-guide shots — one per step of the /docs walkthrough.
 *
 * Every shot is wrapped in `safeShot`: a missing control, a renamed label, or
 * an empty dataset skips that ONE file and logs it — the run always finishes
 * and always produces as many of the 30-odd PNGs as the live UI allows.
 * Read-only navigation + opening dialogs only; every dialog is dismissed with
 * its own Cancel button (never the destructive confirm action).
 */
async function captureDocsShots(page) {
  const written = []
  const skipped = []

  async function safeShot(name, fn) {
    try {
      await fn()
      written.push(name)
    } catch (error) {
      skipped.push(name)
      const message = error instanceof Error ? error.message : String(error)
      log(`skipped: ${name} — ${message.slice(0, 160)}`)
    }
  }

  /** Close whatever dialog/drawer is open via its own Cancel affordance. */
  async function dismiss(page) {
    const cancel = page.getByRole("button", { name: /^cancel$/i }).first()
    if (await tryClick(page, cancel, "dismiss dialog (Cancel)")) return
    await page.keyboard.press("Escape").catch(() => {})
    await page.waitForTimeout(300)
  }

  // ——— Getting started ——————————————————————————————————————————————————

  // gs-signup: the sign-in card. The main `page` is already authenticated
  // (signIn() ran before this function), and /login instantly redirects a
  // signed-in visitor to /app — so this one shot gets its own clean,
  // unauthenticated browser context.
  await safeShot("gs-signup", async () => {
    const browser = page.context().browser()
    if (!browser) throw new Error("no browser handle available")
    const loginContext = await browser.newContext(CONTEXT_OPTS)
    try {
      const loginPage = await loginContext.newPage()
      await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle" })
      await elementShot(loginPage, loginPage.locator('[data-slot="card"]').first(), "gs-signup")
    } finally {
      await loginContext.close()
    }
  })

  // gs-first-event: events list, or the New event dialog if it opens.
  await safeShot("gs-first-event", async () => {
    await page.goto(`${BASE}/app/events`, { waitUntil: "networkidle" })
    await settle(page)
    const opened = await tryClick(
      page,
      page.getByRole("button", { name: /^new event$/i }),
      "New event dialog"
    )
    if (opened) {
      await elementShot(page, page.locator('[data-slot="dialog-content"]'), "gs-first-event")
      await dismiss(page)
    } else {
      await shot(page, "gs-first-event", DOCS_OUT)
    }
  })

  // gs-dashboard: the organizer dashboard.
  await safeShot("gs-dashboard", async () => {
    await page.goto(`${BASE}/app`, { waitUntil: "networkidle" })
    await shot(page, "gs-dashboard", DOCS_OUT)
  })

  // ——— Create your CFP form —————————————————————————————————————————————

  await safeShot("form-list", async () => {
    await page.goto(`${BASE}/app/forms`, { waitUntil: "networkidle" })
    await shot(page, "form-list", DOCS_OUT)
  })

  await safeShot("form-new", async () => {
    await page.goto(`${BASE}/app/forms/new`, { waitUntil: "networkidle" })
    await shot(page, "form-new", DOCS_OUT)
  })

  await safeShot("form-questions", async () => {
    await page.goto(`${BASE}/app/forms`, { waitUntil: "networkidle" })
    const opened = await tryClick(
      page,
      page.getByRole("link", { name: /^edit$/i }),
      "open form editor (questions)"
    )
    if (!opened) throw new Error("no existing form to edit")
    await settle(page)
    await tryClick(page, page.getByText(/submission questions/i), "form step: Submission questions")
    await shot(page, "form-questions", DOCS_OUT)
  })

  await safeShot("form-settings", async () => {
    await page.goto(`${BASE}/app/forms`, { waitUntil: "networkidle" })
    const opened = await tryClick(
      page,
      page.getByRole("link", { name: /^edit$/i }),
      "open form editor (settings)"
    )
    if (!opened) throw new Error("no existing form to edit")
    await settle(page)
    await tryClick(page, page.getByText(/^form settings$/i), "form step: Form settings")
    await shot(page, "form-settings", DOCS_OUT)
  })

  // ——— Share & collect ————————————————————————————————————————————————

  await safeShot("share-link", async () => {
    await page.goto(`${BASE}/app/forms`, { waitUntil: "networkidle" })
    await settle(page)
    const copyButton = page.getByRole("button", { name: /copy public link/i }).first()
    await copyButton.waitFor({ timeout: 5000 })
    const card = copyButton.locator('xpath=ancestor::*[@data-slot="card"][1]')
    await elementShot(page, card, "share-link")
  })

  await safeShot("submit-welcome", async () => {
    await page.goto(`${BASE}/submit/${CFP_FORM_SLUG}`, { waitUntil: "networkidle" })
    await shot(page, "submit-welcome", DOCS_OUT)
  })

  await safeShot("submit-form", async () => {
    await page.goto(`${BASE}/submit/${CFP_FORM_SLUG}`, { waitUntil: "networkidle" })
    await settle(page, 800)
    await tryClick(page, page.getByRole("button", { name: /^continue$/i }), "submit: welcome → account")
    const email = page.locator("#submit-email")
    await email.fill(SPEAKER_EMAIL).catch(() => {})
    await tryClick(page, page.getByRole("button", { name: /^continue$/i }), "submit: account → submission")
    await shot(page, "submit-form", DOCS_OUT)
  })

  await safeShot("submissions-inbox", async () => {
    await gotoSafe(page, `${BASE}/app/submissions`)
    await shot(page, "submissions-inbox", DOCS_OUT)
  })

  // ——— Review & decide ————————————————————————————————————————————————

  await safeShot("review-detail", async () => {
    await gotoSafe(page, `${BASE}/app/submissions`)
    await settle(page)
    const titleLink = page.locator('table a[href*="/app/submissions"]').first()
    await tryClick(page, titleLink, "open submission detail drawer")
    await elementShot(page, page.locator('[data-slot="drawer-shell"]'), "review-detail")
    await dismiss(page)
  })

  await safeShot("review-queue", async () => {
    await page.goto(`${BASE}/app/submissions?status=accept_queue`, {
      waitUntil: "networkidle",
    })
    await shot(page, "review-queue", DOCS_OUT)
  })

  await safeShot("review-commit", async () => {
    await page.goto(`${BASE}/app/submissions?status=accept_queue`, {
      waitUntil: "networkidle",
    })
    await settle(page)
    const sendButton = page.getByRole("button", { name: /^send acceptances$/i }).first()
    const opened = await tryClick(page, sendButton, "open commit-queue confirmation")
    if (!opened) throw new Error("accept queue is empty — nothing to commit")
    await elementShot(page, page.locator('[data-slot="alert-dialog-content"]'), "review-commit")
    // Never confirm — cancel the destructive action.
    await dismiss(page)
  })

  // ——— Speaker portal —————————————————————————————————————————————————

  await safeShot("portal-home", async () => {
    await page.goto(`${BASE}/portal/t/${PORTAL_TOKEN}`, { waitUntil: "networkidle" })
    await settle(page)
    await shot(page, "portal-home", DOCS_OUT)
  })

  await safeShot("portal-submissions", async () => {
    await page.goto(`${BASE}/portal/submissions`, { waitUntil: "networkidle" })
    await shot(page, "portal-submissions", DOCS_OUT)
  })

  await safeShot("portal-profile", async () => {
    await page.goto(`${BASE}/portal/profile`, { waitUntil: "networkidle" })
    await shot(page, "portal-profile", DOCS_OUT)
  })

  await safeShot("portal-tasks", async () => {
    await page.goto(`${BASE}/portal/tasks`, { waitUntil: "networkidle" })
    await shot(page, "portal-tasks", DOCS_OUT)
  })

  // ——— Build the agenda ——————————————————————————————————————————————

  await safeShot("agenda-list", async () => {
    await page.goto(`${BASE}/app/agenda?view=list`, { waitUntil: "networkidle" })
    await settle(page)
    await shot(page, "agenda-list", DOCS_OUT)
  })

  await safeShot("agenda-day", async () => {
    await page.goto(`${BASE}/app/agenda?view=day`, { waitUntil: "networkidle" })
    await settle(page)
    await scrollGridToProgramme(page)
    await shot(page, "agenda-day", DOCS_OUT)
  })

  await safeShot("agenda-conflicts", async () => {
    await page.goto(`${BASE}/app/agenda?view=conflicts`, { waitUntil: "networkidle" })
    await settle(page)
    await shot(page, "agenda-conflicts", DOCS_OUT)
  })

  // ——— Chase speakers ————————————————————————————————————————————————

  await safeShot("speakers-list", async () => {
    await page.goto(`${BASE}/app/speakers`, { waitUntil: "networkidle" })
    await shot(page, "speakers-list", DOCS_OUT)
  })

  await safeShot("speaker-tasks", async () => {
    await page.goto(`${BASE}/app/speakers`, { waitUntil: "networkidle" })
    await settle(page)
    const opened = await tryClick(
      page,
      page.getByRole("button", { name: /^assign task$/i }),
      "open Assign task dialog"
    )
    if (!opened) throw new Error("Assign task control not reachable")
    await elementShot(page, page.locator('[data-slot="dialog-content"]'), "speaker-tasks")
    await dismiss(page)
  })

  await safeShot("communications", async () => {
    await page.goto(`${BASE}/app/communications`, { waitUntil: "networkidle" })
    await shot(page, "communications", DOCS_OUT)
  })

  // ——— Publish ———————————————————————————————————————————————————————

  await safeShot("publish-agenda", async () => {
    await page.goto(`${BASE}/app/agenda`, { waitUntil: "networkidle" })
    await settle(page)
    await elementShot(page, page.locator('[data-slot="page-header"]').first(), "publish-agenda")
  })

  await safeShot("public-schedule", async () => {
    await page.goto(`${BASE}/e/${EVENT_SLUG}`, { waitUntil: "networkidle" })
    await shot(page, "public-schedule", DOCS_OUT)
  })

  await safeShot("embeds", async () => {
    await page.goto(`${BASE}/app/embeds`, { waitUntil: "networkidle" })
    await shot(page, "embeds", DOCS_OUT)
  })

  // ——— Team & workspaces ——————————————————————————————————————————————

  await safeShot("workspace-settings", async () => {
    await page.goto(`${BASE}/app/workspace`, { waitUntil: "networkidle" })
    await shot(page, "workspace-settings", DOCS_OUT)
  })

  await safeShot("workspace-invite", async () => {
    await page.goto(`${BASE}/app/workspace`, { waitUntil: "networkidle" })
    await settle(page)
    const opened = await tryClick(
      page,
      page.getByRole("button", { name: /^invite teammate$/i }),
      "open Invite teammate dialog"
    )
    if (!opened) throw new Error("Invite teammate control not reachable")
    await elementShot(page, page.locator('[data-slot="dialog-content"]'), "workspace-invite")
    await dismiss(page)
  })

  // account-settings: there is no avatar-menu MODAL in this build — "Account
  // settings" in the avatar dropdown navigates to the full /app/account page.
  // That page is the closest real screen, so we shoot it in place of a crop.
  await safeShot("account-settings", async () => {
    await page.goto(`${BASE}/app/account`, { waitUntil: "networkidle" })
    await shot(page, "account-settings", DOCS_OUT)
  })

  // ——— Airtable sync ——————————————————————————————————————————————————

  await safeShot("airtable", async () => {
    await page.goto(`${BASE}/app/settings/integrations`, { waitUntil: "networkidle" })
    await shot(page, "airtable", DOCS_OUT)
  })

  // ——— AI copilot ————————————————————————————————————————————————————

  await safeShot("copilot", async () => {
    await page.goto(`${BASE}/app/copilot`, { waitUntil: "networkidle" })
    await shot(page, "copilot", DOCS_OUT)
  })

  // ——— Summary —————————————————————————————————————————————————————————
  console.log(`\ndocs screenshots — ${written.length} written, ${skipped.length} skipped`)
  console.log("written:", written.length ? written.join(", ") : "(none)")
  console.log("skipped:", skipped.length ? skipped.join(", ") : "(none)")
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

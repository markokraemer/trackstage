/**
 * Captures the real product screenshots used on the marketing landing page,
 * and (separately) the screenshots used in the /docs user guide.
 *
 *   pnpm dev                                   # dev server on :3000
 *   pnpm exec convex run seed:setup            # seeded demo data
 *   node scripts/capture-screenshots.mjs             # marketing + docs shots
 *   node scripts/capture-screenshots.mjs --marketing # public/screenshots/* only
 *   node scripts/capture-screenshots.mjs --docs       # public/docs/* only
 *   node scripts/capture-screenshots.mjs --marketing --gif  # …and rebuild the GIF
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
  : args.includes("--agenda")
    ? "agenda"
    : args.includes("--marketing")
      ? "marketing"
      : "all"

/**
 * `agenda-flow.gif` is OPT-IN (`--gif`).
 *
 * The shipped GIF is cut from `video/public/clips/agenda.mp4` — a real 9.5s
 * drag with the conflict pre-warning in it, which reads far better than the
 * four-to-six stills this script can stitch. Rebuilding it here by default
 * would silently clobber the better one on every routine refresh. It also
 * MUTATES the demo agenda (it really drops a session in a new slot), so it has
 * no business running while an e2e gate is driving the same database.
 */
const WANT_GIF = args.includes("--gif")

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
/**
 * `{ workspaceSlug, eventSlug }` for the demo event, learned from the URL the
 * app lands on when we open it. Every organizer shot is then addressed
 * canonically (`/app/:ws/:event/…`, docs/memory/DECISIONS.md "URL
 * architecture is fully hierarchical") instead of through a bare legacy path,
 * which only resolves via the stored pointer and repaints a skeleton first.
 */
let demoRef = null

async function selectDemoEvent(page) {
  try {
    await page.goto(`${BASE}/app/events`, { waitUntil: "networkidle" })
    await settle(page, 800)
    const card = page.locator('[data-slot="card"]').filter({ hasText: EVENT_NAME }).first()
    const button = card.getByRole("button", { name: /open event|go to dashboard/i })
    await button.click({ timeout: 5000 })
    await page.waitForURL(/\/app\/[^/]+\/[^/]+/, { timeout: 8000 }).catch(() => {})
    await settle(page, 500)
    const match = new URL(page.url()).pathname.match(/^\/app\/([^/]+)\/([^/]+)/)
    if (match && match[2] !== "workspace") {
      demoRef = { workspaceSlug: match[1], eventSlug: match[2] }
    }
    log(
      `selected demo event: ${EVENT_NAME}${demoRef ? ` (/app/${demoRef.workspaceSlug}/${demoRef.eventSlug})` : ""}`
    )
  } catch {
    log(`could not select "${EVENT_NAME}" explicitly — continuing with the default event`)
  }
}

/** Event-scoped sections, as the bare legacy paths still name them. */
const EVENT_SECTIONS = [
  "submissions",
  "forms",
  "evaluation",
  "agenda",
  "speakers",
  "files",
  "communications",
  "embeds",
  "settings",
]

/** A bare `/app/…` path rewritten onto the demo event, when we know it. */
function canonical(path) {
  if (!demoRef) return path
  const base = `/app/${demoRef.workspaceSlug}/${demoRef.eventSlug}`
  if (path === "/app") return base
  // `/app/workspace` is workspace-level, not event-level.
  if (path === "/app/workspace") return `/app/${demoRef.workspaceSlug}/workspace`
  const rest = path.replace(/^\/app\//, "")
  const section = rest.split(/[/?]/)[0]
  return EVENT_SECTIONS.includes(section) ? `${base}/${rest}` : path
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

/**
 * Navigate to an `/app/*` organizer route, self-healing the event context
 * first. This is a shared dev database — another agent's seed re-run or
 * verification pass can drop/replace events mid-capture, which clears the
 * stored `sb.currentEventId` and silently falls the app back to whatever
 * event loaded first (docs/lib/current-event.ts). Checking the sidebar after
 * every navigation and re-selecting when it drifts keeps every organizer shot
 * pointed at the real demo event instead of an empty leftover one.
 */
async function gotoOrganizer(page, path) {
  await gotoSafe(page, `${BASE}${canonical(path)}`)
  await settle(page, 500)
  const onDemoEvent = await page
    .locator("aside")
    .getByText(EVENT_NAME)
    .count()
    .catch(() => 0)
  if (onDemoEvent === 0) {
    await selectDemoEvent(page)
    await gotoSafe(page, `${BASE}${canonical(path)}`)
    await settle(page, 500)
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
  if (MODE !== "docs" && WANT_GIF) {
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
  // `--agenda` refreshes only the agenda stills + the drag GIF. Useful while
  // other screens are mid-change: it never overwrites their shots.
  if (MODE === "agenda") {
    await captureAgendaShots(page)
  }
  if (MODE === "docs" || MODE === "all") {
    await captureDocsShots(page)
  }

  await browser.close()

  if (MODE !== "docs" && WANT_GIF) await buildGif()

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

  // 2 — Submissions table, sorted by score descending.
  //
  // Not decoration: the default order is newest-first, and on a shared dev
  // database that is a wall of un-cleaned e2e fixtures ("Copilot Guard cg-…",
  // "Outbox Proof t-…"). Every seeded submission carries a score and no fixture
  // does, so sorting by score floats the real programme to the top and the shot
  // stays clean even mid-gate. It also puts the Score column to work, which is
  // the point of the screen.
  await page.goto(`${BASE}/app/submissions`, { waitUntil: "networkidle" })
  await settle(page)
  await tryClick(page, page.locator("thead").getByText(/^score$/i), "sort by Score")
  await shot(page, "submissions")

  // 3 — Agenda: day grid scrolled onto the programme. (The List view is NOT
  // shot: its Room cell renders the raw room id — see capture-screenshots.md.)
  await page.goto(`${BASE}/app/agenda`, { waitUntil: "networkidle" })
  await settle(page)
  await tryClick(page, page.getByText(/^day$/i), "agenda Day view")
  await settle(page)
  await scrollGridToProgramme(page)
  await shot(page, "agenda")

  // 3b — Agenda drag frames for the flow GIF (opt-in, see WANT_GIF)
  if (WANT_GIF) await captureAgendaFlow(page)

  // 4 — Form builder, question step
  // Forms now live under /app/{workspace}/{event}/forms/{id}, so match the
  // segment rather than a fixed prefix.
  await page.goto(`${BASE}/app/forms`, { waitUntil: "networkidle" })
  await settle(page)
  await tryClick(page, page.getByRole("link", { name: /^edit$/i }), "open form (Edit)")
  if (!page.url().match(/\/forms\/[^/]+$/)) {
    await tryClick(page, page.locator("a[href*='/forms/']"), "open form (href)")
  }
  await settle(page)
  await tryClick(page, page.getByText(/submission questions/i), "form step: Submission questions")
  await shot(page, "form-builder")

  // 5 — Speaker portal (token link signs the speaker in)
  await page.goto(`${BASE}/portal/t/${PORTAL_TOKEN}`, { waitUntil: "networkidle" })
  await settle(page)
  await shot(page, "portal")

  // 6 — Public schedule
  // Canonical `/e/:workspaceSlug/:eventSlug`; the one-segment legacy address
  // resolves oldest-claimant-first, which on a shared database is a gamble.
  await page.goto(
    demoRef
      ? `${BASE}/e/${demoRef.workspaceSlug}/${demoRef.eventSlug}`
      : `${BASE}/e/${EVENT_SLUG}`,
    { waitUntil: "networkidle" }
  )
  await shot(page, "public-schedule")
}

/**
 * The AT-SCALE docs shots.
 *
 * The /docs user guide is narrated by `scripts/capture-walkthrough.mjs`, which
 * builds a brand-new account and shoots one organizer's whole journey — that is
 * what a new reader needs to see, empty states included. What a fresh account
 * CANNOT show is a screen with a few hundred rows on it: a full dashboard, a
 * deep submissions table, a conflicting agenda, a filled-in profile. Those come
 * from the seeded demo event, and that is all this function still captures.
 *
 * Every shot is wrapped in `safeShot`: a missing control, a renamed label, or
 * an empty dataset skips that ONE file and logs it — the run always finishes.
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

  // gs-dashboard: the organizer dashboard.
  await safeShot("gs-dashboard", async () => {
    await gotoOrganizer(page, "/app")
    await shot(page, "gs-dashboard", DOCS_OUT)
  })

  // ——— Create your CFP form —————————————————————————————————————————————





  // ——— Share & collect ————————————————————————————————————————————————




  /*
   * submissions-inbox — both tab strips with their real counts, over rows a
   * reader can actually learn from.
   *
   * The table is ordered newest-first, and on this shared dev deployment the
   * newest rows are whatever fixtures another agent's verification run just
   * wrote ("Auto B au-msox3gng", "Dragged dg-…", "E2E Proposal t-…"). Scoping
   * to Accepted AND one track excludes all of them — fixtures are transient
   * and land untracked or unaccepted — and leaves the seeded programme, which
   * is what the guide is pointing at. Both tab strips keep their real,
   * unfiltered counts either way.
   */
  await safeShot("submissions-inbox", async () => {
    await gotoOrganizer(page, "/app/submissions?status=accepted")
    await settle(page, 600)
    const opened = await tryClick(
      page,
      page.locator('[aria-label="Filter by track"]'),
      "open the track filter"
    )
    if (!opened) throw new Error("track filter not reachable")
    await tryClick(
      page,
      page.getByRole("option", { name: /^ai engineering$/i }),
      "filter to the AI Engineering track"
    )
    await settle(page, 600)
    await shot(page, "submissions-inbox", DOCS_OUT)
  })

  // ——— Review & decide ————————————————————————————————————————————————




  // ——— Speaker portal —————————————————————————————————————————————————


  // The portal's whole auth model is the magic-link token, and `--docs` does
  // not run the marketing pass that used to open it — without this the two
  // portal shots were the signed-out "Check your email for your portal link"
  // card twice over.
  await safeShot("portal-submissions", async () => {
    await page.goto(`${BASE}/portal/t/${PORTAL_TOKEN}`, { waitUntil: "networkidle" })
    await settle(page, 900)
    await page.goto(`${BASE}/portal/submissions`, { waitUntil: "networkidle" })
    await shot(page, "portal-submissions", DOCS_OUT)
  })

  await safeShot("portal-profile", async () => {
    await page.goto(`${BASE}/portal/profile`, { waitUntil: "networkidle" })
    await shot(page, "portal-profile", DOCS_OUT)
  })


  // ——— Build the agenda ——————————————————————————————————————————————



  await safeShot("agenda-conflicts", async () => {
    await gotoOrganizer(page, "/app/agenda?view=conflicts")
    await settle(page)
    await shot(page, "agenda-conflicts", DOCS_OUT)
  })

  // ——— Chase speakers ————————————————————————————————————————————————



  await safeShot("communications", async () => {
    await gotoOrganizer(page, "/app/communications")
    await shot(page, "communications", DOCS_OUT)
  })

  // ——— Publish ———————————————————————————————————————————————————————



  await safeShot("embeds", async () => {
    await gotoOrganizer(page, "/app/embeds")
    await shot(page, "embeds", DOCS_OUT)
  })

  // ——— Team & workspaces ——————————————————————————————————————————————

  await safeShot("workspace-settings", async () => {
    await gotoOrganizer(page, "/app/workspace")
    await shot(page, "workspace-settings", DOCS_OUT)
  })

  await safeShot("workspace-invite", async () => {
    await gotoOrganizer(page, "/app/workspace")
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
    await gotoOrganizer(page, "/app/account")
    await shot(page, "account-settings", DOCS_OUT)
  })

  // ——— Airtable sync ——————————————————————————————————————————————————

  await safeShot("airtable", async () => {
    await gotoOrganizer(page, "/app/settings/integrations")
    await shot(page, "airtable", DOCS_OUT)
  })

  // ——— AI copilot ————————————————————————————————————————————————————

  await safeShot("copilot", async () => {
    await gotoOrganizer(page, "/app/copilot")
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

/** Agenda-only refresh: the two stills plus the drag GIF frames. */
async function captureAgendaShots(page) {
  await page.goto(`${BASE}/app/agenda`, { waitUntil: "networkidle" })
  await settle(page)
  await tryClick(page, page.getByText(/^day$/i), "agenda Day view")
  await settle(page)
  await scrollGridToProgramme(page)
  await shot(page, "agenda")
  if (WANT_GIF) await captureAgendaFlow(page)
}

/**
 * Six frames of a real agenda drag, showing the whole interaction language:
 * idle → picked up (ghost + time chip) → moved (chip follows, new slot) →
 * hovering a clash (ghost and chip go red, and name the session it would
 * double-book) → back to a free slot → dropped and settled.
 *
 * dnd-kit needs a mousedown plus several small moves before it activates, and
 * each frame waits for the preview to catch up so the GIF shows the ghost and
 * the chip rather than a blur between them.
 */
async function captureAgendaFlow(page) {
  await hideDevtools(page)
  const card = page.locator('[data-slot="agenda-grid-block"] button, .cursor-grab').first()
  try {
    const box = await card.boundingBox({ timeout: 3000 })
    if (!box) throw new Error("no draggable")
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await page.screenshot({ path: resolve(FRAMES, "f1.png") })
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (const dy of [6, 18, 34]) await page.mouse.move(x, y + dy, { steps: 3 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: resolve(FRAMES, "f2.png") })

    // Sideways into the neighbouring column — the chip renames the room.
    const columns = await page.locator("[data-room]").all()
    const neighbour = columns.length > 1 ? await columns[1].boundingBox() : null
    const nx = neighbour ? neighbour.x + neighbour.width / 2 : x + 10
    for (const dy of [60, 96, 130]) await page.mouse.move(nx, y + dy, { steps: 4 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: resolve(FRAMES, "f3.png") })

    // Over an occupied slot: the pre-warning turns everything red.
    const occupied = page
      .locator(`[data-room] [data-slot="agenda-grid-block"]`)
      .filter({ hasNot: page.locator("nothing") })
    const clash = await occupied.last().boundingBox().catch(() => null)
    if (clash) {
      await page.mouse.move(clash.x + clash.width / 2, clash.y + 12, { steps: 8 })
      await page.waitForTimeout(400)
      await page.screenshot({ path: resolve(FRAMES, "f4.png") })
    }

    // Back to open space, then let go — the card springs into the slot.
    await page.mouse.move(nx, y + 150, { steps: 8 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: resolve(FRAMES, clash ? "f5.png" : "f4.png") })
    await page.mouse.up()
    await page.waitForTimeout(900)
    await page.screenshot({ path: resolve(FRAMES, clash ? "f6.png" : "f5.png") })
    log(`captured ${clash ? 6 : 5} agenda drag frames`)
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

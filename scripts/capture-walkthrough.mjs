/**
 * ONE fresh account, ONE story, in order.
 *
 * `capture-screenshots.mjs --docs` shoots the *seeded* demo event: a database
 * that is already full of submissions, speakers and a finished agenda. That is
 * the wrong picture for a user guide — a new organizer never sees any of it,
 * and the empty states (the most instructive screens they will meet) never
 * appear at all.
 *
 * This script instead provisions a BRAND-NEW account on every run and drives
 * the whole journey through the real UI, shooting it as it goes:
 *
 *   sign up → the onboarding wizard (workspace → event → when & where) →
 *   the welcome moment → event settings → rooms & tracks → empty dashboard →
 *   build the CFP form → copy the public link → submit one talk as a speaker
 *   → it lands in the inbox → open it → stage it to the Accept Queue →
 *   commit the queue → speaker portal → assign a task → schedule the talk on
 *   the agenda → publish → public page live.
 *
 * The first five shots are the 2026-08-12 onboarding: a signed-up organizer
 * with zero events never sees `/app/events` at all — the full-screen
 * takeover (src/components/onboarding/onboarding-takeover.tsx) owns the
 * screen until the event exists, then drops them on that event's settings
 * page with confetti and one welcome card. `@example.com` addresses are born
 * verified (the databaseHook in convex/auth.ts), so this run never meets the
 * `/confirm-email` wall.
 *
 * Usage:
 *
 *   pnpm dev                                # dev server on :3000
 *   node scripts/capture-walkthrough.mjs    # writes public/docs/walkthrough/*.png
 *
 * The account is additive (shared dev database) and disposable: a new email
 * every run, so re-running never collides with itself. Everything is driven
 * through ordinary clicks, so a shot can never drift from the shipped UI.
 *
 * URL architecture (docs/memory/DECISIONS.md, "URL architecture is fully
 * hierarchical"): every organizer screen lives at
 * `/app/:workspaceSlug/:eventSlug/…` and every public page at
 * `/e/:workspaceSlug/:eventSlug`. A fresh account's workspace slug is minted
 * server-side from the organizer's name, so the run READS both segments off
 * the URL the onboarding wizard lands on and addresses everything
 * canonically from there — the bare legacy paths (`/app/agenda`) only ever
 * redirect through a stored pointer, which is a race we don't need in a
 * screenshot run, and the legacy `/e/:slug` resolves oldest-claimant-first,
 * which on a shared database is somebody else's event entirely.
 */
import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = resolve(root, "public/docs/walkthrough")

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const VIEWPORT = { width: 1440, height: 900 }
const CONTEXT_OPTS = {
  viewport: VIEWPORT,
  deviceScaleFactor: 2, // retina — the docs render these at half size
  colorScheme: "light",
  reducedMotion: "reduce",
  timezoneId: "Europe/Berlin", // the event is in Berlin; the app reads the browser zone
  locale: "en-US", // react-day-picker keys its day cells off the locale
  permissions: ["clipboard-read", "clipboard-write"],
}

// ——— The story ———————————————————————————————————————————————————————————
// One organizer, one conference, one speaker. Realistic, and deliberately not
// the seeded "AI Engineer Summit" demo data.

const RUN = Date.now().toString(36)
const ORGANIZER = {
  name: "Nora Feldmann",
  email: `nora.feldmann.${RUN}@example.com`,
  password: "Devcon2026!walkthrough",
}
const WORKSPACE = "Devcon Events"
// The workspace's web address — the first segment of every canonical URL.
// Claimed once and auto-suffixed by the server on a re-run ("devcon-2"),
// which still photographs far better than the minted "<name>-s-workspace".
const WORKSPACE_SLUG = "devcon"
const EVENT = {
  name: "Devcon Berlin 2026",
  // The slug is derived from the name by the wizard and confirmed by the
  // server (unique per workspace, and every run gets a fresh workspace).
  type: "Conference",
  description:
    "Two days of talks on platform engineering and developer experience, in the middle of Berlin.",
  venue: "Kulturbrauerei, Prenzlauer Berg",
  // Two days, far enough out that the CFP story makes sense.
  starts: { month: 10, day: 13, year: 2026 },
  ends: { month: 10, day: 14, year: 2026 },
}
const ROOMS = [
  { name: "Aula", seats: "420" },
  { name: "Workshop", seats: "80" },
]
const TRACKS = ["Platform Engineering", "Developer Experience"]
const FORM_NAME = "Devcon Berlin Call for Speakers"
const TALK = {
  title: "Shipping a design system without freezing the roadmap",
  abstract:
    "We rebuilt our component library while twelve product teams kept shipping. This talk covers the migration ladder we used, the three rules that kept adoption voluntary but inevitable, and the two things we would never do again.",
  firstName: "Bilal",
  lastName: "Osman",
  email: `bilal.osman.${RUN}@example.com`,
  company: "Northwind",
  jobTitle: "Staff Engineer",
}
const TASK = {
  title: "Send your talk photo and a one-line bio",
  // A due date is what makes the task sort to the top of the speaker's list
  // (convex/portal.ts orders by `dueAt`, and the three onboarding tasks
  // acceptance creates have none), so shot 29 shows the task the organizer
  // just assigned rather than only the automatic ones.
  due: { month: 9, day: 15, year: 2026 },
}

const log = (...a) => console.log("·", ...a)
const written = []
const skipped = []

const args = process.argv.slice(2)
const resumeAt = args.indexOf("--resume")
const RESUME =
  resumeAt === -1
    ? null
    : {
        email: args[resumeAt + 1],
        ref: {
          workspaceSlug: args[resumeAt + 2],
          eventSlug: args[resumeAt + 3],
        },
      }

// ——— Plumbing ————————————————————————————————————————————————————————————

async function settle(page, ms = 1100) {
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(ms)
}

/** The TanStack devtools bubble must never show up in a shot. */
async function hideChrome(page) {
  await page
    .addStyleTag({
      content: `[data-testid="tanstack_devtools"],[data-tsd-source] > .tsd-toolbar{display:none !important}
                [data-sonner-toaster]{display:none !important}`,
    })
    .catch(() => {})
}

async function shot(page, name) {
  await settle(page)
  await hideChrome(page)
  await page.screenshot({ path: resolve(OUT, `${name}.png`) })
  written.push(name)
  log(`shot ${name}`)
}

/** Crop to one region — a dialog, a drawer, a card — when it beats a full page. */
async function cropShot(page, locator, name) {
  await settle(page, 700)
  await hideChrome(page)
  await locator.first().screenshot({ path: resolve(OUT, `${name}.png`) })
  written.push(name)
  log(`shot ${name} (cropped)`)
}

/** Rewind every scroller inside a dialog, so a crop starts at its first field. */
async function scrollDialogToTop(page, dialog) {
  await dialog
    .first()
    .evaluate((node) => {
      for (const child of node.querySelectorAll("*")) {
        if (child.scrollHeight > child.clientHeight) child.scrollTop = 0
      }
      node.scrollTop = 0
    })
    .catch(() => {})
  await page.waitForTimeout(200)
}

/** A shot that must never abort the run: one missing PNG beats zero PNGs. */
async function safeShot(name, fn) {
  try {
    await fn()
  } catch (error) {
    skipped.push(name)
    const message = error instanceof Error ? error.message : String(error)
    log(`SKIPPED ${name} — ${message.split("\n")[0].slice(0, 180)}`)
  }
}

/**
 * Navigate with retries. The dev server is shared with other agents whose
 * edits trigger a Vite rebuild, and a request that lands mid-rebuild hangs or
 * answers 500 — one unlucky moment must not cost the tail of the story.
 */
async function go(page, url) {
  let last
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 })
      return
    } catch (error) {
      last = error
      await page.waitForTimeout(2000)
    }
  }
  throw last
}

/** Fill a controlled input, retrying until React actually keeps the value. */
async function fillSticky(page, selector, value) {
  const field = typeof selector === "string" ? page.locator(selector) : selector
  await field.first().waitFor({ state: "visible", timeout: 45000 })
  for (let attempt = 0; attempt < 5; attempt++) {
    await field.first().fill(value)
    await page.waitForTimeout(150)
    if ((await field.first().inputValue()) === value) return
  }
  throw new Error(`could not fill ${String(selector)}`)
}

/** Base UI selects are popovers, not native `<select>` elements. */
async function pickOption(page, triggerSelector, optionLabel) {
  const trigger =
    typeof triggerSelector === "string" ? page.locator(triggerSelector) : triggerSelector
  await trigger.first().click()
  await page.waitForTimeout(250)
  await page
    .getByRole("option", { name: optionLabel })
    .first()
    .click({ timeout: 5000 })
  await page.waitForTimeout(250)
}

/**
 * Pick a calendar day in a `DateTimePicker`. The popover opens on the current
 * month, so page forward until the wanted day cell exists — react-day-picker
 * tags every day button with `data-day="M/D/YYYY"`.
 */
async function pickDate(page, triggerId, date) {
  await page.locator(`#${triggerId}`).click()
  await page.waitForTimeout(300)
  await pickCalendarDay(page, date)
  await page.keyboard.press("Escape").catch(() => {})
  await page.waitForTimeout(200)
}

/**
 * Click a day in an ALREADY-OPEN calendar, paging forward until the month is
 * on screen. Split out from `pickDate` because a calendar inside a dialog must
 * not be dismissed with Escape — that closes the dialog with it.
 */
async function pickCalendarDay(page, { month, day, year }) {
  const cell = page.locator(`[data-day="${month}/${day}/${year}"]`)
  for (let hop = 0; hop < 24; hop++) {
    if (await cell.count()) break
    const next = page
      .locator(".rdp-button_next, button[name='next-month'], [aria-label*='next month' i]")
      .first()
    await next.click({ timeout: 4000 })
    await page.waitForTimeout(180)
  }
  await cell.first().click({ timeout: 5000 })
  await page.waitForTimeout(300)
}

/**
 * The canonical address of a section of the event this run created —
 * `/app/:workspaceSlug/:eventSlug{suffix}`. Both segments come off the URL the
 * app itself navigated to after the create, so they are the app's own truth.
 */
function appUrl(state, suffix = "") {
  const { workspaceSlug, eventSlug } = state.ref
  return `${BASE}/app/${workspaceSlug}/${eventSlug}${suffix}`
}

/** `/app/:ws/:event/…` → `{ workspaceSlug, eventSlug }`, or null. */
function refFromUrl(url) {
  const match = new URL(url).pathname.match(/^\/app\/([^/]+)\/([^/]+)(?:\/|$)/)
  return match ? { workspaceSlug: match[1], eventSlug: match[2] } : null
}

async function click(page, locator, label, timeout = 8000) {
  await locator.first().click({ timeout })
  await page.waitForTimeout(500)
  log(label)
}

/** Best-effort click — used only where the story survives the control missing. */
async function tryClick(page, locator, label) {
  try {
    await locator.first().click({ timeout: 4000 })
    await page.waitForTimeout(500)
    return true
  } catch {
    log(`skipped click: ${label}`)
    return false
  }
}

// ——— The walkthrough —————————————————————————————————————————————————————

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext(CONTEXT_OPTS)
  const page = await context.newPage()

  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })

  const state = { ref: null, formPath: null, portalUrl: null }

  if (RESUME) {
    // `--resume <email> <workspace-slug> <event-slug>` re-shoots only the
    // agenda/publish tail on an account a previous run already built, so one
    // flaky navigation at the end never costs a whole 6-minute run.
    // Shots 30 and 31 show the agenda BEFORE anything is scheduled, so they
    // can only ever come from the original run — resume picks up after them.
    state.ref = RESUME.ref
    await signIn(page, RESUME.email)
    await scheduleAndPublish(page, state, { from: 32 })
  } else {
    await signUp(page)
    await onboardingWizard(page, state)
    await workspaceAddress(page, state)
    await eventSettings(page, state)
    await roomsAndTracks(page, state)
    await emptyDashboard(page, state)
    await buildForm(page, state)
    await submitATalk(context, state)
    await reviewAndAccept(page, state)
    await speakerFollowUp(page, state)
    await scheduleAndPublish(page, state)
  }

  await browser.close()

  console.log(`\nwalkthrough — ${written.length} written, ${skipped.length} skipped`)
  console.log("written:", written.join(", "))
  if (skipped.length) console.log("SKIPPED:", skipped.join(", "))
  if (consoleErrors.length) {
    console.log(`\nconsole errors seen (${consoleErrors.length}):`)
    for (const e of [...new Set(consoleErrors)].slice(0, 10)) console.log("  !", e.slice(0, 200))
  } else {
    console.log("\nno console errors seen during the run")
  }
  console.log(
    `\naccount: ${ORGANIZER.email} / event: ${
      state.ref ? `${state.ref.workspaceSlug}/${state.ref.eventSlug}` : "(none)"
    }`
  )
  if (state.portalUrl) console.log(`speaker portal: ${state.portalUrl}`)
}

/** `--resume` only: sign back in to an account a previous run created. */
async function signIn(page, email) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await go(page, `${BASE}/login`)
    await settle(page, 800)
    await fillSticky(page, "#email", email)
    await fillSticky(page, "#password", ORGANIZER.password)
    await page.getByRole("button", { name: /^sign in$/i }).first().click()
    try {
      await page.waitForURL(/\/app/, { timeout: 15000 })
      await settle(page, 1500)
      log(`signed back in as ${email}`)
      return
    } catch {
      log("sign-in did not land on /app — retrying")
    }
  }
  throw new Error(`could not sign in as ${email}`)
}

/** 01 — a brand-new account. */
async function signUp(page) {
  await go(page, `${BASE}/login`)
  await settle(page, 800)
  await click(page, page.getByRole("tab", { name: /create account/i }), "opened the Create account tab")

  await fillSticky(page, "#name", ORGANIZER.name)
  await fillSticky(page, "#email", ORGANIZER.email)
  await fillSticky(page, "#password", ORGANIZER.password)

  await safeShot("01-sign-up", () =>
    cropShot(page, page.locator('[data-slot="card"]').first(), "01-sign-up")
  )

  await click(
    page,
    page.getByRole("button", { name: /^create account$/i }),
    "submitted the sign-up form"
  )
  await page.waitForURL(/\/app/, { timeout: 25000 })
  // The onboarding takeover owns every `/app` address until an event exists,
  // so the first thing a new organizer ever sees is its first card — never a
  // flash of the shell. Wait for it rather than for a settle.
  await page
    .locator("#onboarding-workspace-name")
    .waitFor({ state: "visible", timeout: 45000 })
  log(`signed up as ${ORGANIZER.email}`)
}

/**
 * 02–05 — the onboarding wizard, then the welcome moment.
 *
 * Three cards (workspace → your event → when & where) and one "Create event",
 * which is where the event is actually written; the wizard then navigates
 * into the app at that event's settings page and arms the confetti welcome.
 *
 * Event slugs are unique PER WORKSPACE (convex/lib/publicLinks.ts) and every
 * run signs up a brand-new organizer with a brand-new workspace, so
 * "devcon-berlin-2026" is always free. The server still hands back whatever
 * it stored — we read it (with the workspace segment) off the URL the app
 * navigates to.
 */
async function onboardingWizard(page, state) {
  // Progress dots + card, cropped together: the dots are what say "three
  // screens, you are on the first", and they live outside the card.
  const card = page.locator("main > div").first()

  await fillSticky(page, "#onboarding-workspace-name", WORKSPACE)
  await safeShot("02-name-your-workspace", () =>
    cropShot(page, card, "02-name-your-workspace")
  )
  await click(
    page,
    page.getByRole("button", { name: /^continue$/i }),
    "wizard: named the workspace"
  )

  await fillSticky(page, "#onboarding-event-name", EVENT.name)
  await pickOption(page, "#onboarding-event-type", EVENT.type).catch(() =>
    log("skipped the event type")
  )
  await fillSticky(page, "#onboarding-event-description", EVENT.description).catch(
    () => log("skipped the description")
  )
  await safeShot("03-your-event", () => cropShot(page, card, "03-your-event"))
  await click(
    page,
    page.getByRole("button", { name: /^continue$/i }),
    "wizard: named the event"
  )

  await pickDate(page, "onboarding-starts", EVENT.starts).catch(() =>
    log("skipped the start date")
  )
  await pickDate(page, "onboarding-ends", EVENT.ends).catch(() =>
    log("skipped the end date")
  )
  await fillSticky(page, "#onboarding-venue", EVENT.venue).catch(() =>
    log("skipped the venue")
  )
  await safeShot("04-when-and-where", () => cropShot(page, card, "04-when-and-where"))

  await click(
    page,
    page.getByRole("button", { name: /^create event$/i }),
    "wizard: created the event"
  )
  await page.waitForURL(/\/app\/[^/]+\/[^/]+\/settings/, { timeout: 45000 })
  await settle(page, 1200)

  state.ref = refFromUrl(page.url())
  if (!state.ref) throw new Error(`could not read the event ref from ${page.url()}`)
  log(`created "${EVENT.name}" at /app/${state.ref.workspaceSlug}/${state.ref.eventSlug}`)

  // 05 — the welcome card, confetti still in the air, over the event's own
  // settings page. Shot full-page: the point is where it lands you.
  await safeShot("05-welcome", () => shot(page, "05-welcome"))
  await tryClick(
    page,
    page.getByRole("button", { name: /let's go/i }),
    "dismissed the welcome card"
  )
  await settle(page, 800)
}

/**
 * No shot — housekeeping that has to happen BEFORE anything photographs a URL.
 *
 * The workspace slug is minted at sign-up from the person's own name
 * (`convex/workspaces.ts::ensure` → "<name>'s workspace"), and the onboarding
 * wizard's "name your workspace" step patches the NAME only — it never
 * re-slugs. So a fresh account's canonical addresses read
 * `/e/nora-feldmann-s-workspace/devcon-berlin-2026` until somebody sets the
 * address by hand in Workspace settings → General, which is exactly what this
 * does. Every later shot then shows the address a real organizer would have
 * chosen rather than a leftover of their own name.
 */
async function workspaceAddress(page, state) {
  await go(page, `${BASE}/app/${state.ref.workspaceSlug}/workspace`)
  await settle(page)
  try {
    await fillSticky(page, "#workspace-slug", WORKSPACE_SLUG)
    await click(page, page.getByRole("button", { name: /^save$/i }), "set the web address")
    // The card follows the address it just changed; read what the server
    // actually stored (it auto-suffixes on a clash) off the new URL.
    await page.waitForURL(/\/app\/[^/]+\/workspace/, { timeout: 15000 })
    await settle(page, 900)
    const slug = new URL(page.url()).pathname.split("/")[2]
    if (slug && slug !== state.ref.workspaceSlug) {
      state.ref = { ...state.ref, workspaceSlug: slug }
      log(`workspace address is now /${slug}`)
    }
  } catch (error) {
    log(`kept the minted workspace address — ${String(error).split("\n")[0].slice(0, 120)}`)
  }
}

/** 06 — the event's settings, already carrying everything the wizard asked. */
async function eventSettings(page, state) {
  await go(page, appUrl(state, "/settings"))
  await settle(page)
  await safeShot("06-event-settings", () => shot(page, "06-event-settings"))
}

/** 07 — the rooms and tracks every later screen depends on. */
async function roomsAndTracks(page, state) {
  await go(page, appUrl(state, "/settings/rooms-and-tracks"))
  await settle(page)

  for (const room of ROOMS) {
    await fillSticky(page, "#new-room-name", room.name)
    await fillSticky(page, "#new-room-capacity", room.seats)
    await click(page, page.getByRole("button", { name: /^add room$/i }), `added room ${room.name}`)
    await settle(page, 600)
  }

  for (const track of TRACKS) {
    await fillSticky(page, "#new-track-name", track)
    await click(page, page.getByRole("button", { name: /^add track$/i }), `added track ${track}`)
    await settle(page, 600)
  }

  await safeShot("07-rooms-and-tracks", () => shot(page, "07-rooms-and-tracks"))
}

/** 08 — the dashboard on day one, with the getting-started list beside it. */
async function emptyDashboard(page, state) {
  await go(page, appUrl(state))
  await safeShot("08-empty-dashboard", () => shot(page, "08-empty-dashboard"))
}

/** 09–14 — the CFP form, step by step, and the public link. */
async function buildForm(page, state) {
  await go(page, appUrl(state, "/forms"))
  await safeShot("09-no-forms-yet", () => shot(page, "09-no-forms-yet"))

  // "New form" is a DIALOG now, addressable as `?new=1` — the same pattern as
  // every other create surface. The empty state's own CTA opens it too.
  await click(
    page,
    page.getByRole("link", { name: /create your first form|^new form$/i }),
    "opened the New form dialog"
  )
  const newForm = page.locator('[data-slot="dialog-content"]')
  await newForm.waitFor({ timeout: 10000 })
  await fillSticky(page, newForm.getByLabel(/form name/i), FORM_NAME)
  await settle(page, 400)
  await safeShot("10-new-form", () => cropShot(page, newForm, "10-new-form"))

  await click(
    page,
    newForm.getByRole("button", { name: /^create form$/i }),
    "created the form"
  )
  // `/app/:ws/:event/forms/:formId` — anything but the `new` page it left.
  await page.waitForURL(
    (url) => /\/forms\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
    { timeout: 15000 }
  )
  await settle(page, 1200)

  // Rail buttons are named "<title> <one-line description>", so anchor at the
  // start of the accessible name rather than matching it whole.
  const step = (name) => page.getByRole("button", { name }).first()

  await safeShot("11-form-questions", async () => {
    await click(page, step(/^submission questions/i), "form step: Submission questions")
    await shot(page, "11-form-questions")
  })

  await safeShot("12-form-participants", async () => {
    await click(page, step(/^participants/i), "form step: Participants")
    await shot(page, "12-form-participants")
  })

  await safeShot("13-form-settings", async () => {
    await click(page, step(/^form settings/i), "form step: Form settings")
    await shot(page, "13-form-settings")
  })

  // The header's "View form" link is the authoritative public URL.
  const href = await page
    .locator("a[href^='/submit/']")
    .first()
    .getAttribute("href")
    .catch(() => null)
  // `/submit/:workspaceSlug/:eventSlug/:formSlug` — all three, kept whole.
  state.formPath = href
  if (!state.formPath) throw new Error("could not read the public form link")
  log(`public form: ${state.formPath}`)

  await go(page, appUrl(state, "/forms"))
  await settle(page)
  await safeShot("14-share-the-link", async () => {
    const copy = page.getByRole("button", { name: /copy (public )?link/i }).first()
    await copy.waitFor({ timeout: 6000 })
    const card = copy.locator('xpath=ancestor::*[@data-slot="card"][1]')
    await cropShot(page, card, "14-share-the-link")
  })
}

// ——— The public form is a state machine, not a straight line ————————————
//
// The wizard is server-rendered: a Continue click that lands before React has
// hydrated submits natively, the browser reloads, and the wizard silently
// resets to Welcome. `tests/e2e/flows/cfp-submit.spec.ts` documents this and
// solves it the only way that isn't a coin flip — look at which step is on
// screen, do the next right thing, repeat. This does the same, and shoots each
// step the first time it sees it.

const SUBMIT_STEPS = [
  ["success", /thank you for submitting/i],
  ["review", /review and submit/i],
  ["participants", /^participants$/i],
  ["talk", /your submission/i],
  ["account", /your email address/i],
] // anything else ⇒ "welcome"

const SUBMIT_ORDER = ["welcome", "account", "talk", "participants", "review", "success"]

async function currentSubmitStep(page) {
  for (const [name, pattern] of SUBMIT_STEPS) {
    const visible = await page
      .getByRole("heading", { name: pattern })
      .first()
      .isVisible()
      .catch(() => false)
    if (visible) return name
  }
  return "welcome"
}

/** 13–18 — one real talk, submitted through the public form as a speaker. */
async function submitATalk(context, state) {
  // A speaker is not the organizer: their own clean browser context.
  const speaker = await context.browser().newContext(CONTEXT_OPTS)
  const page = await speaker.newPage()
  const seen = new Set()
  const deadline = Date.now() + 240_000

  const continueOn = () =>
    page.getByRole("button", { name: /^continue$/i }).first().click({ timeout: 6000 })

  try {
    await go(page, `${BASE}${state.formPath}`)
    await settle(page, 1500)

    while (Date.now() < deadline) {
      const step = await currentSubmitStep(page)

      if (step === "welcome") {
        if (!seen.has("welcome")) {
          seen.add("welcome")
          await safeShot("15-submit-welcome", () => shot(page, "15-submit-welcome"))
        }
        await continueOn().catch(() => {})
        await page.waitForTimeout(1200)
        continue
      }

      if (step === "account") {
        await fillSticky(page, "#submit-email", TALK.email).catch(() => {})
        if (!seen.has("account")) {
          seen.add("account")
          await safeShot("16-submit-account", () => shot(page, "16-submit-account"))
        }
        await continueOn().catch(() => {})
        // `submit.identify` can take a while on a cold dev deployment.
        await page.waitForTimeout(6000)
        continue
      }

      if (step === "talk") {
        await fillSticky(page, "#question-title", TALK.title).catch(() => {})
        await fillSticky(page, "#question-description", TALK.abstract).catch(() => {})
        await pickOption(page, "#question-format", /^talk$/i).catch(() => {})
        await pickOption(page, "#question-track", TRACKS[0]).catch(() => {})
        if (!seen.has("talk")) {
          seen.add("talk")
          await safeShot("17-submit-talk", () => shot(page, "17-submit-talk"))
        }
        await continueOn().catch(() => {})
        await page.waitForTimeout(1500)
        continue
      }

      if (step === "participants") {
        await fillSticky(page, "#participant-0-firstName", TALK.firstName).catch(() => {})
        await fillSticky(page, "#participant-0-lastName", TALK.lastName).catch(() => {})
        await fillSticky(page, "#participant-0-jobTitle", TALK.jobTitle).catch(() => {})
        await fillSticky(page, "#participant-0-company", TALK.company).catch(() => {})
        if (!seen.has("participants")) {
          seen.add("participants")
          await safeShot("18-submit-speaker", () => shot(page, "18-submit-speaker"))
        }
        await continueOn().catch(() => {})
        await page.waitForTimeout(1500)
        continue
      }

      if (step === "review") {
        if (!seen.has("review")) {
          seen.add("review")
          await safeShot("19-submit-review", () => shot(page, "19-submit-review"))
        }
        await page
          .getByRole("button", { name: /^submit$/i })
          .first()
          .click({ timeout: 6000 })
          .catch(() => {})
        await page.waitForTimeout(3000)
        continue
      }

      // success
      // The card auto-redirects to the portal after a few seconds — stop it.
      await tryClick(page, page.getByRole("button", { name: /stay here/i }), "stay on the success card")
      await safeShot("20-submitted", () => shot(page, "20-submitted"))
      const portalHref = await page
        .locator("a[href^='/portal/t/']")
        .first()
        .getAttribute("href")
        .catch(() => null)
      if (portalHref) {
        state.portalUrl = `${BASE}${portalHref}`
        log("captured the speaker's portal link")
      }
      log(`submitted "${TALK.title}"`)
      return
    }
    throw new Error("the public form never reached the success step")
  } finally {
    await speaker.close()
  }
}

/** 21–25 — it lands in the inbox, gets read, staged and committed. */
async function reviewAndAccept(page, state) {
  await go(page, appUrl(state, "/submissions"))
  await settle(page, 1200)
  await safeShot("21-first-submission", () => shot(page, "21-first-submission"))

  await safeShot("22-read-the-submission", async () => {
    await click(
      page,
      page.locator('table a[href*="/submissions"]').first(),
      "opened the submission drawer"
    )
    await cropShot(page, page.locator('[data-slot="drawer-shell"]'), "22-read-the-submission")
  })

  // 23 — the status picker, open. One click applies (no Save/Cancel pair):
  // picking a queue only STAGES the decision, which is what makes a one-click
  // apply safe — src/components/submissions/status-picker.tsx says so in the
  // popover's own footnote.
  await safeShot("23-status-picker", async () => {
    await click(
      page,
      page.getByRole("button", { name: /change status of/i }),
      "opened the status picker"
    )
    const popover = page.locator('[data-slot="popover-content"]').first()
    await popover.waitFor({ timeout: 6000 })
    await cropShot(page, popover, "23-status-picker")
  })

  // Stage it to the Accept Queue from that same open picker.
  await safeShot("24-accept-queue", async () => {
    const picker = page.getByRole("button", { name: /change status of/i })
    if ((await page.locator('[data-slot="popover-content"]').count()) === 0) {
      await click(page, picker, "re-opened the status picker")
    }
    await click(page, page.getByRole("button", { name: /^accept queue$/i }), "picked Accept Queue")
    await settle(page, 1200)
    await page.keyboard.press("Escape").catch(() => {})
    await go(page, appUrl(state, "/submissions?status=accept_queue"))
    await shot(page, "24-accept-queue")
  })

  await safeShot("25-send-acceptances", async () => {
    await click(
      page,
      page.getByRole("button", { name: /^send acceptances$/i }),
      "opened the commit confirmation"
    )
    await cropShot(page, page.locator('[data-slot="alert-dialog-content"]'), "25-send-acceptances")
    // Commit for real — the rest of the story needs an accepted speaker.
    await click(
      page,
      page.locator('[data-slot="alert-dialog-content"]').getByRole("button", { name: /^send/i }),
      "committed the accept queue"
    )
    await settle(page, 1800)
  })
}

/** 26–29 — the speaker's side: a task to do, and the portal they do it in. */
async function speakerFollowUp(page, state) {
  await go(page, appUrl(state, "/speakers"))
  await settle(page, 1000)
  await safeShot("26-speakers", () => shot(page, "26-speakers"))

  await safeShot("27-assign-a-task", async () => {
    await click(
      page,
      page.getByRole("button", { name: /^assign task$/i }),
      "opened Assign task"
    )
    const dialog = page.locator('[data-slot="dialog-content"]')
    await dialog.waitFor({ timeout: 8000 })
    await fillSticky(page, dialog.locator("#task-title"), TASK.title)
    // A due date, picked from the real calendar. Best-effort: the shot is
    // worth more than the date.
    if (await tryClick(page, dialog.locator("#task-due"), "opened the due-date picker")) {
      await pickCalendarDay(page, TASK.due).catch(() => log("skipped the due date"))
    }
    // The dialog's fields scroll inside a fixed-height body, and every focus
    // scrolls that body — which is how the title field, the whole reason for
    // the shot, ended up above the crop. Rewind it, and shoot before ticking
    // a speaker (one more scroll) rather than after.
    await scrollDialogToTop(page, dialog)
    await settle(page, 400)
    await cropShot(page, dialog, "27-assign-a-task")
    // "Assign to" is required — the dialog refuses to submit with nobody
    // ticked, and the story needs a real assignment: the speaker-portal shots
    // downstream are the proof it landed.
    await click(
      page,
      dialog.getByRole("checkbox", {
        name: new RegExp(`assign to ${TALK.firstName}`, "i"),
      }),
      `ticked ${TALK.firstName} ${TALK.lastName}`
    )
    await settle(page, 300)
    await click(
      page,
      dialog.getByRole("button", { name: /^assign task$/i }),
      "assigned the task"
    )
    // The dialog closes on success — if it is still there, nothing was created
    // and shot 29 would quietly lie about it.
    await dialog.waitFor({ state: "hidden", timeout: 15000 })
    await settle(page, 900)
  })

  // Fall back to the roster's own portal link if the success card had none.
  if (!state.portalUrl) {
    const href = await page
      .locator("a[href^='/portal/t/']")
      .first()
      .getAttribute("href")
      .catch(() => null)
    if (href) state.portalUrl = `${BASE}${href}`
  }

  if (!state.portalUrl) {
    skipped.push("28-speaker-portal", "29-speaker-tasks")
    log("SKIPPED portal shots — no portal token captured")
    return
  }

  const speaker = await page.context().browser().newContext(CONTEXT_OPTS)
  const portal = await speaker.newPage()
  try {
    await go(portal, state.portalUrl)
    await settle(portal, 1500)
    await safeShot("28-speaker-portal", () => shot(portal, "28-speaker-portal"))
    await go(portal, `${BASE}/portal/tasks`)
    await safeShot("29-speaker-tasks", () => shot(portal, "29-speaker-tasks"))
  } finally {
    await speaker.close()
  }
}

/** 30–34 — the accepted talk onto the agenda, then live to the world. */
async function scheduleAndPublish(page, state, { from = 30 } = {}) {
  if (from <= 31) {
    await go(page, appUrl(state, "/agenda"))
    await settle(page, 1400)
    await safeShot("30-nothing-scheduled", () => shot(page, "30-nothing-scheduled"))

    await safeShot("31-schedule-a-session", async () => {
      await click(
        page,
        page.getByRole("button", { name: /schedule this session/i }),
        "opened the schedule popover"
      )
      const popover = page.locator('[data-slot="popover-content"]').first()
      await popover.waitFor({ timeout: 6000 })
      const id = await popover
        .locator("[id^='room-']")
        .first()
        .getAttribute("id")
        .then((value) => value?.replace("room-", "") ?? null)
        .catch(() => null)
      if (id) {
        await pickOption(page, `#room-${id}`, ROOMS[0].name).catch(() => {})
        await pickOption(page, `#start-${id}`, /9:00|09:00/).catch(() => {})
      }
      await cropShot(page, popover, "31-schedule-a-session")
      await click(
        page,
        page.getByRole("button", { name: /^schedule session$/i }),
        "scheduled the talk"
      )
      await settle(page, 1500)
    })
  }

  await safeShot("32-agenda", async () => {
    await go(page, appUrl(state, "/agenda?view=day"))
    await settle(page, 1200)
    await scrollGridToProgramme(page)
    await shot(page, "32-agenda")
  })

  await safeShot("33-publish", async () => {
    await go(page, appUrl(state, "/agenda"))
    await settle(page, 1000)
    await click(page, page.getByRole("button", { name: /^publish agenda$/i }), "opened Publish")
    await cropShot(page, page.locator('[data-slot="dialog-content"]'), "33-publish")
    await click(
      page,
      page.locator('[data-slot="dialog-content"]').getByRole("button", { name: /^publish agenda$/i }),
      "published the agenda"
    )
    await settle(page, 1800)
  })

  await safeShot("34-public-page", async () => {
    // Canonical `/e/:workspaceSlug/:eventSlug`. The legacy one-segment address
    // resolves oldest-claimant-first, which on the shared dev database is a
    // previous run's event.
    await go(page, `${BASE}/e/${state.ref.workspaceSlug}/${state.ref.eventSlug}`)
    await settle(page, 1200)
    await shot(page, "34-public-page")
  })
}

/** The day grid opens at midnight; scroll it onto the first session. */
async function scrollGridToProgramme(page) {
  await page
    .evaluate(() => {
      const card = document.querySelector("[data-session-card], .cursor-grab")
      let node = card?.parentElement ?? null
      while (node && node !== document.body) {
        const style = getComputedStyle(node)
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
          node.scrollTop = Math.max(0, (card?.offsetTop ?? 0) - 64)
          return
        }
        node = node.parentElement
      }
    })
    .catch(() => {})
  await page.waitForTimeout(400)
}

main().catch((error) => {
  console.error(error)
  console.log(`\nwritten before the failure: ${written.join(", ") || "(none)"}`)
  process.exit(1)
})

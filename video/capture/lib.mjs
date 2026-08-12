/**
 * Shared plumbing for the launch-video capture scripts.
 *
 * Runs against the live dev app on localhost:3000 with the seeded demo world.
 * Uses the repo root's node_modules (convex, @playwright/test) — run from the
 * repo root: `node video/capture/capture.mjs <beat…>`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../convex/_generated/api.js"

export { api }

export const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, "../..")
export const RAW = resolve(HERE, "raw")
export const OUT = resolve(HERE, "../public/captures")
export const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3000"
export const EVENT_SLUG = "ai-summit-2026"
export const WS_SLUG = "ai-engineer"

/**
 * URLs went fully hierarchical (`/app/:workspace/:event/…`) — the bare paths
 * still resolve but only via a client-side redirect, which films as a flash.
 * Every beat therefore addresses the canonical path directly.
 */
export const appPath = (p = "") => `/app/${WS_SLUG}/${EVENT_SLUG}${p}`
export const cfpPath = (form = "cfp") => `/submit/${WS_SLUG}/${EVENT_SLUG}/${form}`
export const publicPath = () => `/e/${WS_SLUG}/${EVENT_SLUG}`
export const AUTH_STATE = resolve(HERE, ".auth.json")
export const STATE_FILE = resolve(HERE, "state.json")
export const MARKS_FILE = resolve(HERE, "marks.json")

for (const dir of [RAW, OUT]) mkdirSync(dir, { recursive: true })

export const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)

export const ORGANIZER = {
  email: "organizer@demo.sessionboard.dev",
  password: "demo2026",
}

/** Authed Convex client for fixture setup/teardown. */
export async function organizerClient() {
  const res = await fetch(`${env.VITE_CONVEX_SITE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify(ORGANIZER),
  })
  if (!res.ok) throw new Error(`demo sign-in failed: ${res.status}`)
  const jwt = res.headers
    .getSetCookie()
    .find((c) => c.includes("convex_jwt="))
    ?.match(/convex_jwt=([^;]+)/)?.[1]
  if (!jwt) throw new Error("no convex_jwt in sign-in response")
  const client = new ConvexHttpClient(env.VITE_CONVEX_URL)
  client.setAuth(decodeURIComponent(jwt))
  return client
}

export async function mainEvent(client) {
  const events = await client.query(api.events.list, {})
  const ev = events.find((e) => e.slug === EVENT_SLUG)
  if (!ev) throw new Error("demo event missing")
  return ev
}

// ——— Persisted run state (fixture ids, tokens) ————————————————————————————

export function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {}
}
export function saveState(patch) {
  const next = { ...loadState(), ...patch }
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2))
  return next
}
export function saveMarks(beat, marks) {
  const all = existsSync(MARKS_FILE) ? JSON.parse(readFileSync(MARKS_FILE, "utf8")) : {}
  all[beat] = marks
  writeFileSync(MARKS_FILE, JSON.stringify(all, null, 2))
}

// ——— Fake cursor ————————————————————————————————————————————————————————————

/** Injected into every document: a macOS-style pointer that follows the mouse. */
export const CURSOR_INIT = `(() => {
  const install = () => {
    if (document.getElementById("__vcursor")) return
    // Hide dev-only chrome (TanStack devtools badge) from every frame.
    const style = document.createElement("style")
    style.textContent = "#tanstack_devtools{display:none!important}"
    document.documentElement.appendChild(style)
    // The TanStack devtools toggle is a goober-styled fixed <button> with an
    // <img> inside; app buttons never match that shape.
    const scrub = () => {
      for (const el of document.querySelectorAll("[id^=tanstack]")) {
        el.style.setProperty("display", "none", "important")
      }
      for (const el of document.querySelectorAll("button")) {
        if (/(^| )go\\d+/.test(el.className) && el.querySelector("img")) {
          el.style.setProperty("display", "none", "important")
        }
      }
    }
    scrub()
    setInterval(scrub, 120)
    const c = document.createElement("div")
    c.id = "__vcursor"
    c.style.cssText = "position:fixed;left:-100px;top:-100px;width:26px;height:30px;pointer-events:none;z-index:2147483647;will-change:left,top;"
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));transition:transform 90ms ease"><path d="M6 3 L6 23.5 L11 19.2 L14 26.2 L17.4 24.7 L14.4 17.9 L21 17.6 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(c)
    window.addEventListener("mousemove", (e) => {
      c.style.left = e.clientX + "px"
      c.style.top = e.clientY + "px"
    }, true)
    window.addEventListener("mousedown", () => { c.firstElementChild.style.transform = "scale(0.82)" }, true)
    window.addEventListener("mouseup", () => { c.firstElementChild.style.transform = "scale(1)" }, true)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install)
  else install()
})()`

// ——— Motion helpers ————————————————————————————————————————————————————————

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const pos = new WeakMap()

/** Move the mouse to a point with a deliberate, eased glide. */
export async function glide(page, to, { duration = 550 } = {}) {
  const from = pos.get(page) ?? { x: 300, y: 300 }
  const steps = Math.max(14, Math.round(duration / 16))
  for (let i = 1; i <= steps; i++) {
    const e = easeInOutCubic(i / steps)
    await page.mouse.move(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e)
    await page.waitForTimeout(Math.max(8, duration / steps))
  }
  pos.set(page, { x: to.x, y: to.y })
}

export async function glideTo(page, locator, { duration = 550, dx = 0, dy = 0 } = {}) {
  await locator.first().waitFor({ state: "visible", timeout: 20000 })
  await locator.first().scrollIntoViewIfNeeded().catch(() => {})
  const b = await locator.first().boundingBox()
  if (!b) throw new Error("no bounding box for glide target")
  const to = { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy }
  await glide(page, to, { duration })
  return to
}

/** Glide onto an element, settle, click (Playwright click = actionability checks). */
export async function clickCalm(page, locator, opts = {}) {
  await glideTo(page, locator, opts)
  await page.waitForTimeout(opts.settle ?? 160)
  await locator.first().click({ timeout: 8000 })
}

/** Click something that should reveal `expected`; retry the click once if not. */
export async function clickUntil(page, locator, expected, opts = {}) {
  await clickCalm(page, locator, opts)
  try {
    await expected.first().waitFor({ timeout: opts.timeout ?? 12000 })
  } catch {
    await locator.first().click({ timeout: 8000 })
    await expected.first().waitFor({ timeout: opts.timeout ?? 20000 })
  }
}

/** Click into a field and type like a human. */
export async function typeCalm(page, locator, text, opts = {}) {
  await clickCalm(page, locator, opts)
  await page.waitForTimeout(120)
  await page.keyboard.type(text, { delay: opts.delay ?? 22 })
}

// ——— Beat runner ————————————————————————————————————————————————————————————

let sharedBrowser = null
export async function browser() {
  if (!sharedBrowser) {
    const { chromium } = await import("@playwright/test")
    sharedBrowser = await chromium.launch()
  }
  return sharedBrowser
}
export async function shutdown() {
  if (sharedBrowser) await sharedBrowser.close()
  sharedBrowser = null
}

/**
 * Run a recorded beat in a fresh context. Saves the webm to raw/<name>.webm
 * and per-beat time marks (ms since page open) for trimming.
 */
export async function recordBeat(name, fn, { viewport = { width: 1600, height: 1000 }, authed = true } = {}) {
  const b = await browser()
  const context = await b.newContext({
    viewport,
    deviceScaleFactor: 2,
    recordVideo: { dir: RAW, size: viewport },
    colorScheme: "light",
    ...(authed && existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}),
  })
  await context.addInitScript(CURSOR_INIT)
  const page = await context.newPage()
  const t0 = Date.now()
  const marks = {}
  const mark = (label) => {
    marks[label] = Date.now() - t0
    console.log(`  mark ${label} @ ${(marks[label] / 1000).toFixed(2)}s`)
  }
  console.log(`— beat: ${name}`)
  let failed = null
  try {
    await fn(page, { mark, context })
  } catch (err) {
    failed = err
  }
  const video = page.video()
  await context.close()
  if (video) {
    const p = await video.path()
    const { renameSync } = await import("node:fs")
    renameSync(p, resolve(RAW, `${name}.webm`))
  }
  saveMarks(name, marks)
  if (failed) throw failed
  console.log(`  saved raw/${name}.webm`)
}

/** Take a retina still into public/captures/<name>.png. */
export async function still(name, path, fn, { viewport = { width: 1600, height: 1000 }, authed = true } = {}) {
  const b = await browser()
  const context = await b.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: "light",
    ...(authed && existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}),
  })
  await context.addInitScript(CURSOR_INIT)
  const page = await context.newPage()
  console.log(`— still: ${name}`)
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" })
    await page.waitForTimeout(1200)
    if (fn) await fn(page)
    // Let toasts die and animations settle before the frame.
    await page.screenshot({ path: resolve(OUT, `${name}.png`) })
    console.log(`  saved captures/${name}.png`)
  } finally {
    await context.close()
  }
}

export async function gotoStable(page, path, wait = "networkidle") {
  await page.goto(path.startsWith("http") ? path : `${BASE}${path}`, { waitUntil: wait })
  await page.waitForTimeout(600)
}

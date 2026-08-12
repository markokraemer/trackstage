// Mobile UX sweep harness — screenshots every major surface at iPhone size.
// Run: node .mobile-shots/shoot.mjs [suite]   (suite: public|portal|app|all)
import { chromium, devices } from "@playwright/test"
import fs from "node:fs"

const OUT = ".mobile-shots"
const BASE = "http://localhost:3000"
const W = Number(process.env.W ?? 390)
const H = Number(process.env.H ?? 844)
const iphone = {
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
}

const suite = process.argv[2] ?? "all"
const tag = process.argv[3] ?? "before"

async function shot(page, name, path, opts = {}) {
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(opts.wait ?? 1200)
    if (opts.prep) await opts.prep(page)
    const hscroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: opts.fullPage ?? true })
    console.log(`${name}: hscroll=${hscroll}px ${hscroll > 1 ? "  <-- HORIZONTAL OVERFLOW" : ""}`)
  } catch (e) {
    console.log(`${name}: FAILED ${String(e).slice(0, 160)}`)
  }
}

const browser = await chromium.launch()

if (suite === "public" || suite === "all") {
  const ctx = await browser.newContext(iphone)
  const page = await ctx.newPage()
  await shot(page, "landing", "/")
  await shot(page, "login", "/login")
  await shot(page, "event-home", "/e/ai-engineer/ai-summit-2026")
  await shot(page, "event-sessions", "/e/ai-engineer/ai-summit-2026/sessions")
  await shot(page, "event-speakers", "/e/ai-engineer/ai-summit-2026/speakers")
  await shot(page, "cfp-step1", "/submit/ai-engineer/ai-summit-2026/cfp")
  await ctx.close()
}

if (suite === "portal" || suite === "all") {
  const ctx = await browser.newContext(iphone)
  const page = await ctx.newPage()
  await shot(page, "portal-home", "/portal/t/demo-ava-nakamura", { wait: 2500 })
  await shot(page, "portal-submissions", "/portal/submissions", { wait: 2000 })
  await shot(page, "portal-profile", "/portal/profile", { wait: 2000 })
  await shot(page, "portal-tasks", "/portal/tasks", { wait: 2000 })
  // submission drawer open
  await page.goto(BASE + "/portal/submissions").catch(() => {})
  await page.waitForTimeout(1500)
  const card = page.locator("a,button").filter({ hasText: /view|details/i }).first()
  await ctx.close()
}

if (suite === "app" || suite === "all") {
  const ctx = await browser.newContext({
    ...iphone,
    storageState: "tests/e2e/.auth/organizer.json",
  })
  const page = await ctx.newPage()
  const ev = "/app/ai-engineer/ai-summit-2026"
  await shot(page, "app-dashboard", ev, { wait: 2500 })
  await shot(page, "app-submissions", `${ev}/submissions`, { wait: 2500 })
  await shot(page, "app-agenda", `${ev}/agenda`, { wait: 2500 })
  await shot(page, "app-forms", `${ev}/forms`, { wait: 2000 })
  await shot(page, "app-evaluation", `${ev}/evaluation`, { wait: 2000 })
  await shot(page, "app-speakers", `${ev}/speakers`, { wait: 2000 })
  await shot(page, "app-files", `${ev}/files`, { wait: 2000 })
  await shot(page, "app-comms", `${ev}/communications`, { wait: 2000 })
  await shot(page, "app-embeds", `${ev}/embeds`, { wait: 2000 })
  await shot(page, "app-settings", `${ev}/settings`, { wait: 2000 })
  await shot(page, "app-copilot", "/app/copilot", { wait: 2000 })
  await ctx.close()
}

await browser.close()
fs.writeFileSync(`${OUT}/.done-${tag}-${suite}`, new Date().toISOString())

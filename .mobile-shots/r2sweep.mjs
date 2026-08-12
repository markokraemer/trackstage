// Round-2 sweep of surfaces landed tonight, at 390×844 (pass 375 as arg for 375×667).
import { chromium, devices } from "@playwright/test"

const OUT = ".mobile-shots"
const BASE = "http://localhost:3000"
const small = process.argv[2] === "375"
const vp = small ? { width: 375, height: 667 } : { width: 390, height: 844 }
const tag = small ? "r2s-375" : "r2s"
const iphone = {
  viewport: vp,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  ...iphone,
  storageState: "tests/e2e/.auth/organizer.json",
})
const page = await ctx.newPage()
const ev = "/app/ai-engineer/ai-summit-2026"

async function check(name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 1200)
  const hscroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: opts.fullPage ?? false })
  console.log(`${name}: hscroll=${hscroll}${hscroll > 1 ? " <-- OVERFLOW" : ""}`)
}

// Settings standalone pages
await page.goto(BASE + "/app/account", { waitUntil: "networkidle" }).catch(() => {})
await check("account", { fullPage: true })
await page.goto(BASE + "/app/account?tab=api", { waitUntil: "networkidle" }).catch(() => {})
await check("account-api", { fullPage: true })
await page.goto(BASE + "/app/ai-engineer/workspace", { waitUntil: "networkidle" }).catch(() => {})
await check("workspace", { fullPage: true })
await page.goto(BASE + "/app/ai-engineer/workspace?tab=team", { waitUntil: "networkidle" }).catch(() => {})
await check("workspace-team", { fullPage: true })

// Event settings (round-1 tab-nav overlap check)
await page.goto(BASE + ev + "/settings", { waitUntil: "networkidle" }).catch(() => {})
await check("event-settings", { fullPage: true })

// New-form dialog
await page.goto(BASE + ev + "/forms?new=1", { waitUntil: "networkidle" }).catch(() => {})
await check("new-form-dialog", { wait: 1800 })

// File preview dialog: open files page, click first preview-able row
await page.goto(BASE + ev + "/files", { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(1500)
const row = page.locator("table tbody tr").first()
if (await row.count()) {
  await row.click().catch(() => {})
  await check("file-preview", { wait: 1500 })
} else {
  console.log("file-preview: no rows")
}

await ctx.close()
await browser.close()

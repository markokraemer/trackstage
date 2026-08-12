// Find elements wider than the viewport on a given path.
import { chromium, devices } from "@playwright/test"

const BASE = "http://localhost:3000"
const path = process.argv[2] ?? "/app/ai-engineer/ai-summit-2026/settings"
const width = Number(process.argv[3] ?? 390)

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
  storageState: "tests/e2e/.auth/organizer.json",
})
const page = await ctx.newPage()
await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(1800)
const rows = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const out = []
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect()
    if (r.width > vw + 1 || r.right > vw + 1) {
      out.push(
        `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 90)} w=${Math.round(r.width)} right=${Math.round(r.right)}`,
      )
    }
  }
  return out.slice(0, 25)
})
console.log(rows.join("\n") || "no offenders")
await ctx.close()
await browser.close()

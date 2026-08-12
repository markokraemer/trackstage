import { chromium, devices } from "@playwright/test"
const se = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const page = await (await browser.newContext(se)).newPage()
const hs = async () => await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
for (const [n, u] of [["cfp", "/submit/ai-engineer/ai-summit-2026/cfp"], ["portal", "/portal/t/demo-ava-nakamura"], ["event", "/e/ai-engineer/ai-summit-2026"]]) {
  await page.goto("http://localhost:3000" + u, { waitUntil: "networkidle" }).catch(() => {})
  await page.waitForTimeout(1800)
  console.log(`${n}@375: hscroll=${await hs()}px`)
}
await browser.close()

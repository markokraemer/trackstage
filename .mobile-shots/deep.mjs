import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...iphone, storageState: "tests/e2e/.auth/organizer.json" })
const page = await ctx.newPage()
const hs = async () => await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const ev = "/app/ai-engineer/ai-summit-2026"
// form builder
await page.goto("http://localhost:3000" + ev + "/forms", { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(2000)
const formLink = page.locator(`a[href*="/forms/"]`).first()
if (await formLink.isVisible().catch(() => false)) {
  await formLink.click(); await page.waitForTimeout(2500)
  await page.screenshot({ path: ".mobile-shots/deep-form-builder.png", fullPage: true })
  console.log("form-builder:", page.url().split("/app")[1], "hscroll=" + await hs())
} else console.log("no form link")
// evaluation plan
await page.goto("http://localhost:3000" + ev + "/evaluation", { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(2000)
const planLink = page.locator(`a[href*="/evaluation/"]`).first()
if (await planLink.isVisible().catch(() => false)) {
  await planLink.click(); await page.waitForTimeout(2500)
  await page.screenshot({ path: ".mobile-shots/deep-eval-plan.png", fullPage: true })
  console.log("eval-plan: hscroll=" + await hs())
} else console.log("no plan link")
// agenda week + conflicts + list views
for (const v of ["list", "week", "conflicts"]) {
  await page.goto(`http://localhost:3000${ev}/agenda?view=${v}`, { waitUntil: "networkidle" }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `.mobile-shots/deep-agenda-${v}.png`, fullPage: true })
  console.log(`agenda-${v}: hscroll=` + await hs())
}
await browser.close()

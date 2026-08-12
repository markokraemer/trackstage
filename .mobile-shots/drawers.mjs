import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()

// Portal drawer
const pctx = await browser.newContext(iphone)
const pp = await pctx.newPage()
await pp.goto("http://localhost:3000/portal/t/demo-ava-nakamura", { waitUntil: "networkidle" }).catch(() => {})
await pp.waitForTimeout(2000)
await pp.goto("http://localhost:3000/portal/submissions").catch(() => {})
await pp.waitForTimeout(1500)
await pp.getByRole("button", { name: /view details/i }).first().click().catch((e) => console.log("portal open fail", String(e).slice(0,80)))
await pp.waitForTimeout(1000)
await pp.screenshot({ path: ".mobile-shots/drawer-portal.png" })
console.log("portal drawer shot")
await pctx.close()

// Organizer submission drawer
const ctx = await browser.newContext({ ...iphone, storageState: "tests/e2e/.auth/organizer.json" })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/app/ai-engineer/ai-summit-2026/submissions", { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(3000)
// click first row title link
const row = page.locator("[data-slot=table-row] a, tbody tr a").first()
if (await row.isVisible().catch(() => false)) { await row.click() } else {
  await page.locator("tbody tr").first().click().catch((e) => console.log("row click fail"))
}
await page.waitForTimeout(1200)
await page.screenshot({ path: ".mobile-shots/drawer-organizer.png" })
console.log("organizer drawer shot")

// Copilot panel on mobile
await page.keyboard.press("Escape")
await page.waitForTimeout(400)
await page.getByRole("button", { name: /copilot/i }).first().click().catch((e) => console.log("copilot fail", String(e).slice(0,80)))
await page.waitForTimeout(1000)
await page.screenshot({ path: ".mobile-shots/copilot-mobile.png" })
console.log("copilot shot")
await browser.close()

import { chromium } from "@playwright/test"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: "tests/e2e/.auth/organizer.json" })
const page = await ctx.newPage()
const ev = "/app/ai-engineer/ai-summit-2026"
for (const [n, p] of [["dash", ev], ["subs", ev+"/submissions"], ["agenda", ev+"/agenda"], ["speakers", ev+"/speakers"], ["form", ev+"/forms/jd7d28h76jsvh30jzyxgrfb5zh8c9c1r"]]) {
  await page.goto("http://localhost:3000" + p, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `.mobile-shots/desk-${n}.png` })
  console.log("desk-" + n + " done")
}
// drawer at desktop — must stay ~480px, not full width
await page.goto("http://localhost:3000" + ev + "/submissions", { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(2500)
const row = page.locator("tbody tr a").first()
if (await row.isVisible().catch(() => false)) {
  await row.click(); await page.waitForTimeout(1200)
  const box = await page.getByRole("dialog").first().boundingBox().catch(() => null)
  console.log("desktop drawer box:", JSON.stringify(box))
  await page.screenshot({ path: ".mobile-shots/desk-drawer.png" })
}
await browser.close()

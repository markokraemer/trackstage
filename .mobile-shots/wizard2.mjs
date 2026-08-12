import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const page = await (await browser.newContext(iphone)).newPage()
const hs = async () => await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const snap = async (n) => { await page.screenshot({ path: `.mobile-shots/wiz-${n}.png`, fullPage: true }); console.log(`${n}: hscroll=${await hs()}px`) }
await page.goto("http://localhost:3000/submit/ai-engineer/ai-summit-2026/cfp", { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(600)
await page.getByLabel(/email/i).first().fill(`wiz2-${Date.now().toString(36)}@example.com`)
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(1500)
// fill submission step minimally
const tf = page.locator("input[type=text]:visible, textarea:visible")
const n = await tf.count()
for (let i = 0; i < n; i++) {
  const el = tf.nth(i)
  if (!(await el.inputValue())) await el.fill("Mobile pass sample text for required fields").catch(() => {})
}
// open first visible select to check picker usability
const sel = page.locator("[data-slot=select-trigger]:visible").first()
if (await sel.isVisible().catch(() => false)) {
  await sel.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: ".mobile-shots/wiz-3-select-open.png" })
  const opt = page.locator("[role=option]").first()
  if (await opt.isVisible().catch(() => false)) await opt.click()
  else await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
}
// choose radio/checkbox options if required
for (const r of await page.locator("[role=radiogroup]").all()) {
  await r.locator("[role=radio]").first().click().catch(() => {})
}
await snap("3-done")
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(1500)
await snap("4-participants")
const cont = page.getByRole("button", { name: /continue/i }).first()
// fill participant requireds if present
for (const el of await page.locator("input[type=text]:visible").all()) {
  if (!(await el.inputValue())) await el.fill("Testy").catch(() => {})
}
await cont.click().catch(() => {})
await page.waitForTimeout(1500)
await snap("5-review")
await browser.close()

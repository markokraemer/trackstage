import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const ctx = await browser.newContext(iphone)
const page = await ctx.newPage()
const hs = async () => await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const snap = async (n) => { await page.screenshot({ path: `.mobile-shots/wiz-${n}.png`, fullPage: true }); console.log(`${n}: hscroll=${await hs()}px`) }

await page.goto("http://localhost:3000/submit/ai-engineer/ai-summit-2026/cfp", { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
// step 1 -> 2
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(800)
const email = `mobile-pass-${Date.now().toString(36)}@example.com`
await page.getByLabel(/email/i).first().fill(email)
await snap("2-account")
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(1200)
await snap("3-submission-top")
// fill required fields if visible
const title = page.getByLabel(/title/i).first()
if (await title.isVisible().catch(() => false)) await title.fill("Mobile UX pass test talk")
// font sizes of inputs (iOS zoom check)
const sizes = await page.evaluate(() => {
  const els = [...document.querySelectorAll("input, textarea, select, [contenteditable]")]
  return [...new Set(els.map((e) => getComputedStyle(e).fontSize))]
})
console.log("input font sizes:", sizes.join(", "))
// tap target audit on this step
const small = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll("button, a, [role=button], input[type=checkbox], input[type=radio]")) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32)) out.push(`${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent||el.getAttribute("aria-label")||"").trim().slice(0,30)}"`)
  }
  return out.slice(0, 15)
})
console.log("small targets:", small.length ? "\n  " + small.join("\n  ") : "none")
await snap("3-submission-filled")
await browser.close()

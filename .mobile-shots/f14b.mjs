import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const page = await (await browser.newContext(iphone)).newPage()
await page.goto("http://localhost:3000/submit/ai-engineer/ai-summit-2026/cfp", { waitUntil: "networkidle" })
await page.waitForTimeout(1200)
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(600)
await page.getByLabel(/email/i).first().fill(`f14-${Date.now().toString(36)}@example.com`)
await page.getByRole("button", { name: /continue/i }).first().click()
await page.waitForTimeout(1200)
const bad = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll("input")) {
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 16) {
      const r = el.getBoundingClientRect()
      const p = el.closest("[data-slot]")
      out.push(`rect=${Math.round(r.width)}x${Math.round(r.height)} slot=${p?.getAttribute("data-slot")} parentCls=${String(el.parentElement.className).slice(0,110)} labelled=${el.labels?.[0]?.textContent?.slice(0,40) || el.closest("label")?.textContent?.slice(0,40) || "none"}`)
    }
  }
  return out
})
console.log(bad.join("\n") || "all >=16px")
await browser.close()

import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...iphone, storageState: "tests/e2e/.auth/organizer.json" })
const page = await ctx.newPage()
const url = process.argv[2]
await page.goto("http://localhost:3000" + url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {})
await page.waitForTimeout(2500)
const wide = await page.evaluate(() => {
  const out = []
  const vw = document.documentElement.clientWidth
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) {
      const cls = (el.className && typeof el.className === "string") ? el.className.slice(0, 90) : ""
      out.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} w=${Math.round(r.width)} cls=${cls}`)
    }
  }
  return out.slice(0, 25)
})
console.log(wide.join("\n"))
await browser.close()

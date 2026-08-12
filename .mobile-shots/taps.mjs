import { chromium, devices } from "@playwright/test"
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices["iPhone 13"].userAgent }
const browser = await chromium.launch()
const audit = async (page, name) => {
  const small = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll("button, a, [role=button], [role=tab], [role=menuitem]")) {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (r.width > 0 && r.height > 0 && s.visibility !== "hidden" && (r.height < 28 || r.width < 28))
        out.push(`${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute("aria-label")||el.textContent||"").trim().slice(0,35)}"`)
    }
    return out
  })
  console.log(`${name}: ${small.length ? "\n  " + small.join("\n  ") : "all targets >=28px"}`)
}
const pctx = await browser.newContext(iphone)
const pp = await pctx.newPage()
await pp.goto("http://localhost:3000/portal/t/demo-ava-nakamura", { waitUntil: "networkidle" }).catch(() => {})
await pp.waitForTimeout(2200)
await audit(pp, "portal-home")
await pctx.close()
const ctx = await browser.newContext({ ...iphone, storageState: "tests/e2e/.auth/organizer.json" })
const page = await ctx.newPage()
await page.goto("http://localhost:3000/app/ai-engineer/ai-summit-2026", { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(2500)
await audit(page, "app-dashboard")
await browser.close()

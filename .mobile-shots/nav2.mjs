// Round-2 mobile nav verification: hamburger drawer at 390×844 + desktop parity.
import { chromium, devices } from "@playwright/test"

const OUT = ".mobile-shots"
const BASE = "http://localhost:3000"
const iphone = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  ...iphone,
  storageState: "tests/e2e/.auth/organizer.json",
})
const page = await ctx.newPage()
const ev = "/app/ai-engineer/ai-summit-2026"

await page.goto(BASE + ev, { waitUntil: "networkidle" }).catch(() => {})
await page.waitForTimeout(2000)

// Tap targets in the top bar
for (const label of ["Open navigation", "Trackstage home", "Search"]) {
  const el = page.locator(`[aria-label="${label}"]`).first()
  const box = await el.boundingBox().catch(() => null)
  console.log(label, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "MISSING")
}
const hscroll = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
)
console.log("dashboard hscroll:", hscroll)
await page.screenshot({ path: `${OUT}/r2-topbar.png` })

// Open the drawer
await page.locator('[aria-label="Open navigation"]').click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r2-drawer-open.png` })

// Drawer contents present?
for (const text of ["Program", "Submissions", "Agenda", "Settings", "Getting started"]) {
  const visible = await page.getByText(text, { exact: false }).first().isVisible().catch(() => false)
  console.log(`drawer has "${text}":`, visible)
}
// Event switcher detail (name + dates)
const switcher = page.locator('[data-slot="sheet-content"] [aria-label="Switch event"]')
console.log("switcher text:", (await switcher.textContent().catch(() => ""))?.trim().slice(0, 80))

// Nav item tap height
const navItem = page.locator('[data-slot="sheet-content"] nav a').first()
const nb = await navItem.boundingBox()
console.log("drawer nav item:", nb ? `${Math.round(nb.width)}x${Math.round(nb.height)}` : "MISSING")

// Navigate → auto-close
await page.locator('[data-slot="sheet-content"] nav a', { hasText: "Agenda" }).click()
await page.waitForTimeout(1200)
console.log("url after nav:", page.url().replace(BASE, ""))
console.log(
  "drawer closed after nav:",
  !(await page.locator('[data-slot="sheet-content"]').isVisible().catch(() => false)),
)
await page.screenshot({ path: `${OUT}/r2-after-nav.png` })

// Backdrop dismiss
await page.locator('[aria-label="Open navigation"]').click()
await page.waitForTimeout(400)
await page.mouse.click(370, 500)
await page.waitForTimeout(400)
console.log(
  "drawer closed after backdrop:",
  !(await page.locator('[data-slot="sheet-content"]').isVisible().catch(() => false)),
)

// Event switcher inside drawer opens its menu
await page.locator('[aria-label="Open navigation"]').click()
await page.waitForTimeout(400)
await page.locator('[data-slot="sheet-content"] [aria-label="Switch event"]').click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r2-drawer-switcher.png` })

await ctx.close()

// Desktop parity spot-check
const dctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: "tests/e2e/.auth/organizer.json",
})
const dpage = await dctx.newPage()
await dpage.goto(BASE + ev, { waitUntil: "networkidle" }).catch(() => {})
await dpage.waitForTimeout(2000)
console.log(
  "desktop hamburger hidden:",
  !(await dpage.locator('[aria-label="Open navigation"]').isVisible().catch(() => false)),
)
console.log(
  "desktop sidebar visible:",
  await dpage.locator("aside").isVisible().catch(() => false),
)
await dpage.screenshot({ path: `${OUT}/r2-desktop.png` })
await dctx.close()
await browser.close()

// Round-2 batch B: onboarding takeover (fresh signup), new-form dialog CTA
// reachability, workspace-team after shot — at 390×844.
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

// --- Fresh signup → onboarding takeover ---
{
  const ctx = await browser.newContext(iphone)
  const page = await ctx.newPage()
  await page.goto(BASE + "/login", { waitUntil: "networkidle" }).catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/r2b-login.png`, fullPage: true })
  // switch to create-account mode
  const createLink = page.getByText(/create.*account|sign up/i).first()
  if (await createLink.isVisible().catch(() => false)) {
    await createLink.click()
    await page.waitForTimeout(600)
    const email = `mobile-sweep-${Date.now()}@example.com`
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').first().fill("Sweep-2026-pass")
    const nameInput = page.locator('input[name="name"], input#name').first()
    if (await nameInput.isVisible().catch(() => false)) await nameInput.fill("Mobile Sweep")
    await page.screenshot({ path: `${OUT}/r2b-signup-filled.png` })
    await page.locator('button[type="submit"]').first().click()
    await page.waitForTimeout(4000)
    const hs = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    console.log("after signup url:", page.url().replace(BASE, ""), "hscroll:", hs)
    await page.screenshot({ path: `${OUT}/r2b-onboarding-1.png`, fullPage: true })
    // step through a couple of screens if a Next/Continue button exists
    for (let i = 2; i <= 4; i++) {
      const next = page
        .locator("button")
        .filter({ hasText: /continue|next|let's go|start/i })
        .first()
      if (!(await next.isVisible().catch(() => false))) break
      await next.click().catch(() => {})
      await page.waitForTimeout(1200)
      const h = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      console.log(`onboarding step ${i}: hscroll=${h}`)
      await page.screenshot({ path: `${OUT}/r2b-onboarding-${i}.png`, fullPage: true })
    }
  } else {
    console.log("no create-account link found on /login")
  }
  await ctx.close()
}

// --- Organizer surfaces ---
{
  const ctx = await browser.newContext({
    ...iphone,
    storageState: "tests/e2e/.auth/organizer.json",
  })
  const page = await ctx.newPage()
  const ev = "/app/ai-engineer/ai-summit-2026"

  // New-form dialog: is the primary CTA reachable (scrollable dialog)?
  await page.goto(BASE + ev + "/forms?new=1", { waitUntil: "networkidle" }).catch(() => {})
  await page.waitForTimeout(1500)
  const cta = page
    .locator('[role="dialog"] button')
    .filter({ hasText: /create|start|build/i })
    .last()
  if (await cta.count()) {
    await cta.scrollIntoViewIfNeeded().catch(() => {})
    const box = await cta.boundingBox()
    console.log(
      "new-form CTA:",
      box ? `${Math.round(box.width)}x${Math.round(box.height)} y=${Math.round(box.y)}` : "MISSING",
      "reachable:", box ? box.y + box.height <= 844 : false,
    )
    await page.screenshot({ path: `${OUT}/r2b-new-form-bottom.png` })
  } else {
    console.log("new-form CTA: not found")
  }

  // Workspace team after
  await page.goto(BASE + "/app/ai-engineer/workspace?tab=team", { waitUntil: "networkidle" }).catch(() => {})
  await page.waitForTimeout(1500)
  const hs = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  console.log("workspace-team hscroll:", hs)
  await page.screenshot({ path: `${OUT}/r2b-workspace-team.png`, fullPage: true })
  await ctx.close()
}

await browser.close()

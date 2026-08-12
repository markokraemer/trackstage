import { chromium } from "@playwright/test"

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
})
await page.goto("http://localhost:3000/submit/cfp", { waitUntil: "networkidle" })

const count = async (label) => {
  const m = await page.evaluate(() => ({
    main: document.querySelectorAll("main").length,
    trackers: document.querySelectorAll('[data-slot="step-tracker"]').length,
    forms: document.querySelectorAll("form").length,
    cards: document.querySelectorAll('[data-slot="card"]').length,
    poweredBy: document.querySelectorAll('[data-slot="powered-by"]').length,
    h1: [...document.querySelectorAll("h1")].map((n) => n.textContent),
  }))
  console.log(label, JSON.stringify(m))
}

await count("welcome")
await page.screenshot({ path: ".cfp-shots/step1.png", fullPage: true })

await page.getByRole("button", { name: "Continue" }).first().click()
await page.getByRole("heading", { name: "Your email address" }).waitFor()
await count("account")
await page.screenshot({ path: ".cfp-shots/step2.png", fullPage: true })

await page.getByRole("textbox").first().fill(`dupe-${Date.now()}@example.com`)
await page.getByRole("button", { name: "Continue" }).first().click()
await page.waitForTimeout(2500)
await count("submission")
await page.screenshot({ path: ".cfp-shots/step3.png", fullPage: true })

await browser.close()

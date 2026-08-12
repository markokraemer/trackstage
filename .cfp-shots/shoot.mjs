import { chromium } from "@playwright/test"

const widths = [1440, 1024, 820, 700, 640, 560, 390]
const browser = await chromium.launch()

for (const width of widths) {
  const page = await browser.newPage({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 2,
  })
  await page.goto("http://localhost:3000/submit/cfp", {
    waitUntil: "networkidle",
  })
  await page.getByRole("button", { name: "Continue" }).first().click()
  await page.getByRole("heading", { name: "Your email address" }).waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({
    path: `.cfp-shots/after-${width}.png`,
    fullPage: false,
  })
  // Report the measured widths so the fit is proven, not eyeballed.
  const m = await page.evaluate(() => {
    const ol = document.querySelector('[data-slot="step-tracker"] ol')
    const box = ol?.parentElement
    return {
      trackerScrollW: ol?.scrollWidth ?? null,
      trackerClientW: ol?.clientWidth ?? null,
      containerW: box?.clientWidth ?? null,
      lines: ol ? new Set([...ol.children].map((li) => li.getBoundingClientRect().top)).size : null,
      slack: ol
        ? Math.round(
            ol.getBoundingClientRect().right -
              ol.lastElementChild.getBoundingClientRect().right
          )
        : null,
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
    }
  })
  console.log(width, JSON.stringify(m))
  await page.close()
}

await browser.close()

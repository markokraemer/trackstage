import { chromium } from "@playwright/test"

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 2,
})
await page.goto("http://localhost:3000/submit/cfp", { waitUntil: "networkidle" })

const dump = async (label) => {
  const m = await page.evaluate(() => {
    const texts = [...document.querySelectorAll("h1,h2,h3")].map((n) =>
      n.textContent.trim()
    )
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i)
    return {
      inputs: document.querySelectorAll("input,textarea,select").length,
      labels: [...document.querySelectorAll("label")].map((n) =>
        n.textContent.trim()
      ),
      dupeHeadings: [...new Set(dupes)],
    }
  })
  const dupeLabels = m.labels.filter((l, i) => m.labels.indexOf(l) !== i)
  console.log(label, JSON.stringify({ ...m, dupeLabels: [...new Set(dupeLabels)] }))
}

await page.getByRole("button", { name: "Continue" }).first().click()
await page.getByRole("heading", { name: "Your email address" }).waitFor()
await page.getByRole("textbox").first().fill(`dupe2-${Date.now()}@example.com`)
await page.getByRole("button", { name: "Continue" }).first().click()
await page.waitForTimeout(2500)
await dump("submission")

await page.getByLabel(/Session title/).fill("A talk about duplicate forms")
await page
  .getByLabel(/Session description/)
  .fill("Describing what happens when a form renders twice on one page.")
for (const name of ["Format", "Track", "Audience level"]) {
  const sel = page.getByLabel(new RegExp(name))
  await sel.selectOption({ index: 1 }).catch(() => {})
}
await page.getByRole("button", { name: "Continue" }).first().click()
await page.waitForTimeout(1200)
await dump("participants")
await page.screenshot({ path: ".cfp-shots/step4.png", fullPage: true })

await page.getByRole("button", { name: "Continue" }).first().click()
await page.waitForTimeout(1200)
await dump("review")
await page.screenshot({ path: ".cfp-shots/step5.png", fullPage: true })

await browser.close()

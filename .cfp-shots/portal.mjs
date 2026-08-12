import { chromium } from "@playwright/test"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })
await p.goto("http://localhost:3000/portal/t/demo-sofia-marchetti", { waitUntil: "networkidle" })
await p.waitForTimeout(2000)
for (const path of ["", "/submissions", "/profile", "/tasks"]) {
  await p.goto(`http://localhost:3000/portal${path}`, { waitUntil: "networkidle" })
  await p.waitForTimeout(1800)
  await p.screenshot({ path: `.cfp-shots/pf${path.replace("/", "-") || "-home"}.png`, fullPage: true })
}
await b.close()

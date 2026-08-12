import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"

const OUT = new URL(".", import.meta.url).pathname
const EVENT = "http://localhost:3000/app/ai-engineer/ai-summit-2026"

mkdirSync(OUT, { recursive: true })

/**
 * The pre-fix rendering, reconstructed exactly: Streamdown's `list-inside`
 * and `[li_&]:pl-6` live in node_modules, which Tailwind v4 never scans, so
 * what shipped was preflight's `padding: 0` + the UA default marker position
 * (`outside`) — markers painted in a zero-width margin, i.e. outside the
 * transcript's own padding. Plus the old 16px/12px gutters.
 */
const BEFORE_CSS = `
.copilot-prose [data-streamdown="unordered-list"],
.copilot-prose [data-streamdown="ordered-list"] {
  margin-block: 2px !important;
  padding-inline-start: 0 !important;
  list-style-position: outside !important;
}
.copilot-prose [data-streamdown="list-item"] {
  padding-block: 2px !important;
  margin-top: 0 !important;
}
.copilot-prose [data-streamdown="list-item"]::marker { color: inherit !important; }
.copilot-prose [data-streamdown="list-item"] > p { display: inline !important; }
[role="log"] > div > div { padding-left: 16px !important; padding-right: 16px !important; }
[data-slot="sheet-content"] > div:last-of-type { padding: 12px !important; }
[data-slot="sheet-content"] > header { padding-left: 16px !important; padding-right: 16px !important; }
[data-slot="sheet-close"] { right: 16px !important; }
`

const browser = await chromium.launch()
const context = await browser.newContext({
  storageState: "tests/e2e/.auth/organizer.json",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

async function ensureAuth() {
  if (!page.url().includes("/login")) return
  await page.getByRole("button", { name: "Use these" }).click()
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/app\//, { timeout: 30000 })
  await page.waitForTimeout(3000)
}

async function openPanel() {
  await page.goto(EVENT, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3000)
  await ensureAuth()
  await page.getByRole("button", { name: "Open the AI copilot" }).click()
  await page.locator('[data-slot="sheet-content"]').waitFor()
  await page.waitForTimeout(2500)
}

await page.addInitScript(
  `if (!localStorage.getItem("sb.copilotPanelWidth")) localStorage.setItem("sb.copilotPanelWidth", "380")`
)
await openPanel()

const box = page.locator('[data-slot="sheet-content"] textarea').first()
await box.fill(
  "Give me a numbered list of the top 4 actions I should take next, each with a bold summary, an em-dash, the tool name in backticks and one long sentence of detail. Then a '### Deadlines' heading and a bulleted list of 3 dates."
)
await box.press("Enter")
try {
  await page.waitForFunction(
    () => document.querySelectorAll(".copilot-prose ol").length > 0,
    null,
    { timeout: 240000 }
  )
} catch {
  console.log("NO OL. transcript tail:")
  console.log((await page.locator('[role="log"]').innerText()).slice(-2000))
  await page.screenshot({ path: `${OUT}no-ol.png` })
  throw new Error("no ordered list")
}
await page.waitForTimeout(8000)

async function reopen(width) {
  await page.evaluate(
    (w) => localStorage.setItem("sb.copilotPanelWidth", String(w)),
    width
  )
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  await ensureAuth()
  await page.getByRole("button", { name: "Open the AI copilot" }).click()
  await page.locator('[data-slot="sheet-content"]').waitFor()
  await page.waitForTimeout(3500)
}

async function shoot(tag, before) {
  if (before) await page.addStyleTag({ content: BEFORE_CSS })
  await page.evaluate(() => {
    document
      .querySelector(".copilot-prose ol")
      ?.scrollIntoView({ block: "center" })
  })
  await page.mouse.move(700, 500)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}${tag}.png` })
}

async function probe(label) {
  const data = await page.evaluate(() => {
    const lists = [
      ...document.querySelectorAll(".copilot-prose ol, .copilot-prose ul"),
    ]
    return {
      lists: lists.map((l) => {
        const cs = getComputedStyle(l)
        const items = [...l.querySelectorAll(":scope > li")]
        return {
          tag: l.tagName,
          items: items.length,
          pos: cs.listStylePosition,
          pad: cs.paddingInlineStart,
          type: cs.listStyleType,
          left: Math.round(l.getBoundingClientRect().left),
          liDisplay: items[0] ? getComputedStyle(items[0]).display : null,
          // A second, CSS-painted marker would show up here.
          pseudoBefore: items.map(
            (n) => getComputedStyle(n, "::before").content
          ),
          firstItem: items[0]?.textContent.slice(0, 40),
        }
      }),
      panelLeft: Math.round(
        document
          .querySelector('[data-slot="sheet-content"]')
          ?.getBoundingClientRect().left ?? -1
      ),
      transcriptPad: (() => {
        const el = document.querySelector('[role="log"] > div > div')
        const cs = el && getComputedStyle(el)
        return cs ? `${cs.paddingLeft}/${cs.paddingRight}` : null
      })(),
    }
  })
  console.log(`--- ${label}`, JSON.stringify(data, null, 1))
}

await probe("panel 380")
await shoot("after-panel-380", false)
await shoot("before-panel-380", true)

// 45vw of 1440 = 648.
await reopen(648)
await probe("panel 648")
await shoot("after-panel-648", false)
await shoot("before-panel-648", true)

await page.goto("http://localhost:3000/app/copilot", {
  waitUntil: "domcontentloaded",
})
await page.waitForTimeout(6000)
await probe("full page")
await shoot("after-page", false)
await shoot("before-page", true)

await browser.close()

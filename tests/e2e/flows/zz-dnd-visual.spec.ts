import { expect, test } from "@playwright/test"
import { ORGANIZER_STATE, gotoApp } from "./_helpers"

const OUT =
  "/private/tmp/claude-501/-Users-markokraemer-Projects-kortix-sessionboard/118b76be-7bc9-4385-b170-00baeb55f0ff/scratchpad/shots"

test.use({ storageState: ORGANIZER_STATE, viewport: { width: 1560, height: 980 } })

const GHOST = '[data-slot="agenda-drop-ghost"]'
const CHIP = '[data-slot="agenda-drag-chip"]'

test("keyboard drag visuals + overshoot", async ({ page }) => {
  test.setTimeout(180_000)
  await gotoApp(page, "/app/agenda?view=day")
  await expect(page.locator("[data-room]").first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1200)
  await page.locator('[data-slot="agenda-grid-block"]').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  const block = page.locator('[data-slot="agenda-grid-block"] button').first()
  await block.focus()
  await page.keyboard.press("Enter")
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/k1-grab.png` })
  console.log("grab chip:", await page.locator(CHIP).first().innerText().catch(() => "NONE"))

  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/k2-moved.png` })
  console.log("moved chip:", (await page.locator(CHIP).first().innerText().catch(() => "NONE")).replace(/\n/g, " | "))
  console.log("announcer:", await page.locator('[data-slot="agenda-drag-announcer"]').first().innerText())

  // Overshoot: slam into the end of the day, then one press back must move.
  for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowDown")
  await page.waitForTimeout(300)
  const pinned = (await page.locator(CHIP).first().innerText()).split("\n")[0]
  await page.keyboard.press("ArrowUp")
  await page.waitForTimeout(300)
  const afterUp = (await page.locator(CHIP).first().innerText()).split("\n")[0]
  console.log("OVERSHOOT pinned:", pinned, "|| one ArrowUp:", afterUp)
  expect(afterUp, "one ArrowUp after overshooting must move a slot").not.toBe(pinned)
  await page.screenshot({ path: `${OUT}/k3-overshoot.png` })

  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  await expect(page.locator(GHOST)).toHaveCount(0)
})

for (const view of ["week", "track", "rooms"] as const) {
  test(`${view} view drag: ghost + chip`, async ({ page }) => {
    test.setTimeout(180_000)
    await gotoApp(page, `/app/agenda?view=${view}`)
    await page.waitForTimeout(2000)
    const block = page.locator('[data-slot="agenda-grid-block"], [data-slot="agenda-lane-block"]').first()
    const n = await page.locator('[data-slot="agenda-grid-block"], [data-slot="agenda-lane-block"]').count()
    console.log(`${view}: blocks=`, n)
    if (n === 0) {
      await page.screenshot({ path: `${OUT}/v-${view}-empty.png` })
      test.skip(true, "no blocks in this view")
      return
    }
    await block.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    const btn = block.locator("button").first()
    await btn.focus()
    await page.keyboard.press("Enter")
    await page.waitForTimeout(400)
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/v-${view}.png` })
    console.log(`${view} ghosts=`, await page.locator(GHOST).count(), "chip=", (await page.locator(CHIP).first().innerText().catch(() => "NONE")).replace(/\n/g, " | "))
    await page.keyboard.press("Escape")
    await page.waitForTimeout(200)
  })
}

test("pointer drag: ghost, chip, conflict, off-grid, settle", async ({ page }) => {
  test.setTimeout(180_000)
  await gotoApp(page, "/app/agenda?view=day")
  await expect(page.locator("[data-room]").first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  await page.locator('[data-slot="agenda-grid-block"]').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/p0-rest.png` })

  const source = page.locator('[data-slot="agenda-grid-block"]').first()
  const box = (await source.boundingBox())!
  const columns = page.locator("[data-room]")
  const colCount = await columns.count()
  const targetCol = (await columns.nth(Math.min(1, colCount - 1)).boundingBox())!

  await page.mouse.move(box.x + box.width / 2, box.y + 14)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + 26, { steps: 4 })
  await page.mouse.move(targetCol.x + targetCol.width / 2, box.y + 250, { steps: 12 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/p1-ghost-clean.png` })
  console.log("clean ghost conflicted:", await page.locator(GHOST).first().getAttribute("data-conflicted"))
  console.log("clean chip:", (await page.locator(CHIP).first().innerText()).replace(/\n/g, " | "))

  // Steer onto an existing session in that column → conflict pre-warning.
  const all = page.locator('[data-slot="agenda-grid-block"]')
  const count = await all.count()
  for (let i = 0; i < count; i++) {
    const b = await all.nth(i).boundingBox()
    if (!b) continue
    if (b.x > targetCol.x - 5 && b.x < targetCol.x + targetCol.width) {
      await page.mouse.move(targetCol.x + targetCol.width / 2, b.y + 8, { steps: 10 })
      break
    }
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/p2-conflict.png` })
  console.log("conflict ghost:", await page.locator(GHOST).first().getAttribute("data-conflicted"))

  // Off the grid: the card must stay in hand, the chip must explain.
  const tray = page.getByRole("complementary", { name: /not scheduled/i })
  const trayBox = await tray.boundingBox()
  if (trayBox) {
    await page.mouse.move(trayBox.x + trayBox.width - 20, trayBox.y + 130, { steps: 10 })
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${OUT}/p3-off-grid.png` })
    console.log("off-grid ghost=", await page.locator(GHOST).count(), "chip=", (await page.locator(CHIP).first().innerText()).replace(/\n/g, " | "))
    const clipped = await page.locator(CHIP).first().evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { right: Math.round(r.right), win: window.innerWidth, bottom: Math.round(r.bottom), winH: window.innerHeight }
    })
    console.log("chip bounds:", JSON.stringify(clipped))
    expect(clipped.right, "chip must stay inside the viewport").toBeLessThanOrEqual(clipped.win)
  }

  // Back on grid, drop, settle.
  await page.mouse.move(targetCol.x + targetCol.width / 2, box.y + 320, { steps: 12 })
  await page.waitForTimeout(300)
  await page.mouse.up()
  await page.waitForTimeout(110)
  await page.screenshot({ path: `${OUT}/p4-settle-early.png` })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/p5-settled.png` })

  // Resize.
  const rb = (await page.locator('[data-slot="agenda-grid-block"]').first().boundingBox())!
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height - 1)
  await page.waitForTimeout(200)
  await page.mouse.down()
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height + 50, { steps: 10 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/p6-resize.png` })
  console.log("resize chip:", await page.locator('[data-slot="agenda-resize-chip"]').first().innerText())
  await page.mouse.up()
  await page.waitForTimeout(700)
})

test("edge auto-scroll: dragging to the bottom edge scrolls the grid", async ({ page }) => {
  test.setTimeout(180_000)
  await gotoApp(page, "/app/agenda?view=day")
  await expect(page.locator("[data-room]").first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)

  const scroller = page.locator('[data-room]').first().evaluateHandle
  const before = await page.evaluate(() => {
    const col = document.querySelector("[data-room]")
    let el: HTMLElement | null = col as HTMLElement
    while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement
    return el ? { top: el.scrollTop, max: el.scrollHeight - el.clientHeight } : null
  })
  console.log("scroller before:", JSON.stringify(before))

  const block = page.locator('[data-slot="agenda-grid-block"]').first()
  await block.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const box = (await block.boundingBox())!
  const col = (await page.locator("[data-room]").first().boundingBox())!

  await page.mouse.move(box.x + box.width / 2, box.y + 14)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + 30, { steps: 4 })
  // Park near the bottom edge of the scroll port and let auto-scroll run.
  const bottomEdge = Math.min(col.y + col.height, page.viewportSize()!.height) - 30
  await page.mouse.move(box.x + box.width / 2, bottomEdge, { steps: 10 })
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(box.x + box.width / 2, bottomEdge + (i % 2), { steps: 1 })
    await page.waitForTimeout(90)
  }
  const after = await page.evaluate(() => {
    const c = document.querySelector("[data-room]")
    let el: HTMLElement | null = c as HTMLElement
    const chain: Array<string> = []
    while (el) {
      if (el.scrollHeight > el.clientHeight + 2) {
        chain.push(`${el.tagName}.${el.className.slice(0, 40)} top=${el.scrollTop} max=${el.scrollHeight - el.clientHeight}`)
      }
      el = el.parentElement
    }
    return { chain, windowY: window.scrollY, doc: document.scrollingElement?.scrollTop }
  })
  console.log("scroll chain after:", JSON.stringify(after, null, 1))
  await page.screenshot({ path: `${OUT}/a1-autoscroll.png` })
  await page.mouse.up()
  await page.waitForTimeout(500)
  expect(after!, "auto-scroll must move the grid at the bottom edge").toBeGreaterThan(
    (before?.top ?? 0),
  )
})

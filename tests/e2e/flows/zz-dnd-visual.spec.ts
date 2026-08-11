import { expect, test } from "@playwright/test"
import { ORGANIZER_STATE, gotoApp } from "./_helpers"

const OUT = "/private/tmp/claude-501/-Users-markokraemer-Projects-kortix-sessionboard/118b76be-7bc9-4385-b170-00baeb55f0ff/scratchpad/shots"

test.use({ storageState: ORGANIZER_STATE, viewport: { width: 1560, height: 980 } })

test("visual deep-check: pointer drag ghost + chip + conflict + settle", async ({ page }) => {
  test.setTimeout(180_000)
  await gotoApp(page, "/app/agenda?view=day")
  await page.locator('[data-testid="tanstack_devtools"]').evaluateAll((els) =>
    els.forEach((e) => ((e as HTMLElement).style.display = "none")),
  ).catch(() => {})

  await expect(page.locator("[data-room]").first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)

  // Scroll the grid so the programme is on screen.
  const firstBlock = page.locator('[data-slot="agenda-grid-block"]').first()
  await firstBlock.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/00-rest.png` })

  const blocks = page.locator('[data-slot="agenda-grid-block"]')
  const count = await blocks.count()
  console.log("grid blocks:", count)

  const source = blocks.first()
  const box = (await source.boundingBox())!
  console.log("source box", box)

  // Target: a slot inside the SECOND room column, ~90 min below the source.
  const columns = page.locator("[data-room]")
  const colCount = await columns.count()
  console.log("columns:", colCount)
  const targetCol = (await columns.nth(Math.min(1, colCount - 1)).boundingBox())!

  await page.mouse.move(box.x + box.width / 2, box.y + 14)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + 26, { steps: 4 })
  await page.mouse.move(targetCol.x + targetCol.width / 2, box.y + 120, { steps: 12 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-ghost-chip.png` })

  const ghost = page.locator('[data-slot="agenda-drop-ghost"]')
  const chip = page.locator('[data-slot="agenda-drag-chip"]')
  console.log("ghost count mid-drag:", await ghost.count(), "chip:", await chip.count())
  if (await chip.count()) console.log("chip text:", (await chip.first().innerText()).replace(/\n/g, " | "))
  if (await ghost.count()) console.log("ghost conflicted:", await ghost.first().getAttribute("data-conflicted"))

  // Now steer onto an EXISTING session in that column to trigger the conflict tint.
  const others = page.locator('[data-slot="agenda-grid-block"]')
  const n = await others.count()
  let conflictY: number | null = null
  for (let i = 0; i < n; i++) {
    const b = await others.nth(i).boundingBox()
    if (!b) continue
    if (b.x > targetCol.x - 5 && b.x < targetCol.x + targetCol.width) {
      conflictY = b.y + 6
      break
    }
  }
  console.log("conflict target y:", conflictY)
  if (conflictY !== null) {
    await page.mouse.move(targetCol.x + targetCol.width / 2, conflictY, { steps: 10 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/02-conflict.png` })
    console.log("ghost conflicted now:", await ghost.first().getAttribute("data-conflicted").catch(() => "n/a"))
    if (await chip.count()) console.log("conflict chip:", (await chip.first().innerText()).replace(/\n/g, " | "))
  }

  // Drag off the grid entirely (over the tray) — the floating card must survive.
  const tray = page.getByRole("complementary", { name: /not scheduled/i })
  const trayBox = await tray.boundingBox()
  if (trayBox) {
    await page.mouse.move(trayBox.x + trayBox.width / 2, trayBox.y + 120, { steps: 10 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/03-off-grid.png` })
    const overlay = await page.evaluate(() => {
      const el = document.querySelector('[data-dnd-kit-drag-overlay], [style*="pointer-events: none"]')
      return !!el
    })
    console.log("off-grid: ghost=", await ghost.count(), "chip=", await chip.count(), "overlay-ish=", overlay)
    console.log("dnd overlay html present:", await page.locator('body > div[style*="position: fixed"]').count())
  }

  // Back onto the grid and drop.
  await page.mouse.move(targetCol.x + targetCol.width / 2, box.y + 200, { steps: 12 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04-before-drop.png` })
  await page.mouse.up()
  await page.waitForTimeout(120)
  await page.screenshot({ path: `${OUT}/05-settle-early.png` })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/06-settled.png` })

  // ——— Keyboard path ————————————————————————————————————————————————
  const trayCard = page.getByRole("button", { name: /schedule this session/i }).first()
  if (await trayCard.count()) {
    await trayCard.focus()
    await page.keyboard.press("Enter")
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/07-keyboard-grab.png` })
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/08-keyboard-moved.png` })
    console.log("kb chip:", await chip.first().innerText().catch(() => "none"))
    console.log("announcer:", await page.locator('[data-slot="agenda-drag-announcer"]').first().innerText().catch(() => "none"))
    // Overshoot test: push far past the window end, then come back one step.
    for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowDown")
    await page.waitForTimeout(300)
    const pinned = await chip.first().innerText().catch(() => "")
    await page.keyboard.press("ArrowUp")
    await page.waitForTimeout(300)
    const afterUp = await chip.first().innerText().catch(() => "")
    console.log("OVERSHOOT pinned:", pinned.replace(/\n/g, " | "), "|| afterOneUp:", afterUp.replace(/\n/g, " | "))
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
  }

  // ——— Resize ————————————————————————————————————————————————————————
  const rb = (await page.locator('[data-slot="agenda-grid-block"]').first().boundingBox())!
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height - 1)
  await page.waitForTimeout(200)
  await page.mouse.down()
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height + 40, { steps: 10 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/09-resize.png` })
  console.log("resize chip:", await page.locator('[data-slot="agenda-resize-chip"]').first().innerText().catch(() => "none"))
  await page.mouse.up()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/10-resized.png` })
})

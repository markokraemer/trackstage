import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import {
  ORGANIZER_STATE,
  assertNoErrorBoundary,
  demoFixtures,
  watchConsole,
} from "./utils"

const PUBLIC_SURFACES = [
  "/",
  "/login",
  "/docs",
  "/docs/api",
  "/docs/mcp",
  "/submit/ai-engineer/ai-summit-2026/cfp",
  "/e/ai-engineer/ai-summit-2026",
  "/e/ai-engineer/ai-summit-2026/sessions",
  "/e/ai-engineer/ai-summit-2026/speakers",
] as const

const ORGANIZER_SURFACES = [
  "/app/ai-engineer/ai-summit-2026",
  "/app/ai-engineer/ai-summit-2026/submissions",
  "/app/ai-engineer/ai-summit-2026/forms",
  "/app/ai-engineer/ai-summit-2026/evaluation",
  "/app/ai-engineer/ai-summit-2026/agenda",
  "/app/ai-engineer/ai-summit-2026/speakers",
  "/app/ai-engineer/ai-summit-2026/files",
  "/app/ai-engineer/ai-summit-2026/communications",
  "/app/ai-engineer/ai-summit-2026/embeds",
  "/app/ai-engineer/ai-summit-2026/settings",
  "/app/ai-engineer/workspace",
  "/app/account",
  "/app/copilot",
] as const

const MOBILE_PUBLIC_SURFACES = [
  "/",
  "/login",
  "/submit/ai-engineer/ai-summit-2026/cfp",
  "/e/ai-engineer/ai-summit-2026",
  "/e/ai-engineer/ai-summit-2026/sessions",
] as const

const MOBILE_ORGANIZER_SURFACES = [
  "/app/ai-engineer/ai-summit-2026",
  "/app/ai-engineer/ai-summit-2026/submissions",
  "/app/ai-engineer/ai-summit-2026/agenda",
  "/app/ai-engineer/ai-summit-2026/speakers",
] as const

async function loadStable(page: Page, route: string) {
  const watcher = watchConsole(page)
  const response = await page.goto(route, { waitUntil: "networkidle" })
  expect(response?.status() ?? 0, `${route} should load`).toBeLessThan(400)
  await page.waitForTimeout(250)
  await assertNoErrorBoundary(page, route)
  watcher.assertClean(route)
}

async function assertNoHighImpactViolations(page: Page, route: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  const highImpact = result.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical"
  )

  expect(
    highImpact.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target.join(" ")),
    })),
    `${route} has serious or critical WCAG violations`
  ).toEqual([])
}

test.describe("WCAG smoke — public surfaces", () => {
  for (const route of PUBLIC_SURFACES) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await loadStable(page, route)
      await assertNoHighImpactViolations(page, route)
    })
  }
})

test.describe("WCAG smoke — organizer surfaces", () => {
  test.use({ storageState: ORGANIZER_STATE })

  for (const route of ORGANIZER_SURFACES) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await loadStable(page, route)
      await assertNoHighImpactViolations(page, route)
    })
  }
})

test.describe("WCAG smoke — token personas", () => {
  test("speaker portal has no serious or critical violations", async ({
    page,
  }) => {
    const { portalToken } = await demoFixtures()
    test.skip(!portalToken, "no seeded portal token")
    const route = `/portal/t/${portalToken}`
    await loadStable(page, route)
    await assertNoHighImpactViolations(page, route)
  })

  test("reviewer page has no serious or critical violations", async ({
    page,
  }) => {
    const { reviewToken } = await demoFixtures()
    test.skip(!reviewToken, "no seeded reviewer token")
    const route = `/review/${reviewToken}`
    await loadStable(page, route)
    await assertNoHighImpactViolations(page, route)
  })
})

async function assertMobileSurface(page: Page, route: string) {
  await loadStable(page, route)
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(
    dimensions.scrollWidth,
    `${route} should not overflow the page horizontally`
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  await assertNoHighImpactViolations(page, `${route} at 390px`)
}

test.describe("mobile viewport — public surfaces", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  for (const route of MOBILE_PUBLIC_SURFACES) {
    test(`${route} fits a 390px viewport`, async ({ page }) => {
      await assertMobileSurface(page, route)
    })
  }
})

test.describe("mobile viewport — organizer surfaces", () => {
  test.use({
    storageState: ORGANIZER_STATE,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  for (const route of MOBILE_ORGANIZER_SURFACES) {
    test(`${route} fits a 390px viewport`, async ({ page }) => {
      await assertMobileSurface(page, route)
    })
  }
})

test.describe("keyboard focus", () => {
  for (const route of [
    "/login",
    "/submit/ai-engineer/ai-summit-2026/cfp",
  ] as const) {
    test(`${route} exposes a visible keyboard focus target`, async ({
      page,
    }) => {
      await loadStable(page, route)
      await page.keyboard.press("Tab")
      const focused = page.locator(":focus")
      await expect(focused).toBeVisible()
      await expect(focused).not.toHaveJSProperty("tagName", "BODY")
    })
  }
})

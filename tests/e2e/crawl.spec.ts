import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  ORGANIZER_STATE,
  assertNoErrorBoundary,
  demoFixtures,
  watchConsole,
} from "./utils"

/**
 * Route crawler — the deep net. Visits every route in the app across all
 * three personas and fails on ANY console error, uncaught exception, error
 * boundary, or unexpected 404. When a slice adds a route, add it here.
 *
 * Routes still being built by the slice workflow live in PENDING — the
 * crawler visits them, tolerates a 404, but still fails on crashes. Move
 * them to LIVE as slices land (integration duty).
 */

const PUBLIC_LIVE = [
  "/",
  "/login",
  "/design-system",
  "/submit/cfp",
  "/e/ai-summit-2026",
  "/e/ai-summit-2026/speakers",
  "/e/ai-summit-2026/sessions",
  "/portal",
]
const PUBLIC_PENDING: string[] = []
const APP_LIVE = [
  "/app",
  "/app/submissions",
  "/app/forms",
  "/app/evaluation",
  "/app/agenda",
  "/app/speakers",
  "/app/communications",
  "/app/settings",
  "/app/events",
  "/app/embeds",
]
const APP_PENDING: string[] = []

async function visit(
  page: Page,
  route: string,
  { allow404 }: { allow404: boolean },
) {
  const watcher = watchConsole(page)
  const response = await page.goto(route, { waitUntil: "networkidle" })
  const status = response?.status() ?? 0
  if (!allow404) {
    expect(status, `${route} should not 404`).toBeLessThan(400)
  }
  await page.waitForTimeout(400) // let hydration + reactive queries settle
  await assertNoErrorBoundary(page, route)
  watcher.assertClean(route)
}

test.describe("public routes", () => {
  for (const route of PUBLIC_LIVE) {
    test(`renders clean: ${route}`, async ({ page }) => {
      await visit(page, route, { allow404: false })
    })
  }
  for (const route of PUBLIC_PENDING) {
    test(`no crash (pending build): ${route}`, async ({ page }) => {
      await visit(page, route, { allow404: true })
    })
  }
})

test.describe("organizer routes", () => {
  test.use({ storageState: ORGANIZER_STATE })
  for (const route of APP_LIVE) {
    test(`renders clean: ${route}`, async ({ page }) => {
      await visit(page, route, { allow404: false })
    })
  }
  for (const route of APP_PENDING) {
    test(`no crash (pending build): ${route}`, async ({ page }) => {
      await visit(page, route, { allow404: true })
    })
  }
})

test.describe("token personas", () => {
  test("speaker portal via magic link renders clean", async ({ page }) => {
    const { portalToken } = await demoFixtures()
    test.skip(!portalToken, "no seeded portal token")
    await visit(page, `/portal/t/${portalToken}`, { allow404: false })
  })

  test("evaluator review via magic link renders clean", async ({ page }) => {
    const { reviewToken } = await demoFixtures()
    test.skip(!reviewToken, "no seeded evaluator token")
    await visit(page, `/review/${reviewToken}`, { allow404: false })
  })
})

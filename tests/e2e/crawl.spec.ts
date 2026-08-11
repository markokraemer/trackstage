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
  // Canonical hierarchical addresses (docs/memory/DECISIONS.md, "URL
  // architecture is fully hierarchical") …
  "/submit/ai-engineer/ai-summit-2026/cfp",
  "/e/ai-engineer/ai-summit-2026",
  "/e/ai-engineer/ai-summit-2026/speakers",
  "/e/ai-engineer/ai-summit-2026/speakers?view=list",
  "/e/ai-engineer/ai-summit-2026/sessions",
  "/e/ai-engineer/ai-summit-2026/my-schedule",
  "/e/ai-engineer/ai-summit-2026?view=rooms",
  // … every LEGACY shape ever printed (each 307s to canonical) …
  "/submit/ai-summit-2026/cfp",
  "/submit/cfp",
  "/e/ai-summit-2026",
  "/e/ai-summit-2026/speakers",
  // The same pages as embeddable widgets, and an event whose programme is
  // still a draft (must read "Schedule coming soon", not crash).
  "/e/ai-engineer/ai-summit-2026/sessions?embed=true",
  "/e/ai-engineer/design-systems-day",
  "/e/design-systems-day",
  "/portal",
]
const PUBLIC_PENDING: string[] = []
const APP_LIVE = [
  // Canonical event-scoped organizer addresses …
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
  // … the bare LEGACY paths (each redirects via the stored pointer) …
  "/app",
  "/app/submissions",
  "/app/forms",
  "/app/evaluation",
  "/app/agenda",
  "/app/speakers",
  "/app/communications",
  "/app/settings",
  "/app/workspace",
  "/app/embeds",
  // … and the global pages.
  "/app/events",
  "/app/account",
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

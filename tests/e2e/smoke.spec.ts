import { expect, test } from "@playwright/test"
import {
  DEMO_ORGANIZER,
  ORGANIZER_STATE,
  assertNoErrorBoundary,
  watchConsole,
} from "./utils"

test.describe("landing + design system", () => {
  test("landing shows the three demo entry points", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/")
    await expect(page.getByText(/organizer demo/i).first()).toBeVisible()
    await expect(page.getByText(/speaker portal/i).first()).toBeVisible()
    await expect(page.getByText(/submit a talk/i).first()).toBeVisible()
    watcher.assertClean("/")
  })

  test("design system renders brand + components", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/design-system")
    await expect(page.getByText(/#2F5CE0/i).first()).toBeVisible()
    await assertNoErrorBoundary(page, "/design-system")
    watcher.assertClean("/design-system")
  })
})

test.describe("organizer auth flow", () => {
  test("wrong password shows a friendly error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").first().fill(DEMO_ORGANIZER.email)
    await page.getByLabel("Password").first().fill("definitely-wrong")
    await page.getByRole("button", { name: /^sign in$/i }).first().click()
    await expect(page.getByText(/couldn't sign you in/i).first()).toBeVisible()
  })

  test("demo credentials one-click fill works", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: /use these/i }).first().click()
    await expect(page.getByLabel("Email").first()).toHaveValue(DEMO_ORGANIZER.email)
  })
})

test.describe("organizer shell", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("shell shows event context, nav, and user menu", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/app")
    await expect(page.getByText(/AI Engineer Summit 2026/i).first()).toBeVisible({
      timeout: 15_000,
    })
    for (const item of [
      "Dashboard",
      "Submissions",
      "Forms",
      "Evaluation",
      "Agenda",
      "Speakers",
      "Communications",
      "Settings",
    ]) {
      await expect(
        page.getByRole("link", { name: new RegExp(item, "i") }).first(),
      ).toBeVisible()
    }
    // User menu opens without Base UI context errors (regression: MenuGroupContext).
    await page.getByText(DEMO_ORGANIZER.email).first().click()
    await expect(page.getByText(/sign out/i).first()).toBeVisible()
    watcher.assertClean("/app shell")
  })
})

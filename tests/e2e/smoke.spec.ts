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

/**
 * Hierarchy: user → workspace → events (docs/memory/RULES.md 23). The sidebar
 * event block is the switcher, and the account menu carries the two settings
 * levels above the event.
 */
test.describe("hierarchy", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("event switcher lists every event and switching moves the shell", async ({
    page,
  }) => {
    const watcher = watchConsole(page)
    await page.goto("/app")

    const switcher = page.getByRole("button", { name: /switch event/i }).first()
    await expect(switcher).toBeVisible({ timeout: 15_000 })
    await expect(switcher).toContainText(/AI Engineer Summit 2026/i)

    await switcher.click()
    const summit = page
      .getByRole("menuitem", { name: /AI Engineer Summit 2026/i })
      .first()
    const designDay = page
      .getByRole("menuitem", { name: /Design Systems Day/i })
      .first()
    await expect(summit).toBeVisible()
    await expect(designDay).toBeVisible()

    await designDay.click()
    await expect(switcher).toContainText(/Design Systems Day/i, {
      timeout: 10_000,
    })

    // Put the shell back so the rest of the suite sees the seeded summit.
    await switcher.click()
    await page
      .getByRole("menuitem", { name: /AI Engineer Summit 2026/i })
      .first()
      .click()
    await expect(switcher).toContainText(/AI Engineer Summit 2026/i)

    watcher.assertClean("event switcher")
  })

  test("account menu reaches account and workspace settings", async ({
    page,
  }) => {
    const watcher = watchConsole(page)
    await page.goto("/app")
    await page.getByText(DEMO_ORGANIZER.email).first().click()
    await page
      .getByRole("menuitem", { name: /account settings/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/app\/account/)
    await expect(
      page.getByRole("heading", { name: /account settings/i }).first(),
    ).toBeVisible()
    watcher.assertClean("/app/account via menu")
  })

  test("account settings renders profile and password", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/app/account")
    await expect(
      page.getByRole("heading", { name: /account settings/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/your profile/i).first()).toBeVisible()
    await expect(page.getByLabel(/full name/i).first()).toBeVisible()
    await expect(page.getByLabel(/current password/i).first()).toBeVisible()
    await assertNoErrorBoundary(page, "/app/account")
    watcher.assertClean("/app/account")
  })

  test("workspace settings renders name and members", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/app/workspace")
    await expect(
      page.getByRole("heading", { name: /workspace settings/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByLabel(/workspace name/i).first()).toBeVisible()
    await expect(page.getByText(/members/i).first()).toBeVisible()
    await expect(
      page.getByRole("button", { name: /invite teammate/i }).first(),
    ).toBeVisible()
    await assertNoErrorBoundary(page, "/app/workspace")
    watcher.assertClean("/app/workspace")
  })

  test("event settings names the event it is editing", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/app/settings")
    await expect(
      page.getByRole("heading", { name: /event settings —/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole("link", { name: /workspace settings/i }).first(),
    ).toBeVisible()
    watcher.assertClean("/app/settings")
  })
})

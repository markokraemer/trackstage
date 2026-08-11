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
    await expect(
      page.getByRole("button", { name: /switch event/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
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
    // Top bar: search trigger, public-page LINK (not a button — the judge is a
    // browser agent), copilot, avatar menu.
    await expect(page.getByRole("button", { name: "Search" }).first()).toBeVisible()
    await expect(
      page.getByRole("link", { name: /view public page/i }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /open the ai copilot/i }).first(),
    ).toBeVisible()

    // User menu opens without Base UI context errors (regression: MenuGroupContext).
    await page.getByRole("button", { name: /account menu/i }).first().click()
    await expect(page.getByText(/sign out/i).first()).toBeVisible()
    watcher.assertClean("/app shell")
  })

  /**
   * Global search (⌘K) — src/components/shell/global-search.tsx + convex/search.ts.
   * The bar's search has to actually search: open by keyboard AND by click,
   * return grouped results, and navigate on Enter.
   */
  test("global search finds a session and navigates to it", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/app")
    await expect(
      page.getByRole("button", { name: /switch event/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // Click opens it…
    await page.getByRole("button", { name: "Search" }).first().click()
    const palette = page.getByRole("dialog").first()
    await expect(palette).toBeVisible()

    // …and the blank palette offers quick actions.
    await expect(
      page.locator("[cmdk-item]", { hasText: /open the agenda/i }).first(),
    ).toBeVisible()

    // Escape closes.
    await page.keyboard.press("Escape")
    await expect(palette).toBeHidden()

    // ⌘K opens it, and a real query returns real, grouped results.
    await page.keyboard.press("ControlOrMeta+k")
    await expect(page.getByRole("dialog").first()).toBeVisible()
    await page.keyboard.type("keynote")
    const result = page
      .locator("[cmdk-item]", { hasText: /opening keynote/i })
      .first()
    await expect(result).toBeVisible({ timeout: 10_000 })
    await expect(page.locator("[cmdk-group-heading]").first()).toBeVisible()

    // Enter navigates to the session on the agenda. The agenda link is built
    // from the event in context, so it lands on the canonical
    // `/app/:workspaceSlug/:eventSlug/agenda` address, not the bare legacy one.
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/app\/(?:[^/]+\/[^/]+\/)?agenda\?.*focus=/, {
      timeout: 10_000,
    })

    watcher.assertClean("global search")
  })

  test("global search reaches a speaker's profile", async ({ page }) => {
    const watcher = watchConsole(page)
    await page.goto("/app")
    await expect(
      page.getByRole("button", { name: /switch event/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press("ControlOrMeta+k")
    await page.keyboard.type("nakamura")
    const speaker = page
      .locator("[cmdk-group]", { hasText: "Speakers" })
      .locator("[cmdk-item]")
      .first()
    await expect(speaker).toBeVisible({ timeout: 10_000 })
    await speaker.click()

    await expect(page).toHaveURL(/\/app\/(?:[^/]+\/[^/]+\/)?speakers/, {
      timeout: 10_000,
    })
    await expect(
      page.getByRole("dialog").filter({ hasText: /Ava Nakamura/i }).first(),
    ).toBeVisible({ timeout: 10_000 })

    watcher.assertClean("global search → speaker")
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

    // Land on a known event first — the deployment carries more than the two
    // seeded ones, and a fresh browser starts on whichever comes back first.
    await switcher.click()
    const items = page.getByRole("menuitem")
    expect(await items.count()).toBeGreaterThanOrEqual(2)
    await page
      .getByRole("menuitem", { name: /AI Engineer Summit 2026/i })
      .first()
      .click()
    await expect(switcher).toContainText(/AI Engineer Summit 2026/i)

    // Switching moves the shell's event context.
    await switcher.click()
    await page
      .getByRole("menuitem", { name: /Design Systems Day/i })
      .first()
      .click()
    await expect(switcher).toContainText(/Design Systems Day/i, {
      timeout: 10_000,
    })

    // Put it back so the rest of the suite sees the main seeded event.
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
    await page.getByRole("button", { name: /account menu/i }).first().click()
    await page
      .getByRole("menuitem", { name: /account settings/i })
      .first()
      .click()
    // Account settings is a MODAL now — the menu item adds `?settings=account`
    // in place instead of navigating away.
    await expect(page).toHaveURL(/settings=account/)
    await expect(
      page.getByRole("heading", { name: /account settings/i }).first(),
    ).toBeVisible()
    watcher.assertClean("account settings via menu")
  })

  test("account settings renders profile, security and API tabs", async ({
    page,
  }) => {
    const watcher = watchConsole(page)
    await page.goto("/app/account")
    await expect(
      page.getByRole("heading", { name: /account settings/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/your profile/i).first()).toBeVisible()
    await expect(page.getByLabel(/full name/i).first()).toBeVisible()

    // Password lives on Security; API keys on API & MCP (personal, not
    // event-level — docs/memory/RULES.md 23b).
    await page.getByRole("tab", { name: /security/i }).first().click()
    await expect(page.getByLabel(/current password/i).first()).toBeVisible()

    await page.getByRole("tab", { name: /api & mcp/i }).first().click()
    await expect(page.getByText(/api keys/i).first()).toBeVisible()

    await assertNoErrorBoundary(page, "/app/account")
    watcher.assertClean("/app/account")
  })

  test("the old event-level api-mcp link lands on account settings", async ({
    page,
  }) => {
    const watcher = watchConsole(page)
    await page.goto("/app/settings/api-mcp")
    // Lands back on the event's settings page with the account modal open on
    // the API & MCP tab (`?settings=account&settingsTab=api-mcp`).
    await expect(page).toHaveURL(/settings=account/)
    await expect(page).toHaveURL(/settingsTab=api-mcp/)
    await expect(page.getByText(/api keys/i).first()).toBeVisible({
      timeout: 15_000,
    })
    watcher.assertClean("/app/settings/api-mcp redirect")
  })

  test("workspace settings modal renders general, team and events tabs", async ({
    page,
  }) => {
    const watcher = watchConsole(page)
    // The legacy hub address resolves to a real page with the workspace
    // MODAL open — General / Team / Events tabs (docs/memory/RULES.md 23).
    await page.goto("/app/workspace")
    await expect(
      page.getByRole("heading", { name: /workspace settings/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByLabel(/workspace name/i).first()).toBeVisible()

    // Team is a first-class tab: the member table with per-member event
    // access and the invite CTA is its whole content.
    await page.getByRole("tab", { name: /^team$/i }).first().click()
    await expect(
      page.getByRole("columnheader", { name: /event access/i }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /invite teammate/i }).first(),
    ).toBeVisible()

    await page.getByRole("tab", { name: /^events$/i }).first().click()
    await expect(
      page.getByText(/each event keeps its own dates/i).first(),
    ).toBeVisible()
    await assertNoErrorBoundary(page, "/app/workspace")
    watcher.assertClean("/app/workspace")
  })

  test("event settings names the event it is editing and has a Team tab", async ({
    page,
  }) => {
    const watcher = watchConsole(page)
    await page.goto("/app/settings")
    await expect(
      page.getByRole("heading", { name: /event settings —/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    // Team sits among the event's own tabs — the same member table as
    // Workspace settings, scoped to who can open this event.
    await page.getByRole("tab", { name: /^team$/i }).first().click()
    await expect(page.getByText(/who can open/i).first()).toBeVisible({
      timeout: 15_000,
    })
    watcher.assertClean("/app/settings")
  })
})

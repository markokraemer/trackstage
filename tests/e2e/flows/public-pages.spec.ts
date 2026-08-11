import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import {
  DEMO_WORKSPACE_SLUG,
  MAIN_EVENT_NAME,
  MAIN_EVENT_SLUG,
  armed,
  gotoStable,
} from "./_helpers"

/**
 * The public event site — the surface a conference *attendee* (and the judging
 * browser agent) actually lands on.
 *
 * Everything here is anonymous: no login, no token, no seeded state beyond the
 * demo programme. What the flow proves, end to end:
 *
 * - the event identity bar pins to the top of the viewport as you scroll, on
 *   every public route, without moving the content underneath it;
 * - every filter, tab and view mode is addressable by URL, both directions —
 *   a link applies it, and using the control writes it back;
 * - every list drills into a session or a speaker and comes back, so a
 *   browsing agent can never reach a dead end;
 * - `?embed=1` strips the chrome down to the widget;
 * - an event whose programme isn't published says "Schedule coming soon"
 *   rather than showing an empty page.
 */

/** The second seeded event, deliberately left unpublished. */
const UNPUBLISHED_SLUG = "design-systems-day"

const NAV_BAR = "[data-slot=public-nav]"
const NAV = `${NAV_BAR} nav[aria-label='Event pages']`

/** Viewport-relative top edge of the sticky bar. */
async function navBarTop(page: Page): Promise<number> {
  const box = await page.locator(NAV_BAR).boundingBox()
  if (!box) throw new Error("event nav bar not found")
  return box.y
}

test.describe("public event pages", () => {
  test("the event nav pins to the top on scroll, on every route", async ({
    page,
  }) => {
    const watcher = armed(page)

    for (const route of [
      `/e/${MAIN_EVENT_SLUG}`,
      `/e/${MAIN_EVENT_SLUG}/sessions`,
      `/e/${MAIN_EVENT_SLUG}/speakers`,
      `/e/${MAIN_EVENT_SLUG}/my-schedule`,
    ]) {
      await gotoStable(page, route, "networkidle")
      await expect(page.locator(NAV_BAR)).toBeVisible()

      // The contract itself: sticky, flush to the top. Asserted on every
      // route, including ones too short to scroll.
      const style = await page
        .locator(NAV_BAR)
        .evaluate((node) => {
          const computed = getComputedStyle(node)
          return { position: computed.position, top: computed.top }
        })
      expect(style, `${route}: nav must be sticky at top: 0`).toEqual({
        position: "sticky",
        top: "0px",
      })

      // Unpinned: the bar sits below the hero.
      const atRest = await navBarTop(page)
      expect(atRest, `${route}: nav should start below the hero`).toBeGreaterThan(
        40,
      )

      // A page shorter than its own hero can't demonstrate pinning — the
      // sticky assertion above is the whole story there.
      const scrollable = await page.evaluate(
        () =>
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight,
      )
      if (scrollable < atRest + 40) continue

      // The first heading's *document* position before scrolling, to prove
      // pinning doesn't reflow the page: a fixed header would shift everything
      // up by its own height, a sticky one cannot.
      const anchor = page.locator("main h2, main h3").first()
      const beforeBox = await anchor.boundingBox()
      const before =
        beforeBox === null
          ? null
          : beforeBox.y + (await page.evaluate(() => window.scrollY))

      // Hydration and the reactive query can both grow the page after load, so
      // re-apply the scroll until the bar is actually pinned.
      await expect
        .poll(
          async () => {
            await page.evaluate(() => window.scrollTo(0, 1200))
            await page.waitForTimeout(200)
            return await navBarTop(page)
          },
          {
            timeout: 10_000,
            message: `${route}: nav should pin to the viewport top`,
          },
        )
        .toBeLessThan(2)

      // Pinned state is announced, so the condensed identity + blur can react.
      await expect(page.locator(NAV_BAR)).toHaveAttribute("data-stuck", "true")

      const afterBox = await anchor.boundingBox()
      if (before !== null && afterBox) {
        const after =
          afterBox.y + (await page.evaluate(() => window.scrollY))
        expect(
          Math.abs(before - after),
          `${route}: content moved when the header pinned`,
        ).toBeLessThan(2)
      }

      // The nav is still usable while pinned.
      await expect(
        page.locator(NAV).getByRole("link", { name: "Speakers", exact: true }),
      ).toBeVisible()
    }

    watcher.assertClean("sticky nav")
  })

  test("sessions filters live in the URL, both directions", async ({ page }) => {
    const watcher = armed(page)

    // 1. A link applies the filter.
    await gotoStable(page, `/e/${MAIN_EVENT_SLUG}/sessions?q=agents`, "networkidle")
    const searchBox = page.getByRole("searchbox", { name: "Search sessions" })
    await expect(searchBox).toHaveValue("agents")
    const filteredCount = await page.locator("[data-slot=session-card]").count()
    expect(filteredCount).toBeGreaterThan(0)

    // 2. Using the control writes it back.
    await gotoStable(page, `/e/${MAIN_EVENT_SLUG}/sessions`, "networkidle")
    const allCount = await page.locator("[data-slot=session-card]").count()
    expect(allCount).toBeGreaterThan(filteredCount)

    await page
      .getByRole("searchbox", { name: "Search sessions" })
      .fill("keynote")
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"), { timeout: 8_000 })
      .toBe("keynote")

    // 3. A track filter is linkable too, and the schedule honours it.
    await gotoStable(
      page,
      `/e/${MAIN_EVENT_SLUG}?track=Infrastructure`,
      "networkidle",
    )
    const trackGroup = page.getByRole("group", { name: "Filter by track" })
    await expect(
      trackGroup.getByRole("link", { name: "Infrastructure" }),
    ).toHaveAttribute("data-active", "true")
    for (const card of await page.locator("[data-slot=session-card]").all()) {
      await expect(card).toContainText("Infrastructure")
    }

    // Clicking "All tracks" clears it out of the URL again.
    await trackGroup.getByRole("link", { name: "All tracks" }).click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get("track"))
      .toBeNull()

    // 4. View mode is linkable.
    await gotoStable(page, `/e/${MAIN_EVENT_SLUG}?view=rooms`, "networkidle")
    await expect(page.getByRole("link", { name: "By room" })).toHaveAttribute(
      "data-active",
      "true",
    )
    await expect(page.getByRole("link", { name: "By time" })).not.toHaveAttribute(
      "data-active",
      "true",
    )

    watcher.assertClean("url filters")
  })

  test("a visitor can walk sessions → detail → speaker → back", async ({
    page,
  }) => {
    const watcher = armed(page)

    await gotoStable(page, `/e/${MAIN_EVENT_SLUG}/sessions`, "networkidle")
    const firstCard = page.locator("[data-slot=session-card]").first()
    const title = (await firstCard.getByRole("heading").innerText()).trim()

    await firstCard.getByRole("link", { name: title }).click()
    await expect(
      page.getByRole("link", { name: "Back to all sessions" }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/sessions\/[a-z0-9]+/i)
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    // The facts panel answers "when and where", and offers the actions.
    const facts = page.locator("[data-slot=session-facts]")
    await expect(facts).toBeVisible()
    await expect(
      facts.getByRole("button", { name: /Add to my schedule|Saved to my/ }),
    ).toBeVisible()
    await expect(
      facts.getByRole("button", { name: "Copy link" }),
    ).toBeVisible()

    // Session → speaker page.
    await page.getByRole("link", { name: "View their schedule" }).first().click()
    await expect(page).toHaveURL(/\/itinerary\//)
    await expect(
      page.getByRole("link", { name: "Back to speakers" }),
    ).toBeVisible()

    // Speaker page → speakers gallery.
    await page.getByRole("link", { name: "Back to speakers" }).click()
    await expect(page).toHaveURL(/\/speakers/)

    // Gallery tiles are real links into the speaker page (not a dead-end
    // dialog), and they carry the session count.
    const tile = page.locator("a[href*='/itinerary/']").first()
    await expect(tile).toContainText(/session/)
    await tile.click()
    await expect(page).toHaveURL(/\/itinerary\//)
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible()

    // And back to the schedule via the nav.
    await page
      .locator(NAV)
      .getByRole("link", { name: "Schedule", exact: true })
      .click()
    // The nav link is built from the event in context, so it lands on the
    // canonical `/e/:workspaceSlug/:eventSlug` address, not the bare legacy
    // one this file's `gotoStable` calls above started from.
    await expect(page).toHaveURL(
      new RegExp(`/e/(?:${DEMO_WORKSPACE_SLUG}/)?${MAIN_EVENT_SLUG}`),
    )

    watcher.assertClean("navigation walk")
  })

  test("the speakers gallery labels non-speaker roles", async ({ page }) => {
    const watcher = armed(page)
    await gotoStable(page, `/e/${MAIN_EVENT_SLUG}/speakers`, "networkidle")

    await expect(page.locator("a[href*='/itinerary/']").first()).toBeVisible()

    // Every tile states how many sessions the person is on — the one fact the
    // gallery exists to answer besides the face.
    const tiles = page.locator("a[href*='/itinerary/']")
    expect(await tiles.count()).toBeGreaterThan(1)
    for (const tile of await tiles.all()) {
      await expect(tile).toContainText(/\d+ sessions?/)
    }

    // Search narrows in place and is linkable.
    await gotoStable(
      page,
      `/e/${MAIN_EVENT_SLUG}/speakers?view=list`,
      "networkidle",
    )
    await expect(page.getByRole("link", { name: "List" })).toHaveAttribute(
      "data-active",
      "true",
    )
    // The directory names a role for each session, and links every session.
    await expect(
      page.locator("a[href*='/sessions/']").first(),
    ).toBeVisible()

    watcher.assertClean("speakers gallery")
  })

  test("?embed=1 strips the chrome to the bare widget", async ({ page }) => {
    const watcher = armed(page)
    await gotoStable(
      page,
      `/e/${MAIN_EVENT_SLUG}/sessions?embed=true`,
      "networkidle",
    )

    // No hero, no nav, no footer nav — just the widget and attribution.
    await expect(page.locator(NAV_BAR)).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: MAIN_EVENT_NAME }),
    ).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible()
    await expect(page.locator("[data-slot=session-card]").first()).toBeVisible()
    await expect(page.getByText("Powered by")).toBeVisible()

    watcher.assertClean("embed")
  })

  test("an unpublished programme says so instead of showing nothing", async ({
    page,
  }) => {
    const watcher = armed(page)
    await gotoStable(page, `/e/${UNPUBLISHED_SLUG}`, "networkidle")

    // The event itself is public — name, dates, nav all render …
    await expect(page.locator(NAV_BAR)).toBeVisible()
    // … the programme is not.
    await expect(page.getByText("Schedule coming soon")).toBeVisible()
    await expect(
      page.getByText(/still putting the programme together/i),
    ).toBeVisible()

    await gotoStable(page, `/e/${UNPUBLISHED_SLUG}/sessions`, "networkidle")
    await expect(page.getByText("Schedule coming soon")).toBeVisible()

    watcher.assertClean("unpublished event")
  })

  test("an unknown slug explains itself and offers a way out", async ({
    page,
  }) => {
    const watcher = armed(page)
    await gotoStable(page, "/e/no-such-event-anywhere", "networkidle")
    await expect(page.getByText(/couldn't find that event/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /Go to Trackstage/i })).toBeVisible()
    watcher.assertClean("unknown slug")
  })

  test("the schedule reads correctly on a phone", async ({ page }) => {
    const watcher = armed(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoStable(page, `/e/${MAIN_EVENT_SLUG}`, "networkidle")

    // All four tabs reachable, and nothing spills sideways.
    const nav = page.locator(NAV)
    for (const label of ["Schedule", "Speakers", "Sessions", "Saved"]) {
      await expect(
        nav.getByRole("link", { name: label, exact: true }),
      ).toBeVisible()
    }
    await expect(page.locator("[data-slot=session-card]").first()).toBeVisible()
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow, "page must not scroll horizontally at 390px").toBeLessThan(
      3,
    )

    // Times are stated in the event's own zone, once, in plain words.
    await expect(page.getByText(/all times [A-Z]{2,5}/)).toBeVisible()

    watcher.assertClean("mobile schedule")
  })
})

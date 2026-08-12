import { expect, test } from "@playwright/test"
import {
  advance,
  armed,
  fillStable,
  gotoStable,
  testEmail,
  uiSignUp,
  unique,
} from "./_helpers"

/**
 * FIRST RUN, ARRIVING COLD — the journey that broke on production Safari
 * (Marko, 2026-08-12): sign up, click the confirmation email's link, land on
 * `/app`, and sit on an organizer shell full of skeletons that never resolved.
 * Only a manual reload produced the onboarding wizard.
 *
 * Three things went wrong at once, and this spec pins all three:
 *
 *   1. `useSession()` gated every authed Convex query on the browser's own
 *      `/api/auth/get-session` round trip. Better Auth gives that fetch no
 *      timeout and only re-drives it once a session already exists, so a
 *      stalled one (Safari parks fetches in the background tab a mail client
 *      opens) left the whole app pending FOREVER. It now seeds from the answer
 *      the SERVER already resolved, and re-asks on a bounded schedule.
 *   2. The "this is a fresh signup" hint lived in `sessionStorage`, which never
 *      crosses tabs — so it was missing in precisely the tab the email link
 *      opens, and the gate fell through to the organizer shell.
 *   3. Nothing bounded the undecided state.
 *
 * The emailed link itself is not browser-drivable (the token only exists inside
 * a delivered email), so the leg reproduced here is the one that actually broke:
 * **a cold `/app` load in a tab that has none of the signup tab's
 * `sessionStorage`** — which is exactly what that link produces — plus the
 * `?welcome=1` address the link now carries.
 */

const PASSWORD = "first-run-pw-1"
/** Generous next to the ~1.5s this takes, tight enough to fail "eternal". */
const ARRIVAL_BUDGET_MS = 12_000

test.describe("first run", () => {
  test("a cold arrival at /app reaches the onboarding wizard, not a stuck shell", async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const signupTab = await context.newPage()
    const watcher = armed(signupTab)

    const email = testEmail("first-run")
    await uiSignUp(
      signupTab,
      `First Run ${unique("f").slice(-5)}`,
      email,
      PASSWORD,
      { skipOnboarding: false },
    )
    await expect(
      signupTab.getByText(/welcome to trackstage/i).first(),
    ).toBeVisible({ timeout: 20_000 })
    watcher.assertClean("signup tab")

    // ——— The arrival the confirmation email produces ———————————————————————
    // A NEW tab: same cookies, empty sessionStorage. Before the fix this
    // painted the organizer shell and, whenever the session fetch stalled,
    // stayed there.
    const mailTab = await context.newPage()
    const mailWatcher = armed(mailTab)
    const startedAt = Date.now()
    await gotoStable(mailTab, "/app?welcome=1")

    await expect(
      mailTab.getByRole("heading", { name: /welcome to trackstage/i }),
    ).toBeVisible({ timeout: ARRIVAL_BUDGET_MS })
    const elapsed = Date.now() - startedAt

    // Whatever it showed on the way, it must not still be showing it.
    await expect(mailTab.locator("[aria-busy='true']")).toHaveCount(0)
    // …and it must be the takeover, which owns the screen: no shell chrome.
    await expect(
      mailTab.getByRole("button", { name: /switch event/i }),
    ).toHaveCount(0)

    mailWatcher.assertClean("cold arrival at /app")
    expect(
      elapsed,
      `cold arrival took ${elapsed}ms — the wizard must not wait on a round trip`,
    ).toBeLessThan(ARRIVAL_BUDGET_MS)

    // ——— And the wizard still works from that tab ————————————————————————
    // `fillStable` + `advance`, not a bare fill/click: `?welcome=1` means this
    // card is SERVER-rendered, so it is on screen a beat before it is
    // hydrated — the same property every SSR'd form in this app has, and the
    // reason those helpers exist.
    const workspaceField = mailTab.getByLabel(/workspace name/i)
    await expect(workspaceField).toBeVisible({ timeout: 10_000 })
    await fillStable(workspaceField, `Cold Arrival ${unique("w").slice(-5)}`)
    await advance(
      mailTab,
      /^continue$/i,
      mailTab.getByRole("heading", { name: /your event/i }),
    )

    await context.close()
  })
})

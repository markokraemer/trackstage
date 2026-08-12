import { expect, test } from "@playwright/test"
import { fillStable, gotoStable, unique } from "./_helpers"

/**
 * CONFIRMING AN ADDRESS — the promise on the card has to be true.
 *
 * Marko hit this on production: signing in to an existing, unconfirmed
 * account showed "We sent a confirmation link to …" and sent nothing. The
 * link had gone out at signup; a plain sign-in mails nothing, so the only way
 * forward was to guess at "Resend". `/confirm-email` now sends on arrival
 * whenever the GATE brought you there (no `?email=`), and the two paths are
 * pinned here:
 *
 *   1. signup (`?email=`) — Better Auth already mailed, so the page must NOT
 *      fire a second one;
 *   2. sign-in on an unconfirmed account — the gate lands here with no
 *      `?email=`, and the send must happen without a click.
 *
 * Addresses ending `@example.com` are born verified (exempt) and would never
 * see this page, so this spec uses a non-exempt domain. No mail leaves CI:
 * without RESEND_API_KEY every send settles as a preview.
 */

const PASSWORD = "confirm-email-pw-1"

/** Non-exempt on purpose — `@example.com` is born verified. */
function unverifiedEmail() {
  return `${unique("confirm")}@trackstage-test.dev`
}

test.describe("confirming an email address", () => {
  test("signing in to an unconfirmed account sends the link without a click", async ({
    page,
  }) => {
    const email = unverifiedEmail()

    // — Sign up: lands on /confirm-email carrying ?email=, and does NOT
    //   re-send (Better Auth mailed during signup).
    await gotoStable(page, "/login", "networkidle")
    await expect(async () => {
      await page.getByRole("tab", { name: /create account/i }).first().click()
      await expect(page.getByLabel(/your name/i).first()).toBeVisible({
        timeout: 2_000,
      })
    }).toPass({ timeout: 30_000 })
    await fillStable(page.getByLabel(/your name/i).first(), "Confirm Tester")
    await fillStable(page.getByLabel("Email").first(), email)
    await fillStable(page.getByLabel("Password").first(), PASSWORD)
    await page.getByRole("button", { name: /^create account$/i }).click()

    await expect(page.getByRole("heading", { name: /confirm your email/i })).toBeVisible(
      { timeout: 30_000 },
    )
    await expect(page.getByText(email, { exact: false })).toBeVisible()
    // The signup arrival carries the address in the URL, which is what tells
    // the page an email is already in flight.
    expect(new URL(page.url()).searchParams.get("email")).toBe(email)
    // Idle button ⇒ nothing was sent from here.
    await expect(page.getByRole("button", { name: /resend email/i })).toBeEnabled()

    // — Now the path that was broken: a fresh sign-in on that same
    //   unconfirmed account. The gate redirects to /confirm-email with NO
    //   ?email=, and the page must mail the link on its own.
    await page.context().clearCookies()
    await gotoStable(page, "/login", "networkidle")
    await fillStable(page.getByLabel("Email").first(), email)
    await fillStable(page.getByLabel("Password").first(), PASSWORD)
    await page.getByRole("button", { name: /^sign in$/i }).click()

    await expect(page.getByRole("heading", { name: /confirm your email/i })).toBeVisible(
      { timeout: 30_000 },
    )
    expect(new URL(page.url()).searchParams.get("email")).toBeNull()
    // The button flips to its sent state only after a send resolves — which
    // nobody clicked. That is the whole fix, observable.
    await expect(
      page.getByRole("button", { name: /sent — check your inbox/i }),
    ).toBeVisible({ timeout: 30_000 })
  })
})

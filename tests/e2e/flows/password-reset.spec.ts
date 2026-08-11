import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { armed, fillStable, gotoStable, signUpApi, testEmail, unique } from "./_helpers"

/**
 * "I forgot my password" — the one account-lifecycle flow that has to work for
 * a real customer on a Monday morning, and the one that leaks user data if it
 * is built naively.
 *
 * Three properties, all asserted through the real UI:
 *
 *   1. NON-DISCLOSURE. An address with an account and an address without one
 *      get byte-identical treatment: same receipt, same wording. A reset form
 *      that says "no such user" is an account-enumeration oracle.
 *   2. A DEAD LINK IS A PAGE, NOT A CRASH. Better Auth's callback redirects to
 *      /reset-password?error=INVALID_TOKEN when a link has expired or was
 *      already used, and that has to read like an apology with a way forward.
 *   3. A FORGED TOKEN IS REFUSED KINDLY. The token is only ever judged by the
 *      server; the page's job is to turn that refusal into plain English.
 *
 * The happy path's remaining leg (real emailed token → password actually
 * changed) is not browser-drivable — it needs the link out of a delivered
 * email — so it is covered end-to-end by the reset verification script instead:
 * request → preview log → callback → new password signs in → old one doesn't →
 * token can't be replayed.
 */

const RECEIPT = /check your email/i

/**
 * Open the reset card by URL. `?mode=forgot` exists precisely so this state
 * survives a reload (and can be linked to from the expired-link page) — which
 * also makes it the only entry point a spec can trust while the dev server is
 * hot-reloading under other agents' edits.
 */
async function openForgotMode(page: Page) {
  await gotoStable(page, "/login?mode=forgot", "networkidle")
  await expect(
    page.getByRole("heading", { name: /reset your password/i }),
  ).toBeVisible({ timeout: 30_000 })
}

async function requestReset(page: Page, email: string) {
  await fillStable(page.getByLabel("Email").first(), email)
  await page.getByRole("button", { name: /email me a reset link/i }).click()
  await expect(page.getByRole("heading", { name: RECEIPT })).toBeVisible({
    timeout: 20_000,
  })
}

test.describe("password reset", () => {
  test.describe.configure({ mode: "serial" })

  test("the same receipt whether or not the account exists", async ({ page }) => {
    const watcher = armed(page)

    // An address that definitely has no account.
    const strangerEmail = testEmail("no-account")
    await openForgotMode(page)

    // The password field and the demo-credentials card belong to sign-in, not
    // to this step — a reset form asking for a password is a confused form.
    await expect(page.getByLabel("Password")).toHaveCount(0)
    await expect(page.getByText(/demo credentials/i)).toHaveCount(0)

    await requestReset(page, strangerEmail)
    const strangerReceipt = await page
      .getByText(new RegExp(strangerEmail.replace(/[.+]/g, "\\$&"), "i"))
      .first()
      .textContent()
    expect(strangerReceipt).toMatch(/if an account exists/i)

    // Now a REAL account, created over the API so this stays a pure reset test.
    const realEmail = testEmail("reset-real")
    await signUpApi(`Reset Real ${unique("r").slice(-5)}`, realEmail, "reset-flow-pw-1")

    await openForgotMode(page)
    await requestReset(page, realEmail)
    const realReceipt = await page
      .getByText(new RegExp(realEmail.replace(/[.+]/g, "\\$&"), "i"))
      .first()
      .textContent()

    // The only difference allowed between the two is the address itself.
    expect(realReceipt?.replace(realEmail, "…")).toBe(
      strangerReceipt?.replace(strangerEmail, "…"),
    )

    // And the way back is always offered.
    await page.getByRole("button", { name: /back to sign in/i }).click()
    await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible()

    watcher.assertClean("password reset request")
  })

  test("an expired link explains itself and offers a fresh one", async ({ page }) => {
    const watcher = armed(page)

    // Exactly where Better Auth's callback sends a link it has rejected.
    await gotoStable(page, "/reset-password?error=INVALID_TOKEN", "networkidle")

    await expect(
      page.getByRole("heading", { name: /this link has expired/i }),
    ).toBeVisible({ timeout: 20_000 })
    // No password form to fill in — there is nothing this page could do with it.
    await expect(page.getByLabel("New password")).toHaveCount(0)

    await expect(async () => {
      await page.getByRole("link", { name: /email me a new link/i }).click()
      await expect(
        page.getByRole("heading", { name: /reset your password/i }),
      ).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
    expect(page.url()).toContain("mode=forgot")

    watcher.assertClean("expired reset link")
  })

  test("a forged token is refused in plain English", async ({ page }) => {
    const watcher = armed(page)

    await gotoStable(page, `/reset-password?token=${unique("forged")}`, "networkidle")
    await expect(
      page.getByRole("heading", { name: /choose a new password/i }),
    ).toBeVisible({ timeout: 20_000 })

    await fillStable(page.getByLabel("New password"), "forged-attempt-2026")
    await fillStable(page.getByLabel("Confirm password"), "forged-attempt-2026")
    await page.getByRole("button", { name: /set new password/i }).click()

    await expect(page.getByText(/no longer valid/i)).toBeVisible({ timeout: 20_000 })
    // Refused, but still recoverable — the user is not stranded on a dead page.
    await expect(page.getByRole("link", { name: /back to sign in/i })).toBeVisible()

    // A mismatch is caught locally, before the server is ever asked.
    await fillStable(page.getByLabel("Confirm password"), "something-else-2026")
    await page.getByRole("button", { name: /set new password/i }).click()
    await expect(page.getByText(/don't match/i)).toBeVisible({ timeout: 10_000 })

    watcher.assertClean("forged reset token")
  })
})

import { expect, test as setup } from "@playwright/test"
import { DEMO_ORGANIZER, ORGANIZER_STATE } from "./utils"

// Signs in through the real UI once and persists the cookie state for every
// organizer-side spec. Retried as a unit: filling before React hydration
// finishes gets wiped when the controlled inputs mount, so each attempt
// re-fills, verifies the values stuck, then submits.
setup("organizer signs in via the UI", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" })

  let signedIn = false
  for (let attempt = 0; attempt < 4 && !signedIn; attempt++) {
    const email = page.getByLabel("Email").first()
    const password = page.getByLabel("Password").first()
    await email.fill(DEMO_ORGANIZER.email)
    await password.fill(DEMO_ORGANIZER.password)
    await page.waitForTimeout(300)
    if ((await email.inputValue()) !== DEMO_ORGANIZER.email) continue // hydration wiped it — refill
    await page.getByRole("button", { name: /^sign in$/i }).first().click()
    try {
      await page.waitForURL(/\/app/, { timeout: 6_000 })
      signedIn = true
    } catch {
      // Native pre-hydration submit bounced us back — try again.
      if (!page.url().includes("/app")) {
        await page.goto("/login", { waitUntil: "networkidle" })
      }
    }
  }
  expect(signedIn, "organizer should reach /app").toBe(true)
  await expect(page.getByRole("navigation").first()).toBeVisible()
  await page.context().storageState({ path: ORGANIZER_STATE })
})

import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import {
  ORGANIZER_STATE,
  armed,
  clearToasts,
  expectToast,
  fillStable,
  gotoApp,
  gotoStable,
  mainEvent,
  organizerConvexClient,
  testEmail,
  unique,
  until,
} from "./_helpers"

/**
 * Sponsor portals — Kelsey's ask from the finalist call: sponsors don't go
 * through the CFP; their contact signs in and adds the sessions the package
 * includes. Driven entirely through ordinary links, forms and buttons:
 *
 *   organizer adds a sponsor + contact in the Sponsors drawer → the contact
 *   opens their magic link → the portal has a tab named after the company →
 *   they add a session → the allowance meter moves → the organizer sees the
 *   session in Submissions, marked with the sponsor.
 */
test.describe("sponsor portal", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("organizer adds a sponsor → contact adds a session → it lands in Submissions", async ({
    page,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const sponsorName = `Sponsor ${unique("sp")}`
    const contactEmail = testEmail("sponsor")
    const sessionTitle = `Sponsored talk ${unique("st")}`

    // ——— Organizer: Speakers → Sponsors → Add sponsor ————————————————————
    await gotoApp(page, "/app/sponsors")
    await page.getByRole("button", { name: /add sponsor|add your first sponsor/i }).first().click()
    const drawer = page.locator('[data-slot="drawer-shell"]').first()
    await expect(drawer).toBeVisible({ timeout: 20_000 })
    await fillStable(drawer.locator("#new-sponsor-name"), sponsorName)
    // Tier is a managed list now (Sponsor settings → Tiers; the seed has
    // Platinum / Gold / Community partner). Picking one pre-fills the
    // package's sessions, which we then override.
    await drawer.locator("#new-sponsor-tier").click()
    await page.getByRole("option", { name: "Gold", exact: true }).click()
    await expect(drawer.locator("#new-sponsor-limit")).toHaveValue("1")
    await fillStable(drawer.locator("#new-sponsor-limit"), "2")
    await fillStable(drawer.locator("#new-sponsor-first"), "Casey")
    await fillStable(drawer.locator("#new-sponsor-last"), "Contact")
    await fillStable(drawer.locator("#new-sponsor-email"), contactEmail)
    await drawer.getByRole("button", { name: /^add sponsor$/i }).click()
    await expectToast(page, new RegExp(`${sponsorName} added`, "i"), 30_000)
    await clearToasts(page)

    // The drawer re-opens on the new sponsor, Contacts tab one click away.
    await expect(page.locator('[data-slot="drawer-shell"]').first()).toContainText(sponsorName, {
      timeout: 20_000,
    })

    const listed = await until(
      async () => await organizer.query(api.sponsors.list, { eventId: event._id }),
      (data) => data.sponsors.some((s) => s.name === sponsorName && s.contacts.length === 1),
      { label: "the sponsor and its contact were saved" },
    )
    const sponsor = listed.sponsors.find((s) => s.name === sponsorName)!
    const token = sponsor.contacts[0].portalToken
    expect(sponsor.contacts[0].invitedAt, "the invite was queued on create").toBeTruthy()

    // ——— Contact: magic link → Overview → Sessions → add a session ———————————
    const portal = await context.newPage()
    const portalWatcher = armed(portal)
    // The sponsor portal has its own address — never the speaker portal.
    await gotoStable(portal, `/sponsor/t/${token}`, "networkidle")
    await portal.waitForURL(/\/sponsor(?:[/?#]|$)/, { timeout: 45_000 })
    await expect(portal.getByText(`Sponsor portal · ${sponsorName}`).first()).toBeVisible({
      timeout: 45_000,
    })
    await expect(portal.getByRole("heading", { name: sponsorName })).toBeVisible()
    // A sponsor-only contact who opens the speaker portal is sent back here.
    await gotoStable(portal, "/portal", "networkidle")
    await portal.waitForURL(/\/sponsor(?:[/?#]|$)/, { timeout: 30_000 })
    // Overview answers "what do you need from us?" before anything else.
    await expect(portal.getByText(/still needed from you/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(portal.getByText(/0 of 2 sessions added/i).first()).toBeVisible()

    // Sessions is its own tab; adding one opens the drawer there.
    await portal.getByRole("tab", { name: /^sessions$/i }).click()
    await portal.waitForURL(/\/sponsor\/sessions/, { timeout: 20_000 })
    await portal.getByRole("button", { name: /add a session/i }).first().click()
    const form = portal.locator('[data-slot="drawer-shell"]').first()
    await expect(form).toBeVisible({ timeout: 20_000 })
    await fillStable(form.locator("#sponsor-session-title"), sessionTitle)
    await fillStable(
      form.locator("#sponsor-session-description"),
      "How we run evals in production, with the numbers.",
    )
    await form.getByRole("button", { name: /^add session$/i }).click()
    await expectToast(portal, /session added/i, 30_000)
    await expect(portal.getByText(sessionTitle).first()).toBeVisible({ timeout: 20_000 })
    await expect(portal.getByText(/1 of 2 sessions added/i).first()).toBeVisible()

    // ——— Organizer: it's in Submissions, attributed to the sponsor ————————
    await gotoApp(page, "/app/submissions")
    const row = page.getByRole("row").filter({ hasText: sessionTitle }).first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    await expect(row).toContainText(`Sponsor: ${sponsorName}`)

    await portal.close()
    portalWatcher.assertClean("sponsor portal")
    watcher.assertClean("sponsors page")

    // Leave the shared seed as we found it: sessions stay, the link goes.
    await organizer.mutation(api.sponsors.remove, { sponsorId: sponsor._id })
  })
})

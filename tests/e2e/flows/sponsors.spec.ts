import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import {
  ORGANIZER_STATE,
  anonConvexClient,
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
    // Tier is a managed list now (Settings → Fields & options; the seed has
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
    // The SAME questions the CFP asks — the seed form requires format, track
    // and audience level, and the portal refuses until they're answered.
    await fillStable(form.locator("#question-title"), sessionTitle)
    await fillStable(
      form.locator("#question-description"),
      "How we run evals in production, with the numbers.",
    )
    await form.getByRole("button", { name: /^add session$/i }).click()
    await expectToast(portal, /a few answers are missing/i, 20_000)
    await clearToasts(portal)
    const asked = await anonConvexClient().query(api.portal.home, {
      portalToken: token,
      now: Date.now(),
    })
    const trackName = asked.sponsor?.sessionQuestions.find((q) => q.id === "track")?.options?.[0]
    expect(trackName, "the track question offers the event's tracks").toBeTruthy()
    for (const [id, pick] of [
      ["format", "Talk"],
      ["track", trackName!],
      ["level", "Beginner"],
    ] as const) {
      await form.locator(`#question-${id}`).click()
      const option = portal.getByRole("option", { name: pick, exact: true })
      await option.first().click()
      await expect(option).toHaveCount(0)
    }
    await form.getByRole("button", { name: /^add session$/i }).click()
    await expectToast(portal, /session added/i, 30_000)
    await expect(portal.getByText(sessionTitle).first()).toBeVisible({ timeout: 20_000 })
    await expect(portal.getByText(/1 of 2 sessions added/i).first()).toBeVisible()

    // ——— Organizer: it's in Submissions, attributed to the sponsor ————————
    await gotoApp(page, "/app/submissions")
    const row = page.getByRole("row").filter({ hasText: sessionTitle }).first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    await expect(row).toContainText(`Sponsor: ${sponsorName}`)
    const added = await until(
      async () => await organizer.query(api.sponsors.list, { eventId: event._id }),
      (data) => (data.sponsors.find((s) => s.name === sponsorName)?.sessions.length ?? 0) === 1,
      { label: "the sponsor session is listed" },
    )
    const sessionId = added.sponsors.find((s) => s.name === sponsorName)!.sessions[0]._id
    const session = await organizer.query(api.submissions.get, { submissionId: sessionId })
    expect(session.format, "the answers fill the session like a CFP proposal").toBe("Talk")
    expect(session.level).toBe("Beginner")
    expect(session.trackId).toBeTruthy()

    await portal.close()
    portalWatcher.assertClean("sponsor portal")
    watcher.assertClean("sponsors page")

    // Leave the shared seed as we found it: sessions stay, the link goes.
    await organizer.mutation(api.sponsors.remove, { sponsorId: sponsor._id })
  })
  test("sponsor setup lives in Settings, beside every other option list", async ({ page }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const tierName = `Tier ${unique("t")}`

    // Sponsors → "Tiers & fields" is a real link into Settings → Fields & options.
    await gotoApp(page, "/app/sponsors")
    await page.getByRole("link", { name: /tiers & fields/i }).click()
    await page.waitForURL(/\/settings\/fields-and-options/, { timeout: 30_000 })
    const tiers = page.locator("#sponsor-tiers")
    await expect(tiers).toBeVisible({ timeout: 30_000 })
    await expect(page.locator("#sponsor-fields")).toBeVisible()
    // The CFP's own lists are on the same page.
    await expect(page.getByText(/^formats$/i).first()).toBeVisible()

    await fillStable(tiers.locator("#new-tier-name"), tierName)
    await fillStable(tiers.locator("#new-tier-sessions"), "3")
    await tiers.getByRole("button", { name: /^add tier$/i }).click()
    await expectToast(page, new RegExp(`${tierName}.*added`, "i"), 20_000)
    await expect(tiers.getByLabel(`Tier name (${tierName})`)).toBeVisible()

    // Delete goes through the same confirm dialog as tracks and rooms.
    await tiers.getByRole("button", { name: `Delete tier ${tierName}` }).click()
    await page.getByRole("button", { name: /^delete tier$/i }).click()
    await expectToast(page, new RegExp(`${tierName}.*deleted`, "i"), 20_000)

    // The portal rules sit beside the Speaker portal card on Event details,
    // and save the moment they change — no Save button.
    await gotoApp(page, "/app/settings")
    const portalCard = page.locator("#sponsor-portal")
    await expect(portalCard).toBeVisible({ timeout: 30_000 })
    await expect(portalCard.locator("#sponsor-session-form")).toBeVisible()
    const colleagues = portalCard.getByRole("switch", { name: /invite colleagues/i })
    await colleagues.click()
    await until(
      async () => await organizer.query(api.sponsors.settings, { eventId: event._id }),
      (data) => data.rules.allowColleagueInvites === false,
      { label: "the switch saved on its own" },
    )
    await colleagues.click()
    await until(
      async () => await organizer.query(api.sponsors.settings, { eventId: event._id }),
      (data) => data.rules.allowColleagueInvites,
      { label: "and back" },
    )
    watcher.assertClean("sponsor settings")
  })
})

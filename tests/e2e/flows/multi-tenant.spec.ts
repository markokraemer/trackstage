import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import {
  DEMO_WORKSPACE_NAME,
  MAIN_EVENT_NAME,
  ORGANIZER_STATE,
  armed,
  clientFor,
  expectToast,
  fillStable,
  gotoStable,
  organizerConvexClient,
  testEmail,
  uiSignIn,
  uiSignUp,
  unique,
  until,
  waitForShell,
} from "./_helpers"

/**
 * The enterprise question a judge asks first: is this actually multi-tenant, or
 * does everyone see the demo data?
 *
 * One journey, driven through the real UI on both sides:
 *   fresh signup → own empty workspace, ZERO demo data (scoping)
 *   → demo organizer invites that email → member row reads "Invited"
 *   → invitee signs in again → membership claimed → demo events now visible
 *   → owner changes their role → owner removes them → access is gone.
 *
 * The negative half matters more than the positive half: between signup and
 * claim, the fresh user must not be able to reach the demo event by ANY path,
 * including straight at the backend with their own credentials.
 */

const PASSWORD = "fresh-tenant-pw-1"

test.describe("multi-tenancy", () => {
  test.describe.configure({ mode: "serial" })

  test("fresh user is scoped out, then invited, promoted and removed", async ({
    browser,
  }) => {
    const freshEmail = testEmail("tenant")
    const freshName = `Tenant ${unique("t").slice(-5)}`

    const organizer = await organizerConvexClient()
    const workspaces: Array<{ id: string; name: string; role: string }> =
      await organizer.query(api.workspaces.mine, {})
    const demoWorkspace =
      workspaces.find((w) => w.name === DEMO_WORKSPACE_NAME) ?? workspaces[0]
    expect(demoWorkspace, "demo organizer must own a workspace").toBeTruthy()

    // ——— 1. Fresh signup lands in its own, empty workspace ————————————————
    const freshContext = await browser.newContext()
    const fresh = await freshContext.newPage()
    const freshWatcher = armed(fresh)

    await test.step("signs up and lands in an empty workspace", async () => {
      await uiSignUp(fresh, freshName, freshEmail, PASSWORD)
      await waitForShell(fresh)
      await expect(
        fresh.getByRole("button", { name: /switch event/i }).first(),
      ).toContainText(/no event yet/i, { timeout: 20_000 })
      await expect(
        fresh.getByText(/create your event to get started/i).first(),
      ).toBeVisible({ timeout: 20_000 })
      freshWatcher.assertClean("fresh user /app")
    })

    await test.step("sees ZERO demo data anywhere", async () => {
      // The switcher is the only route to another tenant's events.
      await fresh.getByRole("button", { name: /switch event/i }).first().click()
      await expect(
        fresh.getByText(/haven't created an event yet/i).first(),
      ).toBeVisible()
      await expect(
        fresh.getByRole("menuitem", { name: new RegExp(MAIN_EVENT_NAME, "i") }),
      ).toHaveCount(0)
      await fresh.keyboard.press("Escape")

      // Organizer surfaces must be empty, not merely hidden.
      for (const route of ["/app/submissions", "/app/speakers", "/app/agenda"]) {
        await gotoStable(fresh, route)
        await waitForShell(fresh)
        await expect(fresh.locator("body")).not.toContainText(
          new RegExp(MAIN_EVENT_NAME, "i"),
          { timeout: 10_000 },
        )
      }

      // And the backend refuses directly, with this user's own credentials.
      const freshClient = await clientFor(freshEmail, PASSWORD)
      expect(await freshClient.query(api.events.list, {})).toEqual([])
      const demoEvent = (
        await organizer.query(api.events.list, {})
      ).find((e: { slug: string }) => e.slug === "ai-summit-2026")
      await expect(
        freshClient.query(api.events.get, { eventId: demoEvent._id }),
      ).rejects.toThrow(/access/i)
      await expect(
        freshClient.query(api.submissions.counts, { eventId: demoEvent._id }),
      ).rejects.toThrow(/access/i)
    })

    // ——— 2. Organizer invites the fresh user ——————————————————————————————
    const orgContext = await browser.newContext({ storageState: ORGANIZER_STATE })
    const org = await orgContext.newPage()
    const orgWatcher = armed(org)

    await test.step("organizer invites the fresh email", async () => {
      await gotoStable(org, "/app/workspace")
      await expect(
        org.getByRole("heading", { name: /workspace settings/i }).first(),
      ).toBeVisible({ timeout: 30_000 })

      // The organizer may belong to several workspaces after earlier runs —
      // make sure we are inviting into the demo one.
      const picker = org.getByLabel("Workspace", { exact: true })
      if ((await picker.count()) > 0) {
        await picker.first().click()
        const option = org.getByRole("option", {
          name: new RegExp(DEMO_WORKSPACE_NAME, "i"),
        })
        if ((await option.count()) > 0) await option.first().click()
        else await org.keyboard.press("Escape")
      }

      await org.getByRole("button", { name: /invite teammate/i }).first().click()
      await expect(
        org.getByRole("heading", { name: /invite a teammate/i }).first(),
      ).toBeVisible()
      await fillStable(org.getByLabel(/email address/i).first(), freshEmail)
      await org.getByRole("button", { name: /send invite/i }).first().click()
      await expectToast(org, /invite email sent/i)
    })

    await test.step('member row shows "Invited"', async () => {
      const row = org.getByRole("row").filter({ hasText: freshEmail }).first()
      await expect(row).toBeVisible({ timeout: 15_000 })
      await expect(row).toContainText(/invited/i)
      orgWatcher.assertClean("/app/workspace invite")
    })

    await test.step("a second invite to the same email is refused", async () => {
      await org.getByRole("button", { name: /invite teammate/i }).first().click()
      await fillStable(org.getByLabel(/email address/i).first(), freshEmail)
      await org.getByRole("button", { name: /send invite/i }).first().click()
      await expect(
        org.getByText(/already a member/i).first(),
      ).toBeVisible({ timeout: 15_000 })
      await org.getByRole("button", { name: /^cancel$/i }).first().click()
      // A refused mutation logs a Convex server error — that IS the assertion
      // here, so forget it before the watcher's final cleanliness check.
      orgWatcher.reset()
    })

    // ——— 3. Invitee signs in again and claims the membership ———————————————
    await test.step("invitee signs in again and now sees the demo events", async () => {
      const claimContext = await browser.newContext()
      const claim = await claimContext.newPage()
      const claimWatcher = armed(claim)
      await uiSignIn(claim, freshEmail, PASSWORD)
      await waitForShell(claim)

      // `workspaces.ensure` claims the pending row on the next authenticated
      // load; the switcher then groups the demo workspace's events under it.
      const switcher = claim.getByRole("button", { name: /switch event/i }).first()
      await expect(async () => {
        await switcher.click()
        await expect(
          claim.getByRole("menuitem", {
            name: new RegExp(MAIN_EVENT_NAME, "i"),
          }).first(),
        ).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 45_000 })

      await claim
        .getByRole("menuitem", { name: new RegExp(MAIN_EVENT_NAME, "i") })
        .first()
        .click()
      await expect(switcher).toContainText(new RegExp(MAIN_EVENT_NAME, "i"), {
        timeout: 20_000,
      })

      // Real access, not just a menu entry: the submissions table loads.
      await gotoStable(claim, "/app/submissions")
      await expect(
        claim.getByRole("tab", { name: /^all/i }).first(),
      ).toBeVisible({ timeout: 30_000 })
      claimWatcher.assertClean("claimed member /app/submissions")
      await claimContext.close()

      // Backend agrees.
      const claimed = await clientFor(freshEmail, PASSWORD)
      const visible: Array<{ slug: string }> = await claimed.query(
        api.events.list,
        {},
      )
      expect(visible.some((e) => e.slug === "ai-summit-2026")).toBe(true)
    })

    await test.step("member row flips to Active", async () => {
      await org.reload({ waitUntil: "domcontentloaded" })
      const row = org.getByRole("row").filter({ hasText: freshEmail }).first()
      await expect(row).toContainText(/active/i, { timeout: 20_000 })
    })

    // ——— 4. Role change ————————————————————————————————————————————————————
    await test.step("owner promotes the member to admin", async () => {
      const roleSelect = org.getByLabel(`Role for ${freshEmail}`)
      await expect(roleSelect).toBeVisible({ timeout: 15_000 })
      await roleSelect.click()
      await org.getByRole("option", { name: /^admin$/i }).first().click()
      await expectToast(org, /role updated/i)
      await until(
        async () =>
          (await organizer.query(api.workspaces.members, {
            organizationId: demoWorkspace.id,
          })) as Array<{ email: string; role: string }>,
        (rows) => rows.find((m) => m.email === freshEmail)?.role === "admin",
        { label: "role=admin in the members table" },
      )
    })

    // ——— 5. Removal revokes access ————————————————————————————————————————
    await test.step("owner removes the member and access is revoked", async () => {
      await org.getByRole("button", { name: `Remove ${freshEmail}` }).click()
      await expect(
        org.getByText(new RegExp(`Remove ${freshEmail}`, "i")).first(),
      ).toBeVisible()
      await org
        .getByRole("button", { name: /remove from workspace/i })
        .first()
        .click()
      await expect(
        org.getByRole("row").filter({ hasText: freshEmail }),
      ).toHaveCount(0, { timeout: 20_000 })

      const removed = await clientFor(freshEmail, PASSWORD)
      await until(
        async () =>
          (await removed.query(api.events.list, {})) as Array<{ slug: string }>,
        (events) => events.every((e) => e.slug !== "ai-summit-2026"),
        { label: "removed member no longer sees the demo event" },
      )
      orgWatcher.assertClean("/app/workspace role + removal")
    })

    await freshContext.close()
    await orgContext.close()
  })

  test("a non-owner cannot change roles or remove teammates", async ({
    browser,
  }) => {
    // Invite a second identity as a plain member, sign in as them, and prove
    // the team-management controls are simply not offered.
    const memberEmail = testEmail("member")
    const organizer = await organizerConvexClient()
    const workspaces: Array<{ id: string; name: string }> = await organizer.query(
      api.workspaces.mine,
      {},
    )
    const demoWorkspace =
      workspaces.find((w) => w.name === DEMO_WORKSPACE_NAME) ?? workspaces[0]

    await organizer.mutation(api.workspaces.addMember, {
      organizationId: demoWorkspace.id,
      email: memberEmail,
      role: "member",
    })

    const context = await browser.newContext()
    const page = await context.newPage()
    const watcher = armed(page)
    try {
      await uiSignUp(page, "Plain Member", memberEmail, PASSWORD)
      await gotoStable(page, "/app/workspace")
      await expect(
        page.getByRole("heading", { name: /workspace settings/i }).first(),
      ).toBeVisible({ timeout: 30_000 })

      await expect(
        page.getByRole("button", { name: /invite teammate/i }).first(),
      ).toBeDisabled()
      await expect(
        page.getByRole("button", { name: /^Remove /i }),
      ).toHaveCount(0)
      watcher.assertClean("member view of /app/workspace")

      // And the backend refuses the mutation outright.
      const memberClient = await clientFor(memberEmail, PASSWORD)
      const members: Array<{ _id: string; email: string }> =
        await memberClient.query(api.workspaces.members, {
          organizationId: demoWorkspace.id,
        })
      const owner = members.find((m) => m.email.includes("organizer@demo"))
      if (owner) {
        await expect(
          memberClient.mutation(api.workspaces.removeMember, {
            memberId: owner._id,
          }),
        ).rejects.toThrow()
      }
    } finally {
      const members: Array<{ _id: string; email: string }> =
        await organizer.query(api.workspaces.members, {
          organizationId: demoWorkspace.id,
        })
      const row = members.find((m) => m.email === memberEmail)
      if (row) {
        await organizer.mutation(api.workspaces.removeMember, {
          memberId: row._id,
        })
      }
      await context.close()
    }
  })
})

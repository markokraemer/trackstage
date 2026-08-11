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

  test("fresh user is scoped out, then invited, promoted and removed", async ({
    browser,
  }) => {
    const freshEmail = testEmail("tenant")
    const freshName = `Tenant ${unique("t").slice(-5)}`

    const organizer = await organizerConvexClient()
    const workspaces = await organizer.query(api.workspaces.mine, {})
    const demoWorkspace =
      workspaces.find((w) => w.name === DEMO_WORKSPACE_NAME) ?? workspaces[0]
    expect(demoWorkspace, "demo organizer must own a workspace").toBeTruthy()

    // ——— 1. Fresh signup lands in its own, empty workspace ————————————————
    const freshContext = await browser.newContext()
    const fresh = await freshContext.newPage()
    const freshWatcher = armed(fresh)

    await test.step("signs up and lands on the first-run onboarding", async () => {
      await uiSignUp(fresh, freshName, freshEmail, PASSWORD, {
        skipOnboarding: false,
      })
      // A brand-new account's /app is the FULL-SCREEN onboarding takeover —
      // no shell, no bounce to workspace settings (regression fixed
      // 2026-08-11; full-screen per Marko 2026-08-12). Skipping it reveals
      // the shell with the create-event hero.
      await expect(fresh).not.toHaveURL(/\/workspace/)
      await expect(
        fresh.getByText(/welcome to trackstage/i).first(),
      ).toBeVisible({ timeout: 20_000 })
      await fresh
        .getByRole("button", { name: /explore on my own/i })
        .first()
        .click()
      await waitForShell(fresh)
      await expect(
        fresh.getByRole("button", { name: /switch event/i }).first(),
      ).toContainText(/no event yet/i, { timeout: 20_000 })
      await expect(
        fresh.getByRole("button", { name: /create your first event/i }).first(),
      ).toBeVisible({ timeout: 20_000 })
      freshWatcher.assertClean("fresh user /app")
    })

    await test.step("sees ZERO demo data anywhere", async () => {
      // The switcher is the only route to another tenant's events.
      await fresh.getByRole("button", { name: /switch event/i }).first().click()
      await expect(
        fresh.getByText(/no events yet — create one/i).first(),
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
      const demoEvent = (await organizer.query(api.events.list, {})).find(
        (e) => e.slug === "ai-summit-2026",
      )
      expect(demoEvent, "the demo event must exist to test isolation").toBeTruthy()
      await expect(
        freshClient.query(api.events.get, { eventId: demoEvent!._id }),
      ).rejects.toThrow(/access/i)
      await expect(
        freshClient.query(api.submissions.counts, { eventId: demoEvent!._id }),
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
      // the hub's "Your workspaces" card switches to the demo one if needed.
      const switchToDemo = org.getByRole("button", {
        name: `Switch to ${DEMO_WORKSPACE_NAME}`,
      })
      if ((await switchToDemo.count()) > 0) {
        await switchToDemo.first().click()
        await expect(
          org.getByRole("heading", {
            name: new RegExp(`workspace settings — ${DEMO_WORKSPACE_NAME}`, "i"),
          }).first(),
        ).toBeVisible({ timeout: 20_000 })
      }

      // Team is a first-class tab in the modal — the member table is its
      // whole content, with the invite CTA in the header.
      await org.getByRole("tab", { name: /^team$/i }).first().click()
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
      // load. The invitee lands in their OWN (empty) workspace — the URL pins
      // context there now — so the demo workspace shows up at the picker's
      // WORKSPACE level once claimed; switching navigates to its first
      // event's canonical dashboard.
      const switcher = claim.getByRole("button", { name: /switch event/i }).first()
      const demoWorkspaceRow = claim
        .getByRole("menuitem", { name: `Switch to ${DEMO_WORKSPACE_NAME}` })
        .first()
      await expect(async () => {
        await switcher.click()
        await expect(demoWorkspaceRow).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 45_000 })

      await demoWorkspaceRow.click()
      await expect(claim).toHaveURL(/\/app\/[^/]+\/[^/]+/, {
        timeout: 20_000,
      })
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
          await organizer.query(api.workspaces.members, {
            organizationId: demoWorkspace.id,
          }),
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
    const workspaces = await organizer.query(api.workspaces.mine, {})
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

      await page.getByRole("tab", { name: /^team$/i }).first().click()
      await expect(
        page.getByRole("button", { name: /invite teammate/i }).first(),
      ).toBeDisabled()
      await expect(
        page.getByRole("button", { name: /^Remove /i }),
      ).toHaveCount(0)
      watcher.assertClean("member view of /app/workspace")

      // And the backend refuses the mutation outright.
      const memberClient = await clientFor(memberEmail, PASSWORD)
      const members = await memberClient.query(api.workspaces.members, {
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
      const members = await organizer.query(api.workspaces.members, {
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

  /**
   * Marko: "proper UI to see all workspaces you're part of & also a workspace
   * switcher etc. E2E ensure that works perfectly."
   *
   * One user, four workspaces (two with an event, one empty, one created from
   * the switcher itself). Everything is asserted through the real chrome: the
   * sidebar's two-level picker, the avatar menu's workspace list and the
   * workspace hub's "Your workspaces" card — the three surfaces that must never
   * disagree about which workspace you are in.
   */
  test("belongs to several workspaces: switcher lists them and switching flips the app", async ({
    browser,
  }) => {
    const email = testEmail("multiws")
    const alphaEventName = `Alpha Summit ${unique("a")}`
    const betaName = `Beta Collective ${unique("b")}`
    const betaEventName = `Beta Kickoff ${unique("bk")}`
    const emptyName = `Empty Studio ${unique("e")}`
    const createdName = `Created Live ${unique("c")}`

    const context = await browser.newContext()
    const page = await context.newPage()
    const watcher = armed(page)

    try {
      await uiSignUp(page, "Multi Workspace", email, PASSWORD)
      await waitForShell(page)

      // ——— Setup: two workspaces with an event, one without ————————————————
      const client = await clientFor(email, PASSWORD)
      await client.mutation(api.workspaces.ensure, {})
      const own = (await client.query(api.workspaces.mine, {}))[0]
      expect(own, "signup must create a workspace").toBeTruthy()
      await client.mutation(api.events.create, {
        organizationId: own.id,
        name: alphaEventName,
        slug: unique("alpha"),
        timezone: "UTC",
      })
      const beta = await client.mutation(api.workspaces.create, {
        name: betaName,
      })
      await client.mutation(api.events.create, {
        organizationId: beta.organizationId,
        name: betaEventName,
        slug: unique("beta"),
        timezone: "UTC",
      })
      await client.mutation(api.workspaces.create, { name: emptyName })

      await gotoStable(page, "/app")
      await waitForShell(page)

      const switcher = page.getByRole("button", { name: /switch event/i }).first()
      // A closed Base UI popup lingers in the DOM, so every menu assertion is
      // scoped to the menu that is actually on screen.
      const openMenu = page.locator('[role="menu"]:visible')
      const menuItem = (name: string | RegExp) =>
        openMenu.getByRole("menuitem", { name })

      // One click: the picker lists workspaces AND events in the same popover.
      // A menu that is still fading out would double every menuitem match, so
      // wait for the previous one to be gone first.
      const openPicker = async () => {
        await expect(page.locator('[role="menu"]')).toHaveCount(0, {
          timeout: 10_000,
        })
        await switcher.click()
        await expect(menuItem(`Switch to ${betaName}`)).toBeVisible({
          timeout: 10_000,
        })
      }

      await test.step("the picker lists every workspace with its role", async () => {
        await expect(switcher).toContainText(alphaEventName, { timeout: 30_000 })
        await openPicker()

        for (const name of [own.name, betaName, emptyName]) {
          const row = menuItem(`Switch to ${name}`)
          await expect(row).toBeVisible()
          await expect(row).toContainText(/owner/i)
        }
        // Event counts come from the events you can actually reach.
        await expect(menuItem(`Switch to ${betaName}`)).toContainText(
          /1 event/i,
        )
        await expect(menuItem(`Switch to ${emptyName}`)).toContainText(
          /0 events/i,
        )
        await page.keyboard.press("Escape")
      })

      await test.step("switching flips the sidebar events and the dashboard", async () => {
        await openPicker()
        await menuItem(`Switch to ${betaName}`).click()

        await expect(switcher).toContainText(betaEventName, { timeout: 20_000 })
        await expect(page.locator("main")).toContainText(betaEventName, {
          timeout: 20_000,
        })
        await expect(page.locator("main")).not.toContainText(alphaEventName)

        // Level two now lists ONLY this workspace's events.
        await switcher.click()
        await expect(menuItem(new RegExp(betaEventName, "i"))).toBeVisible()
        await expect(menuItem(new RegExp(alphaEventName, "i"))).toHaveCount(0)
        await page.keyboard.press("Escape")
      })

      await test.step("an empty workspace lands on its first-run home", async () => {
        await openPicker()
        await menuItem(`Switch to ${emptyName}`).click()

        // An empty workspace lands on `/app/:workspaceSlug` — the first-run
        // create-your-event experience, never Workspace settings (regression
        // fixed 2026-08-11).
        await expect(page).not.toHaveURL(/\/workspace/)
        await expect(
          page.getByText(new RegExp(`welcome to ${emptyName}`, "i")).first(),
        ).toBeVisible({ timeout: 20_000 })
        await expect(switcher).toContainText(/no event yet/i)
      })

      await test.step('the settings modal lists every workspace under "Your workspaces"', async () => {
        // Workspace settings stays reachable at its own address (the bare
        // legacy alias resolves to the workspace in context — the empty one)
        // — it opens as a MODAL over the page now, same heading as ever.
        await gotoStable(page, "/app/workspace")
        await expect(
          page.getByRole("heading", {
            name: new RegExp(`workspace settings — ${emptyName}`, "i"),
          }).first(),
        ).toBeVisible({ timeout: 20_000 })
        for (const name of [own.name, betaName, emptyName]) {
          await expect(
            page.getByText(name, { exact: true }).first(),
          ).toBeVisible()
        }
        // The one in context is marked, the others offer a switch — and
        // switching INSIDE the modal keeps the modal open on the new one.
        await expect(page.getByText("Current", { exact: true }).first()).toBeVisible()
        await page
          .getByRole("button", { name: `Switch to ${betaName}` })
          .click()
        await expect(
          page.getByRole("heading", {
            name: new RegExp(`workspace settings — ${betaName}`, "i"),
          }).first(),
        ).toBeVisible({ timeout: 20_000 })
        // Close it; the app behind has already moved to the beta workspace.
        await page.keyboard.press("Escape")
        await expect(switcher).toContainText(betaEventName, { timeout: 20_000 })
      })

      await test.step("the avatar menu switches workspace too", async () => {
        await page.getByRole("button", { name: /account menu/i }).click()
        const alphaRow = menuItem(`Switch to ${own.name}`)
        await expect(alphaRow).toBeVisible({ timeout: 10_000 })
        await expect(alphaRow).toContainText(/owner/i)
        await alphaRow.click()
        await expect(switcher).toContainText(alphaEventName, { timeout: 20_000 })
      })

      await test.step("create workspace from the switcher", async () => {
        await openPicker()
        await menuItem(/create workspace/i).click()
        // Scope to the dialog: the hub behind it has its own "Workspace name".
        const dialog = page.getByRole("dialog")
        await expect(
          dialog.getByRole("heading", { name: /create a workspace/i }),
        ).toBeVisible({ timeout: 10_000 })
        await fillStable(dialog.getByLabel(/workspace name/i), createdName)
        await dialog
          .getByRole("button", { name: /^create workspace$/i })
          .click()

        // Brand new and empty — context moves there and lands on its hub.
        // The workspace hub lives at `/app/:workspaceSlug/workspace`, not the
        // bare legacy `/app/workspace` shape.
        await expect(page).toHaveURL(/\/app\/(?:[^/]+\/)?workspace/, {
          timeout: 20_000,
        })
        await expect(
          page.getByRole("heading", {
            name: new RegExp(`workspace settings — ${createdName}`, "i"),
          }).first(),
        ).toBeVisible({ timeout: 20_000 })
      })

      await test.step("the choice survives a reload", async () => {
        await gotoStable(page, "/app/workspace")
        await expect(
          page.getByRole("heading", {
            name: new RegExp(`workspace settings — ${createdName}`, "i"),
          }).first(),
        ).toBeVisible({ timeout: 30_000 })
        watcher.assertClean("workspace switching")
      })
    } finally {
      await context.close()
    }
  })

  /**
   * Event settings → Team (docs/memory/RULES.md 23, refinement 3): who can open
   * THIS event, and a two-click path to inviting someone into just this one.
   */
  test("event settings names who can open the event and pre-scopes the invite", async ({
    browser,
  }) => {
    const email = testEmail("eventteam")
    const eventName = `Scoped Event ${unique("se")}`

    const context = await browser.newContext()
    const page = await context.newPage()
    const watcher = armed(page)

    try {
      await uiSignUp(page, "Event Team", email, PASSWORD)
      await waitForShell(page)

      const client = await clientFor(email, PASSWORD)
      await client.mutation(api.workspaces.ensure, {})
      const own = (await client.query(api.workspaces.mine, {}))[0]
      await client.mutation(api.events.create, {
        organizationId: own.id,
        name: eventName,
        slug: unique("scoped"),
        timezone: "UTC",
      })

      await gotoStable(page, "/app/settings")
      await waitForShell(page)
      await expect(
        page.getByRole("button", { name: /switch event/i }).first(),
      ).toContainText(eventName, { timeout: 30_000 })

      await test.step("the Team tab names who can open this event", async () => {
        // Team is a real tab among the event-settings tabs now — the same
        // member table as Workspace settings, scoped to this event.
        await page.getByRole("tab", { name: /^team$/i }).first().click()
        await expect(page).toHaveURL(/\/settings\/team/, { timeout: 20_000 })
        await expect(page.getByText(email).first()).toBeVisible({
          timeout: 20_000,
        })
        await expect(
          page.getByText(/who can open/i).first(),
        ).toBeVisible()
        await expect(
          page.getByRole("columnheader", { name: /event access/i }).first(),
        ).toBeVisible()
      })

      await test.step("Invite teammate from the Team tab is pre-scoped", async () => {
        await page
          .getByRole("button", { name: /invite teammate/i })
          .first()
          .click()
        await expect(
          page.getByRole("heading", { name: /invite a teammate/i }).first(),
        ).toBeVisible({ timeout: 20_000 })

        // Role is Member and the scope is already this event only.
        await expect(
          page.getByRole("radio", { name: /only selected events/i }),
        ).toBeChecked()
        await expect(
          page.getByRole("checkbox", { name: new RegExp(eventName, "i") }),
        ).toBeChecked()

        const invitee = testEmail("scopedmate")
        await fillStable(page.getByLabel(/email address/i).first(), invitee)
        await page.getByRole("button", { name: /send invite/i }).first().click()
        await expectToast(page, /invite email sent/i)

        // The membership really is limited to this one event.
        const members = await client.query(api.workspaces.members, {
          organizationId: own.id,
        })
        const row = members.find((m) => m.email === invitee)
        expect(row?.role).toBe("member")
        expect(row?.eventIds?.length).toBe(1)
      })

      watcher.assertClean("event settings team tab")
    } finally {
      await context.close()
    }
  })
})

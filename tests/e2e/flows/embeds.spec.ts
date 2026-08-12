import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  DEMO_WORKSPACE_SLUG,
  MAIN_EVENT_SLUG,
  ORGANIZER_STATE,
  armed,
  gotoStable,
  mainEvent,
  organizerConvexClient,
  unique,
} from "./_helpers"

test.describe("saved embeds", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("save, reopen, turn off everywhere, and turn back on", async ({
    page,
  }) => {
    const watcher = armed(page)
    const client = await organizerConvexClient()
    const event = await mainEvent(client)
    const name = unique("Sponsors agenda")
    let embedId: Id<"embeds"> | null = null

    try {
      // Saved embeds expose the public programme, so publication is an
      // explicit precondition rather than an assumption about test order.
      await client.mutation(api.agenda.publishAgenda, { eventId: event._id })
      await gotoStable(
        page,
        `/app/${DEMO_WORKSPACE_SLUG}/${MAIN_EVENT_SLUG}/embeds`,
        "networkidle",
      )

      await page.getByLabel("Accent colour").fill("#0F6E70")
      await page
        .getByRole("switch", { name: "Event name and logo" })
        .click()
      await page
        .getByRole("switch", { name: "Session descriptions" })
        .click()
      await page.locator("#embed-name").fill(name)
      await page.getByRole("button", { name: "Save", exact: true }).click()

      await expect(page.getByText(`Saved “${name}”`)).toBeVisible()
      await expect
        .poll(async () => {
          const rows = await client.query(api.embeds.list, {
            eventId: event._id,
          })
          return rows.some((row) => row.name === name)
        })
        .toBe(true)
      const savedRows = await client.query(api.embeds.list, {
        eventId: event._id,
      })
      const saved = savedRows.find((row) => row.name === name)
      expect(saved, "the saved embed should be queryable").toBeDefined()
      if (!saved) throw new Error("saved embed disappeared")
      embedId = saved._id
      expect({
        accent: saved.options.accent,
        showHeader: saved.options.showHeader,
        hideDescriptions: saved.options.hideDescriptions,
      }).toEqual({
          accent: "#0F6E70",
          showHeader: true,
          hideDescriptions: true,
        })

      // Change the draft, then reopen the saved row: the controls must restore
      // the named configuration rather than merely remembering its name.
      await page.getByLabel("Accent colour").fill("#2F5CE0")
      await page
        .getByRole("switch", { name: "Event name and logo" })
        .click()
      await page
        .getByRole("button")
        .filter({ hasText: name })
        .first()
        .click()
      await expect(page.getByLabel("Accent colour")).toHaveValue("#0F6E70")
      await expect(
        page.getByRole("switch", { name: "Event name and logo" }),
      ).toBeChecked()
      await expect(
        page.getByRole("switch", { name: "Session descriptions" }),
      ).not.toBeChecked()

      await page
        .getByRole("switch", { name: `Turn off ${name}` })
        .click()
      await expect(page.getByText(`${name} · off`, { exact: true })).toBeVisible()
      await expect
        .poll(async () => {
          const rows = await client.query(api.embeds.list, {
            eventId: event._id,
          })
          return rows.find((row) => row._id === embedId)?.enabled
        })
        .toBe(false)

      await gotoStable(
        page,
        `/e/${DEMO_WORKSPACE_SLUG}/${MAIN_EVENT_SLUG}/sessions?embed=true&e=${embedId}`,
        "networkidle",
      )
      await expect(
        page.getByText("This embed is turned off", { exact: true }),
      ).toBeVisible()
      await expect(page.locator("[data-slot=session-card]")).toHaveCount(0)

      await gotoStable(
        page,
        `/app/${DEMO_WORKSPACE_SLUG}/${MAIN_EVENT_SLUG}/embeds`,
        "networkidle",
      )
      await page
        .getByRole("switch", { name: `Turn on ${name}` })
        .click()
      await expect(page.getByText(`${name} · off`, { exact: true })).toHaveCount(
        0,
      )

      await gotoStable(
        page,
        `/e/${DEMO_WORKSPACE_SLUG}/${MAIN_EVENT_SLUG}/sessions?embed=true&e=${embedId}`,
        "networkidle",
      )
      await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible()
      await expect(page.locator("[data-slot=session-card]").first()).toBeVisible()
      watcher.assertClean("saved embed lifecycle")
    } finally {
      if (embedId) {
        await client.mutation(api.embeds.remove, { embedId })
      }
    }
  })
})

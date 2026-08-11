import { expect, test } from "@playwright/test"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
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
  present,
  testEmail,
  unique,
  until,
} from "./_helpers"

/**
 * The chase loop — SPEC §4.7/§4.8 and the thing swyx says event producers
 * actually spend their week on.
 *
 * Organizer sees who is missing what → assigns a task → the speaker opens a
 * magic link, fills the bio and uploads a headshot → the task ticks itself off
 * → the organizer's dashboard drops the outstanding count LIVE, with no
 * reload. The "no reload" part is the assertion that matters: it is the
 * difference between a real-time product and a report.
 */

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/headshot.png",
)

type RosterRow = {
  personId: string
  name: string
  email: string
  portalToken: string
  missing: Array<string>
  hasBio?: boolean
  tasks: { done: number; total: number }
}

async function roster(
  organizer: Awaited<ReturnType<typeof organizerConvexClient>>,
  eventId: string,
) {
  return (await organizer.query(api.dashboard.speakersRoster, {
    eventId,
  })) as Array<RosterRow>
}

/** A speaker with no bio and no headshot, freshly created for this run. */
async function freshSpeaker(
  organizer: Awaited<ReturnType<typeof organizerConvexClient>>,
  eventId: string,
  label: string,
) {
  const email = testEmail(label)
  const added = (await organizer.mutation(api.speakersAdmin.addManual, {
    eventId,
    firstName: "Portia",
    lastName: `Portal${unique("p").slice(-4)}`,
    email,
    company: "Portal Co",
    workflowStatus: "confirmed",
  })) as { personId: string; portalToken: string }
  return { ...added, email }
}

test.describe("speakers roster + portal", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("missing chips → assign task → speaker completes it → dashboard drops live", async ({
    page,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const speaker = await freshSpeaker(organizer, event._id, "roster")
    const taskTitle = `Send your slides ${unique("tk")}`

    await gotoApp(page, "/app/speakers")

    // ——— The roster names what's missing, in plain language ————————————
    const row = page.getByRole("row").filter({ hasText: speaker.email }).first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    await expect(row).toContainText(/no bio/i)
    await expect(row).toContainText(/no headshot/i)

    // ——— Assign a task from the organizer side ————————————————————————
    await page.getByRole("button", { name: /assign task/i }).first().click()
    const dialog = page.getByRole("dialog").first()
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    await fillStable(dialog.locator("#task-title"), taskTitle)
    await fillStable(dialog.locator("#task-speaker-search"), speaker.email)
    await dialog
      .getByRole("checkbox", { name: new RegExp("assign to", "i") })
      .first()
      .check()
    await dialog.getByRole("button", { name: /^assign task$/i }).first().click()
    await expectToast(page, /task assigned/i, 30_000)
    await clearToasts(page)

    await until(
      async () => await roster(organizer, event._id),
      (rows) => (rows.find((r) => r.email === speaker.email)?.tasks.total ?? 0) > 0,
      { label: "the assigned task reached the roster" },
    )

    // ——— The speaker opens their magic link ————————————————————————————
    const portal = await context.newPage()
    const portalWatcher = armed(portal)
    await gotoStable(portal, `/portal/t/${speaker.portalToken}`, "networkidle")
    await expect(portal.getByRole("tab", { name: /profile/i }).first()).toBeVisible({
      timeout: 45_000,
    })

    // ——— Bio: typing it auto-completes the profile task ————————————————
    await gotoStable(portal, "/portal/profile", "networkidle")
    const bio = portal.locator("#profile-bio")
    await expect(bio).toBeVisible({ timeout: 30_000 })
    await fillStable(bio, "Portia has been running developer platforms for a decade.")
    await bio.blur()
    await until(
      async () =>
        (await organizer.query(api.portal.home, {
          portalToken: speaker.portalToken,
        })) as { me: { bio?: string }; tasks: Array<{ kind: string; completedAt?: number }> },
      (home) => !!home.me.bio?.includes("developer platforms"),
      { label: "the bio autosaved from the portal" },
    )

    // ——— Headshot upload through the real file input ————————————————
    const fileInput = portal.getByLabel(/choose a headshot image/i).first()
    await expect(fileInput).toBeAttached({ timeout: 20_000 })
    await fileInput.setInputFiles(FIXTURE)
    await until(
      async () =>
        (await organizer.query(api.portal.home, {
          portalToken: speaker.portalToken,
        })) as { me: { headshotUrl?: string | null; headshotId?: string | null } },
      (home) => Boolean(home.me.headshotUrl ?? home.me.headshotId),
      { timeout: 60_000, label: "the headshot round-tripped through Convex storage" },
    )

    // ——— The onboarding tasks tick themselves off ————————————————————
    await until(
      async () =>
        (await organizer.query(api.portal.home, {
          portalToken: speaker.portalToken,
        })) as { tasks: Array<{ kind: string; completedAt?: number }> },
      (home) =>
        home.tasks
          .filter((t) => t.kind === "profile" || t.kind === "headshot")
          .every((t) => !!t.completedAt),
      { label: "profile + headshot tasks auto-complete" },
    )

    // ——— And the organizer's roster updates WITHOUT a reload ————————
    await expect(row).not.toContainText(/no bio/i, { timeout: 30_000 })
    await expect(row).not.toContainText(/no headshot/i, { timeout: 30_000 })

    portalWatcher.assertClean("speaker portal")
    await portal.close()
    watcher.assertClean("speakers roster")
  })

  test("the dashboard chase list reacts to a completed task without a reload", async ({
    page,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const speaker = await freshSpeaker(organizer, event._id, "chase")

    // Give them exactly one open, confirmable task.
    await organizer.mutation(api.tasksAdmin.create, {
      eventId: event._id,
      personIds: [speaker.personId],
      title: `Confirm your travel ${unique("tv")}`,
      kind: "confirm",
      instructions: "Let us know you can make it.",
    })

    await gotoApp(page, "/app")
    const outstanding = await until(
      async () =>
        (await organizer.query(api.dashboard.overview, {
          eventId: event._id,
          now: Date.now(),
        })) as { outstandingTaskCount: number },
      (o) => o.outstandingTaskCount > 0,
      { label: "the dashboard counts the new outstanding task" },
    )
    const before = outstanding.outstandingTaskCount

    // The organizer's page stays open the whole time — no refresh below.
    const portal = await context.newPage()
    await gotoStable(portal, `/portal/t/${speaker.portalToken}`, "networkidle")
    await gotoStable(portal, "/portal/tasks", "networkidle")
    const complete = portal.getByRole("button", { name: /mark complete/i }).first()
    await expect(complete).toBeVisible({ timeout: 45_000 })
    await complete.click()

    await until(
      async () =>
        (await organizer.query(api.dashboard.overview, {
          eventId: event._id,
          now: Date.now(),
        })) as { outstandingTaskCount: number },
      (o) => o.outstandingTaskCount < before,
      { timeout: 45_000, label: "the outstanding count drops after completion" },
    )

    // The number on screen must have moved too — reactivity, not a stale render.
    await expect(async () => {
      const text = await page.locator("body").innerText()
      expect(text).toContain(String(before - 1))
    }).toPass({ timeout: 45_000 })

    await portal.close()
    watcher.assertClean("dashboard reactivity")
  })

  test("a bad portal token is refused politely", async ({ page }) => {
    const watcher = armed(page, [/portal link/i])
    await gotoStable(page, "/portal/t/definitely-not-a-token", "networkidle")
    // Either a friendly error or a bounce to the token entry — never a crash.
    const friendly = page.getByText(/link|expired|not valid|ask the organi[sz]er/i).first()
    expect(await present(friendly, 30_000)).toBe(true)
    await expect(
      page.getByText(/something went wrong|internal server error/i),
    ).toHaveCount(0)
    watcher.assertClean("bad portal token")
  })
})

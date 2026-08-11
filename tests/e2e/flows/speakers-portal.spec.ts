import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
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
  eventId: Id<"events">,
) {
  return (await organizer.query(api.dashboard.speakersRoster, {
    eventId,
  })) as unknown as Array<RosterRow>
}

/** A speaker with no bio and no headshot, freshly created for this run. */
async function freshSpeaker(
  organizer: Awaited<ReturnType<typeof organizerConvexClient>>,
  eventId: Id<"events">,
  label: string,
) {
  const email = testEmail(label)
  const lastName = `Portal${unique("p").slice(-4)}`
  const added = await organizer.mutation(api.speakersAdmin.addManual, {
    eventId,
    firstName: "Portia",
    lastName,
    email,
    company: "Portal Co",
    workflowStatus: "confirmed",
  })
  return { ...added, email, lastName }
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
    await fillStable(dialog.locator("#task-speaker-search"), speaker.lastName)
    const assignTo = dialog.getByRole("checkbox", {
      name: new RegExp(`assign to .*${speaker.lastName}`, "i"),
    })
    await expect(assignTo).toBeVisible({ timeout: 20_000 })
    await assignTo.check()
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
    // The magic link lands on the portal home for this speaker.
    await expect(portal.getByText(speaker.lastName).first()).toBeVisible({
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

  test("a file can be DROPPED on a task, and the tab count moves live", async ({
    context,
  }) => {
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const speaker = await freshSpeaker(organizer, event._id, "drop")
    await organizer.mutation(api.tasksAdmin.create, {
      eventId: event._id,
      personIds: [speaker.personId],
      title: `Send your slides ${unique("dz")}`,
      kind: "upload",
      instructions: "PDF please.",
    })

    const portal = await context.newPage()
    const watcher = armed(portal)
    await gotoStable(portal, `/portal/t/${speaker.portalToken}`, "networkidle")
    await gotoStable(portal, "/portal/tasks", "networkidle")

    // The shell owns the page heading — one PageHeader, not a per-route h1.
    await expect(
      portal.getByRole("heading", { level: 1, name: "Tasks" }),
    ).toBeVisible({ timeout: 30_000 })

    // The tab strip carries the open count.
    const tasksTab = portal.getByRole("tab", { name: /tasks/i }).first()
    await expect(tasksTab).toContainText("1", { timeout: 30_000 })

    // ——— Drop the file, rather than clicking through the picker ————————
    const zone = portal
      .getByRole("button", { name: /drop your file here/i })
      .first()
    await expect(zone).toBeVisible({ timeout: 30_000 })
    const bytes = Array.from(
      new Uint8Array(await readFile(FIXTURE)),
    )
    const transfer = await portal.evaluateHandle((raw: Array<number>) => {
      const dt = new DataTransfer()
      dt.items.add(
        new File([new Uint8Array(raw)], "slides.png", { type: "image/png" }),
      )
      return dt
    }, bytes)
    // A real drag is three events, and the middle one is the one that matters:
    // `dragover` must be prevented or the browser navigates to the file
    // instead of handing it to the page.
    await zone.dispatchEvent("dragenter", { dataTransfer: transfer })
    await zone.dispatchEvent("dragover", { dataTransfer: transfer })
    await zone.dispatchEvent("drop", { dataTransfer: transfer })

    await expectToast(portal, /organizers will review it/i, 45_000)

    // Attaching a file completes the task: it moves to Completed, the drop
    // zone folds away behind an explicit "send a new version", and the count
    // on the tab disappears — all without a reload.
    await expect(
      portal.getByRole("button", { name: /send a new version/i }).first(),
    ).toBeVisible({ timeout: 45_000 })
    await expect(tasksTab).not.toContainText("1", { timeout: 30_000 })

    watcher.assertClean("portal drag-and-drop upload")
    await portal.close()
  })

  test("scheduled times are shown in the event's timezone, not the reader's", async ({
    context,
  }) => {
    // A speaker reading this in Berlin must see the time they are on stage in
    // San Francisco. The zone abbreviation is what makes it unambiguous.
    const portal = await context.newPage()
    const watcher = armed(portal)
    await gotoStable(portal, "/portal/t/demo-ava-nakamura", "networkidle")
    await gotoStable(portal, "/portal/submissions", "networkidle")
    await expect(
      portal.getByText(/\d{1,2}:\d{2}\s?(AM|PM)\s+[A-Z]{2,5}/).first(),
    ).toBeVisible({ timeout: 45_000 })
    watcher.assertClean("portal scheduled time")
    await portal.close()
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

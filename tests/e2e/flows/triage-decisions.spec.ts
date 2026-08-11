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
 * Triage → decision → the speaker finds out. The two-phase pipeline swyx
 * demoed: staging into a queue emails nobody, committing the queue emails
 * everybody and creates their onboarding tasks.
 *
 * The judged detail is that all three surfaces agree afterwards: the table
 * (Accepted + decidedAt), the outbox (an acceptance mail), and the speaker's
 * own portal (status + tasks) — without a reload anywhere.
 */

type Submission = {
  _id: string
  title: string
  status: string
  decidedAt?: number
}

async function seedPending(
  organizer: Awaited<ReturnType<typeof organizerConvexClient>>,
  eventId: string,
  title: string,
  email: string,
) {
  const result = await organizer.mutation(api.submissions.addManual, {
    eventId,
    kind: "abstract",
    title,
    description: "Staged by the triage e2e flow.",
    status: "pending",
    participants: [
      { firstName: "Tria", lastName: "Ger", email, role: "speaker" },
    ],
  })
  return typeof result === "string" ? result : result.submissionId
}

test.describe("triage and decisions", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("search, tabs, inline status, queue banner, commit, portal", async ({
    page,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const marker = unique("tri")
    const title = `Triage Talk ${marker}`
    const speakerEmail = testEmail("triage")
    const submissionId = await seedPending(organizer, event._id, title, speakerEmail)

    await gotoApp(page, "/app/submissions")

    // ——— Tabs carry live counts ————————————————————————————————————————
    const allTab = page.getByRole("tab", { name: /^all/i }).first()
    await expect(allTab).toBeVisible({ timeout: 30_000 })
    await expect(allTab).toContainText(/\d/, { timeout: 30_000 })
    for (const label of [
      "Accepted",
      "Accept Queue",
      "Pending",
      "Decline Queue",
      "Declined",
      "Withdrawn",
      "Drafts",
    ]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(label, "i") }).first(),
      ).toBeVisible()
    }

    // ——— Search narrows to our row —————————————————————————————————————
    const search = page.getByRole("searchbox").first()
    await fillStable(search, marker)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 })
    const rows = page.getByRole("row").filter({ hasText: title })
    await expect(rows).toHaveCount(1, { timeout: 20_000 })

    // A search that matches nothing must say so, not show everything.
    await fillStable(search, `no-such-talk-${marker}`)
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 20_000 })
    await fillStable(search, marker)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 })

    // ——— Inline status pill → Accept Queue ————————————————————————————
    await page
      .getByRole("button", { name: new RegExp(`change status of ${title}`, "i") })
      .first()
      .click()
    const popover = page.getByText(/pick a status, then save/i).first()
    await expect(popover).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: /^accept queue$/i }).first().click()
    await page.getByRole("button", { name: /^save$/i }).first().click()

    await until(
      async () =>
        (await organizer.query(api.submissions.get, {
          submissionId,
        })) as Submission,
      (s) => s.status === "accept_queue",
      { label: "inline status picker staged the submission" },
    )
    await clearToasts(page)

    // ——— The queue banner appears and is explicit that nothing was sent ——
    const banner = page.getByText(/staged — ready to accept/i).first()
    await expect(banner).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/nothing has been emailed yet/i).first()).toBeVisible()

    // ——— Commit, via the confirmation dialog ————————————————————————————
    const messagesBefore = (
      (await organizer.query(api.comms.listMessages, {
        eventId: event._id,
        limit: 500,
      })) as Array<{ _id: string }>
    ).length

    await page.getByRole("button", { name: /send acceptances/i }).first().click()
    await expect(
      page.getByRole("heading", { name: /send \d+ acceptance/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page
      .getByRole("button", { name: /^send acceptances$/i })
      .last()
      .click()
    await expectToast(page, /accept|sent|email/i, 45_000)
    await clearToasts(page)

    // ——— Status flipped and stamped ————————————————————————————————————
    const decided = await until(
      async () =>
        (await organizer.query(api.submissions.get, {
          submissionId,
        })) as Submission,
      (s) => s.status === "accepted" && !!s.decidedAt,
      { label: "commit flipped the submission to Accepted with a decidedAt" },
    )
    expect(decided.decidedAt).toBeGreaterThan(0)

    // …and the table says so without a reload (Convex reactivity).
    await expect(
      page.getByRole("row").filter({ hasText: title }).getByText(/accepted/i).first(),
    ).toBeVisible({ timeout: 20_000 })

    // ——— The outbox got the acceptance mail ————————————————————————————
    const messages = await until(
      async () =>
        (await organizer.query(api.comms.listMessages, {
          eventId: event._id,
          limit: 500,
        })) as Array<{ toEmail: string; templateKey: string; body: string; status: string }>,
      (all) =>
        all.length > messagesBefore &&
        all.some((m) => m.toEmail === speakerEmail && m.templateKey === "accepted"),
      { label: "an acceptance email for our speaker" },
    )
    const mail = messages.find(
      (m) => m.toEmail === speakerEmail && m.templateKey === "accepted",
    )!
    expect(mail.body).toContain(title)
    expect(mail.body).toMatch(/\/portal\/t\/[a-z0-9]+/i)

    // ——— The speaker's own portal reflects it ————————————————————————
    const roster = (await organizer.query(api.dashboard.speakersRoster, {
      eventId: event._id,
    })) as Array<{ email: string; portalToken: string }>
    const portalToken = roster.find((s) => s.email === speakerEmail)?.portalToken
    expect(portalToken, "the accepted speaker has a portal token").toBeTruthy()

    const speakerPage = await context.newPage()
    const speakerWatcher = armed(speakerPage)
    await gotoStable(speakerPage, `/portal/t/${portalToken}`, "networkidle")
    await expect(speakerPage.getByText(title).first()).toBeVisible({ timeout: 45_000 })
    await expect(speakerPage.getByText(/accepted/i).first()).toBeVisible({
      timeout: 20_000,
    })
    // Onboarding tasks were created by the commit, not by a cron.
    await gotoStable(speakerPage, "/portal/tasks", "networkidle")
    await expect(speakerPage.getByText(/upload your headshot/i).first()).toBeVisible({
      timeout: 30_000,
    })
    speakerWatcher.assertClean("speaker portal after acceptance")
    await speakerPage.close()

    watcher.assertClean("triage → commit")
  })

  test("bulk select stages a decline queue without emailing anyone", async ({
    page,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const marker = unique("bulk")
    const titles = [`Bulk A ${marker}`, `Bulk B ${marker}`]
    const ids: Array<string> = []
    for (const title of titles) {
      ids.push(
        await seedPending(organizer, event._id, title, testEmail("bulk-decline")),
      )
    }

    const before = (
      (await organizer.query(api.comms.listMessages, {
        eventId: event._id,
        limit: 500,
      })) as Array<unknown>
    ).length

    await gotoApp(page, "/app/submissions")
    await fillStable(page.getByRole("searchbox").first(), marker)
    for (const title of titles) {
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 })
      await page.getByRole("checkbox", { name: `Select ${title}` }).first().check()
    }
    await expect(
      page.getByRole("region", { name: /bulk actions/i }).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: /move to decline queue/i }).first().click()

    for (const id of ids) {
      await until(
        async () =>
          (await organizer.query(api.submissions.get, {
            submissionId: id,
          })) as Submission,
        (s) => s.status === "decline_queue",
        { label: "bulk move staged the submission" },
      )
    }

    // Staging must be silent — this is the whole point of the two-phase model.
    const after = (
      (await organizer.query(api.comms.listMessages, {
        eventId: event._id,
        limit: 500,
      })) as Array<unknown>
    ).length
    expect(after, "staging a queue must not email anyone").toBe(before)

    await expect(page.getByText(/staged — ready to decline/i).first()).toBeVisible({
      timeout: 20_000,
    })

    // Put them back so a later run isn't looking at a stale queue.
    for (const id of ids) {
      await organizer.mutation(api.submissions.setStatus, {
        submissionId: id,
        status: "pending",
      })
    }
    watcher.assertClean("bulk staging")
  })

  test("the row drawer opens on Details / People / Reviews", async ({ page }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const list = (await organizer.query(api.submissions.list, {
      eventId: event._id,
    })) as Array<{ title: string }>
    test.skip(list.length === 0, "no submissions to open")

    await gotoApp(page, "/app/submissions")
    await page.getByRole("link", { name: list[0].title }).first().click()
    const drawer = page.getByRole("dialog").first()
    await expect(drawer).toBeVisible({ timeout: 30_000 })
    for (const tab of ["Details", "People", "Reviews"]) {
      const trigger = drawer.getByRole("tab", { name: new RegExp(`^${tab}$`, "i") }).first()
      await expect(trigger).toBeVisible({ timeout: 15_000 })
      await trigger.click()
    }
    await expect(page).toHaveURL(/[?&]id=/)
    await page.keyboard.press("Escape")
    watcher.assertClean("submission drawer")
  })
})

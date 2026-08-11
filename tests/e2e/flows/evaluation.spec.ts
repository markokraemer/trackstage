import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  ORGANIZER_STATE,
  armed,
  clearToasts,
  createSubmission,
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
 * Evaluation, end to end and with no login wall for the reviewer: the
 * organizer builds a plan and hands out a magic link; a stranger with only
 * that link scores submissions; the scores come back as an average the
 * organizer can sort on.
 *
 * The reviewer half runs in a FRESH browser context with no cookies — that is
 * the actual claim the product makes ("no login wall"), and it is the only way
 * to prove the token alone is enough.
 */

/** Narrow a possibly-absent score entry without tripping the lint rules. */
function hasScore(
  map: Record<string, { avg: number; count: number } | undefined>,
  id: string,
) {
  const entry = map[id]
  return entry !== undefined && entry.count > 0
}

test.describe("evaluation", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("create a plan, score through the magic link, see the average", async ({
    page,
    browser,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const marker = unique("ev")
    const planName = `E2E Plan ${marker}`
    const evaluatorEmail = testEmail("reviewer")
    let planId: Id<"evaluationPlans"> | undefined

    // Two submissions of our own so the queue length is deterministic.
    const titles = [`Eval One ${marker}`, `Eval Two ${marker}`]
    const submissionIds: Array<Id<"submissions">> = []
    for (const title of titles) {
      submissionIds.push(
        await createSubmission(organizer, {
          eventId: event._id,
          title,
          status: "pending",
          email: testEmail("eval-speaker"),
          firstName: "Evan",
          lastName: "Uator",
          description: "Created by the evaluation e2e flow.",
        }),
      )
    }

    try {
      // ——— Build the plan through the UI ————————————————————————————————
      await gotoApp(page, "/app/evaluation")
      await page.getByRole("button", { name: /new plan/i }).first().click()
      const dialog = page.getByRole("dialog").first()
      await expect(dialog).toBeVisible({ timeout: 30_000 })
      await fillStable(dialog.locator("#plan-name"), planName)

      // Pick exactly our two submissions.
      const search = dialog.getByLabel(/search submissions/i).first()
      for (const title of titles) {
        await fillStable(search, title)
        const include = dialog.getByRole("checkbox", { name: `Include ${title}` })
        await expect(include).toBeVisible({ timeout: 20_000 })
        await include.check()
      }
      await fillStable(search, "")

      // Evaluator.
      await fillStable(dialog.locator("#plan-evaluator"), evaluatorEmail)
      await dialog.getByRole("button", { name: /^add$/i }).first().click()
      await expect(dialog.getByText(evaluatorEmail).first()).toBeVisible({
        timeout: 15_000,
      })

      await dialog.getByRole("button", { name: /^create plan$/i }).first().click()
      await expect(dialog).toBeHidden({ timeout: 45_000 })
      await clearToasts(page)

      const plans = await until(
        async () =>
          await organizer.query(api.evaluationsAdmin.listPlans, {
            eventId: event._id,
          }),
        (list) => list.some((p) => p.name === planName),
        { label: "the new plan was created" },
      )
      planId = plans.find((p) => p.name === planName)!._id

      const detail = await organizer.query(api.evaluationsAdmin.planDetail, {
        planId,
      })
      const planSubmissionIds = detail.plan.submissionIds
      const evaluator = detail.evaluators.find((e) => e.email === evaluatorEmail)
      expect(evaluator, "the evaluator we typed was attached to the plan").toBeTruthy()
      expect(
        planSubmissionIds.length,
        "the plan has submissions to review",
      ).toBeGreaterThan(0)

      // ——— Copy the review link from the UI ————————————————————————————
      await context.grantPermissions(["clipboard-read", "clipboard-write"])
      await gotoStable(page, `/app/evaluation/${planId}`)
      const copy = page.getByRole("button", { name: /copy review link/i }).first()
      await expect(copy).toBeVisible({ timeout: 30_000 })
      await copy.click()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      expect(copied).toContain(`/review/${evaluator!.token}`)

      // ——— Score in a cookie-less context: no login wall ————————————————
      const reviewerContext = await browser.newContext()
      const reviewer = await reviewerContext.newPage()
      const reviewerWatcher = armed(reviewer)
      await gotoStable(reviewer, `/review/${evaluator!.token}`, "networkidle")

      const scored = planSubmissionIds.length >= 2 ? 2 : 1
      for (let i = 0; i < scored; i++) {
        const score = reviewer
          .getByRole("button", { name: /: 4 of 5/i })
          .first()
        await expect(score).toBeVisible({ timeout: 45_000 })
        // Score every criterion on this screen.
        const criteria = reviewer.getByRole("button", { name: /: 4 of 5/i })
        const count = await criteria.count()
        for (let c = 0; c < count; c++) await criteria.nth(c).click()
        // Select-type criteria (e.g. the default required Recommendation
        // dropdown) block save until answered — pick the first option of each.
        const selects = reviewer.getByRole("combobox")
        const selectCount = await selects.count()
        for (let s = 0; s < selectCount; s++) {
          const box = selects.nth(s)
          if ((await box.textContent())?.match(/choose|select/i)) {
            await box.click()
            await reviewer.getByRole("option").first().click()
          }
        }
        await fillStable(
          reviewer.locator("#review-comment"),
          `Reviewed by the e2e flow (${i + 1}).`,
        )
        await reviewer
          .getByRole("button", { name: /save( & next)?/i })
          .first()
          .click()
        await reviewer.waitForTimeout(1_000)
      }

      // Progress reflects what was scored.
      const progress = await until(
        async () =>
          await organizer.query(api.review.progress, {
            token: evaluator!.token,
          }),
        (p) => p.done >= scored,
        { timeout: 45_000, label: `${scored} submissions scored via the magic link` },
      )
      expect(progress.total).toBeGreaterThanOrEqual(scored)
      await expect(
        reviewer.getByText(new RegExp(`${progress.done} of ${progress.total}`, "i")).first(),
      ).toBeVisible({ timeout: 20_000 })
      reviewerWatcher.assertClean(`/review/${evaluator!.token}`)
      await reviewerContext.close()

      // ——— The organizer sees the average ————————————————————————————
      const scores = await until(
        async () =>
          (await organizer.query(api.evaluationsAdmin.scoresBySubmission, {
            eventId: event._id,
          })) as unknown as Record<
            string,
            { avg: number; count: number } | undefined
          >,
        (map) => submissionIds.some((id) => hasScore(map, id)),
        { label: "scores rolled up to the organizer" },
      )
      const withScore = submissionIds.find((id) => hasScore(scores, id))!
      expect(scores[withScore]!.avg).toBeGreaterThan(0)
      expect(scores[withScore]!.avg).toBeLessThanOrEqual(5)

      // …and the number is on screen in the plan/summary surfaces.
      await gotoStable(page, `/app/evaluation/${planId}`)
      await expect(
        page.getByText(new RegExp(`${progress.done} of ${progress.total}`, "i")).first(),
      ).toBeVisible({ timeout: 30_000 })

      watcher.assertClean("evaluation")
    } finally {
      if (planId) {
        await organizer.mutation(api.evaluationsAdmin.deletePlan, { planId }).catch(() => {})
      }
    }
  })

  test("an invalid review token is refused, not crashed", async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const watcher = armed(page, [/review link|not valid|Server Error/i])
    await gotoStable(page, `/review/${unique("bogus")}`, "networkidle")
    await expect(
      page.getByRole("heading", { name: /isn.t valid/i }).first(),
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByText(/something went wrong|internal server error/i),
    ).toHaveCount(0)
    watcher.assertClean("invalid review token")
    await context.close()
  })

  test("scores outside 1–5 are rejected by the backend", async () => {
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const plans = await organizer.query(api.evaluationsAdmin.listPlans, {
      eventId: event._id,
    })
    test.skip(plans.length === 0, "no seeded plan to probe")
    const detail = await organizer.query(api.evaluationsAdmin.planDetail, {
      planId: plans[0]._id,
    })
    test.skip(
      detail.evaluators.length === 0 || detail.plan.submissionIds.length === 0,
      "seeded plan has no evaluator or no submissions",
    )
    await expect(
      organizer.mutation(api.review.submitScores, {
        token: detail.evaluators[0].token,
        submissionId: detail.plan.submissionIds[0],
        scores: { [detail.plan.criteria[0]?.id ?? "overall"]: 9 },
      }),
    ).rejects.toThrow()
  })
})

import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  ORGANIZER_STATE,
  advance,
  anonConvexClient,
  armed,
  clearToasts,
  expectToast,
  fillStable,
  gotoApp,
  gotoStable,
  mainEvent,
  organizerConvexClient,
  present,
  unique,
  until,
} from "./_helpers"

/**
 * The form builder is the centrepiece: build a working CFP with a conditional
 * question in one pass, then prove the PUBLIC form actually behaves the way the
 * builder promised. A builder that saves state nobody can see is worthless, so
 * every assertion here ends on `/submit/:slug`, not in the editor.
 *
 * Covers: create → rename → add a question → conditional rule → required
 * toggle → close date → save → public form renders the new question and the
 * condition works → copy public link → close the form → public says closed.
 */

test.describe("form builder", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("build a form with a conditional question and see it live on the public page", async ({
    page,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const marker = unique("fb")
    const originalName = `Builder Form ${marker}`
    const renamedTo = `Renamed Form ${marker}`
    const triggerLabel = `Delivery mode ${marker}`
    const dependentLabel = `Room requirements ${marker}`
    let formId: Id<"forms"> | undefined

    try {
      // ——— Create ————————————————————————————————————————————————————————
      // The event the shell lands on is the one the form belongs to; the
      // helper pins it to the demo event before we start.
      await gotoApp(page, "/app/forms")
      await page.getByRole("link", { name: /new form/i }).first().click()
      await expect(
        page.getByRole("heading", { name: /new submission form/i }).first(),
      ).toBeVisible({ timeout: 30_000 })
      await fillStable(page.getByLabel(/form name/i).first(), originalName)
      await page.getByRole("button", { name: /^create form$/i }).first().click()
      await expect(page).toHaveURL(/\/app\/forms\/[a-z0-9]+/i, { timeout: 45_000 })
      formId = page.url().split("/").pop()!.split("?")[0] as Id<"forms">
      await expectToast(page, /form created/i, 30_000)
      await clearToasts(page)

      // ——— Rename (step 1/2 of the rail) ————————————————————————————————
      await page.getByRole("button", { name: /welcome screen/i }).first().click()
      const internalName = page.getByLabel(/internal name/i).first()
      if (await present(internalName, 8_000)) {
        await fillStable(internalName, renamedTo)
      } else {
        // The name may live on the Setup step depending on layout churn.
        await page.getByRole("button", { name: /^setup$/i }).first().click()
        await fillStable(page.getByLabel(/form name|internal name/i).first(), renamedTo)
      }

      // ——— Questions: add a trigger + a dependent with a showIf rule ————
      await page.getByRole("button", { name: /submission questions/i }).first().click()
      await expect(
        page.getByRole("button", { name: /add question/i }).first(),
      ).toBeVisible({ timeout: 20_000 })

      // 1. A dropdown that will drive the condition.
      await page.getByRole("button", { name: /add question/i }).first().click()
      await page.getByRole("menuitem", { name: /^dropdown$/i }).first().click()
      const drawer = page.getByRole("dialog").first()
      await expect(drawer).toBeVisible({ timeout: 20_000 })
      await fillStable(drawer.getByLabel(/^question$/i).first(), triggerLabel)
      // Give it two known options.
      const optionInputs = drawer.getByLabel(/answer option \d+/i)
      while ((await optionInputs.count()) < 2) {
        await drawer.getByRole("button", { name: /add option/i }).first().click()
      }
      await fillStable(optionInputs.nth(0), "In person")
      await fillStable(optionInputs.nth(1), "Remote")
      await drawer.getByRole("button", { name: /^done$/i }).first().click()
      await expect(drawer).toBeHidden({ timeout: 20_000 })

      // 2. A short-text question that only shows for "Remote".
      await page.getByRole("button", { name: /add (another )?question/i }).last().click()
      await page.getByRole("menuitem", { name: /short text/i }).first().click()
      const drawer2 = page.getByRole("dialog").first()
      await expect(drawer2).toBeVisible({ timeout: 20_000 })
      await fillStable(drawer2.getByLabel(/^question$/i).first(), dependentLabel)
      await drawer2
        .getByRole("switch", { name: /only show this question sometimes/i })
        .first()
        .click()
      await drawer2.getByLabel(/trigger question/i).first().click()
      await page.getByRole("option", { name: triggerLabel }).first().click()
      await drawer2.getByLabel(/trigger answer/i).first().click()
      await page.getByRole("option", { name: "Remote", exact: true }).first().click()
      await drawer2.getByRole("button", { name: /^done$/i }).first().click()
      await expect(drawer2).toBeHidden({ timeout: 20_000 })

      // The row summarises the rule the organizer just built.
      await expect(
        page.getByText(new RegExp(`shows only when.*${triggerLabel}`, "i")).first(),
      ).toBeVisible({ timeout: 20_000 })

      // ——— Required toggle ————————————————————————————————————————————————
      const requiredToggle = page
        .getByRole("switch", { name: new RegExp(`${triggerLabel} is required`, "i") })
        .first()
      await expect(requiredToggle).toBeVisible({ timeout: 20_000 })
      await requiredToggle.click()
      await expect(requiredToggle).toBeChecked({ timeout: 10_000 })

      // ——— Save ————————————————————————————————————————————————————————————
      await page.getByRole("button", { name: /^save$/i }).first().click()
      await expectToast(page, /form saved/i, 30_000)
      await clearToasts(page)

      // Everything above must have reached the database.
      const saved = await until(
        async () => await organizer.query(api.forms.get, { formId: formId! }),
        (form) =>
          form.internalName === renamedTo &&
          form.questions.some((q) => q.label === dependentLabel && !!q.showIf) &&
          form.questions.some((q) => q.label === triggerLabel && q.required),
        { label: "the builder's edits persisted" },
      )
      const slug = saved.slug

      // ——— The public form is the real proof ————————————————————————————
      const publicPage = await context.newPage()
      const publicWatcher = armed(publicPage)
      await gotoStable(publicPage, `/submit/${slug}`, "networkidle")
      await advance(
        publicPage,
        /^continue$/i,
        publicPage.getByRole("heading", { name: /your email address/i }),
      )
      await fillStable(publicPage.locator("#submit-email"), `${marker}@example.com`)
      await advance(
        publicPage,
        /^continue$/i,
        publicPage.getByRole("heading", { name: /your submission/i }),
      )

      const publicForm = (await anonConvexClient().query(api.submit.getForm, {
        slug,
      })) as { questions: Array<{ id: string; label: string }> }
      const triggerId = publicForm.questions.find((q) => q.label === triggerLabel)!.id
      const dependentId = publicForm.questions.find((q) => q.label === dependentLabel)!.id

      // New question is on the form; the conditional one is hidden until asked for.
      await expect(publicPage.locator(`#question-${triggerId}`)).toBeVisible({
        timeout: 20_000,
      })
      await expect(publicPage.locator(`#question-${dependentId}`)).toHaveCount(0)
      await publicPage.locator(`#question-${triggerId}`).click()
      await publicPage
        .getByRole("option", { name: "In person", exact: true })
        .first()
        .click()
      await expect(publicPage.locator(`#question-${dependentId}`)).toHaveCount(0)
      await publicPage.locator(`#question-${triggerId}`).click()
      await publicPage
        .getByRole("option", { name: "Remote", exact: true })
        .first()
        .click()
      await expect(publicPage.locator(`#question-${dependentId}`)).toBeVisible({
        timeout: 15_000,
      })
      publicWatcher.assertClean(`/submit/${slug}`)

      // ——— Copy public link (swyx hunted for this — it must be one click) —
      await context.grantPermissions(["clipboard-read", "clipboard-write"])
      await gotoApp(page, "/app/forms")
      const card = page
        .locator("div")
        .filter({ hasText: renamedTo })
        .last()
      await expect(card).toBeVisible({ timeout: 30_000 })
      await page.getByRole("button", { name: /copy public link/i }).first().click()
      await expectToast(page, /public link copied/i, 20_000)
      const clipboard = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboard).toContain(`/submit/${slug}`)
      await clearToasts(page)

      // ——— Close the form → the public page says so ————————————————————
      await organizer.mutation(api.forms.update, {
        formId,
        patch: { status: "closed" },
      })
      await gotoStable(publicPage, `/submit/${slug}`, "networkidle")
      await expect(
        publicPage
          .getByRole("heading", { name: /this call for speakers is closed/i })
          .first(),
      ).toBeVisible({ timeout: 30_000 })
      await expect(
        publicPage.getByRole("button", { name: /^continue$/i }),
      ).toHaveCount(0)
      await publicPage.close()

      watcher.assertClean("form builder")
    } finally {
      if (formId) {
        await organizer.mutation(api.forms.remove, { formId }).catch(() => {})
      }
    }
  })

  test("locked system questions cannot be disabled", async ({ page }) => {
    // Safe defaults are a product rule: Title/Description are always asked, so
    // the builder must not offer a way to switch them off.
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const forms = await organizer.query(api.forms.list, {
      eventId: event._id,
    })
    const cfp = forms.find((f) => f.slug === "cfp") ?? forms[0]
    test.skip(!cfp, "no form to inspect")

    await gotoStable(page, `/app/forms/${cfp._id}`)
    await page.getByRole("button", { name: /submission questions/i }).first().click()
    await expect(page.getByText(/^locked$/i).first()).toBeVisible({ timeout: 30_000 })

    const titleEnabled = page
      .getByRole("switch", { name: /session title is shown on the form/i })
      .first()
    if (await present(titleEnabled, 5_000)) {
      await expect(titleEnabled).toBeDisabled()
    }

    // The backend enforces it too — the UI is not the only guard.
    const full = await organizer.query(api.forms.get, { formId: cfp._id })
    await expect(
      organizer.mutation(api.forms.update, {
        formId: cfp._id,
        patch: {
          questions: full.questions.map((q) =>
            q.id === "title" ? { ...q, enabled: false } : q,
          ),
        },
      }),
    ).rejects.toThrow(/required|locked/i)

    watcher.assertClean("locked questions")
  })
})

import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
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
 * every assertion here ends on `/submit/:eventSlug/:formSlug`, not in the editor.
 *
 * Covers: create → rename → add a question → conditional rule → required
 * toggle → close date → save → public form renders the new question and the
 * condition works → copy public link → close the form → public says closed.
 */

/**
 * Close the question editor. "Done" only calls `onOpenChange(false)` — every
 * edit is already applied live — so Escape is exactly equivalent and, unlike
 * clicking, doesn't need the button to be *stable*: the drawer animates and
 * re-renders continuously while open, which starves Playwright's actionability
 * check (observed: 36 stability retries, then a timeout).
 */
/**
 * Move to a step in the builder's rail. The click can land before the editor
 * has hydrated, in which case nothing happens and the next assertion fails on
 * a screen that looks fine — so click until the step's own content shows up.
 */
async function goToStep(page: Page, step: RegExp, content: Locator) {
  await expect(async () => {
    if (await content.first().isVisible().catch(() => false)) return
    await page.getByRole("button", { name: step }).first().click({ timeout: 5_000 })
    await expect(content.first()).toBeVisible({ timeout: 4_000 })
  }).toPass({ timeout: 45_000 })
}

/**
 * "+ Add question" → pick a type → the editor drawer opens. The trigger is a
 * dropdown menu, so a click that lands mid-render opens nothing; retry the
 * whole gesture until the drawer is actually up. The button is labelled "Add
 * question" in the header and "Add another question" under the list — either
 * will do.
 */
async function addQuestion(page: Page, type: RegExp) {
  const drawer = page.getByRole("dialog").first()
  await expect(async () => {
    if (await drawer.isVisible().catch(() => false)) return
    await page
      .getByRole("button", { name: /add (another )?question/i })
      .first()
      .click({ timeout: 5_000 })
    await page
      .getByRole("menuitem", { name: type })
      .first()
      .click({ timeout: 5_000 })
    await expect(drawer).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 45_000 })
  return drawer
}

async function closeQuestionEditor(page: Page, drawer: Locator) {
  await page.keyboard.press("Escape")
  if (await present(drawer, 2_000)) {
    await drawer
      .getByRole("button", { name: /^done$/i })
      .first()
      .click({ force: true })
  }
  await expect(drawer).toBeHidden({ timeout: 20_000 })
}

test.describe("form builder", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("build a form with a conditional question and see it live on the public page", async ({
    page,
    context,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const eventId = async () => (await mainEvent(organizer))._id
    const marker = unique("fb")
    const originalName = `Builder Form ${marker}`
    const renamedTo = `Renamed Form ${marker}`
    const triggerLabel = `Delivery mode ${marker}`
    const dependentLabel = `Room requirements ${marker}`
    let formId: Id<"forms"> | undefined

    try {
      // ——— Create ————————————————————————————————————————————————————————
      // The event the shell lands on is the one the form belongs to; the
      // helper pins it to the demo event before we start. "New form" opens a
      // DIALOG over the Forms list (`?new=1` — the old `/forms/new` address
      // redirects here with the dialog already open), not a separate page.
      await gotoApp(page, "/app/forms")
      await page.getByRole("link", { name: /new form/i }).first().click()
      const createDialog = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("heading", { name: /new submission form/i }) })
      await expect(createDialog).toBeVisible({ timeout: 30_000 })
      await expect(page).toHaveURL(/[?&]new=/, { timeout: 10_000 })
      await fillStable(createDialog.getByLabel(/form name/i).first(), originalName)
      await createDialog
        .getByRole("button", { name: /^create form$/i })
        .first()
        .click()
      // Lands on the canonical `/app/:workspaceSlug/:eventSlug/forms/:id`
      // editor address, not the bare legacy `/app/forms/:id` shape.
      await expect(page).toHaveURL(
        /\/app\/(?:[^/]+\/[^/]+\/)?forms\/[a-z0-9]+/i,
        { timeout: 45_000 },
      )
      // Resolve the id from the backend rather than by slicing the URL: the
      // editor adds query state (`?step=…`) and can gain trailing segments, and
      // a mis-sliced id fails later as an opaque ArgumentValidationError.
      formId = (
        await until(
          async () =>
            await organizer.query(api.forms.list, { eventId: await eventId() }),
          (forms) => forms.some((f) => f.internalName === originalName),
          { label: `the new form "${originalName}" exists` },
        )
      ).find((f) => f.internalName === originalName)!._id
      await expectToast(page, /form created/i, 30_000)
      await clearToasts(page)

      // ——— Rename (step 1/2 of the rail) ————————————————————————————————
      const internalName = page.getByLabel(/internal form name/i).first()
      await goToStep(page, /welcome screen/i, internalName)
      if (await present(internalName, 8_000)) {
        await fillStable(internalName, renamedTo)
      } else {
        // The name may live on the Setup step depending on layout churn.
        await page.getByRole("button", { name: /^setup$/i }).first().click()
        await fillStable(
          page.getByLabel(/internal form name|form name/i).first(),
          renamedTo,
        )
      }

      // ——— Questions: add a trigger + a dependent with a showIf rule ————
      await goToStep(
        page,
        /submission questions/i,
        page.getByRole("button", { name: /add question/i }),
      )

      // 1. A dropdown that will drive the condition.
      const drawer = await addQuestion(page, /^dropdown/i)
      await fillStable(drawer.getByLabel(/^question/i).first(), triggerLabel)
      // Give it two known options. Adding one is a re-render, so assert the
      // count each time rather than looping on a stale `count()`.
      const optionInputs = drawer.getByLabel(/answer option \d+/i)
      for (let want = (await optionInputs.count()) || 0; want < 2; want++) {
        await drawer
          .getByRole("button", { name: /add option/i })
          .first()
          .click({ force: true })
        await expect(optionInputs).toHaveCount(want + 1, { timeout: 10_000 })
      }
      await expect(optionInputs).toHaveCount(2, { timeout: 10_000 })
      await fillStable(optionInputs.nth(0), "In person")
      await fillStable(optionInputs.nth(1), "Remote")
      await closeQuestionEditor(page, drawer)

      // 2. A short-text question that only shows for "Remote".
      const drawer2 = await addQuestion(page, /^short text/i)
      await fillStable(drawer2.getByLabel(/^question/i).first(), dependentLabel)
      await drawer2
        .getByRole("switch", { name: /only show this question sometimes/i })
        .first()
        .click()
      await drawer2.getByLabel(/trigger question/i).first().click()
      await page.getByRole("option", { name: triggerLabel }).first().click()
      await drawer2.getByLabel(/trigger answer/i).first().click()
      await page.getByRole("option", { name: "Remote", exact: true }).first().click()
      await closeQuestionEditor(page, drawer2)

      // The row summarises the rule the organizer just built.
      await expect(
        page.getByText(/shows only when/i).first(),
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
      // The canonical public address — fully hierarchical since the URL hard
      // pass: /submit/:workspaceSlug/:eventSlug/:formSlug (docs/memory/
      // DECISIONS.md). The 2-segment shape still resolves via 307, but the
      // copy-link button copies canonical, so assert canonical.
      const publicPath = `/submit/${saved.workspaceSlug}/${saved.eventSlug}/${slug}`

      // ——— The public form is the real proof ————————————————————————————
      const publicPage = await context.newPage()
      const publicWatcher = armed(publicPage)
      await gotoStable(publicPage, publicPath, "networkidle")
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
        eventSlug: saved.eventSlug,
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
      publicWatcher.assertClean(publicPath)

      // ——— Copy public link (swyx hunted for this — it must be one click) —
      await context.grantPermissions(["clipboard-read", "clipboard-write"])
      await gotoApp(page, "/app/forms")
      // Scope to OUR card. The forms list also holds the seeded CFP, and an
      // unscoped "Copy public link" copies whichever card renders first — the
      // assertion below then compares our slug against the seeded CFP's.
      const card = page
        .locator("div")
        .filter({ has: page.getByRole("button", { name: `More actions for ${renamedTo}` }) })
        .last()
      await expect(card).toBeVisible({ timeout: 30_000 })
      await card.getByRole("button", { name: /copy public link/i }).first().click()
      // The clipboard is the assertion that matters — the toast is a courtesy
      // and can be gone by the time we look (Sonner auto-dismisses, and this
      // step runs after several earlier toasts).
      await expect(async () => {
        const clipboard = await page.evaluate(() => navigator.clipboard.readText())
        expect(clipboard).toContain(publicPath)
      }).toPass({ timeout: 20_000 })
      await clearToasts(page)

      // ——— Close the form → the public page says so ————————————————————
      await organizer.mutation(api.forms.update, {
        formId,
        patch: { status: "closed" },
      })
      await publicPage.close()
      // Check the closed screen from a CLEAN context: `publicPage` is parked
      // mid-wizard and the submit flow restores its progress from
      // sessionStorage, so it would resume the form instead of showing the
      // closed notice. A first-time visitor is the case that matters.
      const closedContext = await context.browser()!.newContext()
      const closedPage = await closedContext.newPage()
      await gotoStable(closedPage, publicPath, "networkidle")
      await expect(
        closedPage
          .getByRole("heading", { name: /this call for speakers is closed/i })
          .first(),
      ).toBeVisible({ timeout: 30_000 })
      await expect(
        closedPage.getByRole("button", { name: /^continue$/i }),
      ).toHaveCount(0)
      await closedContext.close()

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
    await goToStep(page, /submission questions/i, page.getByText(/^locked$/i))

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

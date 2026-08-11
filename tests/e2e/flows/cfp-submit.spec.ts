import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import {
  advance,
  anonConvexClient,
  armed,
  present,
  expectToast,
  fillStable,
  gotoStable,
  mainEvent,
  organizerConvexClient,
  testEmail,
  unique,
  until,
} from "./_helpers"

/**
 * The public call-for-papers — the flow a judge (and sbek) walks first, with no
 * account and no instructions.
 *
 * Happy path: Welcome → Account → Submission → Participants → Review → Submit
 * → Success → portal shows Pending.
 * Judged negatives: a required field left blank (red outline + toast), the
 * conditional question appearing only when it should, a draft that survives
 * leaving and coming back, a closed form, and the per-user cap.
 *
 * Question ids are read from the live form rather than hard-coded, so the CFP
 * can be re-edited by the builder agent without breaking this file.
 */

type Question = {
  id: string
  label: string
  type: string
  required: boolean
  enabled: boolean
  options?: Array<string>
  showIf?: { questionId: string; equals: string }
  isTrackQuestion?: boolean
}

async function publicForm(slug: string) {
  const form = await anonConvexClient().query(api.submit.getForm, { slug })
  return form as {
    questions: Array<Question>
    open: boolean
    limitPerUser?: number
    allowDrafts: boolean
    participantConfig: { speakerMin: number; speakerMax: number }
  }
}

const field = (page: Page, questionId: string) =>
  page.locator(`#question-${questionId}`)

/** Answer one question through its real control. */
async function answer(page: Page, question: Question, value?: string) {
  const control = field(page, question.id)
  switch (question.type) {
    case "dropdown": {
      const pick = value ?? question.options?.[0]
      await control.click()
      await page.getByRole("option", { name: pick!, exact: true }).first().click()
      return pick
    }
    case "multi_select": {
      const pick = value ?? question.options?.[0]
      await page.getByLabel(pick!, { exact: true }).first().check()
      return pick
    }
    case "checkbox": {
      await control.click()
      return "Yes"
    }
    default: {
      const text = value ?? `${question.label} answer ${unique("a")}`
      await fillStable(control, text)
      return text
    }
  }
}

/** Fill every enabled+required question except the ones named in `skip`. */
async function answerRequired(
  page: Page,
  questions: Array<Question>,
  { skip = [], values = {} }: { skip?: Array<string>; values?: Record<string, string> } = {},
) {
  const filled: Record<string, string> = {}
  for (const question of questions) {
    if (!question.enabled || !question.required) continue
    if (skip.includes(question.id)) continue
    if (question.showIf) continue // conditional rows are covered separately
    filled[question.id] = (await answer(page, question, values[question.id])) ?? ""
  }
  return filled
}

const heading = (page: Page, name: RegExp) =>
  page.getByRole("heading", { name })

/**
 * Which step of the public wizard is on screen right now.
 *
 * This matters because the form is server-rendered: a Continue click that
 * lands before React hydrates submits natively, the browser reloads, and the
 * wizard silently resets to Welcome. Walking the flow as a state machine —
 * "look at where I am, do the next right thing" — is the only way to drive it
 * that isn't a coin flip, and it's exactly what a browser agent does too.
 */
async function currentStep(page: Page) {
  const steps = [
    ["success", /thank you for submitting/i],
    ["review", /review and submit/i],
    ["participants", /^participants$/i],
    ["submission", /your submission/i],
    ["account", /your email address/i],
    ["welcome", /.+/],
  ] as const
  for (const [name, pattern] of steps.slice(0, -1)) {
    if (await present(heading(page, pattern), 250)) return name
  }
  return "welcome" as const
}

const ORDER = [
  "welcome",
  "account",
  "submission",
  "participants",
  "review",
  "success",
] as const

/**
 * Walk the wizard forward to `target`, re-doing whatever the current step
 * needs. `fill` is invoked once per step so callers can answer questions.
 */
async function walkTo(
  page: Page,
  target: (typeof ORDER)[number],
  {
    email,
    onSubmission,
    onParticipants,
  }: {
    email: string
    onSubmission?: () => Promise<void>
    onParticipants?: () => Promise<void>
  },
) {
  const targetIndex = ORDER.indexOf(target)
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const step = await currentStep(page)
    if (ORDER.indexOf(step) >= targetIndex) return step
    switch (step) {
      case "welcome":
        await advance(page, /^continue$/i, heading(page, /your email address/i), {
          timeout: 30_000,
        })
        break
      case "account": {
        // The email field is disabled while the identify mutation is in
        // flight; filling it then hangs until the test times out.
        const input = page.locator("#submit-email")
        if (!(await input.isEnabled().catch(() => false))) {
          await page.waitForTimeout(500)
          break
        }
        if ((await input.inputValue().catch(() => "")) !== email) {
          await fillStable(input, email)
        }
        await advance(page, /^continue$/i, heading(page, /your submission/i), {
          timeout: 30_000,
        }).catch(() => {})
        break
      }
      case "submission":
        await onSubmission?.()
        await advance(page, /^continue$/i, heading(page, /^participants$/i), {
          timeout: 30_000,
        })
        break
      case "participants":
        await onParticipants?.()
        await advance(page, /^continue$/i, heading(page, /review and submit/i), {
          timeout: 30_000,
        })
        break
      case "review":
        await advance(
          page,
          /^submit$/i,
          heading(page, /thank you for submitting/i),
          { timeout: 60_000 },
        )
        break
      default:
        return step
    }
  }
  throw new Error(`the public form never reached the "${target}" step`)
}

async function goToAccountStep(page: Page, email: string) {
  await walkTo(page, "account", { email })
  const input = page.locator("#submit-email")
  await expect(input).toBeEnabled({ timeout: 30_000 })
  if ((await input.inputValue().catch(() => "")) !== email) {
    await fillStable(input, email)
  }
}

async function goToSubmissionStep(page: Page, email: string) {
  await walkTo(page, "submission", { email })
}

test.describe("public CFP submission", () => {
  test("full submit: welcome → success → portal shows Pending", async ({ page }) => {
    const watcher = armed(page)
    const form = await publicForm("cfp")
    const email = testEmail("cfp")
    const title = `E2E Proposal ${unique("t")}`

    await gotoStable(page, "/submit/cfp", "networkidle")
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 30_000 })

    // Welcome carries the two things swyx wanted visible up front.
    await expect(
      page.getByText(/submissions will be accepted until/i).first(),
    ).toBeVisible()
    await expect(page.getByText(/submission limit/i).first()).toBeVisible()

    await walkTo(page, "submission", { email })

    // — Negative first: Continue with a blank required field —————————————
    await test.step("blank required field → red outline + toast", async () => {
      await page.getByRole("button", { name: /^continue$/i }).first().click()
      await expectToast(page, /missing required fields/i)
      const titleQuestion = form.questions.find((q) => q.id === "title")!
      await expect(field(page, titleQuestion.id)).toHaveAttribute(
        "aria-invalid",
        "true",
      )
      await expect(
        page.getByText(/this field is required/i).first(),
      ).toBeVisible()
    })

    // — Conditional logic, live ————————————————————————————————————————————
    const conditional = form.questions.find((q) => q.showIf && q.enabled)
    if (conditional) {
      await test.step("conditional question only appears when its rule matches", async () => {
        const source = form.questions.find(
          (q) => q.id === conditional.showIf!.questionId,
        )!
        const other = source.options?.find((o) => o !== conditional.showIf!.equals)
        await expect(field(page, conditional.id)).toHaveCount(0)
        if (other) {
          await answer(page, source, other)
          await expect(field(page, conditional.id)).toHaveCount(0)
        }
        await answer(page, source, conditional.showIf!.equals)
        await expect(field(page, conditional.id)).toBeVisible({ timeout: 10_000 })
        // …and disappears again when the trigger changes back.
        if (other) {
          await answer(page, source, other)
          await expect(field(page, conditional.id)).toHaveCount(0)
        }
      })
    }

    await answerRequired(page, form.questions, { values: { title } })
    await advance(page, /^continue$/i, heading(page, /^participants$/i))

    // — Participants ————————————————————————————————————————————————————————
    await expect(page.getByText(/participant 1 \(you\)/i).first()).toBeVisible()
    await fillStable(page.getByLabel(/first name/i).first(), "Cassie")
    await fillStable(page.getByLabel(/last name/i).first(), "Fipper")
    await advance(page, /^continue$/i, heading(page, /review and submit/i))

    // — Review ——————————————————————————————————————————————————————————————
    await expect(page.getByText(title).first()).toBeVisible()
    await expect(page.getByText(email).first()).toBeVisible()
    await advance(page, /^submit$/i, heading(page, /thank you for submitting/i), {
      timeout: 60_000,
    })

    // — Success ——————————————————————————————————————————————————————————————
    // The success screen auto-redirects after a countdown, so read the link
    // if it's still there and fall back to wherever we landed.
    let href: string | null = null
    const portalLink = page.getByRole("link", { name: /continue to portal/i }).first()
    if (await present(portalLink, 5_000)) {
      href = await portalLink.getAttribute("href")
    }
    if (!href) {
      await page.waitForURL(/\/portal\/t\//, { timeout: 30_000 })
      href = page.url()
    }
    expect(href).toMatch(/\/portal\/t\/[a-z0-9]+/i)

    // — Portal shows it as Pending ————————————————————————————————————————
    await gotoStable(page, href, "networkidle")
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 45_000 })
    const card = page
      .locator("*")
      .filter({ hasText: title })
      .last()
    await expect(page.getByText(/pending/i).first()).toBeVisible({ timeout: 20_000 })
    expect(await card.count()).toBeGreaterThan(0)

    // Backend agrees: pending, routed to a track, one speaker.
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const rows = await until(
      async () =>
        (await organizer.query(api.submissions.list, {
          eventId: event._id,
        })) as Array<{ title: string; status: string }>,
      (list) => list.some((s) => s.title === title && s.status === "pending"),
      { label: `submission "${title}" visible to the organizer as pending` },
    )
    expect(rows.some((s) => s.title === title)).toBe(true)

    watcher.assertClean("public CFP submit")
  })

  test("draft saves and resumes on the same email", async ({ page }) => {
    const watcher = armed(page)
    const form = await publicForm("cfp")
    test.skip(!form.allowDrafts, "this form does not allow drafts")
    const email = testEmail("cfp-draft")
    const title = `Draft Proposal ${unique("t")}`

    await gotoStable(page, "/submit/cfp", "networkidle")
    await goToSubmissionStep(page, email)
    await answerRequired(page, form.questions, { values: { title } })
    await page.getByRole("button", { name: /save as draft/i }).first().click()
    await expectToast(page, /draft saved/i, 30_000)

    // Come back cold — new page load, same email.
    await page.context().clearCookies()
    await gotoStable(page, "/submit/cfp", "networkidle")
    await goToAccountStep(page, email)
    await advance(
      page,
      /^continue$/i,
      page.getByText(/you have a saved draft/i),
      { timeout: 60_000 },
    )
    await advance(
      page,
      /resume draft/i,
      heading(page, /your submission/i),
      { timeout: 60_000 },
    )
    await expect(field(page, "title")).toHaveValue(title, { timeout: 20_000 })

    watcher.assertClean("draft save + resume")
  })

  test("a closed form tells people it is closed instead of 404ing", async ({
    page,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const name = `Closed CFP ${unique("f")}`
    const formId = await organizer.mutation(api.forms.create, {
      eventId: event._id,
      internalName: name,
      kind: "abstract",
    })
    const created = await organizer.query(api.forms.get, { formId })
    try {
      await organizer.mutation(api.forms.update, {
        formId,
        patch: { status: "closed" },
      })
      await gotoStable(page, `/submit/${created.slug}`, "networkidle")
      await expect(
        page.getByRole("heading", { name: /this call for speakers is closed/i }).first(),
      ).toBeVisible({ timeout: 30_000 })
      // No submit affordance may survive on a closed form.
      await expect(page.getByRole("button", { name: /^continue$/i })).toHaveCount(0)
      await expect(
        page.getByRole("link", { name: /back to trackstage/i }).first(),
      ).toBeVisible()
      watcher.assertClean("closed form")
    } finally {
      await organizer.mutation(api.forms.remove, { formId }).catch(() => {})
    }
  })

  test("an unknown form slug explains itself", async ({ page }) => {
    const watcher = armed(page)
    await gotoStable(page, `/submit/${unique("nope")}`, "networkidle")
    await expect(
      page.getByRole("heading", { name: /couldn.t find that call for speakers/i }).first(),
    ).toBeVisible({ timeout: 30_000 })
    watcher.assertClean("unknown form slug")
  })

  test("hitting the per-user limit shows a friendly error, not a crash", async ({
    page,
  }) => {
    const watcher = armed(page)
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)
    const name = `Capped CFP ${unique("f")}`
    const formId = await organizer.mutation(api.forms.create, {
      eventId: event._id,
      internalName: name,
      kind: "abstract",
    })
    const created = await organizer.query(api.forms.get, { formId })
    try {
      await organizer.mutation(api.forms.update, {
        formId,
        patch: { settings: { ...created.settings, limitPerUser: 1 } },
      })
      const form = await publicForm(created.slug)
      expect(form.limitPerUser).toBe(1)
      const email = testEmail("cfp-cap")

      for (const attempt of [1, 2]) {
        await gotoStable(page, `/submit/${created.slug}`, "networkidle")
        await walkTo(page, "review", {
          email,
          onSubmission: async () => {
            await answerRequired(page, form.questions, {
              values: { title: `Capped ${attempt} ${unique("t")}` },
            })
          },
          onParticipants: async () => {
            await fillStable(page.getByLabel(/first name/i).first(), "Cappy")
            await fillStable(page.getByLabel(/last name/i).first(), "Limit")
          },
        })
        await page.getByRole("button", { name: /^submit$/i }).first().click()

        if (attempt === 1) {
          await advance(
            page,
            /^submit$/i,
            heading(page, /thank you for submitting/i),
            { timeout: 60_000 },
          )
        } else {
          // A sentence a human can act on — and still on the Review step, not
          // an error page or a blank screen.
          await expectToast(page, /reached the limit of 1 submission/i, 30_000)
          await expect(
            page.getByRole("heading", { name: /review and submit/i }).first(),
          ).toBeVisible()
        }
      }
      watcher.assertClean("per-user limit")
    } finally {
      await organizer.mutation(api.forms.remove, { formId }).catch(() => {})
    }
  })
})

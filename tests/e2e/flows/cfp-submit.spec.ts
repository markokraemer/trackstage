import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import {
  MAIN_EVENT_SLUG,
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

/**
 * The canonical public address of a form (docs/memory/DECISIONS.md, "Public URL
 * scheme is hierarchical"). Form slugs are unique per EVENT, so both segments
 * name one — `/submit/cfp` alone is the legacy shape, asserted separately.
 */
const submitPath = (formSlug: string, eventSlug = MAIN_EVENT_SLUG) =>
  `/submit/${eventSlug}/${formSlug}`

async function publicForm(slug: string, eventSlug = MAIN_EVENT_SLUG) {
  const form = await anonConvexClient().query(api.submit.getForm, {
    slug,
    eventSlug,
  })
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

/**
 * The sign-in link the server mailed to `email`, read back out of the outbox.
 *
 * Test addresses end in `@example.com`, which never leaves the deployment —
 * `deliverPending` files them as fully rendered "preview" rows instead — so the
 * outbox IS the inbox here. Returns a same-origin path so `gotoStable` can use
 * the test's baseURL rather than whatever `SITE_URL` the backend was built with.
 */
async function signInLinkFor(email: string) {
  const organizer = await organizerConvexClient()
  const event = await mainEvent(organizer)
  const rows = await until(
    async () =>
      (await organizer.query(api.comms.listMessages, {
        eventId: event._id,
        limit: 500,
      })) as Array<{ templateKey?: string; toEmail: string; body: string }>,
    (messages) =>
      messages.some((m) => m.templateKey === "portal_link" && m.toEmail === email),
    { label: `a sign-in link emailed to ${email}` },
  )
  const mail = rows.find(
    (m) => m.templateKey === "portal_link" && m.toEmail === email,
  )!
  const link = mail.body.match(/\/submit\/[^\s]+\?t=[A-Za-z0-9._-]+/)?.[0]
  if (!link) {
    throw new Error(`the sign-in email carried no usable link: ${mail.body}`)
  }
  return link
}

/** The portal token behind an address, for tests that need to arrive signed in. */
async function portalTokenFor(email: string) {
  return (await signInLinkFor(email)).split("?t=")[1]
}

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
  let stalledSince: number | null = null
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    // A reseed purges every row belonging to the demo event — including a form
    // this test created seconds ago — and the public page then says the call
    // doesn't exist. Fail fast so the retry starts over instead of spending
    // the whole budget clicking a Continue button that will never appear.
    if (await present(heading(page, /couldn.t find that call for speakers/i), 250)) {
      throw new Error(
        "the form this test created was purged mid-run (deployment reseeded) — retrying is the fix",
      )
    }
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
          stalledSince ??= Date.now()
          // A "Checking…" that never resolves means the browser's Convex
          // websocket dropped — which happens constantly here because other
          // agents push functions to the shared deployment while we run. The
          // mutation itself is fast (measured at 120-400ms against the same
          // backend), so the fix is the one a real user would reach for:
          // reload, which re-establishes the socket.
          if (Date.now() - stalledSince > 20_000) {
            await gotoStable(page, page.url(), "networkidle")
            stalledSince = null
          } else {
            await page.waitForTimeout(500)
          }
          break
        }
        stalledSince = null
        if ((await input.inputValue().catch(() => "")) !== email) {
          await fillStable(input, email)
        }
        // Click Continue ONCE and then wait. `advance()` is wrong here: it
        // re-clicks every few seconds, and while `identify` is in flight the
        // button is disabled, so every retry fails and the step never settles.
        // Verified against the real page — this transition takes about a
        // second when it is left alone.
        await page
          .getByRole("button", { name: /^continue$/i })
          .first()
          .click({ timeout: 10_000 })
          .catch(() => {})
        await Promise.race([
          heading(page, /your submission/i)
            .first()
            .waitFor({ state: "visible", timeout: 30_000 }),
          page
            .getByText(/you have a saved draft/i)
            .first()
            .waitFor({ state: "visible", timeout: 30_000 }),
        ]).catch(() => {})
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
  // Say WHY, not just that it didn't happen: which step we're stuck on, what
  // the footer offers, and anything the page is trying to tell the user.
  const stuckOn = await currentStep(page)
  const footer = await page
    .getByRole("button")
    .allTextContents()
    .catch(() => [] as Array<string>)
  const messages = await page
    .locator("[data-sonner-toast], [role='alert'], [data-slot='field-error']")
    .allTextContents()
    .catch(() => [] as Array<string>)
  throw new Error(
    `the public form never reached the "${target}" step — stuck on "${stuckOn}" ` +
      `at ${page.url()}; buttons: ${JSON.stringify(footer)}; messages: ${JSON.stringify(messages)}`,
  )
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

    await gotoStable(page, submitPath("cfp"), "networkidle")
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

  test("draft saves and resumes on the same email", async ({ page, browser }) => {
    const watcher = armed(page)
    const form = await publicForm("cfp")
    test.skip(!form.allowDrafts, "this form does not allow drafts")
    const email = testEmail("cfp-draft")
    const title = `Draft Proposal ${unique("t")}`

    await gotoStable(page, submitPath("cfp"), "networkidle")
    await goToSubmissionStep(page, email)
    await answerRequired(page, form.questions, { values: { title } })
    await page.getByRole("button", { name: /save as draft/i }).first().click()
    await expectToast(page, /draft saved/i, 30_000)

    // Come back cold — a genuinely new browser, same email. The wizard keeps
    // in-progress answers in sessionStorage (see src/routes/submit/$eventSlug/$formSlug.tsx),
    // so clearing cookies and reloading is NOT a cold return: the same context
    // resumes straight back onto the Submission step. Only a fresh context
    // exercises "I came back tomorrow on a different machine", which is the
    // case the draft feature exists for.
    //
    // That address now has a draft behind it, so typing it in a strange browser
    // no longer opens anything: the server emails a sign-in link instead
    // (convex/submit.ts, "IDENTITY MODEL"). Following that link is the real
    // cross-device resume, and it is what this walks.
    const coldContext = await browser.newContext()
    const cold = await coldContext.newPage()
    const coldWatcher = armed(cold)
    await gotoStable(cold, submitPath("cfp"), "networkidle")
    await goToAccountStep(cold, email)
    // One click, then wait — see the note in `walkTo`: Continue is disabled
    // while `identify` runs, so re-clicking guarantees the step never settles.
    await cold
      .getByRole("button", { name: /^continue$/i })
      .first()
      .click({ timeout: 10_000 })
    await expect(cold.getByRole("heading", { name: /check your email/i })).toBeVisible({
      timeout: 45_000,
    })
    await expect(cold.getByText(email).first()).toBeVisible()
    // Nothing about the account leaks into the page while it is unproven.
    await expect(cold.getByText(/you have a saved draft/i)).toHaveCount(0)
    await expect(cold.getByText(title)).toHaveCount(0)

    const link = await signInLinkFor(email)
    await gotoStable(cold, link, "networkidle")
    await expect(cold.getByText(/you have a saved draft/i).first()).toBeVisible({
      timeout: 45_000,
    })
    // The token is consumed into the session, never left in the address bar.
    await expect(cold).not.toHaveURL(/[?&]t=/)
    await advance(cold, /resume draft/i, heading(cold, /your submission/i), {
      timeout: 60_000,
    })
    await expect(field(cold, "title")).toHaveValue(title, { timeout: 20_000 })

    coldWatcher.assertClean("draft resume in a fresh browser")
    await coldContext.close()
    watcher.assertClean("draft save + resume")
  })

  /**
   * The flaw this test exists for: `submit.identify` used to hand back the
   * portal token for ANY typed address, so anyone could enter a speaker's email
   * and walk into their submissions, tasks and profile. A known address now
   * gets a mailed link and a response that says nothing else.
   */
  test("an email with speaker history gets a mailed link, never a portal", async ({
    page,
  }) => {
    const watcher = armed(page)
    const form = await publicForm("cfp")
    const email = testEmail("cfp-known")

    // Give the address a history the honest way — one real submission.
    const anon = anonConvexClient()
    const first = (await anon.mutation(api.submit.identify, {
      slug: "cfp",
      eventSlug: MAIN_EVENT_SLUG,
      email,
    })) as { status: string; portalToken?: string }
    expect(first.status, "a brand-new address still sails straight through").toBe(
      "ready",
    )
    const trackQuestion = form.questions.find((q) => q.isTrackQuestion)
    await anon.mutation(api.submit.submit, {
      slug: "cfp",
      eventSlug: MAIN_EVENT_SLUG,
      portalToken: first.portalToken!,
      title: `Known Speaker ${unique("t")}`,
      answers: Object.fromEntries(
        form.questions
          .filter((q) => q.enabled && q.required && !q.showIf)
          .map((q) => [
            q.id,
            q.options?.[0] ?? `${q.label} answer ${unique("a")}`,
          ]),
      ),
      participants: [
        { firstName: "Nona", lastName: "Known", email, role: "speaker" },
      ],
    })
    expect(trackQuestion, "the seeded CFP routes on a track question").toBeTruthy()

    // — The mutation itself must not hand the token over ————————————————
    const second = (await anon.mutation(api.submit.identify, {
      slug: "cfp",
      eventSlug: MAIN_EVENT_SLUG,
      email,
    })) as Record<string, unknown>
    expect(second.status).toBe("link_sent")
    expect(second).not.toHaveProperty("portalToken")
    expect(second).not.toHaveProperty("drafts")
    expect(second).not.toHaveProperty("firstName")

    // — …and the page says exactly that much, no more —————————————————
    await gotoStable(page, submitPath("cfp"), "networkidle")
    await goToAccountStep(page, email)
    await page.getByRole("button", { name: /^continue$/i }).first().click()
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByText(email).first()).toBeVisible()
    await expect(
      page.getByRole("button", { name: /send it again/i }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /use a different email/i }).first(),
    ).toBeVisible()
    // No way forward from here without the inbox.
    await expect(page.getByRole("button", { name: /^continue$/i })).toHaveCount(0)

    // — The link really is in the outbox, and it really works ——————————
    const link = await signInLinkFor(email)
    expect(link).toMatch(/\/submit\/.+\?t=[A-Za-z0-9._-]+/)
    await gotoStable(page, link, "networkidle")
    await expect(heading(page, /your submission/i).first()).toBeVisible({
      timeout: 45_000,
    })
    await expect(page).not.toHaveURL(/[?&]t=/)

    watcher.assertClean("known email → mailed sign-in link")
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
      await gotoStable(page, submitPath(created.slug), "networkidle")
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
    await gotoStable(page, submitPath(unique("nope")), "networkidle")
    await expect(
      page.getByRole("heading", { name: /couldn.t find that call for speakers/i }).first(),
    ).toBeVisible({ timeout: 30_000 })
    watcher.assertClean("unknown form slug")
  })

  /**
   * The old one-segment address. Slugs became per-event
   * (docs/memory/DECISIONS.md, "Public URL scheme is hierarchical"), and every
   * link an organizer ever printed still has to land on the same form.
   */
  test("the legacy /submit/:slug link still reaches the same form", async ({
    page,
  }) => {
    const watcher = armed(page)
    await gotoStable(page, "/submit/cfp", "networkidle")
    await expect(page).toHaveURL(new RegExp(`${submitPath("cfp")}$`), {
      timeout: 30_000,
    })
    await expect(
      page.getByText(/submissions will be accepted until/i).first(),
    ).toBeVisible({ timeout: 30_000 })
    watcher.assertClean("legacy submit link")
  })

  test("hitting the per-user limit shows a friendly error, not a crash", async ({
    browser,
  }) => {
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
        // A fresh context per attempt, for two reasons that both bit here:
        // the success screen auto-redirects to the portal on a timer, and a
        // pending redirect fights the next navigation ("waiting for navigation
        // to finish" forever); and the wizard keeps answers in sessionStorage,
        // so reusing the tab would resume mid-flow instead of starting over.
        // It is also the truer scenario — the same person coming back later.
        const context = await browser.newContext()
        const page = await context.newPage()
        const watcher = armed(page)
        try {
          // The second visit is a returning speaker, and typing the address is
          // no longer enough to be one (convex/submit.ts, "IDENTITY MODEL") —
          // they arrive on the sign-in link we mailed them after attempt 1.
          // The cap is what is under test here; the mailed-link flow itself is
          // covered by its own test above.
          if (attempt === 1) {
            await gotoStable(page, submitPath(created.slug), "networkidle")
          } else {
            const asked = (await anonConvexClient().mutation(api.submit.identify, {
              slug: created.slug,
              eventSlug: MAIN_EVENT_SLUG,
              email,
            })) as { status: string }
            expect(asked.status, "a returning speaker gets a mailed link").toBe(
              "link_sent",
            )
            const token = await portalTokenFor(email)
            await gotoStable(
              page,
              `${submitPath(created.slug)}?t=${token}`,
              "networkidle",
            )
            await expect(heading(page, /your submission/i).first()).toBeVisible({
              timeout: 45_000,
            })
          }
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
            await expect(
              heading(page, /thank you for submitting/i).first(),
            ).toBeVisible({ timeout: 60_000 })
          } else {
            // A sentence a human can act on — and still on the Review step,
            // not an error page or a blank screen.
            await expectToast(page, /reached the limit of 1 submission/i, 30_000)
            await expect(
              page.getByRole("heading", { name: /review and submit/i }).first(),
            ).toBeVisible()
            // The refused mutation logs a Convex server error — that refusal
            // IS the assertion here, so forget it before the cleanliness check.
            watcher.reset()
          }
          watcher.assertClean(`per-user limit attempt ${attempt}`)
        } finally {
          await context.close()
        }
      }
    } finally {
      await organizer.mutation(api.forms.remove, { formId }).catch(() => {})
    }
  })
})

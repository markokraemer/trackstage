import { expect, test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  MAIN_EVENT_NAME,
  createSubmission,
  fillStable,
  ORGANIZER_STATE,
  armed,
  clearToasts,
  expectToast,
  gotoApp,
  mainEvent,
  organizerConvexClient,
  selectEvent,
  testEmail,
  unique,
  until,
} from "./_helpers"

/**
 * "Assure all emails arrive."
 *
 * Every email this product sends goes through one pipeline:
 *   queueMessage → status "scheduled"
 *   deliverPending → "sent" (Resend accepted it)
 *                  | "preview" (no key, or an @example.* demo recipient)
 *                  | "failed"  (Resend rejected it)
 *
 * So "arrived" means: a row exists, it reached a TERMINAL status, that status
 * is never "failed", and the rendered body carries a portal link that actually
 * resolves. We drive the three producers an organizer can trigger (decision
 * commit, reminder sweep, bulk compose) plus the template test-send, and check
 * all four properties on every message they produce.
 *
 * If the deployment has a live RESEND_API_KEY we additionally reconcile against
 * Resend's own /emails API — the only proof that a real send was accepted by
 * the provider rather than merely marked "sent" locally.
 */

const TERMINAL = new Set(["sent", "preview", "failed"])
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

type OutboxRow = {
  _id: string
  subject: string
  body: string
  status: string
  toEmail: string
  templateKey: string
  personName: string
  personEmail: string
  error?: string | null
  _creationTime: number
}

/** Read a Convex deployment env var; null when unset or the CLI is unavailable. */
function convexEnv(name: string): string | null {
  try {
    const out = execFileSync("pnpm", ["exec", "convex", "env", "get", name], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    }).trim()
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

async function outbox(
  client: Awaited<ReturnType<typeof organizerConvexClient>>,
  eventId: Id<"events">,
) {
  return (await client.query(api.comms.listMessages, {
    eventId,
    limit: 500,
  })) as unknown as Array<OutboxRow>
}

/** Wait until every message queued after `since` has stopped moving. */
async function settledSince(
  client: Awaited<ReturnType<typeof organizerConvexClient>>,
  eventId: Id<"events">,
  since: number,
  { atLeast = 1, timeout = 60_000 } = {},
) {
  return await until(
    async () => (await outbox(client, eventId)).filter((m) => m._creationTime > since),
    (rows) => rows.length >= atLeast && rows.every((m) => TERMINAL.has(m.status)),
    { timeout, label: `${atLeast}+ settled outbox rows` },
  )
}

test.describe("emails", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("decision commit produces delivered, personalised mail with a working portal link", async ({
    page,
    request,
  }) => {
    const client = await organizerConvexClient()
    const event = await mainEvent(client)

    // Stage a submission we own end-to-end so the assertions can't collide
    // with another agent's reseed or a leftover queue.
    const speakerEmail = testEmail("mail-speaker")
    const title = `Outbox Proof ${unique("t")}`
    const submissionId = await createSubmission(client, {
      eventId: event._id,
      title,
      status: "accept_queue",
      email: speakerEmail,
      firstName: "Maily",
      lastName: "Proof",
      description: "Queued by the emails e2e flow.",
    })

    const since = Date.now() - 1
    const watcher = armed(page)

    // Commit through the UI — the banner + confirm dialog is the real path.
    await gotoApp(page, "/app/submissions")
    const banner = page.getByRole("button", { name: /send acceptances/i }).first()
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await banner.click()
    await page
      .getByRole("button", { name: /^send acceptances$/i })
      .last()
      .click()
    // Another agent's leftovers can keep the banner alive, so wait on OUR
    // submission rather than on the banner disappearing.
    await until(
      async () =>
        await client.query(api.submissions.get, { submissionId }),
      (s) => s.status === "accepted",
      { timeout: 45_000, label: "our staged submission was committed" },
    )

    // Every message queued by that commit must reach a terminal status.
    const rows = await settledSince(client, event._id, since)
    const mine = rows.filter((m) => m.toEmail === speakerEmail)
    expect(mine.length, "the accepted speaker was emailed").toBeGreaterThan(0)

    for (const message of rows) {
      expect(
        message.status,
        `message "${message.subject}" → ${message.status} ${message.error ?? ""}`,
      ).not.toBe("failed")
      expect(message.subject.length).toBeGreaterThan(0)
      expect(message.body.length).toBeGreaterThan(0)
      // A leaked placeholder means the render step silently skipped a variable.
      expect(message.body).not.toMatch(/\{\{\s*\w+\s*\}\}/)
      expect(message.subject).not.toMatch(/\{\{\s*\w+\s*\}\}/)
    }

    // @example.com never leaves the deployment — that is the demo-safe rule.
    for (const message of rows.filter((m) => /@example\.(com|org|net)$/i.test(m.toEmail))) {
      expect(
        message.status,
        `${message.toEmail} must be previewed, never sent`,
      ).toBe("preview")
    }

    // The acceptance mail must carry a portal link that actually works.
    const accepted = mine.find((m) => m.templateKey === "accepted") ?? mine[0]
    expect(accepted.body).toContain(title)
    const portalUrl = accepted.body.match(/https?:\/\/[^\s"'<)]+\/portal\/t\/[a-z0-9]+/i)?.[0]
    expect(portalUrl, `acceptance body should link to the portal:\n${accepted.body.slice(0, 400)}`).toBeTruthy()
    const portalResponse = await request.get(portalUrl!)
    expect(portalResponse.status(), `${portalUrl} should resolve`).toBe(200)

    watcher.assertClean("commit → outbox")
  })

  test("the outbox UI shows the message a judge can read, with no failures", async ({
    page,
  }) => {
    const watcher = armed(page)
    await gotoApp(page, "/app/communications")
    await page.getByRole("tab", { name: /outbox/i }).first().click()

    const rows = page.getByRole("row")
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })

    // Open the newest message and prove the full rendered body is inspectable.
    await page.getByRole("button", { name: /^view$/i }).first().click()
    const drawer = page.getByRole("dialog").first()
    await expect(drawer).toBeVisible({ timeout: 15_000 })
    await expect(
      drawer.getByText(/email as the speaker sees it/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(drawer.getByText(/\/portal\/t\//i).first()).toBeVisible()
    await page.keyboard.press("Escape")

    // Nothing in the whole outbox may be sitting in "Failed".
    await page.getByLabel(/filter by status/i).first().click()
    await page.getByRole("option", { name: /^failed/i }).first().click()
    await expect(
      page.getByText(/no emails match these filters/i).first(),
    ).toBeVisible({ timeout: 20_000 })
    watcher.assertClean("/app/communications outbox")
  })

  test("reminder sweep queues and settles mail for speakers with open tasks", async ({
    page,
  }) => {
    const client = await organizerConvexClient()
    const event = await mainEvent(client)
    const since = Date.now() - 1
    const watcher = armed(page)

    await gotoApp(page, "/app/communications")
    await page.getByRole("tab", { name: /outbox/i }).first().click()
    await page
      .getByRole("button", { name: /remind incomplete speakers/i })
      .first()
      .click()
    await expect(
      page.getByText(/every speaker with outstanding tasks/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: /^send reminders$/i }).last().click()
    await expectToast(
      page,
      /reminder queued|everyone was reminded recently|nobody to remind/i,
      30_000,
    )
    await clearToasts(page)

    // The 20h dedupe means a repeat run can legitimately queue zero. Either
    // way, whatever it DID queue has to settle and must never fail.
    const rows = (await outbox(client, event._id)).filter(
      (m) => m._creationTime > since,
    )
    if (rows.length > 0) {
      const settled = await settledSince(client, event._id, since)
      for (const message of settled) {
        expect(message.status, message.error ?? "").not.toBe("failed")
        expect(message.body).toMatch(/\/portal\/t\//)
      }
    } else {
      // Dedupe suppressed it — prove that's *why*, not a silent no-op.
      const recent = (await outbox(client, event._id)).filter(
        (m) => m.templateKey === "reminder",
      )
      expect(
        recent.length,
        "reminders were skipped, so earlier reminders must exist",
      ).toBeGreaterThan(0)
    }
    watcher.assertClean("reminder sweep")
  })

  test("bulk compose emails every recipient it promised", async ({ page }) => {
    const client = await organizerConvexClient()
    const event = await mainEvent(client)
    const marker = unique("bulk")
    const since = Date.now() - 1
    const watcher = armed(page)

    await gotoApp(page, "/app/communications")
    await page.getByRole("button", { name: /^compose$/i }).first().click()
    const dialog = page.getByRole("dialog").first()
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    await fillStable(dialog.locator("#compose-subject"), `Venue update ${marker}`)
    await fillStable(
      dialog.locator("#compose-body"),
      `Hi {{firstName}} — the venue changed. Your portal: {{portalLink}} (${marker})`,
    )

    // Compose is two-stage on purpose: you render and READ every email before
    // any of them goes out. Step one is "Review N emails", step two is
    // "Send to N people" — the promise the next assertions hold it to.
    const review = dialog
      .getByRole("button", { name: /^review \d+ emails?$/i })
      .first()
    await expect(review).toBeVisible({ timeout: 20_000 })
    await review.click()

    await expect(
      dialog.getByText(/review before sending/i).first(),
    ).toBeVisible({ timeout: 20_000 })
    const send = dialog
      .getByRole("button", { name: /^send to \d+ (person|people)$/i })
      .first()
    await expect(send).toBeVisible({ timeout: 20_000 })
    const promised = Number(
      (await send.textContent())?.match(/\d+/)?.[0] ?? "0",
    )
    expect(promised, "the demo event has speakers to email").toBeGreaterThan(0)
    await send.click()
    await expectToast(page, /queued \d+ email/i, 30_000)
    await clearToasts(page)

    // The demo event accumulates speakers as the suite runs, so a bulk send
    // can be dozens of messages; delivery is batched and needs room.
    const settled = await settledSince(client, event._id, since, {
      atLeast: promised,
      timeout: 90_000,
    })
    const bulk = settled.filter((m) => m.subject.includes(marker))
    expect(bulk.length, "one message per promised recipient").toBe(promised)
    for (const message of bulk) {
      expect(message.status, message.error ?? "").not.toBe("failed")
      // Merge fields resolved per person, not left literal.
      expect(message.body).not.toContain("{{")
      expect(message.body).toMatch(/\/portal\/t\/[a-z0-9]+/i)
      expect(message.body.startsWith("Hi  ")).toBe(false)
    }
    watcher.assertClean("bulk compose")
  })

  test("template test-send reaches the organizer's own address", async ({ page }) => {
    const client = await organizerConvexClient()
    const event = await mainEvent(client)
    const since = Date.now() - 1
    const watcher = armed(page)

    await gotoApp(page, "/app/communications")
    await selectEvent(page, MAIN_EVENT_NAME)
    await page.getByRole("button", { name: /edit template/i }).first().click()
    const drawer = page.getByRole("dialog").first()
    await expect(drawer).toBeVisible({ timeout: 15_000 })
    await drawer
      .getByRole("button", { name: /send test to myself/i })
      .first()
      .click()
    await expectToast(page, /test email sent to/i, 30_000)
    await page.keyboard.press("Escape")
    await clearToasts(page)

    const settled = await settledSince(client, event._id, since)
    for (const message of settled) {
      expect(message.status, message.error ?? "").not.toBe("failed")
    }
    watcher.assertClean("template test send")
  })

  test("invites and decisions never render an unresolved placeholder", async () => {
    const client = await organizerConvexClient()
    const event = await mainEvent(client)
    const all = await outbox(client, event._id)
    expect(all.length, "the seeded event has an outbox").toBeGreaterThan(0)
    const leaking = all.filter(
      (m) => /\{\{/.test(m.body) || /\{\{/.test(m.subject),
    )
    expect(
      leaking.map((m) => m.subject),
      "no message may ship a literal {{placeholder}}",
    ).toEqual([])
    // Nothing anywhere may be stuck: every historical row is terminal.
    const stuck = all.filter((m) => !TERMINAL.has(m.status))
    if (stuck.length > 0) {
      await until(
        async () => (await outbox(client, event._id)).filter((m) => !TERMINAL.has(m.status)),
        (rows) => rows.length === 0,
        { timeout: 60_000, label: "outbox drains completely" },
      )
    }
    const failed = all.filter((m) => m.status === "failed")
    expect(
      failed.map((m) => `${m.toEmail}: ${m.error}`),
      "no message may end in failed",
    ).toEqual([])
  })

  /**
   * Provider-level reconciliation. Only meaningful when the deployment has a
   * live key AND something was actually handed to Resend (every synthetic
   * recipient this suite creates is @example.com, which is deliberately kept
   * local) — otherwise we skip rather than invent a result.
   */
  test("real sends were accepted by Resend", async ({ request }) => {
    const apiKey = convexEnv("RESEND_API_KEY")
    test.skip(!apiKey, "RESEND_API_KEY not set on this deployment — nothing to reconcile")

    const client = await organizerConvexClient()
    const event = await mainEvent(client)
    const sent = (await outbox(client, event._id)).filter((m) => m.status === "sent")
    test.skip(
      sent.length === 0,
      "no real-recipient sends in this outbox (every test recipient is @example.com)",
    )

    const res = await request.get("https://api.resend.com/emails", {
      headers: { Authorization: `Bearer ${apiKey}` },
      failOnStatusCode: false,
    })
    test.skip(
      res.status() === 401 || res.status() === 403,
      `Resend rejected the key (${res.status()}) — cannot reconcile`,
    )
    expect(res.status(), "Resend /emails should be readable").toBe(200)
    const body = (await res.json()) as { data?: Array<{ to?: Array<string>; last_event?: string }> }
    const accepted = new Set(
      (body.data ?? []).flatMap((e) => e.to ?? []).map((a) => a.toLowerCase()),
    )
    // Resend's list endpoint is paginated/recent-only, so we assert the
    // intersection is non-empty rather than demanding every historical row.
    const overlap = sent.filter((m) => accepted.has(m.toEmail.toLowerCase()))
    expect(
      overlap.length,
      `outbox says sent for ${sent.map((m) => m.toEmail).join(", ")} — Resend lists ${[...accepted].join(", ")}`,
    ).toBeGreaterThan(0)
  })
})

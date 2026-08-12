import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import {
  ORGANIZER_STATE,
  armed,
  gotoApp,
  mainEvent,
  createSubmission,
  organizerConvexClient,
  present,
  testEmail,
  unique,
} from "./_helpers"

/**
 * The copilot — an LLM driving the same MCP tools the product exposes.
 *
 * Two things are actually testable about a non-deterministic renderer, and
 * they're the two that matter:
 *
 *   1. Asking a question produces a STREAMED answer that used a TOOL. Not
 *      specific words — a reply that grows, and at least one `data-tool` frame
 *      proving it read live data rather than hallucinating.
 *   2. Asking for something destructive produces an APPROVAL CARD and executes
 *      NOTHING until a human says yes. Cancel must leave the database exactly
 *      as it was — asserted against Convex, not against the transcript.
 *
 * Another agent is restyling this surface, so every assertion is on semantics
 * (roles, `data-tool`, backend state) and never on exact markup or copy.
 */

const REPLY_TIMEOUT = 90_000

/** Model calls cost money and time — one shared guard for "is it wired up". */
async function skipUnlessCopilotResponds(page: Page) {
  const failed = page.getByText(
    /copilot is not configured|OPENROUTER|couldn.t reach the model/i,
  )
  if (await present(failed, 1_000)) {
    test.skip(true, "copilot has no model key on this deployment")
  }
}

/**
 * The copilot panel. Matched by role + a brand-agnostic name so the ongoing
 * Sessionboard→Trackstage rename can't break the whole spec.
 */
function conversation(page: Page) {
  return page.getByRole("dialog", { name: /copilot/i })
}

async function ask(page: Page, prompt: string) {
  const input = page.getByRole("textbox", { name: /ask/i }).first()
  const fallback = page.locator("textarea").first()
  const box = (await present(input, 3_000)) ? input : fallback
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.click()
  await box.fill(prompt)
  await box.press("Enter")
}

test.describe("copilot", () => {
  test.use({ storageState: ORGANIZER_STATE })

  test("⌘I opens the panel and a question streams a tool-backed answer", async ({
    page,
  }) => {
    const watcher = armed(page, [
      // Streaming aborts when the panel closes / the test ends mid-flight.
      /AbortError|The user aborted a request|BodyStreamBuffer/i,
    ])
    await gotoApp(page, "/app")

    // The keyboard path swyx uses.
    await page.keyboard.press("Meta+i")
    let panel = conversation(page)
    if (!(await present(panel, 5_000))) {
      // …and the discoverable one, for a browser agent that doesn't guess.
      await page.getByRole("button", { name: /open the ai copilot/i }).first().click()
      panel = conversation(page)
    }
    await expect(panel).toBeVisible({ timeout: 20_000 })

    // Ask in a way that *requires* a lookup. The panel injects live app state
    // via `useCopilotReadable`, so a bare "what needs my attention?" can be
    // answered from context with no tool call at all — correct behaviour, but
    // it makes "a tool ran" untestable. Verified by hand: this phrasing
    // produces a tool frame and the right number.
    await ask(
      page,
      "Use your tools to look up how many submissions are pending right now.",
    )
    await skipUnlessCopilotResponds(page)

    // A reply that grows: assert the transcript gains text, not that it says
    // any particular thing.
    await expect(async () => {
      const text = await panel.innerText()
      expect(text.length).toBeGreaterThan(120)
    }).toPass({ timeout: REPLY_TIMEOUT })

    // …and that it got there by reading live data.
    const toolParts = page.locator("[data-tool]")
    await expect(toolParts.first()).toBeVisible({ timeout: REPLY_TIMEOUT })
    const toolName = await toolParts.first().getAttribute("data-tool")
    expect(toolName, "the tool frame names the tool it ran").toBeTruthy()

    // ⌘I again closes it — a toggle, not a one-way door.
    await page.keyboard.press("Meta+i")
    await expect(panel).toBeHidden({ timeout: 20_000 })

    watcher.assertClean("copilot panel")
  })

  test("a destructive ask waits for approval, and Cancel changes nothing", async ({
    page,
  }) => {
    const watcher = armed(page, [/AbortError|The user aborted a request/i])
    const organizer = await organizerConvexClient()
    const event = await mainEvent(organizer)

    // Put exactly one submission in the accept queue so "commit the accept
    // queue" is a real, consequential request — and so "nothing executed" is
    // an observable claim rather than a vacuous one.
    const title = `Copilot Guard ${unique("cg")}`
    const submissionId = await createSubmission(organizer, {
      eventId: event._id,
      title,
      status: "accept_queue",
      email: testEmail("copilot"),
      firstName: "Cope",
      lastName: "Ilot",
      description: "Staged by the copilot approval e2e flow.",
    })

    const messagesBefore = (
      (await organizer.query(api.comms.listMessages, {
        eventId: event._id,
        limit: 500,
      })) as Array<unknown>
    ).length

    try {
      await gotoApp(page, "/app/copilot")
      // Name the tool. Left to its own judgement the model sometimes inspects
      // the queue, decides there is nothing worth doing and answers in prose —
      // reasonable behaviour, but then no approval card ever appears and the
      // guard is untestable. Naming the tool makes the request unambiguous
      // while still going through the real approval path.
      await ask(
        page,
        "Call the commit_decision_queue tool for this event's accept_queue to send the acceptance emails.",
      )
      await skipUnlessCopilotResponds(page)

      // ——— The approval card ————————————————————————————————————————
      const approve = page.getByRole("button", { name: /approve/i }).first()
      const cancel = page.getByRole("button", { name: /^cancel$/i }).first()
      await expect(approve).toBeVisible({ timeout: REPLY_TIMEOUT })
      await expect(cancel).toBeVisible()

      // It must say what it is about to do, including that mail goes out.
      // Assert on the OUTERMOST container that holds the button — `.last()`
      // resolves to the innermost one, which is just the two buttons and
      // carries none of the explanatory copy.
      const card = page.locator("div").filter({ has: approve }).first()
      await expect(card).toContainText(/queue|decision|accept/i)
      await expect(card).toContainText(/email/i)

      // Nothing may have run while the card is on screen.
      const stagedDuring = (await organizer.query(api.submissions.get, {
        submissionId,
      })) as { status: string }
      expect(
        stagedDuring.status,
        "the tool must not execute before approval",
      ).toBe("accept_queue")

      // ——— Cancel ————————————————————————————————————————————————————
      await cancel.click()
      await expect(
        page.getByText(/cancelled|nothing was changed/i).first(),
      ).toBeVisible({ timeout: 45_000 })
      await expect(approve).toBeHidden({ timeout: 20_000 })

      // ——— The database is the witness ————————————————————————————
      // Give any in-flight execution a chance to land, then prove it didn't.
      await page.waitForTimeout(4_000)
      const after = (await organizer.query(api.submissions.get, {
        submissionId,
      })) as { status: string; decidedAt?: number }
      expect(after.status, "Cancel must leave the queue staged").toBe(
        "accept_queue",
      )
      expect(after.decidedAt ?? null, "no decision may be stamped").toBeNull()

      const messagesAfter = (
        (await organizer.query(api.comms.listMessages, {
          eventId: event._id,
          limit: 500,
        })) as Array<unknown>
      ).length
      expect(messagesAfter, "Cancel must not email anyone").toBe(messagesBefore)

      watcher.assertClean("copilot approval")
    } finally {
      await organizer
        .mutation(api.submissions.setStatus, {
          submissionId,
          status: "pending",
        })
        .catch(() => {})
    }
  })

  test("an open event menu never blocks the copilot composer", async ({ page }) => {
    await gotoApp(page, "/app/copilot")
    const switcher = page.getByRole("button", { name: /switch event/i }).first()
    await switcher.click()
    await expect(
      page.getByRole("menu", { name: /switch event/i }).first(),
    ).toBeVisible()

    const input = page.getByRole("textbox", { name: /ask/i }).first()
    await input.click()
    await expect(input).toBeFocused()
    await expect(
      page.getByRole("menu", { name: /switch event/i }).first(),
    ).toBeHidden()
  })

  test("read-only questions never ask for approval", async ({ page }) => {
    // The flip side of the guard: if everything needed a confirmation the
    // copilot would be useless, so a plain lookup must just answer.
    const watcher = armed(page, [/AbortError|The user aborted a request/i])
    await gotoApp(page, "/app/copilot")
    await ask(
      page,
      "Use your tools to look up how many submissions are pending right now.",
    )
    await skipUnlessCopilotResponds(page)

    await expect(page.locator("[data-tool]").first()).toBeVisible({
      timeout: REPLY_TIMEOUT,
    })
    await expect(page.getByRole("button", { name: /approve/i })).toHaveCount(0)
    watcher.assertClean("copilot read-only")
  })

})

/**
 * Launch-video footage capture. Drives the live dev app (seeded demo world)
 * with a visible fake cursor and records each beat as its own webm.
 *
 *   node video/capture/capture.mjs login fixtures cfp triage …
 *   node video/capture/capture.mjs all
 *
 * Every fixture this script creates uses @example.com addresses (never leave
 * the deployment — outbox previews only) and is deleted again by `cleanup`.
 */
import { resolve } from "node:path"
import {
  AUTH_STATE, BASE, EVENT_SLUG, ORGANIZER, RAW, OUT,
  api, browser, clickCalm, clickUntil, glide, glideTo, gotoStable, loadState,
  mainEvent, organizerClient, recordBeat, saveState, shutdown, still, typeCalm,
} from "./lib.mjs"

// ——— Realistic fixture cast (deleted again in `cleanup`) ————————————————————

const CAST = {
  maya: { first: "Maya", last: "Chen", email: "maya.chen@example.com", title: "Agents That Ship: Twelve Months in Production" },
  priya: { first: "Priya", last: "Natarajan", email: "priya.n@example.com", title: "Evals That Catch Regressions Before Users Do" },
  jonas: { first: "Jonas", last: "Weber", email: "jonas.weber@example.com", title: "Serving Open Models at the Edge" },
  sofia: { first: "Sofia", last: "Reyes", email: "sofia.reyes@example.com", title: "The Post-RAG Stack" },
  tom: { first: "Tomás", last: "Okafor", email: "t.okafor@example.com", title: "Structured Outputs Without the Tears" },
}

// ——— Beats ——————————————————————————————————————————————————————————————————

/** UI login once; save storage state for every other beat. */
async function login() {
  const b = await browser()
  const context = await b.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  await gotoStable(page, "/login")
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Email").first().fill(ORGANIZER.email)
    await page.getByLabel("Password").first().fill(ORGANIZER.password)
    if ((await page.getByLabel("Email").first().inputValue()) === ORGANIZER.email) break
  }
  await page.getByRole("button", { name: /sign in/i }).first().click()
  await page.waitForURL(/\/app/, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await context.storageState({ path: AUTH_STATE })
  await context.close()
  console.log("— login ok, state saved")
}

/** Accepted sessions for the agenda tray + a pending one for the copilot. */
async function fixtures() {
  const client = await organizerClient()
  const event = await mainEvent(client)
  const ids = {}
  for (const key of ["jonas", "sofia", "tom"]) {
    const p = CAST[key]
    ids[key] = await client.mutation(api.submissions.addManual, {
      eventId: event._id,
      kind: "abstract",
      title: p.title,
      description: "A practitioner deep-dive for the AI Engineer Summit program.",
      status: "accepted",
      speakerEmails: [{ email: p.email, firstName: p.first, lastName: p.last }],
    })
  }
  const p = CAST.priya
  ids.priya = await client.mutation(api.submissions.addManual, {
    eventId: event._id,
    kind: "abstract",
    title: p.title,
    description: "Which eval harnesses actually hold up in CI, with the receipts.",
    status: "pending",
    speakerEmails: [{ email: p.email, firstName: p.first, lastName: p.last }],
  })
  saveState({ fixtureIds: ids, eventId: event._id })
  console.log("— fixtures created:", Object.keys(ids).join(", "))
}

/** Purge a cast member (drafts + person) so their email reads as brand new. */
async function resetPerson(client, event, email, title) {
  const list = await client.query(api.submissions.list, { eventId: event._id })
  const rows = list.rows ?? list
  for (const row of rows.filter((r) => r.title === title)) {
    await client.mutation(api.agenda.unschedule, { submissionId: row._id }).catch(() => {})
    await client.mutation(api.submissions.remove, { submissionId: row._id }).catch(() => {})
  }
  const roster = await client.query(api.dashboard.speakersRoster, { eventId: event._id })
  const person = roster.find((r) => r.email === email)
  if (person) {
    await client
      .mutation(api.speakersAdmin.removePerson, { personId: person.personId ?? person._id })
      .catch((e) => console.log("  removePerson:", e.message?.slice(0, 100)))
  }
}


/**
 * The shared deployment gets reseeded by other agents mid-run, which wipes
 * fixtures and even changes the event id. Every beat therefore (re)creates
 * what it needs immediately before recording.
 */
async function ensureFixture(client, event, person, status, description) {
  const list = await client.query(api.submissions.list, { eventId: event._id })
  const rows = list.rows ?? list
  let row = rows.find((r) => r.title === person.title)
  if (!row) {
    const id = await client.mutation(api.submissions.addManual, {
      eventId: event._id,
      kind: "abstract",
      title: person.title,
      description: description ?? "A practitioner deep-dive for the AI Engineer Summit program.",
      status,
      speakerEmails: [{ email: person.email, firstName: person.first, lastName: person.last }],
    })
    return id
  }
  if (row.status !== status) {
    await client.mutation(api.submissions.setStatus, { submissionId: row._id, status })
  }
  return row._id
}

/** The public CFP flow, filled like a real speaker would. */
async function cfp() {
  {
    const client = await organizerClient()
    const event = await mainEvent(client)
    await resetPerson(client, event, CAST.maya.email, CAST.maya.title)
  }
  await recordBeat("cfp-submit", async (page, { mark }) => {
    await gotoStable(page, `/submit/${EVENT_SLUG}/cfp`)
    await page.waitForTimeout(400)
    mark("welcome")
    await glide(page, { x: 800, y: 560 }, { duration: 500 })
    await page.waitForTimeout(900)
    await clickUntil(page, page.getByRole("button", { name: /^continue$/i }), page.getByText(/your email address/i))
    mark("account")
    await typeCalm(page, page.locator("#submit-email"), CAST.maya.email, { delay: 26 })
    await page.waitForTimeout(300)
    await clickUntil(page, page.getByRole("button", { name: /^continue$/i }), page.getByText(/your submission/i), { timeout: 25000 })
    mark("submission")
    const title = page.locator("#question-title")
    await typeCalm(page, title, CAST.maya.title, { delay: 24 })
    if ((await title.inputValue()) !== CAST.maya.title) await title.fill(CAST.maya.title)
    const desc = page.locator("#question-description")
    const descText =
      "What actually broke when we put agents in front of customers, and the playbook that fixed it."
    await typeCalm(page, desc, descText, { delay: 7 })
    if ((await desc.inputValue()) !== descText) await desc.fill(descText)
    // Conditional logic, live: Format → Workshop reveals the follow-up.
    const pick = async (fieldId, option) => {
      await clickCalm(page, page.locator(`#question-${fieldId}`))
      await page.waitForTimeout(350)
      await clickCalm(page, page.getByRole("option", { name: option, exact: true }))
      await page.waitForTimeout(550) // let the popup fully close before the next click
    }
    await pick("format", "Workshop")
    await page.locator("#question-workshopDuration").waitFor({ timeout: 10000 })
    mark("conditional")
    await page.waitForTimeout(1100)
    await pick("workshopDuration", "90 minutes")
    await pick("track", "AI Engineering")
    await pick("level", "Intermediate")
    await page.waitForTimeout(300)
    await clickUntil(page, page.getByRole("button", { name: /^continue$/i }), page.getByRole("heading", { name: /^participants$/i }))
    mark("participants")
    await typeCalm(page, page.getByLabel(/first name/i).first(), CAST.maya.first, { delay: 30 })
    await typeCalm(page, page.getByLabel(/last name/i).first(), CAST.maya.last, { delay: 30 })
    await page.waitForTimeout(300)
    await clickUntil(page, page.getByRole("button", { name: /^continue$/i }), page.getByRole("heading", { name: /review and submit/i }))
    mark("review")
    await page.waitForTimeout(1300)
    await clickUntil(page, page.getByRole("button", { name: /^submit$/i }), page.getByRole("heading", { name: /thank you for submitting/i }), { timeout: 30000 })
    mark("success")
    await page.waitForTimeout(2600)
  }, { authed: false })
}

/** Submissions triage: tabs → search → stage into the accept queue. */
async function triage() {
  {
    // Make sure Maya starts from Pending so the staging story reads true.
    const client = await organizerClient()
    const event = await mainEvent(client)
    await ensureFixture(client, event, CAST.maya, "pending",
      "What actually broke when we put agents in front of customers, and the playbook that fixed it.")
  }
  await recordBeat("triage", async (page, { mark }) => {
    await gotoStable(page, "/app/submissions")
    await page.waitForTimeout(600)
    mark("table")
    await clickCalm(page, page.getByRole("tab", { name: /pending/i }).first())
    await page.waitForTimeout(1000)
    mark("pending-tab")
    const search = page.getByRole("searchbox").first()
    await typeCalm(page, search, "Agents That Ship", { delay: 30 })
    await page.waitForTimeout(800)
    mark("searched")
    const statusButton = page
      .getByRole("button", { name: new RegExp(`change status of ${CAST.maya.title}`, "i") })
      .first()
    await clickCalm(page, statusButton)
    await page.waitForTimeout(500)
    mark("status-menu")
    await clickCalm(page, page.getByRole("button", { name: /^accept queue$/i }).first())
    await page.waitForTimeout(400)
    await clickCalm(page, page.getByRole("button", { name: /^save$/i }).first())
    mark("staged")
    await page.waitForTimeout(1400)
    // Show where it landed: the row now sits in the Accept Queue tab.
    await clickCalm(page, page.getByRole("tab", { name: /accept queue/i }).first())
    mark("queue-tab")
    await page.waitForTimeout(2400)
  })
}

/** Commit the accept queue — the confirm dialog is the money shot. */
async function commit() {
  {
    const client = await organizerClient()
    const event = await mainEvent(client)
    await ensureFixture(client, event, CAST.maya, "accept_queue",
      "What actually broke when we put agents in front of customers, and the playbook that fixed it.")
  }
  await recordBeat("commit-queue", async (page, { mark }) => {
    await gotoStable(page, "/app/submissions")
    await page.waitForTimeout(800)
    await clickCalm(page, page.getByRole("button", { name: /send acceptances/i }).first())
    await page.getByRole("heading", { name: /send \d+ acceptance/i }).first().waitFor({ timeout: 15000 })
    mark("dialog")
    await page.waitForTimeout(2400)
    // Do NOT commit — the seeded demo stages this queue on purpose. Cancel and
    // let the outbox in /app/communications carry the "real emails" motif.
    await clickCalm(page, page.getByRole("button", { name: /cancel/i }).last())
    await page.waitForTimeout(500)
    await gotoStable(page, "/app/communications")
    mark("outbox")
    await page.waitForTimeout(2800)
  })
}

/** Maya gets accepted for real (API — no seeded rows disturbed). */
async function acceptMaya() {
  const client = await organizerClient()
  const event = await mainEvent(client)
  const id = await ensureFixture(client, event, CAST.maya, "accepted",
    "What actually broke when we put agents in front of customers, and the playbook that fixed it.")
  saveState({ mayaId: id })
  console.log("— maya accepted")
}

/** Speaker portal: home → submissions → tasks, as Maya. */
async function portal() {
  const client = await organizerClient()
  const event = await mainEvent(client)
  const submissionId = await ensureFixture(client, event, CAST.maya, "accepted",
    "What actually broke when we put agents in front of customers, and the playbook that fixed it.")
  const roster = await client.query(api.dashboard.speakersRoster, { eventId: event._id })
  const maya = roster.find((r) => r.email === CAST.maya.email)
  if (!maya?.portalToken) throw new Error("no portal token for Maya")
  const personId = maya.personId ?? maya._id
  // Give her the onboarding tasks a committed acceptance would have created.
  const tasks = await client.query(api.tasksAdmin.list, { eventId: event._id })
  const hers = (tasks.rows ?? tasks).filter((t) => String(t.personId) === String(personId))
  if (hers.length === 0) {
    const week = 7 * 24 * 60 * 60 * 1000
    await client.mutation(api.tasksAdmin.create, {
      eventId: event._id, personIds: [personId], kind: "headshot",
      title: "Upload your speaker headshot",
      instructions: "A square photo, at least 1000×1000px, on a plain background.",
      dueAt: Date.now() + week,
    })
    await client.mutation(api.tasksAdmin.create, {
      eventId: event._id, personIds: [personId], kind: "upload",
      title: "Upload your workshop slides", submissionId,
      instructions: "PDF or Keynote. A draft is fine — you can replace it any time.",
      dueAt: Date.now() + 2 * week,
    })
    await client.mutation(api.tasksAdmin.create, {
      eventId: event._id, personIds: [personId], kind: "confirm",
      title: "Confirm you can present on October 12",
      dueAt: Date.now() + week,
    })
  }
  await recordBeat("portal", async (page, { mark }) => {
    await gotoStable(page, `/portal/t/${maya.portalToken}`)
    await page.waitForTimeout(800)
    mark("home")
    await glide(page, { x: 800, y: 500 }, { duration: 600 })
    await page.waitForTimeout(1600)
    await clickCalm(page, page.locator('a[href="/portal/tasks"]:visible').first())
    await page.waitForTimeout(900)
    mark("tasks")
    await page.waitForTimeout(1400)
    const complete = page.getByRole("button", { name: /mark complete/i }).first()
    if (await complete.isVisible().catch(() => false)) {
      await clickCalm(page, complete)
      mark("completed")
      await page.waitForTimeout(2400)
    } else {
      await page.waitForTimeout(2000)
    }
  }, { authed: false })
}

/** Copilot stages a decision with a human approval card, then we approve. */
async function copilot() {
  {
    const client = await organizerClient()
    const event = await mainEvent(client)
    await ensureFixture(client, event, CAST.priya, "pending",
      "Which eval harnesses actually hold up in CI, with the receipts.")
  }
  await recordBeat("copilot", async (page, { mark }) => {
    await gotoStable(page, "/app/copilot")
    await page.waitForTimeout(700)
    mark("open")
    const box = page.getByRole("textbox", { name: /ask/i }).first()
    await typeCalm(page, box,
      `Move "${CAST.priya.title}" to the accept queue.`,
      { delay: 20 })
    await page.waitForTimeout(300)
    await page.keyboard.press("Enter")
    mark("asked")
    const approve = page.getByRole("button", { name: /approve/i }).first()
    await approve.waitFor({ timeout: 90000 })
    mark("approval-card")
    await page.waitForTimeout(2000)
    await clickCalm(page, approve)
    mark("approved")
    await page.waitForTimeout(6000)
  })
}

/** Drag Jonas's session from the tray onto the day grid; cause + fix a conflict. */
async function agendaDrag() {
  {
    const client = await organizerClient()
    const event = await mainEvent(client)
    const id = await ensureFixture(client, event, CAST.jonas, "accepted")
    await client.mutation(api.agenda.unschedule, { submissionId: id }).catch(() => {})
  }
  await recordBeat("agenda-drag", async (page, { mark }) => {
    await gotoStable(page, "/app/agenda?view=day")
    await page.waitForTimeout(1200)
    mark("agenda")
    const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const card = page
      .getByRole("button", { name: new RegExp(`${esc(CAST.jonas.title)}.*schedule this session`, "i") })
      .first()
    await card.waitFor({ timeout: 20000 })
    // Land exactly on an existing block → instant conflict.
    const block = page.locator('[data-slot="agenda-grid-block"]').first()
    await block.waitFor({ timeout: 20000 })
    const target = await block.boundingBox()
    const from = await glideTo(page, card, { duration: 700 })
    await page.waitForTimeout(350)
    await page.mouse.down()
    await page.waitForTimeout(200)
    await page.mouse.move(from.x + 24, from.y + 18, { steps: 8 })
    await glide(page, { x: target.x + target.width / 2, y: target.y + 12 }, { duration: 1100 })
    await page.waitForTimeout(450)
    await page.mouse.up()
    mark("dropped-conflict")
    // The conflict flash: tab badge + red treatment. Hold on it.
    await page.waitForTimeout(2600)
    // Fix it: drag the block down to a free slot.
    const mine = page.getByRole("button", { name: new RegExp(esc(CAST.jonas.title), "i") }).first()
    const mb = await mine.boundingBox()
    await glide(page, { x: mb.x + mb.width / 2, y: mb.y + 10 }, { duration: 500 })
    await page.mouse.down()
    await page.waitForTimeout(200)
    await page.mouse.move(mb.x + mb.width / 2 + 16, mb.y + 40, { steps: 8 })
    await glide(page, { x: mb.x + mb.width / 2, y: Math.min(mb.y + 320, 940) }, { duration: 900 })
    await page.waitForTimeout(400)
    await page.mouse.up()
    mark("resolved")
    await page.waitForTimeout(2600)
  })
}

/** Auto-place the remaining unscheduled sessions. */
async function autoPlace() {
  {
    const client = await organizerClient()
    const event = await mainEvent(client)
    for (const key of ["sofia", "tom"]) {
      const id = await ensureFixture(client, event, CAST[key], "accepted")
      await client.mutation(api.agenda.unschedule, { submissionId: id }).catch(() => {})
    }
  }
  await recordBeat("auto-place", async (page, { mark }) => {
    await gotoStable(page, "/app/agenda?view=day")
    await page.waitForTimeout(1200)
    mark("agenda")
    await clickCalm(page, page.getByRole("button", { name: /auto-place/i }).first())
    await page.getByRole("heading", { name: /auto-place \d+ unscheduled/i }).first().waitFor({ timeout: 15000 })
    mark("dialog")
    await page.waitForTimeout(1600)
    await clickCalm(page, page.getByRole("button", { name: /place \d+ session/i }).first())
    mark("placed")
    await page.waitForTimeout(3000)
  })
}

/** Publish the agenda, then visit the public event page. */
async function publish() {
  const client = await organizerClient()
  const event = await mainEvent(client)
  // Film the real transition: make sure we start unpublished.
  await client.mutation(api.agenda.unpublishAgenda, { eventId: event._id }).catch(() => {})
  await recordBeat("publish", async (page, { mark }) => {
    await gotoStable(page, "/app/agenda")
    await page.waitForTimeout(1000)
    await clickCalm(page, page.getByRole("button", { name: /^publish agenda$/i }).first())
    await page.getByRole("heading", { name: /publish the agenda\?/i }).first().waitFor({ timeout: 15000 })
    mark("dialog")
    await page.waitForTimeout(1400)
    await clickCalm(page, page.getByRole("button", { name: /^publish agenda$/i }).last())
    await page.getByText(/^published ·/i).first().waitFor({ timeout: 30000 })
    mark("published")
    await page.waitForTimeout(1600)
    await gotoStable(page, `/e/${EVENT_SLUG}`)
    mark("public-page")
    await page.waitForTimeout(1600)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(1200)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(1800)
  })
}

/** Form builder: open the CFP form, walk the wizard, flip a toggle. */
async function formBuilder() {
  await recordBeat("form-builder", async (page, { mark }) => {
    await gotoStable(page, "/app/forms")
    await page.waitForTimeout(900)
    mark("forms")
    await clickCalm(page, page.getByRole("link", { name: /CFP 2026/i }).first())
    await page.waitForTimeout(1600)
    mark("builder")
    // Step to Submission questions in the left rail.
    await clickUntil(page, page.getByRole("button", { name: /submission questions/i }),
      page.getByText(/8 questions on the form|questions on the form/i))
    await page.waitForTimeout(1600)
    mark("questions-step")
    // A slow read through the question list — toggles, locked fields, routing.
    await glide(page, { x: 1060, y: 620 }, { duration: 500 })
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 130)
      await page.waitForTimeout(320)
    }
    await page.waitForTimeout(900)
    mark("scrolled")
    await clickCalm(page, page.getByRole("button", { name: /participants/i }).first())
    await page.waitForTimeout(1800)
    mark("participants-step")
    await page.waitForTimeout(1400)
  })
}

/** Held frames. */
async function stills() {
  await still("dashboard", "/app")
  await still("speakers", "/app/speakers")
  await still("communications", "/app/communications")
  await still("mcp", "/app/settings/api-mcp")
  await still("embeds", "/app/embeds")
  await still("public-event", `/e/${EVENT_SLUG}`, null, { authed: false })
  await still("evaluation", "/app/evaluation")
}

/** Remove every fixture this script created; leave the agenda published. */
async function cleanup() {
  const client = await organizerClient()
  const state = loadState()
  const ids = Object.values(state.fixtureIds ?? {})
  if (state.mayaId) ids.push(state.mayaId)
  for (const id of ids) {
    await client.mutation(api.agenda.unschedule, { submissionId: id }).catch(() => {})
    await client.mutation(api.submissions.remove, { submissionId: id }).catch((e) =>
      console.log("  remove failed:", e.message?.slice(0, 120)))
  }
  // Remove every cast member's submissions AND person/roster rows.
  const event = await mainEvent(client)
  for (const p of Object.values(CAST)) {
    await resetPerson(client, event, p.email, p.title)
  }
  await client.mutation(api.agenda.publishAgenda, { eventId: event._id }).catch(() => {})
  console.log("— cleanup done (fixtures removed, agenda left published)")
}

// ——— CLI ————————————————————————————————————————————————————————————————————

const BEATS = {
  login, fixtures, cfp, triage, commit, acceptMaya, portal, copilot,
  "agenda-drag": agendaDrag, "auto-place": autoPlace, publish,
  "form-builder": formBuilder, stills, cleanup,
}
const ORDER = ["login", "fixtures", "form-builder", "cfp", "triage", "commit", "acceptMaya", "portal", "copilot", "agenda-drag", "auto-place", "publish", "stills", "cleanup"]

const args = process.argv.slice(2)
const names = args[0] === "all" ? ORDER : args
try {
  for (const name of names) {
    if (!BEATS[name]) throw new Error(`unknown beat: ${name}`)
    await BEATS[name]()
  }
} finally {
  await shutdown()
}

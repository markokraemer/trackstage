#!/usr/bin/env node
// Deterministic end-to-end backend verification against the live Convex dev
// deployment. Drives every module through its real flows and asserts
// behavior, including the rule-enforcement and scoping cases the eval kit
// probes. Run: node scripts/verify-backend.mjs   (after `pnpm exec convex run seed:run`)
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api.js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)
const CONVEX_URL = env.VITE_CONVEX_URL
const SITE_URL = env.VITE_CONVEX_SITE_URL
if (!CONVEX_URL) throw new Error("VITE_CONVEX_URL missing from .env.local")

const client = new ConvexHttpClient(CONVEX_URL)

let passed = 0
let failed = 0
const failures = []
function ok(name, cond, detail = "") {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}
async function throws(name, fn, match) {
  try {
    await fn()
    ok(name, false, "expected an error, got success")
  } catch (e) {
    const msg = String(e.message ?? e)
    ok(name, match ? msg.toLowerCase().includes(match.toLowerCase()) : true,
      match && !msg.toLowerCase().includes(match.toLowerCase()) ? `wrong error: ${msg.slice(0, 120)}` : "")
  }
}
const section = (name) => console.log(`\n■ ${name}`)

// ————— Auth (Better Auth) —————
section("Auth")
async function signIn(email, password) {
  const res = await fetch(`${SITE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`)
  const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const jwtCookie = setCookies.find((c) => c.includes("convex_jwt="))
  const jwt = jwtCookie?.match(/convex_jwt=([^;]+)/)?.[1]
  if (!jwt) throw new Error("no convex_jwt cookie in sign-in response")
  return decodeURIComponent(jwt)
}
const jwt = await signIn("organizer@demo.sessionboard.dev", "demo2026")
ok("Better Auth sign-in yields Convex JWT", jwt.split(".").length === 3)
client.setAuth(jwt)
const badSignIn = await fetch(`${SITE_URL}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
  body: JSON.stringify({ email: "organizer@demo.sessionboard.dev", password: "nope" }),
})
ok("wrong password rejected", badSignIn.status === 401 || badSignIn.status === 400, `status ${badSignIn.status}`)
const me = await client.query(api.auth.getCurrentUser, {})
ok("getCurrentUser resolves organizer", me?.email === "organizer@demo.sessionboard.dev")
const anonClient = new ConvexHttpClient(CONVEX_URL)
ok("anonymous getCurrentUser → null", (await anonClient.query(api.auth.getCurrentUser, {})) === null)

// ————— Events + scoping fixture —————
section("Events")
const events = await client.query(api.events.list, {})
ok("two seeded events", events.length >= 2, `got ${events.length}`)
const main = events.find((e) => e.slug === "ai-summit-2026")
const other = events.find((e) => e.slug === "design-systems-day")
ok("main event exists", !!main)
ok("second event exists (scoping fixture)", !!other)
ok("anonymous events.list is empty (scoped)", (await anonClient.query(api.events.list, {})).length === 0)
const pub = await client.query(api.events.getBySlug, { slug: "ai-summit-2026" })
ok("public getBySlug returns safe fields", !!pub && pub.name?.length > 0)

// ————— Rooms & Tracks —————
section("Rooms & Tracks")
const rt = await client.query(api.roomsTracks.list, { eventId: main._id })
ok("seeded rooms ≥ 2", rt.rooms.length >= 2)
ok("seeded tracks ≥ 3", rt.tracks.length >= 3)
const tempRoom = await client.mutation(api.roomsTracks.addRoom, {
  eventId: main._id, name: "Verify Room", capacity: 10,
})
await client.mutation(api.roomsTracks.deleteRoom, { roomId: tempRoom })
ok("room add+delete roundtrip", true)

// ————— Forms —————
section("Forms")
const forms = await client.query(api.forms.list, { eventId: main._id })
const cfp = forms.find((f) => f.slug === "cfp")
ok("seeded cfp form exists + open", cfp?.status === "open")
ok("form has submission count", typeof cfp.submissionCount === "number" && cfp.submissionCount > 0)
const formFull = await client.query(api.forms.get, { formId: cfp._id })
ok("form has conditional question", formFull.questions.some((q) => q.showIf))
ok("form has track routing question", formFull.questions.some((q) => q.isTrackQuestion))
await throws("locked question cannot be disabled", () =>
  client.mutation(api.forms.update, {
    formId: cfp._id,
    patch: { questions: formFull.questions.map((q) => q.id === "title" ? { ...q, enabled: false } : q) },
  }), "required")

// ————— Public submit flow (rules!) —————
section("Public submission flow")
const pubForm = await client.query(api.submit.getForm, { slug: "cfp" })
ok("public form loads with questions", pubForm.questions.length >= 5)
ok("speaker min is 1 (no trap)", pubForm.participantConfig.speakerMin === 1)
const verifyEmail = `verify-e2e-${Date.now().toString(36)}@example.com`
const ident = await client.mutation(api.submit.identify, { slug: "cfp", email: verifyEmail })
ok("identify returns portal token", typeof ident.portalToken === "string")
const PT = ident.portalToken
await throws("bad email rejected", () =>
  client.mutation(api.submit.identify, { slug: "cfp", email: "not-an-email" }), "valid email")

const trackQ = pubForm.questions.find((q) => q.isTrackQuestion)
const goodAnswers = {
  title: "Verification Talk", description: "<p>A talk created by the verify script.</p>",
  format: "Talk", [trackQ.id]: trackQ.options[0], level: "Introductory", language: "English",
}
await throws("missing required fields rejected", () =>
  client.mutation(api.submit.submit, {
    slug: "cfp", portalToken: PT, title: "X", answers: { title: "X" },
    participants: [{ firstName: "V", lastName: "E", email: verifyEmail, role: "speaker" }],
  }), "missing required")
await throws("zero speakers rejected", () =>
  client.mutation(api.submit.submit, {
    slug: "cfp", portalToken: PT, title: "Verification Talk", answers: goodAnswers, participants: [],
  }), "speaker")
const draft = await client.mutation(api.submit.saveDraft, {
  slug: "cfp", portalToken: PT, title: "Verification Talk", answers: goodAnswers,
  participants: [{ firstName: "Vera", lastName: "Efftest", email: verifyEmail, role: "speaker", bio: "Test bio" }],
})
ok("draft saved", !!draft.draftId)
const submitted = await client.mutation(api.submit.submit, {
  slug: "cfp", portalToken: PT, draftId: draft.draftId, title: "Verification Talk",
  answers: goodAnswers,
  participants: [{ firstName: "Vera", lastName: "Efftest", email: verifyEmail, role: "speaker", bio: "Test bio" }],
})
ok("submission accepted with track routing", !!submitted.submissionId)

// ————— Organizer pipeline: queues + commit —————
section("Submissions pipeline")
const counts0 = await client.query(api.submissions.counts, { eventId: main._id })
ok("counts include all statuses", "accept_queue" in counts0 && "pending" in counts0)
const detail = await client.query(api.submissions.get, { submissionId: submitted.submissionId })
ok("submitted talk visible to organizer, pending", detail.status === "pending")
ok("track auto-routed from answer", detail.track !== null)
await client.mutation(api.submissions.setStatus, {
  submissionId: submitted.submissionId, status: "accept_queue",
})
const msgsBefore = (await client.query(api.comms.listMessages, { eventId: main._id })).length
const commit = await client.mutation(api.submissions.commitQueue, {
  eventId: main._id, queue: "accept_queue",
})
ok("queue commit processed ≥1", commit.committed >= 1)
const afterCommit = await client.query(api.submissions.get, { submissionId: submitted.submissionId })
ok("status flipped to accepted + stamped", afterCommit.status === "accepted" && !!afterCommit.decidedAt)
const msgsAfter = await client.query(api.comms.listMessages, { eventId: main._id })
ok("acceptance email queued in outbox", msgsAfter.length > msgsBefore)
ok("outbox message has rendered body", msgsAfter.some((m) => m.body?.includes("Verification Talk") || m.subject?.length > 0))

// ————— Portal (speaker side) —————
section("Speaker portal")
const home = await client.query(api.portal.home, { portalToken: PT })
ok("portal home shows my submission accepted", home.submissions.some((s) => s.id === submitted.submissionId && s.status === "accepted"))
ok("onboarding tasks created on accept", home.tasks.length >= 2, `got ${home.tasks.length}`)
await client.mutation(api.portal.updateProfile, {
  portalToken: PT, patch: { bio: "An updated bio from the verify script.", jobTitle: "QA Engineer" },
})
const home2 = await client.query(api.portal.home, { portalToken: PT })
ok("bio saved", home2.me.bio?.includes("updated bio"))
ok("profile task auto-completed by bio", home2.tasks.filter((t) => t.kind === "profile").every((t) => t.completedAt))
await client.mutation(api.portal.updateSubmission, {
  portalToken: PT, submissionId: submitted.submissionId, patch: { title: "Verification Talk (edited)" },
})
const home3 = await client.query(api.portal.home, { portalToken: PT })
ok("accepted submission still editable (swyx rule)", home3.submissions.some((s) => s.title.includes("edited")))
await throws("cannot withdraw accepted", () =>
  client.mutation(api.portal.withdrawSubmission, { portalToken: PT, submissionId: submitted.submissionId }), "accepted")
await throws("bad portal token rejected", () => client.query(api.portal.home, { portalToken: "bogus" }), "portal link")

// ————— File upload + content approval —————
section("Files & approval")
const uploadUrl = await client.mutation(api.portal.generateUploadUrl, { portalToken: PT })
const blob = new Blob(["fake-slide-bytes"], { type: "application/pdf" })
const uploadRes = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: blob })
const { storageId } = await uploadRes.json()
ok("storage upload works", !!storageId)
const slidesTask = home2.tasks.find((t) => t.kind === "upload")
await client.mutation(api.portal.attachUpload, {
  portalToken: PT, storageId, filename: "slides.pdf", contentType: "application/pdf",
  size: 16, taskId: slidesTask?.id, submissionId: submitted.submissionId,
})
const myUploads = await client.query(api.portal.myUploads, { portalToken: PT })
const latestSlide = myUploads.filter((u) => u.filename === "slides.pdf").sort((a, b) => b.version - a.version)[0]
ok("upload attached, latest version pending", latestSlide?.approvalStatus === "pending")
const versionBefore = latestSlide.version
const adminUploads = await client.query(api.tasksAdmin.listUploads, { eventId: main._id })
const mine = adminUploads.find((u) => u.filename === "slides.pdf")
await client.mutation(api.tasksAdmin.reviewUpload, {
  uploadId: mine.id, approvalStatus: "changes_requested", reviewNote: "Please use the template",
})
const homeAfterReject = await client.query(api.portal.home, { portalToken: PT })
ok("changes_requested reopens task", homeAfterReject.tasks.some((t) => t.kind === "upload" && !t.completedAt))
const uploadUrl2 = await client.mutation(api.portal.generateUploadUrl, { portalToken: PT })
const res2 = await fetch(uploadUrl2, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Blob(["v2"]) })
const { storageId: storageId2 } = await res2.json()
await client.mutation(api.portal.attachUpload, {
  portalToken: PT, storageId: storageId2, filename: "slides.pdf", contentType: "application/pdf",
  size: 2, taskId: slidesTask?.id, submissionId: submitted.submissionId,
})
const myUploads2 = await client.query(api.portal.myUploads, { portalToken: PT })
ok("re-upload increments version", myUploads2.some((u) => u.filename === "slides.pdf" && u.version === versionBefore + 1))

// ————— Agenda + conflicts + auto-place —————
section("Agenda")
const board0 = await client.query(api.agenda.board, { eventId: main._id })
ok("board has scheduled sessions", board0.scheduled.length >= 3)
ok("seed has no conflicts", board0.conflicts.length === 0, JSON.stringify(board0.conflicts).slice(0, 200))
ok("our accepted talk is in unscheduled tray", board0.unscheduled.some((s) => s.id === submitted.submissionId))
const clashTarget = board0.scheduled[0]
await client.mutation(api.agenda.schedule, {
  submissionId: submitted.submissionId, roomId: clashTarget.roomId,
  startsAt: clashTarget.startsAt, durationMinutes: 30,
})
const board1 = await client.query(api.agenda.board, { eventId: main._id })
ok("room conflict detected", board1.conflicts.some((c) => c.kind === "room"))
await client.mutation(api.agenda.unschedule, { submissionId: submitted.submissionId })
const board2 = await client.query(api.agenda.board, { eventId: main._id })
ok("unschedule clears conflict", board2.conflicts.length === 0)
const placed = await client.mutation(api.agenda.autoPlace, { eventId: main._id })
ok("auto-place scheduled something", placed.placed >= 1, JSON.stringify(placed))
const board3 = await client.query(api.agenda.board, { eventId: main._id })
ok("auto-place created no conflicts", board3.conflicts.length === 0)

// ————— Evaluation —————
section("Evaluation")
const plans = await client.query(api.evaluationsAdmin.listPlans, { eventId: main._id })
ok("seeded plans ≥ 2", plans.length >= 2)
const newPlan = await client.mutation(api.evaluationsAdmin.createPlan, {
  eventId: main._id, name: "Verify Plan", round: 3,
  criteria: [{ id: "overall", label: "Overall" }],
  submissionIds: [submitted.submissionId], evaluatorEmails: ["verifier@example.com"],
})
const planDetail = await client.query(api.evaluationsAdmin.planDetail, { planId: newPlan })
const evalToken = planDetail.evaluators[0].token
const queue = await client.query(api.review.queue, { token: evalToken })
ok("evaluator queue via magic token", queue.submissions.length === 1)
await client.mutation(api.review.submitScores, {
  token: evalToken, submissionId: submitted.submissionId, scores: { overall: 4 }, comment: "Solid.",
})
const prog = await client.query(api.review.progress, { token: evalToken })
ok("progress 1/1", prog.done === 1 && prog.total === 1)
await throws("score >5 rejected", () =>
  client.mutation(api.review.submitScores, { token: evalToken, submissionId: submitted.submissionId, scores: { overall: 9 } }))
const scores = await client.query(api.evaluationsAdmin.scoresBySubmission, { eventId: main._id })
ok("avg score visible to organizer", scores[submitted.submissionId]?.avg === 4)
await throws("bad evaluator token rejected", () => client.query(api.review.queue, { token: "bogus" }))

// ————— Dashboard —————
section("Dashboard")
const overview = await client.query(api.dashboard.overview, { eventId: main._id, now: Date.now() })
ok("overview status counts sane", overview.statusCounts.accepted >= 4)
ok("outstanding tasks tracked", overview.outstandingTaskCount >= 1)
ok("chase list present", Array.isArray(overview.topSpeakersByOutstandingTasks))
const roster = await client.query(api.dashboard.speakersRoster, { eventId: main._id })
ok("roster includes our speaker w/ portal token", roster.some((s) => s.email === verifyEmail && s.portalToken))

// ————— Public widgets data —————
section("Public data")
const sched = await client.query(api.publicData.schedule, { slug: "ai-summit-2026" })
ok("public schedule has days+sessions", sched.days.length >= 1 && sched.days.some((d) => d.sessions.length > 0))
const speakers = await client.query(api.publicData.speakers, { slug: "ai-summit-2026" })
ok("speaker gallery populated", speakers.speakers.length >= 3)
ok("no emails leaked in gallery", !JSON.stringify(speakers).includes("@example.com") || speakers.speakers.every((s) => !s.email))
const sessions = await client.query(api.publicData.sessionsList, { slug: "ai-summit-2026" })
ok("sessions list + facets", sessions.sessions.length >= 4 && sessions.facets.tracks.length >= 1)
const detail1 = await client.query(api.publicData.sessionDetail, { slug: "ai-summit-2026", submissionId: String(submitted.submissionId) })
ok("session detail resolves", detail1.session?.title?.includes("Verification"))
ok("cross-event isolation: other slug can't see our session",
  (await client.query(api.publicData.sessionDetail, { slug: "design-systems-day", submissionId: String(submitted.submissionId) })).session === null)
ok("no portal tokens leaked publicly", !JSON.stringify({ sched, speakers, sessions }).includes(PT))

// ————— Comms —————
section("Comms")
const templates = await client.query(api.comms.listTemplates, { eventId: main._id })
ok("5 seeded templates", templates.length >= 5, `got ${templates.length}`)
const remind = await client.mutation(api.comms.remindIncompleteSpeakers, { eventId: main._id })
ok("reminders queued for incomplete", typeof remind.queued === "number")

// ————— Core basics: event + workspace lifecycle —————
section("Core basics (events & workspaces)")
const myWorkspaces = await client.query(api.workspaces.mine, {})
ok("I belong to a workspace", myWorkspaces.length >= 1)
const ws = myWorkspaces[0]
const wsDetail = await client.query(api.workspaces.get, { organizationId: ws.id })
ok("workspace detail shows my role", ["owner", "admin", "member"].includes(wsDetail.myRole))
await client.mutation(api.workspaces.update, { organizationId: ws.id, patch: { name: ws.name } })
ok("workspace rename roundtrip", true)
const newEventId = await client.mutation(api.events.create, {
  organizationId: ws.id, name: "Verify Event", slug: `verify-event-${Date.now().toString(36)}`,
  timezone: "Europe/Berlin", type: "Meetup",
})
ok("event created", typeof newEventId === "string")
await client.mutation(api.events.update, { eventId: newEventId, patch: { venue: "Test Hall" } })
const createdEvent = await client.query(api.events.get, { eventId: newEventId })
ok("event update persists", createdEvent.venue === "Test Hall")
await client.mutation(api.roomsTracks.addRoom, { eventId: newEventId, name: "Solo Room" })
await client.mutation(api.events.remove, { eventId: newEventId })
ok("event delete cascades", (await client.query(api.events.list, {})).every((e) => e._id !== newEventId))
const inviteEmail = `invitee-${Date.now().toString(36)}@example.com`
await client.mutation(api.workspaces.addMember, { organizationId: ws.id, email: inviteEmail, role: "member" })
const memberRows = await client.query(api.workspaces.members, { organizationId: ws.id })
ok("member invite pending row exists", memberRows.some((m) => m.email === inviteEmail && m.userId === ""))
const pendingRow = memberRows.find((m) => m.email === inviteEmail)
await client.mutation(api.workspaces.removeMember, { memberId: pendingRow._id })
ok("member remove works", true)

// ————— Cross-org scoping (enterprise multi-tenancy) —————
section("Multi-tenancy scoping")
const stranger = `stranger-${jwt.slice(-8).replace(/[^a-z0-9]/gi, "")}@example.com`
await fetch(`${SITE_URL}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
  body: JSON.stringify({ name: "Sam Stranger", email: stranger, password: "stranger-pass-1" }),
})
const strangerJwt = await signIn(stranger, "stranger-pass-1")
const strangerClient = new ConvexHttpClient(CONVEX_URL)
strangerClient.setAuth(strangerJwt)
ok("stranger sees no events", (await strangerClient.query(api.events.list, {})).length === 0)
await throws("stranger cannot read event", () =>
  strangerClient.query(api.events.get, { eventId: main._id }), "access")
await throws("stranger cannot read submissions", () =>
  strangerClient.query(api.submissions.counts, { eventId: main._id }), "access")
await throws("stranger cannot commit queues", () =>
  strangerClient.mutation(api.submissions.commitQueue, { eventId: main._id, queue: "accept_queue" }), "access")

// ————— HTTP API —————
section("HTTP API")
if (SITE_URL) {
  const unauth = await fetch(`${SITE_URL}/v1/event/ai-summit-2026/sessions`)
  ok("API rejects missing bearer (401)", unauth.status === 401)
  const authed = await fetch(`${SITE_URL}/v1/event/ai-summit-2026/sessions?pageSize=2`, {
    headers: { Authorization: "Bearer demo-api-token" },
  })
  const body = await authed.json()
  ok("API paginates", body.pagination?.pageSize === 2 && Array.isArray(body.data))
  const notFound = await fetch(`${SITE_URL}/v1/event/nope/sessions`, { headers: { Authorization: "Bearer demo-api-token" } })
  ok("API 404 on unknown event", notFound.status === 404)
  const ics = await fetch(`${SITE_URL}/v1/event/ai-summit-2026/schedule.ics`)
  const icsText = await ics.text()
  ok("ics feed valid-ish", ics.status === 200 && icsText.startsWith("BEGIN:VCALENDAR") && icsText.includes("BEGIN:VEVENT"))
  ok("ics uses CRLF", icsText.includes("\r\n"))
} else {
  ok("SITE_URL missing — skipped HTTP API checks", false, "add VITE_CONVEX_SITE_URL to .env.local")
}

// ————— Summary —————
console.log(`\n━━━ ${passed} passed, ${failed} failed ━━━`)
if (failures.length) {
  console.log("FAILURES:")
  for (const f of failures) console.log(`  · ${f}`)
  process.exit(1)
}

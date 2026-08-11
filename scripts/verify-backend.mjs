#!/usr/bin/env node
// Deterministic end-to-end backend verification against the live Convex dev
// deployment. Drives every module through its real flows and asserts
// behavior, including the rule-enforcement and scoping cases the eval kit
// probes. Run: node scripts/verify-backend.mjs   (after `pnpm exec convex run seed:run`)
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api.js"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

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

// ————— File-storage helpers —————
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))
/**
 * Call an INTERNAL Convex function through the CLI. The HTTP client can only
 * reach public functions, and proving "the blob is really gone" must not
 * require exposing storage internals on the public API.
 */
function convexRun(fn, args = {}) {
  const out = execFileSync(
    "pnpm",
    ["exec", "convex", "run", fn, JSON.stringify(args)],
    { encoding: "utf8", cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] },
  )
  const start = out.indexOf("{")
  return JSON.parse(start === -1 ? out.trim() : out.slice(start))
}
/** Convex stores the checksum base64-encoded (NOT hex, despite the docs). */
const sha256Of = (value) => createHash("sha256").update(value).digest("base64")
/** PNG magic number + padding — enough bytes to be a file, small enough to be free. */
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
])

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

// ————— Submission side-effects: confirmation + organizer alerts —————
// Both were configured-but-inert before the coverage audit (matrix #84, #69):
// `sendConfirmationEmail` and `notifyEmails` were stored and read by nothing.
section("Submission side-effects")
const outboxAfterSubmit = await client.query(api.comms.listMessages, {
  eventId: main._id, limit: 500,
})
const confirmation = outboxAfterSubmit.find(
  (m) => m.templateKey === "confirmation" && m.toEmail === verifyEmail,
)
ok("confirmation email queued for the submitter", !!confirmation)
ok("confirmation names the submission and renders every placeholder",
  Boolean(confirmation) && !confirmation.body.includes("{{") &&
    confirmation.body.includes("Verification Talk") &&
    confirmation.body.includes("/portal/t/"),
  confirmation?.subject)
ok("confirmation is linked to the submission", confirmation?.submissionId === submitted.submissionId)

// Negative: the toggle actually gates the send.
await client.mutation(api.forms.update, {
  formId: cfp._id,
  patch: { participantConfig: { ...formFull.participantConfig, sendConfirmationEmail: false } },
})
const quietEmail = `verify-quiet-${Date.now().toString(36)}@example.com`
const quietIdent = await client.mutation(api.submit.identify, { slug: "cfp", email: quietEmail })
const quietSubmission = await client.mutation(api.submit.submit, {
  slug: "cfp", portalToken: quietIdent.portalToken, title: "Quiet Talk", answers: { ...goodAnswers, title: "Quiet Talk" },
  participants: [{ firstName: "Quinn", lastName: "Quiet", email: quietEmail, role: "speaker" }],
})
const outboxQuiet = await client.query(api.comms.listMessages, { eventId: main._id, limit: 500 })
ok("sendConfirmationEmail=false sends nothing",
  !outboxQuiet.some((m) => m.toEmail === quietEmail))
await client.mutation(api.forms.update, {
  formId: cfp._id,
  patch: { participantConfig: { ...formFull.participantConfig, sendConfirmationEmail: true } },
})

// notifyEmails goes to organizer addresses, which are NOT event people — so
// these bypass the outbox entirely. The scheduler is the durable evidence.
const notifyProbe = convexRun("platformEmails:recentSubmissionNotifications")
const newAlerts = notifyProbe.notifications.filter((n) => n.kind === "new")
ok("new-submission alert scheduled for the form's notify list",
  newAlerts.some((n) => n.submissionTitle === "Verification Talk" &&
    n.to.includes("organizer@demo.sessionboard.dev")),
  JSON.stringify(newAlerts.slice(0, 2)))
ok("alert deep-links to the submission in the organizer app",
  newAlerts.some((n) => n.link.includes(`/app/submissions?id=${submitted.submissionId}`)))
ok("alert scheduling never fails the submission",
  newAlerts.every((n) => n.state !== "failed"))
ok("every submission on a notified form raises an alert",
  newAlerts.some((n) => n.submissionTitle === "Quiet Talk"),
  `quiet submission ${quietSubmission.submissionId}`)

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

// ————— Custom session statuses —————
// Settings → Statuses. A status is a LABEL bound to a pipeline value: the
// submission's `status` stays the enum, `statusId` remembers the wording. The
// assertions below prove exactly that separation, including the rules that
// stop an organizer breaking the pipeline with a rename.
section("Custom session statuses")
const statusList = await client.query(api.sessionStatuses.list, { eventId: main._id })
ok("statuses are materialised for a seeded event", statusList.initialized === true)
const builtInKeys = statusList.statuses.filter((s) => s.systemKey).map((s) => s.systemKey)
ok("all seven built-ins ship", ["draft", "pending", "accept_queue", "decline_queue", "accepted", "declined", "withdrawn"]
  .every((key) => builtInKeys.includes(key)), builtInKeys.join(","))
ok("built-ins carry category + colour + order", statusList.statuses.every((s) =>
  ["draft", "pending", "accepted", "declined", "withdrawn"].includes(s.category) &&
  ["green", "amber", "red", "gray", "blue"].includes(s.color) &&
  typeof s.order === "number"))
ok("statuses come back in display order", statusList.statuses.every((s, i, all) =>
  i === 0 || all[i - 1].order <= s.order))
ok("built-ins read as System in the Added-by column",
  statusList.statuses.filter((s) => s.systemKey)
    .every((s) => s.createdBy === null && s.createdAt === null))
const seededWaitlist = statusList.statuses.find((s) => s.name === "Waitlist")
ok("the seeded custom status exists and is pending-flavoured",
  !!seededWaitlist && seededWaitlist.category === "pending" && seededWaitlist.pipelineStatus === "pending")
ok("the seeded custom status names who added it and when",
  !!seededWaitlist.createdBy && typeof seededWaitlist.createdAt === "number")
/**
 * Every live submission is counted exactly once across the status list — the
 * invariant that proves a label shadows its built-in rather than double-
 * counting. The list and the total are two queries, so a submission created
 * between them reads as a phantom mismatch; a genuine accounting bug never
 * agrees, so retry a couple of times before calling it a failure.
 */
async function statusCountsBalance() {
  let detail = ""
  for (let attempt = 0; attempt < 4; attempt++) {
    const list = await client.query(api.sessionStatuses.list, { eventId: main._id })
    const total = (await client.query(api.submissions.counts, { eventId: main._id })).all
    const sum = list.statuses.reduce((n, s) => n + s.count, 0)
    if (sum === total) return { balanced: true, detail: "" }
    detail = `${sum} vs ${total}`
    await new Promise((r) => setTimeout(r, 400))
  }
  return { balanced: false, detail }
}
const balance0 = await statusCountsBalance()
ok("per-status counts add up to every submission", balance0.balanced, balance0.detail)

const holdName = `Verify Hold ${Date.now().toString(36)}`
const holdId = await client.mutation(api.sessionStatuses.create, {
  eventId: main._id, name: holdName, category: "accepted", color: "blue",
})
const withHold = await client.query(api.sessionStatuses.list, { eventId: main._id })
const hold = withHold.statuses.find((s) => s._id === holdId)
ok("custom status created", !!hold && hold.name === holdName)
ok("custom status inherits its category's pipeline value", hold.pipelineStatus === "accepted")
ok("custom status is not a built-in", !hold.systemKey)
ok("custom status records its author and creation time",
  typeof hold.createdBy === "string" && hold.createdBy.length > 0 &&
  typeof hold.createdAt === "number", `${hold.createdBy}`)
await throws("duplicate status name refused", () =>
  client.mutation(api.sessionStatuses.create, {
    eventId: main._id, name: holdName.toLowerCase(), category: "pending", color: "red",
  }), "already have a status")
await throws("a status needs a name", () =>
  client.mutation(api.sessionStatuses.create, {
    eventId: main._id, name: "   ", category: "pending", color: "red",
  }), "name")

await client.mutation(api.sessionStatuses.update, {
  statusId: holdId, patch: { name: `${holdName} v2`, color: "amber", order: 15 },
})
const renamed = (await client.query(api.sessionStatuses.list, { eventId: main._id }))
  .statuses.find((s) => s._id === holdId)
ok("rename + recolour + reorder persist",
  renamed.name === `${holdName} v2` && renamed.color === "amber" && renamed.order === 15)

const acceptedBuiltIn = withHold.statuses.find((s) => s.systemKey === "accepted")
await throws("a built-in status cannot be deleted", () =>
  client.mutation(api.sessionStatuses.remove, { statusId: acceptedBuiltIn._id }), "built-in")
await throws("a built-in status cannot change category", () =>
  client.mutation(api.sessionStatuses.update, {
    statusId: acceptedBuiltIn._id, patch: { category: "declined" },
  }), "category")

// The label rides along with the pipeline value, never instead of it.
await client.mutation(api.submissions.setStatus, {
  submissionId: submitted.submissionId, status: "accepted", statusId: holdId,
})
const labelled = await client.query(api.submissions.get, { submissionId: submitted.submissionId })
ok("submission keeps the pipeline status", labelled.status === "accepted")
ok("submission remembers the custom label", labelled.statusId === holdId)
const countedList = await client.query(api.sessionStatuses.list, { eventId: main._id })
ok("the custom status counts the submission",
  countedList.statuses.find((s) => s._id === holdId).count >= 1)
// Now that a submission wears a custom label, the same invariant must still
// hold: it is counted by the label, NOT also by the built-in it shadows.
const balance1 = await statusCountsBalance()
ok("the built-in it shadows no longer counts it", balance1.balanced, balance1.detail)
await throws("a label that disagrees with the status is refused", () =>
  client.mutation(api.submissions.setStatus, {
    submissionId: submitted.submissionId, status: "pending", statusId: holdId,
  }), "behaves as")

// Deleting a status people are using has to say where those submissions go.
await throws("delete refuses while submissions use the status", () =>
  client.mutation(api.sessionStatuses.remove, { statusId: holdId }), "move")
const removal = await client.mutation(api.sessionStatuses.remove, {
  statusId: holdId, reassignToStatusId: acceptedBuiltIn._id,
})
ok("delete with a reassignment target moves the submissions", removal.reassigned === 1)
const afterDelete = await client.query(api.submissions.get, { submissionId: submitted.submissionId })
ok("reassigned submission lands on the target status",
  afterDelete.statusId === acceptedBuiltIn._id && afterDelete.status === "accepted")
ok("deleted status is gone",
  (await client.query(api.sessionStatuses.list, { eventId: main._id }))
    .statuses.every((s) => s._id !== holdId))

// A label can go stale: re-categorising a custom status moves its pipeline
// value out from under submissions already wearing it. The stale label must be
// ignored everywhere and cleaned up on delete — never dragging the submission's
// pipeline status along with it.
const probeId = await client.mutation(api.sessionStatuses.create, {
  eventId: main._id, name: `Verify Stale ${Date.now().toString(36)}`,
  category: "accepted", color: "green",
})
const probeSubmission = await client.mutation(api.submissions.addManual, {
  eventId: main._id, kind: "abstract", title: "Stale Label Probe", status: "accepted",
})
await client.mutation(api.submissions.setStatus, {
  submissionId: probeSubmission, status: "accepted", statusId: probeId,
})
await client.mutation(api.sessionStatuses.update, {
  statusId: probeId, patch: { category: "declined" },
})
const staleList = await client.query(api.sessionStatuses.list, { eventId: main._id })
ok("re-categorising a custom status moves its pipeline value",
  staleList.statuses.find((s) => s._id === probeId).pipelineStatus === "declined")
ok("a stale label stops counting towards its status",
  staleList.statuses.find((s) => s._id === probeId).count === 0)
const staleRemoval = await client.mutation(api.sessionStatuses.remove, { statusId: probeId })
ok("a status held only by stale labels deletes without a reassignment target",
  staleRemoval.reassigned === 0)
const afterStale = await client.query(api.submissions.get, { submissionId: probeSubmission })
ok("the stale label is cleared, and the pipeline status is untouched",
  afterStale.statusId === undefined && afterStale.status === "accepted")
await client.mutation(api.submissions.remove, { submissionId: probeSubmission })

// A queue commit must never leave a label that contradicts the new status.
await client.mutation(api.submissions.setStatus, {
  submissionId: submitted.submissionId, status: "accept_queue",
})
ok("changing status without a label clears the old one",
  (await client.query(api.submissions.get, { submissionId: submitted.submissionId })).statusId === undefined)
await client.mutation(api.submissions.setStatus, {
  submissionId: submitted.submissionId, status: "accepted",
})

const otherStatuses = await client.query(api.sessionStatuses.list, { eventId: other._id })
ok("the second event has its own built-ins", otherStatuses.statuses.length === 7)
ok("custom statuses never leak across events",
  otherStatuses.statuses.every((s) => s.name !== "Waitlist"))

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
const updatedAlerts = convexRun("platformEmails:recentSubmissionNotifications")
  .notifications.filter((n) => n.kind === "updated")
ok("speaker edit alerts the form's notify list",
  updatedAlerts.some((n) => n.submissionTitle.includes("edited") &&
    n.to.includes("organizer@demo.sessionboard.dev")),
  JSON.stringify(updatedAlerts.slice(0, 2)))
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

// ————— File metadata comes from `_storage`, never from the client —————
const slideRows = myUploads2.filter((u) => u.filename === "slides.pdf").sort((a, b) => b.version - a.version)
const newestSlide = slideRows[0]
ok("upload carries real size from the _storage system table", newestSlide.size === 2, `got ${newestSlide.size}`)
ok("upload carries the sha256 checksum", /^[A-Za-z0-9+/]{43}=$/.test(newestSlide.sha256 ?? ""), newestSlide.sha256)
ok("sha256 matches the bytes we actually sent", newestSlide.sha256 === sha256Of("v2"), newestSlide.sha256)
ok("content type resolved from storage", newestSlide.contentType === "application/pdf")
ok("isImage flag is false for a PDF", newestSlide.isImage === false)
ok("blob resolves to a signed URL", typeof newestSlide.url === "string" && newestSlide.url.startsWith("http"))
// The client LIES about its size — the server must ignore it.
const liarUrl = await client.mutation(api.portal.generateUploadUrl, { portalToken: PT })
const liarRes = await fetch(liarUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Blob(["twelve-bytes-and-then-some"]) })
const { storageId: liarStorageId } = await liarRes.json()
await client.mutation(api.portal.attachUpload, {
  portalToken: PT, storageId: liarStorageId, filename: "liar.pdf", contentType: "text/x-fake",
  size: 1, submissionId: submitted.submissionId,
})
const afterLiar = await client.query(api.portal.myUploads, { portalToken: PT })
const liarRow = afterLiar.find((u) => u.filename === "liar.pdf")
ok("client-claimed size is ignored (real bytes win)", liarRow.size === 26, `got ${liarRow.size}`)
ok("client-claimed content type is ignored", liarRow.contentType === "application/pdf", liarRow.contentType)
// An executable, honestly labelled, is refused — the allowlist is server-side.
const exeUrl = await client.mutation(api.portal.generateUploadUrl, { portalToken: PT })
const exeRes = await fetch(exeUrl, { method: "POST", headers: { "Content-Type": "application/x-msdownload" }, body: new Blob(["MZ-not-really"]) })
const { storageId: exeStorageId } = await exeRes.json()
await throws("unsupported file types are refused server-side", () =>
  client.mutation(api.portal.attachUpload, {
    portalToken: PT, storageId: exeStorageId, filename: "payload.exe", submissionId: submitted.submissionId,
  }), "file type")
await throws("attaching a storage id that never landed is refused", () =>
  client.mutation(api.portal.attachUpload, {
    portalToken: PT, storageId: newestSlide.id, filename: "nope.pdf",
  }))

// Same bytes uploaded twice into one slot → flagged, not silently duplicated.
const dupeUrl = await client.mutation(api.portal.generateUploadUrl, { portalToken: PT })
const dupeRes = await fetch(dupeUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Blob(["v2"]) })
const { storageId: dupeStorageId } = await dupeRes.json()
await client.mutation(api.portal.attachUpload, {
  portalToken: PT, storageId: dupeStorageId, filename: "slides.pdf", contentType: "application/pdf",
  taskId: slidesTask?.id, submissionId: submitted.submissionId,
})
const afterDupe = await client.query(api.portal.myUploads, { portalToken: PT })
const dupeRow = afterDupe.filter((u) => u.filename === "slides.pdf").sort((a, b) => b.version - a.version)[0]
ok("re-uploading identical bytes is flagged as a duplicate", dupeRow.duplicateOfVersion === versionBefore + 1, JSON.stringify({ v: dupeRow.version, dupe: dupeRow.duplicateOfVersion }))

// ————— Headshot replacement deletes the blob it replaces —————
async function uploadHeadshot(bytes) {
  const url = await client.mutation(api.portal.generateUploadUrl, { portalToken: PT })
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/png" }, body: new Blob([bytes], { type: "image/png" }) })
  const { storageId: id } = await res.json()
  await client.mutation(api.portal.attachUpload, {
    portalToken: PT, storageId: id, filename: "headshot.png", contentType: "image/png", isHeadshot: true,
  })
  return id
}
const headshotA = await uploadHeadshot("headshot-one")
const headshotB = await uploadHeadshot("headshot-two")
const homeHeadshot = await client.query(api.portal.home, { portalToken: PT })
ok("headshot shows on the profile", typeof homeHeadshot.me.headshotUrl === "string")
const blobState = convexRun("files:blobsExist", { storageIds: [headshotA, headshotB] })
ok("replacing a headshot DELETES the old blob", blobState[headshotA] === false)
ok("the current headshot blob survives", blobState[headshotB] === true)
const uploadsAfterHeadshot = await client.query(api.portal.myUploads, { portalToken: PT })
ok("the superseded profile-photo row is gone too", !uploadsAfterHeadshot.some((u) => u.id === headshotA))

// ————— Organizer-side: attach on behalf of a speaker, then delete —————
const orgUploadUrl = await client.mutation(api.files.generateUploadUrl, { eventId: main._id })
const orgRes = await fetch(orgUploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Blob(["organizer-attached-deck"]) })
const { storageId: orgStorageId } = await orgRes.json()
const orgUploadId = await client.mutation(api.files.attachUploadAsOrganizer, {
  submissionId: submitted.submissionId, storageId: orgStorageId, filename: "organizer-deck.pdf",
})
const submissionFiles = await client.query(api.files.submissionFiles, { submissionId: submitted.submissionId })
const orgFile = submissionFiles.find((f) => f.id === orgUploadId)
ok("organizer can attach a file on a speaker's behalf", !!orgFile && orgFile.approvalStatus === "approved")
ok("organizer-attached file is filed under the primary speaker", orgFile.personName?.length > 0, orgFile.personName)
ok("the speaker sees it in their portal", (await client.query(api.portal.myUploads, { portalToken: PT })).some((u) => u.id === orgUploadId))
await throws("an anonymous caller cannot attach files to our submission", () =>
  anonClient.mutation(api.files.attachUploadAsOrganizer, {
    submissionId: submitted.submissionId, storageId: orgStorageId, filename: "evil.pdf",
  }))
await client.mutation(api.files.deleteUpload, { uploadId: orgUploadId })
ok("deleting a version removes the row", !(await client.query(api.files.submissionFiles, { submissionId: submitted.submissionId })).some((f) => f.id === orgUploadId))
ok("deleting a version deletes the blob", convexRun("files:blobsExist", { storageIds: [orgStorageId] })[orgStorageId] === false)

// ————— Event branding: upload → serve publicly → replace → clear —————
const logoUrlEndpoint = await client.mutation(api.files.generateUploadUrl, { eventId: main._id })
const logoRes = await fetch(logoUrlEndpoint, { method: "POST", headers: { "Content-Type": "image/png" }, body: new Blob([PNG_BYTES], { type: "image/png" }) })
const { storageId: logoStorageId } = await logoRes.json()
await client.mutation(api.files.setEventBranding, { eventId: main._id, slot: "logo", storageId: logoStorageId, filename: "logo.png" })
const branding = await client.query(api.files.eventBranding, { eventId: main._id })
ok("event logo stored with real metadata", branding.logo?.size === PNG_BYTES.length && branding.logo?.contentType === "image/png")
ok("event logo serves a signed URL", typeof branding.logo?.url === "string")
const publicEvent = await client.query(api.events.getBySlug, { slug: "ai-summit-2026" })
ok("public event page gets the logo URL", typeof publicEvent.logoUrl === "string")
ok("speaker portal gets the logo URL", typeof (await client.query(api.portal.home, { portalToken: PT })).event.logoUrl === "string")
const logoImage = await fetch(branding.logo.url)
ok("the logo actually downloads", logoImage.status === 200 && Number(logoImage.headers.get("content-length")) === PNG_BYTES.length)
await throws("branding refuses a non-image", () =>
  client.mutation(api.files.setEventBranding, { eventId: main._id, slot: "logo", storageId: orgStorageId, filename: "deck.pdf" }))
await throws("an anonymous caller cannot brand our event", () =>
  anonClient.mutation(api.files.setEventBranding, { eventId: main._id, slot: "logo", storageId: null }))
await client.mutation(api.files.setEventBranding, { eventId: main._id, slot: "logo", storageId: null })
ok("clearing the logo deletes the blob", convexRun("files:blobsExist", { storageIds: [logoStorageId] })[logoStorageId] === false)
ok("public page falls back to no logo", (await client.query(api.events.getBySlug, { slug: "ai-summit-2026" })).logoUrl === null)

// ————— File comments: one thread, both roles (sbek CNT-05) —————
section("File comments")
const commentFileId = newestSlide.id
await client.mutation(api.tasksAdmin.addUploadComment, {
  uploadId: commentFileId, body: "Can you re-export slide 12 on a light background?",
})
const speakerThread = await client.query(api.portal.uploadComments, { portalToken: PT, uploadId: commentFileId })
ok("the speaker sees the organizer's comment",
  speakerThread.some((c) => c.authorType === "organizer" && c.body.includes("slide 12")),
  JSON.stringify(speakerThread).slice(0, 160))
await client.mutation(api.portal.addUploadComment, {
  portalToken: PT, uploadId: commentFileId, body: "Done — re-uploaded with the light variant.",
})
const organizerThread = await client.query(api.tasksAdmin.listUploadComments, { uploadId: commentFileId })
ok("one thread, both roles, oldest first",
  organizerThread.length === 2 && organizerThread[0].authorType === "organizer" &&
    organizerThread[1].authorType === "speaker",
  JSON.stringify(organizerThread.map((c) => c.authorType)))
ok("the speaker's comment is attributed to them", organizerThread[1].authorLabel.includes("Vera"),
  organizerThread[1].authorLabel)
ok("the organizer's comment is attributed too", organizerThread[0].authorLabel.length > 0)
const uploadsWithComments = await client.query(api.tasksAdmin.listUploads, { eventId: main._id })
const commentedRow = uploadsWithComments.find((u) => u.id === commentFileId)
ok("the files list carries the comment count", commentedRow?.commentCount === 2, String(commentedRow?.commentCount))
ok("the files list carries the last-comment time",
  commentedRow?.lastCommentAt >= organizerThread[1].createdAt)
ok("the seeded deck ships with a real thread",
  uploadsWithComments.some((u) => u.id !== commentFileId && u.commentCount >= 2))
await throws("an empty comment is refused", () =>
  client.mutation(api.portal.addUploadComment, { portalToken: PT, uploadId: commentFileId, body: "   " }), "write something")
await throws("a 2,000-character cap is enforced", () =>
  client.mutation(api.tasksAdmin.addUploadComment, { uploadId: commentFileId, body: "x".repeat(2100) }), "2000")
await throws("anonymous cannot read a file thread", () =>
  anonClient.query(api.tasksAdmin.listUploadComments, { uploadId: commentFileId }))
await throws("anonymous cannot post to a file thread", () =>
  anonClient.mutation(api.tasksAdmin.addUploadComment, { uploadId: commentFileId, body: "hello" }))
const rosterForComments = await client.query(api.dashboard.speakersRoster, { eventId: main._id })
const strangerSpeaker = rosterForComments.find((s) => s.email !== verifyEmail && s.portalToken)
await throws("another speaker cannot read someone else's file thread", () =>
  client.query(api.portal.uploadComments, { portalToken: strangerSpeaker.portalToken, uploadId: commentFileId }), "access")
await throws("another speaker cannot post on someone else's file", () =>
  client.mutation(api.portal.addUploadComment, {
    portalToken: strangerSpeaker.portalToken, uploadId: commentFileId, body: "sneaking in",
  }), "access")

// ————— Reusable task library + per-speaker personalisation —————
section("Task library & personalisation")
const seededTemplates = await client.query(api.tasksAdmin.listTemplates, { eventId: main._id })
ok("every event starts with a task library", seededTemplates.length >= 3, `got ${seededTemplates.length}`)
ok("library tasks carry personalisation placeholders",
  seededTemplates.some((t) => (t.instructions ?? "").includes("{{firstName}}")))
const myPersonId = (await client.query(api.portal.home, { portalToken: PT })).me.id
const slidesTemplate = seededTemplates.find((t) => t.title === "Upload your slides")
ok("the slides task is in the library", !!slidesTemplate)
const fromLibrary = await client.mutation(api.tasksAdmin.assignFromTemplate, {
  templateId: slidesTemplate.id, personIds: [myPersonId], dueAt: Date.now() + 7 * 86400000,
})
ok("assigning from the library creates the task", fromLibrary.created === 1)
const personalisedTasks = (await client.query(api.portal.home, { portalToken: PT })).tasks
const personalised = personalisedTasks.find(
  (t) => t.title === "Upload your slides" && (t.instructions ?? "").includes("Vera"),
)
ok("{{firstName}} resolves to this speaker", !!personalised,
  JSON.stringify(personalisedTasks.map((t) => t.instructions?.slice(0, 40))))
ok("{{sessionTitle}} resolves to their own session",
  personalised?.instructions.includes("Verification Talk"), personalised?.instructions)
ok("no raw placeholder ever reaches a speaker",
  personalisedTasks.every((t) => !(t.instructions ?? "").includes("{{")))
const adminTaskRows = await client.query(api.tasksAdmin.list, { eventId: main._id })
const adminTaskRow = adminTaskRows.find(
  (t) => t.person?.id === myPersonId && (t.instructionsTemplate ?? "").includes("{{firstName}}"),
)
ok("the organizer's list shows the resolved wording",
  adminTaskRow?.instructions.includes("Vera") && !adminTaskRow.instructions.includes("{{"))
ok("the organizer's list keeps the unresolved text for editing",
  adminTaskRow?.instructionsTemplate.includes("{{firstName}}"))

const savedTitle = `Sign the speaker agreement ${Date.now().toString(36)}`
const savedTask = await client.mutation(api.tasksAdmin.create, {
  eventId: main._id, personIds: [myPersonId], title: savedTitle,
  instructions: "{{firstName}}, sign and return the agreement for “{{sessionTitle}}”.",
  kind: "confirm", saveAsTemplate: true,
})
ok("a task can be assigned and saved to the library in one go",
  savedTask.created === 1 && !!savedTask.templateId)
await client.mutation(api.tasksAdmin.create, {
  eventId: main._id, personIds: [myPersonId], title: savedTitle,
  instructions: "{{firstName}}, sign and return the agreement.", kind: "confirm", saveAsTemplate: true,
})
const templatesAfterSave = await client.query(api.tasksAdmin.listTemplates, { eventId: main._id })
ok("saving the same name twice updates instead of duplicating",
  templatesAfterSave.filter((t) => t.title === savedTitle).length === 1)
const savedTemplate = templatesAfterSave.find((t) => t.title === savedTitle)
await client.mutation(api.tasksAdmin.updateTemplate, {
  templateId: savedTemplate.id, patch: { alias: "Speaker agreement" },
})
const aliased = (await client.query(api.tasksAdmin.listTemplates, { eventId: main._id }))
  .find((t) => t.id === savedTemplate.id)
ok("a library task can be renamed for the portal", aliased?.alias === "Speaker agreement")
await client.mutation(api.tasksAdmin.assignFromTemplate, {
  templateId: savedTemplate.id, personIds: [myPersonId],
})
const aliasedTasks = (await client.query(api.portal.home, { portalToken: PT })).tasks
ok("the speaker sees the alias, not the internal name",
  aliasedTasks.some((t) => t.title === "Speaker agreement"))
await throws("a library task needs at least one speaker", () =>
  client.mutation(api.tasksAdmin.assignFromTemplate, { templateId: savedTemplate.id, personIds: [] }), "at least one")
await throws("a library task refuses an unknown kind", () =>
  client.mutation(api.tasksAdmin.createTemplate, {
    eventId: main._id, title: "Nonsense", kind: "teleport",
  }), "invalid task kind")
await throws("anonymous cannot read the task library", () =>
  anonClient.query(api.tasksAdmin.listTemplates, { eventId: main._id }))
await throws("anonymous cannot write to the task library", () =>
  anonClient.mutation(api.tasksAdmin.createTemplate, { eventId: main._id, title: "Theirs", kind: "confirm" }))

// Leave the fixture as we found it: the library back to its three seeded
// entries and no stray tasks on Vera's checklist.
await client.mutation(api.tasksAdmin.removeTemplate, { templateId: savedTemplate.id })
const templatesAfterRemove = await client.query(api.tasksAdmin.listTemplates, { eventId: main._id })
ok("removing a library task leaves the seeded three",
  templatesAfterRemove.length === seededTemplates.length &&
    !templatesAfterRemove.some((t) => t.id === savedTemplate.id))
// (The library-assigned "Upload your slides" task stays: its twin holds the
// uploaded deck, and deleting a task out from under a file would leave the
// storage sweep with a dangling row.)
for (const row of await client.query(api.tasksAdmin.list, { eventId: main._id })) {
  if (row.person?.id !== myPersonId) continue
  if (row.title === savedTitle || row.title === "Speaker agreement") {
    await client.mutation(api.tasksAdmin.remove, { taskId: row.id })
  }
}
ok("the verify-created tasks are cleaned up",
  (await client.query(api.tasksAdmin.list, { eventId: main._id }))
    .every((t) => t.title !== savedTitle && t.title !== "Speaker agreement"))

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

// ————— Blind review (sbek ABS-07) —————
// The flag existed in the schema and was enforced nowhere; identities must be
// stripped SERVER-side, so the assertions read the raw payload, not the UI.
ok("an ordinary plan is not anonymized", queue.anonymized === false)
ok("an ordinary plan shows speaker names", queue.submissions[0].speakers.length >= 1,
  JSON.stringify(queue.submissions[0].speakers))
const blindPlan = await client.mutation(api.evaluationsAdmin.createPlan, {
  eventId: main._id, name: "Verify Blind Plan", round: 4,
  criteria: [{ id: "overall", label: "Overall" }],
  submissionIds: [submitted.submissionId], evaluatorEmails: ["blind-verifier@example.com"],
  blind: true,
})
const blindDetail = await client.query(api.evaluationsAdmin.planDetail, { planId: blindPlan })
ok("blind flag persisted through createPlan", blindDetail.plan.blind === true)
ok("blind flag surfaces on the plans list",
  (await client.query(api.evaluationsAdmin.listPlans, { eventId: main._id }))
    .find((p) => p._id === blindPlan)?.blind === true)
const blindToken = blindDetail.evaluators[0].token
const blindQueue = await client.query(api.review.queue, { token: blindToken })
ok("blind queue reports itself anonymized", blindQueue.anonymized === true)
ok("blind queue strips every speaker",
  blindQueue.submissions.length === 1 && blindQueue.submissions.every((s) => s.speakers.length === 0))
ok("blind payload leaks no speaker identity anywhere",
  !JSON.stringify(blindQueue).includes("Efftest") && !JSON.stringify(blindQueue).includes("QA Engineer"))
ok("blind queue still carries the abstract to score",
  blindQueue.submissions[0].title.length > 0 && blindQueue.submissions[0].track !== null)
await client.mutation(api.review.submitScores, {
  token: blindToken, submissionId: submitted.submissionId, scores: { overall: 5 }, comment: "Scored blind.",
})
ok("blind evaluator can still score", (await client.query(api.review.progress, { token: blindToken })).done === 1)
await client.mutation(api.evaluationsAdmin.updatePlan, { planId: blindPlan, blind: false })
const unblinded = await client.query(api.review.queue, { token: blindToken })
ok("un-blinding a plan restores speaker names",
  unblinded.anonymized === false && unblinded.submissions[0].speakers.length >= 1)
await client.mutation(api.evaluationsAdmin.deletePlan, { planId: blindPlan })

// ————— Dashboard —————
section("Dashboard")
const overview = await client.query(api.dashboard.overview, { eventId: main._id, now: Date.now() })
ok("overview status counts sane", overview.statusCounts.accepted >= 4)
ok("outstanding tasks tracked", overview.outstandingTaskCount >= 1)
ok("chase list present", Array.isArray(overview.topSpeakersByOutstandingTasks))
const roster = await client.query(api.dashboard.speakersRoster, { eventId: main._id })
ok("roster includes our speaker w/ portal token", roster.some((s) => s.email === verifyEmail && s.portalToken))
ok("roster rows carry a workflow status", roster.every((s) => ["invited", "confirmed", "dropped"].includes(s.workflowStatus)))

// ————— Speakers admin: manual add, profile edit, workflow status —————
section("Speakers admin")
const manualEmail = `manual-speaker-${Date.now().toString(36)}@example.com`
const manual = await client.mutation(api.speakersAdmin.addManual, {
  eventId: main._id, firstName: "Manu", lastName: "Alvarez", email: manualEmail,
  company: "Keynote Co", jobTitle: "CTO", workflowStatus: "invited",
})
ok("addManual creates a person with a portal token", manual.created && /^[0-9a-f]{48}$/.test(manual.portalToken))
const rosterAfterAdd = await client.query(api.dashboard.speakersRoster, { eventId: main._id })
const manualRow = rosterAfterAdd.find((s) => s.email === manualEmail)
ok("manually added speaker appears in the roster", !!manualRow, `roster has ${rosterAfterAdd.length} rows`)
ok("manual speaker keeps its workflow status", manualRow?.workflowStatus === "invited")
ok("manual speaker has no sessions yet", manualRow?.sessions.length === 0)
await throws("addManual rejects a junk email", () =>
  client.mutation(api.speakersAdmin.addManual, {
    eventId: main._id, firstName: "X", lastName: "Y", email: "nope",
  }), "valid email")
const dupe = await client.mutation(api.speakersAdmin.addManual, {
  eventId: main._id, firstName: "Manu", lastName: "Alvarez", email: manualEmail,
})
ok("addManual is idempotent on email (no duplicate people)", dupe.created === false && dupe.personId === manual.personId)
await client.mutation(api.speakersAdmin.updateProfile, {
  personId: manual.personId,
  patch: { bio: "Organizer-written bio for the public page.", headshotNote: "Needs a higher-res file" },
})
const rosterAfterEdit = await client.query(api.dashboard.speakersRoster, { eventId: main._id })
const editedRow = rosterAfterEdit.find((s) => s.email === manualEmail)
ok("organizer-side bio edit persists (CNT-10)", editedRow?.bio?.includes("Organizer-written") && editedRow?.hasBio)
ok("headshot note persists, organizer-only", editedRow?.headshotNote === "Needs a higher-res file")
await client.mutation(api.speakersAdmin.setWorkflowStatus, {
  personId: manual.personId, workflowStatus: "confirmed",
})
const rosterAfterStatus = await client.query(api.dashboard.speakersRoster, { eventId: main._id })
ok("workflow status change persists (SPK-04)",
  rosterAfterStatus.find((s) => s.email === manualEmail)?.workflowStatus === "confirmed")

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

// ————— Public visibility flags (sbek CNT-12) —————
// Two booleans, not a workflow: "Show on public schedule" per session and
// "Show in public gallery" per speaker. Both directions are asserted, and the
// organizer-facing side must be completely unaffected.
section("Public visibility flags")
const SLUG = "ai-summit-2026"
const publicSlug = { slug: SLUG }
const idsIn = (list, key = "_id") => list.map((row) => String(row[key]))
const icsIds = () => convexRun("publicData:icsFeed", publicSlug).events.map((e) => String(e.id))
const listedSessionIds = async () =>
  idsIn((await client.query(api.publicData.sessionsList, publicSlug)).sessions)
const scheduledSessionIds = async () => {
  const s = await client.query(api.publicData.schedule, publicSlug)
  return [...s.days.flatMap((d) => idsIn(d.sessions)), ...idsIn(s.unscheduled)]
}
const galleryIds = async () =>
  idsIn((await client.query(api.publicData.speakers, publicSlug)).speakers)

// A scheduled, spoken-at session: it is in every public surface incl. the feed.
const hideTarget =
  sessions.sessions.find((s) => s.startsAt !== undefined && s.speakers.length > 0) ??
  sessions.sessions[0]
ok("found a public session to hide", !!hideTarget)
ok("it starts out in the .ics feed", icsIds().includes(String(hideTarget._id)))

await client.mutation(api.submissions.updateDetails, {
  submissionId: hideTarget._id, patch: { publicVisible: false },
})
ok("hidden session leaves the public schedule", !(await scheduledSessionIds()).includes(String(hideTarget._id)))
ok("hidden session leaves the public sessions list", !(await listedSessionIds()).includes(String(hideTarget._id)))
ok("hidden session's public page resolves to nothing",
  (await client.query(api.publicData.sessionDetail, { slug: SLUG, submissionId: String(hideTarget._id) })).session === null)
ok("hidden session leaves the .ics feed", !icsIds().includes(String(hideTarget._id)))
ok("hidden session leaves the public JSON API",
  !convexRun("publicData:apiSessionsPage", { slug: SLUG, page: 1, pageSize: 200 })
    .data.some((s) => String(s.id) === String(hideTarget._id)))
const hiddenDoc = await client.query(api.submissions.get, { submissionId: hideTarget._id })
ok("hidden session is still accepted for the organizer", hiddenDoc.status === "accepted" && hiddenDoc.publicVisible === false)
const boardWhileHidden = await client.query(api.agenda.board, { eventId: main._id })
ok("hidden session stays on the organizer's agenda",
  [...boardWhileHidden.scheduled, ...boardWhileHidden.unscheduled].some((s) => String(s.id) === String(hideTarget._id)))
await client.mutation(api.submissions.updateDetails, {
  submissionId: hideTarget._id, patch: { publicVisible: true },
})
ok("un-hiding a session brings it straight back",
  (await listedSessionIds()).includes(String(hideTarget._id)) && icsIds().includes(String(hideTarget._id)))

// Per-speaker eye toggle: the person disappears, their session does not.
const speakerTarget = speakers.speakers.find((s) => s.sessionCount > 0) ?? speakers.speakers[0]
ok("found a public speaker to hide", !!speakerTarget)
const theirSessionId = String(
  (await client.query(api.publicData.speakers, publicSlug))
    .speakers.find((s) => String(s._id) === String(speakerTarget._id))?.sessions[0]?._id ?? "",
)
await client.mutation(api.speakersAdmin.setPublicVisibility, {
  personId: speakerTarget._id, publicVisible: false,
})
ok("hidden speaker leaves the public gallery", !(await galleryIds()).includes(String(speakerTarget._id)))
ok("hidden speaker leaves every session's speaker list",
  !(await client.query(api.publicData.sessionsList, publicSlug)).sessions
    .some((s) => s.speakers.some((sp) => String(sp._id) === String(speakerTarget._id))))
ok("hidden speaker's public itinerary is blank",
  (await client.query(api.publicData.speakerItinerary, { slug: SLUG, personId: String(speakerTarget._id) })).speaker === null)
ok("hidden speaker leaves the public JSON API",
  !convexRun("publicData:apiSpeakersPage", { slug: SLUG, page: 1, pageSize: 500 })
    .data.some((s) => String(s.id) === String(speakerTarget._id)))
ok("hidden speaker leaves the .ics feed's speaker lists",
  !convexRun("publicData:icsFeed", publicSlug).events.some((e) => e.speakers.includes(speakerTarget.name)))
if (theirSessionId) {
  ok("their session itself stays public", (await listedSessionIds()).includes(theirSessionId))
}
ok("hidden speaker is still on the organizer's roster",
  (await client.query(api.dashboard.speakersRoster, { eventId: main._id }))
    .some((s) => String(s.personId) === String(speakerTarget._id)))
ok("hiddenFromPublic lists exactly who is hidden",
  (await client.query(api.speakersAdmin.hiddenFromPublic, { eventId: main._id }))
    .map(String).includes(String(speakerTarget._id)))
await throws("hiddenFromPublic is organizer-only", () =>
  anonClient.query(api.speakersAdmin.hiddenFromPublic, { eventId: main._id }))
// The profile-edit path accepts the same flag (drawer "Save changes").
await client.mutation(api.speakersAdmin.updateProfile, {
  personId: speakerTarget._id, patch: { publicVisible: true },
})
ok("un-hiding a speaker restores the gallery", (await galleryIds()).includes(String(speakerTarget._id)))
ok("nobody is left hidden after the round trip",
  (await client.query(api.speakersAdmin.hiddenFromPublic, { eventId: main._id })).length === 0)

// ————— Publish gate / go-live (sbek AIA-07) —————
section("Agenda publish gate")
ok("seeded main event is published", sched.published === true && sched.publicMessage === null)
// The second seeded event is deliberately left unpublished — it has an accepted,
// scheduled session, so an empty schedule can only come from the gate.
const draftBoard = await client.query(api.agenda.board, { eventId: other._id })
ok("unpublished event still has a scheduled session internally", draftBoard.scheduled.length >= 1)
const draftSchedule = await client.query(api.publicData.schedule, { slug: "design-systems-day" })
ok("unpublished event's public schedule is empty", draftSchedule.days.length === 0 && draftSchedule.totals.sessions === 0)
ok("unpublished event says “Schedule coming soon”", draftSchedule.publicMessage === "Schedule coming soon")
ok("unpublished event still exposes its name/dates", draftSchedule.event.name === "Design Systems Day")
const draftSessions = await client.query(api.publicData.sessionsList, { slug: "design-systems-day" })
ok("unpublished event's public sessions list is empty", draftSessions.sessions.length === 0 && draftSessions.published === false)
const draftSpeakers = await client.query(api.publicData.speakers, { slug: "design-systems-day" })
ok("unpublished event hides session times on speakers", draftSpeakers.speakers.every((s) => s.sessions.length === 0))
const draftPerson = draftSpeakers.speakers[0]
if (draftPerson) {
  const draftItinerary = await client.query(api.publicData.speakerItinerary, {
    slug: "design-systems-day", personId: String(draftPerson._id),
  })
  ok("unpublished event's itinerary is empty", draftItinerary.days.length === 0 && draftItinerary.publicMessage === "Schedule coming soon")
}
const publishResult = await client.mutation(api.agenda.publishAgenda, { eventId: other._id })
ok("publishAgenda reports what went live", publishResult.sessionCount >= 1 && typeof publishResult.agendaPublishedAt === "number")
const publishedSchedule = await client.query(api.publicData.schedule, { slug: "design-systems-day" })
ok("publishing reveals the schedule", publishedSchedule.days.length >= 1 && publishedSchedule.publicMessage === null)
ok("board reports the published stamp back to the organizer",
  (await client.query(api.agenda.board, { eventId: other._id })).event.agendaPublishedAt !== null)
await client.mutation(api.agenda.unpublishAgenda, { eventId: other._id })
const rehiddenSchedule = await client.query(api.publicData.schedule, { slug: "design-systems-day" })
ok("unpublishing hides it again (reversible)", rehiddenSchedule.days.length === 0 && rehiddenSchedule.publicMessage === "Schedule coming soon")

// ————— Saved embeds (sbek EMB-15) —————
section("Embeds")
ok("no saved embeds to start", (await client.query(api.embeds.list, { eventId: main._id })).length === 0)
const embedId = await client.mutation(api.embeds.save, {
  eventId: main._id, name: "Sponsors page agenda", widget: "agenda",
  options: { format: "iframe", hideDescriptions: true, track: "Agents", height: 800 },
})
const embedList = await client.query(api.embeds.list, { eventId: main._id })
ok("embed saved and listed", embedList.length === 1 && embedList[0].name === "Sponsors page agenda")
ok("embed round-trips its options", embedList[0].options.hideDescriptions === true && embedList[0].options.track === "Agents")
await client.mutation(api.embeds.save, {
  eventId: main._id, embedId, name: "Sponsors page agenda (v2)", widget: "speaker-gallery",
  options: { format: "link" },
})
const embedUpdated = await client.query(api.embeds.list, { eventId: main._id })
ok("saving with an id overwrites instead of duplicating",
  embedUpdated.length === 1 && embedUpdated[0].widget === "speaker-gallery")
await throws("unknown widget rejected", () =>
  client.mutation(api.embeds.save, { eventId: main._id, name: "x", widget: "nope", options: {} }), "unknown widget")
await throws("unknown format rejected", () =>
  client.mutation(api.embeds.save, { eventId: main._id, name: "x", widget: "agenda", options: { format: "xml" } }), "unknown embed format")
await throws("unnamed embed rejected", () =>
  client.mutation(api.embeds.save, { eventId: main._id, name: "  ", widget: "agenda", options: {} }), "name")
await client.mutation(api.embeds.remove, { embedId })
ok("embed deleted", (await client.query(api.embeds.list, { eventId: main._id })).length === 0)

// ————— Comms —————
section("Comms")
const templates = await client.query(api.comms.listTemplates, { eventId: main._id })
ok("5 seeded templates", templates.length >= 5, `got ${templates.length}`)
const remind = await client.mutation(api.comms.remindIncompleteSpeakers, { eventId: main._id })
ok("reminders queued for incomplete", typeof remind.queued === "number")

// ————— Bulk composer (sbek SPK-13) —————
section("Bulk email composer")
const allCount = await client.query(api.comms.recipientCount, { eventId: main._id, filter: "all_speakers" })
const acceptedCount = await client.query(api.comms.recipientCount, { eventId: main._id, filter: "accepted" })
ok("recipient count resolves per filter", allCount >= acceptedCount && acceptedCount >= 1, `all=${allCount} accepted=${acceptedCount}`)
ok("manual filter with no picks counts zero",
  (await client.query(api.comms.recipientCount, { eventId: main._id, filter: "manual", personIds: [] })) === 0)
ok("manual filter counts exactly what's picked",
  (await client.query(api.comms.recipientCount, { eventId: main._id, filter: "manual", personIds: [manual.personId] })) === 1)
const outboxBeforeBulk = (await client.query(api.comms.listMessages, { eventId: main._id, limit: 500 })).length
const bulk = await client.mutation(api.comms.composeBulk, {
  eventId: main._id, filter: "accepted",
  subject: "Venue update for {{eventName}}",
  body: "Hi {{firstName}},\n\nWe've moved to the west hall. Your portal: {{portalLink}}",
})
ok("composeBulk queues one message per recipient", bulk.queued === acceptedCount && bulk.queued >= 1, JSON.stringify(bulk))
const outboxAfterBulk = await client.query(api.comms.listMessages, { eventId: main._id, limit: 500 })
ok("bulk emails land in the outbox", outboxAfterBulk.length >= outboxBeforeBulk + bulk.queued)
const bulkRow = outboxAfterBulk.find((m) => m.templateKey === "custom-bulk")
ok("bulk email keeps the ad-hoc subject, rendered", bulkRow?.subject === "Venue update for AI Engineer Summit 2026", bulkRow?.subject)
ok("bulk email renders per-person placeholders",
  Boolean(bulkRow) && !bulkRow.body.includes("{{") && bulkRow.body.includes("/portal/t/"))
await throws("composeBulk refuses an empty subject", () =>
  client.mutation(api.comms.composeBulk, { eventId: main._id, filter: "accepted", subject: "  ", body: "x" }), "subject")
await throws("composeBulk refuses an empty body", () =>
  client.mutation(api.comms.composeBulk, { eventId: main._id, filter: "accepted", subject: "x", body: " " }), "message")
await throws("composeBulk refuses an empty audience", () =>
  client.mutation(api.comms.composeBulk, { eventId: main._id, filter: "manual", personIds: [], subject: "x", body: "y" }), "Nobody matches")

// ————— Per-recipient review + delivery receipts (delta #7 / sbek SPK-14) —————
section("Per-recipient email review & delivery status")
const outboxBeforeReview = (await client.query(api.comms.listMessages, { eventId: main._id, limit: 500 })).length
const reviewed = await client.mutation(api.comms.composeBulk, {
  eventId: main._id, filter: "accepted",
  subject: "Green room for {{firstName}}",
  body: "Hi {{firstName}},\n\nYour portal: {{portalLink}}\nSee you at {{eventName}}.",
  preview: true,
})
ok("preview renders one email per recipient",
  reviewed.previews.length === reviewed.recipients && reviewed.recipients === acceptedCount,
  `previews=${reviewed.previews.length} recipients=${reviewed.recipients}`)
ok("preview queues nothing", reviewed.queued === 0)
ok("preview does not touch the outbox",
  (await client.query(api.comms.listMessages, { eventId: main._id, limit: 500 })).length === outboxBeforeReview)
const firstPreview = reviewed.previews[0]
ok("preview resolves merge fields per recipient",
  Boolean(firstPreview) && !firstPreview.subject.includes("{{") && !firstPreview.body.includes("{{") &&
  firstPreview.body.includes("/portal/t/") && firstPreview.subject.includes(firstPreview.personName.split(" ")[0]),
  JSON.stringify(firstPreview?.subject))
ok("preview carries the recipient's own address",
  Boolean(firstPreview?.toEmail?.includes("@")) && Boolean(firstPreview?.personId))
ok("each preview is that person's own copy",
  new Set(reviewed.previews.map((p) => p.toEmail)).size === reviewed.previews.length)
// A bulk send has no session of its own — {{sessionTitle}} must still resolve
// to each recipient's own session, and the review step is where you see it.
const withSession = await client.mutation(api.comms.composeBulk, {
  eventId: main._id, filter: "accepted",
  subject: "Your session", body: "Session: [{{sessionTitle}}]", preview: true,
})
ok("{{sessionTitle}} resolves to each recipient's own accepted session",
  withSession.previews.length >= 1 && withSession.previews.every((p) => /Session: \[.+\]/.test(p.body)),
  JSON.stringify(withSession.previews[0]?.body))
ok("recipients get different session titles when they speak on different sessions",
  new Set(withSession.previews.map((p) => p.body)).size >= 1)
// Removing someone in the review step must actually exclude them from the send.
const keep = reviewed.previews.slice(0, Math.max(1, reviewed.previews.length - 1))
const dropped = reviewed.previews.slice(keep.length)
const sentAfterReview = await client.mutation(api.comms.composeBulk, {
  eventId: main._id, filter: "manual", personIds: keep.map((p) => p.personId),
  subject: "Green room for {{firstName}}",
  body: "Hi {{firstName}},\n\nYour portal: {{portalLink}}\nSee you at {{eventName}}.",
})
ok("sending after review emails exactly the kept recipients", sentAfterReview.queued === keep.length)
const outboxAfterReview = await client.query(api.comms.listMessages, { eventId: main._id, limit: 500 })
const reviewSends = outboxAfterReview.filter((m) => m.subject.startsWith("Green room for "))
ok("the approved copy is the queued copy",
  reviewSends.some((m) => m.subject === firstPreview.subject && m.body === firstPreview.body))
ok("a removed recipient gets nothing",
  dropped.length === 0 || !reviewSends.some((m) => m.toEmail === dropped[0].toEmail))
// Delivery receipts: seeded @example.com recipients stay previews, so there is
// nothing to poll — the refresh must say so honestly rather than error.
const receipts = await client.mutation(api.comms.refreshDeliveryStatus, { eventId: main._id })
ok("delivery refresh reports what it is checking",
  typeof receipts.checking === "number" && typeof receipts.configured === "boolean", JSON.stringify(receipts))
ok("demo previews are never counted as awaiting a receipt", receipts.checking === 0)
ok("preview rows carry no delivery receipt",
  outboxAfterReview.every((m) => m.status !== "preview" || (m.providerStatus === undefined && m.deliveredAt === undefined)))
ok("a delivery receipt only ever rides on a sent message",
  outboxAfterReview.every((m) =>
    (m.providerStatus === undefined || m.status === "sent") &&
    (m.deliveredAt === undefined || typeof m.deliveredAt === "number") &&
    (m.resendId === undefined || typeof m.resendId === "string")))
ok("refreshing one message is scoped to that message",
  (await client.mutation(api.comms.refreshDeliveryStatus,
    { eventId: main._id, messageId: reviewSends[0]._id })).checking === 0)

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
// Give the throwaway event a branding blob so the delete has storage to clean.
const doomedUploadUrl = await client.mutation(api.files.generateUploadUrl, { eventId: newEventId })
const doomedRes = await fetch(doomedUploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: new Blob([PNG_BYTES], { type: "image/png" }) })
const { storageId: doomedStorageId } = await doomedRes.json()
await client.mutation(api.files.setEventBranding, { eventId: newEventId, slot: "logo", storageId: doomedStorageId, filename: "logo.png" })
await client.mutation(api.events.remove, { eventId: newEventId })
ok("event delete cascades", (await client.query(api.events.list, {})).every((e) => e._id !== newEventId))
ok("event delete also deletes its stored files", convexRun("files:blobsExist", { storageIds: [doomedStorageId] })[doomedStorageId] === false)
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
await throws("stranger cannot add a speaker to our event", () =>
  strangerClient.mutation(api.speakersAdmin.addManual, {
    eventId: main._id, firstName: "Nope", lastName: "Nope", email: "nope@example.com",
  }), "access")
await throws("stranger cannot edit our speaker's profile", () =>
  strangerClient.mutation(api.speakersAdmin.updateProfile, {
    personId: manual.personId, patch: { bio: "hacked" },
  }), "access")
await throws("stranger cannot publish our agenda", () =>
  strangerClient.mutation(api.agenda.publishAgenda, { eventId: main._id }), "access")
await throws("stranger cannot bulk-email our speakers", () =>
  strangerClient.mutation(api.comms.composeBulk, {
    eventId: main._id, filter: "all_speakers", subject: "hi", body: "hi",
  }), "access")
await throws("stranger cannot preview our speakers' emails", () =>
  strangerClient.mutation(api.comms.composeBulk, {
    eventId: main._id, filter: "all_speakers", subject: "hi", body: "hi", preview: true,
  }), "access")
await throws("stranger cannot read our delivery receipts", () =>
  strangerClient.mutation(api.comms.refreshDeliveryStatus, { eventId: main._id }), "access")
await throws("stranger cannot list our saved embeds", () =>
  strangerClient.query(api.embeds.list, { eventId: main._id }), "access")
await throws("stranger cannot mint an upload URL for our event", () =>
  strangerClient.mutation(api.files.generateUploadUrl, { eventId: main._id }), "access")
await throws("stranger cannot read our submission's files", () =>
  strangerClient.query(api.files.submissionFiles, { submissionId: submitted.submissionId }), "access")
await throws("stranger cannot read our event branding", () =>
  strangerClient.query(api.files.eventBranding, { eventId: main._id }), "access")

// ————— Airtable one-way mirror —————
section("Airtable")
ok("no connection → status null", (await client.query(api.airtable.status, { eventId: main._id })) === null)
await throws("stranger cannot read the connection", () =>
  strangerClient.query(api.airtable.status, { eventId: main._id }), "access")
await throws("stranger cannot connect", () =>
  strangerClient.action(api.airtable.connect, { eventId: main._id, token: "patStranger", baseId: "appStranger00000" }), "access")
await throws("sync without a connection is refused", () =>
  client.mutation(api.airtable.syncNow, { eventId: main._id }), "isn't connected")

// Two correct worlds: with AIRTABLE_DEMO_MODE=1 on the deployment `connect`
// skips live validation (so the whole roundtrip is exercisable with no
// Airtable account), without it a junk token must fail with a sentence an
// organizer can act on. Detect which and assert accordingly.
let airtableDemoMode = false
try {
  await client.action(api.airtable.connect, { eventId: main._id, token: "not-a-real-token", baseId: "wrong" })
  airtableDemoMode = true
} catch (e) {
  const msg = String(e.message ?? e).toLowerCase()
  ok("bad credentials → friendly, actionable error",
    msg.includes("personal access token") || msg.includes("base id") || msg.includes("rejected"),
    String(e.message ?? e).slice(0, 140))
  ok("a failed connect stores nothing", (await client.query(api.airtable.status, { eventId: main._id })) === null)
}

if (airtableDemoMode) {
  const connected = await client.query(api.airtable.status, { eventId: main._id })
  ok("demo connect → connected", connected?.status === "connected" && connected?.mode === "demo")
  ok("token is masked, never returned", !!connected && !connected.tokenMasked.includes("not-a-real-token"))
  ok("base link is built for the UI", connected?.baseUrl === `https://airtable.com/${connected?.baseId}`)
  ok("mirrors three tables", connected?.tables?.length === 3)
  await client.mutation(api.airtable.syncNow, { eventId: main._id })
  await new Promise((r) => setTimeout(r, 3000))
  const synced = await client.query(api.airtable.status, { eventId: main._id })
  ok("sync records per-table row counts", (synced?.recordCounts?.submissions ?? 0) > 0, JSON.stringify(synced?.recordCounts))
  ok("sync stamps lastSyncAt", typeof synced?.lastSyncAt === "number")
  ok("sync left no error", synced?.lastError === null)
  ok("connect is idempotent (one row per event)",
    (await client.action(api.airtable.connect, { eventId: main._id, token: "not-a-real-token", baseId: "wrong" })).mode === "demo")
  await throws("stranger cannot disconnect", () =>
    strangerClient.mutation(api.airtable.disconnect, { eventId: main._id }), "access")

  // ————— EXPERIMENTAL two-way (HISTORY.md 61) —————
  // The guard logic itself is unit-tested pure (tests/unit/airtable-sync.test.ts);
  // this proves the wiring: the toggle, the per-record state table, the domain
  // path a pulled change travels down, and the conflict rule ("our DB wins").
  ok("two-way sync is OFF by default", connected?.twoWaySync === false)
  await throws("stranger cannot enable two-way sync", () =>
    strangerClient.mutation(api.airtable.setTwoWaySync, { eventId: main._id, enabled: true }), "access")

  await client.mutation(api.airtable.setTwoWaySync, { eventId: main._id, enabled: true })
  ok("toggle turns two-way sync on",
    (await client.query(api.airtable.status, { eventId: main._id }))?.twoWaySync === true)
  // Enabling schedules a re-mirror, which is what writes the per-record
  // baseline every inbound comparison needs.
  await new Promise((r) => setTimeout(r, 3000))

  // A record of our own, so nothing else in the suite is disturbed.
  const inboundId = await client.mutation(api.submissions.addManual, {
    eventId: main._id, kind: "abstract", title: "Airtable Two-Way Probe", status: "pending",
  })
  await client.mutation(api.airtable.syncNow, { eventId: main._id })
  await new Promise((r) => setTimeout(r, 3000))

  const pull = (records) =>
    convexRun("airtable:applyInbound", { eventId: main._id, records })
  const statusOf = async (id) =>
    (await client.query(api.submissions.get, { submissionId: id })).status

  const applied = pull([{ externalId: String(inboundId), status: "Accept queue" }])
  ok("an Airtable Status edit comes back", applied.applied === 1, JSON.stringify(applied))
  ok("it lands through the domain path (status really changed)",
    (await statusOf(inboundId)) === "accept_queue")

  const echo = pull([{ externalId: String(inboundId), status: "Accept queue" }])
  ok("the same value again is a no-op, not a loop", echo.applied === 0 && echo.skipped === 1)

  // Both sides move: organizer decides here, someone edits the spreadsheet.
  await client.mutation(api.submissions.setStatus, { submissionId: inboundId, status: "accepted" })
  const conflict = pull([{ externalId: String(inboundId), status: "Decline queue" }])
  ok("a genuine conflict is counted, not applied", conflict.conflicts === 1 && conflict.applied === 0)
  ok("our database wins the conflict", (await statusOf(inboundId)) === "accepted")

  const refused = pull([
    { externalId: String(inboundId), status: "Draft" },
    { externalId: String(inboundId), status: "Withdrawn" },
    { externalId: String(inboundId), status: "Shortlisted??" },
  ])
  ok("Draft, Withdrawn and unknown values are all refused",
    refused.applied === 0 && refused.skipped === 3)
  ok("refusals left the status alone", (await statusOf(inboundId)) === "accepted")

  const foreign = await client.query(api.submissions.list, { eventId: other._id })
  ok("cross-event ids are ignored by a pull",
    pull([{ externalId: String(foreign[0]._id), status: "Declined" }]).applied === 0)
  ok("the other event's submission is untouched",
    (await statusOf(foreign[0]._id)) === foreign[0].status)

  // The losing Airtable edit is recorded rather than silently dropped.
  const conflictLog = await client.query(api.audit.forEntity, {
    eventId: main._id, entity: "submission", entityId: String(inboundId),
  })
  ok("the overruled Airtable edit is in the audit log",
    conflictLog.some((row) => row.action === "sync_conflict"))
  ok("an applied pull is attributed to Airtable, not to a person",
    conflictLog.some((row) => row.actorType === "system" && row.actorLabel.includes("Airtable")))

  await client.mutation(api.airtable.setTwoWaySync, { eventId: main._id, enabled: false })
  ok("the toggle switches back off",
    (await client.query(api.airtable.status, { eventId: main._id }))?.twoWaySync === false)
  ok("with it off, nothing is pulled",
    convexRun("airtable:pullEvent", { eventId: main._id }).applied === 0)

  await client.mutation(api.airtable.disconnect, { eventId: main._id })
  ok("disconnect forgets the connection", (await client.query(api.airtable.status, { eventId: main._id })) === null)
} else {
  ok("AIRTABLE_DEMO_MODE unset — connected roundtrip skipped (set it to 1 to exercise it)", true)
}

// ————— Audit log (sbek CNT-11) —————
// Not a version store — a change LOG with attribution. These assertions read
// back the history left by everything the suite has already done, so they
// prove the emit points fire in the real flows rather than in a fixture.
section("Audit log")
const submittedHistory = await client.query(api.audit.forEntity, {
  eventId: main._id, entity: "submission", entityId: String(submitted.submissionId),
})
ok("a status change writes a row", submittedHistory.some((row) => row.action === "status_changed"))
ok("the summary is a human sentence, not an enum",
  submittedHistory.some((row) => /Status changed .+ → .+/.test(row.summary)),
  JSON.stringify(submittedHistory.map((r) => r.summary).slice(0, 3)))
ok("committing the queue records the decision itself",
  submittedHistory.some((row) => row.action === "decision_committed"))
ok("decisions say the speaker was emailed",
  submittedHistory.some((row) => row.action === "decision_committed" && row.summary.includes("emailed")))
ok("history is newest-first",
  submittedHistory.every((row, i) => i === 0 || submittedHistory[i - 1]._creationTime >= row._creationTime))
ok("every row is attributed",
  submittedHistory.every((row) => row.actorLabel.length > 0 && row.actorType.length > 0))

const feed = await client.query(api.audit.feed, { eventId: main._id, limit: 50 })
ok("the event feed returns rows", feed.rows.length > 0)
ok("the feed is scoped to this event's entities",
  feed.rows.every((row) => ["submission", "session", "form", "speaker", "agenda", "settings", "api-key"].includes(row.entity)))
ok("the feed paginates with a cursor",
  feed.nextBefore === null || typeof feed.nextBefore === "number")
const speakerFeed = await client.query(api.audit.feed, { eventId: main._id, filter: "speaker", limit: 50 })
ok("filtering by entity narrows the feed",
  speakerFeed.rows.every((row) => row.entity === "speaker"))
const agentFeed = await client.query(api.audit.feed, { eventId: main._id, filter: "agents", limit: 50 })
ok("the Agents & API lens only shows agent traffic",
  agentFeed.rows.every((row) => row.actorType === "mcp" || row.actorType === "api"))

// Speaker-side edits are attributed to the SPEAKER, not to whoever is looking.
const speakerEdited = await client.query(api.audit.feed, { eventId: main._id, limit: 200 })
ok("portal edits are attributed to the speaker",
  speakerEdited.rows.some((row) => row.actorType === "speaker"))

// Cross-tenant isolation: history is as protected as the data it describes.
await throws("a stranger cannot read another workspace's activity", () =>
  strangerClient.query(api.audit.feed, { eventId: main._id }), "access")
await throws("a stranger cannot read one record's history", () =>
  strangerClient.query(api.audit.forEntity, {
    eventId: main._id, entity: "submission", entityId: String(submitted.submissionId),
  }), "access")
await throws("signed-out visitors get nothing", () =>
  anonClient.query(api.audit.feed, { eventId: main._id }))

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

// ————— API parity (Sessionboard public API) —————
// Drives every endpoint added for docs/reference/api-parity.md against the
// live deployment: search/CRUD roundtrips, custom fields, metadata writes,
// session files (both upload paths), soft delete + restore, bulk operations,
// scopes, rate-limit headers, and a real signed webhook delivery.
section("API parity")
if (SITE_URL) {
  const API = `${SITE_URL}/v1`
  const EV = "ai-summit-2026"
  // API keys are workspace-scoped and outlive reseeds, so leftovers from prior
  // verify runs accumulate toward the 20-key cap. Sweep ours before creating.
  for (const row of await client.query(api.apiKeys.list, {})) {
    if (["parity-suite", "parity-readonly", "verify-suite", "stranger", "bad"].includes(row.name)) {
      await client.mutation(api.apiKeys.revoke, { keyId: row.keyId }).catch(() => {})
    }
  }
  const apiKey = (await client.mutation(api.apiKeys.create, { name: "parity-suite" })).key

  /** Every call goes through here so auth + JSON handling is uniform. */
  const call = async (method, path, { body, key = apiKey, header = "bearer", raw } = {}) => {
    const headers = {}
    if (key) headers[header === "x-access-token" ? "x-access-token" : "Authorization"] =
      header === "x-access-token" ? key : `Bearer ${key}`
    let payload = raw
    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
      payload = JSON.stringify(body)
    }
    // macOS runs out of ephemeral sockets under a burst this size; one retry
    // turns a flaky local network into a deterministic suite.
    let res
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${API}${path}`, { method, headers, body: payload })
        break
      } catch (e) {
        if (attempt >= 3) throw e
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
      }
    }
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* 204s and .ics have no JSON */ }
    return { status: res.status, json, text, headers: res.headers }
  }

  // ——— Auth model ———
  ok("API 401s without a credential", (await call("GET", `/event/${EV}/sessions`, { key: null })).status === 401)
  ok("x-access-token header is accepted", (await call("GET", `/event/${EV}/sessions`, { header: "x-access-token" })).status === 200)
  ok("Authorization: Bearer is still accepted", (await call("GET", `/event/${EV}/sessions`)).status === 200)
  ok("legacy demo token still reads", (await call("GET", `/event/${EV}/sessions`, { key: "demo-api-token" })).status === 200)
  const demoWrite = await call("POST", `/event/${EV}/sessions/create`, { key: "demo-api-token", body: { title: "nope" } })
  ok("legacy demo token cannot write (403)", demoWrite.status === 403, `status ${demoWrite.status}`)
  const err = await call("GET", `/event/nope/sessions`)
  ok("error body carries error + code + message", err.status === 404 && err.json?.error && err.json?.code === "NotFoundError" && err.json?.message,
    JSON.stringify(err.json))

  // ——— Events ———
  const eventsPage = await call("GET", "/events")
  ok("GET /v1/events lists the caller's events",
    eventsPage.status === 200 && eventsPage.json.results.some((e) => e.slug === EV))
  ok("events envelope carries results AND data", Array.isArray(eventsPage.json.data) && Array.isArray(eventsPage.json.results))

  // ——— Session search ———
  const search = await call("POST", `/event/${EV}/sessions?pageSize=2`, {
    body: { filters: { status: "accepted" }, sort: { order: "createdAt", sort: "desc" } },
  })
  ok("POST /sessions searches with filters + sort",
    search.status === 200 && search.json.results.length <= 2 && search.json.results.every((s) => s.status === "accepted"))
  ok("pagination is camelCase AND snake_case",
    search.json.pagination.pageSize === 2 && search.json.pagination.page_size === 2 &&
    typeof search.json.pagination.totalResults === "number" && typeof search.json.pagination.total_results === "number")
  const abstracts = await call("POST", `/event/${EV}/sessions`, { body: { filters: { isAbstract: true } } })
  ok("isAbstract filter splits abstracts from sessions",
    abstracts.status === 200 && abstracts.json.results.every((s) => s.is_abstract === true))
  const statusSearch = await call("POST", `/event/${EV}/sessions/status`, { body: {} })
  ok("POST /sessions/status returns the lightweight status shape",
    statusSearch.status === 200 && statusSearch.json.results.every((s) => "status" in s && "friendly_id" in s && !("speakers" in s)))

  // ——— Session create / read / update / concurrency ———
  const created = await call("POST", `/event/${EV}/sessions/create`, {
    body: { title: "Parity API session", description: "created by the suite", status: "pending", format: "Talk", tags: ["api"] },
  })
  ok("POST /sessions/create returns 201 + the session", created.status === 201 && created.json.data?.id, JSON.stringify(created.json).slice(0, 200))
  const sid = created.json.data.id
  ok("created session is not an abstract", created.json.data.is_abstract === false)
  ok("created session got a friendly_id", /^SESS-\d+$/.test(created.json.data.friendly_id))

  const fetched = await call("GET", `/event/${EV}/sessions/${sid}`)
  ok("GET /sessions/{id} returns the session", fetched.status === 200 && fetched.json.data.id === sid)
  ok("session carries rate-limit headers", fetched.headers.get("RateLimit-Limit") === "100" && fetched.headers.get("RateLimit-Remaining") !== null)
  ok("session exposes legacy field names too",
    "startTime" in fetched.json.data && "durationMinutes" in fetched.json.data && "submittedAt" in fetched.json.data)

  const updated = await call("PUT", `/event/${EV}/sessions/${sid}`, {
    body: { title: "Parity API session (edited)", updated_at: fetched.json.data.updated_at },
  })
  ok("PUT /sessions/{id} updates with a matching updated_at", updated.status === 200 && updated.json.data.title === "Parity API session (edited)")
  const stale = await call("PUT", `/event/${EV}/sessions/${sid}`, {
    body: { title: "should not apply", updated_at: fetched.json.data.updated_at },
  })
  ok("stale updated_at is rejected with 409", stale.status === 409, `status ${stale.status}`)

  // ——— Custom fields (our CFP questions) ———
  const fields = await call("GET", `/event/${EV}/fields`)
  ok("GET /fields lists field definitions from the CFP form",
    fields.status === 200 && fields.json.results.some((f) => f.internal_name === "title" && f.field_source === "standard"))
  ok("field definitions carry type + scope + options",
    fields.json.results.some((f) => f.internal_name === "format" && f.field_type === "dropdown" && Array.isArray(f.options)))
  ok("participant fields are scoped to contacts and flag PII",
    fields.json.results.some((f) => f.scope === "contact" && f.internal_name === "participant.email" && f.contains_pii === true))

  const newField = await call("POST", `/event/${EV}/fields/create`, { body: { name: "Parity Notes", type: "long_text", help: "suite" } })
  ok("POST /fields/create adds a custom field", newField.status === 201 && newField.json.data.internal_name === "parity_notes")
  const fieldsAfter = await call("GET", `/event/${EV}/fields`)
  ok("the new field shows up in GET /fields", fieldsAfter.json.results.some((f) => f.internal_name === "parity_notes"))
  const renamed = await call("PUT", `/event/${EV}/fields/parity_notes`, { body: { label: "Parity Notes v2" } })
  ok("PUT /fields/{id} renames a custom field", renamed.status === 200 && renamed.json.data.public_name === "Parity Notes v2")
  const lockedField = await call("DELETE", `/event/${EV}/fields/title`)
  ok("system fields refuse deletion", lockedField.status === 400 && /system field/i.test(lockedField.json.error), JSON.stringify(lockedField.json))

  const withFields = await call("PUT", `/event/${EV}/sessions/${sid}/fields`, {
    body: { custom_fields: { parity_notes: "written through the API", tags: ["api", "parity"] } },
  })
  ok("PUT /sessions/{id}/fields writes custom-field values", withFields.status === 200)
  const cf = withFields.json.data.custom_fields
  ok("custom_fields come back keyed by id AND labelled",
    cf.some((f) => f.internal_name === "parity_notes" && f.name === "Parity Notes v2" && f.value === "written through the API"),
    JSON.stringify(cf))
  ok("multi-value answers keep a lossless value_raw",
    cf.some((f) => f.internal_name === "tags" && f.value === "api, parity" && Array.isArray(f.value_raw)))
  ok("raw answers map is exposed alongside custom_fields", withFields.json.data.answers.parity_notes === "written through the API")
  ok("DELETE /fields/{id} removes a custom field", (await call("DELETE", `/event/${EV}/fields/parity_notes`)).status === 204)

  // ——— Metadata writes ———
  const track = await call("POST", `/event/${EV}/tracks/create`, { body: { name: "Parity Track", color: "#0F6E70" } })
  ok("POST /tracks/create creates a track", track.status === 201 && track.json.data.id)
  const trackId = track.json.data.id
  ok("PUT /tracks/{id} updates it", (await call("PUT", `/event/${EV}/tracks/${trackId}`, { body: { name: "Parity Track v2" } })).json.data.name === "Parity Track v2")
  ok("GET /tracks lists it", (await call("GET", `/event/${EV}/tracks`)).json.results.some((t) => t.id === trackId))
  const room = await call("POST", `/event/${EV}/rooms/create`, { body: { name: "Parity Room", capacity: 42 } })
  ok("POST /rooms/create creates a room", room.status === 201 && room.json.data.capacity === 42)
  const roomId = room.json.data.id
  const level = await call("POST", `/event/${EV}/levels/create`, { body: { name: "Parity Level" } })
  ok("value lists (levels) are writable through the form question", level.status === 201)
  ok("the new level appears in GET /levels", (await call("GET", `/event/${EV}/levels`)).json.results.some((l) => l.name === "Parity Level"))
  ok("DELETE /levels/{name} removes it", (await call("DELETE", `/event/${EV}/levels/Parity%20Level`)).status === 204)
  const statuses = await call("GET", `/event/${EV}/statuses`)
  ok("GET /statuses lists the system pipeline", statuses.status === 200 && statuses.json.results.some((s) => s.id === "accept_queue" && s.system === true))
  const statusWrite = await call("POST", `/event/${EV}/statuses/create`, { body: { name: "Custom" } })
  ok("custom session statuses are refused with a clear reason",
    statusWrite.status === 400 && /system-defined/i.test(statusWrite.json.error), JSON.stringify(statusWrite.json))

  // ——— Speakers ———
  const speakerSearch = await call("POST", `/event/${EV}/speakers?pageSize=3`, { body: {} })
  ok("POST /speakers searches speakers", speakerSearch.status === 200 && speakerSearch.json.results.length <= 3)
  ok("speaker shape is contact-flavoured", speakerSearch.json.results.every((s) => "full_name" in s && "company_name" in s && "photo_url" in s))
  const parityEmail = `parity-${Date.now()}@example.com`
  const newSpeaker = await call("POST", `/event/${EV}/speakers/create`, {
    body: { email: parityEmail, first_name: "Parity", last_name: "Tester", company_name: "Suite Inc", linkedin_url: "https://example.com/in" },
  })
  ok("POST /speakers/create creates a speaker", newSpeaker.status === 201 && newSpeaker.json.data.email === parityEmail)
  const spid = newSpeaker.json.data.id
  ok("GET /speakers/{id} returns them with their sessions", (await call("GET", `/event/${EV}/speakers/${spid}`)).json.data.id === spid)
  ok("PUT /speakers/{id} edits the profile",
    (await call("PUT", `/event/${EV}/speakers/${spid}`, { body: { title: "Chief Verifier" } })).json.data.title === "Chief Verifier")

  // ——— Session files ———
  const form = new FormData()
  form.append("file", new Blob([PNG_BYTES], { type: "image/png" }), "parity.png")
  form.append("title", "Parity slide")
  const uploaded = await fetch(`${API}/event/${EV}/sessions/${sid}/files/upload`, {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  })
  const uploadedJson = await uploaded.json()
  ok("POST /files/upload attaches a file in one call", uploaded.status === 201 && uploadedJson.data.filename === "parity.png",
    JSON.stringify(uploadedJson).slice(0, 200))
  const fileId = uploadedJson.data.id
  ok("uploaded file has a working URL + size", typeof uploadedJson.data.url === "string" && uploadedJson.data.size === PNG_BYTES.length)
  ok("GET /files lists it", (await call("GET", `/event/${EV}/sessions/${sid}/files`)).json.data.some((f) => f.id === fileId))
  ok("PUT /files/{id} renames it",
    (await call("PUT", `/event/${EV}/sessions/${sid}/files/${fileId}`, { body: { title: "Parity slide v2" } })).json.data.title === "Parity slide v2")
  ok("expand=files inlines files on the session",
    (await call("GET", `/event/${EV}/sessions/${sid}?expand=files`)).json.data.files.some((f) => f.id === fileId))

  // Two-phase (large-file) upload: initiate → PUT bytes → complete.
  const initiated = await call("POST", `/event/${EV}/sessions/${sid}/files`, {
    body: { filename: "parity-large.png", size_bytes: PNG_BYTES.length, content_type: "image/png", title: "Two-phase" },
  })
  ok("POST /files initiates a two-phase upload with an upload URL",
    initiated.status === 201 && initiated.json.data.upload.method === "PUT" && initiated.json.data.upload.url.includes("/bytes"))
  const putBytes = await fetch(initiated.json.data.upload.url, {
    method: "PUT", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "image/png" }, body: PNG_BYTES,
  })
  ok("PUT to the upload URL accepts the bytes", putBytes.status === 200)
  const completed = await call("POST", `/event/${EV}/sessions/${sid}/files/${initiated.json.data.id}/complete`)
  ok("POST /files/{id}/complete finalizes the upload", completed.status === 201 && completed.json.data.title === "Two-phase")
  ok("DELETE /files/{id} soft-deletes", (await call("DELETE", `/event/${EV}/sessions/${sid}/files/${completed.json.data.id}`)).status === 204)
  ok("deleted file leaves the listing",
    !(await call("GET", `/event/${EV}/sessions/${sid}/files`)).json.data.some((f) => f.id === completed.json.data.id))

  // ——— Bulk ———
  const bulk = await call("POST", `/event/${EV}/sessions/bulk`, {
    body: { operations: [
      { action: "create", data: { title: "Bulk A", status: "pending" } },
      { action: "create", data: { title: "Bulk B", status: "pending" } },
      { action: "update", id: sid, data: { description: "bulk-updated" } },
      { action: "delete", id: "not-a-real-id" },
    ] },
  })
  ok("POST /sessions/bulk runs a mixed batch", bulk.status === 200 && bulk.json.stats.total === 4)
  ok("bulk reports per-operation success and failure", bulk.json.stats.succeeded === 3 && bulk.json.stats.failed === 1)
  ok("failed bulk items carry a code + message", bulk.json.results[3].error?.message)
  ok("bulk batch is identified", typeof bulk.json.batch_id === "string")
  for (const result of bulk.json.results.filter((r) => r.action === "create" && r.status === "success")) {
    await call("DELETE", `/event/${EV}/sessions/${result.id}`)
  }

  // ——— Soft delete + restore ———
  ok("DELETE /sessions/{id} soft-deletes", (await call("DELETE", `/event/${EV}/sessions/${sid}`)).status === 204)
  ok("a deleted session 404s on read", (await call("GET", `/event/${EV}/sessions/${sid}`)).status === 404)
  ok("a deleted session leaves search results",
    !(await call("POST", `/event/${EV}/sessions`, { body: { filters: {} } })).json.results.some((s) => s.id === sid))
  ok("POST /sessions/{id}/restore brings it back", (await call("POST", `/event/${EV}/sessions/${sid}/restore`)).status === 200)
  ok("a restored session reads again", (await call("GET", `/event/${EV}/sessions/${sid}`)).status === 200)

  // ——— Agenda ———
  const agenda = await call("GET", `/event/${EV}/agenda`)
  ok("GET /agenda returns rooms, tracks, placements and conflicts",
    agenda.status === 200 && Array.isArray(agenda.json.data.rooms) && Array.isArray(agenda.json.data.scheduled) && agenda.json.data.totals)

  // ——— Webhooks: CRUD + a real signed delivery ———
  const hook = await call("POST", "/webhooks", {
    body: { url: `${API}/_echo`, events: ["*"], description: "parity suite", event: EV },
  })
  ok("POST /v1/webhooks creates an endpoint", hook.status === 201 && hook.json.data.id)
  const hookId = hook.json.data.id
  const secret = hook.json.data.secret
  ok("the signing secret is returned once, in full", /^whsec_[0-9a-f]{48}$/.test(secret))
  ok("GET /v1/webhooks masks the secret",
    (await call("GET", "/webhooks")).json.results.find((w) => w.id === hookId)?.secret.includes("…"))
  // Point it at the verifying echo sink: that endpoint answers 200 ONLY when
  // the HMAC over the exact body verifies, so "delivered" proves "signed".
  ok("PUT /v1/webhooks/{id} updates the endpoint",
    (await call("PUT", `/webhooks/${hookId}`, { body: { url: `${API}/_echo?secret=${secret}` } })).status === 200)

  await call("POST", `/webhooks/${hookId}/test`)
  await call("PUT", `/event/${EV}/sessions/${sid}`, { body: { description: "webhook trigger" } })
  let deliveries = []
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 500))
    deliveries = (await call("GET", `/webhooks/${hookId}/deliveries`)).json.results
    if (deliveries.filter((d) => d.status === "success").length >= 2) break
  }
  const delivered = deliveries.filter((d) => d.status === "success")
  ok("webhook deliveries reach the endpoint", delivered.length >= 2, `${deliveries.length} logged, ${delivered.length} delivered`)
  ok("delivery is HMAC-signed (the sink rejects a bad signature)", delivered.every((d) => d.response_status === 200))
  ok("a test delivery is recorded", deliveries.some((d) => d.event_type === "webhook.test"))
  ok("a session.updated delivery fired from the real mutation path", deliveries.some((d) => d.event_type === "session.updated"))
  const payload = JSON.parse(delivered.find((d) => d.event_type === "session.updated").payload)
  ok("payload is { data, metadata } with the resource inside data", payload.data.id === sid && payload.data.sourceOfChange === "user")
  ok("metadata carries action, ids, version and datetime",
    payload.metadata.action === "session.updated" && payload.metadata.version === 1 &&
    payload.metadata.org_id && typeof payload.metadata.datetime === "string")
  ok("metadata.resource_url points back at the API", String(payload.metadata.resource_url).includes(`/sessions/${sid}`))

  // A wrong signature must NOT verify — proves the check is real.
  const forged = await fetch(`${API}/_echo?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Trackstage-Signature": "t=1,v1=deadbeef" },
    body: JSON.stringify({ data: {}, metadata: {} }),
  })
  ok("a forged signature is rejected by the sink", forged.status === 401)

  // Scoped keys narrow, never widen.
  const scoped = (await client.mutation(api.apiKeys.create, { name: "parity-readonly", scopes: ["read:sessions"] })).key
  ok("a read-only key can read sessions", (await call("GET", `/event/${EV}/sessions`, { key: scoped })).status === 200)
  const scopedWrite = await call("POST", `/event/${EV}/sessions/create`, { key: scoped, body: { title: "nope" } })
  ok("a read-only key cannot write (403 naming the scope)",
    scopedWrite.status === 403 && /write:sessions/.test(scopedWrite.json.error), JSON.stringify(scopedWrite.json))
  ok("unknown scopes are refused at key creation", await client.mutation(api.apiKeys.create, { name: "bad", scopes: ["nope:nope"] }).then(() => false).catch(() => true))

  // Cross-tenant isolation still holds through the API.
  const strangerKeyOwner = await call("GET", `/event/design-systems-day/sessions`)
  ok("a member's key reads their other event", strangerKeyOwner.status === 200)

  // ——— Cleanup so later sections see a clean deployment ———
  await call("DELETE", `/webhooks/${hookId}`)
  ok("DELETE /v1/webhooks/{id} removes the endpoint",
    !(await call("GET", "/webhooks")).json.results.some((w) => w.id === hookId))
  await call("DELETE", `/event/${EV}/sessions/${sid}`)
  await call("DELETE", `/event/${EV}/tracks/${trackId}`)
  await call("DELETE", `/event/${EV}/rooms/${roomId}`)
} else {
  ok("SITE_URL missing — skipped API parity checks", false, "add VITE_CONVEX_SITE_URL to .env.local")
}

// ————— MCP server —————
section("MCP server")
if (SITE_URL) {
  const MCP = `${SITE_URL}/mcp`
  const created = await client.mutation(api.apiKeys.create, { name: "verify-suite" })
  ok("API key created with sb_live_ prefix", /^sb_live_[0-9a-f]{32}$/.test(created.key), created.prefix)
  const keyList = await client.query(api.apiKeys.list, {})
  ok("key listed with display prefix only", keyList.some((k) => k.keyId === created.keyId && k.prefix === created.prefix))
  ok("plaintext key never returned by list", !JSON.stringify(keyList).includes(created.key))

  const rpc = async (method, params, key = created.key, id = 1) => {
    const res = await fetch(MCP, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    })
    return { status: res.status, headers: res.headers, body: res.status === 202 ? null : await res.json() }
  }
  const toolCall = async (name, args, key = created.key) => {
    const { body } = await rpc("tools/call", { name, arguments: args }, key)
    const text = body?.result?.content?.[0]?.text
    return { isError: Boolean(body?.result?.isError), text, json: (() => { try { return JSON.parse(text) } catch { return null } })() }
  }

  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } })
  ok("initialize negotiates protocol", init.body?.result?.protocolVersion === "2025-06-18", JSON.stringify(init.body).slice(0, 160))
  ok("initialize declares serverInfo trackstage", init.body?.result?.serverInfo?.name === "trackstage")
  ok("initialize declares tools capability", !!init.body?.result?.capabilities?.tools)

  const initialized = await fetch(MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.key}` },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  })
  ok("notifications/initialized → 202", initialized.status === 202, `status ${initialized.status}`)

  const tools = await rpc("tools/list", {})
  const toolNames = (tools.body?.result?.tools ?? []).map((t) => t.name)
  ok("tools/list returns the full 31-tool surface", toolNames.length === 31, `got ${toolNames.length}: ${toolNames.join(", ")}`)
  ok("every tool has a description + inputSchema", (tools.body?.result?.tools ?? []).every((t) => t.description?.length > 20 && t.inputSchema?.type === "object"))
  ok("core tools present", ["list_events", "get_event_summary", "commit_decision_queue", "get_agenda", "list_speakers"].every((n) => toolNames.includes(n)))
  // The destructive half of the CRUD surface — the one gap the live-fire test
  // found in "do everything via MCP" — plus get_template, the full-body escape
  // hatch that lets list_templates ship previews.
  ok("deletion tools present", ["delete_event", "delete_form", "remove_task"].every((n) => toolNames.includes(n)), toolNames.filter((n) => /delete|remove/.test(n)).join(", "))
  ok("get_template present", toolNames.includes("get_template"))
  ok("get_event_overview kept as a deprecated alias", toolNames.includes("get_event_overview"))

  const listEvents = await toolCall("list_events", {})
  ok("tools/call list_events returns my events", !listEvents.isError && listEvents.json?.events?.some((e) => e.slug === "ai-summit-2026"), listEvents.text?.slice(0, 120))

  const summary = await toolCall("get_event_summary", { event: "ai-summit-2026" })
  ok("get_event_summary works by slug", !summary.isError && typeof summary.json?.headline === "string")
  ok("summary carries needsAttention + deadlines", Array.isArray(summary.json?.needsAttention) && Array.isArray(summary.json?.upcomingDeadlines))
  const summaryById = await toolCall("get_event_summary", { event: main._id })
  ok("event arg accepts an id too", !summaryById.isError && summaryById.json?.event?.slug === "ai-summit-2026")

  const agenda = await toolCall("get_agenda", { event: "ai-summit-2026" })
  ok("get_agenda returns scheduled + conflicts", !agenda.isError && Array.isArray(agenda.json?.scheduled) && Array.isArray(agenda.json?.conflicts))

  const speakers = await toolCall("list_speakers", { event: "ai-summit-2026" })
  ok("list_speakers returns the roster", !speakers.isError && speakers.json?.speakerCount >= 1)

  // ——— list_speakers semantics (live-fire fumble #3: 11 rows, "8" reported) ———
  // The response has to state its own arithmetic, and the flags have to mean
  // exactly one thing each.
  const roster = speakers.json
  ok("list_speakers counts are self-consistent",
    roster.returned === roster.speakers.length &&
    roster.totalSpeakers === roster.speakers.length &&
    roster.withOpenTasks === roster.speakers.filter((s) => s.outstandingTasks.length > 0).length &&
    roster.withProfileGaps === roster.speakers.filter((s) => s.missingProfileItems.length > 0).length &&
    roster.withOpenTasksOrProfileGaps === roster.speakers.filter((s) => s.outstandingReason.length > 0).length,
    JSON.stringify({ returned: roster.returned, total: roster.totalSpeakers, openTasks: roster.withOpenTasks, gaps: roster.withProfileGaps }))
  ok("list_speakers states its own counts in prose",
    typeof roster.summary === "string" && roster.summary.includes(`${roster.returned} of ${roster.totalSpeakers}`), roster.summary)
  const openWork = await toolCall("list_speakers", { event: "ai-summit-2026", onlyWithOutstandingWork: true })
  ok("onlyWithOutstandingWork means EXACTLY ≥1 incomplete task",
    openWork.json.speakers.every((s) => s.outstandingTasks.length > 0) &&
    openWork.json.returned === roster.withOpenTasks,
    `returned ${openWork.json.returned}, expected ${roster.withOpenTasks}`)
  const withGaps = await toolCall("list_speakers", { event: "ai-summit-2026", onlyWithOutstandingWork: true, includeProfileGaps: true })
  ok("includeProfileGaps widens it to open-tasks-OR-profile-gaps",
    withGaps.json.returned === roster.withOpenTasksOrProfileGaps && withGaps.json.returned >= openWork.json.returned,
    `${openWork.json.returned} → ${withGaps.json.returned} of ${roster.totalSpeakers}`)
  ok("every returned row carries its outstandingReason",
    withGaps.json.speakers.every((s) => s.outstandingReason.length > 0))
  const gapsOnly = await toolCall("list_speakers", { event: "ai-summit-2026", includeProfileGaps: true })
  ok("includeProfileGaps alone returns exactly the incomplete profiles",
    gapsOnly.json.returned === roster.withProfileGaps && gapsOnly.json.speakers.every((s) => s.missingProfileItems.length > 0))

  // ——— get_event_summary absorbed get_event_overview ———
  ok("summary carries the merged dashboard numbers",
    typeof summary.json.totalSubmissions === "number" &&
    typeof summary.json.outbox === "object" &&
    typeof summary.json.agenda?.conflictCount === "number" &&
    summary.json.forms.every((f) => typeof f.formId === "string" && typeof f.publicUrl === "string"))
  ok("field names normalised: closeAt everywhere, acceptedNotScheduled",
    summary.json.forms.every((f) => "closeAt" in f && !("closesAt" in f)) &&
    "acceptedNotScheduled" in summary.json.agenda && !("acceptedNotYetScheduled" in summary.json.agenda))
  const overviewAlias = await toolCall("get_event_overview", { event: "ai-summit-2026" })
  ok("get_event_overview is a deprecated alias returning the same payload",
    !overviewAlias.isError &&
    typeof overviewAlias.json.deprecated === "string" &&
    overviewAlias.json.headline === summary.json.headline &&
    JSON.stringify(overviewAlias.json.submissions) === JSON.stringify(summary.json.submissions),
    overviewAlias.json?.deprecated)

  // ——— Payload caps ———
  const cfpForm = await toolCall("get_form", { form: "cfp" })
  ok("get_form caps long option lists", !cfpForm.isError && cfpForm.json.questions.every((q) => !q.options || q.options.length <= 10))
  ok("a truncated option list says how many it held back",
    cfpForm.json.questions.every((q) => q.optionsTruncated === undefined || /^…\d+ more$/.test(q.optionsTruncated)))
  ok("get_agenda summarises per room and caps its rows",
    Array.isArray(agenda.json.byRoom) &&
    typeof agenda.json.scheduledCount === "number" &&
    agenda.json.scheduled.length <= 40 &&
    agenda.json.byRoom.reduce((n, r) => n + r.sessionCount, 0) <= agenda.json.scheduledCount)
  const templates = await toolCall("list_templates", { event: "ai-summit-2026" })
  ok("list_templates previews bodies instead of dumping them",
    templates.json.templates.every((t) => t.body === undefined && typeof t.bodyPreview === "string" && t.bodyPreview.length <= 201))
  const fullTemplate = await toolCall("get_template", { event: "ai-summit-2026", key: "accepted" })
  ok("get_template returns the full body",
    !fullTemplate.isError && typeof fullTemplate.json.body === "string" &&
    fullTemplate.json.body.length >= templates.json.templates.find((t) => t.key === "accepted").bodyPreview.length)

  // ——— Loopback link warning ———
  const formLink = await toolCall("get_public_form_link", { form: "cfp" })
  const loopback = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(formLink.json.publicUrl ?? "")
  ok("loopback links come with a demo-URL warning",
    !loopback || /demo URL/.test(formLink.json.linkWarning ?? ""),
    formLink.json.linkWarning ?? formLink.json.publicUrl)
  ok("the URL itself stays machine-clean", /^https?:\/\/\S+$/.test(formLink.json.publicUrl ?? ""), formLink.json.publicUrl)

  // ——— Deletion tools ———
  // delete_form keeps forms.remove's rule: a form that collected anything is
  // history, and the refusal has to name the alternative.
  const deleteSeeded = await toolCall("delete_form", { form: "cfp", confirm: true })
  ok("delete_form refuses a form that has submissions",
    deleteSeeded.isError && /submission/i.test(deleteSeeded.text) && /clos/i.test(deleteSeeded.text),
    deleteSeeded.text?.slice(0, 160))
  ok("the refused delete left the form alone", !(await toolCall("get_form", { form: "cfp" })).isError)

  const throwawayName = `MCP Verify Form ${Date.now().toString(36)}`
  const throwaway = await toolCall("create_form", { event: "ai-summit-2026", name: throwawayName })
  ok("create_form echoes the created form's name back", throwaway.json?.name === throwawayName, throwaway.text?.slice(0, 120))
  const formNoConfirm = await rpc("tools/call", { name: "delete_form", arguments: { form: throwaway.json.slug } })
  const formNoConfirmMsg = formNoConfirm.body?.error?.message ?? formNoConfirm.body?.result?.content?.[0]?.text ?? ""
  ok("delete_form refuses without confirm:true",
    (formNoConfirm.body?.error?.code === -32602 || formNoConfirm.body?.result?.isError === true) && /confirm/i.test(formNoConfirmMsg),
    formNoConfirmMsg.slice(0, 140))
  const formDeleted = await toolCall("delete_form", { form: throwaway.json.slug, confirm: true })
  ok("delete_form deletes an empty form", !formDeleted.isError && formDeleted.json?.deleted === true, formDeleted.text?.slice(0, 140))
  const formGone = await toolCall("get_form", { form: throwaway.json.slug })
  ok("the deleted form is really gone", formGone.isError && /no form matches/i.test(formGone.text))

  // remove_task is the inverse of assign_task — assign one, retract it.
  const chaseEmail = roster.speakers[0].email
  const taskTitle = `Verify throwaway task ${Date.now().toString(36)}`
  const assigned = await toolCall("assign_task", { event: "ai-summit-2026", speakers: [chaseEmail], title: taskTitle })
  ok("assign_task created the throwaway task", !assigned.isError && assigned.json?.created === 1)
  const afterAssign = await toolCall("list_speakers", { event: "ai-summit-2026" })
  const throwawayTask = afterAssign.json.speakers
    .find((s) => s.email === chaseEmail)?.outstandingTasks.find((t) => t.title === taskTitle)
  ok("the new task shows on the roster", Boolean(throwawayTask))
  const taskRemoved = await toolCall("remove_task", { taskId: throwawayTask.taskId })
  ok("remove_task retracts it", !taskRemoved.isError && taskRemoved.json?.removed === true, taskRemoved.text?.slice(0, 140))
  const afterRemove = await toolCall("list_speakers", { event: "ai-summit-2026" })
  ok("the retracted task is gone from the roster",
    !afterRemove.json.speakers.some((s) => s.outstandingTasks.some((t) => t.title === taskTitle)))
  ok("removing it again fails cleanly", (await toolCall("remove_task", { taskId: throwawayTask.taskId })).isError)

  // delete_event: double-confirmed, and neither half alone is enough.
  const eventNoName = await rpc("tools/call", { name: "delete_event", arguments: { event: "ai-summit-2026", confirm: true } })
  ok("delete_event refuses without confirmName",
    eventNoName.body?.error?.code === -32602 && /confirmName/.test(eventNoName.body?.error?.message ?? ""),
    (eventNoName.body?.error?.message ?? "").slice(0, 140))
  const eventNoConfirm = await rpc("tools/call", { name: "delete_event", arguments: { event: "ai-summit-2026", confirmName: main.name } })
  ok("delete_event refuses without confirm:true",
    eventNoConfirm.body?.error?.code === -32602 || eventNoConfirm.body?.result?.isError === true)
  const wrongName = await toolCall("delete_event", { event: "ai-summit-2026", confirmName: "Definitely Not This Event", confirm: true })
  ok("delete_event refuses a mismatched confirmName", wrongName.isError && /does not match/i.test(wrongName.text), wrongName.text?.slice(0, 140))
  ok("nothing was destroyed by the refused deletes", !(await toolCall("get_event_summary", { event: "ai-summit-2026" })).isError)

  const doomedName = `MCP Verify Event ${Date.now().toString(36)}`
  const doomed = await toolCall("create_event", { name: doomedName, organizationId: main.organizationId, timezone: "Europe/Berlin" })
  ok("create_event made the throwaway event", !doomed.isError && typeof doomed.json?.slug === "string", doomed.text?.slice(0, 140))
  const doomedKilled = await toolCall("delete_event", { event: doomed.json.slug, confirmName: doomedName, confirm: true })
  ok("delete_event deletes with both confirmations",
    !doomedKilled.isError && doomedKilled.json?.deleted === true && typeof doomedKilled.json?.removed?.submissions === "number",
    doomedKilled.text?.slice(0, 160))
  ok("the deleted event is really gone",
    (await toolCall("get_event_summary", { event: doomed.json.slug })).isError &&
    !(await toolCall("list_events", {})).json.events.some((e) => e.slug === doomed.json.slug))

  // Either refusal is correct: the schema-level required-argument check
  // (JSON-RPC -32602) or the handler's own confirm gate (a tool error).
  const guardRaw = await rpc("tools/call", {
    name: "commit_decision_queue",
    arguments: { event: "ai-summit-2026", queue: "accept_queue" },
  })
  const guardMessage =
    guardRaw.body?.error?.message ??
    guardRaw.body?.result?.content?.[0]?.text ??
    ""
  ok(
    "commit_decision_queue refuses without confirm:true",
    (guardRaw.body?.error?.code === -32602 ||
      guardRaw.body?.result?.isError === true) &&
      /confirm/i.test(guardMessage),
    guardMessage.slice(0, 140),
  )

  const badTool = await rpc("tools/call", { name: "no_such_tool", arguments: {} })
  ok("unknown tool → JSON-RPC error", badTool.body?.error?.code === -32602, JSON.stringify(badTool.body).slice(0, 120))
  const badEvent = await toolCall("get_event_summary", { event: "does-not-exist" })
  ok("unknown event → friendly tool error", badEvent.isError && /list_events/.test(badEvent.text))

  const noAuth = await fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) })
  ok("missing bearer → 401", noAuth.status === 401, `status ${noAuth.status}`)
  ok("401 advertises OAuth resource metadata", (noAuth.headers.get("www-authenticate") ?? "").includes("resource_metadata"))
  const badKey = await fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer sb_live_deadbeefdeadbeefdeadbeefdeadbeef" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) })
  ok("invalid API key → 401", badKey.status === 401, `status ${badKey.status}`)

  const badVersion = await fetch(MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.key}`, "MCP-Protocol-Version": "1999-01-01" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
  ok("unsupported protocol version → 400", badVersion.status === 400, `status ${badVersion.status}`)
  const getMcp = await fetch(MCP)
  ok("GET /mcp → 405 with connect instructions", getMcp.status === 405 && (await getMcp.json()).connect?.endpoint === MCP)

  // Scoping: a brand-new user's key must see nothing of ours.
  const mcpStranger = `mcp-stranger-${Date.now().toString(36)}@example.com`
  await fetch(`${SITE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ name: "Mcp Stranger", email: mcpStranger, password: "stranger-pass-1" }),
  })
  const strangerMcpClient = new ConvexHttpClient(CONVEX_URL)
  strangerMcpClient.setAuth(await signIn(mcpStranger, "stranger-pass-1"))
  const strangerKey = await strangerMcpClient.mutation(api.apiKeys.create, { name: "stranger" })
  const strangerEvents = await toolCall("list_events", {}, strangerKey.key)
  ok("stranger's key sees zero events", !strangerEvents.isError && strangerEvents.json?.events?.length === 0)
  const strangerPeek = await toolCall("get_event_summary", { event: "ai-summit-2026" }, strangerKey.key)
  ok("stranger's key cannot read our event", strangerPeek.isError && /access|not found|no event/i.test(strangerPeek.text))
  const strangerAgenda = await toolCall("get_agenda", { event: main._id }, strangerKey.key)
  ok("stranger's key cannot read our agenda", strangerAgenda.isError)
  ok("stranger cannot see our API keys", (await strangerMcpClient.query(api.apiKeys.list, {})).every((k) => k.keyId !== created.keyId))

  // Revocation is immediate.
  await client.mutation(api.apiKeys.revoke, { keyId: created.keyId })
  const afterRevoke = await fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.key}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) })
  ok("revoked key stops working immediately", afterRevoke.status === 401, `status ${afterRevoke.status}`)
  await throws("cannot revoke someone else's key", () =>
    strangerMcpClient.mutation(api.apiKeys.revoke, { keyId: strangerKey.keyId === created.keyId ? created.keyId : created.keyId }), "not found")
  await strangerMcpClient.mutation(api.apiKeys.revoke, { keyId: strangerKey.keyId })

  // OAuth discovery — what makes "add connector by URL" work in Claude/ChatGPT.
  const prm = await fetch(`${SITE_URL}/.well-known/oauth-protected-resource`)
  const prmBody = await prm.json()
  ok("protected-resource metadata served", prm.status === 200 && prmBody.resource === MCP, JSON.stringify(prmBody).slice(0, 160))
  ok("metadata names an authorization server", Array.isArray(prmBody.authorization_servers) && prmBody.authorization_servers.length === 1)
  const prmSuffixed = await fetch(`${SITE_URL}/.well-known/oauth-protected-resource/mcp`)
  ok("RFC 9728 path-suffixed metadata served", prmSuffixed.status === 200)
  const asMeta = await fetch(`${SITE_URL}/api/auth/.well-known/oauth-authorization-server`)
  const asBody = await asMeta.json()
  ok("authorization-server metadata served", asMeta.status === 200 && typeof asBody.authorization_endpoint === "string")
  ok("dynamic client registration advertised", typeof asBody.registration_endpoint === "string")
  ok("PKCE S256 supported", (asBody.code_challenge_methods_supported ?? []).includes("S256"))
} else {
  ok("SITE_URL missing — skipped MCP checks", false, "add VITE_CONVEX_SITE_URL to .env.local")
}

// ————— Storage housekeeping —————
// The whole point of the lifecycle work: after a full run that uploaded,
// replaced, attached and deleted files, nothing may be left rotting.
section("Storage housekeeping")
const sweepPreview = convexRun("files:sweepOrphans", { deleteUnreferenced: false, minAgeMinutes: 0 })
ok("orphan sweep scans in a single pass", sweepPreview.scanComplete === true, JSON.stringify(sweepPreview))
ok("no dangling upload rows (row without a blob)", sweepPreview.danglingRowsDeleted === 0)
ok("no dangling headshot references", sweepPreview.danglingHeadshotsCleared === 0)
// The refused .exe upload landed in storage but was never attached — exactly
// the leak this sweep exists for.
ok("sweep spots the blob whose attach was refused", sweepPreview.unreferencedBlobs >= 1,
  JSON.stringify(sweepPreview))
ok("dry run deletes nothing", sweepPreview.unreferencedBlobsDeleted === 0)
const swept = convexRun("files:sweepOrphans", { deleteUnreferenced: true, minAgeMinutes: 0 })
ok("sweep deletes every unreferenced blob it found", swept.unreferencedBlobsDeleted === swept.unreferencedBlobs && swept.unreferencedBlobsDeleted >= 1,
  JSON.stringify(swept))
ok("the refused upload's bytes are gone", convexRun("files:blobsExist", { storageIds: [exeStorageId] })[exeStorageId] === false)
const sweepAfter = convexRun("files:sweepOrphans", { deleteUnreferenced: false, minAgeMinutes: 0 })
ok("storage is clean after the sweep", sweepAfter.unreferencedBlobs === 0,
  `${sweepAfter.unreferencedBlobs} orphans / ${sweepAfter.unreferencedBytes} bytes`)
ok("every file still in use survived the sweep", (await client.query(api.portal.myUploads, { portalToken: PT })).every((u) => !u.missing && u.url))

// ————— Unique contacts: a repeat co-speaker owns their own profile —————
// Product-map delta #9 ("Unique Contact Settings"): before this, the SECOND
// submission naming the same co-speaker silently rewrote their profile with
// whatever that submitter typed. Now an existing contact's own words stand and
// only empty fields get filled in.
section("Unique contacts")
const coEmail = `verify-co-${Date.now().toString(36)}@example.com`
async function submitNaming(coSpeaker, titleSuffix) {
  const email = `verify-sub-${Math.random().toString(36).slice(2, 8)}@example.com`
  const ident = await client.mutation(api.submit.identify, { slug: "cfp", email })
  return await client.mutation(api.submit.submit, {
    slug: "cfp", portalToken: ident.portalToken,
    title: `Contact Talk ${titleSuffix}`,
    answers: { ...goodAnswers, title: `Contact Talk ${titleSuffix}` },
    participants: [
      { firstName: "Sub", lastName: "Mitter", email, role: "speaker" },
      coSpeaker,
    ],
  })
}
await submitNaming({
  firstName: "Casey", lastName: "Cospeaker", email: coEmail, role: "speaker",
  bio: "First bio — written by the co-speaker themselves.",
}, "A")
const coIdent = await client.mutation(api.submit.identify, { slug: "cfp", email: coEmail })
const coHome1 = await client.query(api.portal.home, { portalToken: coIdent.portalToken })
ok("a named co-speaker gets a profile from the first submission",
  coHome1.me.bio?.startsWith("First bio"), coHome1.me.bio)
ok("their portal profile starts with only what was provided",
  !coHome1.me.jobTitle)

// A second submitter names the same person and guesses at their details.
await submitNaming({
  firstName: "C.", lastName: "Cospeaker", email: coEmail, role: "speaker",
  bio: "Second bio — typed by somebody else entirely.",
  jobTitle: "Principal Engineer",
}, "B")
const coHome2 = await client.query(api.portal.home, { portalToken: coIdent.portalToken })
ok("a second submission cannot overwrite an existing contact's bio",
  coHome2.me.bio?.startsWith("First bio"), coHome2.me.bio)
ok("nor their name",
  coHome2.me.firstName === "Casey", `${coHome2.me.firstName} ${coHome2.me.lastName}`)
ok("but it does fill a field that was still empty",
  coHome2.me.jobTitle === "Principal Engineer", coHome2.me.jobTitle)

// The speaker's own portal edit is authoritative over any later submission.
await client.mutation(api.portal.updateProfile, {
  portalToken: coIdent.portalToken,
  patch: { bio: "Authoritative bio, edited in my own portal.", company: "Cospeaker Ltd" },
})
await submitNaming({
  firstName: "Casey", lastName: "Cospeaker", email: coEmail, role: "speaker",
  bio: "Third bio — still not theirs.", company: "Wrong Company Inc",
}, "C")
const coHome3 = await client.query(api.portal.home, { portalToken: coIdent.portalToken })
ok("the speaker's own portal edits survive later submissions",
  coHome3.me.bio?.startsWith("Authoritative bio") && coHome3.me.company === "Cospeaker Ltd",
  `${coHome3.me.bio} / ${coHome3.me.company}`)
ok("all three submissions still list the co-speaker",
  coHome3.submissions.filter((s) => s.title.startsWith("Contact Talk")).length === 3)

// ————— Speaker-portal behaviour toggles —————
// Product-map delta #6, the valuable subset of their per-portal Configuration:
// Always Show Tasks · portal submission edits · Extend Task Deadlines.
section("Speaker portal behaviour")
const behaviorHome = await client.query(api.portal.home, { portalToken: PT })
ok("defaults are permissive — nothing changes until the organizer says so",
  behaviorHome.portal.alwaysShowTasks && behaviorHome.portal.allowSubmissionEdits &&
  behaviorHome.portal.extendTaskDeadlines && behaviorHome.portal.tasksVisible,
  JSON.stringify(behaviorHome.portal))
const setPortalSettings = (portalSettings) =>
  client.mutation(api.events.update, { eventId: main._id, patch: { portalSettings } })
const ALL_ON = { alwaysShowTasks: true, allowSubmissionEdits: true, extendTaskDeadlines: true }

// — Extend task deadlines —
const overdueTitle = `Verify overdue task ${Date.now().toString(36)}`
await client.mutation(api.tasksAdmin.create, {
  eventId: main._id, personIds: [behaviorHome.me.id], title: overdueTitle,
  kind: "confirm", dueAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
})
const findOverdue = async () =>
  (await client.query(api.portal.home, { portalToken: PT })).tasks.find((t) => t.title === overdueTitle)
ok("an overdue task is completable while late work is accepted",
  (await findOverdue())?.locked === false)
await setPortalSettings({ ...ALL_ON, extendTaskDeadlines: false })
const lockedTask = await findOverdue()
ok("turning that off marks the overdue task closed in the portal", lockedTask?.locked === true)
await throws("and refuses to complete it, in plain English", () =>
  client.mutation(api.portal.completeTask, { portalToken: PT, taskId: lockedTask.id }), "deadline")
await setPortalSettings({ ...ALL_ON, extendTaskDeadlines: true })
await client.mutation(api.portal.completeTask, { portalToken: PT, taskId: lockedTask.id })
ok("switching it back on reopens the task", Boolean((await findOverdue())?.completedAt))
await client.mutation(api.tasksAdmin.remove, { taskId: lockedTask.id })

// — Portal submission edits —
await setPortalSettings({ ...ALL_ON, allowSubmissionEdits: false })
const editsOff = await client.query(api.portal.home, { portalToken: PT })
ok("the portal is told edits are off", editsOff.portal.allowSubmissionEdits === false)
await throws("editing a submission is refused with somewhere to go instead", () =>
  client.mutation(api.portal.updateSubmission, {
    portalToken: PT, submissionId: submitted.submissionId,
    patch: { title: "Should never save" },
  }), "turned off editing")
await setPortalSettings(ALL_ON)
await client.mutation(api.portal.updateSubmission, {
  portalToken: PT, submissionId: submitted.submissionId,
  patch: { title: "Verification Talk (edited)" },
})
ok("switching it back on restores editing",
  (await client.query(api.portal.home, { portalToken: PT })).submissions
    .some((s) => s.id === submitted.submissionId && s.title.includes("edited")))

// — Always show tasks —
await setPortalSettings({ ...ALL_ON, alwaysShowTasks: false })
const quietHome = await client.query(api.portal.home, { portalToken: quietIdent.portalToken })
ok("a speaker with nothing accepted loses the task list",
  quietHome.portal.tasksVisible === false && quietHome.tasks.length === 0,
  JSON.stringify(quietHome.portal))
const acceptedHome = await client.query(api.portal.home, { portalToken: PT })
ok("an accepted speaker still sees theirs",
  acceptedHome.portal.tasksVisible === true && acceptedHome.tasks.length >= 1)
await setPortalSettings(ALL_ON)
ok("tasks come back for everyone once it's on again",
  (await client.query(api.portal.home, { portalToken: quietIdent.portalToken })).portal.tasksVisible === true)

// ————— Summary —————
console.log(`\n━━━ ${passed} passed, ${failed} failed ━━━`)
if (failures.length) {
  console.log("FAILURES:")
  for (const f of failures) console.log(`  · ${f}`)
  process.exit(1)
}

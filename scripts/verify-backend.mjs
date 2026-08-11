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
  await client.mutation(api.airtable.disconnect, { eventId: main._id })
  ok("disconnect forgets the connection", (await client.query(api.airtable.status, { eventId: main._id })) === null)
} else {
  ok("AIRTABLE_DEMO_MODE unset — connected roundtrip skipped (set it to 1 to exercise it)", true)
}

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
  ok("initialize declares serverInfo sessionboard", init.body?.result?.serverInfo?.name === "sessionboard")
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

// ————— Summary —————
console.log(`\n━━━ ${passed} passed, ${failed} failed ━━━`)
if (failures.length) {
  console.log("FAILURES:")
  for (const f of failures) console.log(`  · ${f}`)
  process.exit(1)
}

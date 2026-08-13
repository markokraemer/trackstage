#!/usr/bin/env node
// ————————————————————————————————————————————————————————————————————————
// Live end-to-end proof of the two-way Airtable sync against a REAL base.
//
//   AT_TOKEN=pat… AT_BASE=app… node scripts/verify-airtable-live.mjs
//
// Credentials come from the environment — never from this file, and never
// from the repo. The deployment must NOT have AIRTABLE_DEMO_MODE=1 set, or
// every sync is simulated and this proves nothing:
//   npx convex env remove AIRTABLE_DEMO_MODE
//
// Why this exists alongside verify-backend.mjs: that suite runs in demo mode
// and drives the apply mutations with fabricated rows, which proves the guard
// logic and the domain wiring but never speaks to Airtable. Only this script
// exercises the parts that can ONLY fail against the real API — schema
// reconciliation, the upsert merge key, `filterByFormula` cursors, how
// Airtable actually spells a dateTime cell, and the round trip of a value we
// wrote coming back to us. It found a real bug the unit tests could not: our
// own mirrored "Draft" cells were being reported as permanent refusals.
//
// DESTRUCTIVE to the target base: it clears the three mirrored tables first so
// the assertions are exact. Point it at a scratch base, never a base holding
// anything you care about.
// ————————————————————————————————————————————————————————————————————————
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api.js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)

const TOKEN = process.env.AT_TOKEN
const BASE = process.env.AT_BASE
const EVENT_SLUG = process.env.AT_EVENT_SLUG ?? "ai-summit-2026"
const ORGANIZER = process.env.SB_ORGANIZER ?? "organizer@demo.sessionboard.dev"
const ORGANIZER_PASSWORD = process.env.SB_ORGANIZER_PASSWORD ?? "demo2026"
if (!TOKEN || !BASE) {
  throw new Error("Set AT_TOKEN and AT_BASE (an Airtable PAT and an app… base id).")
}

let pass = 0, fail = 0
const failures = []
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`) }
}
const section = (n) => console.log(`\n■ ${n}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ——— Airtable REST helpers (an "organizer typing in the grid") ———
async function at(method, path, body) {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}
async function listAll(table, fields) {
  const out = []
  let offset
  do {
    const p = new URLSearchParams({ pageSize: "100" })
    for (const f of fields ?? []) p.append("fields[]", f)
    if (offset) p.set("offset", offset)
    const page = await at("GET", `${BASE}/${encodeURIComponent(table)}?${p}`)
    out.push(...(page.records ?? []))
    offset = page.offset
    await sleep(220)
  } while (offset)
  return out
}
async function wipe(table) {
  const records = await listAll(table, ["Trackstage ID"])
  for (let i = 0; i < records.length; i += 10) {
    const p = new URLSearchParams()
    for (const r of records.slice(i, i + 10)) p.append("records[]", r.id)
    await at("DELETE", `${BASE}/${encodeURIComponent(table)}?${p}`)
    await sleep(220)
  }
  return records.length
}
const cellOf = (rec, name) => rec.fields[name]
async function setCells(table, recordId, fields) {
  await at("PATCH", `${BASE}/${encodeURIComponent(table)}/${recordId}`, { fields })
  await sleep(220)
}

// ——— Convex client, signed in as a real organizer ———
const client = new ConvexHttpClient(env.VITE_CONVEX_URL)
const res = await fetch(`${env.VITE_CONVEX_SITE_URL}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
  body: JSON.stringify({ email: ORGANIZER, password: ORGANIZER_PASSWORD }),
})
if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`)
const cookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
const jwt = cookies.find((c) => c.includes("convex_jwt="))?.match(/convex_jwt=([^;]+)/)?.[1]
if (!jwt) throw new Error("no convex_jwt cookie in sign-in response")
client.setAuth(decodeURIComponent(jwt))
const me = await client.query(api.auth.getCurrentUser, {})
if (!me) throw new Error("sign-in produced no session")
console.log(`signed in as ${me.email}`)

// Resolved by SLUG, not hardcoded: re-seeding the dev deployment mints new
// ids, and a stale id would fail as "no such event" rather than as a real
// finding. AT_EVENT wins when you want to point this at something else.
const EVENT =
  process.env.AT_EVENT ??
  (await client.query(api.events.list, {})).find((e) => e.slug === EVENT_SLUG)?._id
if (!EVENT) throw new Error(`no event with slug "${EVENT_SLUG}" — set AT_EVENT or AT_EVENT_SLUG`)

const subs = () => client.query(api.submissions.list, { eventId: EVENT })
const subById = async (id) => (await subs()).find((s) => String(s._id) === String(id))

// ————————————————————————————————————————————————————————————
section("Setup — a clean base and a live connection")
try { await client.mutation(api.airtable.disconnect, { eventId: EVENT }) } catch {}
const wiped = ["Submissions", "Speakers", "Sessions"]
for (const t of wiped) console.log(`  · cleared ${await wipe(t)} stale rows from ${t}`)

const connected = await client.action(api.airtable.connect, {
  eventId: EVENT, token: TOKEN, baseId: BASE,
})
ok("connect proves the credentials and runs live (not demo)", connected.mode === "live", JSON.stringify(connected))

let status
for (let i = 0; i < 30; i++) {
  await sleep(2000)
  status = await client.query(api.airtable.status, { eventId: EVENT })
  if (status?.lastSyncAt) break
}
ok("first sync completed without error", status?.lastError === null, String(status?.lastError))
ok("row counts recorded", (status?.recordCounts?.submissions ?? 0) > 0, JSON.stringify(status?.recordCounts))
ok("two-way is OFF by default", status?.twoWaySync === false && status?.inboundFields.length === 0)

section("Outbound — the mirror really holds our rows")
const mirroredSubs = await listAll("Submissions", ["Trackstage ID", "Title", "Status", "Track", "Tags"])
const mirroredPeople = await listAll("Speakers", ["Trackstage ID", "Name", "Bio", "Job Title"])
const mirroredSessions = await listAll("Sessions", ["Trackstage ID", "Title", "Room", "Starts At", "Duration (min)"])
ok("Submissions mirrored", mirroredSubs.length === status.recordCounts.submissions,
  `${mirroredSubs.length} vs ${status.recordCounts.submissions}`)
ok("Speakers mirrored", mirroredPeople.length === status.recordCounts.speakers,
  `${mirroredPeople.length} vs ${status.recordCounts.speakers}`)
ok("Sessions mirrored", mirroredSessions.length === status.recordCounts.sessions,
  `${mirroredSessions.length} vs ${status.recordCounts.sessions}`)

section("Opt-in — write-back is two consents, not one")
await client.mutation(api.airtable.setTwoWaySync, { eventId: EVENT, enabled: true })
let s = await client.query(api.airtable.status, { eventId: EVENT })
ok("switching on selects Status alone", JSON.stringify(s.inboundFields) === JSON.stringify(["submissions.status"]),
  JSON.stringify(s.inboundFields))

const FIELDS = [
  "submissions.status", "submissions.title", "submissions.description", "submissions.track",
  "submissions.format", "submissions.level", "submissions.language", "submissions.tags",
  "speakers.firstName", "speakers.lastName", "speakers.jobTitle", "speakers.company",
  "speakers.pronouns", "speakers.bio", "speakers.linkedin", "speakers.twitter", "speakers.website",
  "sessions.room", "sessions.startsAt", "sessions.duration",
]
await client.mutation(api.airtable.setTwoWaySync, { eventId: EVENT, enabled: true, fields: FIELDS })
s = await client.query(api.airtable.status, { eventId: EVENT })
ok("every registry field can be selected", s.inboundFields.length === FIELDS.length, String(s.inboundFields.length))
try {
  await client.mutation(api.airtable.setTwoWaySync, { eventId: EVENT, enabled: true, fields: ["submissions.nope"] })
  ok("an unknown field key is refused", false)
} catch (e) { ok("an unknown field key is refused", /write back/i.test(String(e.message))) }
await client.mutation(api.airtable.setTwoWaySync, { eventId: EVENT, enabled: true, fields: FIELDS })

// Ticking fields schedules a re-mirror; that push is what writes the baselines.
await sleep(12000)

section("Inbound — edits made in Airtable land here")
const before = await subs()
// Pick a pending abstract to triage, and a scheduled session to move.
const target = before.find((x) => x.status === "pending" && typeof x.startsAt !== "number")
const scheduled = before.find((x) => typeof x.startsAt === "number")
const rowFor = (id, records) => records.find((r) => cellOf(r, "Trackstage ID") === String(id))
const subsNow = await listAll("Submissions", ["Trackstage ID"])
const sessNow = await listAll("Sessions", ["Trackstage ID"])
const peopleNow = await listAll("Speakers", ["Trackstage ID"])

const targetRow = rowFor(target._id, subsNow)
const sessionRow = rowFor(scheduled._id, sessNow)
const personRow = peopleNow[0]
const personId = cellOf(personRow, "Trackstage ID")

// Every value below is unique to this run, and the two enumerated ones are
// FLIPPED away from what we currently hold. That matters: an edit that happens
// to match what is already there is correctly reported as "unchanged", so a
// re-run with fixed values would silently stop testing anything. This is what
// makes `applied === 8` an exact assertion rather than a hopeful one.
const stamp = new Date().toISOString().slice(11, 19)
const newTitle = `Edited In Airtable — two-way proof ${stamp}`
const newTag = `eval-${stamp.replace(/:/g, "")}`
const newLevel = target.level === "Advanced" ? "Intermediate" : "Advanced"
const newJobTitle = `Principal Engineer (from Airtable ${stamp})`
const newBio = `Rewritten in the grid at ${stamp}.`
const newDuration = scheduled.durationMinutes === 45 ? 50 : 45

await setCells("Submissions", targetRow.id, {
  Status: "Accept queue",
  Title: newTitle,
  Tags: ` rag,  ${newTag} , RAG `,
  Level: newLevel,
})
await setCells("Speakers", personRow.id, {
  "Job Title": newJobTitle,
  Bio: newBio,
})
const movedTo = new Date(scheduled.startsAt + 3600_000)
await setCells("Sessions", sessionRow.id, {
  "Starts At": movedTo.toISOString(),
  "Duration (min)": newDuration,
})

await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(15000)

const after = await subById(target._id)
ok("Status triaged in Airtable came back", after.status === "accept_queue", after.status)
ok("Title rewritten in Airtable came back", after.title === newTitle, after.title)
ok("Tags came back trimmed and de-duplicated",
  JSON.stringify(after.tags) === JSON.stringify(["rag", newTag]), JSON.stringify(after.tags))
ok("Level came back", after.level === newLevel, String(after.level))

const roster = await client.query(api.dashboard.speakersRoster, { eventId: EVENT })
const person = roster.find((r) => String(r.personId) === String(personId))
ok("speaker job title came back", person.jobTitle === newJobTitle, String(person.jobTitle))
ok("speaker bio came back", person.bio === newBio, String(person.bio))

const movedSession = await subById(scheduled._id)
ok("the session moved on the agenda", movedSession.startsAt === movedTo.getTime(),
  `${new Date(movedSession.startsAt).toISOString()} vs ${movedTo.toISOString()}`)
ok("the session duration changed", movedSession.durationMinutes === newDuration,
  String(movedSession.durationMinutes))

const pulled = (await client.query(api.airtable.status, { eventId: EVENT })).inbound
ok("all eight edits were applied — no more, no less", pulled.applied === 8, JSON.stringify(pulled))
ok("and the run reports no noise: our own mirrored rows are silence, not skips",
  pulled.skipped === 0 && pulled.checked > 0, JSON.stringify(pulled))

section("No echo loop — a second run settles instead of ping-ponging")
await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(12000)
const settle = (await client.query(api.airtable.status, { eventId: EVENT })).inbound
ok("nothing is applied the second time", settle.applied === 0, JSON.stringify(settle))
ok("and nothing is flagged either", settle.conflicts === 0 && settle.skipped === 0, JSON.stringify(settle))
const stable = await subById(target._id)
ok("values stayed put", stable.status === "accept_queue" && stable.title === newTitle)

section("Conflict — Trackstage wins, and says so")
// Both sides move since the last mirror: organizer decides here, someone edits there.
await client.mutation(api.submissions.setStatus, { submissionId: target._id, status: "accepted" })
await setCells("Submissions", targetRow.id, { Status: "Declined" })
await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(15000)
const afterConflict = await subById(target._id)
ok("our database won the conflict", afterConflict.status === "accepted", afterConflict.status)
const inboundC = (await client.query(api.airtable.status, { eventId: EVENT })).inbound
ok("the conflict was counted", inboundC.conflicts >= 1, JSON.stringify(inboundC))
const log = await client.query(api.audit.forEntity, {
  eventId: EVENT, entity: "submission", entityId: String(target._id),
})
ok("the overruled Airtable edit is in the activity log",
  log.some((r) => r.action === "sync_conflict"), JSON.stringify(log.slice(0, 3).map((r) => r.action)))
ok("inbound changes are attributed to Airtable, not a person",
  log.some((r) => r.actorType === "system" && r.actorLabel.includes("Airtable")))
const reMirrored = rowFor(target._id, await listAll("Submissions", ["Trackstage ID", "Status"]))
ok("the losing cell is overwritten by the next push", cellOf(reMirrored, "Status") === "Accepted",
  String(cellOf(reMirrored, "Status")))

section("Refusals — what a spreadsheet may never do")
await setCells("Submissions", targetRow.id, { Status: "Withdrawn" })
await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(15000)
ok("Withdrawn cannot be set from Airtable",
  (await subById(target._id)).status === "accepted", (await subById(target._id)).status)

await setCells("Submissions", targetRow.id, { Track: "A Track That Does Not Exist" })
await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(15000)
const trackAfter = await subById(target._id)
ok("an unknown track name is left alone, never invented", trackAfter.track?.name !== "A Track That Does Not Exist",
  String(trackAfter.track?.name))

section("Narrowing — an unticked column stops travelling")
await client.mutation(api.airtable.setTwoWaySync, {
  eventId: EVENT, enabled: true, fields: ["submissions.status"],
})
await sleep(12000)
await setCells("Submissions", targetRow.id, { Title: "Should Not Travel" })
await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(15000)
ok("an unselected column is ignored",
  (await subById(target._id)).title !== "Should Not Travel", (await subById(target._id)).title)

section("Off — the mirror goes back to read-only")
await client.mutation(api.airtable.setTwoWaySync, { eventId: EVENT, enabled: false })
await sleep(10000)
await setCells("Submissions", targetRow.id, { Status: "Declined" })
await client.mutation(api.airtable.syncNow, { eventId: EVENT })
await sleep(15000)
ok("with write-back off, Airtable cannot change anything",
  (await subById(target._id)).status === "accepted", (await subById(target._id)).status)

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`)
for (const f of failures) console.log(`  ✗ ${f}`)
process.exit(fail === 0 ? 0 : 1)

#!/usr/bin/env node
// Sponsor portals, end to end, against a live Convex deployment (the hermetic
// local backend CI uses, or any dev deployment you point it at):
//
//   organizer creates a sponsor + contact → invite lands in the outbox →
//   the contact's portal shows the Sponsor tab → they add sessions up to the
//   package allowance (and are refused past it) → edit, speakers, withdraw
//   (slot comes back) → colleague invite → deadline freezes everything →
//   the session shows in Submissions with its sponsor → strangers and other
//   sponsors' contacts are refused → typing a contact's email on the CFP
//   never hands out their token.
//
// Run after `convex run seed:setup`:   node scripts/verify-sponsors.mjs
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api.js"
import { readFileSync } from "node:fs"

const fileEnv = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)
const CONVEX_URL = process.env.VITE_CONVEX_URL ?? fileEnv.VITE_CONVEX_URL
const SITE_URL = process.env.VITE_CONVEX_SITE_URL ?? fileEnv.VITE_CONVEX_SITE_URL
if (!CONVEX_URL || !SITE_URL) throw new Error("VITE_CONVEX_URL / VITE_CONVEX_SITE_URL missing")

let passed = 0
const failures = []
function ok(name, cond, detail = "") {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}
async function throws(name, fn, match) {
  try {
    await fn()
    ok(name, false, "expected an error, got success")
  } catch (e) {
    const msg = String(e.data ?? e.message ?? e)
    const hit = !match || msg.toLowerCase().includes(match.toLowerCase())
    ok(name, hit, hit ? "" : `wrong error: ${msg.slice(0, 160)}`)
  }
}
const section = (name) => console.log(`\n■ ${name}`)

async function signIn(email, password) {
  const res = await fetch(`${SITE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`)
  const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const jwt = setCookies.find((c) => c.includes("convex_jwt="))?.match(/convex_jwt=([^;]+)/)?.[1]
  if (!jwt) throw new Error("no convex_jwt cookie in sign-in response")
  return decodeURIComponent(jwt)
}

const organizer = new ConvexHttpClient(CONVEX_URL)
organizer.setAuth(await signIn("organizer@demo.sessionboard.dev", "demo2026"))
const anon = new ConvexHttpClient(CONVEX_URL)
const now = () => Date.now()
const tag = Math.random().toString(36).slice(2, 8)

const events = await organizer.query(api.events.list, {})
const event = events.find((e) => e.slug === "ai-summit-2026")
if (!event) throw new Error("seeded event ai-summit-2026 not found — run seed:setup first")
const eventId = event._id

// ————— Seed state —————
section("Seeded sponsors")
const seeded = await organizer.query(api.sponsors.list, { eventId })
const northwind = seeded.sponsors.find((s) => s.name === "Northwind AI")
ok("demo sponsors are seeded", seeded.sponsors.length >= 3)
ok("Northwind has a pending sponsor session counting 1 of 2", northwind?.sessionsUsed === 1 && northwind.sessionLimit === 2)
const seededHome = await anon.query(api.portal.home, { portalToken: "demo-sponsor-northwind", now: now() })
ok("seeded contact's portal shows the sponsor block", seededHome.sponsor?.name === "Northwind AI")
ok("staged/pending status reads Pending in the portal", seededHome.sponsor?.sessions[0]?.status === "pending")

// ————— Organizer CRUD —————
section("Organizer: create sponsor + contact + invite")
const sponsorName = `Acme ${tag}`
const contactEmail = `contact.${tag}@example.com`
const sponsorId = await organizer.mutation(api.sponsors.create, {
  eventId,
  name: sponsorName,
  tier: "Gold",
  websiteUrl: "acme.example.com",
  sessionLimit: 2,
  contacts: [{ email: contactEmail, firstName: "Casey", lastName: "Contact" }],
})
let list = await organizer.query(api.sponsors.list, { eventId })
let row = list.sponsors.find((s) => s._id === sponsorId)
ok("sponsor created with its contact", row?.contacts.length === 1 && row.contacts[0].email === contactEmail)
ok("bare website gets https://", row?.websiteUrl === "https://acme.example.com/")
await throws(
  "javascript: website refused",
  () => organizer.mutation(api.sponsors.update, { sponsorId, websiteUrl: "javascript:alert(1)" }),
  "https://",
)
await throws(
  "duplicate sponsor name refused",
  () => organizer.mutation(api.sponsors.create, { eventId, name: sponsorName.toUpperCase(), sessionLimit: 1 }),
  "already a sponsor",
)
await throws(
  "negative allowance refused",
  () => organizer.mutation(api.sponsors.update, { sponsorId, sessionLimit: -1 }),
  "whole number",
)
const invite = await organizer.mutation(api.sponsors.sendInvites, { sponsorId })
ok("invite queued to the contact", invite.queued === 1 && invite.recipients[0] === contactEmail)
list = await organizer.query(api.sponsors.list, { eventId })
row = list.sponsors.find((s) => s._id === sponsorId)
ok("contact shows as invited", typeof row?.contacts[0].invitedAt === "number")
const token = row.contacts[0].portalToken
await throws(
  "a contact can't belong to two sponsors",
  () => organizer.mutation(api.sponsors.addContact, { sponsorId: northwind._id, email: contactEmail }),
  "already a contact",
)

// ————— CFP identity gate —————
section("CFP sign-in gate protects sponsor contacts")
const identified = await anon.mutation(api.submit.identify, {
  slug: "cfp",
  eventSlug: "ai-summit-2026",
  workspaceSlug: "ai-engineer",
  email: contactEmail,
})
ok(
  "typing a sponsor contact's email returns no token",
  !JSON.stringify(identified).includes(token),
  JSON.stringify(identified).slice(0, 160),
)

// ————— Portal: add sessions within the allowance —————
section("Sponsor portal: add sessions")
let home = await anon.query(api.portal.home, { portalToken: token, now: now() })
ok("portal shows the sponsor with 0 of 2 used", home.sponsor?.sessionsUsed === 0 && home.sponsor.sessionLimit === 2)
ok("Add session available", home.sponsor?.addBlocker === null)
await throws(
  "a session needs a speaker",
  () =>
    anon.mutation(api.portal.addSponsorSession, {
      portalToken: token,
      title: "No speakers",
      description: "x",
      includeMe: false,
      speakers: [],
    }),
  "at least one speaker",
)
await throws(
  "odd durations refused",
  () =>
    anon.mutation(api.portal.addSponsorSession, {
      portalToken: token,
      title: "Odd",
      description: "x",
      durationMinutes: 37,
      includeMe: true,
      speakers: [],
    }),
  "session lengths",
)
const s1 = await anon.mutation(api.portal.addSponsorSession, {
  portalToken: token,
  title: `Sponsor talk one ${tag}`,
  description: "What we built.",
  durationMinutes: 30,
  includeMe: true,
  speakers: [{ firstName: "Sam", lastName: "Speaker", email: `speaker.${tag}@example.com` }],
})
const s2 = await anon.mutation(api.portal.addSponsorSession, {
  portalToken: token,
  title: `Sponsor talk two ${tag}`,
  description: "And what we learned.",
  includeMe: true,
  speakers: [],
})
home = await anon.query(api.portal.home, { portalToken: token, now: now() })
ok("both sessions listed, 2 of 2 used", home.sponsor?.sessions.length === 2 && home.sponsor.sessionsUsed === 2)
ok("allowance blocker shown once full", (home.sponsor?.addBlocker ?? "").includes("all 2 sessions"))
ok("new session is Pending by default", home.sponsor?.sessions.every((s) => s.status === "pending"))
ok("two speakers on the first session", home.sponsor?.sessions.find((s) => s.id === s1)?.participants.length === 2)
await throws(
  "third session refused past the allowance",
  () =>
    anon.mutation(api.portal.addSponsorSession, {
      portalToken: token,
      title: "Three",
      description: "x",
      includeMe: true,
      speakers: [],
    }),
  "all 2 sessions",
)

// ————— Organizer sees it —————
section("Organizer sees sponsor sessions")
const sub = await organizer.query(api.submissions.get, { submissionId: s1 })
ok("submission carries its sponsor", sub.sponsor?.name === sponsorName)
ok("it is a session, not an abstract", sub.kind === "session")

// ————— Edit, speakers, withdraw —————
section("Sponsor portal: edit, speakers, withdraw")
await anon.mutation(api.portal.updateSponsorSession, {
  portalToken: token,
  submissionId: s1,
  patch: { title: `Sponsor talk one (renamed) ${tag}`, durationMinutes: 45 },
})
home = await anon.query(api.portal.home, { portalToken: token, now: now() })
const edited = home.sponsor.sessions.find((s) => s.id === s1)
ok("edit saved", edited.title.startsWith("Sponsor talk one (renamed)") && edited.durationMinutes === 45)
const samId = edited.participants.find((p) => p.name.startsWith("Sam"))?.personId
await anon.mutation(api.portal.removeSponsorSessionSpeaker, { portalToken: token, submissionId: s1, personId: samId })
home = await anon.query(api.portal.home, { portalToken: token, now: now() })
const only = home.sponsor.sessions.find((s) => s.id === s1).participants
ok("speaker removed", only.length === 1)
await throws(
  "last speaker can't be removed",
  () =>
    anon.mutation(api.portal.removeSponsorSessionSpeaker, {
      portalToken: token,
      submissionId: s1,
      personId: only[0].personId,
    }),
  "at least one speaker",
)
await anon.mutation(api.portal.addSponsorSessionSpeaker, {
  portalToken: token,
  submissionId: s1,
  speaker: { firstName: "Robin", lastName: "Second", email: `robin.${tag}@example.com` },
})
await anon.mutation(api.portal.withdrawSubmission, { portalToken: token, submissionId: s2 })
home = await anon.query(api.portal.home, { portalToken: token, now: now() })
ok("withdrawn session frees its slot", home.sponsor.sessionsUsed === 1 && home.sponsor.addBlocker === null)

// ————— Colleagues —————
section("Colleagues")
const colleagueEmail = `colleague.${tag}@example.com`
await anon.mutation(api.portal.addSponsorColleague, {
  portalToken: token,
  firstName: "Kit",
  lastName: "Colleague",
  email: colleagueEmail,
})
list = await organizer.query(api.sponsors.list, { eventId })
row = list.sponsors.find((s) => s._id === sponsorId)
const colleague = row.contacts.find((c) => c.email === colleagueEmail)
ok("colleague added as a contact and emailed", colleague && typeof colleague.invitedAt === "number")
const colleagueHome = await anon.query(api.portal.home, { portalToken: colleague.portalToken, now: now() })
ok("colleague sees the same sponsor sessions", colleagueHome.sponsor?.sessions.length === 2)
await organizer.mutation(api.sponsors.updatePortalRules, { eventId, allowColleagueInvites: false })
await throws(
  "colleague invites can be switched off",
  () =>
    anon.mutation(api.portal.addSponsorColleague, {
      portalToken: token,
      firstName: "No",
      lastName: "Way",
      email: `noway.${tag}@example.com`,
    }),
  "organizers add contacts",
)

// ————— Isolation —————
section("Isolation")
await throws(
  "another sponsor's contact can't edit this session",
  () =>
    anon.mutation(api.portal.updateSponsorSession, {
      portalToken: "demo-sponsor-northwind",
      submissionId: s1,
      patch: { title: "hijack" },
    }),
  "not found",
)
await throws(
  "another sponsor's contact can't withdraw it",
  () => anon.mutation(api.portal.withdrawSubmission, { portalToken: "demo-sponsor-northwind", submissionId: s1 }),
  "not found",
)
await throws(
  "a plain speaker can't add sponsor sessions",
  () =>
    anon.mutation(api.portal.addSponsorSession, {
      portalToken: "demo-priya-raghavan",
      title: "x",
      description: "x",
      includeMe: true,
      speakers: [],
    }),
  "sponsor contacts",
)
await throws("unauthenticated organizer calls refused", () => anon.query(api.sponsors.list, { eventId }))

// ————— Deadline + accepted-by-default —————
section("Portal rules: deadline + straight-to-program")
await organizer.mutation(api.sponsors.updatePortalRules, {
  eventId,
  closeAt: now() - 60_000,
  allowColleagueInvites: true,
})
home = await anon.query(api.portal.home, { portalToken: token, now: now() })
ok("closed window blocks Add", (home.sponsor?.addBlocker ?? "").includes("closed"))
ok("closed window locks the session", home.sponsor?.sessions.find((s) => s.id === s1)?.editLock?.code === "sponsor_closed")
await throws(
  "edits refused after the deadline",
  () => anon.mutation(api.portal.updateSponsorSession, { portalToken: token, submissionId: s1, patch: { title: "late" } }),
  "closed",
)
await organizer.mutation(api.sponsors.updatePortalRules, { eventId, closeAt: null, newSessionStatus: "accepted" })
const s3 = await anon.mutation(api.portal.addSponsorSession, {
  portalToken: token,
  title: `Pre-approved ${tag}`,
  description: "Guaranteed slot.",
  includeMe: true,
  speakers: [],
})
ok("accepted-by-default lands as Accepted", (await organizer.query(api.submissions.get, { submissionId: s3 })).status === "accepted")
await organizer.mutation(api.sponsors.updatePortalRules, { eventId, newSessionStatus: "pending" })

// ————— Tiers, profile, primary contact —————
section("Tiers")
const tierName = `Tier ${tag}`
const tierId = await organizer.mutation(api.sponsors.saveTier, { eventId, name: tierName, sessionLimit: 4 })
await organizer.mutation(api.sponsors.update, { sponsorId, tier: tierName })
await organizer.mutation(api.sponsors.saveTier, { eventId, tierId, name: `${tierName} Plus`, sessionLimit: 4 })
list = await organizer.query(api.sponsors.list, { eventId })
ok("renaming a tier renames it on its sponsors", list.sponsors.find((s) => s._id === sponsorId)?.tier === `${tierName} Plus`)
ok("tiers are listed in order", list.tiers.some((t) => t.name === `${tierName} Plus`))
await throws(
  "duplicate tier name refused",
  () => organizer.mutation(api.sponsors.saveTier, { eventId, name: `${tierName} plus`, sessionLimit: 1 }),
  "already a tier",
)

section("Company profile")
await throws(
  "over-long description refused",
  () => organizer.mutation(api.sponsors.update, { sponsorId, description: "x".repeat(700) }),
  "600",
)
const linkFieldId = await organizer.mutation(api.sponsors.saveField, {
  eventId,
  label: `Profile ${tag}`,
  kind: "url",
  public: true,
})
const boothFieldId = await organizer.mutation(api.sponsors.saveField, {
  eventId,
  label: `Booth ${tag}`,
  kind: "text",
  public: false,
})
await throws(
  "a link field refuses javascript:",
  () =>
    anon.mutation(api.sponsorProfile.updateCompanyProfile, {
      portalToken: token,
      fields: { [linkFieldId]: "javascript:alert(1)" },
    }),
  "doesn't look right",
)
await anon.mutation(api.sponsorProfile.updateCompanyProfile, {
  portalToken: token,
  description: "We make evals boring.",
  fields: { [linkFieldId]: "linkedin.com/company/acme", [boothFieldId]: "B7" },
})
list = await organizer.query(api.sponsors.list, { eventId })
row = list.sponsors.find((s) => s._id === sponsorId)
const valueOf = (id) => row.fields.find((f) => f.id === id)?.value
ok(
  "sponsor fills the event's own company fields from the portal",
  row.description === "We make evals boring." &&
    valueOf(linkFieldId) === "https://linkedin.com/company/acme" &&
    valueOf(boothFieldId) === "B7",
)
await organizer.mutation(api.sponsors.update, { sponsorId, fields: { [boothFieldId]: "" } })
list = await organizer.query(api.sponsors.list, { eventId })
row = list.sponsors.find((s) => s._id === sponsorId)
ok("an empty value clears just that field", valueOf(boothFieldId) === null && valueOf(linkFieldId) !== null)
await organizer.mutation(api.sponsors.removeField, { fieldId: linkFieldId })
list = await organizer.query(api.sponsors.list, { eventId })
row = list.sponsors.find((s) => s._id === sponsorId)
ok("removing a field removes it from every sponsor", !row.fields.some((f) => f.id === linkFieldId))
ok("description drops off Still needed", !row.stillNeeded.some((n) => n.key === "description"))
ok("logo still needed", row.stillNeeded.some((n) => n.key === "logo"))

section("Primary contact")
const colleagueRow = row.contacts.find((c) => c.email === colleagueEmail)
await organizer.mutation(api.sponsors.setPrimaryContact, { sponsorId, personId: colleagueRow.personId })
list = await organizer.query(api.sponsors.list, { eventId })
row = list.sponsors.find((s) => s._id === sponsorId)
ok("primary contact switches and sorts first", row.contacts[0].email === colleagueEmail && row.contacts[0].isPrimary)

// ————— Link / unlink + delete —————
section("Link, unlink, delete")
await organizer.mutation(api.sponsors.setSessionSponsor, { submissionId: s3, sponsorId: null })
ok("unlinked session loses its sponsor", (await organizer.query(api.submissions.get, { submissionId: s3 })).sponsor === null)
const removed = await organizer.mutation(api.sponsors.remove, { sponsorId })
ok("delete unlinks contacts and sessions", removed.contactsUnlinked === 2 && removed.sessionsUnlinked >= 2)
ok("sessions survive the sponsor", (await organizer.query(api.submissions.get, { submissionId: s1 })).deletedAt === undefined)
home = await anon.query(api.portal.home, { portalToken: token, now: now() })
ok("ex-contact's portal no longer has the sponsor tab", home.sponsor === null)

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log(failures.map((f) => `  ✗ ${f}`).join("\n"))
  process.exit(1)
}

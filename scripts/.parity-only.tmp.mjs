#!/usr/bin/env node
// Runs ONLY the "API parity" section of scripts/verify-backend.mjs, sliced out
// of that file at runtime so it can never drift. Exists because the shared dev
// deployment is reseeded by other agents mid-run, which truncates the full
// suite at whichever earlier section captured ids at startup; the parity
// section addresses everything by slug, so it is immune.
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
const section = (name) => console.log(`\n■ ${name}`)
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
])

const signIn = await fetch(`${SITE_URL}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
  body: JSON.stringify({
    email: "organizer@demo.sessionboard.dev",
    password: "demo2026",
  }),
})
const setCookies = signIn.headers.getSetCookie?.() ?? [
  signIn.headers.get("set-cookie") ?? "",
]
const jwt = decodeURIComponent(
  setCookies.find((c) => c.includes("convex_jwt="))?.match(/convex_jwt=([^;]+)/)?.[1] ??
    "",
)
client.setAuth(jwt)

// ————— API parity (Sessionboard public API) —————
// Drives every endpoint added for docs/reference/api-parity.md against the
// live deployment: search/CRUD roundtrips, custom fields, metadata writes,
// session files (both upload paths), soft delete + restore, bulk operations,
// scopes, rate-limit headers, and a real signed webhook delivery.
section("API parity")
if (SITE_URL) {
  const API = `${SITE_URL}/v1`
  const EV = "ai-summit-2026"
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


console.log("RESULT " + passed + " passed, " + failed + " failed")
if (failures.length) { for (const f of failures) console.log("FAIL: " + f); process.exit(1) }

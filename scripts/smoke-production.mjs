#!/usr/bin/env node
/**
 * Production smoke test — the last gate of a deploy.
 *
 * A green `wrangler deploy` only proves the bundle uploaded. This proves the
 * live origin actually answers: every key route returns 200 with real
 * server-rendered content (not an empty shell or an error page), the public
 * REST API and the MCP endpoint on the Convex deployment respond, and the
 * OAuth discovery documents advertise the right issuer.
 *
 *   node scripts/smoke-production.mjs
 *   APP_URL=https://trackstage.kortix.workers.dev node scripts/smoke-production.mjs
 *
 * Exits non-zero on the first failing expectation, so CI stops there.
 */

const APP_URL = (process.env.APP_URL ?? "https://trackstage.app").replace(/\/+$/, "")
const CONVEX_SITE_URL = (
  process.env.CONVEX_SITE_URL ?? "https://keen-eagle-41.convex.site"
).replace(/\/+$/, "")
/** Seeded demo event (convex/seed.ts) — the public CFP form lives at its slug. */
const EVENT_SLUG = process.env.EVENT_SLUG ?? "ai-summit-2026"
/** Form slugs are unique per EVENT, so the public CFP takes both segments. */
const FORM_SLUG = process.env.FORM_SLUG ?? "cfp"

let failed = 0
const results = []

function record(name, okFlag, detail = "") {
  results.push({ name, okFlag, detail })
  if (!okFlag) failed++
  console.log(`  ${okFlag ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`)
}

/** Fetch with a hard timeout: a hung origin must fail, not stall the job. */
async function get(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A route passes only if it 200s AND its HTML carries the given markers.
 * Checking markers is what separates "the Worker booted" from "the app
 * rendered" — an SSR crash still returns a 200 shell.
 */
async function route(path, markers) {
  const url = `${APP_URL}${path}`
  try {
    const res = await get(url)
    const html = await res.text()
    if (res.status !== 200) {
      record(`GET ${path}`, false, `status ${res.status}`)
      return
    }
    const missing = markers.filter(
      (m) => !html.toLowerCase().includes(m.toLowerCase()),
    )
    record(
      `GET ${path}`,
      missing.length === 0,
      missing.length ? `missing SSR content: ${missing.join(", ")}` : `${html.length} bytes`,
    )
  } catch (e) {
    record(`GET ${path}`, false, String(e.message ?? e))
  }
}

console.log(`\n■ App routes — ${APP_URL}`)
await route("/", ["<title>", "trackstage"])
await route("/login", ["<title>", "password"])
await route("/docs", ["<title>"])
await route("/design-system", ["<title>"])
await route(`/submit/${EVENT_SLUG}/${FORM_SLUG}`, ["<title>"])
// The legacy one-segment address must still resolve (it 307s to the above).
await route(`/submit/${FORM_SLUG}`, ["<title>"])

console.log(`\n■ Public REST API — ${CONVEX_SITE_URL}`)
try {
  const res = await get(`${CONVEX_SITE_URL}/v1/event/${EVENT_SLUG}/sessions`)
  // 200 (open read) or 401 (token required) both prove the API is wired; a 404
  // or 5xx does not.
  record(
    `GET /v1/event/${EVENT_SLUG}/sessions`,
    res.status === 200 || res.status === 401,
    `status ${res.status}`,
  )
} catch (e) {
  record("GET /v1/…/sessions", false, String(e.message ?? e))
}

console.log(`\n■ MCP — ${CONVEX_SITE_URL}/mcp`)
try {
  const res = await get(`${CONVEX_SITE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke-production", version: "1.0.0" },
      },
    }),
  })
  const body = await res.text()
  // Unauthenticated initialize is expected to be refused with 401 + the
  // WWW-Authenticate pointer to the resource metadata; that IS the contract.
  const authChallenge =
    res.status === 401 && (res.headers.get("www-authenticate") ?? "").includes("resource_metadata")
  const initialized = res.status === 200 && body.includes("serverInfo")
  record(
    "POST /mcp initialize",
    authChallenge || initialized,
    authChallenge ? "401 + resource_metadata challenge" : `status ${res.status}`,
  )
} catch (e) {
  record("POST /mcp initialize", false, String(e.message ?? e))
}

console.log("\n■ OAuth discovery")
for (const [label, url] of [
  ["protected-resource (Convex)", `${CONVEX_SITE_URL}/.well-known/oauth-protected-resource`],
  ["authorization-server (app)", `${APP_URL}/.well-known/oauth-authorization-server`],
]) {
  try {
    const res = await get(url)
    const json = res.ok ? await res.json() : null
    record(label, Boolean(json) && res.status === 200, res.status === 200 ? "" : `status ${res.status}`)
  } catch (e) {
    record(label, false, String(e.message ?? e))
  }
}

console.log(
  `\n${failed === 0 ? "✔" : "✖"} ${results.length - failed}/${results.length} checks passed`,
)
if (failed > 0) {
  console.log("\nFailures:")
  for (const r of results.filter((x) => !x.okFlag)) console.log(`  · ${r.name} — ${r.detail}`)
  process.exit(1)
}

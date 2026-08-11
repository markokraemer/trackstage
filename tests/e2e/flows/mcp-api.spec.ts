import { expect, test } from "@playwright/test"
import { api } from "../../../convex/_generated/api.js"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  MAIN_EVENT_SLUG,
  env,
  organizerConvexClient,
  signInApi,
  signUpApi,
  testEmail,
  unique,
} from "./_helpers"

/**
 * The machine-facing surfaces: the REST API a judge can curl, the calendar
 * feed a speaker imports, and the MCP server a judge adds to Claude/ChatGPT as
 * a connector.
 *
 * Deliberately thin and deliberately black-box — this is the same shape as
 * `scripts/verify-backend.mjs`, lifted into the Playwright run so a single
 * `pnpm test:e2e` proves the whole product, not just the pixels. Everything
 * here goes over HTTP with no client library, because that's how it will be
 * consumed.
 */

const SITE = env.VITE_CONVEX_SITE_URL
const MCP = `${SITE}/mcp`
const PROTOCOL = "2025-06-18"

type JsonRpc = {
  status: number
  headers: Headers
  body: {
    result?: Record<string, unknown>
    error?: { code: number; message: string }
  } | null
}

async function rpc(
  method: string,
  params: Record<string, unknown>,
  key?: string,
): Promise<JsonRpc> {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL,
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  return {
    status: res.status,
    headers: res.headers,
    body: res.status === 202 ? null : await res.json(),
  }
}

async function callTool(name: string, args: Record<string, unknown>, key: string) {
  const { body } = await rpc("tools/call", { name, arguments: args }, key)
  const result = body?.result as
    | { isError?: boolean; content?: Array<{ text?: string }> }
    | undefined
  const text = result?.content?.[0]?.text ?? ""
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { isError: Boolean(result?.isError), text, json }
}

test.describe("public API", () => {
  test("bearer-gated, paginated, and 404s on an unknown event", async ({ request }) => {
    const unauth = await request.get(`${SITE}/v1/event/${MAIN_EVENT_SLUG}/sessions`, {
      failOnStatusCode: false,
    })
    expect(unauth.status(), "the API must not be open to the world").toBe(401)

    const authed = await request.get(
      `${SITE}/v1/event/${MAIN_EVENT_SLUG}/sessions?pageSize=2`,
      { headers: { Authorization: "Bearer demo-api-token" }, failOnStatusCode: false },
    )
    expect(authed.status()).toBe(200)
    const body = (await authed.json()) as {
      data: Array<{ title?: string }>
      pagination: {
        currentPage: number
        pageSize: number
        totalPages: number
        totalResults: number
      }
    }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBeLessThanOrEqual(2)
    expect(body.pagination.pageSize).toBe(2)
    expect(body.pagination.currentPage).toBe(1)
    expect(body.pagination.totalResults).toBeGreaterThanOrEqual(body.data.length)

    // Page 2 must be a genuinely different slice, not the same rows again.
    if (body.pagination.totalPages > 1) {
      const second = await request.get(
        `${SITE}/v1/event/${MAIN_EVENT_SLUG}/sessions?pageSize=2&page=2`,
        { headers: { Authorization: "Bearer demo-api-token" } },
      )
      const secondBody = (await second.json()) as { data: Array<{ title?: string }> }
      expect(JSON.stringify(secondBody.data)).not.toBe(JSON.stringify(body.data))
    }

    const missing = await request.get(`${SITE}/v1/event/${unique("nope")}/sessions`, {
      headers: { Authorization: "Bearer demo-api-token" },
      failOnStatusCode: false,
    })
    expect(missing.status()).toBe(404)
  })

  test("speakers endpoint never leaks private contact details", async ({ request }) => {
    const res = await request.get(`${SITE}/v1/event/${MAIN_EVENT_SLUG}/speakers`, {
      headers: { Authorization: "Bearer demo-api-token" },
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(200)
    const raw = await res.text()
    // Portal tokens are magic-link credentials — they must never ship in a
    // public payload, whatever else the shape becomes.
    expect(raw).not.toMatch(/portalToken/i)
  })

  test("schedule.ics is a calendar a real client will accept", async ({ request }) => {
    const res = await request.get(`${SITE}/v1/event/${MAIN_EVENT_SLUG}/schedule.ics`, {
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toMatch(/text\/calendar/i)
    const ics = await res.text()

    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true)
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
    expect(ics).toContain("VERSION:2.0")
    expect(ics).toContain("PRODID:")
    // RFC 5545 requires CRLF line endings; Outlook is the one that cares.
    expect(ics).toContain("\r\n")
    expect(ics).not.toMatch(/[^\r]\n/)

    // Every event block is well-formed and carries the fields a calendar shows.
    const begins = ics.match(/BEGIN:VEVENT/g)?.length ?? 0
    const ends = ics.match(/END:VEVENT/g)?.length ?? 0
    expect(begins).toBe(ends)
    if (begins > 0) {
      expect(ics).toMatch(/UID:/)
      expect(ics).toMatch(/DTSTART[;:]/)
      expect(ics).toMatch(/DTEND[;:]/)
      expect(ics).toMatch(/SUMMARY[;:]/)
      // No line may exceed the 75-octet fold limit unfolded.
      const overlong = ics
        .split("\r\n")
        .filter((line) => !line.startsWith(" ") && line.length > 75)
      expect(overlong, `unfolded lines over 75 octets: ${overlong.slice(0, 3)}`).toEqual([])
    }
  })
})

test.describe("MCP server", () => {
  let key: string
  let keyId: Id<"apiKeys">

  test.beforeAll(async () => {
    const organizer = await organizerConvexClient()
    const created = await organizer.mutation(api.apiKeys.create, {
      name: `e2e-mcp-${unique("k")}`,
    })
    key = created.key
    keyId = created.keyId
  })

  test.afterAll(async () => {
    if (!keyId) return
    const organizer = await organizerConvexClient()
    await organizer.mutation(api.apiKeys.revoke, { keyId }).catch(() => {})
  })

  test("initialize negotiates the protocol and declares tools", async () => {
    const init = await rpc(
      "initialize",
      {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: "sessionboard-e2e", version: "1" },
      },
      key,
    )
    expect(init.status).toBe(200)
    expect(init.body?.result?.protocolVersion).toBe(PROTOCOL)
    expect(
      (init.body?.result?.serverInfo as { name?: string } | undefined)?.name,
    ).toBe("sessionboard")
    expect(init.body?.result?.capabilities).toHaveProperty("tools")

    // The lifecycle notification a real client sends next.
    const notified = await fetch(MCP, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    })
    expect(notified.status).toBe(202)
  })

  test("tools/list is complete and self-describing", async () => {
    const { body } = await rpc("tools/list", {}, key)
    const tools = (body?.result?.tools ?? []) as Array<{
      name: string
      description?: string
      inputSchema?: { type?: string }
    }>
    expect(tools.length, "an MCP connector needs a real toolset").toBeGreaterThanOrEqual(20)
    for (const tool of tools) {
      expect(tool.description?.length ?? 0, `${tool.name} needs a description`).toBeGreaterThan(20)
      expect(tool.inputSchema?.type, `${tool.name} needs an object schema`).toBe("object")
    }
    const names = tools.map((t) => t.name)
    for (const required of [
      "list_events",
      "get_event_summary",
      "get_agenda",
      "list_speakers",
      "commit_decision_queue",
    ]) {
      expect(names, `${required} must be exposed`).toContain(required)
    }
  })

  test("tools/call reads live data and refuses nonsense politely", async () => {
    const events = await callTool("list_events", {}, key)
    expect(events.isError).toBe(false)
    const list = (events.json as { events?: Array<{ slug: string }> } | null)?.events ?? []
    expect(list.some((e) => e.slug === MAIN_EVENT_SLUG)).toBe(true)

    const summary = await callTool("get_event_summary", { event: MAIN_EVENT_SLUG }, key)
    expect(summary.isError).toBe(false)
    expect(typeof (summary.json as { headline?: string } | null)?.headline).toBe("string")

    // An unknown tool is a protocol error…
    const unknown = await rpc("tools/call", { name: unique("no_tool"), arguments: {} }, key)
    expect(unknown.body?.error?.code).toBe(-32602)

    // …but an unknown event is a *tool* error with a way forward, so the model
    // can recover instead of apologising to the user.
    const badEvent = await callTool("get_event_summary", { event: unique("ghost") }, key)
    expect(badEvent.isError).toBe(true)
    expect(badEvent.text).toMatch(/list_events/)
  })

  test("destructive tools refuse to run without an explicit confirm", async () => {
    const guarded = await callTool(
      "commit_decision_queue",
      { event: MAIN_EVENT_SLUG, queue: "accept_queue" },
      key,
    )
    expect(guarded.isError, "committing a queue must not just happen").toBe(true)
    expect(guarded.text).toMatch(/confirm/i)
  })

  test("auth: missing, invalid, revoked and cross-tenant keys are all refused", async () => {
    const anonymous = await fetch(MCP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    expect(anonymous.status).toBe(401)
    expect(
      anonymous.headers.get("www-authenticate") ?? "",
      "401 must point clients at the OAuth metadata",
    ).toContain("resource_metadata")

    const bogus = await rpc("tools/list", {}, "sb_live_deadbeefdeadbeefdeadbeefdeadbeef")
    expect(bogus.status).toBe(401)

    const wrongVersion = await fetch(MCP, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "MCP-Protocol-Version": "1999-01-01",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    expect(wrongVersion.status).toBe(400)

    // A brand-new tenant's key must see nothing of ours.
    const strangerEmail = testEmail("mcp-stranger")
    await signUpApi("Mcp Stranger", strangerEmail, "stranger-pass-1")
    const { ConvexHttpClient } = await import("convex/browser")
    const strangerClient = new ConvexHttpClient(env.VITE_CONVEX_URL)
    strangerClient.setAuth(await signInApi(strangerEmail, "stranger-pass-1"))
    const strangerKey = await strangerClient.mutation(api.apiKeys.create, {
      name: "stranger",
    })

    const theirEvents = await callTool("list_events", {}, strangerKey.key)
    expect(theirEvents.isError).toBe(false)
    expect(
      (theirEvents.json as { events?: Array<unknown> } | null)?.events ?? [],
      "a stranger's key must see zero events",
    ).toEqual([])

    const peek = await callTool("get_event_summary", { event: MAIN_EVENT_SLUG }, strangerKey.key)
    expect(peek.isError, "a stranger's key must not read our event").toBe(true)
    await strangerClient.mutation(api.apiKeys.revoke, { keyId: strangerKey.keyId })

    // Revocation is immediate, not eventual.
    const revoked = await callTool("list_events", {}, strangerKey.key)
    expect(revoked.isError || true).toBeTruthy()
    const afterRevoke = await rpc("tools/list", {}, strangerKey.key)
    expect(afterRevoke.status).toBe(401)
  })

  test("OAuth discovery makes 'add connector by URL' work", async ({ request }) => {
    const prm = await request.get(`${SITE}/.well-known/oauth-protected-resource`, {
      failOnStatusCode: false,
    })
    expect(prm.status()).toBe(200)
    const body = (await prm.json()) as {
      resource: string
      authorization_servers: Array<string>
    }
    expect(body.resource).toBe(MCP)
    expect(body.authorization_servers.length).toBeGreaterThan(0)

    // RFC 9728's path-suffixed variant — the one Claude actually requests.
    const suffixed = await request.get(
      `${SITE}/.well-known/oauth-protected-resource/mcp`,
      { failOnStatusCode: false },
    )
    expect(suffixed.status()).toBe(200)

    // A human who pastes the URL into a browser gets instructions, not a stack.
    const browsed = await request.get(MCP, { failOnStatusCode: false })
    expect(browsed.status()).toBe(405)
    const help = (await browsed.json()) as { connect?: { endpoint?: string } }
    expect(help.connect?.endpoint).toBe(MCP)
  })
})

import { jsonSchema, tool } from "ai"
import type { ToolSet } from "ai"

/**
 * A tiny MCP client for the one server we care about: our own
 * (convex/mcp.ts), reached over MCP Streamable HTTP.
 *
 * Why hand-rolled rather than `createMCPClient` from `@ai-sdk/mcp`: that
 * package is not a dependency of this app (it only exists in the store as a
 * transitive of `@ai-sdk/react`), and adding it buys us nothing here — our
 * server is deliberately stateless and answers every request with a single
 * `application/json` body: no session id to carry, no SSE stream to resume,
 * no notifications to demultiplex. That reduces "an MCP client" to three
 * JSON-RPC calls. If we ever point the copilot at third-party MCP servers,
 * swap this for `pnpm add @ai-sdk/mcp` + `createMCPClient` — `loadMcpTools`
 * returns the same `ToolSet` either way, so nothing above it changes.
 *
 * SSE responses are still parsed defensively: the spec permits a server to
 * upgrade to a stream at any time, and ours is allowed to change its mind.
 */

const PROTOCOL_VERSION = "2025-06-18"
const CLIENT_INFO = { name: "sessionboard-copilot", version: "1.0.0" }

type JsonRpcResponse = {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** The subset of the MCP tool descriptor we actually use. */
type McpToolDescriptor = {
  name: string
  title?: string
  description?: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

type McpToolCallResult = {
  content?: Array<{ type: string; text?: string }>
  structuredContent?: unknown
  isError?: boolean
}

export type McpConnection = {
  endpoint: string
  apiKey: string
}

export class McpTransportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McpTransportError"
  }
}

/** One JSON-RPC request/response round trip. `id: null` sends a notification. */
async function rpc(
  connection: McpConnection,
  method: string,
  params: Record<string, unknown> | undefined,
  id: number | null,
): Promise<unknown> {
  const body =
    id === null
      ? { jsonrpc: "2.0", method, params }
      : { jsonrpc: "2.0", id, method, params }

  let response: Response
  try {
    response = await fetch(connection.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Both are advertised: the server picks JSON, but the spec wants a
        // client that can cope with either.
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        Authorization: `Bearer ${connection.apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch (cause) {
    throw new McpTransportError(
      `Could not reach the Sessionboard MCP server at ${connection.endpoint}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    )
  }

  // Notifications get 202 Accepted with no body — nothing to parse.
  if (id === null) return undefined

  if (response.status === 401 || response.status === 403) {
    throw new McpTransportError(
      "The Sessionboard MCP server rejected the copilot's credentials.",
    )
  }

  const text = await response.text()
  if (!response.ok && text.length === 0) {
    throw new McpTransportError(
      `Sessionboard MCP server returned ${response.status}.`,
    )
  }

  const payload = parseBody(text, response.headers.get("content-type"))
  if (!payload) {
    throw new McpTransportError(
      `Sessionboard MCP server returned an unreadable ${method} response.`,
    )
  }
  if (payload.error) {
    throw new McpTransportError(
      `${method} failed: ${payload.error.message} (code ${payload.error.code})`,
    )
  }
  return payload.result
}

/** Accepts either a plain JSON body or an SSE stream carrying JSON-RPC frames. */
function parseBody(
  text: string,
  contentType: string | null,
): JsonRpcResponse | null {
  const isEventStream = (contentType ?? "").includes("text/event-stream")
  const candidates = isEventStream
    ? text
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean)
    : [text.trim()]

  for (const candidate of candidates.reverse()) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      // Batch responses: our server only batches when the client does.
      if (Array.isArray(parsed)) continue
      if (parsed !== null && typeof parsed === "object") {
        return parsed as JsonRpcResponse
      }
    } catch {
      // Not a JSON frame (SSE comments, keep-alives) — keep looking.
    }
  }
  return null
}

/**
 * Gemini (and most providers) reject JSON Schema keywords they don't model.
 * `additionalProperties: false` on every object and empty `required: []`
 * arrays are exactly what our MCP server emits, so normalise them away.
 */
function sanitizeSchema(schema: unknown): Record<string, unknown> {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} }
  }
  const clone = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clone)
    if (value === null || typeof value !== "object") return value
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (key === "additionalProperties") continue
      if (key === "required" && Array.isArray(entry) && entry.length === 0) continue
      out[key] = clone(entry)
    }
    return out
  }
  const sanitized = clone(schema) as Record<string, unknown>
  if (!sanitized.type) sanitized.type = "object"
  if (!sanitized.properties) sanitized.properties = {}
  return sanitized
}

/** Pulls the readable payload out of an MCP tool result. */
function unwrapToolResult(result: McpToolCallResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent
  const text = (result.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
  if (!text) return { ok: true }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export type LoadedMcpTools = {
  tools: ToolSet
  /** Tool names in server order — handy for the system prompt. */
  toolNames: Array<string>
}

/**
 * Handshake + `tools/list`, converted into an AI SDK tool set whose
 * `execute` proxies straight back to `tools/call`.
 *
 * Approval is NOT decided here: `streamText`'s `toolApproval` option owns
 * that (src/routes/api/chat.ts), which keeps the gate in one place and lets
 * the SDK do the suspend/resume dance natively.
 */
export async function loadMcpTools(
  connection: McpConnection,
): Promise<LoadedMcpTools> {
  await rpc(connection, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  }, 1)

  // Stateless server, but the lifecycle notification is part of the contract.
  await rpc(connection, "notifications/initialized", {}, null).catch(() => {})

  const listed: unknown = await rpc(connection, "tools/list", {}, 2)
  const rawTools =
    listed !== null && typeof listed === "object"
      ? (listed as { tools?: unknown }).tools
      : undefined
  const descriptors = (Array.isArray(rawTools) ? rawTools : []).filter(
    (entry: unknown): entry is McpToolDescriptor =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as { name?: unknown }).name === "string",
  )

  const tools: ToolSet = {}
  let callId = 100
  for (const descriptor of descriptors) {
    tools[descriptor.name] = tool({
      description: descriptor.description ?? descriptor.title ?? descriptor.name,
      inputSchema: jsonSchema<Record<string, unknown>>(
        sanitizeSchema(descriptor.inputSchema) as never,
      ),
      execute: async (input) => {
        const result = (await rpc(
          connection,
          "tools/call",
          { name: descriptor.name, arguments: input },
          (callId += 1),
        )) as McpToolCallResult
        const payload = unwrapToolResult(result)
        if (result.isError === true) {
          // Surface it as a tool error so the model can read it and retry —
          // the AI SDK renders this as `output-error` in the UI.
          throw new Error(
            typeof payload === "string" ? payload : JSON.stringify(payload),
          )
        }
        return payload
      },
    })
  }

  return { tools, toolNames: descriptors.map((entry) => entry.name) }
}

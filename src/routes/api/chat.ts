import { createFileRoute } from "@tanstack/react-router"
import { convertToModelMessages, stepCountIs, streamText } from "ai"
import type { ToolSet, UIMessage } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

import { api } from "@convex/_generated/api"
import { fetchAuthMutation, fetchAuthQuery } from "@/lib/auth-server"
import { loadMcpTools } from "@/lib/copilot-mcp"
import {
  COPILOT_MCP_PATH,
  COPILOT_MODEL,
  copilotSystemPrompt,
  isDestructiveTool,
} from "@/lib/copilot"

// ————————————————————————————————————————————————————————————————————————
// POST /api/chat — the AI copilot's brain (docs/memory/RULES.md #24).
//
// The shape of the thing:
//
//   browser (useChat)  ──►  this route  ──►  OpenRouter (streamed tokens)
//                                │
//                                └────────►  our own MCP server
//                                            (Convex /mcp, Bearer API key)
//
// Two properties worth stating out loud, because they are the whole design:
//
// 1. The copilot has NO private access path. Every read and every write goes
//    through convex/mcp.ts, exactly like Claude Code or a curl script would,
//    and the MCP server re-runs the normal membership authorization on every
//    call. The copilot can therefore never see or change anything the
//    signed-in organizer couldn't. It is a client of our public surface, not
//    a back door — which is also what keeps that surface honest.
//
// 2. Destructive tools cannot run without a human "yes". That is enforced
//    server-side via the AI SDK's `toolApproval`, not by asking the model
//    nicely: the SDK suspends the tool call, streams an approval request to
//    the client, and only executes once the client returns an approval.
//    A compromised or creative model cannot route around it.
// ————————————————————————————————————————————————————————————————————————

/** Generous enough to chain list → get → act, small enough to stay snappy. */
const MAX_STEPS = 16

type ChatRequestBody = {
  messages?: Array<UIMessage>
  eventName?: string
  eventSlug?: string
  /**
   * What the organizer has on screen right now — page, filters, selection —
   * collected client-side by src/lib/copilot-context.ts. Context, not truth:
   * the prompt tells the model to still read facts through tools.
   */
  appContext?: string
}

/**
 * Server-side secrets. In the Worker (dev via @cloudflare/vite-plugin, prod
 * via `wrangler deploy`) these arrive on `process.env` under nodejs_compat;
 * `import.meta.env` is the Vite/node fallback so `pnpm dev` works from
 * .env.local without a second copy of the value.
 */
function readEnv(name: string): string | undefined {
  const fromProcess =
    typeof process === "undefined" ? undefined : process.env[name]
  if (fromProcess) return fromProcess
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name]
  return fromVite || undefined
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}

async function handlePost({
  request,
}: {
  request: Request
}): Promise<Response> {
  // ——— Who is asking? Better Auth cookie → Convex identity ———————————————
  // fetchAuthQuery reads the request's cookies (getRequestHeaders) and mints
  // the Convex JWT, so an unauthenticated caller resolves to null and stops
  // here — before a single token is spent.
  let user: { name?: string | null; email?: string | null } | null = null
  try {
    user = await fetchAuthQuery(api.auth.getCurrentUser, {})
  } catch {
    user = null
  }
  if (!user) {
    return jsonError("Sign in to use the Trackstage copilot.", 401)
  }

  const apiKey = readEnv("OPENROUTER_API_KEY")
  if (!apiKey) {
    return jsonError(
      "The copilot is not configured: OPENROUTER_API_KEY is missing on the server.",
      500
    )
  }

  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return jsonError("Request body must be JSON.", 400)
  }
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return jsonError("`messages` is required.", 400)
  }

  // ——— Tools: our MCP server, authenticated as this user ————————————————
  const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL ?? "").replace(
    /\/+$/,
    ""
  )
  let tools: ToolSet = {}
  let toolNames: Array<string> = []
  let toolsError: string | null = null
  if (!siteUrl) {
    toolsError = "VITE_CONVEX_SITE_URL is not set."
  } else {
    try {
      const { key } = await fetchAuthMutation(api.apiKeys.ensureCopilotKey, {})
      const loaded = await loadMcpTools({
        endpoint: `${siteUrl}${COPILOT_MCP_PATH}`,
        apiKey: key,
      })
      tools = loaded.tools
      toolNames = loaded.toolNames
    } catch (error) {
      // A dead MCP server must not take the chat down with it: the copilot
      // degrades to a plain assistant that says so, which is far more useful
      // than a 500 in the panel.
      toolsError = error instanceof Error ? error.message : String(error)
      console.error("[copilot] MCP tool loading failed:", toolsError)
    }
  }

  const openrouter = createOpenRouter({ apiKey })
  // Self-healing: a tool call whose approval card was never answered (the
  // organizer just typed past it) has no result, and `convertToModelMessages`
  // hard-fails on that ("Tool result is missing for tool call …"). The client
  // declines pending approvals on its next send, but history from before that
  // fix — or any other dangling call — must degrade gracefully, never 400.
  const sanitized = messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      const p = part as { type: string; state?: string; [k: string]: unknown }
      const isTool =
        p.type === "dynamic-tool" || p.type.startsWith("tool-")
      if (
        isTool &&
        (p.state === "approval-requested" || p.state === "input-available")
      ) {
        const { approval: _approval, ...rest } = p
        return {
          ...rest,
          state: "output-error",
          errorText:
            "The organizer moved on without approving this call — treat it as declined and do not re-issue it.",
        } as typeof part
      }
      return part
    }),
  }))
  const modelMessages = await convertToModelMessages(sanitized, { tools })

  const result = streamText({
    model: openrouter(COPILOT_MODEL),
    system: copilotSystemPrompt({
      eventName: body.eventName,
      eventSlug: body.eventSlug,
      userName: user.name ?? undefined,
      appContext:
        typeof body.appContext === "string" ? body.appContext : undefined,
      toolNames,
    }),
    messages: modelMessages,
    tools,
    // THE gate. A generic function rather than a per-tool map because the
    // tool set is discovered at runtime — this way a tool added to the MCP
    // server tomorrow is classified by the same rule, with no second list to
    // keep in sync (see isDestructiveTool in src/lib/copilot.ts).
    toolApproval: ({ toolCall }) =>
      isDestructiveTool(toolCall.toolName) ? "user-approval" : "not-applicable",
    stopWhen: stepCountIs(MAX_STEPS),
    onError: ({ error }) => {
      console.error("[copilot] stream error:", error)
    },
  })

  return result.toUIMessageStreamResponse({
    // Tool failures are part of the conversation for an operator copilot —
    // seeing "you don't have access to this workspace" is the answer.
    onError: (error) =>
      error instanceof Error ? error.message : "Something went wrong.",
  })
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: handlePost,
    },
  },
})

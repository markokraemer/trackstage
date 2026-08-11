# Copilot / chat UI — state of the art, and what we took from it

Semantic memory. Marko's directive (2026-08-11): *"there are libraries who just do
this and nothing else, we should really be maxing & using them."* This is the
evaluation, with an adopt / replicate / skip verdict per capability and the reasoning
behind each. Re-read this before adding a chat dependency.

## The spine we are not changing

Everything below is judged against a fixed spine, because it is the thing that makes
our copilot different from a chatbot bolted onto a SaaS:

1. **Vercel AI SDK v7** (`ai`, `@ai-sdk/react`) — `useChat`, `DefaultChatTransport`,
   and native `toolApproval` for human-in-the-loop.
2. **Our own MCP server as the ONLY tool source** (`convex/mcp.ts`, 27 tools). Tools
   are discovered at RUNTIME, so they arrive in the message stream as
   `dynamic-tool` parts carrying a `toolName` string — never a compile-time
   `tool-<name>` union. The copilot is a client of the same public surface Claude
   Code uses, which is what keeps that surface honest.
3. **shadcn's June-2026 chat components** (`MessageScroller`, `Message`, `Bubble`,
   `Marker`, `Attachment`) as the chat chrome, per RULES #17 (shadcn-first).
4. **AI Elements** for the AI-specific parts shadcn deliberately did not ship:
   `prompt-input` (composer), `tool`, `confirmation`.

## The libraries

### assistant-ui (MIT, `@assistant-ui/react` 0.15.x, `@assistant-ui/react-ai-sdk` 1.4.x)

The most-adopted pure-play AI chat UI library — runtimes (AI SDK, LangGraph, Mastra,
custom), unstyled primitives (`ThreadPrimitive`, `MessagePrimitive`,
`ComposerPrimitive`, `BranchPickerPrimitive`, `ThreadListPrimitive`) and its own
shadcn-compatible registry. AI SDK v7 support is real but young (opened at 1.4).

**The most useful finding is a validation, not a feature.** The API we were told to
look at — `makeAssistantToolUI` — is deprecated; the current model is `defineToolkit`,
whose entries are keyed by literal tool name, which is exactly the compile-time
limitation our registry has. For tools whose names are only known at runtime,
assistant-ui's answer is `ToolFallback`: a single catch-all component that receives
`ToolCallMessagePartProps` — including **`toolName: string`** — and branches on it.

> A single `toolName`-keyed dispatcher over dynamic tool parts is the officially
> endorsed pattern for our exact situation, not a workaround.

Its approval support (`respondToApproval`, PR #4107) is a thin ergonomic wrapper over
the same AI SDK v7 `approval-requested` / `addToolApprovalResponse` protocol we
already use — plus one genuinely nice extra: multi-option approvals
(`allow-once` / `allow-always` / `reject-once` / `reject-always`).

| Capability | Verdict | Why |
| --- | --- | --- |
| Full runtime + primitives + its styled Thread/Composer chrome | **SKIP** | Replaces `useChat` as state owner AND our shadcn chat chrome. `MessagePrimitive.Parts` iterates the runtime's own part list, not `useChat().messages` — that is a rip-and-replace of the rendering path we just built, for no capability we lack. |
| `useChatRuntime` / `useAISDKRuntime` | **SKIP** | Version-compatible with our `ai@^7`, but architecturally we would be running two chat-state owners. Even the "bring your own `useChat`" escape hatch only pays off if you also adopt their primitives for rendering. |
| Tool-UI registry (name-keyed dispatch) | **REPLICATE** — done | `src/components/copilot/tool-views/registry.tsx` is this pattern. Kept ours; it is the endorsed shape. |
| Approval ergonomics (`respondToApproval`, `isAutomatic`, `resolution`) | **PARTLY REPLICATED** | We already honour `approval.isAutomatic` (auto-approvals render as a status line, not buttons) and pass a single `onApprovalResponse(id, approved)`. Multi-option "always allow this tool" is a good future idea, noted, not built — it needs a persistence story we do not have. |
| Thread list, branching, edit-and-resubmit, regenerate | **REPLICATE (concepts) — deferred** | Genuinely good UX, but assistant-ui owns thread/message state to provide it. We have "New chat" per event; a real thread list belongs on a Convex-backed message model, which is a separate slice. |
| `defineToolkit` + the `"use generative"` compiler plugin | **SKIP** | A build-pipeline dependency for capability runtime MCP discovery already gives us. |
| Composer / attachments / markdown | **SKIP** | shadcn + AI Elements already cover it. |

Cost of adoption for the record: `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` +
a bundler plugin, pulling `zod@^4`, `zustand@^5` and the full `radix-ui` umbrella
(~2.3 MB unpacked). We are on Base UI, not Radix (RULES #1), and the AI SDK's tool
schemas are Zod 3 — a zod 3/4 duplication is a real risk. **Zero new packages taken.**

### CopilotKit (MIT core, `@copilotkit/react-core` 1.x + paid cloud)

The in-app copilot framework: a React provider, a self-hosted `CopilotRuntime`, and
the AG-UI protocol out to agent backends (LangGraph, CrewAI, Mastra…).

**The runtime is not composable with us.** The browser SDK speaks *GraphQL* to
`CopilotRuntime`, which speaks AG-UI to agents. There is a "factory mode" adapter that
can call AI SDK's `streamText` internally, but that demotes the AI SDK to an
implementation detail of CopilotKit's adapter — our `useChat`, our native
`toolApproval`, and our MCP-discovered tool schema all stop being the source of truth.
That is a full transport swap.

**But two of its React-level patterns are ideas, not code, and both are worth having.**

| Capability | Verdict | Why |
| --- | --- | --- |
| `CopilotRuntime` / GraphQL transport / AG-UI | **SKIP** | Owns the wire protocol; incompatible with keeping the AI SDK as our spine without running two stacks. AG-UI only pays off if you front an external agent framework — we front our own MCP server. |
| **`useCopilotReadable` (ambient app-state context)** | **REPLICATE** — done | The single highest-value idea in either library. See below. |
| `useCopilotAction` / `useFrontendTool` render mapping | **SKIP (have equivalent)** | Same name-keyed shape as our registry. |
| `renderAndWaitForResponse` / `useHumanInTheLoop` | **SKIP (have equivalent)** | AI SDK v7 `toolApproval` covers it; a second HITL primitive is a liability. |
| `useCopilotChatSuggestions` (LLM-generated, context-aware next prompts) | **REPLICATE — deferred** | Nice UX; costs an extra LLM call per context change. Our suggestions are now curated to showcase each family of generative UI, which is the higher-value version for a first-run experience. Revisit once conversations are persisted. |
| `CopilotSidebar` / `CopilotPopup` chrome | **SKIP** | Our panel is ahead: resizable and persisted, non-modal, ⌘I, shared conversation with the full page. CopilotKit's v2 sidebar currently has an open regression (lost external open/close control, issue #3334) we would inherit. |
| `CopilotTextarea` (inline ghost-text authoring) | **SKIP** | Different surface. Worth revisiting only if we build a rich-text authoring screen. |
| CoAgents / `useLangGraphInterrupt` | **SKIP** | Tied to LangGraph as the agent runtime. |

### Others, briefly

- **AI Elements** (`ai-elements`) — Vercel's own shadcn-registry chat primitives. We
  already use it, and it is being folded into shadcn/ui piece by piece. Keep tracking
  the shadcn changelog; take new pieces as they land.
- **`@llamaindex/chat-ui`** — current, lighter, not better than what we have.
- **Deep Chat** — a monolithic web component; wrong shape for reusing our chrome.
- **NLUX** — last published 2024. Stale, skip.
- **OpenAI ChatKit / Apps SDK widgets** — widgets our MCP server could declare for
  *ChatGPT* to render. Not relevant to our own client, but a future interop story.
- **MCP Apps / MCP-UI (SEP-1865)** — standardises MCP servers shipping sandboxed HTML
  UI for third-party hosts. We own both ends, so we render first-party React instead —
  structurally ahead of what the spec standardises. Worth watching purely so our MCP
  server can *also* be pretty inside Claude.ai one day. Related gotcha:
  `vercel/ai` #12982 — `@ai-sdk/mcp` strips MCP `_meta` before it reaches
  `DynamicToolUIPart`, so UI hints declared by an MCP server do not currently survive
  the AI SDK.

## What we actually built out of this

1. **Ambient app-state context** (`src/lib/copilot-context.ts` +
   `src/components/copilot/copilot-app-context.tsx`) — our `useCopilotReadable`.
   A component declares a fact about the screen; the fact lives in a module registry
   for as long as it is mounted; everything registered is flattened onto the next
   request (`prepareSendMessagesRequest` in `copilot-store.ts`) and lands in the
   system prompt. Mounted once by the copilot panel, which lives in the /app shell, so
   every organizer screen contributes without a per-screen edit: the selected event,
   the current page, and the filters/selection the page keeps in the URL (Sessionboard
   puts every filter in the query string, so this is free). "Decline this one" now
   resolves.

   Two deliberate departures from CopilotKit's version: a **hard budget** (200 chars
   per entry, 1200 per block — unbounded context is a slow, expensive prompt), and the
   prompt states explicitly that the screen is **context, not truth** — the model must
   still read every number, name and status from a tool. A copilot that reads a count
   off a filter chip is the exact failure rule #24 exists to prevent.

2. **The tool-UI registry stays ours** — validated by both libraries as the right
   shape for runtime-discovered tools, with a `toolName`-keyed map, a graceful JSON
   fallback, and an error boundary so a drifted payload costs a card, not the
   conversation.

3. **Nothing installed.** Zero new runtime dependencies from this evaluation.

## Open, if we want them later

- Multi-option approvals ("always allow `list_submissions`") — needs a persistence
  story for the grant.
- LLM-generated contextual suggestions — needs a cheap second model call and a
  debounce; pairs naturally with the readable context above.
- A real thread list (rename / archive / search / branch on edit) — needs conversations
  persisted in Convex rather than held in a module registry.

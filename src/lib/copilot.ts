/**
 * Copilot shared vocabulary — imported by BOTH the server route
 * (src/routes/api/chat.ts) and the chat UI (src/components/copilot/*), so it
 * must stay free of server-only imports.
 *
 * The copilot's tools are not defined here: they are discovered at runtime
 * from our own MCP server (convex/mcp.ts). What lives here is everything both
 * sides have to agree on about those tools — which ones are dangerous enough
 * to require a human "yes", and how to say their names out loud.
 */

/**
 * Default model. Fast and cheap by design — the copilot is a tool-caller, not
 * an essayist, and organizers judge it on latency (docs/memory/RULES.md #3).
 * One const so swapping it is a one-line change.
 */
export const COPILOT_MODEL = "google/gemini-3.5-flash"

/** Where the AI SDK talks to us: our MCP server's Streamable HTTP endpoint. */
export const COPILOT_MCP_PATH = "/mcp"

// ——— Write tools ————————————————————————————————————————————————————————
// docs/memory/RULES.md #24, extended by Marko's full-proxy pass: EVERY write
// — anything that is not a read — needs a human approval, not just the
// destructive tier. The gate itself no longer lives here: the server route
// (src/routes/api/chat.ts) suspends every tool the MCP server does NOT
// annotate `readOnlyHint: true`, and the MCP server refuses every write
// without `confirm: true` besides. What this file keeps is the CARD COPY
// vocabulary: which tools deserve the louder "destroys data" / "sends email"
// framing on their approval card.

/**
 * Tools whose approval card should read as destruction, not mere change.
 * Kept as emphasis only — the approval requirement itself covers all writes.
 */
export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "commit_decision_queue", // emails every speaker in the queue
  "set_submission_status", // stages an accept/decline decision
  "auto_place_sessions", // bulk-rewrites the agenda
  "send_reminders", // emails every speaker with an open task
  "send_test_email", // outbound mail, however harmless
  "send_bulk_email", // one email per recipient in the audience
  "remind_evaluators", // emails evaluators with open reviews
  "update_form_settings", // can close a live CFP
  "unschedule_session", // takes a session off the agenda
])

/** Tools whose approval card should shout "this sends email". */
export const EMAIL_TOOLS: ReadonlySet<string> = new Set([
  "commit_decision_queue",
  "send_reminders",
  "send_test_email",
  "send_bulk_email",
  "remind_evaluators",
  "invite_workspace_member",
])

/**
 * True when a tool's approval card should use the destructive framing. The
 * explicit set is the source of truth; the pattern catches names that speak
 * for themselves so a future `delete_*` reads as dangerous by default.
 */
export function isDestructiveTool(toolName: string): boolean {
  if (DESTRUCTIVE_TOOLS.has(toolName)) return true
  return /(^|_)(delete|remove|destroy|purge|bulk|archive|reset)(_|$)/.test(
    toolName
  )
}

export function sendsEmail(toolName: string): boolean {
  return (
    EMAIL_TOOLS.has(toolName) || /(^|_)(send|email|notify)(_|$)/.test(toolName)
  )
}

// ——— Humanising ————————————————————————————————————————————————————————

/** Words the generic title-caser would mangle. */
const WORD_OVERRIDES: Record<string, string> = {
  cfp: "CFP",
  ics: "ICS",
  id: "ID",
  url: "URL",
  ai: "AI",
}

/** `commit_decision_queue` → "Commit decision queue". */
export function humanizeToolName(toolName: string): string {
  const words = toolName.split(/[_\s]+/).filter(Boolean)
  if (words.length === 0) return toolName
  return words
    .map((word, index) => {
      const override = WORD_OVERRIDES[word.toLowerCase()]
      if (override) return override
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1)
      return word
    })
    .join(" ")
}

/** `event` → "Event", `formId` → "Form id". */
export function humanizeArgName(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export type ArgSummaryEntry = { label: string; value: string }

/**
 * Flattens a tool's input into label/value pairs an organizer can read at a
 * glance on the approval card. Long strings are clipped, objects collapse to
 * compact JSON — the raw payload is always one click away under "Parameters".
 */
export function summarizeToolArgs(input: unknown): Array<ArgSummaryEntry> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input === undefined || input === null
      ? []
      : [{ label: "Input", value: clip(String(input)) }]
  }
  return Object.entries(input as Record<string, unknown>)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
    // `confirm` is the transport-level approval flag the card itself embodies
    // — showing "Confirm: true" next to the Approve button is just noise.
    .filter(([key]) => key !== "confirm")
    .map(([key, value]) => ({
      label: humanizeArgName(key),
      value: clip(
        typeof value === "string"
          ? value
          : typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : JSON.stringify(value)
      ),
    }))
}

function clip(value: string, max = 140): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

// ——— Saved conversations ————————————————————————————————————————————————

/** Longest auto-derived chat title. Mirrors convex/copilotThreads.ts. */
const THREAD_TITLE_MAX = 48

/**
 * A conversation's name, taken from the first thing the organizer said —
 * "Which talks are still pending?" reads better in the rail than "Chat 3",
 * and nobody wants to name a chat before having it.
 *
 * The server derives the same title from the same messages; this copy exists
 * so a brand-new thread arrives in the rail already labelled, without waiting
 * for the round trip (rule 26).
 */
export function copilotThreadTitle(
  messages: Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>
): string {
  const firstUser = messages.find((message) => message.role === "user")
  const text = (firstUser?.parts ?? [])
    .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return "New chat"
  return text.length > THREAD_TITLE_MAX
    ? `${text.slice(0, THREAD_TITLE_MAX - 1)}…`
    : text
}

// ——— Prompt starters ————————————————————————————————————————————————————

/**
 * Shown on the empty state, in the panel and on the full-page chat.
 *
 * Chosen to SHOW THE GENERATIVE UI, not just to be answerable: each one lands
 * on a different rendered result — the stat row and "needs attention" list,
 * the agenda day summary, the speaker roster with its readiness bars, and the
 * end-to-end form card with a copyable public link. The first three are
 * read-only, which is why they are the ones the compact footer row offers as
 * one-tap chips.
 */
export const COPILOT_SUGGESTIONS = [
  "What needs my attention?",
  "Show today's agenda",
  "Who's behind on tasks?",
  "Create an example form",
  "Show my submissions",
] as const

// ——— System prompt ——————————————————————————————————————————————————————

/**
 * The operator brief. Deliberately short: the MCP server already ships rich
 * per-tool descriptions and `instructions` on initialize, and repeating them
 * here would only give the model two sources of truth to disagree with.
 */
export function copilotSystemPrompt(context: {
  eventName?: string
  eventSlug?: string
  userName?: string
  /** Live screen state from src/lib/copilot-context.ts. */
  appContext?: string
  toolNames: Array<string>
}): string {
  const { eventName, eventSlug, userName, appContext, toolNames } = context
  const lines: Array<string> = [
    "You are the Trackstage copilot — the in-app assistant for the organizer running a conference.",
    "",
    "How to behave:",
    "- Prefer tools over guessing. Never state a number, name, status or date you have not read from a tool result in this conversation.",
    "- Be concise and concrete. Short sentences, small markdown tables or bullet lists, no preamble, no restating the question.",
    "- Chain tools freely to answer a question fully; the organizer sees each call, so you do not need to narrate them.",
    "- Never invent ids. Resolve events, submissions and people through the list/get tools first.",
    "- Decisions are two-step by design: set_submission_status stages them, commit_decision_queue is what actually emails speakers. Say which step you are proposing.",
    "- EVERY action that changes anything (creating, editing, deleting, scheduling, emailing) is automatically gated: the app shows the organizer an approval card with the arguments and runs the tool only if they accept. So when they ask for one, CALL THE TOOL — do not ask 'shall I?' in prose first, never pass a `confirm` argument yourself, and never claim you did something you only proposed. Gather what you need to get the arguments right, then call it and say in one line what accepting would do (how many people, which emails go out).",
    "- If the organizer declines an approval, accept it and stop; do not re-issue the same call.",
    "- If a tool fails, read the error, correct the arguments and retry once; otherwise say plainly what went wrong.",
    "- If something is outside Trackstage, say so instead of improvising.",
  ]
  if (userName) lines.push("", `You are talking to ${userName}.`)
  if (eventName) {
    lines.push(
      "",
      `The organizer is currently looking at the event "${eventName}"${
        eventSlug ? ` (slug: ${eventSlug})` : ""
      }. Assume any unqualified question is about this event and pass it as the \`event\` argument. Only ask which event they mean if they clearly mean a different one.`
    )
  } else {
    lines.push(
      "",
      "No event is selected in the UI. Call list_events first and ask which one they mean if it is ambiguous."
    )
  }
  if (appContext) {
    // The "readable context" pattern (docs/reference/copilot-sota.md): the
    // screen is ambient context so "decline this one" resolves, but it is NOT
    // a source of facts — a model that reads a count off a filter chip instead
    // of calling a tool is the exact failure this prompt guards against.
    lines.push(
      "",
      'ON SCREEN RIGHT NOW (what the organizer is looking at — use it to resolve "this", "here", "these", and to pick sensible defaults; it is context, NOT a source of facts, so still read every number, name and status from a tool):',
      appContext
    )
  }
  lines.push("", `Today is ${new Date().toISOString().slice(0, 10)} (UTC).`)
  if (toolNames.length > 0) {
    lines.push("", `Available tools: ${toolNames.join(", ")}.`)
  } else {
    lines.push(
      "",
      "WARNING: no tools are available right now (the Trackstage MCP server could not be reached). Do not pretend to read or change anything — tell the organizer the connection failed."
    )
  }
  return lines.join("\n")
}

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

// ——— Destructive tools ——————————————————————————————————————————————————
// docs/memory/RULES.md #24: "PROPER APPROVAL FLOWS for every destructive MCP
// action". Destructive here means: it emails real people, it decides
// somebody's fate, it rewrites many rows at once, or it takes something away.
// Everything else runs unattended — an approval prompt on `list_submissions`
// would just train organizers to click through the ones that matter.

/** Tools that must never run without an explicit human approval. */
export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "commit_decision_queue", // emails every speaker in the queue
  "set_submission_status", // stages an accept/decline decision
  "auto_place_sessions", // bulk-rewrites the agenda
  "send_reminders", // emails every speaker with an open task
  "send_test_email", // outbound mail, however harmless
  "update_form_settings", // can close a live CFP
  "unschedule_session", // takes a session off the agenda
])

/** Tools whose approval card should shout "this sends email". */
export const EMAIL_TOOLS: ReadonlySet<string> = new Set([
  "commit_decision_queue",
  "send_reminders",
  "send_test_email",
])

/**
 * True when a tool needs a human "yes" first. The explicit set above is the
 * source of truth; the pattern is a safety net so a tool added to the MCP
 * server later — `delete_event`, `bulk_decline` — is dangerous by default
 * rather than dangerous by omission.
 */
export function isDestructiveTool(toolName: string): boolean {
  if (DESTRUCTIVE_TOOLS.has(toolName)) return true
  return /(^|_)(delete|remove|destroy|purge|bulk|archive|reset)(_|$)/.test(
    toolName,
  )
}

export function sendsEmail(toolName: string): boolean {
  return EMAIL_TOOLS.has(toolName) || /(^|_)(send|email|notify)(_|$)/.test(toolName)
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
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      label: humanizeArgName(key),
      value: clip(
        typeof value === "string"
          ? value
          : typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : JSON.stringify(value),
      ),
    }))
}

function clip(value: string, max = 140): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

// ——— Prompt starters ————————————————————————————————————————————————————

/** Shown on the empty state, in the panel and on the full-page chat. */
export const COPILOT_SUGGESTIONS = [
  "What needs my attention?",
  "Summarize my submissions",
  "Who hasn't finished onboarding?",
  "Schedule the unscheduled talks",
  "Which sessions clash?",
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
  toolNames: Array<string>
}): string {
  const { eventName, eventSlug, userName, toolNames } = context
  const lines: Array<string> = [
    "You are the Sessionboard copilot — the in-app assistant for the organizer running a conference.",
    "",
    "How to behave:",
    "- Prefer tools over guessing. Never state a number, name, status or date you have not read from a tool result in this conversation.",
    "- Be concise and concrete. Short sentences, small markdown tables or bullet lists, no preamble, no restating the question.",
    "- Chain tools freely to answer a question fully; the organizer sees each call, so you do not need to narrate them.",
    "- Never invent ids. Resolve events, submissions and people through the list/get tools first.",
    "- Decisions are two-step by design: set_submission_status stages them, commit_decision_queue is what actually emails speakers. Say which step you are proposing.",
    "- Destructive actions (committing queues, staging decisions, sending email, closing forms, bulk agenda edits) are automatically gated: the app shows the organizer an approval card with the arguments and runs the tool only if they accept. So when they ask for one, CALL THE TOOL — do not ask 'shall I?' in prose first, and never claim you did something you only proposed. Gather what you need to get the arguments right, then call it and say in one line what accepting would do (how many people, which emails go out).",
    "- If the organizer declines an approval, accept it and stop; do not re-issue the same call.",
    "- If a tool fails, read the error, correct the arguments and retry once; otherwise say plainly what went wrong.",
    "- If something is outside Sessionboard, say so instead of improvising.",
  ]
  if (userName) lines.push("", `You are talking to ${userName}.`)
  if (eventName) {
    lines.push(
      "",
      `The organizer is currently looking at the event "${eventName}"${
        eventSlug ? ` (slug: ${eventSlug})` : ""
      }. Assume any unqualified question is about this event and pass it as the \`event\` argument. Only ask which event they mean if they clearly mean a different one.`,
    )
  } else {
    lines.push(
      "",
      "No event is selected in the UI. Call list_events first and ask which one they mean if it is ambiguous.",
    )
  }
  lines.push("", `Today is ${new Date().toISOString().slice(0, 10)} (UTC).`)
  if (toolNames.length > 0) {
    lines.push("", `Available tools: ${toolNames.join(", ")}.`)
  } else {
    lines.push(
      "",
      "WARNING: no tools are available right now (the Sessionboard MCP server could not be reached). Do not pretend to read or change anything — tell the organizer the connection failed.",
    )
  }
  return lines.join("\n")
}

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
 * A bare machine identifier — a Convex document id, a token. 20+ unbroken
 * alphanumerics is nothing a human typed or wants to read; slugs keep their
 * dashes and emails their @, so both pass.
 */
function looksLikeId(value: string): boolean {
  return /^[A-Za-z0-9]{20,}$/.test(value)
}

/**
 * One value, said out loud — or null when there is no human way to say it
 * (raw ids, opaque blobs). Objects flatten to their scalar fields, arrays of
 * scalars to a comma list; nothing ever comes back as JSON.
 */
function humanizeArgValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "string") {
    return looksLikeId(value) ? null : clip(value)
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    const scalars = value
      .filter(
        (entry): entry is string | number =>
          typeof entry === "string" || typeof entry === "number"
      )
      .map(String)
      .filter((entry) => !looksLikeId(entry))
    if (scalars.length > 0 && scalars.length === value.length) {
      return clip(scalars.join(", "))
    }
    return `${value.length} ${value.length === 1 ? "entry" : "entries"}`
  }
  const parts = Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => {
      const said =
        typeof entry === "string" && !looksLikeId(entry)
          ? entry
          : typeof entry === "number" || typeof entry === "boolean"
            ? String(entry)
            : null
      return said === null ? null : `${humanizeArgName(key)}: ${said}`
    })
    .filter((part): part is string => part !== null)
  if (parts.length > 0) return clip(parts.join(", "))
  const keys = Object.keys(value)
  return keys.length > 0 ? `${keys.length} fields` : null
}

/**
 * Flattens a tool's input into label/value pairs an organizer can read at a
 * glance on the approval card. Strictly humanised: long strings are clipped,
 * objects flatten to their readable fields, and anything with no human form —
 * raw ids above all — is dropped rather than dumped (Marko, 2026-08-11: no
 * JSON, no ids, anywhere in the chat).
 */
export function summarizeToolArgs(input: unknown): Array<ArgSummaryEntry> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    const value = humanizeArgValue(input)
    return value === null ? [] : [{ label: "Input", value }]
  }
  return Object.entries(input as Record<string, unknown>)
    // `confirm` is the transport-level approval flag the card itself embodies
    // — showing "Confirm: true" next to the Approve button is just noise.
    .filter(([key]) => key !== "confirm")
    .map(([key, value]) => {
      const said = humanizeArgValue(value)
      return said === null
        ? null
        : { label: humanizeArgName(key), value: said }
    })
    .filter((entry): entry is ArgSummaryEntry => entry !== null)
}

/** Result keys worth quoting in a tool card's header, best first. */
const RESULT_TITLE_KEYS = [
  "title",
  "name",
  "full_name",
  "fullName",
  "headline",
  "subject",
  "filename",
  "email",
] as const

/**
 * The one-liner next to the tool name in the card header — `Get submission ·
 * "Taming 40-Minute CI…"`. Derived from the RESULT, so it is a fact, not an
 * echo of the model's arguments; never an id, and null when the payload has
 * nothing a human would recognise (in which case the header shows nothing
 * extra).
 */
export function summarizeToolResult(output: unknown): string | null {
  if (output === null || typeof output !== "object" || Array.isArray(output)) {
    return null
  }
  const record = output as Record<string, unknown>
  // The apiV1-backed tools answer in a `{ data }` envelope; look inside it.
  const data = record.data
  const scopes: Array<Record<string, unknown>> = [record]
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    scopes.push(data as Record<string, unknown>)
  }
  for (const scope of scopes) {
    for (const key of RESULT_TITLE_KEYS) {
      const value = scope[key]
      if (
        typeof value === "string" &&
        value.length > 0 &&
        !looksLikeId(value)
      ) {
        return clip(value, 60)
      }
    }
  }
  // Lists: say how many came back, in the payload's own words ("12
  // submissions"), preferring the server's total over the page we got.
  for (const scope of scopes.slice().reverse()) {
    for (const [key, value] of Object.entries(scope)) {
      if (!Array.isArray(value) || key === "results") continue
      const total =
        typeof record.total === "number" ? record.total : value.length
      const base =
        key === "data" ? "results" : humanizeArgName(key).toLowerCase()
      const noun =
        total === 1 && base.endsWith("s") ? base.slice(0, -1) : base
      return `${total} ${noun}`
    }
  }
  return null
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

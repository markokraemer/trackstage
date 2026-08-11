#!/usr/bin/env node
// Extract every RAW user prompt from a Claude Code session transcript into
// docs/memory/PROMPTS.md — the deterministic repro corpus (rule: git repo is
// the source of truth; these prompts can be replayed adversarially against
// another agent/session).
//
// Usage:
//   node scripts/extract-prompts.mjs                  # all sessions in docs/memory/SESSIONS.md
//   node scripts/extract-prompts.mjs <session-jsonl>  # one transcript explicitly
//
// Claude Code transcripts live at:
//   ~/.claude/projects/<sanitized-cwd>/<session-id>.jsonl
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SESSIONS_FILE = resolve(root, "docs/memory/SESSIONS.md")
const OUT_FILE = resolve(root, "docs/memory/PROMPTS.md")

/** Pull the plain-text pieces out of one transcript entry's message content. */
function textOf(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
}

/** Strip injected non-human blocks, keep what the human actually typed. */
function cleanPrompt(raw) {
  let text = raw
  // Injected context/reminders inside user-role messages.
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
  text = text.replace(/<ip_reminder>[\s\S]*?<\/ip_reminder>/g, "")
  return text.trim()
}

/** True for entries that are events, not typed human prompts. */
function isNonHuman(text) {
  if (!text) return true
  if (text.includes("[SYSTEM NOTIFICATION")) return true
  if (text.includes("<task-notification>")) return true
  if (text.includes("<local-command-caveat>")) return true
  if (text.startsWith("<command-name>")) return true
  if (text.startsWith("Stop hook feedback:")) return true
  if (/^\[Request interrupted by user[^\]]*\]$/.test(text)) return true
  return false
}

function extractSession(jsonlPath) {
  const prompts = []
  for (const line of readFileSync(jsonlPath, "utf8").split("\n")) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry.type !== "user" || entry.isMeta) continue
    const message = entry.message
    if (!message || message.role !== "user") continue
    // Tool results are user-role but machine-generated.
    if (
      Array.isArray(message.content) &&
      message.content.some((part) => part?.type === "tool_result")
    ) {
      continue
    }
    const text = cleanPrompt(textOf(message.content))
    if (isNonHuman(text)) continue
    prompts.push({ text, timestamp: entry.timestamp })
  }
  return prompts
}

function sessionsFromRegistry() {
  if (!existsSync(SESSIONS_FILE)) return []
  const rows = []
  for (const line of readFileSync(SESSIONS_FILE, "utf8").split("\n")) {
    // Registry rows: `- <tool> · <session-id> · <transcript-path> · <note>`
    const match = line.match(/^- (\S+) · (\S+) · (\S+)(?: · (.*))?$/)
    if (match) {
      rows.push({
        tool: match[1],
        id: match[2],
        path: match[3].replace(/^~/, homedir()),
        note: match[4] ?? "",
      })
    }
  }
  return rows
}

const explicit = process.argv[2]
const sessions = explicit
  ? [{ tool: "explicit", id: explicit, path: resolve(explicit), note: "" }]
  : sessionsFromRegistry()

if (sessions.length === 0) {
  console.error("No sessions found — add rows to docs/memory/SESSIONS.md first.")
  process.exit(1)
}

let out = `# Raw prompts — every user message, verbatim, in order

Regenerate anytime: \`node scripts/extract-prompts.mjs\` (reads docs/memory/SESSIONS.md).
These are the raw inputs that produced this repo — replayable against any other
agent session for adversarial comparison.
`

let total = 0
for (const session of sessions) {
  if (!existsSync(session.path)) {
    console.error(`skip (missing): ${session.path}`)
    continue
  }
  const prompts = extractSession(session.path)
  total += prompts.length
  out += `\n## ${session.tool} session \`${session.id}\`${session.note ? ` — ${session.note}` : ""}\n`
  out += `${prompts.length} prompts.\n`
  prompts.forEach((prompt, index) => {
    const stamp = prompt.timestamp ? ` <sub>${prompt.timestamp}</sub>` : ""
    out += `\n---\n\n### ${index + 1}${stamp}\n\n${prompt.text}\n`
  })
  console.log(`${session.id}: ${prompts.length} prompts`)
}

writeFileSync(OUT_FILE, out)
console.log(`→ ${OUT_FILE} (${total} prompts total)`)

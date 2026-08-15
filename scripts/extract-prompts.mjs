#!/usr/bin/env node
// ============================================================================
// PROMPTS.md — every raw human prompt that built this repo, in one document.
//
//   pnpm prompts          regenerate + commit/push if it changed   ← the command
//   pnpm prompts:regen    regenerate, no git
//   pnpm prompts:check    no-write drift check (exit 1 if stale)   ← CI-shaped
//   node scripts/extract-prompts.mjs --only <session-id>
//   node scripts/extract-prompts.mjs --audit-history
//
// It DISCOVERS its own inputs from the repo it lives in — no session ids, no
// absolute paths, nothing to hand-maintain. Point it at another repo tomorrow
// and it works there instead:
//
//   • Claude Code — ~/.claude/projects/<dir>/*.jsonl for every <dir> whose
//     sanitized name embeds this repo's path: the project dir itself, any
//     `-<repo>-<worktree-suffix>` dir, and scratchpad dirs nested under it.
//   • Codex — ~/.codex/sessions/**/rollout-*.jsonl whose session_meta.cwd is
//     this repo or a worktree of it. Prefers a sibling-produced
//     docs/memory/.codex-prompts.json, then scripts/lib/codex-prompts.mjs,
//     then its own built-in scanner.
//
// Both docs/memory/PROMPTS.md and docs/memory/SESSIONS.md are GENERATED here.
// Transcripts are opened read-only and never modified.
//
// Cheap to re-run: per-file byte-offset cache in .cache/prompts-cache.json, so
// the 30MB live transcript is only ever parsed forward from where we stopped.
// Deterministic: same inputs → byte-identical output. Safe mid-session: the
// live file is being appended to as we read, so a trailing partial line is left
// unconsumed rather than parsed into a garbage prompt.
//
// Sanitation is a gate, not a nicety: every prompt is redacted on the way in,
// and the FINAL rendered file is re-scanned. One surviving credential shape and
// the run refuses to write and exits non-zero.
// ============================================================================
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { basename, dirname, join, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
// ONE sanitation implementation for the whole pipeline. It lives in the Codex
// reader because that module needed it first; importing it here (rather than
// re-deriving the patterns) is what keeps a key from escaping through a rule
// that only one of the two copies learned about.
import { createHash } from "node:crypto"
import { ENTROPY_RULE, REDACTION, redactSecrets, scanForSecrets, tildePath } from "./lib/codex-prompts.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PROMPTS_FILE = resolve(root, "docs/memory/PROMPTS.md")
const SESSIONS_FILE = resolve(root, "docs/memory/SESSIONS.md")
const OVERRIDES_FILE = resolve(root, "docs/memory/sessions.overrides.json")
const CODEX_JSON = resolve(root, "docs/memory/.codex-prompts.json")
const CODEX_MODULE = resolve(root, "scripts/lib/codex-prompts.mjs")
const CACHE_FILE = resolve(root, ".cache/prompts-cache.json")

// Bump whenever extraction/redaction logic changes — invalidates every cache
// entry so a rule change can never be masked by a stale one.
const CACHE_VERSION = 6

const argv = process.argv.slice(2)
const flags = {
  check: argv.includes("--check"),
  commit: argv.includes("--commit"),
  auditHistory: argv.includes("--audit-history"),
  noCache: argv.includes("--no-cache"),
  only: argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null,
}

// ————————————————————————————————————————————————————————————————————————————
// Sanitation
// ————————————————————————————————————————————————————————————————————————————

/**
 * Redact, and tally WHAT was redacted (by rule name, never the value) so the
 * run can report "3 anthropic keys, 1 airtable PAT" without printing any of it.
 */
function redact(text, tally) {
  for (const finding of scanForSecrets(text)) {
    if (finding.severity !== "secret") continue
    tally[finding.rule] = (tally[finding.rule] ?? 0) + finding.count
  }
  return redactSecrets(text)
}

/**
 * High-entropy runs the entropy backstop flags. Each one here has been read in
 * the raw transcript and is NOT a credential; the digest is of the run itself,
 * so a genuinely new opaque string can never inherit an old approval — it comes
 * back as an unreviewed finding and the run refuses to write.
 */
const REVIEWED_ENTROPY = new Map([
  // A Convex document id pasted out of the task-template drawer, not a secret —
  // it identifies a seeded demo row and grants nothing. (Session 83a5b5a1.)
  ["3163a2389dee", "32ch convex document id from the task drawer"],
])

const digest = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12)

/** Every high-entropy run in the rendered output, with its review status. */
function entropyReview(text) {
  const runs = [...new Set((text.match(ENTROPY_RULE.re) ?? []).filter((run) => !run.includes(REDACTION)))]
  return runs.map((run) => ({
    digest: digest(run),
    length: run.length,
    hint: `${run.slice(0, 4)}…${run.slice(-2)}`,
    reviewed: REVIEWED_ENTROPY.get(digest(run)) ?? null,
  }))
}

// ————————————————————————————————————————————————————————————————————————————
// Discovery
// ————————————————————————————————————————————————————————————————————————————

/** Claude Code's project-dir naming: every `/` and `.` becomes `-`. */
function sanitizeCwd(path) {
  return path.replace(/[/.]/g, "-")
}

/**
 * Every Claude Code project dir that belongs to this repo — the repo's own,
 * any git worktree spun off it (`…-sessionboard-adversarial-e2e-…`), and any
 * scratchpad dir nested beneath it. All three are "work on this project".
 */
function discoverClaudeDirs() {
  const base = join(homedir(), ".claude", "projects")
  if (!existsSync(base)) return []
  const needle = sanitizeCwd(root)
  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes(needle))
    .map((entry) => join(base, entry.name))
    .sort()
}

function discoverClaudeTranscripts() {
  /** @type {{tool: "claude-code", id: string, path: string, dir: string}[]} */
  const found = []
  for (const dir of discoverClaudeDirs()) {
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".jsonl")) continue
      found.push({ tool: "claude-code", id: name.replace(/\.jsonl$/, ""), path: join(dir, name), dir })
    }
  }
  return found
}

/** Built-in Codex fallback: rollouts whose session_meta.cwd is this repo. */
function discoverCodexTranscripts() {
  const base = join(homedir(), ".codex", "sessions")
  if (!existsSync(base)) return []
  /** @type {string[]} */
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) files.push(path)
    }
  }
  walk(base)
  /** @type {{tool: "codex", id: string, path: string, dir: string}[]} */
  const found = []
  for (const path of files.sort()) {
    // session_meta is always the first line — read a slice, not the file.
    const head = readFirstLine(path)
    if (!head) continue
    let entry
    try {
      entry = JSON.parse(head)
    } catch {
      continue
    }
    const cwd = entry?.payload?.cwd
    if (typeof cwd !== "string") continue
    if (cwd !== root && !cwd.startsWith(root + sep) && !isWorktreeOfRepo(cwd)) continue
    found.push({ tool: "codex", id: entry.payload.session_id ?? basename(path), path, dir: dirname(path) })
  }
  return found
}

/** Byte size of a transcript, accepting the `~/…` form the handoff files use. */
function sizeOf(path) {
  if (!path) return 0
  const absolute = path.startsWith("~") ? join(homedir(), path.slice(1)) : path
  return existsSync(absolute) ? statSync(absolute).size : 0
}

/** `…/sessionboard-adversarial-e2e-20260811` is a worktree of `…/sessionboard`. */
function isWorktreeOfRepo(cwd) {
  return cwd.startsWith(root + "-")
}

/** session_meta is line 1 of a rollout; 64KB is plenty and beats a 60MB read. */
function readFirstLine(path) {
  const head = readHead(path, 65536).toString("utf8")
  const end = head.indexOf("\n")
  return end === -1 ? head : head.slice(0, end)
}

// ————————————————————————————————————————————————————————————————————————————
// Streaming transcript reader
// ————————————————————————————————————————————————————————————————————————————

/**
 * Stream complete newline-terminated lines from `start`, and report the byte
 * offset after the last COMPLETE line. A partial trailing line (the live
 * session mid-write) is left for the next run rather than parsed.
 * @returns {Promise<{lines: string[], offset: number, truncated: boolean}>}
 */
async function readLinesFrom(path, start) {
  return new Promise((done, fail) => {
    const stream = createReadStream(path, { start })
    /** @type {string[]} */
    const lines = []
    let pending = Buffer.alloc(0)
    let offset = start
    stream.on("data", (chunk) => {
      pending = Buffer.concat([pending, /** @type {Buffer} */ (chunk)])
      let cut
      while ((cut = pending.indexOf(0x0a)) !== -1) {
        lines.push(pending.subarray(0, cut).toString("utf8"))
        offset += cut + 1
        pending = pending.subarray(cut + 1)
      }
    })
    stream.on("error", fail)
    stream.on("end", () => done({ lines, offset, truncated: pending.length > 0 }))
  })
}

// ————————————————————————————————————————————————————————————————————————————
// Claude Code: what counts as a human turn
// ————————————————————————————————————————————————————————————————————————————

/**
 * Machine-authored `promptSource` values. `typed` and `queued` are Marko at the
 * keyboard (queued = typed while the agent was mid-turn — real input, just
 * delivered late). `sdk` is a programmatic `claude -p` launch by another agent;
 * `system` is a hook / task-notification / background-monitor event.
 */
const NON_HUMAN_SOURCES = new Set(["sdk", "system"])

/** Ordered exclusion reasons — the run prints this as a histogram. */
const REASONS = [
  "sidechain", // subagent transcripts inlined into the parent file
  "tool-result", // user-role, but it's a tool's output
  "meta", // isMeta: slash-command bodies, image-source notes, caveats
  "sdk-launched", // programmatic agent-to-agent prompt
  "system-event", // task notifications, hooks, monitor events
  "loop-wakeup", // machine-scheduled /loop re-entry (appendix, not corpus)
  "slash-command", // /model, /login, /mcp … wrappers and their stdout
  "compaction-summary", // "This session is being continued from…"
  "interrupt", // "[Request interrupted by user]"
  "empty", // nothing left once reminders were stripped
  "duplicate", // same turn replayed by a resumed/compacted session
]

function textOf(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
}

function hasImage(content) {
  return Array.isArray(content) && content.some((part) => part?.type === "image")
}

/** Strip injected context; keep only what a human typed. */
function stripInjections(raw) {
  return raw
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<ip_reminder>[\s\S]*?<\/ip_reminder>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .trim()
}

/**
 * Classify one transcript entry.
 * @returns {{reason: string} | {prompt: {ts: string, text: string, image: boolean, uuid: string}}}
 */
function classifyClaudeEntry(entry) {
  if (entry.isSidechain) return { reason: "sidechain" }
  const message = entry.message
  if (!message || message.role !== "user") return { reason: "empty" }
  if (Array.isArray(message.content) && message.content.some((part) => part?.type === "tool_result")) {
    return { reason: "tool-result" }
  }
  const raw = textOf(message.content)
  if (raw.includes("<command-name>/loop</command-name>")) return { reason: "loop-wakeup" }
  if (entry.isMeta) return { reason: "meta" }
  if (NON_HUMAN_SOURCES.has(entry.promptSource)) {
    return { reason: entry.promptSource === "sdk" ? "sdk-launched" : "system-event" }
  }
  if (/<command-name>|<command-message>|<local-command-stdout>|<local-command-caveat>/.test(raw)) {
    return { reason: "slash-command" }
  }
  if (raw.startsWith("This session is being continued from a previous conversation")) {
    return { reason: "compaction-summary" }
  }
  if (/^\[Request interrupted by user[^\]]*\]$/.test(raw.trim())) return { reason: "interrupt" }
  if (raw.includes("<task-notification>") || raw.includes("[SYSTEM NOTIFICATION")) return { reason: "system-event" }
  if (raw.startsWith("Stop hook feedback:")) return { reason: "system-event" }
  const text = stripInjections(raw)
  if (!text) return { reason: "empty" }
  return {
    prompt: {
      ts: entry.timestamp ?? "",
      text,
      image: hasImage(message.content),
      uuid: entry.uuid ?? "",
    },
  }
}

/**
 * Parse the lines of a Claude Code transcript into prompts + session metadata.
 * Called on the whole file the first time and on the appended tail after that.
 */
function parseClaudeLines(lines, acc) {
  for (const line of lines) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      acc.badLines += 1
      continue
    }
    acc.lines += 1
    if (typeof entry.cwd === "string") acc.cwd = entry.cwd
    if (typeof entry.gitBranch === "string") acc.gitBranch = entry.gitBranch
    if (typeof entry.version === "string") acc.versions[entry.version] = (acc.versions[entry.version] ?? 0) + 1
    if (entry.type === "assistant" && typeof entry.message?.model === "string" && entry.message.model !== "<synthetic>") {
      acc.models[entry.message.model] = (acc.models[entry.message.model] ?? 0) + 1
    }
    if (entry.type === "ai-title" && typeof entry.aiTitle === "string") acc.title = entry.aiTitle
    if (entry.type !== "user") {
      if (entry.type === "assistant" && entry.timestamp) acc.activity.push(entry.timestamp)
      continue
    }
    if (entry.timestamp) acc.activity.push(entry.timestamp)
    const verdict = classifyClaudeEntry(entry)
    if ("reason" in verdict) {
      acc.reasons[verdict.reason] = (acc.reasons[verdict.reason] ?? 0) + 1
      if (verdict.reason === "loop-wakeup") {
        acc.loopWakeups.push({
          ts: entry.timestamp ?? "",
          text: redact(textOf(entry.message?.content) ?? "", acc.redactions),
        })
      }
      if (verdict.reason === "compaction-summary") acc.compactions += 1
      continue
    }
    verdict.prompt.text = redact(verdict.prompt.text, acc.redactions)
    acc.prompts.push(verdict.prompt)
  }
  return acc
}

function emptyAccumulator() {
  return {
    lines: 0,
    badLines: 0,
    prompts: /** @type {{ts: string, text: string, image: boolean, uuid: string}[]} */ ([]),
    loopWakeups: /** @type {{ts: string, text: string}[]} */ ([]),
    reasons: /** @type {Record<string, number>} */ ({}),
    redactions: /** @type {Record<string, number>} */ ({}),
    compactions: 0,
    activity: /** @type {string[]} */ ([]),
    cwd: "",
    gitBranch: "",
    models: /** @type {Record<string, number>} */ ({}),
    versions: /** @type {Record<string, number>} */ ({}),
    title: "",
  }
}

/** Activity timestamps are only kept as a min/max window — never the full list. */
function foldActivity(acc) {
  const stamps = acc.activity.filter(Boolean).sort()
  const summary = { ...acc, first: stamps[0] ?? "", last: stamps[stamps.length - 1] ?? "" }
  delete summary.activity
  return summary
}

// ————————————————————————————————————————————————————————————————————————————
// Cache (byte-offset incremental; transcripts are append-only)
// ————————————————————————————————————————————————————————————————————————————

function loadCache() {
  if (flags.noCache || !existsSync(CACHE_FILE)) return { version: CACHE_VERSION, files: {} }
  try {
    const cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"))
    return cache.version === CACHE_VERSION ? cache : { version: CACHE_VERSION, files: {} }
  } catch {
    return { version: CACHE_VERSION, files: {} }
  }
}

function saveCache(cache) {
  if (flags.noCache) return
  mkdirSync(dirname(CACHE_FILE), { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(cache))
}

/** Read the first `bytes` bytes of a file without loading the rest of it. */
function readHead(path, bytes) {
  const buffer = Buffer.alloc(bytes)
  const handle = openSync(path, "r")
  try {
    const read = readSync(handle, buffer, 0, bytes, 0)
    return buffer.subarray(0, read)
  } finally {
    closeSync(handle)
  }
}

/**
 * Cheap identity check that a file was appended to rather than rewritten — the
 * precondition for resuming from a cached byte offset.
 */
function headFingerprint(path) {
  const head = readHead(path, 2048)
  return `${head.length}:${head.toString("base64").slice(0, 64)}`
}

async function extractClaudeSession(file, cache) {
  const stats = statSync(file.path)
  const fingerprint = headFingerprint(file.path)
  const cached = cache.files[file.path]
  let acc
  let start = 0
  if (cached && cached.fingerprint === fingerprint && cached.offset <= stats.size) {
    acc = { ...emptyAccumulator(), ...cached.acc, activity: [] }
    acc.activity = cached.window ? [cached.window.first, cached.window.last].filter(Boolean) : []
    start = cached.offset
    if (start === stats.size) {
      return { ...file, ...foldActivity(acc), size: stats.size, reused: true }
    }
  } else {
    acc = emptyAccumulator()
  }
  const { lines, offset, truncated } = await readLinesFrom(file.path, start)
  parseClaudeLines(lines, acc)
  const folded = foldActivity(acc)
  cache.files[file.path] = {
    fingerprint,
    offset,
    truncated,
    window: { first: folded.first, last: folded.last },
    acc: {
      lines: acc.lines,
      badLines: acc.badLines,
      prompts: acc.prompts,
      loopWakeups: acc.loopWakeups,
      reasons: acc.reasons,
      redactions: acc.redactions,
      compactions: acc.compactions,
      cwd: acc.cwd,
      gitBranch: acc.gitBranch,
      models: acc.models,
      versions: acc.versions,
      title: acc.title,
    },
  }
  return { ...file, ...folded, size: stats.size, truncated, reused: false }
}

// ————————————————————————————————————————————————————————————————————————————
// Codex
// ————————————————————————————————————————————————————————————————————————————

const CODEX_NON_HUMAN = [
  /^# AGENTS\.md instructions/,
  /^<environment_context>/,
  /^<codex_internal_context/,
  /^<user_instructions>/,
  /^<INSTRUCTIONS>/,
  /^## My request for Codex:/,
]

/** Built-in Codex parser — used only when the sibling handoff isn't present. */
async function extractCodexSession(file) {
  const acc = emptyAccumulator()
  const { lines } = await readLinesFrom(file.path, 0)
  for (const line of lines) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      acc.badLines += 1
      continue
    }
    acc.lines += 1
    if (entry.type === "session_meta") acc.cwd = entry.payload?.cwd ?? ""
    if (entry.timestamp) acc.activity.push(entry.timestamp)
    if (entry.type !== "response_item") continue
    const payload = entry.payload
    if (payload?.type !== "message" || payload.role !== "user") continue
    const raw = (payload.content ?? [])
      .filter((part) => typeof part?.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim()
    if (!raw) {
      acc.reasons.empty = (acc.reasons.empty ?? 0) + 1
      continue
    }
    if (CODEX_NON_HUMAN.some((pattern) => pattern.test(raw))) {
      acc.reasons["system-event"] = (acc.reasons["system-event"] ?? 0) + 1
      continue
    }
    acc.prompts.push({
      ts: entry.timestamp ?? "",
      text: redact(stripInjections(raw), acc.redactions),
      image: (payload.content ?? []).some((part) => part?.type === "input_image"),
      uuid: "",
    })
  }
  return { ...file, ...foldActivity(acc), size: statSync(file.path).size, reused: false }
}

/**
 * The Codex corpus, preferring the sibling agent's handoff.
 * @returns {Promise<{sessions: any[], source: string}>}
 */
async function loadCodexSessions() {
  if (existsSync(CODEX_JSON)) {
    try {
      const payload = JSON.parse(readFileSync(CODEX_JSON, "utf8"))
      const codexRedactions = /** @type {Record<string, number>} */ ({})
      const sessions = (payload.sessions ?? []).map((session) => ({
        tool: session.tool ?? "codex",
        id: session.sessionId ?? session.id,
        path: session.path ?? "",
        dir: dirname(session.path ?? ""),
        cwd: session.cwd ?? "",
        note: session.note ?? "",
        first: session.startedAt ?? "",
        last: session.endedAt ?? "",
        title: session.note ?? "",
        gitBranch: session.gitBranch ?? "",
        models: session.model ? { [session.model]: 1 } : {},
        versions: session.cliVersion ? { [session.cliVersion]: 1 } : {},
        originator: session.originator ?? "",
        lines: session.lines ?? 0,
        badLines: 0,
        compactions: session.compactions ?? 0,
        reasons: session.reasons ?? {},
        redactions: codexRedactions,
        loopWakeups: [],
        size: sizeOf(session.path),
        prompts: (session.prompts ?? []).map((prompt) => ({
          ts: prompt.ts ?? "",
          text: redact(String(prompt.text ?? ""), codexRedactions),
          image: Boolean(prompt.image),
          uuid: "",
        })),
      }))
      return { sessions, source: "docs/memory/.codex-prompts.json" }
    } catch (error) {
      console.warn(`codex handoff unreadable (${error.message}) — falling back to the built-in scanner`)
    }
  }
  if (existsSync(CODEX_MODULE)) {
    try {
      const module = await import(CODEX_MODULE)
      const collect = module.collectCodexSessions ?? module.default
      if (typeof collect === "function") {
        const sessions = await collect({ repoRoot: root })
        if (Array.isArray(sessions) && sessions.length > 0) {
          return { sessions, source: "scripts/lib/codex-prompts.mjs" }
        }
      }
    } catch (error) {
      console.warn(`codex module failed (${error.message}) — falling back to the built-in scanner`)
    }
  }
  const sessions = []
  for (const file of discoverCodexTranscripts()) sessions.push(await extractCodexSession(file))
  return { sessions, source: "built-in scanner (~/.codex/sessions)" }
}

// ————————————————————————————————————————————————————————————————————————————
// Assemble
// ————————————————————————————————————————————————————————————————————————————

function normalizeForDedupe(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase()
}

function loadOverrides() {
  if (!existsSync(OVERRIDES_FILE)) return { exclude: [], notes: {} }
  try {
    const parsed = JSON.parse(readFileSync(OVERRIDES_FILE, "utf8"))
    return { exclude: parsed.exclude ?? [], notes: parsed.notes ?? {} }
  } catch {
    return { exclude: [], notes: {} }
  }
}

/** The prompt's own instant, full precision, never truncated. */
function iso(ts) {
  return ts || "—"
}

/** Marko's wall clock. Labelled, because a bare local time is unfalsifiable. */
const LOCAL_ZONE = "Europe/Belgrade"
const localFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LOCAL_ZONE,
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: false,
})
function local(ts) {
  if (!ts) return "—"
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? "—" : localFormatter.format(date)
}

/** Compact UTC for tables, where full precision would drown the row. */
function short(ts) {
  return ts ? ts.replace("T", " ").replace(/\.\d+Z$/, "Z") : "—"
}

function shortId(id) {
  return String(id).slice(0, 8)
}

/** "4h 12m" — the gaps between prompts are part of the story. */
function duration(fromTs, toTs) {
  const from = Date.parse(fromTs)
  const to = Date.parse(toTs)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return ""
  const minutes = Math.round((to - from) / 60000)
  if (minutes < 1) return "<1m"
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  return [days && `${days}d`, hours && `${hours}h`, mins && `${mins}m`].filter(Boolean).join(" ")
}

/** Models actually served, busiest first — measured from the transcript. */
function modelList(session) {
  return Object.entries(session.models ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
}

function modelLabel(session) {
  const models = modelList(session)
  return models.length ? models.join(" + ") : "—"
}

function versionLabel(session) {
  const versions = Object.entries(session.versions ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
  return versions.length ? versions.join(", ") : "—"
}

// ————————————————————————————————————————————————————————————————————————————
// Render
// ————————————————————————————————————————————————————————————————————————————

/** The window Marko was actually in the session, i.e. first → last kept prompt. */
function promptWindow(session) {
  const stamps = session.prompts.map((prompt) => prompt.ts).filter(Boolean).sort()
  return { first: stamps[0] ?? session.first, last: stamps[stamps.length - 1] ?? session.last }
}

function renderPrompts(sessions, stats, codexSource) {
  const withPrompts = sessions.filter((session) => session.prompts.length > 0)
  const agentOnly = sessions.filter((session) => session.prompts.length === 0)
  const byTool = (tool) => withPrompts.filter((session) => session.tool === tool)
  const promptsOf = (tool) => byTool(tool).reduce((n, session) => n + session.prompts.length, 0)

  const out = []
  out.push("# Raw prompts — every human input that built Trackstage, verbatim")
  out.push("")
  out.push(
    `**${stats.total} human prompts**, across **${withPrompts.length} sessions** on **2 coding agents** ` +
      `(Claude Code — ${byTool("claude-code").length} sessions, ${promptsOf("claude-code")} prompts; ` +
      `Codex — ${byTool("codex").length} session, ${promptsOf("codex")} prompts), ` +
      `spanning **${duration(stats.first, stats.last)}** from ` +
      `\`${iso(stats.first)}\` to \`${iso(stats.last)}\`.`
  )
  out.push("")
  out.push(`All timestamps are full-precision UTC as recorded by the agent; local times are ${LOCAL_ZONE}.`)
  out.push("")
  out.push("> **Regenerating this file:** `pnpm prompts`. It discovers every Claude Code and Codex")
  out.push("> session belonging to this repo on its own — no ids to register, no paths to edit — then")
  out.push("> rewrites this file and `SESSIONS.md`, refuses to write if any credential survived")
  out.push("> redaction, and commits + pushes only when the content actually changed.")
  out.push("> `pnpm prompts:check` is the no-write drift check.")
  out.push("")
  out.push("## Sessions at a glance")
  out.push("")
  out.push("| # | Session | Agent | Model | CLI | Prompt window (UTC) | Span | Prompts | What it was |")
  out.push("| ---: | --- | --- | --- | --- | --- | --- | ---: | --- |")
  withPrompts.forEach((session, index) => {
    const window = promptWindow(session)
    out.push(
      `| ${index + 1} | \`${shortId(session.id)}\` | ${session.tool} | ${modelLabel(session)} | ` +
        `${versionLabel(session)} | ${short(window.first)} → ${short(window.last)} | ` +
        `${duration(window.first, window.last) || "—"} | ${session.prompts.length} | ${session.note} |`
    )
  })
  out.push(`| | | | | | | | **${stats.total}** | **grand total** |`)
  out.push("")
  if (agentOnly.length > 0) {
    out.push(
      `Plus **${agentOnly.length} agent-only sessions** with zero human turns (full inventory in ` +
        "`SESSIONS.md`). They are real work on this repo — worktree audits, MCP smoke runs — but every " +
        "prompt in them was written by another agent, so none belong in a corpus of Marko's inputs."
    )
    out.push("")
  }
  out.push("---")
  out.push("")
  out.push("## How this was extracted")
  out.push("")
  out.push(
    "Agent transcripts are mostly *not* the human. A session file interleaves the operator's typed " +
      "messages with tool results, hook output, background-task notifications, subagent transcripts, " +
      "scheduled wake-ups and compaction replays — all of them carrying `role: \"user\"`. This corpus " +
      "keeps only turns a person actually typed. Every other entry is dropped for a named reason, and " +
      "the counts are published below so the number is auditable rather than asserted."
  )
  out.push("")
  out.push("**Kept:** Claude Code entries with `promptSource` `typed` (typed at the prompt) or `queued`")
  out.push("(typed while the agent was mid-turn and delivered at the turn boundary — real input, just")
  out.push("late). Codex: `response_item` messages with `role: \"user\"` that aren't injected context —")
  out.push("cross-checked against the harness's own `item_completed/UserMessage` count.")
  out.push("")
  out.push("**Dropped, and why:**")
  out.push("")
  out.push("| Reason | Dropped | Why it isn't a human prompt |")
  out.push("| --- | ---: | --- |")
  const why = {
    "tool-result": "`role: \"user\"` carrying a tool's output back to the model",
    "system-event": "task-completion notifications, hook feedback, background monitor events",
    meta: "`isMeta` — slash-command bodies, image-source paths, local-command caveats",
    "sdk-launched": "prompts written by another **agent** launching `claude -p` programmatically",
    "slash-command": "`/model`, `/login`, `/mcp` … wrappers and their stdout",
    duplicate: "the same turn replayed into a resumed or compacted session (deduped on entry uuid)",
    "loop-wakeup": "machine-scheduled `/loop` re-entries — **listed separately in the appendix**",
    "compaction-summary": "the auto-written \"this session is being continued…\" context injection",
    interrupt: "`[Request interrupted by user]` — an action, not a message",
    empty: "nothing left once injected `<system-reminder>` blocks were stripped",
    sidechain: "`isSidechain` — a subagent's transcript inlined into its parent's file",
  }
  for (const reason of REASONS) {
    const count = stats.reasons[reason] ?? 0
    if (!count) continue
    out.push(`| \`${reason}\` | ${count.toLocaleString()} | ${why[reason]} |`)
  }
  out.push("")
  out.push(
    `Prompts are **verbatim** — typos, profanity, pasted UI text, URLs and \`[Image #N]\` markers are ` +
      `left exactly as typed. A \`📎 image\` marker means the message carried a screenshot ` +
      `(${stats.images} of them did; many of Marko's prompts were a screenshot plus a sentence). ` +
      `The only edit ever applied is credential redaction: ${stats.redactionTotal} value(s) replaced ` +
      `with \`${REDACTION}\`, and the rendered file is re-scanned before writing — a surviving key, or ` +
      `an unreviewed high-entropy run, aborts the run instead of shipping.`
  )
  out.push("")
  out.push(
    "Sessions are ordered by their first surviving prompt, and several ran concurrently, so the " +
      "per-prompt UTC instants — not section order — are the authority on true chronology."
  )
  out.push("")
  out.push(`Codex corpus source: \`${codexSource}\`.`)
  out.push("")

  let n = 0
  withPrompts.forEach((session, index) => {
    out.push("---")
    out.push("")
    out.push(`## Session ${index + 1} — \`${session.id}\``)
    out.push("")
    out.push(`> ${session.note}`)
    out.push("")
    out.push("| | |")
    out.push("| --- | --- |")
    out.push(`| **Agent** | ${session.tool}${session.originator ? ` (${session.originator})` : ""} |`)
    out.push(`| **Model** | ${modelLabel(session)} |`)
    out.push(`| **CLI version** | ${versionLabel(session)} |`)
    out.push(
      `| **Working dir** | \`${session.cwd || "—"}\`${session.gitBranch ? ` · branch \`${session.gitBranch}\`` : ""} |`
    )
    const window = promptWindow(session)
    out.push(`| **First prompt** | \`${iso(window.first)}\` · ${local(window.first)} ${LOCAL_ZONE} |`)
    out.push(`| **Last prompt** | \`${iso(window.last)}\` · ${local(window.last)} ${LOCAL_ZONE} |`)
    out.push(`| **Span** | ${duration(window.first, window.last) || "—"} |`)
    out.push(
      `| **Transcript activity** | \`${iso(session.first)}\` → \`${iso(session.last)}\`` +
        `${session.lineage.startsWith("resumed") ? " (includes the parent history this session replayed)" : ""} |`
    )
    out.push(`| **Human prompts** | ${session.prompts.length} |`)
    out.push(`| **Lineage** | ${session.lineage} |`)
    out.push(`| **Transcript** | \`${tildePath(session.path)}\` |`)
    out.push("")
    let previous = ""
    session.prompts.forEach((prompt, seq) => {
      n += 1
      const gap = previous ? duration(previous, prompt.ts) : ""
      const parts = [
        `\`#${n}\``,
        `${index + 1}.${seq + 1}`,
        `\`${iso(prompt.ts)}\``,
        `${local(prompt.ts)} ${LOCAL_ZONE}`,
      ]
      if (gap && gap !== "<1m") parts.push(`+${gap}`)
      if (prompt.image) parts.push("📎 image")
      out.push(`#### ${parts.join(" · ")}`)
      out.push("")
      out.push(prompt.text)
      out.push("")
      previous = prompt.ts
    })
  })

  const wakeups = sessions.flatMap((session) =>
    session.loopWakeups.map((wakeup) => ({ ...wakeup, session: session.id }))
  )
  if (wakeups.length > 0) {
    out.push("---")
    out.push("")
    out.push("## Appendix — machine-scheduled `/loop` wake-ups")
    out.push("")
    out.push(
      `${wakeups.length} entries. These look like user turns in the transcript but nobody typed them: ` +
        "`/loop` re-enters the session on a timer with a prompt the previous cycle wrote for itself. " +
        "They are excluded from the corpus above and reproduced here because they are the record of the " +
        "autonomous build loop — the thing that ran while Marko slept."
    )
    out.push("")
    wakeups
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .forEach((wakeup, index) => {
        out.push(
          `<details><summary><code>L${index + 1}</code> · <code>${iso(wakeup.ts)}</code> · ` +
            `${local(wakeup.ts)} ${LOCAL_ZONE} · session <code>${shortId(wakeup.session)}</code></summary>`
        )
        out.push("")
        // A five-tick fence so the wake-up prompt's own code fences survive verbatim.
        out.push("`````text")
        out.push(wakeup.text)
        out.push("`````")
        out.push("")
        out.push("</details>")
        out.push("")
      })
  }
  // NO whitespace normalization here: collapsing blank-line runs would silently
  // reflow the inside of a pasted prompt, and "verbatim" has to mean verbatim.
  return out.join("\n") + "\n"
}

function renderSessions(sessions, stats, codexSource) {
  const out = []
  out.push("# Session registry — every agent session that touched this repo")
  out.push("")
  out.push("<!-- GENERATED by scripts/extract-prompts.mjs — run `pnpm prompts`. Do not hand-edit. -->")
  out.push("")
  out.push(
    `Discovered automatically from this repo's path: ${sessions.length} sessions across ` +
      `${new Set(sessions.map((session) => session.dir)).size} transcript directories, ` +
      `on ${new Set(sessions.map((session) => session.tool)).size} coding agents. ` +
      `${stats.total} human prompts survive classification (see PROMPTS.md); everything else in those ` +
      "files is tooling."
  )
  out.push("")
  out.push("Pin or exclude a session with `docs/memory/sessions.overrides.json`")
  out.push("(`{ \"exclude\": [\"<id>\"], \"notes\": { \"<id>\": \"…\" } }`).")
  out.push("")
  out.push("## Analysis")
  out.push("")
  out.push(
    "| Session | Agent | Model | CLI | Start (UTC) | End (UTC) | Duration | Size | Human | Loop | Lineage | Character |"
  )
  out.push("| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |")
  for (const session of sessions) {
    out.push(
      `| \`${shortId(session.id)}\` | ${session.tool} | ${modelLabel(session)} | ${versionLabel(session)} | ` +
        `${iso(session.first)} | ${iso(session.last)} | ${duration(session.first, session.last) || "—"} | ` +
        `${(session.size / 1e6).toFixed(1)}MB | ${session.prompts.length} | ${session.loopWakeups.length} | ` +
        `${session.lineage} | ${session.note} |`
    )
  }
  out.push("")
  out.push("## Registry rows")
  out.push("")
  out.push("Machine-readable, one row per session:")
  out.push("`- <tool> · <session-id> · <transcript-path> · <note>`")
  out.push("")
  for (const session of sessions) {
    out.push(`- ${session.tool} · ${session.id} · ${tildePath(session.path)} · ${session.note}`)
  }
  out.push("")
  out.push(`Codex corpus source: \`${codexSource}\`.`)
  out.push("")
  return out.join("\n")
}

// ————————————————————————————————————————————————————————————————————————————
// Git history audit
// ————————————————————————————————————————————————————————————————————————————

function auditGitHistory() {
  const paths = ["docs/memory/PROMPTS.md", "docs/memory/SESSIONS.md", "docs/memory/.codex-prompts.json"]
  let history
  try {
    history = execFileSync("git", ["log", "-p", "--", ...paths], { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 })
  } catch (error) {
    console.warn(`history audit skipped: ${error.message}`)
    return null
  }
  const leaks = scanForSecrets(history).filter((finding) => finding.severity === "secret")
  return { leaks, bytes: history.length }
}

// ————————————————————————————————————————————————————————————————————————————
// Main
// ————————————————————————————————————————————————————————————————————————————

const overrides = loadOverrides()
const cache = loadCache()

/** @type {any[]} */
const raw = []
for (const file of discoverClaudeTranscripts()) {
  if (overrides.exclude.includes(file.id)) continue
  if (flags.only && !file.id.startsWith(flags.only)) continue
  raw.push(await extractClaudeSession(file, cache))
}
saveCache(cache)

const codex = await loadCodexSessions()
for (const session of codex.sessions) {
  if (overrides.exclude.includes(session.id)) continue
  if (flags.only && !String(session.id).startsWith(flags.only)) continue
  raw.push({ loopWakeups: [], reasons: {}, redactions: {}, ...session })
}

// Order by first raw prompt so dedupe always keeps the ORIGINAL occurrence and
// a replayed continuation loses its replay, never the other way round.
raw.sort((a, b) => (a.prompts[0]?.ts ?? a.first ?? "~").localeCompare(b.prompts[0]?.ts ?? b.first ?? "~"))

// Lineage: a session sharing entry uuids with an earlier one is that session
// resumed (Claude Code copies the surviving history into the new transcript).
const seenUuid = new Map()
for (const session of raw) {
  const parents = new Set()
  for (const prompt of session.prompts) {
    if (prompt.uuid && seenUuid.has(prompt.uuid)) parents.add(seenUuid.get(prompt.uuid))
  }
  for (const prompt of session.prompts) if (prompt.uuid) seenUuid.set(prompt.uuid, session.id)
  session.lineage = parents.size
    ? `resumed from \`${[...parents].map(shortId).join("`, `")}\``
    : session.compactions > 0
      ? "self-compacted"
      : "root"
}

// Dedupe across the whole corpus.
const seen = new Set()
let dupes = 0
for (const session of raw) {
  session.prompts = session.prompts.filter((prompt) => {
    const key = prompt.uuid || `${normalizeForDedupe(prompt.text)}@${prompt.ts.slice(0, 16)}`
    const alt = `${normalizeForDedupe(prompt.text)}@${prompt.ts.slice(0, 16)}`
    if (seen.has(key) || seen.has(alt)) {
      dupes += 1
      session.reasons.duplicate = (session.reasons.duplicate ?? 0) + 1
      return false
    }
    seen.add(key)
    seen.add(alt)
    return true
  })
}

for (const session of raw) {
  // Where an agent-only session ran says what it was: the scratchpad dirs are
  // the MCP live-verification fan-out, the worktree dirs are the `claude -p`
  // subagents the Codex adversarial audit spawned inside its own branch.
  const context = session.dir.includes("-private-tmp")
    ? "agent-only — MCP live-check subagent in the scratchpad"
    : session.cwd && session.cwd !== root
      ? "agent-only — `claude -p` subagent inside the adversarial-audit worktree"
      : "agent-only — no prompt was ever typed in this session"
  const derived =
    session.title ||
    (session.prompts.length ? `${session.prompts[0].text.slice(0, 60).replace(/\s+/g, " ")}…` : "")
  session.note =
    overrides.notes[session.id] ??
    (session.prompts.length ? derived || "(no title recorded)" : context)
}

const stats = {
  total: raw.reduce((n, session) => n + session.prompts.length, 0),
  images: raw.reduce((n, session) => n + session.prompts.filter((p) => p.image).length, 0),
  reasons: /** @type {Record<string, number>} */ ({}),
  redactions: /** @type {Record<string, number>} */ ({}),
  redactionTotal: 0,
  badLines: raw.reduce((n, session) => n + (session.badLines ?? 0), 0),
  loopWakeups: raw.reduce((n, session) => n + session.loopWakeups.length, 0),
  dupes,
  first: "",
  last: "",
}
for (const session of raw) {
  for (const [reason, count] of Object.entries(session.reasons ?? {})) {
    stats.reasons[reason] = (stats.reasons[reason] ?? 0) + count
  }
  for (const [name, count] of Object.entries(session.redactions ?? {})) {
    stats.redactions[name] = (stats.redactions[name] ?? 0) + count
    stats.redactionTotal += count
  }
}
const allStamps = raw
  .flatMap((session) => session.prompts.map((prompt) => prompt.ts))
  .filter(Boolean)
  .sort()
stats.first = allStamps[0] ?? ""
stats.last = allStamps[allStamps.length - 1] ?? ""

const promptsDoc = renderPrompts(raw, stats, codex.source)
const sessionsDoc = renderSessions(raw, stats, codex.source)

// ——— The gate. Nothing is written unless the rendered bytes are clean.
const rendered = promptsDoc + "\n" + sessionsDoc
const leaks = scanForSecrets(rendered).filter((finding) => finding.severity === "secret")
const flagged = entropyReview(rendered).filter((run) => !run.reviewed)

console.log("")
console.log(`sessions      ${raw.length} discovered (${raw.filter((s) => s.prompts.length).length} with human turns)`)
console.log(`prompts       ${stats.total} human · ${stats.images} with images · ${stats.loopWakeups} loop wake-ups (appendix)`)
console.log(`dedupe        ${dupes} replayed turns collapsed`)
console.log(`excluded      ${REASONS.map((r) => `${r}=${stats.reasons[r] ?? 0}`).join(" ")}`)
console.log(
  `redacted      ${stats.redactionTotal} value(s)` +
    (stats.redactionTotal ? ` — ${Object.entries(stats.redactions).map(([k, v]) => `${k}×${v}`).join(", ")}` : "")
)
if (stats.badLines) console.log(`skipped       ${stats.badLines} unparseable line(s) (corrupt/partial writes)`)
if (leaks.length > 0) {
  console.error("")
  console.error(`REFUSING TO WRITE — ${leaks.length} credential pattern(s) survived redaction:`)
  for (const leak of leaks) console.error(`  ${leak.rule} ×${leak.count}`)
  process.exit(2)
}
console.log("secrets       clean — 0 credential matches in the rendered output")

if (flagged.length > 0) {
  console.error("")
  console.error(`REFUSING TO WRITE — ${flagged.length} unreviewed high-entropy run(s) in the output.`)
  console.error("Read each one in the raw transcript. If it is not a credential, add it to")
  console.error("REVIEWED_ENTROPY in this script with a note saying what it is:")
  for (const run of flagged) console.error(`  ["${run.digest}", "${run.length}ch ${run.hint} — WHAT IS THIS?"],`)
  process.exit(3)
}
console.log(`entropy       ${entropyReview(rendered).length} high-entropy run(s), all reviewed and benign`)

const previousPrompts = existsSync(PROMPTS_FILE) ? readFileSync(PROMPTS_FILE, "utf8") : ""
const previousSessions = existsSync(SESSIONS_FILE) ? readFileSync(SESSIONS_FILE, "utf8") : ""
const changed = previousPrompts !== promptsDoc || previousSessions !== sessionsDoc

if (flags.check) {
  console.log(changed ? "drift         STALE — run `pnpm prompts`" : "drift         up to date")
  process.exit(changed ? 1 : 0)
}

if (changed) {
  writeFileSync(PROMPTS_FILE, promptsDoc)
  writeFileSync(SESSIONS_FILE, sessionsDoc)
  console.log(`write         docs/memory/PROMPTS.md (${(promptsDoc.length / 1024).toFixed(0)}KB) + docs/memory/SESSIONS.md`)
} else {
  console.log("write         no change")
}

// The history audit is opt-in (`pnpm prompts:audit`) and runs AFTER the write:
// a finding in a 2026-08-11 commit must not stop today's clean corpus from being
// regenerated, but it must stop it from being pushed on top of an unresolved leak.
if (flags.auditHistory) {
  const audit = auditGitHistory()
  if (audit) {
    if (audit.leaks.length > 0) {
      console.error("")
      console.error(
        `git history   ${audit.leaks.length} credential pattern(s) present in PAST revisions of ` +
          "PROMPTS.md / SESSIONS.md / .codex-prompts.json:"
      )
      for (const leak of audit.leaks) console.error(`  ${leak.rule} ×${leak.count}`)
      console.error("")
      console.error("  The working tree is clean — this is history. Find the commits with:")
      console.error("    for c in $(git rev-list --all -- docs/memory/PROMPTS.md); do \\")
      console.error("      git show $c:docs/memory/PROMPTS.md | grep -qE '<pattern>' && echo $c; done")
      console.error("  A key that reached a public remote is compromised: ROTATE IT. Rewriting")
      console.error("  history afterwards is hygiene, not remediation.")
      process.exit(3)
    }
    console.log(`git history   clean — 0 credential matches across ${(audit.bytes / 1e6).toFixed(1)}MB of past revisions`)
  }
}

if (flags.commit && !changed) {
  console.log("git           nothing to commit")
}

if (flags.commit && changed) {
  const paths = ["docs/memory/PROMPTS.md", "docs/memory/SESSIONS.md"]
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
  try {
    git("add", "--", ...paths)
    const staged = git("diff", "--cached", "--name-only", "--", ...paths)
    if (!staged) {
      console.log("git           nothing staged")
    } else {
      const sessionCount = raw.filter((s) => s.prompts.length).length
      git("commit", "-m", `docs(prompts): regenerate — ${stats.total} prompts across ${sessionCount} sessions`)
      const branch = git("rev-parse", "--abbrev-ref", "HEAD")
      git("push", "origin", branch, `${branch}:main`)
      console.log(`git           committed + pushed ${branch} and main`)
    }
  } catch (error) {
    console.error(`git           failed: ${error.message}`)
    process.exit(4)
  }
}

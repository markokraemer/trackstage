// Codex CLI rollout reader — the sibling of scripts/extract-prompts.mjs for the
// OTHER agent that worked on this repo. Same philosophy: the git repo is the
// source of truth, so every raw human prompt is recoverable and replayable.
//
// Codex stores one JSONL "rollout" per thread at
//   ~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-ts>-<session-uuid>.jsonl
// Every line is `{ timestamp, ordinal?, type, payload }`. Rollouts get BIG
// (the sessionboard one is 128 MB / 16k lines), so everything here streams
// line-by-line — never readFileSync, never JSON.parse of the whole file.
//
// ——— Record taxonomy (measured on the real 16,022-line sessionboard rollout) ———
//   4084  event_msg/item_completed          UI mirror of a finished item
//   3218  event_msg/token_count             usage/rate-limit telemetry
//   2475  response_item/custom_tool_call    model → tool
//   2475  response_item/custom_tool_call_output
//   1879  response_item/reasoning           model thinking (encrypted)
//    647  response_item/function_call (+ _output)
//    459  response_item/message:assistant   model output
//     31  turn_context                      model/cwd/sandbox per turn
//     29  response_item/message:user        ← the only candidate human turns
//     26  world_state
//     22  compacted                         auto-summarization checkpoints
//      6  response_item/message:developer   harness/system instructions
//      9/5/5/2/2 event_msg task_started / task_complete /
//                thread_settings_applied / thread_goal_updated / turn_aborted
//      1  session_meta                      first line, thread identity
//
// Of the 29 user-role messages, 6 are blocks Codex injects into the user turn
// (2× the AGENTS.md instruction bundle, 1× <environment_context>, 3×
// <codex_internal_context source="goal">). 29 − 6 = 23, which matches exactly
// the 23 `event_msg/item_completed` records carrying `item.type === "UserMessage"`
// — the harness's own count of what the human actually typed. That agreement is
// the correctness proof for the filter below.
//
// Both surfaces are read and deduped: the same turn shows up as a
// `response_item` and as an `item_completed/UserMessage` milliseconds apart,
// while a genuine re-paste of identical text hours later must survive.
import {
  createReadStream,
  openSync,
  readSync,
  fstatSync,
  closeSync,
} from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { basename, dirname, join, resolve, sep } from "node:path"
import { createInterface } from "node:readline"

export const CODEX_SESSIONS_ROOT = join(homedir(), ".codex", "sessions")

// ——— Sanitation: ONE implementation, shared with the PROMPTS.md pipeline ———
// Marko's standing rule: these artifacts are committed to a public-facing repo,
// so no key of his may ever survive into them. Redact first, then re-scan what
// was actually produced and refuse to write if anything survives. Import
// `redactSecrets` and `scanForSecrets` from here rather than re-deriving them —
// two drifting copies is how a key eventually escapes.

/**
 * Named credential patterns. Supersets scripts/extract-prompts.mjs (which stays
 * the standalone Claude-transcript script) — every pattern there is present
 * here, plus the providers this repo has since touched.
 * @type {Array<{ name: string, re: RegExp }>}
 */
export const SECRET_RULES = [
  { name: "anthropic", re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "openrouter", re: /sk-or-v1-[A-Za-z0-9]{8,}/g },
  { name: "openai-project", re: /sk-proj-[A-Za-z0-9_-]{20,}/g },
  { name: "stripe-live", re: /\b[sr]k_live_[A-Za-z0-9]{16,}/g },
  { name: "stripe-test", re: /\b[sr]k_test_[A-Za-z0-9]{16,}/g },
  { name: "sk-generic", re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: "resend", re: /\bre_[A-Za-z0-9_]{16,}/g },
  { name: "airtable-pat", re: /\bpat[A-Za-z0-9]{10,}\.[A-Za-z0-9]{20,}/g },
  { name: "trackstage-key", re: /\bsb_live_[0-9a-f]{8,}/g },
  { name: "github", re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: "google-api", re: /\bAIza[A-Za-z0-9_-]{30,}/g },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "slack", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { name: "cloudflare-global", re: /\b[0-9a-f]{37}\b/g },
  // Newer CF API tokens are exactly 40 chars of [A-Za-z0-9_-]. The boundaries
  // are hand-rolled (not \b, which fires mid-hyphen and would slice a filename
  // apart) and the lookahead spares a 40-hex git SHA — same length, must stay.
  {
    name: "cloudflare-token",
    re: /(?<![A-Za-z0-9_-])(?![0-9a-f]{40}(?![A-Za-z0-9_-]))[A-Za-z0-9_-]{40}(?![A-Za-z0-9_-])/g,
  },
  {
    name: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  { name: "bearer", re: /Bearer\s+[A-Za-z0-9._~+/-]{20,}/g },
  { name: "portal-token", re: /\/portal\/t\/[A-Za-z0-9_-]{16,}/g },
  {
    name: "token-query",
    re: /([?&](?:t|token|api_key|apikey|key|secret)=)[A-Za-z0-9._~+/-]{16,}/gi,
  },
  {
    name: "private-key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { name: "private-key-header", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    name: "env-assignment",
    re: /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIALS?)\s*[=:]\s*["']?[A-Za-z0-9._~+/-]{12,}["']?/g,
  },
]

/**
 * High-entropy backstop for key shapes no named rule claims: an unbroken 32+
 * char base64ish run. Hyphen and slash are deliberately NOT run characters, so
 * UUIDs, file paths and URLs break into short segments instead of drowning the
 * report — anything hyphen/underscore-shaped that is genuinely a credential is
 * already covered above. Reported as "review", never silently trusted.
 */
export const ENTROPY_RULE = {
  name: "high-entropy",
  re: /(?<![A-Za-z0-9+_=])[A-Za-z0-9+_]{32,}={0,2}(?![A-Za-z0-9+_=])/g,
}

export const REDACTION = "[REDACTED-SECRET]"

/** Redact every named credential pattern. Human words are untouched. */
export function redactSecrets(text) {
  let result = text
  for (const rule of SECRET_RULES) {
    result = result.replace(rule.re, (match) =>
      // Keep the harmless prefix of a `?token=` style match so the URL still reads.
      rule.name === "token-query"
        ? match.replace(/=.*/s, "=" + REDACTION)
        : REDACTION
    )
  }
  return result
}

/**
 * Re-scan produced output. Returns `[{ rule, count, severity }]` — never the
 * matched VALUES, so a scan report is itself safe to print or commit.
 * `severity: "secret"` must block a write; `"review"` is the entropy backstop.
 * @returns {Array<{ rule: string, count: number, severity: "secret"|"review" }>}
 */
export function scanForSecrets(text) {
  const findings = []
  for (const rule of SECRET_RULES) {
    const matches = text.match(rule.re)
    if (matches?.length)
      findings.push({
        rule: rule.name,
        count: matches.length,
        severity: "secret",
      })
  }
  const entropy = (text.match(ENTROPY_RULE.re) ?? []).filter(
    (run) => !run.includes(REDACTION)
  )
  if (entropy.length > 0) {
    findings.push({
      rule: ENTROPY_RULE.name,
      count: entropy.length,
      severity: "review",
    })
  }
  return findings
}

/** Back-compat alias for the shape scripts/extract-prompts.mjs uses. */
export const SECRET_PATTERNS = SECRET_RULES.map((rule) => rule.re)

/**
 * Blocks Codex injects INTO a user-role message. None of these were typed by a
 * human, and each is anchored at the very start of the message, so a prefix
 * test is enough — a human quoting `<environment_context>` mid-message keeps it.
 */
const INJECTED_PREFIXES = [
  "<environment_context>",
  "<user_instructions>",
  "<codex_internal_context",
  "<multi_agent_mode>",
  "<collaboration_mode>",
  "<turn_aborted>",
  "<review_mode>",
  "<compact_instructions>",
  "# AGENTS.md instructions for ",
  "Another language model started to solve this problem",
]

/** True when a user-role message is a harness injection, not a typed prompt. */
function isInjectedBlock(text) {
  if (!text) return true
  const head = text.trimStart()
  return INJECTED_PREFIXES.some((prefix) => head.startsWith(prefix))
}

/** Flatten a Codex content array (input_text / output_text / text parts). */
function textOf(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("\n")
}

/** Strip injected blocks that appear inline, then redact. Words stay verbatim. */
function cleanPrompt(raw) {
  let text = raw
  text = text.replace(
    /<environment_context>[\s\S]*?<\/environment_context>/g,
    ""
  )
  text = text.replace(/<user_instructions>[\s\S]*?<\/user_instructions>/g, "")
  text = text.replace(/<turn_aborted>[\s\S]*?<\/turn_aborted>/g, "")
  return redactSecrets(text.trim())
}

const norm = (text) => text.replace(/\s+/g, " ").trim()

/**
 * Stream a rollout's lines, invoking `onEntry(parsedEntry)` per JSON line.
 * Tolerates a truncated final line (a live session may still be appending) and
 * any mid-file garbage. `maxBytes` caps how much of the file is read.
 */
async function streamEntries(absPath, onEntry, { maxBytes } = {}) {
  const stream = createReadStream(absPath, {
    encoding: "utf8",
    ...(typeof maxBytes === "number"
      ? { start: 0, end: Math.max(0, maxBytes - 1) }
      : {}),
  })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  let stopped = false
  try {
    for await (const line of rl) {
      if (stopped || !line.trim()) continue
      let entry
      try {
        entry = JSON.parse(line)
      } catch {
        continue // truncated tail or a half-written line — skip, never throw
      }
      if (onEntry(entry) === false) {
        stopped = true
        break
      }
    }
  } finally {
    rl.close()
    stream.destroy()
  }
}

/**
 * Every RAW human turn in one Codex rollout, chronological, verbatim (typos,
 * profanity, pasted URLs and all) apart from secret redaction.
 *
 * ASYNC: 128 MB must never be read into memory, so this streams and returns a
 * Promise. `await extractCodexPrompts(path)` → `[{ ts, text }, ...]`.
 *
 * @param {string} absPath absolute path to a rollout-*.jsonl
 * @param {{ maxBytes?: number }} [options] cap bytes read (live/huge files)
 * @returns {Promise<Array<{ ts: string, text: string }>>}
 */
export async function extractCodexPrompts(absPath, options = {}) {
  const found = []
  await streamEntries(
    absPath,
    (entry) => {
      const payload = entry.payload
      if (!payload) return
      let raw = null
      if (
        entry.type === "response_item" &&
        payload.type === "message" &&
        payload.role === "user"
      ) {
        raw = textOf(payload.content)
      } else if (
        entry.type === "event_msg" &&
        payload.type === "user_message"
      ) {
        // Older/other Codex builds emit the turn as its own event.
        raw =
          typeof payload.message === "string"
            ? payload.message
            : textOf(payload.content)
      } else if (
        entry.type === "event_msg" &&
        payload.type === "item_completed" &&
        payload.item?.type === "UserMessage"
      ) {
        raw = textOf(payload.item.content)
      } else {
        return
      }
      if (isInjectedBlock(raw)) return
      const text = cleanPrompt(raw)
      if (!text || isInjectedBlock(text)) return
      found.push({ ts: entry.timestamp, text })
    },
    options
  )

  // Dedupe the same turn seen on two surfaces (response_item + item_completed,
  // milliseconds apart) WITHOUT collapsing a genuine re-paste hours later.
  const WINDOW_MS = 5000
  const prompts = []
  const lastSeen = new Map()
  for (const prompt of found) {
    const key = norm(prompt.text)
    const at = Date.parse(prompt.ts ?? "")
    const prev = lastSeen.get(key)
    if (
      prev !== undefined &&
      Number.isFinite(at) &&
      Math.abs(at - prev) <= WINDOW_MS
    )
      continue
    lastSeen.set(key, Number.isFinite(at) ? at : 0)
    prompts.push(prompt)
  }
  prompts.sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
  return prompts
}

/** Read the tail of a file without loading it — for the last line's timestamp. */
function tailTimestamp(absPath, bytes = 64 * 1024) {
  let fd
  try {
    fd = openSync(absPath, "r")
    const size = fstatSync(fd).size
    const length = Math.min(bytes, size)
    const buffer = Buffer.alloc(length)
    readSync(fd, buffer, 0, length, size - length)
    const lines = buffer.toString("utf8").split("\n")
    for (let index = lines.length - 1; index >= 0; index--) {
      const line = lines[index].trim()
      if (!line) continue
      try {
        const entry = JSON.parse(line)
        if (entry?.timestamp) return entry.timestamp
      } catch {
        continue // truncated last line, or a partial line at the read boundary
      }
    }
    return null
  } catch {
    return null
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

/**
 * Identity of one rollout, read from its first few lines only (cheap — never
 * scans the body) plus a seek to the tail for `endedAt`.
 *
 * @returns {Promise<{ sessionId: string|null, cwd: string|null, startedAt: string|null,
 *   endedAt: string|null, model?: string, cliVersion?: string, originator?: string,
 *   threadSource?: string, parentThreadId?: string|null, forkedFromId?: string|null } | null>}
 */
export async function codexSessionMeta(absPath) {
  let meta = null
  let model
  let lines = 0
  try {
    await streamEntries(absPath, (entry) => {
      lines += 1
      if (entry.type === "session_meta" && entry.payload) meta = entry.payload
      if (!model && entry.type === "turn_context" && entry.payload?.model) {
        model = entry.payload.model
      }
      // session_meta is line 1; turn_context lands within the first handful.
      if (lines >= 12) return false
      return undefined
    })
  } catch {
    return null // unreadable / vanished mid-scan — a discovery pass must not die
  }
  if (!meta) return null
  const spawn = meta.source?.subagent?.thread_spawn
  return {
    sessionId: meta.session_id ?? meta.id ?? null,
    cwd: meta.cwd ?? null,
    startedAt: meta.timestamp ?? null,
    endedAt: tailTimestamp(absPath),
    model: model ?? meta.model ?? undefined,
    cliVersion: meta.cli_version ?? undefined,
    originator: meta.originator ?? undefined,
    threadSource: meta.thread_source ?? undefined,
    parentThreadId: spawn?.parent_thread_id ?? null,
    forkedFromId: meta.forked_from_id ?? meta.source?.forked_from_id ?? null,
  }
}

/** All rollout-*.jsonl paths under ~/.codex/sessions (YYYY/MM/DD nesting). */
async function listRollouts(root) {
  const files = []
  async function walk(dir) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // unreadable directory — skip, never throw
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name))
        files.push(path)
    }
  }
  await walk(root)
  files.sort()
  return files
}

/**
 * Is `cwd` this repo, a subdirectory of it, or one of its git worktrees?
 * Worktrees in this project are siblings named `<repo>-<slug>` (e.g.
 * `sessionboard-adversarial-e2e-20260811`), so that shape counts too.
 */
function matchesRepo(cwd, repoCwd) {
  if (!cwd) return false
  const target = resolve(repoCwd)
  const candidate = resolve(cwd)
  if (candidate === target || candidate.startsWith(target + sep)) return true
  const parent = dirname(target)
  const name = basename(target)
  if (
    dirname(candidate) === parent &&
    basename(candidate).startsWith(name + "-")
  )
    return true
  return false
}

/**
 * Every Codex rollout belonging to this repo — matched by session_meta cwd (the
 * repo, a subdir, or a sibling worktree), then transitively extended along
 * subagent-spawn and fork chains so a child thread with a different cwd is
 * still claimed.
 *
 * CHEAP BY CONSTRUCTION: reads only the first ~12 lines of each rollout plus a
 * 64 KB tail seek. A 128 MB rollout costs the same as a 100 KB one.
 *
 * @param {string} repoCwd absolute path of the repo (e.g. process.cwd())
 * @param {{ root?: string }} [options]
 * @returns {Promise<Array<{ sessionId: string, path: string, cwd: string|null,
 *   startedAt: string|null, endedAt: string|null, model?: string, cliVersion?: string,
 *   parentThreadId: string|null, forkedFromId: string|null, matchedBy: "cwd"|"chain" }>>}
 */
export async function discoverCodexSessions(repoCwd, options = {}) {
  const root = options.root ?? CODEX_SESSIONS_ROOT
  try {
    if (!(await stat(root)).isDirectory()) return []
  } catch {
    return []
  }

  const metas = []
  for (const path of await listRollouts(root)) {
    let meta = null
    try {
      meta = await codexSessionMeta(path)
    } catch {
      meta = null // half-written or unreadable rollout — skip it
    }
    if (!meta?.sessionId) continue
    metas.push({ ...meta, path })
  }

  const claimed = new Map()
  for (const meta of metas) {
    if (matchesRepo(meta.cwd, repoCwd)) claimed.set(meta.sessionId, "cwd")
  }
  // Transitive closure over parent/fork edges (children are chronologically
  // later, but iterate to a fixpoint so ordering never matters).
  let grew = true
  while (grew) {
    grew = false
    for (const meta of metas) {
      if (claimed.has(meta.sessionId)) continue
      const parents = [meta.parentThreadId, meta.forkedFromId].filter(Boolean)
      if (parents.some((parent) => claimed.has(parent))) {
        claimed.set(meta.sessionId, "chain")
        grew = true
      }
    }
  }

  return metas
    .filter((meta) => claimed.has(meta.sessionId))
    .map((meta) => ({ ...meta, matchedBy: claimed.get(meta.sessionId) }))
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
}

/** Absolute path → the `~`-prefixed form we store in committed artifacts. */
export function tildePath(absPath) {
  const home = homedir()
  return absPath.startsWith(home) ? "~" + absPath.slice(home.length) : absPath
}

/**
 * The machine-readable handoff corpus: every Codex session for this repo with
 * its numbered, redacted human prompts. This is what
 * `docs/memory/.codex-prompts.json` contains, and it is the FAST PATH — the
 * PROMPTS.md generator reads this instead of re-parsing 128 MB of rollout.
 *
 * @param {string} repoCwd
 * @param {{ root?: string, notes?: Record<string,string> }} [options]
 */
export async function buildCodexHandoff(repoCwd, options = {}) {
  const discovered = await discoverCodexSessions(repoCwd, options)
  const sessions = []
  for (const session of discovered) {
    const prompts = (await extractCodexPrompts(session.path)).map(
      (prompt, index) => ({
        n: index + 1,
        ts: prompt.ts,
        text: prompt.text,
      })
    )
    sessions.push({
      sessionId: session.sessionId,
      tool: "codex",
      path: tildePath(session.path),
      cwd: session.cwd,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      model: session.model,
      cliVersion: session.cliVersion,
      matchedBy: session.matchedBy,
      note: options.notes?.[session.sessionId] ?? "",
      prompts,
    })
  }
  return { generatedAt: new Date().toISOString(), sessions }
}

// Run directly to (re)write the handoff artifact:
//   node scripts/lib/codex-prompts.mjs [outFile]
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import("node:fs")
  const repoRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    "..",
    ".."
  )
  const outFile = process.argv[2]
    ? resolve(process.argv[2])
    : join(repoRoot, "docs/memory/.codex-prompts.json")
  const notes = {
    "019ff23a-f653-7fd3-b1f3-5ae6f9df8b35":
      "adversarial e2e audit — branch codex/adversarial-e2e-audit-20260811, ran in parallel with the Claude sessions",
  }
  const handoff = await buildCodexHandoff(repoRoot, { notes })
  const json = JSON.stringify(handoff, null, 2)

  // HARD VALIDATOR (defense in depth): redaction already ran per-prompt; re-scan
  // the bytes that would actually hit disk and refuse to write on any survivor.
  // Counts only — a scan report never echoes the value it matched.
  const findings = scanForSecrets(json)
  for (const finding of findings) {
    console.error(`  ${finding.severity}: ${finding.rule} ×${finding.count}`)
  }
  if (findings.some((finding) => finding.severity === "secret")) {
    console.error("REFUSING TO WRITE: a credential pattern survived redaction.")
    process.exit(2)
  }
  if (
    findings.some((finding) => finding.severity === "review") &&
    !process.argv.includes("--allow-entropy")
  ) {
    console.error(
      "REFUSING TO WRITE: high-entropy run(s) need a human look. Re-run with --allow-entropy once reviewed."
    )
    process.exit(3)
  }

  writeFileSync(outFile, json + "\n")
  for (const session of handoff.sessions) {
    console.log(
      `${session.sessionId}: ${session.prompts.length} prompts (${session.startedAt} → ${session.endedAt}) [${session.matchedBy}]`
    )
  }
  console.log(
    `→ ${outFile} (${handoff.sessions.length} session(s), secret-validated)`
  )
}

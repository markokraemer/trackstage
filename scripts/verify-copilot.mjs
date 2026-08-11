#!/usr/bin/env node
/**
 * Copilot end-to-end verification (docs/memory/RULES.md #24).
 *
 * Drives the REAL chat route — the same one the browser posts to — with a real
 * signed-in cookie, and asserts three things per prompt:
 *
 *   1. the model actually called the tool we were aiming at (not a prose
 *      answer, which is the failure mode a prompt regression produces);
 *   2. the tool returned an output we can render;
 *   3. destructive tools SUSPEND on an approval request instead of running.
 *
 * It also writes every captured `{input, output}` pair to
 * tests/fixtures/copilot-tool-payloads.json, which is what the renderer unit
 * tests (tests/unit/copilot-renderers.test.tsx) render — so the generative UI
 * is exercised against payloads the live MCP server actually produced, not
 * fixtures someone imagined.
 *
 * Usage: pnpm dev (in another shell), then `node scripts/verify-copilot.mjs`.
 *   --only=<substring>   run just the prompts whose id matches
 *   --no-write           don't touch the fixtures file
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const APP = process.env.APP_URL ?? "http://localhost:3000"
const FIXTURES = resolve(root, "tests/fixtures/copilot-tool-payloads.json")

const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
)

const DEMO = {
  email: "organizer@demo.sessionboard.dev",
  password: "demo2026",
}

const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length)
const write = !args.includes("--no-write")

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = "") {
  if (condition) {
    passed++
    console.log(`  ✔ ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`)
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

// ——— Auth ——————————————————————————————————————————————————————————————————

/**
 * The chat route reads the Better Auth cookie the browser holds on the APP
 * origin, so we sign in against the app's own proxied auth endpoint rather
 * than the Convex site — same as a real session.
 */
async function signIn() {
  const res = await fetch(`${APP}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP },
    body: JSON.stringify(DEMO),
  })
  if (!res.ok) {
    throw new Error(`sign-in failed: ${res.status} ${await res.text()}`)
  }
  const cookies = res.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ")
  if (!cookies) throw new Error("sign-in returned no cookies")
  return cookies
}

// ——— The stream ————————————————————————————————————————————————————————————

/**
 * Posts one turn and folds the UI message stream back into tool parts.
 *
 * The wire format is AI SDK v7's UI message stream over SSE: `data: {...}`
 * lines whose `type` walks a tool call through `tool-input-available`,
 * `tool-approval-request` and `tool-output-available`.
 */
async function turn(cookies, { messages, eventName, eventSlug, knownTools }) {
  const res = await fetch(`${APP}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      Origin: APP,
    },
    body: JSON.stringify({
      id: "verify-copilot",
      messages,
      eventName,
      eventSlug,
    }),
  })
  if (!res.ok) {
    throw new Error(`chat failed: ${res.status} ${await res.text()}`)
  }

  const raw = await res.text()
  const events = []
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue
    const body = line.slice(6).trim()
    if (!body || body === "[DONE]") continue
    try {
      events.push(JSON.parse(body))
    } catch {
      // A partial frame at the tail is not a failure worth reporting.
    }
  }

  // A resumed (post-approval) turn only streams the OUTPUT event, which
  // carries no `toolName` — the name has to come from the call we approved.
  const names = new Map(knownTools ?? [])
  const tools = new Map()
  let text = ""
  let errored = null
  for (const event of events) {
    switch (event.type) {
      case "text-delta":
        text += event.delta ?? ""
        break
      case "tool-input-available":
        names.set(event.toolCallId, event.toolName)
        tools.set(event.toolCallId, {
          toolName: event.toolName,
          input: event.input,
          state: "input-available",
          output: undefined,
        })
        break
      case "tool-approval-request": {
        const entry = tools.get(event.toolCallId) ?? {
          toolName: event.toolName,
          input: event.input,
        }
        entry.state = "approval-requested"
        entry.approvalId = event.approvalId ?? event.approval?.id
        tools.set(event.toolCallId, entry)
        break
      }
      case "tool-output-available": {
        const entry = tools.get(event.toolCallId) ?? {}
        entry.toolName ??= names.get(event.toolCallId)
        entry.state = "output-available"
        entry.output = event.output
        tools.set(event.toolCallId, entry)
        break
      }
      case "tool-output-error": {
        const entry = tools.get(event.toolCallId) ?? {}
        entry.toolName ??= names.get(event.toolCallId)
        entry.state = "output-error"
        entry.errorText = event.errorText
        tools.set(event.toolCallId, entry)
        break
      }
      case "error":
        errored = event.errorText ?? "stream error"
        break
      default:
        break
    }
  }

  return { events, tools: [...tools.values()], text, errored, raw, names }
}

function userMessage(text) {
  return {
    id: `u-${Math.random().toString(36).slice(2)}`,
    role: "user",
    parts: [{ type: "text", text }],
  }
}

// ——— The prompts ———————————————————————————————————————————————————————————
//
// One per tool, worded the way an organizer would. `expect` is the tool we are
// verifying reached; `also` are tools the model legitimately chains through on
// the way (recorded as fixtures, never asserted).

const PROMPTS = [
  { id: "workspaces", text: "List my workspaces.", expect: "list_workspaces" },
  { id: "events", text: "What events do I have?", expect: "list_events" },
  {
    id: "summary",
    text: "What needs my attention on this event?",
    expect: "get_event_summary",
  },
  {
    id: "overview",
    // get_event_summary answers the same question, so the tool has to be
    // named unambiguously or the model reasonably reaches for the other one.
    text: "Call the get_event_overview tool for this event (not get_event_summary) and show me what it returns.",
    expect: "get_event_overview",
  },
  { id: "forms", text: "List the CFP forms.", expect: "list_forms" },
  {
    id: "form-detail",
    text: "Show me the full detail of the first CFP form, including its questions.",
    expect: "get_form",
  },
  {
    id: "form-link",
    // Named explicitly: list_forms also returns publicUrl, so an unqualified
    // "what's the link?" is legitimately answerable without this tool.
    text: "Use get_public_form_link to get the shareable submission link for the main CFP form.",
    expect: "get_public_form_link",
  },
  {
    id: "create-form",
    text: 'Create a new CFP form called "Copilot Verification CFP".',
    expect: "create_form",
  },
  {
    id: "submissions",
    text: "Show me the pending submissions.",
    expect: "list_submissions",
  },
  {
    id: "submission-detail",
    text: "Pick the first pending submission and show me everything about it.",
    expect: "get_submission",
  },
  { id: "agenda", text: "Show me the agenda.", expect: "get_agenda" },
  {
    id: "speakers",
    text: "Who is behind on their speaker tasks?",
    expect: "list_speakers",
  },
  {
    id: "portal-link",
    text: "Get the portal link for the first speaker on the roster.",
    expect: "get_speaker_portal_link",
  },
  {
    id: "templates",
    text: "List the email templates.",
    expect: "list_templates",
  },
  {
    id: "template-detail",
    text: "Show me the full accepted email template.",
    expect: "get_template",
  },
  { id: "outbox", text: "What's in the outbox?", expect: "list_outbox" },
  {
    id: "manual-session",
    text: 'Add a manual session called "Copilot Verification Keynote" with no speakers.',
    expect: "add_manual_session",
  },
  {
    id: "assign-task",
    text: 'Assign a task called "Copilot verification check" to the first speaker on the roster.',
    expect: "assign_task",
  },
  {
    id: "create-event",
    text: 'Create an event called "Copilot Verification Event".',
    expect: "create_event",
  },
  // Deliberately NOT in the approval list: neither is in DESTRUCTIVE_TOOLS
  // (src/lib/copilot.ts), so they must run unattended. If one of these ever
  // starts asking for approval, the destructive set has drifted.
  {
    id: "update-template",
    text: 'Update the reminder email template subject to "A quick nudge about {{eventName}}".',
    expect: "update_template",
  },
  {
    id: "schedule",
    text: 'Schedule "Copilot Verification Keynote" in the first room at 10:00 on the first day of the event for 30 minutes.',
    expect: "schedule_session",
  },
]

/**
 * Destructive prompts, run through the approval handshake: first the call must
 * SUSPEND, then we answer the approval and assert the tool ran.
 */
const APPROVALS = [
  {
    id: "send-reminders",
    text: "Send reminders to every speaker with open tasks.",
    expect: "send_reminders",
  },
  {
    id: "set-status",
    text: "Move the first pending submission into the accept queue.",
    expect: "set_submission_status",
  },
  {
    id: "commit-queue",
    text: "Commit the accept queue.",
    expect: "commit_decision_queue",
  },
  {
    id: "auto-place",
    text: "Auto-fill the agenda with the unscheduled sessions.",
    expect: "auto_place_sessions",
  },
  {
    id: "test-email",
    text: "Send me a test of the accepted email template.",
    expect: "send_test_email",
  },
  {
    id: "form-settings",
    text: 'Close the CFP form called "Copilot Verification CFP".',
    expect: "update_form_settings",
  },
  {
    id: "unschedule",
    text: "Take the first session on the agenda off its slot (unschedule it).",
    expect: "unschedule_session",
  },
  {
    id: "remove-task",
    text: "Remove the first outstanding task from the first speaker on the roster.",
    expect: "remove_task",
  },
  {
    id: "delete-form",
    // Deleting the form this run created — never a seeded one.
    text: 'Delete the CFP form called "Copilot Verification CFP".',
    expect: "delete_form",
  },
  {
    id: "delete-event",
    // Same: only the throwaway event this run created.
    text: 'Delete the event called "Copilot Verification Event".',
    expect: "delete_event",
  },
]

// ——— Run ———————————————————————————————————————————————————————————————————

const captured = {}

function record(tools) {
  for (const tool of tools) {
    if (tool.state !== "output-available" || !tool.toolName) continue
    // First win: the earliest call for a tool is the one with the plainest
    // arguments, which is what the renderer tests want to draw.
    if (!captured[tool.toolName]) {
      captured[tool.toolName] = { input: tool.input ?? {}, output: tool.output }
    }
  }
}

async function main() {
  console.log(`Copilot verification against ${APP}\n`)
  const cookies = await signIn()
  console.log("signed in as", DEMO.email, "\n")

  // Event context, exactly as the panel sends it.
  const eventsTurn = await turn(cookies, {
    messages: [userMessage("List my events.")],
  })
  const eventsTool = eventsTurn.tools.find((t) => t.toolName === "list_events")
  const firstEvent = eventsTool?.output?.events?.[0]
  const context = {
    eventName: firstEvent?.name,
    eventSlug: firstEvent?.slug,
  }
  console.log(`event context: ${context.eventName} (${context.eventSlug})\n`)
  record(eventsTurn.tools)

  for (const prompt of PROMPTS) {
    if (only && !prompt.id.includes(only)) continue
    console.log(`▸ ${prompt.id}: "${prompt.text}"`)
    const result = await turn(cookies, {
      messages: [userMessage(prompt.text)],
      ...context,
    })
    record(result.tools)
    const hit = result.tools.find((t) => t.toolName === prompt.expect)
    check(`${prompt.id} → called ${prompt.expect}`, Boolean(hit),
      hit ? "" : `called: ${result.tools.map((t) => t.toolName).join(", ") || "(none)"}`)
    if (hit) {
      check(
        `${prompt.id} → ${prompt.expect} produced output`,
        hit.state === "output-available" && hit.output !== undefined,
        hit.state === "output-error" ? hit.errorText : hit.state,
      )
    }
    check(`${prompt.id} → no stream error`, !result.errored, result.errored ?? "")
  }

  for (const prompt of APPROVALS) {
    if (only && !prompt.id.includes(only)) continue
    console.log(`▸ ${prompt.id} (approval): "${prompt.text}"`)
    const first = await turn(cookies, {
      messages: [userMessage(prompt.text)],
      ...context,
    })
    const suspended = first.tools.find((t) => t.toolName === prompt.expect)
    check(
      `${prompt.id} → ${prompt.expect} requested approval`,
      suspended?.state === "approval-requested",
      suspended ? suspended.state : `called: ${first.tools.map((t) => t.toolName).join(", ") || "(none)"}`,
    )
    check(
      `${prompt.id} → did NOT run unapproved`,
      !first.tools.some(
        (t) => t.toolName === prompt.expect && t.state === "output-available",
      ),
    )
    record(first.tools)

    // Approve: replay the assistant turn with the approval answered. The UI
    // does this automatically via `sendAutomaticallyWhen`.
    if (!suspended?.approvalId) continue

    const approvalTurn = await turn(cookies, {
      messages: [
        userMessage(prompt.text),
        {
          id: "a-1",
          role: "assistant",
          parts: first.events
            .filter((e) => e.type === "tool-input-available")
            .map((e) => ({
              type: "dynamic-tool",
              toolName: e.toolName,
              toolCallId: e.toolCallId,
              state: "approval-responded",
              input: e.input,
              approval: {
                id:
                  first.events.find(
                    (x) =>
                      x.type === "tool-approval-request" &&
                      x.toolCallId === e.toolCallId,
                  )?.approvalId ?? suspended.approvalId,
                approved: true,
              },
            })),
        },
      ],
      ...context,
      knownTools: first.names,
    })
    record(approvalTurn.tools)
    const ran = approvalTurn.tools.find(
      (t) => t.toolName === prompt.expect && t.state === "output-available",
    )
    const errored = approvalTurn.tools.find(
      (t) => t.toolName === prompt.expect && t.state === "output-error",
    )
    check(
      `${prompt.id} → ran after approval`,
      Boolean(ran),
      ran
        ? ""
        : (errored?.errorText ??
            approvalTurn.tools.map((t) => `${t.toolName}:${t.state}`).join(", ")),
    )
  }

  // ——— Coverage ————————————————————————————————————————————————————————————
  const ALL_TOOLS = [
    "list_workspaces", "list_events", "create_event", "get_event_overview",
    "list_forms", "get_form", "create_form", "update_form_settings",
    "get_public_form_link", "list_submissions", "get_submission",
    "set_submission_status", "commit_decision_queue", "add_manual_session",
    "get_agenda", "schedule_session", "unschedule_session",
    "auto_place_sessions", "list_speakers", "get_speaker_portal_link",
    "assign_task", "send_reminders", "list_templates", "get_template",
    "update_template", "list_outbox", "send_test_email", "delete_event",
    "delete_form", "remove_task", "get_event_summary",
  ]
  const missing = ALL_TOOLS.filter((name) => !captured[name])
  console.log(
    `\ncaptured payloads for ${Object.keys(captured).length}/${ALL_TOOLS.length} tools`,
  )
  if (missing.length > 0) console.log("  missing:", missing.join(", "))

  // Merged, never replaced — so a targeted `--only` run tops up one tool's
  // fixture without dropping the other 26.
  if (write) {
    mkdirSync(dirname(FIXTURES), { recursive: true })
    let existing = {}
    try {
      existing = JSON.parse(readFileSync(FIXTURES, "utf8"))
    } catch {
      existing = {}
    }
    writeFileSync(
      FIXTURES,
      `${JSON.stringify({ ...existing, ...captured }, null, 2)}\n`,
    )
    console.log(`wrote ${FIXTURES}`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failures.length > 0) {
    console.log("\nfailures:")
    for (const failure of failures) console.log(`  - ${failure}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

void env // .env.local is read for parity with the other scripts
main().catch((error) => {
  console.error(error)
  process.exit(1)
})

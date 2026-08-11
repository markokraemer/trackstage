#!/usr/bin/env node
// E2E proof of the MCP full-proxy surface + universal write gating against
// the live dev deployment. Read-only where possible; throwaway rows cleaned up.
import { ConvexHttpClient } from "convex/browser"
import { readFileSync } from "node:fs"
import { api } from "/Users/markokraemer/Projects/kortix/sessionboard/convex/_generated/api.js"

const env = Object.fromEntries(
  readFileSync("/Users/markokraemer/Projects/kortix/sessionboard/.env.local", "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)
const SITE_URL = env.VITE_CONVEX_SITE_URL
const MCP = `${SITE_URL}/mcp`
const client = new ConvexHttpClient(env.VITE_CONVEX_URL)

let passed = 0, failed = 0
const fails = []
const ok = (name, cond, detail = "") => {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; fails.push(name + (detail ? ` — ${detail}` : "")); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`) }
}

// Sign in as the demo organizer, mint a throwaway key.
const res = await fetch(`${SITE_URL}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
  body: JSON.stringify({ email: "organizer@demo.sessionboard.dev", password: "demo2026" }),
})
const setCookies = res.headers.getSetCookie?.() ?? []
const jwt = decodeURIComponent(setCookies.find((c) => c.includes("convex_jwt="))?.match(/convex_jwt=([^;]+)/)?.[1] ?? "")
client.setAuth(jwt)
const created = await client.mutation(api.apiKeys.create, { name: "mcp-e2e-proof" })
const KEY = created.key

let id = 0
const rpc = async (method, params) => {
  const r = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  })
  return await r.json()
}
const call = async (name, args = {}) => {
  const body = await rpc("tools/call", { name, arguments: args })
  const text = body?.result?.content?.[0]?.text ?? body?.error?.message ?? ""
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { isError: Boolean(body?.result?.isError) || Boolean(body?.error), text, json, rpcError: body?.error ?? null }
}

console.log("\n■ tools/list — surface + annotations")
const listed = await rpc("tools/list", {})
const tools = listed.result?.tools ?? []
ok("81 tools listed", tools.length === 81, `got ${tools.length}`)
const reads = tools.filter((t) => t.annotations?.readOnlyHint === true)
const writes = tools.filter((t) => t.annotations?.readOnlyHint !== true)
console.log(`    (${reads.length} reads, ${writes.length} writes)`)
ok("every tool carries full annotations",
  tools.every((t) => t.annotations && typeof t.annotations.readOnlyHint === "boolean" &&
    typeof t.annotations.destructiveHint === "boolean" &&
    typeof t.annotations.idempotentHint === "boolean" && t.annotations.openWorldHint === false))
ok("every WRITE schema requires confirm",
  writes.every((t) => t.inputSchema?.properties?.confirm && (t.inputSchema.required ?? []).includes("confirm")))
ok("no READ schema carries confirm", reads.every((t) => !t.inputSchema?.properties?.confirm))
ok("pure creates annotated destructiveHint:false",
  ["create_event", "create_form", "add_speaker", "assign_task", "add_evaluator"].every(
    (n) => tools.find((t) => t.name === n)?.annotations.destructiveHint === false))
ok("deletes annotated destructive+idempotent",
  ["delete_event", "delete_form", "remove_task", "delete_file"].every((n) => {
    const a = tools.find((t) => t.name === n)?.annotations
    return a?.destructiveHint === true && a?.idempotentHint === true
  }))
const expected = ["update_event","list_workspace_members","invite_workspace_member","update_workspace_member","remove_workspace_member","update_form","manage_form_question","update_submission","delete_submission","restore_submission","add_participant","remove_participant","set_agenda_published","add_speaker","update_speaker","remove_speaker","bulk_add_speakers","list_tasks","update_task","delete_task_template","list_files","review_file","delete_file","count_bulk_audience","send_bulk_email","list_evaluation_plans","get_evaluation_plan","create_evaluation_plan","update_evaluation_plan","delete_evaluation_plan","add_evaluator","update_evaluator","remove_evaluator","list_evaluations","distribute_evaluations","remind_evaluators","list_field_options","manage_room","manage_track","manage_field_option","manage_session_status","list_webhooks","manage_webhook","list_embeds","save_embed","delete_embed","list_activity"]
const names = new Set(tools.map((t) => t.name))
ok("all 47 new tools present", expected.every((n) => names.has(n)),
  expected.filter((n) => !names.has(n)).join(", "))

console.log("\n■ Universal gate — every write refuses without confirm")
const gateProbes = [
  ["create_form", { event: "ai-summit-2026", name: "Gate Probe" }],
  ["update_event", { event: "ai-summit-2026", venue: "Nope Hall" }],
  ["add_speaker", { event: "ai-summit-2026", email: "gate@example.com" }],
  ["set_agenda_published", { event: "ai-summit-2026", published: false }],
  ["manage_room", { event: "ai-summit-2026", action: "create", name: "Gate Room" }],
  ["send_bulk_email", { event: "ai-summit-2026", audience: "all_speakers", subject: "x", body: "y" }],
  ["save_embed", { event: "ai-summit-2026", name: "x", widget: "agenda" }],
  ["update_task", { event: "ai-summit-2026", taskId: "whatever" }],
]
for (const [name, args] of gateProbes) {
  const r = await call(name, args)
  ok(`${name} refused without confirm`, r.isError && /confirm: true/.test(r.text) && /user/i.test(r.text), r.text.slice(0, 90))
}
// Refusal must not have executed anything:
const forms0 = await call("list_forms", { event: "ai-summit-2026" })
ok("refused create_form left no form behind", !forms0.json.forms.some((f) => f.name === "Gate Probe"))

console.log("\n■ Reads run ungated")
const evList = await call("list_events", {})
const ORG = evList.json.events.find((e) => e.slug === "ai-summit-2026").organizationId
for (const name of ["list_events", "list_workspace_members", "list_field_options", "list_files", "list_activity", "count_bulk_audience", "list_evaluation_plans", "list_tasks", "list_embeds", "list_webhooks"]) {
  const args = name === "list_events" ? {} :
    name === "list_workspace_members" ? { workspace: ORG } :
    name === "list_field_options" ? { event: "ai-summit-2026", resource: "tracks" } :
    name === "count_bulk_audience" ? { event: "ai-summit-2026", audience: "accepted" } :
    name === "list_webhooks" ? {} :
    { event: "ai-summit-2026" }
  const r = await call(name, args)
  ok(`${name} runs without confirm`, !r.isError, r.text.slice(0, 120))
}

console.log("\n■ With confirm — the new write surface executes")
const C = { confirm: true }

// Events: update venue and revert.
const ev = await call("update_event", { event: "ai-summit-2026", venue: "Proof Hall", ...C })
ok("update_event executes", !ev.isError && ev.json?.data?.venue === "Proof Hall", ev.text.slice(0, 120))
await call("update_event", { event: "ai-summit-2026", venue: "Moscone West", ...C })

// Forms: create → update_form content → question CRUD → delete.
const form = await call("create_form", { event: "ai-summit-2026", name: `Proxy Form ${Date.now().toString(36)}`, ...C })
ok("create_form executes with confirm", !form.isError && form.json?.formId)
const fSlug = form.json.slug
const uf = await call("update_form", { form: fSlug, pageHeading: "Proof Heading", notifyEmails: ["ops@example.com"], speakerMax: 3, ...C })
ok("update_form edits content + participant rules", !uf.isError, uf.text.slice(0, 140))
const q = await call("manage_form_question", { event: "ai-summit-2026", action: "create", form: form.json.formId, label: "Proof Question", type: "short_text", ...C })
ok("manage_form_question creates", !q.isError && q.json?.data?.internal_name, q.text.slice(0, 120))
const qd = await call("manage_form_question", { event: "ai-summit-2026", action: "delete", questionId: q.json.data.internal_name, ...C })
ok("manage_form_question deletes", !qd.isError && qd.json?.deleted === true)
const fd = await call("delete_form", { form: fSlug, ...C })
ok("delete_form cleans up", !fd.isError && fd.json?.deleted === true)

// Speakers: add → update → tasks → files → remove.
const spEmail = `proxy-speaker-${Date.now().toString(36)}@example.com`
const sp = await call("add_speaker", { event: "ai-summit-2026", email: spEmail, firstName: "Proxy", lastName: "Speaker", ...C })
ok("add_speaker executes", !sp.isError && sp.json?.data?.email === spEmail)
const spu = await call("update_speaker", { event: "ai-summit-2026", speaker: spEmail, company: "Proof Co", publicVisible: false, ...C })
ok("update_speaker patches profile + embargo", !spu.isError && spu.json?.data?.company_name === "Proof Co")
const bulk = await call("bulk_add_speakers", { event: "ai-summit-2026", rows: [{ email: spEmail, company: "Ignored — not blank" }, { email: `proxy-b-${Date.now().toString(36)}@example.com`, firstName: "Bee" }], ...C })
ok("bulk_add_speakers adds + skips", !bulk.isError && bulk.json?.added === 1 && bulk.json?.total === 2, bulk.text.slice(0, 120))
const bEmail = bulk.json.results.find((r) => r.outcome === "added")?.email

// Tasks: assign → list → update (complete) → template CRUD.
const task = await call("assign_task", { event: "ai-summit-2026", speakers: [spEmail], title: "Proxy task", ...C })
ok("assign_task (existing tool) still works", !task.isError && task.json?.created === 1)
const tl = await call("list_tasks", { event: "ai-summit-2026", speaker: spEmail })
const taskRow = tl.json?.data?.find?.((t) => t.title === "Proxy task") ?? tl.json?.results?.find?.((t) => t.title === "Proxy task")
ok("list_tasks sees it", Boolean(taskRow), tl.text.slice(0, 140))
const tu = await call("update_task", { event: "ai-summit-2026", taskId: taskRow?.id, completed: true, ...C })
ok("update_task completes it", !tu.isError && tu.json?.data?.completed_at, tu.text.slice(0, 120))
const tmpl = await call("save_task_template", { event: "ai-summit-2026", title: `Proxy template ${Date.now().toString(36)}`, ...C })
const tmplDel = await call("delete_task_template", { template: tmpl.json.templateId, ...C })
ok("delete_task_template removes it", !tmplDel.isError && tmplDel.json?.deleted === true)

// Files: list + review round-trip on an existing upload, if any.
const files = await call("list_files", { event: "ai-summit-2026" })
ok("list_files returns the library", !files.isError && typeof files.json?.total === "number")
const someFile = files.json.files?.[0]
if (someFile) {
  const prev = someFile.approvalStatus
  const rf = await call("review_file", { fileId: someFile.fileId, approvalStatus: "approved", reviewNote: "Proof pass", ...C })
  ok("review_file approves", !rf.isError && rf.json?.approvalStatus === "approved")
  await call("review_file", { fileId: someFile.fileId, approvalStatus: prev, ...C })
} else ok("review_file skipped (no uploads in seed)", true)

// Submissions: pick one, edit, participants, trash/restore.
const subs = await call("list_submissions", { event: "ai-summit-2026", status: "pending", limit: 1 })
const subId = subs.json?.submissions?.[0]?.submissionId
const us = await call("update_submission", { submissionId: subId, tags: ["proxy-proof"], ...C })
ok("update_submission edits tags", !us.isError && JSON.stringify(us.json?.data?.tags ?? []).includes("proxy-proof"), JSON.stringify(us.json?.data?.tags ?? "").slice(0, 140))
const ap = await call("add_participant", { submissionId: subId, speaker: spEmail, role: "moderator", ...C })
ok("add_participant attaches by email", !ap.isError, ap.text.slice(0, 140))
const rp = await call("remove_participant", { submissionId: subId, speaker: spEmail, ...C })
ok("remove_participant detaches", !rp.isError)
const del = await call("delete_submission", { submissionId: subId, ...C })
ok("delete_submission soft-deletes", !del.isError && del.json?.data?.deleted_at, del.text.slice(0, 120))
const rest = await call("restore_submission", { event: "ai-summit-2026", submissionId: subId, ...C })
ok("restore_submission brings it back", !rest.isError && !rest.json?.data?.deleted_at)

// Speaker removal now that they're off the session.
const spDel = await call("remove_speaker", { event: "ai-summit-2026", speaker: spEmail, ...C })
ok("remove_speaker deletes the throwaway person", !spDel.isError, spDel.text.slice(0, 140))
if (bEmail) await call("remove_speaker", { event: "ai-summit-2026", speaker: bEmail, ...C })

// Evaluation: plan → evaluator → distribute → scorecards → remind gate → delete.
const plan = await call("create_evaluation_plan", { event: "ai-summit-2026", name: `Proxy Round ${Date.now().toString(36)}`, blind: true, ...C })
ok("create_evaluation_plan executes", !plan.isError && plan.json?.data?.id, plan.text.slice(0, 140))
const planId = plan.json?.data?.id
const evl = await call("add_evaluator", { event: "ai-summit-2026", planId, email: "proxy-reviewer@example.com", name: "Proxy Reviewer", ...C })
if (evl.isError || !evl.json?.data?.id) { console.log("  ! evaluator failed:", evl.text.slice(0, 200)) }
ok("add_evaluator returns the magic review link", !evl.isError && evl.json?.data?.review_path?.startsWith("/review/"))
const dist = await call("distribute_evaluations", { planId, perReviewerCap: 5, ...C })
ok("distribute_evaluations assigns round-robin", !dist.isError && typeof dist.json?.assigned === "number", dist.text.slice(0, 140))
const ue = await call("update_evaluator", { event: "ai-summit-2026", evaluatorId: evl.json.data.id, assignedSubmissionIds: [], ...C })
ok("update_evaluator resets to whole pool", !ue.isError)
const scores = await call("list_evaluations", { event: "ai-summit-2026", planId })
ok("list_evaluations reads scorecards", !scores.isError)
const remindGate = await call("remind_evaluators", { planId })
ok("remind_evaluators gated without confirm", remindGate.isError && /confirm: true/.test(remindGate.text))
const re = await call("remove_evaluator", { event: "ai-summit-2026", evaluatorId: evl.json.data.id, ...C })
ok("remove_evaluator deletes reviewer + scores", !re.isError)
const pd = await call("delete_evaluation_plan", { event: "ai-summit-2026", planId, ...C })
ok("delete_evaluation_plan cleans up", !pd.isError)

// Setup: room + track + option + status lifecycles.
const room = await call("manage_room", { event: "ai-summit-2026", action: "create", name: `Proof Room ${Date.now().toString(36)}`, capacity: 42, ...C })
ok("manage_room creates", !room.isError && room.json?.data?.id)
const roomDel = await call("manage_room", { event: "ai-summit-2026", action: "delete", roomId: room.json.data.id, ...C })
ok("manage_room deletes", !roomDel.isError)
const track = await call("manage_track", { event: "ai-summit-2026", action: "create", name: `Proof Track ${Date.now().toString(36)}`, color: "#0F6E70", ...C })
ok("manage_track creates", !track.isError && track.json?.data?.id)
await call("manage_track", { event: "ai-summit-2026", action: "delete", trackId: track.json.data.id, ...C })
const opt = await call("manage_field_option", { event: "ai-summit-2026", resource: "tags", action: "create", name: "proxy-proof-tag", ...C })
ok("manage_field_option adds a tag option", !opt.isError, opt.text.slice(0, 120))
await call("manage_field_option", { event: "ai-summit-2026", resource: "tags", action: "delete", value: "proxy-proof-tag", ...C })
const status = await call("manage_session_status", { event: "ai-summit-2026", action: "create", name: `Proxy Waitlist ${Date.now().toString(36)}`, category: "pending", color: "amber", ...C })
ok("manage_session_status creates a label", !status.isError && status.json?.data?.status_id, status.text.slice(0, 140))
await call("manage_session_status", { event: "ai-summit-2026", action: "delete", statusId: status.json?.data?.status_id, ...C })

// Webhooks: create → test → rotate → delete.
const hook = await call("manage_webhook", { action: "create", event: "ai-summit-2026", url: "https://example.com/hook", events: ["submission.created"], ...C })
ok("manage_webhook create returns the secret once", !hook.isError && hook.json?.data?.secret?.startsWith("whsec_"), hook.text.slice(0, 140))
const hookId = hook.json?.data?.id
const hookTest = await call("manage_webhook", { action: "test", webhookId: hookId, ...C })
ok("manage_webhook test queues a signed delivery", !hookTest.isError)
const hookRot = await call("manage_webhook", { action: "rotate", webhookId: hookId, ...C })
ok("manage_webhook rotate mints a new secret", !hookRot.isError && hookRot.json?.data?.secret?.startsWith("whsec_"))
const hookRead = await call("list_webhooks", { webhookId: hookId })
ok("list_webhooks reads one endpoint + deliveries", !hookRead.isError && Array.isArray(hookRead.json?.data?.deliveries))
await call("manage_webhook", { action: "delete", webhookId: hookId, ...C })

// Embeds.
const emb = await call("save_embed", { event: "ai-summit-2026", name: "Proof embed", widget: "agenda", format: "iframe", ...C })
ok("save_embed creates", !emb.isError && emb.json?.embedId)
const embDel = await call("delete_embed", { embedId: emb.json.embedId, ...C })
ok("delete_embed removes", !embDel.isError && embDel.json?.deleted === true)

// Agenda publish toggle (read current state via REST first, restore after).
const evRead = await fetch(`${SITE_URL}/v1/events`, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json())
const wasPublished = Boolean(evRead.data?.find?.((e) => e.slug === "ai-summit-2026")?.agenda_published_at)
const pub = await call("set_agenda_published", { event: "ai-summit-2026", published: !wasPublished, ...C })
ok("set_agenda_published toggles", !pub.isError)
await call("set_agenda_published", { event: "ai-summit-2026", published: wasPublished, ...C })

// Workspace members: list; invite + role-change + remove on a throwaway.
const members = await call("list_workspace_members", { workspace: ORG })
ok("list_workspace_members reads the roster", !members.isError && members.json?.members?.length >= 1)
const invEmail = `proxy-invite-${Date.now().toString(36)}@example.com`
const inv = await call("invite_workspace_member", { workspace: ORG, email: invEmail, role: "member", eventRefs: ["ai-summit-2026"], ...C })
ok("invite_workspace_member invites, event-scoped", !inv.isError && inv.json?.invited === invEmail, inv.text.slice(0, 140))
const after = await call("list_workspace_members", { workspace: ORG })
const invited = after.json.members.find((m) => m.email === invEmail)
ok("invite shows with 1-event scope", invited && invited.eventScope?.length === 1)
const upd = await call("update_workspace_member", { memberId: invited.memberId, eventRefs: [], ...C })
ok("update_workspace_member clears the scope", !upd.isError && upd.json?.eventScope === "all events")
const rm = await call("remove_workspace_member", { memberId: invited.memberId, ...C })
ok("remove_workspace_member removes", !rm.isError && rm.json?.removed === true)

// Activity: the audit trail shows this session's MCP writes.
const act = await call("list_activity", { event: "ai-summit-2026", filter: "agents", limit: 20 })
ok("list_activity agents lens shows MCP writes",
  !act.isError && act.json.activity.some((r) => r.actorType === "mcp" && /via MCP/.test(r.summary)), act.text.slice(0, 160))

// Bulk audience count (read) sanity: matches what send would target.
const cnt = await call("count_bulk_audience", { event: "ai-summit-2026", audience: "incomplete_tasks" })
ok("count_bulk_audience counts an audience", !cnt.isError && typeof cnt.json?.recipients === "number")

console.log(`\n${passed} passed, ${failed} failed`)
if (fails.length) { console.log(fails.map((f) => `  ✗ ${f}`).join("\n")); process.exitCode = 1 }

// Cleanup: revoke the throwaway key.
await client.mutation(api.apiKeys.revoke, { keyId: created.keyId })
console.log("throwaway API key revoked")

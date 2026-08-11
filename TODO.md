# TODO — master tracker

Source of truth for everything Marko asked + build status. Update continuously.
✅ done · 🔨 in progress · ⏳ queued · 💤 stretch/end

## Product build
- ✅ Stack scaffold (TanStack Start + Convex + shadcn/Base UI + CF Workers), verified e2e
- ✅ Full ingestion: video (4× Gemini 3.6 Flash via OpenRouter), 42 screenshots, brief,
  swyx clarifications, competitor research
- ✅ docs/SPEC.md + docs/memory (RULES/DECISIONS/BUILD-LOG) + AGENTS.md hub
- ✅ sbek eval kit cloned → ~/Projects/kortix/sbek + private mirror github.com/markokraemer/killmysaas-evals-mirror
- ✅ Convex schema v2 (SPEC §5 + rubric amendments) pushed
- 🔨 Backend contract: auth/events done; forms/submit/submissions/agenda/portal (orchestrator);
  comms+ics+seed (agent); evaluations+dashboard+public+API (agent)
- 🔨 Foundation UI: tokens, shell, login, shared primitives + custom logo/brand +
  /design-system page with all components laid out (agent; rules 17/18)
- 🔨 sbek rubric digest → docs/reference/sbek-rubric.md (agent)
- ⏳ UI slices via Workflow: form builder · public submit flow · submissions table ·
  decisions/queues · agenda (drag-drop + conflicts) · speaker portal · dashboard/speakers ·
  evaluation · communications · public widgets (schedule/speakers/sessions/itinerary/gallery)
- ✅ Content management depth: file versions + approval flow UI — DONE 2026-08-11: the
  submission drawer's Files tab is the organizer surface (real `_storage` metadata, image
  thumbnails, version history with sha256 duplicate detection, approve, delete-a-version,
  attach-on-behalf-of-a-speaker, Download all as one zip); speaker side gets drag-drop with
  live progress. A standalone event-wide Files library page is still open — see [14]
- ✅ Hierarchy + three-level settings IA (rule 23): sidebar event block IS the event
  switcher (grouped by workspace, All events, + New event); avatar menu = Account
  settings (/app/account) + Workspace settings (/app/workspace) + workspace switcher;
  /app/settings retitled "Event settings — {event}"; Team moved out of event settings;
  every screen resolves the event through `src/lib/current-event.ts`
- ⏳ AI agenda: auto-place scheduler (backend done: agenda.autoPlace) + UI button
- ⏳ sbek gap follow-ups (from docs/reference/sbek-rubric.md GAPS): embed generator page
  (/app/embeds, EMB-15) ✅in slice · itinerary widget ✅in slice · blind review (schema
  flag added; evaluation UI + review.ts must respect it — VERIFY at integration) ·
  organizer task creation ✅tasksAdmin · bulk email compose to filtered speakers
  ✅comms.composeBulk + Compose dialog · change history/restore on
  content edits (CNT-11 — decide: cheap audit-log table or accept the gap) · Speaker CRM
  optional area (19pts extra credit, needs cross-event speaker reuse — decide after v1)
- ⏳ Public API (/v1) + README docs (bonus)
- ✅ MCP server (rule 21): 27 tools over MCP Streamable HTTP at `{CONVEX_SITE_URL}/mcp`,
  personal API keys (`sb_live_…`, hashed) + Better Auth OAuth 2.1 (DCR + PKCE) so Claude/
  ChatGPT "add connector by URL" just works; Settings → API & MCP tab with per-client
  setup snippets; verify-backend MCP section green (122/122)
- ✅ AI copilot chat (rule 24 — the MCP's home): `/api/chat` (AI SDK v7 `streamText` +
  OpenRouter `google/gemini-3.5-flash`) loads OUR MCP tools over Streamable HTTP with a
  server-managed per-user key; destructive tools gated by v7 `toolApproval:
  "user-approval"` + `addToolApprovalResponse`; AI Elements chat UI with generative tool
  results; side panel (⌘I) on every organizer screen + full page at `/app/copilot`,
  conversation shared and persisted per event
- ⏳ Seed: rich demo world, judge-friendly demo-mode links
- ✅ Airtable one-click one-way sync (rule 15): Settings → Integrations, PAT + base ID,
  auto-creates Submissions/Speakers/Sessions, idempotent PATCH upsert on the
  "Sessionboard ID" column, on-write (~5s debounced) + every-5-min cron. Needs a REAL
  Airtable PAT from Marko for a live end-to-end proof; `AIRTABLE_DEMO_MODE=1` on the
  deployment makes it demo-able without one

## Emails (rule 18e — Resend key live on deployment)
- ✅ Speaker comms via Resend (real recipients send; @example.com demo → preview)
- ✅ Workspace invite emails (addMember → platformEmails.sendWorkspaceInvite)
- ⏳ Password reset email via Better Auth sendResetPassword wiring
- ⏳ Verify a real delivery end-to-end to Marko's inbox (needs a real recipient)

## Testing (harness live)
- ✅ pnpm test (vitest unit, ics 7/7) · pnpm test:backend (78/78) · pnpm test:e2e
  (Playwright: auth setup w/ hydration-retry, route crawler failing on ANY console
  error/boundary, smoke specs). test:all runs everything.
- 🔨 e2e currently 16/26 green — failures are in-flight slice churn (HMR duplication,
  typed-Link to unbuilt routes); crawler PENDING routes get promoted to LIVE at
  integration, then full suite must be green
- ⏳ Post-workflow: per-flow deep e2e specs (form builder → publish → public submit →
  queues → agenda drag → portal → evaluation), then keep green through reconciliation

## Integration-gate flags (from hierarchy agent handoff)
- ⏳ ~10 remaining `render={<a>/<Link>}` without nativeButton={false} (evaluation, agenda,
  submissions, marketing, public) — crawler will catch; sweep at reconciliation
- ⏳ /app intermittent SSR error "null useRef" from copilot/ai-elements dependency — investigate
- ⏳ Move /app/settings/api-mcp → /app/account/api-mcp (account-level by nature)
- ⏳ Dev deployment has stray "MCP Test Event" from live-fire suite — reseed before demos

## MCP ergonomic fixes (from live-fire test — docs/reference/mcp-live-test.md)
- ⏳ Add deletion tools: delete_event / delete_form / remove_task (the one asterisk on
  "do everything via MCP")
- ⏳ Fix list_speakers onlyWithOutstandingWork semantics (returned 11, model said 8)
- ⏳ Merge/rename get_event_overview (loses tool-selection to get_event_summary/get_agenda)
- ⏳ Cap verbose payloads (get_form/get_agenda/list_templates multi-KB) + normalize field
  names (closeAt vs closesAt)
- ✅ (fixed in test) arg validation + userId leak · error hygiene · template key guard
- NOTE: loopback portal/public URLs resolve at prod SITE_URL

## Quality / hill-climb
- ⏳ First full pass review vs screenshots + video (UX 1:1 check), then vs SPEC acceptance
  criteria
- ⏳ sbek run against deployed site → fix → rerun (hill-climb loop); Fable final passes
- ⏳ Speed pass (swyx's #1 complaint about Sessionboard is slowness)
- ⏳ e2e flows work via plain links/forms/buttons (browser-agent judge)

## Ship
- ⏳ Deploy: convex deploy + wrangler deploy (workers.dev), custom domain optional
- ⏳ Landing page: really good + simple; CTAs = open source (GitHub), try demo/sign up,
  "Declare the winner" → $10k Stripe checkout link (constant in code; Marko supplies link)
- ⏳ README: product tour, self-host, API docs, screenshots
- ⏳ Submission: fill swyx's form, flip repo public, submissionNotes for sbek config
- ⏳ Manual verification prep: .ics imports (Google/Apple/Outlook), email previews

## Coverage audit gaps
From `docs/reference/coverage-matrix.md` (2026-08-11, 175 items · 124 covered · 19 partial ·
31 missing). Ranked by judging impact; items already tracked elsewhere in this file are NOT
repeated here. Effort: XS <30min · S ~1h · M ~half day · L ~a day+.

- ⏳ **[1] Submission confirmation email never sent** (sbek CFP-08) — `sendConfirmationEmail`
  is stored in `forms.settings` and read by nothing; `convex/submit.ts` has no queue call. S
- ⏳ **[2] `notifyEmails` never sent** — the whole Notifications wizard step is inert; stored
  in `schema.ts:147`, no send path reads it. swyx demoed this step at [05:38]. S
- ⏳ **[4] Speaker edit-lock after CFP close** (sbek CFP-16) — `convex/portal.ts:updateSubmission`
  checks status but not `isFormOpen`. One call; `isFormOpen` already exists. XS
- ✅ **[5] Explicit "Publish agenda / Go live" action** (sbek AIA-07 `handoff`) — DONE
  (parity wave 1): `events.agendaPublishedAt` + `agenda.publishAgenda`/`unpublishAgenda`,
  toolbar button + confirm dialog ↔ `Published · date` / Unpublish, and `publicData` returns
  `publicMessage: "Schedule coming soon"` with no sessions until it's set. Seed publishes the
  main demo event; Design Systems Day stays unpublished as the gate fixture.
- ✅ **[6] Agenda Week view + Track view** — DONE (parity wave 1). All five brief-named views
  now ship: `?view=list|day|week|track|rooms` (+ conflicts). Week = 7 day columns at half
  zoom; Track = the day grid with tracks as columns, parallel same-track sessions laned
  side by side, plus a "No track" column when needed.
- ⏳ **[7] Content-approval gate on sessions** (sbek CNT-12 `rule`) — distinct from the existing
  `uploads.approvalStatus` file review; unapproved content must stay out of public output. M
- ✅ **[8] Manual "Add speaker" + speaker workflow status + organizer-side bio/headshot edit**
  (sbek SPK-02 w3 / SPK-04 / CNT-10) — DONE (parity wave 1): `convex/speakersAdmin.ts`
  (addManual / updateProfile / setWorkflowStatus), optional `people.workflowStatus` +
  `people.headshotNote`, `[Add speaker]` dialog, inline status chip + "Any status" filter on
  the roster, and a profile drawer with editable bio. Hand-added speakers show on the roster
  before they have an accepted session.
- ✅ **[9] General bulk-email composer to filtered speakers** (sbek SPK-13 w3 `bulk`) — DONE
  (parity wave 1): `comms.composeBulk` + `comms.recipientCount` (all speakers / accepted /
  incomplete tasks / manual picks), `[Compose]` on Communications with merge-field chips and a
  live recipient count; every message lands in the ordinary outbox.
- ✅ **[10] Event logo + background image upload** — DONE 2026-08-11: Settings → Event details
  → Branding card (`convex/files.ts` `setEventBranding`, drag-drop + previews + remove);
  `events.backgroundId` added; the logo renders in the `/e/` public header and the speaker
  portal header, the background as a tinted hero, both with a text fallback.
- ⏳ **[11] Submissions table: Columns chooser · Saved Views · Import Sessions · Export XLSX ·
  ~~Download files bundle~~** — all in the brief screenshots + video Options menu [03:56]. M
  ("Download files bundle" DONE 2026-08-11 per submission, in the drawer's Files tab, via the
  dependency-free zip writer in `src/lib/zip.ts` — reuse it for a table-wide bundle.)
- ✅ **[12] Embed generator: saved-embeds list + format picker** — DONE (parity wave 1):
  `embeds` table + `convex/embeds.ts` CRUD, a saved-embeds shelf that reloads a configuration,
  and a format step (embedded widget / direct link / static HTML / JSON feed / calendar feed).
  XML deliberately skipped — nobody consuming this asks for it, and a format we can't render
  honestly is worse than one we don't offer.
- ⏳ **[13] Portal forms as a task type** — the brief has a 5-screenshot "Portal > Forms"
  section (+ confirmation email). **Parity wave 1 stopped OFFERING the dead option**: `form`
  is gone from the Assign-task dialog and the MCP `assign_task` enum (Marko: a task type
  nothing can complete is worse than no task type). The backend validator still ACCEPTS it so
  any existing row stays valid. Build the real thing, or leave it removed. M
- ⏳ **[14] Files library page** (sbek CNT-13) — `tasksAdmin.listUploads` is already written and
  has no UI consumer. Thin read-model page. S
- ⏳ **[15] Scorecard depth**: dropdown + free-text criteria types (ABS-03 w3), criteria weights
  (ABS-04), per-reviewer caps / auto-distribute / track-filtered bulk assign (ABS-06). M
- ⏳ **[16] Evaluation tabs + reviewer ops**: Evaluator Tags tab, My Evaluations tab, bulk-remind
  lagging reviewers (ABS-09), conflict-of-interest/recusal (ABS-12). M
- ✅ **[17] `autoRedirectToPortal` honoured** — DONE (parity wave 1): the submit success card
  counts the redirect down out loud (3s) with a "Stay here" cancel.
- ⏳ **[18] Abstracts vs Sessions view switcher** + table/drawer fields Client Session ID,
  Starts/Ends At, Capacity, CEU Credits, Location, Notified. M
- ⏳ **[19] Email theme (custom HTML/CSS header/footer)**; Settings sub-nav has no route to
  Email templates (they live only under Communications); dashboard has no Today / Review
  Progress / Speaker Tracking / Submissions Pipeline sub-tabs. M
- ⏳ **[20] Portal profile fidelity** — rich-text biography, Honorific/Gender/Address fields,
  Facebook link. S
- ⏳ **[22] Form builder fidelity** — Abstract-section heading/instructions, US-vs-International
  phone option, min/max for Chairperson/Moderator, cross-field character limits. M
  (multi-language toggle deliberately skipped — swyx: "we only care about English")
- 💤 Exhibitors & Sponsors toggles/metric — shown at [02:46] but swyx scopes that column OUT.
- ⚠️ **PARTIAL risk, not a new task**: `evaluationPlans` assigns `submissionIds[]` and
  evaluators plan-wide, so two evaluators on one plan share an identical queue — sbek ABS-05
  (`scoping`) may read as PARTIAL. Fold into [15] if per-reviewer assignment is built.

## Standing process
- ✅ Git repo = source of truth; commit+push incrementally; no Claude co-author
- 🔁 Keep RULES/DECISIONS/BUILD-LOG/TODO current every session; heavy subagents + Workflow

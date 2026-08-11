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
- ⏳ Content management depth: file versions + approval flow UI (sbek area, 15%) —
  backend done (uploads versioning + tasksAdmin.reviewUpload); needs organizer UI surface
- ⏳ Multi-event support surfaced in UI (event switcher; scoping proven) — sbek judged
- ⏳ AI agenda: auto-place scheduler (backend done: agenda.autoPlace) + UI button
- ⏳ sbek gap follow-ups (from docs/reference/sbek-rubric.md GAPS): embed generator page
  (/app/embeds, EMB-15) ✅in slice · itinerary widget ✅in slice · blind review (schema
  flag added; evaluation UI + review.ts must respect it — VERIFY at integration) ·
  organizer task creation ✅tasksAdmin · bulk email compose to filtered speakers (comms
  slice will flag; add backend compose fn at integration) · change history/restore on
  content edits (CNT-11 — decide: cheap audit-log table or accept the gap) · Speaker CRM
  optional area (19pts extra credit, needs cross-event speaker reuse — decide after v1)
- ⏳ Public API (/v1) + README docs (bonus)
- ✅ MCP server (rule 21): 27 tools over MCP Streamable HTTP at `{CONVEX_SITE_URL}/mcp`,
  personal API keys (`sb_live_…`, hashed) + Better Auth OAuth 2.1 (DCR + PKCE) so Claude/
  ChatGPT "add connector by URL" just works; Settings → API & MCP tab with per-client
  setup snippets; verify-backend MCP section green (122/122)
- ⏳ Seed: rich demo world, judge-friendly demo-mode links
- 💤 Airtable one-click one-way sync (submissions/speakers/sessions rows; idempotent;
  swyx: read-only mirror is enough — their automations fire on new rows)

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

## Standing process
- ✅ Git repo = source of truth; commit+push incrementally; no Claude co-author
- 🔁 Keep RULES/DECISIONS/BUILD-LOG/TODO current every session; heavy subagents + Workflow

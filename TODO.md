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
  (/app/embeds, EMB-15) ✅in slice · itinerary widget ✅in slice · blind review ✅DONE
  (2026-08-11 — enforced in `review.queue`, switch in the plan dialog, badge on /review) ·
  organizer task creation ✅tasksAdmin · bulk email compose to filtered speakers
  ✅comms.composeBulk + Compose dialog · change history/restore on
  content edits (CNT-11 — decide: cheap audit-log table or accept the gap) · Speaker CRM
  optional area (19pts extra credit, needs cross-event speaker reuse — decide after v1)
- ⏳ Public API (/v1) + README docs (bonus)
- ✅ MCP server (rule 21): 31 tools over MCP Streamable HTTP at `{CONVEX_SITE_URL}/mcp`,
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
- ✅ Password reset, end to end: `emailAndPassword.sendResetPassword` → `requireActionCtx(ctx)`
  → scheduled `platformEmails.sendPasswordReset` (shared `sendTransactionalEmail` helper);
  "Forgot password?" + `/login?mode=forgot` receipt; `/reset-password` route incl. the
  expired-link page. Proven live by `scripts/verify-password-reset.mjs` (14/14: real emailed
  link → new password signs in, old one 401s, token can't be replayed, no account enumeration)
  + `tests/e2e/flows/password-reset.spec.ts` (4/4)
- ✅ Verified a real delivery end-to-end (Resend accepted, `sent: true`, to marko@kortix.ai)
- ✅ **Resend test mode RESOLVED 2026-08-11** — `trackstage.app` is registered and
  **verified** on Resend (DKIM + SPF green). Prod `EMAIL_FROM` is now
  `Trackstage <hello@trackstage.app>`, so real mail goes to real recipients from the
  production deployment. (Dev deployment still sends from `onboarding@resend.dev` until
  it is flipped too.)

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
**Fix pass shipped 2026-08-11 — surface is now 31 tools (was 27); fix-list items 1–8 done.**
- ✅ Deletion tools: `delete_event` (admin + `confirm:true` + `confirmName` matching the
  event name exactly; runs the web app's own cascade via the extracted
  `events.deleteEventCascade`, storage sweep included, returns a receipt) ·
  `delete_form` (admin + confirm; refuses any form with submissions, names
  "close it instead") · `remove_task` (admin; inverse of assign_task). `complete_task`
  deliberately NOT added — completion is the speaker's act in their portal
- ✅ list_speakers semantics: `onlyWithOutstandingWork` = EXACTLY ≥1 incomplete task;
  new `includeProfileGaps` opt-in; per-row `outstandingReason`; response states its own
  counts (`summary` sentence + totalSpeakers/returned/withOpenTasks/withProfileGaps)
- ✅ get_event_overview MERGED into get_event_summary (kept as a deprecated alias with an
  identical payload); both descriptions now disclaim each other and get_agenda
- ✅ Payload caps: get_form options ≤10 + "…N more" · get_agenda ≤40 rows each side +
  `byRoom` roll-up + counts · list_templates 200-char previews + new `get_template` for
  the full body. Field names normalized: `closeAt` and `acceptedNotScheduled` everywhere
- ✅ Loopback links carry `linkWarning` ("demo URL — set SITE_URL in production"); the URL
  itself stays machine-clean so copy-to-clipboard still works
- ✅ Also from the fix list: send_test_email.to wording (no invented recipients) ·
  create_form/update_form_settings echo `name`, add_manual_session echoes `format`/`track`
- ✅ (fixed in test) arg validation + userId leak · error hygiene · template key guard
- ⏭ NOT taken: trimming the tool count below Claude Code's deferral threshold (deletion +
  caps were worth more than the one-off schema-fetch tax). Still open: collapsing
  `get_public_form_link` into list_forms/get_form — the one redundant tool left
- ⏳ Docs-only leftover: README Authorization section should say a revoked API key surfaces
  in Claude Code as a "requires re-authorization" prompt (spec-correct, but surprising)

## Post-deploy follow-ups
- ⏳ jwks_uri 404: discovery docs advertise /api/auth/mcp/jwks which 404s (pre-existing);
  strict MCP clients fetching jwks would fail — register the route or fix the URL (rule 21 owner)
- ⏳ Raster brand assets show old wordmark: og-image.png, icon-192/512.png, favicon.ico —
  regenerate from /design-system generators (with screenshot recapture wave)
- ✅ www.trackstage.app → apex 301 redirect (DNS + redirect rule)

## Post-rename cleanup
- ⏳ Re-run scripts/capture-screenshots.mjs + capture-walkthrough: form-builder.png shows
  an error state, in-shot sidebar still reads "Sessionboard" (pre-rename). Run after
  deploy agent lands + dev server settles.

## Quality / hill-climb
- ⏳ First full pass review vs screenshots + video (UX 1:1 check), then vs SPEC acceptance
  criteria
- ⏳ sbek run against deployed site → fix → rerun (hill-climb loop); Fable final passes
- ⏳ Speed pass (swyx's #1 complaint about Sessionboard is slowness)
- ⏳ e2e flows work via plain links/forms/buttons (browser-agent judge)

## Ship
- ✅ **Deploy — LIVE 2026-08-11**: prod Convex `keen-eagle-41` (deployed + seeded + all env
  set) · Cloudflare Worker `trackstage` on **https://trackstage.app** (custom domain,
  `trackstage.kortix.workers.dev` kept as fallback origin). `.env.production` (committed,
  public values) bakes the prod Convex URLs into every production build;
  `OPENROUTER_API_KEY` is a Worker secret. Verified: 6 SSR routes 200, sign-in 200,
  `/v1` 200 with the real `PUBLIC_API_TOKEN`, `/mcp` 401+resource_metadata challenge,
  OAuth discovery advertising the `https://trackstage.app` issuer.
- ✅ **CI/CD**: `.github/workflows/ci.yml` (typecheck · lint · unit on push/PR to master)
  gates `deploy.yml` via `workflow_run` (convex deploy → build → wrangler deploy →
  `scripts/smoke-production.mjs`). Secrets set: `CONVEX_DEPLOY_KEY`,
  `CLOUDFLARE_API_TOKEN` (scoped, not the global key), `CLOUDFLARE_ACCOUNT_ID`.
- ✅ **Custom domain, one command**: `scripts/attach-domain.mjs` (Worker custom domain →
  wait-for-200 → Convex `SITE_URL` → `EMAIL_FROM` once Resend verifies), paired with the
  existing `scripts/configure-domain.mjs`. Both idempotent; documented in README → Deploy.
- ⏳ Landing page: really good + simple; CTAs = open source (GitHub), try demo/sign up,
  "Declare the winner" → $10k Stripe checkout link (constant in code; Marko supplies link)
- ✅ **Documentation (RULES.md 27)** — DONE 2026-08-11: `/docs` with 11 screenshot-led user-guide
  pages, a Scalar-rendered API reference over a hand-verified `openapi.json`, and an MCP page
  whose tool table is generated from `convex/mcp.ts` (31 tools, guarded against drift). Fumadocs deferred (needs deps — see
  BUILD-LOG NEEDS-DEPS); native shell built on our tokens meanwhile.
- ⏳ README: product tour, self-host, API docs, screenshots
- ⏳ Submission: fill swyx's form, flip repo public, submissionNotes for sbek config
- ⏳ Manual verification prep: .ics imports (Google/Apple/Outlook), email previews

## Coverage audit gaps
From `docs/reference/coverage-matrix.md` (2026-08-11, 175 items · 124 covered · 19 partial ·
31 missing). Ranked by judging impact; items already tracked elsewhere in this file are NOT
repeated here. Effort: XS <30min · S ~1h · M ~half day · L ~a day+.

- ✅ **[1] Submission confirmation email** (sbek CFP-08) — DONE (2026-08-11). `submit.submit`
  queues the `confirmation` template through `internal.comms.queueForPerson` for the submitter
  **and** every speaker participant, carrying `submissionId` so `{{sessionTitle}}` resolves.
  Gated on `participantConfig.sendConfirmationEmail`; the preview/@example.com rule is
  inherited from the outbox. Isolated in try/catch — a mail failure can never lose a
  submission.
- ✅ **[2] `notifyEmails` organizer alerts** — DONE (2026-08-11). New
  `platformEmails.sendSubmissionNotification` (direct transactional Resend, because these are
  organizer addresses, not event `people`, so the outbox can't hold them) + a
  `notifySubmissionAdmins(ctx, …)` helper called from `submit.submit` (`kind:"new"`) and
  `portal.updateSubmission` (`kind:"updated"`). Scheduled fire-and-forget, deep-links to
  `/app/submissions?id=…`. **Known v1 limit:** no dedupe window — three saved edits send three
  alerts. Cheap fix later: a `lastNotifiedAt` stamp checked against one hour.
- ⏳ **[2b] Dedupe updated-submission alerts** — one alert per submission per hour. XS
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

## Learn-site deltas
From `docs/reference/sessionboard-product-map.md` (2026-08-11) — the full ingestion of
learn.sessionboard.com (177 help-centre pages crawled · 26 walkthrough videos through the Gemini
pipeline into `docs/video/learn/` · a frame-by-frame visual pass). Only items NOT already tracked
above are listed. Severity: S1 judge-visible · S2 demoed surface · S3 fidelity · S4 optional.
Effort: XS <30min · S ~1h · M ~half day · L ~a day+.

- ⏳ **[L1] Custom session statuses** (S1 · M) — `Settings → Statuses` CRUD: Name · **Category**
  (every status maps to one of the 5 built-in categories and inherits its behaviour) · Color ·
  Display Order · **Show custom status name** (off ⇒ portal users see the category wording) ·
  live per-status session count. Built-ins ship as `Created By: System`. Unlocks the agenda's
  status filter and keeps queue-masking intact. Ours is a fixed string union today.
- ⏳ **[L2] Portal Username separate from Email** (S1 · S) — their #1 documented support issue:
  the two fields never auto-sync, so editing a speaker's email must not move their portal login.
  Add `people.portalUsername` (defaults to email), authenticate on it, expose "Change portal
  username" on the speaker drawer.
- ⏳ **[L3] Audit log / change history** (S1 · M) — **already directed by Marko** (HISTORY.md 61:
  full restore is overkill for v1, but a lightweight audit log ships); this pass supplies the
  proven shape to build it in. Closes sbek **CNT-11**. Generic
  `Subject · Type · User · Action · Field · New Value · Occurred At` table surfaced globally
  (a History page) and inline on each session + speaker. Also the right home for MCP/copilot
  writes ("every agent action appears in the record's activity feed" is literally their model).
- ⏳ **[L4] Per-participant public visibility** (S1 · S) — the eye icon on a session participant:
  `submissionParticipants.isPublic`, filtered out of `publicData` + the REST API (`is_public`),
  toggled from the submission drawer. Embargoed-keynote case; half of sbek CNT-12 at speaker
  granularity.
- ⏳ **[L5] Agenda settings** (S1 · M) — Day Start/End · **Interval** · **Session Format →
  Default Duration** (dropping a "Lightning Talk" auto-sets 15 min) · which **statuses** appear
  on the agenda · **Room Visibility** (show all / select individual). Also the config the AI
  agenda builder reads.
- ⏳ **[L6] Portal behaviour toggles** (S1 · L full, **S for the valuable subset**) — full portal
  segmentation is a big lift; ship these three as event settings first: **Always Show Tasks**
  (off ⇒ tasks only for accepted speakers), **Manage Related Sessions and Participants** (lets a
  speaker add a co-presenter), **Extend Task Deadlines** + Final Deadline. Defer multi-portal.
- ⏳ **[L7] Per-recipient email review + delivery status** (S1 · M) — step through each
  recipient's fully-rendered email before sending (sbek **SPK-14** wants exactly this), and record
  `Delivered / Opened / Clicked / Bounced / Spam / Dropped` **with a reason** per recipient.
  Doubly valuable while the Resend account is still in test mode.
- ⏳ **[L8] File comments + file type + bulk-download wizard** (S2 · M) — closes sbek **CNT-05**
  (threaded comments per file, author + role + timestamp, cross-role visible) and widens
  **CNT-14**: File type (Presentation / Poster / Handout), then a 3-step download wizard
  (pick file types → **group by submitter / field / record** → estimated count & size → zip).
- ⏳ **[L9] Conditional participant limits + Unique Contact Settings** (S2 · M) — per-role
  Min/Max plus a **Total across all roles**, rules that override limits by session format
  (WHEN ALL MATCH → THEN APPLY PER ROLE, first match wins), and the two correctness toggles:
  *Allow users to submit new information for existing contacts* and *Notify existing contacts
  that they have been added to a submission*. Today a second submission naming the same
  co-speaker silently rewrites their profile.
- ⏳ **[L10] Task personalisation + reusable task library** (S2 · S) — `Use Field` binding on a
  task's **description** and **link** so each speaker sees their own text/URL, plus an **Alias**
  to rename an item per portal. Replaces the spreadsheet mail-merge organizers do today.
- ⏳ **[L11] Program Site** (S2 · M) — one branded URL indexing every open form *and* reviewer
  access to evaluation plans. We already have `/submit/:slug` and `/review/:token`; this is the
  index over them and it is how their reviewers get in at all.
- ⏳ **[L12] Event clone · session duplicate** (S2 · M) — granular copy-options checklist;
  duplicating a session **resets status to Pending and drops files**; a cloned event's evaluation
  plans come over **closed**. `forms.duplicate` already exists.
- ⏳ **[L13] CSV/XLSX import for speakers + sessions** (S2 · M, closes sbek **SPK-03**) — their
  exact contract: UTF-8, **1,000 rows/file**, `YYYY-MM-DD HH:mm`, pipe-separated multi-selects,
  an **`Update record if already exists`** column for upserts, **`Ignore this column`** on the
  mapping screen (an empty column otherwise *blanks* the field), red-cell inline fixing.
- ⏳ **[L14] "View portal as…"** (S2 · S) — read-only impersonation from the top bar, task
  completion blocked. Their single best debugging tool and a gift to a browser-agent judge.
- ⏳ **[L15] Field-level role permissions + filter-scoped roles** (S2 · M) — every field is
  `View` / **`Lock`** / **`Hide`** per role; Session Manager and Evaluator Session Manager roles
  carry a **filter** scoping which sessions/speakers they see. Real depth for rule 18d.
- ⏳ **[L16] Reports module** (S3 · M) — four report types (Session / Contact / Group /
  Evaluation plan), relationship joins as columns, filters + sorting, run to XLSX or CSV, saved
  and re-runnable. Ours is per-table CSV only.
- ⏳ **[L17] Rooms-view zoom + axis flip** (S3 · S); Month view (S4 — we ship Track instead, which
  is what the brief names).
- ⏳ **[L18] Additional Contacts** (S3 · M) — an assistant linked to a speaker, CC'd on mail, able
  to complete tasks inside the speaker's portal, importable 3 at a time.
- ⏳ **[L19] Merge duplicate contacts** (S3 · M) — ≤3 at a time, 70–80% email/name match detection,
  side-by-side value picker, irreversible + logged. Their own FAQ admits re-submission creates
  duplicate speakers; ours will too.
- ⏳ **[L20] Headshot restrictions + bulk resize/compress** (S3 · S) — event-level type/size/
  dimension enforcement (blocks non-conforming uploads), bulk resize with a target KB, and a
  **Large Image** filter to verify. Recommended headshot is **300×300 square**.
- ⏳ **[L21] Email template Type scoping** (S3 · S) — templates are scoped `Contacts | Sessions |
  Groups`, and that scope governs which merge tags exist. Prevents the "why is `{{sessionTitle}}`
  blank?" bug class; also why acceptance emails must be sent from the session context.
- ⏳ **[L22] Live "N matches" counters + rubric 100% validator** (S4 · S) — green inline banners
  under every filter builder ("2 sessions and 68 speakers match this filter") and under the rubric
  sliders ("Looks good! All values added together equal 100%"). Pure legibility, very cheap,
  exactly what non-technical organizers need.
- 💤 **[L23] Subsessions** (S2 · L) — parent/child sessions (≤200), child confined to the parent's
  window, linked speakers, agenda icon + hover summary, dragging the parent carries them. Only
  worth it if we want workshop-with-breakouts parity.
- 📌 **Spec now exists for already-tracked items** — the learn site supplies the exact design for
  [13] portal forms (3-page builder + PDF confirmation email), [15] scorecard depth (rubric
  sliders, rating-icon set, evaluation limits, workload caps), [16] evaluator ops (abstain with
  required reason, resend invite, My Evaluations), [18] session fields (Location, CEU Credits,
  Client Session ID, Starts/Ends At are all *standard* fields), [19] email themes (the
  `{{{content}}}` contract + 12 theme merge tags), [11] Columns/Saved Views/Import, [14] Files
  library, [20] portal profile fields. Building them is now mechanical — see the product map.
- ✅ **Where we are already AHEAD (put this in the README):** conflicts recompute live (theirs only
  on page refresh, with a "Refreshed <timestamp>" stamp) · committing a decision queue actually
  sends the emails (their docs warn twice that changing a status emails nobody) · we ship the
  brief's **Track** view (they ship Month instead) · auto-place is one click · our CFP form is
  embeddable and our API is public (their form is link-only and applications have no API).

## API parity (rule 28) — DONE, with a UI work order it produced

- ✅ **Full REST API: 4 endpoints → 80.** Mapped Sessionboard's entire public API
  (131 paths / 177 ops) and closed every program-side gap. Matrix, field-by-field diffs,
  and every deliberate non-mirror: `docs/reference/api-parity.md`.
- ✅ **OpenAPI generated, not hand-written** — `pnpm openapi:regen` builds
  `public/docs/api/openapi.json` from `convex/apiRoutes.ts`; `pnpm openapi:check` fails on
  drift; `pnpm openapi:verify` probes all 80 routes against the live deployment.
- ⏳ **CI step for the deploy agent to place** in `.github/workflows/ci.yml` after "Lint":
  `- name: OpenAPI spec up to date` / `run: pnpm openapi:check`.

### P0 — backend already ships, these are UI-only builds
- ⏳ **Session delete + restore (trash)** — the product has *no way to delete a submission*
  at all. API does soft-delete + restore; needs a row action, a confirm, and a trash view.
- ⏳ **Editable custom-field answers** — organizers can see "Form answers" in the detail
  drawer but not edit them. `PUT /sessions/{id}/fields` already writes them.
- ⏳ **Value-list management (formats / levels / languages / tags)** — currently hardcoded
  in `src/components/submissions/constants.ts`; an organizer cannot add a session format.
  The API edits them via the owning form question; needs a Settings card.
- ⏳ **Webhooks settings card** — full backend (CRUD, HMAC signing, retries, delivery log,
  test send, secret rotation), zero UI. Belongs on `/app/settings/integrations`.

### P1
- ⏳ Room / start time / duration editable in the submission drawer (today: agenda only).
- ⏳ Bulk edit beyond status (track, format, delete) — the API does all three.
- ⏳ File rename + re-assign to a participant (`PUT .../files/{id}` exists).
- ⏳ Organizer-side headshot upload (today the organizer can only leave a note).
- ⏳ Scope picker in the new-API-key dialog (`apiKeys.create` now takes `scopes`).
- ⏳ Format / level / language filters on the submissions table.

## Standing process
- ✅ Git repo = source of truth; commit+push incrementally; no Claude co-author
- 🔁 Keep RULES/DECISIONS/BUILD-LOG/TODO current every session; heavy subagents + Workflow

# Build log (episodic memory)

Newest entries at the bottom. Every work session appends what actually happened.

## 2026-08-11 ~01:00–01:45 — Scaffold
- Evaluated stacks (Next.js+OpenNext vs TanStack Start on Workers; Convex vs
  InstantDB/Supabase). Scaffolded TanStack Start via `pnpm dlx shadcn@latest init
  --preset b7BYM32MS --template start`; pinned floating `latest` deps.
- Wired Convex ↔ TanStack Query in `src/router.tsx`; Cloudflare via vite plugin;
  verified: build 400ms, worker serves SSR at 91ms TTFB (`wrangler dev` + curl).
- Convex dev deployment provisioned by Marko: `neat-sparrow-926` (eu-west-1).
- Convex agent tooling installed: Claude Code plugin, Codex plugin, `convex ai-files`
  (guidelines caught wrong index naming — all fields must be in index name).

## 2026-08-11 ~01:45–02:15 — Ingestion
- Video walkthrough processed 4× via OpenRouter `google/gemini-3.6-flash` (~54k video
  tokens/pass): transcript, actions, ui_fidelity, master (combined). → `docs/video/`
- 42 screenshots forensically spec'd by 5 Sonnet agents → `docs/ux/01…05`.
- Gene Kim's reference repo cloned; swyx clarifications + brief → `docs/reference/`.
- Wrote `docs/SPEC.md` (IA, screens, acceptance criteria, data model, build order).
- GitHub repo created (private): markokraemer/sessionboard; pushed.

## 2026-08-11 ~02:15 — Eval kit + build kickoff
- Cloned sbek eval kit from Forge → `~/Projects/kortix/sbek`. 98 rubric items,
  20 scenarios, 7 areas. Key insight: Public Widgets required (20%), Content Mgmt 15%,
  scoping/rule/handoff item types are the discriminators.
- Created docs/memory (RULES, DECISIONS, BUILD-LOG).
- Rewrote `convex/schema.ts` to SPEC §5 + rubric amendments (file versions/approvals,
  organizer auth tables, evaluators with magic tokens).
- Next: backend function contract inline → foundation UI agent → workflow slice fan-out
  → sbek hill-climb.

### Evaluation + public + API backend
- `convex/evaluationsAdmin.ts` — organizer-side evaluation: plans CRUD (criteria,
  assigned submissions, evaluator magic tokens via `randomToken`), plan detail with
  per-evaluator progress, Summary metric cards + avg-score-by-plan, and
  `scoresBySubmission` feeding the submissions-table score column.
- `convex/review.ts` — `/review/:token` evaluator queue: token-only auth (no login),
  incomplete-first ordering, 1–5 validation against the plan's criteria, upsert scores.
- `convex/dashboard.ts` — one-query `overview` (status counts, accepted speakers,
  outstanding tasks, missing bio/headshot, top-8 chase list, 21-day pacing in event tz,
  forms card) + `speakersRoster` (tasks done/total, missing pills, portal token).
- `convex/publicData.ts` — login-free program queries by slug: `schedule` (day-grouped +
  Unscheduled bucket), `speakers` (gallery/directory, surname order), `sessionsList`
  (+ facets for Format/Track/Room/Level/Tags), `sessionDetail` (prev/next),
  `speakerItinerary`. Safe fields only; internal queries back the HTTP API.
- `convex/http.ts` — `/v1/event/{slug}/{sessions|speakers|submissions}` Bearer-auth JSON
  with `{data, pagination}`, plus unauthenticated `schedule.ics` (inline RFC5545 writer,
  CRLF + folding). CORS GET from anywhere; JSON `{error}` on 400/401/404.
  Env: `PUBLIC_API_TOKEN` (defaults to `demo-api-token`).

### Comms + seed backend
- `convex/lib/ics.ts` — pure RFC-5545 writer: `buildIcs()` (METHOD:REQUEST, CRLF,
  75-octet folding that never splits a UTF-8 char, escaped TEXT, UTC DTSTART/DTEND,
  LOCATION only when a room is assigned) + `buildIcsCalendar()` for multi-event feeds.
  Verified: folds ≤75 octets, CRLF-only, emoji/umlauts intact.
- `convex/lib/email.ts` — `renderTemplate()` (missing vars → empty string) and
  `DEFAULT_TEMPLATES` for confirmation / accepted / declined / waitlisted / reminder,
  plus `siteUrl()`, `portalLinkFor()`, `emailFrom()`.
- `convex/comms.ts` — templates (`listTemplates` merges stored + defaults,
  `upsertTemplate`), outbox (`listMessages`, joined with person + submission), queueing
  (`queueForPerson` internal, `sendTestToSelf`, `remindIncompleteSpeakers` with a 20h
  dedupe), and claim-based delivery (`claimPending` → "sending" → `deliverPending`
  action → sent | preview | failed). No `RESEND_API_KEY` ⇒ everything lands as "preview".
- `convex/crons.ts` — daily 09:00 UTC "task-reminders" over every event, tasks due
  within 72h (or overdue), same 20h dedupe, then schedules `deliverPending`.
- `convex/seed.ts` — idempotent `run` (purges both demo events incl. stored files, then
  rebuilds) + organizer-gated `reseed`. AI Engineer Summit 2026 (2 rooms, 3 tracks, open
  CFP with conditional question, 14 people, 18 submissions across every status, 6
  conflict-free scheduled items, 2 evaluation plans w/ 10 evaluations, 18 mixed speaker
  tasks, 5 templates, 3 outbox rows) + minimal "Design Systems Day" to prove cross-event
  scoping. Storage assets (SVG headshots, one real single-page PDF deck) are attached by
  the scheduled `attachDemoAssets` action.

### Foundation UI
- Design tokens + shell + shared primitives + brand: rewrote `src/styles.css` to the
  light-mode-only Sessionboard palette (primary `#2F5CE0`, bg `#F8FAFC`, navy `#1B1E27`,
  muted `#64748B`, status green/amber/red/gray/blue token pairs, 8px controls / 12px
  cards; `.dark` block deleted and the `dark` variant pinned to an unused `.dark`
  ancestor so shadcn's `dark:` utilities stay inert); added `src/lib/session.ts`
  (localStorage `sb.session` organizer token store, `useSession()` via
  `useSyncExternalStore`, `requireSession()` route guard + `loginHref()`);
  `src/components/brand/logo.tsx` (`Logo`/`LogoMark` — agenda-rail logomark in
  currentColor); `src/components/shared/{status-pill,page-header,empty-state,
  wizard-shell,drawer-shell,data-toolbar}.tsx`, each extending its shadcn base
  (Badge / Card / Button+Card / Sheet / InputGroup); routes `login.tsx` (demo-credentials
  one-click fill), `app/route.tsx` (3-tier shell: slim top bar with global search +
  View public page + avatar menu, 240px event-context sidebar with PROGRAM/SETUP groups,
  content outlet), `app/index.tsx` placeholder dashboard, a minimal temporary landing,
  and `design-system.tsx` — the living design system (brand, palette, type scale, every
  shadcn + shared component with all variants/states, sticky section nav).

## 2026-08-11 ~02:20–02:45 — Better Auth + multi-tenancy + full backend verified
- Swapped custom token auth → Better Auth (@convex-dev/better-auth component):
  config/auth.ts/http routes/client/router/root wiring; login page w/ sign-up tab.
- Multi-tenancy: organizations+members(roles) tables, requireEventAccess everywhere
  (agent refactor, tsc clean), workspaces module, events.organizationId (legacy purge).
- Seed creates the demo user via Better Auth signUpEmail → org → both events.
- scripts/verify-backend.mjs rewired for Better Auth (JWT via convex_jwt cookie,
  Origin header required) + cross-org stranger probes. **78/78 checks green** across
  auth, scoping, CFP rules, queues+comms, files+approval, agenda+conflicts+autoplace,
  evaluation, dashboard, public data, HTTP API/.ics.
- Foundation UI complete incl. /design-system + logo; brand asset kit expansion running.
- Launching 11-slice UI workflow (Opus agents, ambient-auth briefs).
- Homepage slice: replaced the temporary landing with a real marketing homepage (`src/routes/index.tsx` + `src/components/marketing/*`): sticky nav, hero with Star-on-GitHub / Try-the-live-demo / joke "Declare the winner ($10,000)" CTA (STRIPE_CHECKOUT_URL constant + sonner fallback toast), 3 demo entry cards (/login, /portal, /submit/cfp), 6-feature grid mapping the brief requirements, "Built in a weekend for Kill My SaaS" story band, footer (GitHub, /design-system, /api/v1 mention, MIT).

### Brand asset kit (design-system expansion)
- `src/components/brand/assets.ts` — single source of truth for the logo geometry
  (`MARK_RECTS`) + generators: `markSvg`, `markBoxedSvg`, `wordmarkSvg`, `lockupSvg`,
  `socialAvatarSvg`, `ogImageSvg`, `brandSvg(variant, tone, size)`, plus pure
  client-side downloads (`downloadSvg`, `downloadBrandPng`, `downloadSocialAvatarPng`,
  `downloadOgImagePng`, `downloadFaviconPng`). PNGs rasterise the SVG via canvas, and
  any text is drawn with Canvas 2D after `document.fonts.ready` so the real Inter
  Variable is used (an `<img>` from an SVG blob cannot load webfonts).
- `logo.tsx` now consumes that geometry and exports `Logo` / `LogoMark` / `Wordmark`.
- `/design-system` Brand & assets section: 4 variants x 3 surfaces (light/dark/primary,
  inverse via currentColor) with SVG + PNG 512/1024 downloads each; 1:1 social avatar
  (SVG, PNG 400/1024); OG banner preview + downloads; favicon row 16/32/48 with
  favicon.svg + PNG 32/180/512; clearspace (half mark height), 16px minimum, and
  do/don't tiles. Typography section rebuilt as a specimen: "Inter, deliberately —
  the boring font", weights 400/500/600/700, tabular-figures sample, type scale.
- Shipped static assets generated from the same geometry: `public/favicon.svg`,
  `public/icon-192.png`, `public/icon-512.png`, `public/og-image.png` (1200x630,
  rendered headless with real Inter), `public/og-image.svg`; manifest rebranded and
  `__root.tsx` head wired with icon/apple-touch-icon/manifest/theme-color/OG/Twitter.
- comms-ui slice: built `/app/communications` (Templates | Outbox tabs, URL-linkable `?tab=`/`?status=`) — template cards + editor drawer with click-to-insert merge chips, live preview through the server's own `renderTemplate`, "Send test to myself"; outbox table with Sent/Preview/Scheduled/Failed pills (error tooltip), .ics paperclip, full rendered-email drawer with linkified portal links and client-generated .ics download (reuses `convex/lib/ics.ts`), plus "Remind incomplete speakers" with confirm + result toast. New: `src/routes/app/communications/index.tsx`, `src/components/comms/*`. Contract gap: no client-callable bulk/compose mutation (SPK-13) — `comms.queueForPerson` is internal-only; and no query exposes a message's .ics or its session schedule (rebuilt client-side off `api.agenda.board`).
- dashboard-speakers slice: rebuilt `/app` (greeting + date/countdown context line, 3 metric cards linking through, 7-status pill bar linking to filtered `/app/submissions?status=`, insight banners "N accepted speakers are missing a bio or headshot → View speakers" and "N submissions awaiting a decision", "Top speakers by outstanding tasks" ranked chase list, hand-rolled SVG submission-pacing bars, "Your forms" card with Copy link + View) and built `/app/speakers` (live roster table: headshot/initials avatar, company, sessions, task progress "2/3" + mini bar + next open task w/ due label, missing pills, row menu Copy portal link / Open their portal / Assign a task / Email, search + All/Needs attention/All set tabs, multi-select bulk bar, "Remind all incomplete" with confirm + result toast, "Assign task" dialog → `tasksAdmin.create` with real date picker + speaker multi-select). New: `src/components/dashboard/*` (12 files). Contract gaps: `comms.remindIncompleteSpeakers` has no single-person variant (row-level "Send reminder" omitted, mailto used instead), and no organizer-side mutation to edit a speaker's bio/headshot (CNT-10) or add a speaker manually (SPK-02).
- evaluation slice: built `/app/evaluation` (URL-linkable `?tab=summary|plans|evaluators`) — Summary with 4 metric cards (Total evaluations / Evaluated submissions / Evaluation plans / Evaluators), hand-rolled SVG completion donut (Complete vs Incomplete, numbers also in the legend) and "Average score by plan" bars on the fixed 1–5 scale; Plans tab with plan cards (name, Round badge, Open/Closed pill via shared StatusPill, evaluator/submission/avg-score stats, completion bar, due date + overdue tint) and a "New plan" dialog (name, round select, criteria list editor defaulting to Overall + Relevance, submissions multi-select with search/status/track filters pre-seeded to everything Pending, evaluator email chips, real calendar due-date picker) → `evaluationsAdmin.createPlan` then straight into the plan; Evaluators tab = event-wide reviewer table with per-reviewer progress bars + Copy review link / Open / Remove (confirm). Plan detail `/app/evaluation/$planId`: round progress + average + due + criteria, inline Add evaluator form, evaluators table with last-scored, submissions-under-review table sorted by average score, Close/Reopen plan. Public `/review/$token` (de-chromed, no login): greeting + plan/event/due + progress bar, incomplete-first queue rail with check marks, per-submission detail (track/format/level/language/tags/abstract/speakers), big 1–5 segmented ToggleGroup per criterion with word labels, comment textarea, Save & next / Skip, all-done + round-closed states, friendly invalid-link page. New: `src/components/evaluation/*` (10 files), `src/routes/app/evaluation/{index,$planId}.tsx`, `src/routes/review/$token.tsx`. Contract gaps: no blind-review flag on `evaluationPlans` (rubric ABS-07 — `review.queue` always returns speakers), no per-evaluator sub-assignment inside a plan (ABS-05), and no reviewer-reminder mutation (ABS-09).

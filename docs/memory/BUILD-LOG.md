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

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
- agenda slice: built `/app/agenda` (URL-linkable `?view=list|day|rooms|conflicts&day=YYYY-MM-DD&focus=<id>`) over the single reactive `api.agenda.board` query — Day view hero: CSS-grid time axis snapped to 15-min rows (08:00–20:00, auto-widened so an out-of-window session can never hide), one column per room with sticky headers, absolutely-positioned session cards (track-colour left edge, title, time range, room, speakers), @dnd-kit drag from the Not-scheduled tray onto the grid and between rooms/slots with 15-min snap + DragOverlay, bottom-edge pointer resize with a live "N min" chip, and click → popover (track chip, Accepted pill, time/speakers, conflict alert, Room/Day/Start time/Length selects that save on change, Unschedule); Not-scheduled tray with a "Schedule session" popover so every drag action is also reachable by click/keyboard (and by a browser agent); Rooms view = swimlane rows with a time ruler and the same detail popover; List view = whole programme sorted by start time with inline Day select, real `<input type="time">` (900s step), Room + Length selects, Unschedule, plus a "Not scheduled" table with per-row Schedule popover; Conflicts view lists each clash (kind badge + plain-English label + both sessions with day/time/room/speakers) with "Show in Day view" jump (switches view+day and rings the card) and Unschedule, and the Conflicts tab carries a live red count badge while conflicting cards carry a red ring — all live off the reactive query (<1s); Auto-place button with an AlertDialog that spells out exactly what the pass does before running `agenda.autoPlace`, plus "Add session" → Submissions with an explanatory tooltip and "View public agenda". All times rendered in the event's IANA timezone via hand-rolled Intl helpers (`agenda-time.ts`). New: `src/routes/app/agenda/index.tsx`, `src/components/agenda/*` (11 files). Contract gaps: `agenda.autoPlace` builds slots with `setUTCHours`, so the UI compensates by passing timezone-shifted `dayStartHour`/`dayEndHour` (breaks for half-hour-offset zones and can spill a day for far-east zones); `agenda.board` conflicts carry no timestamps (times re-derived client-side) and its exported `Conflict` type doesn't match the real `{kind,label,a,b}` return; no publish/go-live mutation for AIA-07 (we link to the public page instead); no mutation to create a manual break/keynote session from the agenda itself.
- Form builder slice: `/app/forms` list (search + All/Open/Closed tabs, cards with count badge, kind + Open/Closed pills, meta line, Copy public link / View / Edit / ⋯ Duplicate·Close·Delete+confirm), `/app/forms/new` (name + Abstracts/Sessions choice cards → create → editor), `/app/forms/$formId` 6-step wizard (Setup · Welcome screen · Submission questions · Participants · Form settings · Notifications) on `shared/wizard-shell` with debounced autosave + flush on step change/unmount + explicit Save; `src/components/forms-builder/*` adds the sortable QuestionRow (dnd-kit + Move up/down menu fallback), the question edit drawer (type picker, options editor, char limit, track-routing toggle, "Show only when [q] is [value]" rule builder), rich-text field, calendar+time close-date picker, and email chips input — all on shadcn primitives.
- portal slice: built the speaker portal — `/portal/t/$token` magic-link entry (stores the token under `sb.portal` + custom `sb:portal-token` event, redirects to `/portal`), `/portal` shell (event-branded header with event name/dates/venue + account menu, shadcn Tabs rendered as real Links: Home · Submissions · Profile · Tasks with an open-task count badge, skeletons not spinners, friendly "check your email for your portal link" page with paste-your-link form + "Open the demo speaker portal" hint, and an "expired link" state); Home (blue-bannered PanelCards: "My Submissions (n)" with SESS-n codes + status pills + track dots → `?open=<id>` detail, "My Profile" with a completeness meter over bio/headshot/job+company/links, full-width Tasks panel with due labels and done count); Submissions (detailed cards → drawer with Details/Participants tabs, editable title/description/form answers even after acceptance, dirty-tracked Save, Withdraw with AlertDialog confirm for non-accepted); Profile (image40 layout: General panel with 5,000-char biography counter, Salutation/Pronouns selects, First/Last/Job title/Company/Phone, read-only email, autosave-on-blur with "Profile saved" toast, Headshot uploader with circular preview + "square, ≥800px" guidelines, My Links panel LinkedIn/X/Website); Tasks (progress bar, To do / Completed panels, confirm-type "Mark complete", inline upload flow for upload/headshot tasks via generateUploadUrl→POST→attachUpload, uploaded versions with Awaiting review/Approved/Changes requested pills + download, and the reviewNote surfaced in a destructive Alert with re-upload). New: `src/routes/portal/{route,index,submissions,profile,tasks,t.$token}.tsx`, `src/components/portal/*` (11 files). Contract gaps: `portal.home` doesn't say whether I'm the submitter (Withdraw errors are caught and toasted instead of hidden), form answers arrive as raw keys with no question labels/types (keys are humanized client-side), tasks carry no `formId`/submission link (so "form"-kind tasks have no completion path and image17's "Submission Tasks" grouping isn't possible), and there's no query for the event's public CFP form slug (empty-submissions state can't link to "Submit a talk").
- submissions-table slice: built `/app/submissions` — URL-driven status tab strip with live counts (All · Accepted · Accept Queue · Pending · Decline Queue · Declined · Withdrawn · Drafts, each a real `<Link>`), data-toolbar (instant client-side search + track filter select + Options → Export CSV all/current-view + `+ Add submission`), triage table (select-all/bulk bar → Accept Queue / Decline Queue / Pending, inline status pill popover with staged selection + Save/Cancel per image13, title → detail drawer, colored track dot, format, avg score from `evaluationsAdmin.scoresBySubmission` (sortable, dash when unscored), speaker chips, relative Submitted, `…` row menu, 25/page pager), the two-phase QUEUE BANNERS ("N staged — Send acceptances/declines" → confirm dialog spelling out emails + onboarding tasks → `commitQueue`), Add-submission drawer (Details/Participants tabs, Abstract|Session toggle, status defaults Pending, tag chips, speaker rows), and the detail drawer (Details with inline `updateDetails` editing + form answers labelled via `forms.get`, People, Reviews via `submissionEvaluations`, Files with approval pills). New: `src/routes/app/submissions/index.tsx`, `src/components/submissions/*` (10 files). Contract gaps: `submissions.list/get` never joins the submitter person (Session Submitter column/field impossible), `updateDetails` can't unset format/level/language (writes "" instead), no delete/withdraw-from-organizer mutation, and no bulk file-bundle export.
- public-submit slice: built `/submit/$slug` — SSR-loaded (`ensureQueryData` + `useSuspenseQuery`, skeleton pendingComponent), de-chromed centred `max-w-2xl` card with the 5-step tracker (Welcome! → Account → Submission → Participants → Review; numbered circles + chevrons on desktop, "Step n of 5" + Progress bar on mobile, completed steps clickable). Welcome: page heading, event name/dates (Intl, event timezone)/venue, bordered deadline + per-user-limit + drafts callout, sanitised rich-text welcome message (HTML *or* plain-text paragraphs), and a "What we're looking for" Tracks/Formats chip panel so tracks + formats are visible on the logged-out screen (CFP-03). Account: email only → `submit.identify` → portalToken (no passwords), draft cards with Resume (hydrated from `portal.home`) / "Start a new submission". Submission: all question types rendered with real shadcn controls (short_text→Input, long_text/rich_text→Textarea + live char counter, dropdown→Select, multi_select→checkbox tiles, email/url/phone→typed Input, checkbox→Switch, file→"upload in your portal after acceptance" note), LIVE `showIf` conditional logic, red asterisks, per-field help. Participants: "Participant 1 (You)" prefilled with the account email locked, only enabled fields, role select when chairperson/moderator are on, Add speaker capped at speakerMax (chairs/moderators uncapped), min-speakers stated in plain English. Review: Account/Submission/Participants summary cards with Edit → jump back. Validation red-outlines invalid fields and toasts "Missing required fields. Complete the highlighted fields below." then scroll-focuses the first one; Save as draft on Submission/Participants/Review; whole flow persisted to sessionStorage per slug. Success screen: "Thank you for submitting to present at our event!" + Continue to portal → `/portal/t/<token>` (+ Submit another proposal); closed forms get a friendly deadline card, unknown slugs a friendly not-found card. New: `src/routes/submit/$slug.tsx`, `src/components/submit/*` (11 files). Contract gaps: `portal.home` returns participants as a single joined `name` with no email, so resuming a multi-speaker draft can't restore co-speaker emails (we ask for them again); no query returns a draft by id for the public token; `submit.submit` has no headshot/file handling (organizer-enabled headshot + file questions render as portal-upload notes, required file questions store a placeholder string); `settings.autoRedirectToPortal` is deliberately NOT auto-redirecting — the success screen always shows, with the portal link as its primary CTA.
- public-widgets slice: built the anonymous event site + embed generator. `/e/$slug` layout (SSR via `ensureQueryData` + `useSuspenseQuery`, `<title>` from the event, friendly "we couldn't find that event" state) renders a de-chromed header (event name, dates in the event's IANA timezone, venue) with nav pills Schedule · Speakers · Sessions · My schedule (live count badge) — and hides all chrome when `?embed=1|true`, so every public page IS its own embeddable widget. Widget display options are validated once for the whole subtree (`components/public/widget-search.ts`: embed, hideDescriptions, hideSpeakers, hideImages, hideSearch, track, view, day, q). Surfaces: `/e/$slug` schedule with day pills + prev/next day nav and two views — "By time" (time-group headers + full session cards) and "By room" (wall-planner grid: room columns, time gutter, blocks placed at their real slot with lane-splitting for overlaps, track-colour edge, speaker-count badge, block → detail); `/e/$slug/sessions` catalog with search over titles AND speaker names/companies, Track/Format/Room shadcn Selects, "1 - N of N" count and clear-filters empty state; `/e/$slug/sessions/$sessionId` detail (Back to all sessions, full description, speakers with headshot/bio/links, room + capacity, prev/next, Add to calendar); `/e/$slug/speakers` alphabetical-by-surname gallery grid (headshot or initials fallback) + `?view=list` directory pairing each speaker with their sessions ("Roles: speaker"), both opening the same detail dialog (photo, "Company Name:", bio + Show more, "Sessions (N)" with date/time + room, Close restores the grid); `/e/$slug/itinerary/$personId` one person's run-of-show + "Add all to calendar"; `/e/$slug/my-schedule` personal picks (bookmark button on every card, localStorage per event, survives reload, "Add all to calendar", Clear all). `.ics` is generated CLIENT-SIDE (`components/public/ics.ts`: CRLF, 75-octet folding, escaped text, UTC DTSTART/DTEND, stable UIDs) — verified importable output for single session, day, speaker and personal-schedule downloads. Organizer side: `/app/embeds` — five widget cards (Agenda · Schedule itinerary · Sessions list · Speaker gallery · Speakers list), field-option switches (descriptions / speakers / photos / search+filters), track content filter, height field, live same-origin iframe preview in a browser-chrome mock with desktop/mobile/refresh, and a "Get code" tab with the verbatim `<iframe>` snippet + Copy, the direct link, and the no-auth `.ics` feed URL. New: `src/routes/e/$slug/*` (7 route files), `src/routes/app/embeds/index.tsx`, `src/components/public/*` (12 files). Contract gaps: no organizer-side persisted embed records (embeds are pure URLs — nothing to save, nothing to invalidate), `publicData.*` exposes no event logo on `events.getBySlug` (header is text-only), session descriptions arrive as raw strings that may contain rich-text HTML (rendered as plain text on purpose), and nothing marks "breaks"/non-session items so they render as ordinary sessions.
- settings-events slice: built `/app/settings` (shadcn Tabs rendered as real Links → Event details · Rooms & tracks · Team, each its own URL under a tinted PageHeader banner carrying the event name/dates/workspace + an event switcher dropdown) and `/app/events` (the multi-event surface for sbek CFP-17/18). Event details = docs/ux/01 image25 two-column stacked-label form on `LabeledField` (label above, red asterisk, "(i)" tooltip, helper under label, error under control): Event name*, Event slug* with live `…/e/<slug>` preview + Copy public link, Event type Select, Event website (url validation), Venue, searchable Timezone combobox (Popover+Command over `Intl.supportedValuesOf('timeZone')`, ~430 zones, "(GMT-07:00) America/Los Angeles" + abbreviation), Starts at / Ends at date-time pickers (Popover + shadcn Calendar + 15-min time Select, "October 12, 2026 at 9:00 AM" + PDT chip + clear X, all wall-clock maths in the event's IANA zone via hand-rolled Intl helpers in `components/settings/timezone.ts`), Description textarea with live n/1000 counter; Save/Discard footer with dirty-state indicator, toast, and a `useBlocker` + AlertDialog "Leave without saving?" guard (also `beforeunload`). Rooms & tracks = two cards with inline rename/capacity edit (commit on blur/Enter, revert on Escape), explicit Move up/Move down ordering (agent- and keyboard-friendly), inline add row, and delete behind an AlertDialog that surfaces the backend guard message verbatim ("This room has scheduled sessions…"); tracks carry an 8-preset colour-dot Popover picker that auto-suggests the next unused colour. Team = the multi-tenancy surface on `convex/workspaces.ts`: member table (avatar, email, You badge, role, Active/Invited pill), owner-only role Selects, Add teammate dialog (email + role, plain-English role help), remove behind confirm, workspace Select when the user belongs to several, and permission gating that mirrors the server rules. `/app/events` = event cards (name, dates, timezone, venue, workspace, live submission/accepted counts, Current ring) with Open event / Settings / Copy link and a New event dialog (name → auto-slug with URL preview → timezone defaulting to the browser zone). Event context lives in `components/settings/current-event.ts` (`useCurrentEvent()` / `selectEvent()` — localStorage + `useSyncExternalStore`, SSR-safe, falls back to the first event). New: `src/routes/app/settings/{route,index,rooms-and-tracks,team}.tsx`, `src/routes/app/events/index.tsx`, `src/components/settings/*` (12 files). Verified with Playwright against the running app: save round-trips with toast, event switch flips Settings + Rooms/Tracks to the other event's isolated data and survives reload, unsaved-changes dialog fires on tab navigation. INTEGRATOR: `src/routes/app/route.tsx` still hardcodes `events?.[0]` for the sidebar event card and has no "Events" nav item — swap those two lines for `useCurrentEvent()` and add a nav link to `/app/events` so the shell follows the switcher. Contract gaps: no `events.delete`/archive mutation (no danger zone), `events.create` can't set dates/venue at creation, `workspaces.addMember` has no invite email (members are linked on their next sign-in — surfaced as an "Invited" pill), no rename/create-workspace mutation, and `roomsTracks.deleteTrack` doesn't report how many submissions reference the track before deleting.
- settings-events slice (follow-up, after `convex/events.remove` + `workspaces.get/update/create` + Resend invites landed mid-build): added a Danger zone card on Settings → Event details ("Delete this event", type-the-event-name confirmation dialog, clears the stored event context and returns to `/app/events`) via `src/components/settings/delete-event-card.tsx`, plus a Workspace card above the Team table (rename with Save name, workspace switcher Select when you belong to several, "New workspace" dialog on `workspaces.create`) and reworded the Add-teammate dialog now that invites are actually emailed. Remaining contract gaps: `events.create` still can't set dates/venue at creation, and `roomsTracks.deleteTrack` doesn't report how many submissions reference a track before deleting.
- landing slice (rebuild): replaced the first-pass homepage with a full marketing site ripped from sessionboard.com's structure (sticky nav w/ sheet menu → hero + custom product graphic → LIVE DEMO cards → who-it's-for strip → six alternating feature rows → Solid foundations → pricing → open-source story → footer), all light-mode tokens and shadcn/Base UI bases. New `ProductShot` component draws seven token-built app mocks (dashboard/form/review/portal/agenda/comms/program) inside a browser frame and swaps to a real screenshot via `src`/`alt` when we have them (RULES 18f); `StatusPill` reused inside the mocks so marketing can't drift from the product. Pricing lands the joke ("Open source $0 · Cloud demo $0 · DECLARE THE WINNER $10,000 one-time, voluntary") on the kept `STRIPE_CHECKOUT_URL` const + toast fallback. New: `src/components/marketing/{product-shot,feature-sections,foundations,pricing,proof-strip,open-source}.tsx`; rewrote `{hero,marketing-nav,marketing-footer,demo-entries,declare-winner-button,section,links}`; deleted `feature-grid.tsx`/`story-section.tsx`. Verified in Chromium at 1440px and 360px: zero console errors, zero horizontal overflow, mobile sheet menu + anchor nav work; every link is real (/login, /portal, /submit/cfp, /e/ai-summit-2026, /design-system, GitHub). Gotcha for future UI work: Base UI `Button`/`SheetClose` rendering an `<a>`/`<Link>` MUST pass `nativeButton={false}` or it logs a console error on every render.
- interactions slice (RULES 20b): adopted the **interior.dev** micro-interaction library end to end — 45 of its 54 registry items pulled in with `pnpm dlx shadcn@latest add https://www.interior.dev/r/<name>.json` into `src/components/interior/*` (no `pnpm add`; `motion` v13 was already there, `package.json` untouched). Deliberately SKIPPED the nine that duplicate a11y-critical Base UI structure (modal, popover, drawer, dropdown, context-menu, tabs, accordion, tooltip-group, pagination) — `src/components/ui/*` stays canonical per RULES 17. Restyled all 45 onto our tokens so they read as native: stone→foreground/muted-foreground/border/input, `bg-white`→`bg-card`, emerald/red/amber→`--status-*`/`--destructive`, their accent `#4568FF`→`var(--primary)`, their ink `rgba(28,25,23)`→`rgba(27,30,39)`, `rounded-[8/9|10/11|12/13/14px]`→`rounded-md/lg/xl`, and deleted all **506** `dark:` utilities (light-mode only, RULES 3) — animation timing untouched, `useReducedMotion` preserved throughout. Moved four indicators to brand blue for consistency with `Progress`/`Button` (wizard Next + rail fill, slider track + thumb, carousel active dot); kept interior's dark thumbs on segmented-control/filter-grid/scroll-spy/wizard markers (matches SPEC's "dark active step"). New import surface `@/components/interactions` (barrel over all 45) plus our own **`PepButton`** — press-depth grafted onto shadcn `buttonVariants`, so the face is a real Sessionboard button with a per-variant plinth; opt-in for hero CTAs only, NOT a `Button` replacement. `/design-system` gained an **Interactions** section (new nav entry + `src/components/interactions/catalog.tsx`) showing all 46 tiles live, each captioned with where it belongs. Verified in Chromium against the running dev server: 46 tiles, 9 groups, **zero** console/page errors, no horizontal overflow; `tsc` + `eslint` clean. Full component→surface map (hold-to-confirm→queue commits, value-flash→dashboard metrics, tag-input→form-builder options, wizard-steps→builder rail, segmented-control→agenda views, task-steps→speaker onboarding, sortable-table/filter-grid→submissions, reorder-list→question order, swipe-deck→evaluator triage, text-reveal/logo-marquee→landing, …) lives in the new **`docs/memory/INTERACTIONS.md`** — that's the work order for the reconciliation pass. NOT integrated into product screens on purpose (other agents own those slices). One finding for reconciliation: there are already THREE near-identical `copy-link-button.tsx` (settings/forms-builder/dashboard) plus three inline `clipboard.writeText` call sites — collapse into one `shared/copy-link-button.tsx` on interior's `useCopyToClipboard` while keeping our `Button` chrome. Gotcha: re-running `shadcn add` for an interior item OVERWRITES the restyle — re-apply the token map in INTERACTIONS.md if you update one.
- design-system slice (brand menu · width system · explorations): (1) RULES 20d — `Logo`/`LogoMark` now own a right-click handler (`src/components/brand/logo.tsx`: `brandMenuProps()` → `preventDefault` + `window.location.assign("/design-system")`, no router coupling so it works in the shell, login, landing, portal and public footers alike), a `title="Right-click for brand assets"` tooltip, and a `disableBrandMenu` opt-out; the lockup suppresses the nested mark's handler so it never fires twice. (2) RULES 20e — ONE width system: `--container-app|page|narrow|card|reading` tokens + `.container-app/.container-page/.container-narrow/.container-card` utilities (centre + responsive 1rem→1.5rem gutter, max-width expressed as a CONTENT width via `calc(token + 2*gutter)`) and `.container-reading` as a pure 65ch measure, all in `src/styles.css`; audit found five different page widths (5xl/6xl/7xl/2xl/400px) *and* gutters applied inconsistently on the container vs the parent, so equal max-widths still produced unequal columns. Normalized: marketing nav/hero/footer/sections 6xl+7xl → `container-page`, public event shell 5xl → `container-page`, speaker portal 5xl → `container-page`, review queue 5xl → `container-page`, design-system 7xl → `container-page`, organizer shell `p-6` → `container-app py-6`, public submit 2xl → `container-narrow`, login `max-w-[400px]` + portal-signed-out `max-w-lg` + review invalid-link card → `--container-card`; `MarketingSection`'s unused `width="wide"` variant deleted. New "Layout & width" section on `/design-system` documents the tokens, a relative-width diagram, do/don't, and what the system deliberately does not govern (dialog/drawer/table-cell widths). (3) RULES 20/22 — new Explorations section at the end of `/design-system` (`src/components/brand/explorations.tsx` + `explorations.css`): one mini organizer dashboard (PageHeader, 2 stat cards, toolbar, 4-column table with tag pills + status, primary+outline buttons, a paragraph) rendered against three independent axes — FEEL (E · De-blued = today minus the blue chrome, **F · Attio** = the approved gold standard with neutral near-white ramp, no tinted banner, colour-carries-data tag tints + status dot+label, blue only on primary/links, and controls/rows sized UP per #22's caveat, G · Juicebox-soft as the secondary, plus today's baseline), ACCENT (live chips: Sessionboard blue, Deep teal #0F766E, Verdigris, Petrol, Muted jade — F is limited to blue + deep teal), and TYPE (A Current/Inter, B Editorial = Newsreader + Instrument Sans, C Grotesk = Space Grotesk + Public Sans, D Character = Bricolage Grotesque + Instrument Sans), plus two combos and a Sora specimen. Candidate fonts are imported by that module only and applied through `[data-demo-panel]` scoped, deliberately unlayered CSS; palettes are scoped custom-property overrides on the panel element — the global font stack and every app token are untouched, exactly as #20 requires until Marko picks. (4) Wrote `docs/memory/DESIGN-REVAMP.md`: the mechanical old→new value for every `styles.css` token, the new `--tag-*` and `--control-h`/`--row-h` tokens, the nine component patterns that change (PageHeader banner→hairline, StatusPill→dot+label default, new `Tag`, Attio toolbar, sidebar, Button/Table/Card sizing, blue underlined cell links), what must NOT change (density, width system, light-mode-only), and the execution order — its hexes are the same object the F panel renders from, so preview and rollout cannot drift.
- mcp slice (RULES 21): shipped the full MCP server + personal API keys. `convex/mcp.ts` is one MCP Streamable HTTP endpoint (`POST {CONVEX_SITE_URL}/mcp`, JSON-RPC 2.0, stateless — no `Mcp-Session-Id`, single JSON responses, never an SSE stream; `initialize` negotiates 2025-06-18/2025-03-26/2024-11-05, `notifications/*` → 202, `GET` → 405 with a body that tells a human how to connect, `OPTIONS` CORS incl. `Mcp-Protocol-Version`) exposing **27 tools** — workspaces/events (`list_workspaces`, `list_events`, `create_event`, `get_event_overview`), forms (`list_forms`, `get_form`, `create_form`, `update_form_settings`, `get_public_form_link`), submissions (`list_submissions`, `get_submission`, `set_submission_status`, `commit_decision_queue`, `add_manual_session`), agenda (`get_agenda`, `schedule_session`, `unschedule_session`, `auto_place_sessions`), speakers (`list_speakers`, `get_speaker_portal_link`, `assign_task`, `send_reminders`), comms (`list_templates`, `update_template`, `list_outbox`, `send_test_email`) and `get_event_summary` (the one-call narrative demo tool: headline, status counts, agenda health, prioritised "needs attention", nearest deadlines). Ergonomics for LLM callers: every `event` arg takes an id **or** a slug, rooms/tracks/speakers resolve by name/email, dates are ISO-8601 strings, tool failures come back as `isError` results with a fix-it message (not protocol errors), and `commit_decision_queue` — the only tool that mails real speakers — hard-refuses without `confirm: true`. **Auth is two-tier, one authorization model.** (a) Personal API keys: new `apiKeys` table (sha-256 hash only, `sb_live_<32hex>`, prefix kept for display, `lastUsedAt` stamped on every MCP call) + `convex/apiKeys.ts` create/list/revoke. (b) OAuth 2.1 — Better Auth's `mcp` plugin DOES compose with `@convex-dev/better-auth` (its component schema already ships `oauthApplication`/`oauthAccessToken`/`oauthConsent`/`jwks`), so "add connector by URL" works in Claude and ChatGPT: DCR + auth code + PKCE, sign-in page as the consent step. Issuer is the APP origin, not the Convex site, because the browser leg needs the Better Auth cookie that only exists there (the app proxies `/api/auth/*`); the Convex site is the protected *resource*, advertising itself via RFC 9728 metadata at `/.well-known/oauth-protected-resource(/mcp)` plus a `WWW-Authenticate: Bearer resource_metadata=…` on every 401, with the RFC 8414 authorization-server metadata republished at the app root (`src/routes/[.]well-known/oauth-authorization-server.ts`) and `/login` now round-tripping OAuth params back to `/api/auth/mcp/authorize` after sign-in. Better Auth's **`api-key` plugin does NOT compose** — it needs an `apikey` table and the Convex component's schema is fixed and has none, so the hand-rolled table stays (documented at the top of `convex/mcp.ts`). Authorization is genuinely shared, not re-implemented: `lib/auth.ts` gained `membershipFor(ctx, userId, orgId, minRole)` + `eventAccessFor(...)` and the existing `requireMembership` now calls straight through them, so a key and a browser session hit the identical check; domain logic is reused by exporting (behaviour unchanged) `withJoins`/`ensureOnboardingTasks` from submissions.ts, `computeConflicts` + a new extracted `autoPlaceCore` from agenda.ts, and `queueMessage`/`queueTaskReminders` from comms.ts. `scripts/verify-backend.mjs` grew an "MCP server" section (raw fetch against the live endpoint: initialize → tools/list ≥20 → tool calls by slug AND by id → confirm-guard → unknown tool/event → 401 paths → bad protocol version → revocation takes effect immediately → a fresh stranger's key sees zero events and can't read ours → all four discovery documents): **122 passed, 0 failed**. Gotcha: `better-auth/plugins/mcp` is not in the package's `exports` map — import `mcp` from `better-auth/plugins` or Convex's bundler can't resolve it.
- hierarchy + settings IA slice (rule 23): made the hierarchy **user → workspace → events** literal in the UI. New `src/lib/current-event.ts` is the single source of truth for "which event am I looking at?" (localStorage `sb.currentEventId` + `useSyncExternalStore`, migrates the old `sessionboard.currentEventId` key, falls back to the first event, clears a stale id, and returns `{events, event, workspaces, workspace, isLoading, isEmpty, setCurrentEventId/selectEvent, selectWorkspace}`); the two older hooks (`components/settings/current-event.ts`, `components/dashboard/use-current-event.ts`) were deleted and every importer repointed, and the five slices that still did `events?.[0]` (submissions, agenda, evaluation, communications, embeds) now resolve through the hook — so switching event moves the WHOLE app. SHELL: the sidebar event-context block IS the switcher now (chevron + hover, `aria-label="Switch event"`, `components/shell/event-switcher.tsx`) — events grouped under their workspace name with a check on the current one, then "All events" → /app/events and "New event" → the create dialog; the avatar menu became Account settings → /app/account · workspace name label · Workspace settings → /app/workspace · "Switch workspace" submenu (>1 workspace; switching jumps to that workspace's first event) · Sign out; per Marko's live feedback the sidebar nav went back to Dashboard · PROGRAM · Speakers/Communications · Settings (no "Events" item, no "Setup" label) so all event management lives in the switcher. NEW ROUTES: `/app/account` (profile name via `authClient.updateUser`, read-only email with a plain-English note, password change via `authClient.changePassword` with per-field errors + "signed out everywhere else", a card linking to the API-slice's API keys & MCP page, and a "what lives where" card) and `/app/workspace` (rename via `workspaces.update` role-gated, Members table with owner-locked roles + remove-with-confirm + invite-by-email dialog that toasts "Invite email sent", Invited pill for pending members, workspace Select + New workspace dialog, and a levels card) — Team was REMOVED from event settings (`/app/settings/team` + `components/settings/team-card.tsx` deleted, replaced by `components/workspace/*`), with a pointer line in the event-settings banner. `/app/settings` is now titled "Event settings — {event}" and every level carries the same `SettingsLevelNav` (Account · Workspace · Event) so the level is unmistakable. `/app/events` gained per-card delete behind a type-the-event-name dialog (`components/settings/delete-event-dialog.tsx`, shared with the event Danger zone). e2e: new "hierarchy" describe in `tests/e2e/smoke.spec.ts` (switcher lists both seeded events and switching changes the sidebar; /app/account, /app/workspace, /app/settings render clean) + both new routes added to the crawler. Research note (Marko's ask): real Sessionboard runs the same two levels but as two separate shells — you log in to an "Organization Dashboard" and step into an event, returning via a "Back to organization" link, with settings/integrations at the organization level and "event team members" per event; we keep ONE shell and make the event switcher carry that traversal ("All events" is our organization dashboard), which is fewer clicks for the same model. Gotcha re-learned: a Base UI `DropdownMenuItem` rendering a `<Link>` must pass `nativeButton={false}` or every render logs a console error (the e2e console watcher catches it).

- copilot slice (rule 24 — "the MCP's home"): the AI chat that can query and operate the ENTIRE Sessionboard, built on Vercel AI SDK v7 + AI Elements, with our own MCP server as its only tool source. SERVER: `src/routes/api/chat.ts` — TanStack Start POST handler, identity from the Better Auth cookie via `fetchAuthQuery(api.auth.getCurrentUser)` (401 before a token is spent), then `fetchAuthMutation(api.apiKeys.ensureCopilotKey)` for a bearer credential and `loadMcpTools()` against `{VITE_CONVEX_SITE_URL}/mcp`; `streamText({ model: openrouter(COPILOT_MODEL), tools, toolApproval, stopWhen: stepCountIs(16) })` → `result.toUIMessageStreamResponse()`. The copilot has NO private access path — it is a client of the same MCP surface Claude Code uses, so `membershipFor`/`eventAccessFor` re-run on every call and the copilot can never exceed the signed-in organizer. APPROVAL (the load-bearing bit): AI SDK v7's native mechanism, not a hand-rolled dance — a generic `toolApproval: ({ toolCall }) => isDestructiveTool(name) ? "user-approval" : "not-applicable"` (generic fn, not a per-tool map, because the tool set is discovered at runtime), the SDK suspends the call and streams `tool-approval-request`, the client renders a card and calls `addToolApprovalResponse({ id, approved })`, and `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses` resumes the turn. Destructive set (`src/lib/copilot.ts`): commit_decision_queue, set_submission_status, auto_place_sessions, send_reminders, send_test_email, update_form_settings, unschedule_session, plus a `/(delete|remove|destroy|purge|bulk|archive|reset)/` pattern so a tool added to convex/mcp.ts later is dangerous BY DEFAULT rather than by omission. MCP CLIENT: `src/lib/copilot-mcp.ts` is ~250 lines hand-rolled (initialize → notifications/initialized → tools/list → tools/call, JSON or SSE bodies) because `@ai-sdk/mcp` is not a top-level dependency and our server is stateless single-JSON — swapping in `createMCPClient` later changes nothing above `loadMcpTools()`. It sanitises the JSON Schemas (`additionalProperties`, empty `required`) that Gemini rejects. UI: `src/components/copilot/*` on AI Elements (`conversation`, `message`, `prompt-input`, `tool`, `confirmation`, `loader`, `suggestion`, `code-block` — installed individually with `yes n |` so no existing `ui/*` was overwritten), with generative UI for known tool shapes (list_submissions → table w/ shared StatusPill; get_event_summary/overview → stat cards + "needs attention"; list_speakers → avatar roster w/ outstanding work; list_events, list_outbox) and a JSON block for anything unrecognised. Two homes, ONE conversation: `src/lib/copilot-store.ts` keeps `Chat` instances in a module registry keyed by eventId (same external-store pattern as `current-event.ts`), so the ⌘I side panel (non-modal Sheet — added an additive `showOverlay` prop to `ui/sheet.tsx`; a scrim reads as "the app is blocked", which it isn't) and the full page `/app/copilot` share state and survive navigation; "New chat" bumps a generation. Convex: `apiKeys.ensureCopilotKey` mints ONE idempotent server-managed key per user (`kind: "copilot"`, plaintext stored because the server must re-present it every turn — hidden from `list`, blast radius = the session that minted it). Prompt gotcha worth remembering: the first system prompt told the model to "propose destructive actions and let them decide", and it dutifully asked in PROSE and never called the tool — the gate only works if the model CALLS the tool, so the prompt now says exactly that. VERIFIED end-to-end against the dev server with a real signed-in cookie, 10/10: streamed text + a read tool (`get_event_summary`/`get_event_overview`) executing unattended; `send_reminders` suspending with an approval request and NOT executing; approving it → tool executes (`{queued:0,skipped:8}`); denying it → never executes. typecheck 0 errors; eslint clean (vendored `ai-elements/**` got the same scoped override `interior/**` already has). GAP: `@ai-sdk/mcp` (the official client) is absent from package.json by instruction — noted, not added.
- coverage-audit pass (adversarial, 2026-08-11): re-ran the walkthrough video through `google/gemini-3.6-flash` on OpenRouter with a new `requirements_audit` prompt (adversarial auditor: "list EVERY requirement, expectation, preference, workflow detail, UI element and offhand remark a clone could be judged on, however small", each tagged EXPLICIT-REQUIREMENT / SHOWN-IN-PRODUCT / OFFHAND-PREFERENCE / SCOPE-EXCLUSION) → **60 numbered items** in `docs/video/requirements_audit.md`; merged those with the brief's 9 features + bonus rules, swyx's Discord clarifications and all 98 sbek rubric ids into ONE deduplicated **175-item** checklist, then had an INDEPENDENT evaluator verify every item against reality — `~/.opencode/bin/opencode run -m openrouter/google/gemini-3.6-flash` in 8 chunks of ~20, repo as cwd (read/grep/bash/webfetch), default verdict MISSING, docs explicitly disallowed as evidence, only `src/`/`convex/` source and live `localhost:3000` + `convex.site/v1` responses counted. Result in **`docs/reference/coverage-matrix.md`**: 124 COVERED · 19 PARTIAL · 31 MISSING · 1 CANNOT-VERIFY, plus a 24-rank effort-tagged GAP LIST, a 16-line CANNOT-VERIFY work order for the browser/e2e pass, and a TODO cross-check (new gaps appended to `TODO.md` under "## Coverage audit gaps"). Public widgets — the area the sbek digest called "0 of 16 covered" — now score 15/16 COVERED; the residual gaps cluster in (a) **side-effect emails that are configured but never fire** (`sendConfirmationEmail` and `notifyEmails` are both stored and read by NOTHING, so the builder's Notifications step is inert and a speaker who submits hears nothing), (b) **evaluation depth** (`blind` is a schema flag with zero enforcement in `review.ts`, criteria are `{id,label}` with no type/weight, plan assignment is plan-wide so co-evaluators share one queue), and (c) **event-settings fidelity swyx demoed** (no logo/background upload though `events.logoId` exists, no Columns chooser/Saved Views/Import/XLSX, no email theme). Two brief-text misses worth flagging: agenda ships List/Day/Rooms/Conflicts but brief #5 enumerates "list, day, **week**, **track**, or room", and there is still no explicit Publish/Go-live control (sbek AIA-07 `handoff` — its script hunts for that button). `autoRedirectToPortal` is plumbed to the client and honoured nowhere. Harness note: `opencode run` with gemini-3.6-flash intermittently dies on `{"code":400,"message":"Corrupted thought signature."}` mid tool-loop (hit 3 of 8 chunks; a plain re-run always succeeded) — budget a retry per chunk. Evaluator quality was high: every one of 12 independent spot-checks I ran confirmed its verdict, and it correctly refused to credit schema fields that no code reads. Churn seen mid-run: `src/components/settings/airtable-card.tsx` + `src/routes/app/settings/api-mcp.tsx` landed while the audit executed, flipping two items from absent to present — verdicts are a snapshot, evidence column names the file so re-checking is cheap. Also fixed two console-error defects the shared gate was tripping over: `shared/page-header.tsx` renders its description in a `<div>` (a `<p>` can't hold the Skeleton/chips callers pass — it was a hydration error on every loading page header), and `dashboard/forms-card.tsx` + `dashboard/speakers-table.tsx` now pass `nativeButton={false}` where a Button/MenuItem renders an `<a>`. e2e note: the deployment now carries a third event ("MCP Test Event" from the MCP suite), so no test may assume which event is current — the shell/switcher specs assert the switcher exists, then select the event they need.
- airtable slice (RULES 15 / HISTORY 40): shipped the one-click, ONE-WAY, idempotent Airtable mirror. `convex/lib/airtable.ts` is the whole API surface as pure helpers — `TABLE_SPECS` (the three tables we create: **Submissions** 17 cols, **Speakers** 16 cols, **Sessions** 10 cols, each with `Sessionboard ID` as the PRIMARY field), the three record mappers (`submissionFields`/`speakerFields`/`sessionFields`, sending `null` rather than omitting so the mirror CLEARS a cleared value), `chunk()` at Airtable's 10-records-per-request cap, and an `AirtableClient` that self-throttles to <5 req/s per base, retries 429/5xx on 1s→5s→30s, and turns every failure into a sentence an organizer can act on (401 "token rejected", 403 "add this base under Access", 404 "base IDs start with app", missing `schema.bases:write` → a checklist of exactly what to create by hand). **Upsert strategy: PATCH `/v0/{baseId}/{table}` with `performUpsert.fieldsToMergeOn: ["Sessionboard ID"]` + `typecast: true`** — so re-running a sync updates in place, never duplicates, and the cron and on-write hook may overlap freely. **Table creation IS automated** via the Metadata API (`POST /v0/meta/bases/{baseId}/tables`, scope `schema.bases:write`), deliberately in two steps — create with the primary field only, then `POST …/fields` one column at a time — so a single rejected field spec costs one column, not the table; the same field-add path also REPAIRS a hand-made table, and `upsert` prunes unknown columns on 422 `UNKNOWN_FIELD_NAME` and retries, so a partial table still mirrors what it can. `convex/airtable.ts`: `connect` is an **action** (not a mutation) because it proves the credentials against the live API before anything is stored — authorize → shape-check → `GET /v0/meta/bases/{id}/tables` → ensure tables → save → first full sync; plus `disconnect`, `syncNow`, masked-only `status` (never returns the token — `maskToken` prefix), `internalAction syncEvent` and the `syncPayload` internal query that builds all three tables from FOUR indexed scans + in-memory maps (no N+1). Near-real-time via two cheap paths: `scheduleAirtableSync(ctx, eventId)` — one line each in `submit.submit`, `submissions.commitQueue` and `submissions.addManual`, a single indexed read when nothing is connected, and a `syncScheduled` latch so a 40-row queue commit schedules ONE sync — and a new `airtable-sync` cron every 5 minutes for everything the write hook can't see cheaply (decisions, agenda moves, profile edits). New `airtableConnections` table (one per event, `by_eventId`); the PAT is stored as-is on purpose — encrypting it into the same deployment that holds the key buys obfuscation, not secrecy — and what actually protects it is that nothing returns it and every read runs `requireEventAccess`. UI: new **Settings → Integrations** tab (`src/routes/app/settings/integrations.tsx` + `src/components/settings/airtable-card.tsx`) — connect dialog with the token help link, the four required scopes as chips and a "where's my base ID" URL diagram; connected state with Connected/Demo badges, base deep-link, masked token, three row-count tiles, relative last-sync, Sync now (spinner + toast) and Disconnect behind the shared confirm. **`AIRTABLE_DEMO_MODE=1`** on the deployment makes `connect` skip live validation and `syncEvent` count rows without calling Airtable (badge says so in the UI) — that's how the feature is demo-able and verifiable with no Airtable account; it is currently UNSET so the dev deployment behaves for real. `scripts/verify-backend.mjs` grew an **Airtable** section that asserts BOTH worlds (no connection → null; stranger can't read/connect/disconnect; syncNow without a connection refused; junk token → friendly error and nothing stored; with demo mode → connect/masked-token/counts/lastSyncAt/idempotent-reconnect/disconnect roundtrip): **129 passed, 0 failed** without demo mode, 143/143 with it. Verified in Chromium at 1440px: tab, dialog, error state and connected state all render with zero console errors. Fixed on the way: `components/settings/errors.ts` only unwrapped `Uncaught Error:`/`Uncaught ConvexError:`, so a custom subclass leaked "[CONVEX A(airtable:connect)] … Server Error" into the UI, and its terminator cut messages at the word " at " — now `/Uncaught \w*Error:\s*(.+?)(?:\n|$)/`. What remains for a REAL Airtable proof: a personal access token with the four scopes plus a base ID from Marko — table creation, upsert and rate-limit behaviour have never been exercised against the live API.
- landing-attio slice: rebuilt the marketing homepage in Attio's visual language (RULES.md #22/#25) on **real product screenshots**, and wrote the capture pipeline that produces them. `scripts/capture-screenshots.mjs` drives the seeded demo through Playwright (sign in via the real login form → 7 screens → 4-frame agenda drag → ffmpeg GIF) into `public/screenshots/*`: `dashboard`, `submissions`, `agenda`, `agenda-list`, `form-builder`, `portal`, `public-schedule`, `agenda-flow.gif`, all 2880×1800 with the TanStack devtools bubble hidden and the day grid pre-scrolled onto the programme; refresh procedure + failure modes in `scripts/capture-screenshots.md`. Mobbin research (Attio landing/pricing/footer sections) fixed the language: transparent nav that grows a hairline on scroll, one oversized tight-tracked headline per band with the second clause dropped to muted, graph-paper wash behind the fold, hero shot cropped from the top so it bleeds off the fold, flat cells inside one bordered container instead of floating cards, and a dark closing-CTA + footer sharing one ground (our `--foreground` ink, not brand blue — colour stays on data). New sections: `platform-section.tsx` (the real `/v1/event/{slug}` REST surface + `.ics` feed + the 27-tool MCP server and copilot, shown as static prompt chips — no fake chat) and `closing-cta.tsx`. `product-shot.tsx` was rewritten from 27k of drawn mocks to a screenshot frame + `SHOTS` registry (src, alt, chrome URL per capture). **Defect found and worked around: interior.dev's `blur-up-image` never reveals here** — its ref doesn't land on `motion.img`, and its "instant" path drops `filter` from the animate object, so every shot sat frozen at `blur(16px)`; `BlurUpShot` keeps interior's timing but drives off the image's own `load` event and lists every property in both animate states. Also corrected a false claim the old footer shipped: the public API is `/v1/event/{slug}/…` on the Convex site domain, not `/api/v1`. Per Marko mid-slice: press-depth is now hero-CTA-only (`PepButton` dropped from the closing CTA), and the coming rename means the product name/domains live in `PRODUCT_NAME` / `PRODUCT_APP_HOST` / `PRODUCT_SITE_HOST` in `marketing/links.ts` rather than inline strings. Verified at 1440 and 360: zero console errors, zero horizontal overflow, every shot revealed; typecheck clean, lint clean on the slice. Recapture after the app-wide revamp — the portal's blue card headers and the lavender page-header banner in the shots are pre-revamp chrome.
- MCP live-fire test (rule 21): drove all **27 MCP tools** through a REAL Claude client — `claude mcp add sessionboard --transport http <site>/mcp --header "Authorization: Bearer sb_live_…"` (verified `✔ Connected`), then eight unattended `claude -p` sessions (haiku-4-5, `--allowedTools "mcp__sessionboard__*"`, stream-json transcripts) against two freshly minted personal API keys. **Verdict: 25 works · 2 works-but-rough · 0 broken** — a conference was discovered, extended, triaged, scheduled, chased and emailed entirely from plain-English prompts with zero UI. Guard rails held live: `commit_decision_queue` refused without `confirm: true` with a next-call-naming message, `schedule_session` wrote a double-booking *and* reported the conflict, `send_reminders` de-duped 8/8 inside 20h, and revoking a key **mid-session** killed 8/8 subsequent calls instantly. Three real defects found in the edges and **fixed in `convex/mcp.ts`** (typecheck 0, each re-verified live): (a) tool arguments were never validated against `inputSchema`, so a missing field surfaced as a raw Convex `ArgumentValidationError` that leaked the caller's Better Auth userId — now a `validateArgs()` pass (required/type/enum/unknown-key) returning clean `-32602` messages, and a real client observably self-corrected `status: "approved"` → `accepted` off the enum error; (b) tool errors carried `Uncaught Error:` + Convex stack frames into the model's context — now stripped by `toolErrorMessage()`; (c) `update_template`/`send_test_email` accepted ANY `key`, silently creating an invisible dead template that `list_templates` showed as customised and nothing would ever send — now `enum: TEMPLATE_KEYS` + server-side guards. Fumbles logged for the follow-up: Claude Code **defers a 27-tool server** so selection happens on tool NAMES not descriptions (one session burned 7 ToolSearch calls); `get_event_overview` lost a head-to-head with `get_agenda`/`get_event_summary` (~80% overlap); `list_speakers(onlyWithOutstandingWork)` returned 11 rows and the model reported 8 because the flag conflates open tasks with incomplete profiles; every public/portal URL came back `http://localhost:3000/…` (SITE_URL unset). The one real gap in the "do everything via MCP" promise is **deletion** — create_event/create_form/assign_task have no inverses, so cleanup needed a direct `events.remove`. Full per-tool verdict table, transcript highlights and a ranked 10-item fix list → `docs/reference/mcp-live-test.md`.
- design-revamp slice: shipped candidate **E "De-blued"** across the token layer and the
  shared primitives. `src/styles.css`: the whole neutral ramp went off Tailwind *slate*
  (chroma 4.6–14.5) onto zinc-register greys (chroma ≤ 2) — `--background #F8FAFC→#FAFAFA`,
  `--foreground #1B1E27→#17171A` (the "black" was blue), `--muted-foreground #64748B→#6E6E76`,
  `--accent #EEF1FC→#F4F4F5` (the lavender that fired on every hover), `--accent-foreground
  #1E3FA8→#17171A`, `--secondary`, `--border #E5E7EB→#EAEAEC`, `--input`, `--sidebar
  #F1F5F9→#FAFAFA`, `--sidebar-accent #E4EBFC→#EFEFF1`, `--sidebar-border`, and the three
  `--status-gray-*`; `--status-blue-*` went neutral so Active/Scheduled stop reading as
  links. `--primary` STAYS `#2F5CE0` (Marko rejected petrol) and `--ring`/`--sidebar-primary`/
  `--chart-1` now *reference* it, so the accent can never be re-typed out of sync. Added:
  the `--primary-hover/-active/-surface/-surface-hover/-border` ramp, five `--tag-*` tint
  pairs (categorical data colour), and `--control-h 40px / --control-h-sm 36px / --row-h 44px`
  (RULES #22 — Attio's system, not its density). Components: `PageHeader variant="banner"`
  is now a neutral hairline (`border-b border-border`) instead of `bg-accent border-primary/10`,
  which de-lavendered every organizer page in one edit; `StatusPill` gained `variant="dot"`
  **as the default** (8px dot + ink label) with `variant="pill"` kept for queue banners and
  drawer headers; new `shared/tag.tsx` on the `--tag-*` tokens; `EmptyState`'s icon tile went
  neutral; `Card` dropped its shadow for a single hairline (`ring-border`); Button/Input/
  Select/InputGroup/Toggle bound to `--control-h`, Table to `--row-h` with muted headers.
  Sweep: `border-primary/15|20` banner chrome → `border-border` in insight-banner, queue-banner,
  bulk-bar, message-drawer, builder-controls, questions-step. Contrast verified computationally:
  white on `#2F5CE0` 5.31, muted text 4.84 on page / 5.05 on card, every status and tag pair
  ≥ 5.6. Brand assets stay blue; `public/og-image.png` regenerated on the new neutral surface.
- design-system + flicker slice: `/design-system` Color section rewritten to the shipped
  truth (new surfaces, the primary ramp, a Categorical tags row) with Stripe's colour policy
  written into the section description; Status section documents dot-vs-pill. The Explorations
  section is now the RECORD of the decision — one panel of what shipped plus a list of what
  lost and why — and lost its six `@fontsource-variable` imports and the unlayered
  `[data-demo-panel]` font rules (`explorations.css` deleted). Root-caused Marko's "flickering":
  six variable webfonts reflowing the longest page in the app, plus ~45 interaction demos whose
  `setInterval`s and rAF loop ran forever regardless of visibility. `InteractionsCatalog`'s
  `Demo` tile now mounts its child only within 600px of the viewport and holds the measured
  height open when it unmounts. Measured after: **rAF calls while idle 443 → 1 over 1.5s, 0
  additional over the next 3s**; document height identical on return to top. Toasts: Sonner was
  following the OS theme on a light-mode-only app, so its dark-theme rule painted descriptions
  near-white on white — pinned to `theme="light"` and every part (title ink, description muted,
  per-status icon colour, surface, action buttons at `--control-h-sm`) bound to tokens. Verified
  live: "Public link copied" renders title `#17171A` (17.1:1) and the URL `#6E6E76` (5.05:1).
  Screens re-shot at 1440px: /, /login, /app, /app/submissions, /app/agenda, /app/settings,
  /app/speakers, /app/forms, /design-system.
- brand-menu slice: right-clicking a logo used to `window.location.assign("/design-system")`
  — a right-click that teleports you off the page ("went in the nut bar"). Replaced with a
  real brand CONTEXT MENU at the cursor (Vercel/Linear pattern): **View design system ·
  Download logo (SVG) · Download logo (PNG) · Copy logo as SVG**, the last three wired to the
  existing `brandSvg` / `downloadSvg` / `downloadBrandPng` generators in `brand/assets.ts`, so
  the menu can never hand out a logo that differs from the rendered one. New
  `src/components/ui/context-menu.tsx` wraps Base UI's `ContextMenu` with the dropdown's exact
  styling (label is a plain div for the same reason `DropdownMenuLabel` is). `Logo`/`LogoMark`
  now wrap in `<BrandMenu>`; the lockup owns the menu and its nested mark opts out, so you
  never get two menus. `disableBrandMenu` still returns the browser's own menu. Verified live:
  four items render at the cursor, right-click does NOT navigate, "Copy logo as SVG" puts real
  SVG on the clipboard, left-click still navigates, "View design system" goes to /design-system,
  zero console errors.


## 2026-08-11 ~03:50–04:40 — Parity fix wave 1 (coverage-matrix UI gaps)

Six gaps from `docs/reference/coverage-matrix.md`, UI + the minimal backend each needed.

- **Agenda Week + Track views** (matrix #144 / brief #5 "list, day, week, track, or room").
  `VIEWS` is now `list · day · week · track · rooms · conflicts`, same `?view=` URL pattern.
  New `agenda-time.ts` helpers (`weekStartKey`/`weekKeys`/`formatWeekdayShort`/`formatWeekRange`,
  Monday-first) so the week math lives with the rest of the timezone math.
  `week-view.tsx` — 7 day columns at HALF the Day grid's zoom (`WEEK_PIXELS_PER_MINUTE`),
  one shared window widened over the whole week (not just the selected day), event days
  tinted, per-day session count links into the Day grid, 2-lane overlap nudge.
  `track-view.tsx` — the Day grid with tracks as columns + a "No track" column that only
  appears when something is untracked. A track is NOT a room: two talks on one track can run
  at once in different rooms, so `laneOut()` does greedy interval partitioning and puts them
  side by side (percentage widths) instead of hiding one behind the other.
- **Publish / go-live** (sbek AIA-07 `handoff`). `events.agendaPublishedAt` (optional) +
  `agenda.publishAgenda` / `unpublishAgenda` (admin). `agenda.board` returns `slug` +
  `agendaPublishedAt`. Toolbar: `[Publish agenda]` with a confirm dialog ("Makes the schedule
  visible on your public event page" + what goes live + reversible) ↔ `Published · <date>`
  pill with `Unpublish`. `convex/publicData.ts` gates on it: unset ⇒ `sessions: []` /
  `days: []` / `session: null` plus `publicMessage: "Schedule coming soon"` on schedule,
  sessionsList, sessionDetail and speakerItinerary; the speaker gallery keeps the PEOPLE but
  drops their slots (matches the button's own copy). `/e/` empty states read `publicMessage`.
  Seed publishes the main demo event; **Design Systems Day stays unpublished on purpose** —
  it has an accepted, scheduled session, so an empty public schedule can only come from the gate.
- **Speakers roster completeness** (SPK-02 / SPK-04 / CNT-10). New `convex/speakersAdmin.ts`:
  `addManual` (idempotent on email — fills blanks instead of duplicating), `updateProfile`,
  `setWorkflowStatus`. New optional `people.workflowStatus` (invited|confirmed|dropped) and
  `people.headshotNote` (internal, never public). `workflowStatus`'s presence is also what
  keeps a hand-added speaker on the derive-only roster before they have an accepted session
  (`dashboard.speakersRoster`). UI: `[Add speaker]` dialog, an inline status select per row
  (`speaker-workflow-select.tsx`), an "Any status" filter, and a profile drawer with editable
  bio + headshot note. The drawer deliberately does NOT merge reactive updates into open
  fields — a text box that rewrites itself under the cursor is worse than a stale one.
  Organizers note what they need about a headshot; the IMAGE stays the speaker's to upload.
- **Bulk email composer** (SPK-13). `comms.composeBulk` + `comms.recipientCount` (the composer's
  live count and the send call the same `resolveBulkRecipients`, so they can't disagree).
  Filters: all speakers / accepted / incomplete tasks / manual picks. `queueMessage` gained an
  optional `override: {subject, body}` so ad-hoc copy still renders per-person placeholders and
  still lands in the ordinary outbox — the @example.com preview rule is inherited, not re-built.
  UI: `[Compose]` on Communications, merge-field chips that insert at the cursor, live "this
  will send N emails", toast + jump to the Outbox.
- **Embed generator last mile** (EMB-15, the rubric's highest-value single item). New `embeds`
  table + `convex/embeds.ts` (list/save/remove, widget + format validated server-side; cascades
  in `events.remove` and `seed.purgeEvent`). Page restructured into 1. widget → 2. **format**
  (embedded widget / direct link / static HTML / JSON feed / calendar feed) → 3. options, with
  a saved-embeds shelf that loads a configuration back into the configurator. Static HTML is
  generated from the live program and says out loud that it's a snapshot. Shared vocabulary in
  `components/embeds/embed-config.ts`.
- **`autoRedirectToPortal` honoured** (#65). The submit success card counts down 3s out loud
  ("Continue to portal — 3s" + "Stay here" cancel) and then navigates. A settings toggle that
  did nothing now does something visible.
- **Assign-a-task dialog reworked** (Marko feedback on the screenshot): task type was a bare
  Select of jargon — now radio cards under "What should the speaker do?", each stating its own
  completion behaviour ("Ticks itself off as soon as their bio is filled in"). **"Fill out a
  form" removed everywhere** (dialog + MCP `assign_task` enum/description) — audit-confirmed
  dead config, nothing ever read `kind: "form"`, so it was a promise the portal couldn't keep.
  The modal no longer stretches the page: `max-h-[85svh]`, header and footer pinned, fields
  scroll inside.
- **verify-backend extended** (+52 checks, 122 → **174 passed, 0 failed**, stable over 3 runs):
  publish gate (draft event has a scheduled session internally but an empty public schedule,
  `publicMessage`, publish reveals it, unpublish re-hides it), saved embeds CRUD + validation,
  composeBulk (per-filter counts, one message per recipient, rendered placeholders, empty
  subject/body/audience refused), manual speaker (created with a portal token, appears in the
  roster, idempotent on email, bio + headshot note + workflow status persist), and five new
  cross-org refusals (add speaker, edit profile, publish, bulk email, list embeds).
  One pre-existing assertion was widened, not weakened: another slice added schema-level
  required-argument validation to the MCP server, so `commit_decision_queue` without
  `confirm` now refuses with JSON-RPC `-32602` instead of a tool error. Both are correct
  refusals; the check now accepts either and still requires the word "confirm".
- Verified live in the browser: Week grid (7 columns, day counts, session blocks), Track grid
  (colour-dotted track columns, side-by-side parallel sessions), Published pill + Unpublish,
  roster Status column with hand-added speakers at 0 sessions, embed generator with the format
  step and the gated preview rendering "Schedule coming soon".

## 2026-08-11 ~04:00–04:45 — File storage, end to end (Convex-maxing)
Storage was the one Convex primitive we used at 30%: uploads worked, but the app trusted the
browser's `size`/`contentType`, never called `storage.delete` **once** (every replaced headshot
and deleted event orphaned its blobs forever), and `events.logoId` was dead config.
- **Metadata is now read, never accepted.** `convex/lib/files.ts` is the new storage layer:
  `storageMeta` reads `ctx.db.system.get("_storage", id)` for the real size, MIME type and
  sha256; `assertAllowedUpload` gates on those (25 MB cap, allowlist of images/PDF/decks/docs/
  zip, SVG deliberately excluded) at attach time; `enrichUploads` builds one read model —
  size, type, checksum, signed URL, `isImage`, `missing`, `duplicateOfVersion` — shared by
  `portal.myUploads`, `tasksAdmin.listUploads`, `submissions.get` and `files.submissionFiles`.
  Same sha256 in a slot renders as "identical to v2" instead of a third silent copy.
  Convex returns sha256 **base64**-encoded, not the base16 the docs claim (verified live).
- **Nothing orphans any more.** `replaceHeadshot` treats the profile photo as a current value:
  a replacement deletes the superseded loose upload row AND its blob, while a headshot attached
  to a task/submission (a reviewed deliverable) survives. `deleteUploadRow` (organizer "delete
  version") drops row + blob and clears `headshotId` if it pointed there. `releaseBlob` never
  deletes a blob another row still references (new `uploads.by_storageId` index).
  `events.remove` → `deleteEventCascade` now calls `deleteEventBlobs` FIRST (it reads the rows
  it is about to delete); the seed purge covers logo + background too.
  `files.sweepOrphans` (internalMutation, `pnpm exec convex run files:sweepOrphans`) drops
  dangling rows/headshot refs and — with `deleteUnreferenced` — blobs nothing points at, with
  a `minAgeMinutes` guard so an in-flight upload is never mistaken for rot.
- **New `convex/files.ts`** (organizer side, all `requireEventAccess`): `generateUploadUrl`,
  `eventBranding` + `setEventBranding` (admin; replacing/clearing deletes the old blob),
  `attachUploadAsOrganizer` (files a deck that arrived by email against the primary speaker,
  version-aware, starts `approved`), `deleteUpload`, `submissionFiles`, `sweepOrphans`,
  `blobsExist` (internal; how a black-box test proves bytes are really gone).
- **Event branding closes TODO [10]**: `events.backgroundId` added; Settings → Event details
  gets a Branding card (logo + optional header background, previews, sizes, remove); the logo
  now renders in the `/e/` public header and the speaker-portal header, with the background as
  a tinted hero — text fallback when unset. `events.getBySlug` and `portal.home` serve the URLs.
- **Upload UX**, shadcn-first and shared: `src/components/shared/file-drop-zone.tsx`
  (drag-drop, click, client validation before the bytes move, real XHR progress) and
  `file-row.tsx` (image thumbnail or typed icon, human size, version, dedupe hint, status,
  download-as-real-filename). Portal tasks, the headshot uploader, the submission drawer's
  Files tab and event branding all use them; `src/lib/files.ts` holds the one copy of the
  limits, allowlist, labels/icons and the progress upload.
- **"Download files bundle" parity with no new dependency**: `src/lib/zip.ts` is a ~150-line
  store-only ZIP writer (CRC32, local headers, central directory, EOCD). Files tab → "Download
  all" fetches every file and saves one `.zip`. Six unit tests, including a real `unzip`
  round-trip (117 unit tests pass).
- **verify-backend Files section rebuilt** (+34 checks, **217 passed, 0 failed**): metadata
  matches the bytes (a client that claims `size: 1` for 26 bytes is ignored), sha256 matches
  a locally computed digest, unsupported types refused server-side, duplicate detection,
  headshot replacement deletes the old blob (`blobsExist` → false) while the current one
  survives, organizer attach → visible in the speaker's portal → delete removes row and blob,
  logo upload → served publicly → cleared → blob gone, event delete takes its blobs with it,
  three more cross-org refusals, and a housekeeping section that makes the sweep find, then
  delete, the one blob whose attach was refused — ending on zero orphans.

## 2026-08-11 — Documentation surface (`/docs`): user guide + API + MCP (RULES.md 27)

- **Fumadocs verdict: NOT integrated — deliberate, blocked on deps.** Fumadocs *does* now
  support TanStack Start (official guide: fumadocs.dev/docs/manual-installation/tanstack-start —
  `fumadocs-core` + `fumadocs-ui` + `fumadocs-mdx`, `routes/docs/$.tsx` splat + `RootProvider`
  in `__root.tsx`). It was not adopted in this pass because this session was explicitly barred
  from touching `package.json`, and a half-wired Fumadocs is a typecheck failure, not a docs
  site. Built the native equivalent instead — sidebar tree, breadcrumbs, prev/next pager,
  prose styling — on our own tokens, which is also ~0 KB of new dependency on a page a
  browser-agent judge will crawl.
  **NEEDS-DEPS (to switch to Fumadocs later):** `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`,
  `@types/mdx`. Note it would also require `fumadocs-ui/css/preset.css` in `src/styles.css`
  and `RootProvider` wrapping the whole app in `src/routes/__root.tsx` — i.e. it is not a
  docs-local change. `fumadocs-openapi` was evaluated and rejected: Scalar renders our spec
  better and needs no build step.
- **Scalar: integrated via its standalone CDN bundle** (`Scalar.createApiReference`), not the
  npm package — same reason (no `package.json` writes) plus it keeps a ~1 MB reader out of the
  app bundle for a single route. `src/components/docs/scalar-reference.tsx` degrades to a
  "download openapi.json" card if the CDN is blocked, so the page is never empty.
- **Structure** — `src/routes/docs/route.tsx` is the shell (sticky header, 224px sidebar tree,
  breadcrumb, prev/next); `src/docs/nav.ts` is the ONE place a docs page is registered (order
  there = sidebar order = pager order); `src/components/docs/doc-primitives.tsx` holds
  `DocArticle`/`Steps`/`Step`/`Shot`/`Callout`/`DocLink`; `.doc-prose` in `src/styles.css`.
  15 routes: `/docs`, 11 guide pages under `/docs/guide/*`, `/docs/api`, `/docs/mcp`.
- **User guide** — one page per flow, 4–5 steps of one sentence each, a screenshot per step:
  getting-started · create-a-cfp-form · share-and-collect · review-and-decide · speaker-portal ·
  build-the-agenda · chase-speakers · publish-your-program · team-and-workspaces · airtable-sync ·
  ai-copilot. Every label in the copy was read off the real components (e.g. "Route answers to
  tracks", "Send acceptances", "Remind all incomplete", "Invite teammate", "Publish agenda").
- **Screenshots — 32 in `public/docs/`** — `scripts/capture-screenshots.mjs` gained `--docs`
  (and `--marketing`) modes, 1440×900 @2x, cropped to the dialog/drawer where a region reads
  better than a full page. Every shot is best-effort and `<Shot>` degrades to a labelled
  placeholder, so a missing capture can never break a page or the build.
  **Gotcha worth remembering:** the first run silently shot a *different event* — this is a
  shared dev database, and a concurrently-created "Copilot Verification" event won the default
  selection, so the agenda/speakers/submissions shots were all empty states. The script now
  self-heals via `gotoOrganizer()`, which re-checks the sidebar for "AI Engineer Summit 2026"
  after every `/app/*` navigation and re-selects the event when it drifts. Verify captures by
  eye before trusting them.
- **OpenAPI accuracy method** — `public/docs/api/openapi.json` (3.1) was hand-authored against
  `convex/http.ts` (routing, bearer check, paging clamps, CORS, the RFC 5545 writer) and the
  four `internalQuery` projections in `convex/publicData.ts`, then **verified field-by-field
  against live responses** from the deployment (`sessions`, `speakers`, `submissions`,
  `schedule.ics`, and the 401 body). Examples in the spec are real payload shapes, not invented.
- **MCP docs cannot drift** — `scripts/generate-mcp-tools.mjs` parses the `TOOLS` literal in
  `convex/mcp.ts` (brace-balanced scan, not a loose regex) and emits
  `src/docs/generated/mcp-tools.ts`: every tool with title, description, `readOnly`,
  `requiresConfirm` and required args, grouped for the page. It **throws** if a new tool is not
  assigned to a docs group, and `--check` fails CI when the file is stale. It caught four
  tools added mid-session (`get_template`, `delete_event`, `delete_form`, `remove_task`) —
  the table is now 31. `MCP_TOOL_COUNT` in `src/components/marketing/links.ts` and the
  settings capabilities card now re-export that generated number instead of hardcoding 27.
- **Entry points** — landing footer "Developers" column now links Documentation / API reference /
  MCP server; the organizer avatar menu gained a "Docs" item; the speaker-portal avatar menu
  gained "How this works" → the portal guide page.
- **Verified end to end** — a Playwright pass over all 14 routes: every page has an `<h1>`,
  0 broken images, 0 undelivered-shot placeholders, no 4xx/5xx, no console errors, and no
  horizontal scroll at 1440px or 390px (the header's "Open the app"/GitHub buttons move into
  the mobile sheet below `sm`, which is what was overflowing a 390px phone).
- **Reuse cleanup** — the `.convex.site` URL derivation was duplicated in
  `mcp-connect-card.tsx`; it now lives once in `src/lib/deployment-urls.ts` and both the
  settings card and the docs read it.

- copilot generative-UI slice (rule 24, "generative UI for tool results" — the half the first copilot pass left as JSON): **all 31 MCP tools now have a purpose-built rendering**, the chat chrome was rebuilt on shadcn's June-2026 chat components, the side panel became a resizable workspace, and the copilot learned what screen the organizer is on. THE REGISTRY: `src/components/copilot/tool-views/` — `registry.tsx` maps tool NAME → `{icon, OutputView}` (name, because our tools are discovered at runtime from convex/mcp.ts and therefore arrive as AI SDK `dynamic-tool` parts with a `toolName` string, never a compile-time `tool-<name>` union), with a JSON `RawFallback` for anything unregistered and a real React error boundary (`ToolViewBoundary`) so a drifted payload costs one card, not the conversation — a try/catch would not do, React renders the element long after the factory returns. `shared.tsx` is the vocabulary every view is built from (Panel/Rows/Row/Tile/Banner/StatRow/StatCard/FieldGrid/DiffRow/Chip/TrackTag/MiniProgress/LinkRow/GoLink/MoreLink/EmptyRow/ToolAlert + defensive readers), token-classes only because the design revamp is re-skinning underneath. `tool-frame.tsx` is the RECEIPT: a collapsed-by-default Base UI `Collapsible` with the tool's icon, its humanised title and a `StatusPill` for the AI SDK state (Preparing/Running/Needs you/Done/Failed/Cancelled — a tool call is just another thing with a state and must not invent its own colour language), expanding to the humanised arguments and the raw JSON. Views by family: `events.tsx` (workspaces, events w/ a **Current** badge off `useCurrentEventId`, create_event, and ONE `EventStatsView` serving both get_event_summary and get_event_overview — stat row, status-pill strip, "needs attention" list, conflict tile, forms, deadlines, quick links), `forms.tsx` (form cards; `create_form` is the end-to-end moment: "X is live" banner → copyable public link → *Edit in form builder →* → *View public form ↗*; `update_form_settings` renders a real before → after diff), `submissions.tsx` (a real `Table` capped at 8 rows with StatusPill + track dot + speaker avatars, and a "view all N in Submissions →" link that **re-encodes the tool's own filter arguments as the screen's URL**; detail card w/ reviews and uploads; status transition row; decision-queue banner linking the outbox), `agenda.tsx` (per-day grouping with per-room count chips, loud red conflict tile, unscheduled tray, slot cards, auto-place summary), `speakers.tsx` (roster rows with a readiness bar + outstanding-task chips, portal magic link treated as a credential), `comms.tsx` (template cards with HTML bodies **flattened to text** — rendering a template's HTML in the chat is both a styling accident and an injection surface — outbox rows, test-email proof). CHROME (Marko's screenshot: the composer rendered as a bare blue-ring box): rebuilt `copilot-chat.tsx` on shadcn's `MessageScroller`/`Message`/`Bubble`/`Marker` — MessageScroller owns anchored turns, follow-only-at-the-live-edge autoscroll and jump-to-latest, user turns are tinted bubbles, assistant turns are full width so tables and tool cards get the room; AI Elements stays for what shadcn deliberately doesn't ship (`prompt-input`, `tool`, `confirmation`). **The composer bug was `PromptInputBody`**: it renders `display: contents`, which flattens the LAYOUT tree but not the DOM tree, and `InputGroup` styles itself with `:has(> …)` selectors that only see real DOM children — so the group missed its own textarea and block-end addon and collapsed to a 24px sliver. The textarea and toolbar are now direct children of `PromptInput`. RESIZABLE PANEL: left-edge `role="separator"` handle — pointer events + `setPointerCapture` (so the drag survives outrunning the 8px hit area), rAF-throttled, min 360 / max min(720, 60vw), ArrowLeft/Right ±24 (×4 with Shift), Home/End, double-click or Enter to reset, width persisted in `sb.copilotPanelWidth` and re-clamped on viewport resize. It also needed the Sheet to stop dismissing itself: `modal={false}` alone still let Base UI close the dialog on outside press and focus-out, so the first click on the table behind the panel killed the conversation — and a drag ending past the panel's left edge counted as an outside press, which made the handle unusable. Base UI has no `dismissible` prop on this Root, so `onOpenChange` now filters by `eventDetails.reason` (`ignoreDismissal`), keeping Escape and the close button as the only ways out. APP-STATE CONTEXT (Marko's SOTA directive): `src/lib/copilot-context.ts` replicates CopilotKit's `useCopilotReadable` in ~120 lines — a module registry of facts that live exactly as long as their component is mounted, flattened onto every request by `prepareSendMessagesRequest` and injected into the system prompt. `copilot-app-context.tsx` mounts once inside the panel (which lives in the /app shell) and reports the selected event, the current page, and the filters/selection the page keeps in the URL — free, because Sessionboard puts every filter in the query string. Two departures from CopilotKit: a hard budget (200 chars/entry, 1200/block) and the prompt saying explicitly that the screen is CONTEXT, NOT TRUTH — a model that reads a count off a filter chip instead of calling a tool is the exact failure rule 24 exists to prevent. SOTA EVALUATION in `docs/reference/copilot-sota.md` (assistant-ui + CopilotKit + AG-UI/ChatKit/MCP-UI, adopt/replicate/skip per capability): **zero new runtime dependencies taken**. The headline finding is a validation — assistant-ui's own answer for runtime-discovered tools is `ToolFallback`, a single component that branches on `toolName`, i.e. exactly the registry we hand-rolled; `defineToolkit` keys on literal names and needs a `"use generative"` compiler plugin. CopilotKit's runtime speaks GraphQL/AG-UI and cannot front an AI SDK v7 route without becoming the outer shell, so only its readable-context idea was taken. Deferred and documented: multi-option approvals ("always allow"), LLM-generated contextual suggestions, a persisted thread list. BACKEND: one additive change — `updateFormSettings` now returns `previous {status, closeAt, settings}`, because an "updated!" with no previous value is unverifiable by the reader and the diff view would otherwise be theatre. VERIFICATION, three layers. (1) `scripts/verify-copilot.mjs` drives the REAL `/api/chat` with a real signed-in cookie, one prompt per tool: every one of the 31 tools reached, every destructive one suspended on an approval request and did NOT run, then ran after the approval was answered — every check green across the runs (transient `fetch failed` turns were the dev server restarting under concurrent edits, and each re-ran green on its own), and it writes every captured `{input, output}` to `tests/fixtures/copilot-tool-payloads.json`. (2) `tests/unit/copilot-renderers.test.tsx` (jsdom via a per-file pragma; `vitest.config.ts` gained the `@`/`@convex` aliases and `.tsx` in `include`) renders every view against **those live payloads — 31/31 captured from real runs** — plus empty and deliberately hostile payloads, and asserts the specifics that make each view worth having (8-row cap + filter-encoded link, before→after status pills, per-room counts, readiness bars, copy buttons on every URL, HTML bodies flattened not rendered): **116 tests, all passing**. A `data-view-fallback` marker makes "rendered richly" distinguishable from "gave up", so the coverage assertion is real. (3) Visual: Playwright at 1600×1000 (the shared chrome-devtools browser was being driven by other agents mid-run, so the pass runs on its own instance) — **14/14** on the chrome half (panel opens, drag widens, drag clamps to the max, width persists and survives a reload, Home/End/ArrowLeft, double-click reset, full page renders, no horizontal overflow at 900px, clicking the table behind the panel does NOT close it, Escape does, zero console errors) plus the marquee prompts and the approval card. Gotchas worth keeping: the AI SDK's resumed post-approval turn streams only `tool-output-available`, which carries no `toolName`, so a verifier has to remember the toolCallId→name map from the suspending turn; and `update_template`/`schedule_session` are NOT in `DESTRUCTIVE_TOOLS`, so a test that expects them to ask for approval is testing the wrong thing. Also fixed on the way, because it was tripping the console gate on the screen the copilot most often sits next to: `submissions/status-tabs.tsx` renders each status tab as a real `<Link>` (every filter is a URL — the judge is a browser agent) but never told Base UI, so `TabsTrigger` logged a `nativeButton` error on every render; it now passes `nativeButton={false}`. typecheck 0 and eslint clean on the slice.

## 2026-08-11 — Adversarial-audit gaps 1–3: the three side effects that never fired

The coverage audit's three highest-ranked gaps shared one shape: **a control the UI promises
and no code honours**. All three are now enforced in the backend, not just rendered.

- **Submission confirmation email** (matrix #84, sbek CFP-08). `convex/submit.ts:submit` now
  queues the `confirmation` template through `internal.comms.queueForPerson` — the same call
  `submissions.commitQueue` uses, so rendering, the outbox row, the `@example.com` preview
  rule and delivery are inherited rather than re-implemented. Recipients are the submitter
  **plus every speaker participant** (a co-speaker someone else added still learns their name
  is on a talk), deduped by person id, each carrying `submissionId` so `{{sessionTitle}}`
  resolves. Gated on `participantConfig.sendConfirmationEmail` — the toggle the builder has
  shown since day one. Wrapped in try/catch: the submission row is already written when this
  runs, and no mail problem may roll a speaker's work back.
- **`notifyEmails` organizer alerts** (matrix #69 — the audit's own new finding: the entire
  Notifications wizard step was inert). These recipients are organizer email addresses, not
  event `people`, so they structurally cannot use the outbox (`messages.personId` is required
  and merge fields resolve per-person). New `platformEmails.sendSubmissionNotification`
  internalAction sends them directly through the shared `sendTransactionalEmail` door, and
  `notifySubmissionAdmins(ctx, {submissionId, kind})` resolves the form + notify list itself so
  callers stay one line: `submit.submit` fires `kind:"new"`, `portal.updateSubmission` fires
  `kind:"updated"`. Scheduled fire-and-forget, deep-linked to `/app/submissions?id=…`.
  **Deliberate v1 limit:** no dedupe window, so three saved edits send three alerts — logged
  in TODO as [2b] with the `lastNotifiedAt` fix. The wrong-way failure (an alert that never
  fires) was the one the audit caught.
- **Blind review enforced** (matrix #112, sbek ABS-07 `scoping`). `blind` had been a schema
  field with zero readers. `review.queue` now computes `anonymized = plan.blind === true` and,
  when set, **never queries `submissionParticipants` at all** — the identities are absent from
  the payload rather than hidden by the client, so an evaluator reading the network response
  recovers nothing. `evaluationsAdmin.createPlan`/`updatePlan` accept and persist the flag
  (stored as `true` or `undefined`, never `false`, so an old plan and a switched-off one read
  identically), and `listPlans`/`planDetail` expose it. UI: a **Blind review** switch in the
  new-plan dialog ("Evaluators won't see who submitted…"), a **Blind** badge on the plan card,
  and on `/review` a badge plus an explicit "score this on the abstract alone" line where the
  speakers row would be.

**Verification** — `scripts/verify-backend.mjs` gained a new **Submission side-effects**
section and 20 checks in total, all green: confirmation queued for the submitter with the talk
title and a rendered portal link and linked to the submission; the toggle flipped to `false`
sends *nothing* (the negative case is the one that proves the gate); the `new` and `updated`
organizer alerts are asserted through a new internal probe,
`platformEmails.recentSubmissionNotifications`, which reads `_scheduled_functions` — platform
emails bypass the `messages` table by design, so the scheduler is the only durable evidence
they were triggered, and the probe asserts kind, recipients, deep link and non-`failed` state.
Blind: an ordinary plan is `anonymized: false` with speaker names present, a blind plan strips
every speaker, `JSON.stringify(payload)` contains neither the speaker's surname nor their job
title, the evaluator can still score, and `updatePlan {blind:false}` restores the names.
Suite: **273 passed, 0 failed** (was 236 at the start of this slice; other agents landed
checks concurrently), `pnpm test` 117 passed, `tsc` clean in every file this slice touched.

Note for whoever runs the suite next: `convex run seed:setup` while a `verify-backend` run is
in flight will fail it with "Session expired — please re-enter your email" (the portal token
belongs to a purged person). Seed, then verify — never overlapping.

- mcp-ergonomics slice (from `docs/reference/mcp-live-test.md`'s ranked fix list): items 1–8
  shipped, surface **27 → 31 tools**, `convex/mcp.ts` only. **Deletion closes the one asterisk
  on "do everything via MCP"** — `delete_event` (admin/owner + `confirm: true` + `confirmName`
  matching the event's name exactly; the mismatch error deliberately does NOT quote the correct
  name back, or the second confirmation is just the first one twice), `delete_form` (admin +
  confirm; refuses any form with submissions, drafts included, and names
  `update_form_settings(status:"closed")` as the thing you probably meant), `remove_task`
  (admin; the inverse of `assign_task`, ids come from `list_speakers`). `delete_event` runs the
  web app's OWN cascade: `events.remove`'s body was extracted to an exported
  `deleteEventCascade()` in `convex/events.ts` and both callers share it, storage sweep
  included, so an MCP delete can never drift from a UI delete or leave orphaned blobs; it
  returns a receipt (submissions/forms/people/tasks/rooms) counted BEFORE the cascade ran.
  `complete_task` was deliberately not added — completing a task is the speaker's act in their
  portal, and an organizer-side "mark it done" would let a model paper over the exact
  outstanding work the dashboard exists to surface. **`list_speakers` — the one place a model
  gave a wrong number (11 rows reported as 8)** — now has `onlyWithOutstandingWork` meaning
  EXACTLY "≥1 incomplete task" with profile gaps split out into `includeProfileGaps` (alone:
  exactly the incomplete profiles; combined: either), per-row `outstandingReason`, and a
  response that states its own arithmetic (`summary` sentence + `totalSpeakers`/`returned`/
  `withOpenTasks`/`withProfileGaps`/`withOpenTasksOrProfileGaps`, all counted over the whole
  roster before filtering) so a miscount contradicts a sentence sitting next to the rows.
  **`get_event_overview` merged into `get_event_summary`** (it lost a head-to-head with
  `get_agenda` for "pull the dashboard stats"): one `eventSummaryPayload()` now carries the
  narrative AND every dashboard number (`totalSubmissions`, `outbox` by status,
  `agenda.conflictCount`, forms with ids/links), with `get_event_overview` surviving as a
  deprecated alias returning the identical payload plus a `deprecated` note — and both
  descriptions now disclaim the other tool by name. **Payload caps** (the live-fire lesson that
  anything >2KB gets compressed lossily before the user sees it): `get_form` options ≤10 +
  `optionCount`/`optionsTruncated: "…N more"`; `get_agenda` ≤40 rows each side, leading with
  counts and a per-room `byRoom` roll-up that stays true regardless of the cap; `list_templates`
  ships subject + 200-char `bodyPreview` with the new **`get_template`** tool as the named call
  for one full body (a `verbosity` arg was rejected — an LLM won't reliably ask for the cheap
  variant, so cheap has to be the default). **Loopback links** now carry a `linkWarning`
  ("…(demo URL — set SITE_URL in production)…") on every payload that returns one; the URL
  itself stays machine-clean because the copilot renders `publicUrl` as a copy button and a
  parenthetical inside the href would hand the organizer a broken link to fix the problem of a
  broken link. Field names normalized (`closeAt`, `acceptedNotScheduled` everywhere) and
  asserted by name so a reintroduction fails the build; `send_test_email.to` reworded so a model
  stops inventing recipients; `create_form`/`update_form_settings` echo `name`,
  `add_manual_session` echoes `format`/`track`. Downstream: `src/docs/generated/mcp-tools.ts`
  regenerates clean at 31 (`node scripts/generate-mcp-tools.mjs --check`), the copilot registry
  gained four real views (`EventDeletedView`/`FormDeletedView`/`TaskRemovedView` are RECEIPTS,
  never celebrations, and all three match `isDestructiveTool()` so they stop at the approval
  card; `TemplateDetailView` reuses the list's own `TemplateCard`), and `TemplatesView` now
  reads `bodyPreview ?? body`. `scripts/verify-backend.mjs` grew ~35 MCP assertions: exact
  31-tool count, deletion tools present, `list_speakers` counts self-consistent with its own
  filters, the alias returning an identical payload, `closeAt`/`acceptedNotScheduled` by name,
  every cap, the loopback warning, `delete_form` refused on the seeded `cfp` form and succeeding
  on a throwaway, `delete_event` refused three ways (no `confirmName`, no `confirm`, wrong name)
  then deleting a throwaway event it created, and `remove_task` round-tripping a real task.
  NOTE: item 9 (trim the tool count below Claude Code's deferral threshold) was deliberately
  NOT taken — the deferral tax is paid once per session in schema fetches, while "the agent
  can't delete anything" is a permanent hole; collapsing `get_public_form_link` into
  `list_forms`/`get_form` stays the one redundant tool left. Item 10 is docs-only and still open.

## 2026-08-11 — Password reset, end to end (rule 18e: no missing email surface)

The last account-lifecycle email that didn't exist. Better Auth had `emailAndPassword`
enabled but no `sendResetPassword`, so "Forgot password?" was unbuildable and a locked-out
organizer had no way back in.

- **The Convex + Better Auth email pattern.** `sendResetPassword` closes over the `ctx`
  passed to `createAuth`, which is a `GenericCtx` — it can be a query ctx, where there is no
  scheduler and no `fetch`. The component ships `requireActionCtx` (`@convex-dev/better-auth/utils`)
  for exactly this: the reset endpoint only ever runs over HTTP, i.e. inside an httpAction, so
  narrowing at call time is sound. From there the send is **scheduled**, not awaited
  (`scheduler.runAfter(0, internal.platformEmails.sendPasswordReset, …)`): Resend latency must
  not sit in the user's request, and a mail failure must never become a non-200 — the endpoint
  answers "if this email exists, check your inbox" either way, and that non-disclosure is the
  whole point. `resetPasswordTokenExpiresIn` is a named constant mirrored into the email copy,
  so "expires in 60 minutes" can't drift from the truth.
- **`sendTransactionalEmail` extracted** in `convex/platformEmails.ts` — one door to Resend for
  every platform email, with the `@example.*` preview rule (RFC 2606 addresses hard-bounce and
  burn sender reputation) applied once instead of per-email. `emailButton()` gives them one CTA
  style. The submission-notification work landing in parallel adopted both.
- **The preview log carries the link** (`previewNote`, preview branch ONLY, never on a real
  send). That single decision is what makes the flow verifiable without an inbox — and it's
  also what lets a demo account complete a reset on a deployment that can't send mail.
- **UI.** `login.tsx` gains a third mode, `forgot`, reachable from a "Forgot password?" link on
  the sign-in card AND from `/login?mode=forgot` — URL-driven so the state survives a reload
  and can be linked to. It submits to `requestPasswordReset({ email, redirectTo: "/reset-password" })`
  and turns into a receipt ("Check your email — if an account exists for …"). New
  `/reset-password` route: Better Auth's callback validates the token server-side and redirects
  here with `?token=…`, or with `?error=INVALID_TOKEN`, so **an expired link is a page, not a
  broken form** ("This link has expired" + "Email me a new link" → back to `?mode=forgot`).
- **Verified for real, not asserted.** `scripts/verify-password-reset.mjs` (14/14, stable over
  3 runs) walks the whole thing against the live deployment: sign up a throwaway `@example.com`
  organizer → request → **read the preview log for the link Better Auth actually built** →
  follow it → 302 to `/reset-password?token=…` → set a new password → new password signs in →
  **old one 401s** → **the token can't be replayed (400)** → an address with no account gets a
  byte-identical 200 (no enumeration). It tails `convex logs` live rather than reading history,
  because the deployment's history is only seconds deep while other agents are working.
  `tests/e2e/flows/password-reset.spec.ts` covers the browser half (4/4): identical receipt for
  a real vs. non-existent account, expired-link page, forged token refused in plain English,
  local password-mismatch catch — clean console throughout, with one deliberate `watcher.reset()`
  after the intended 400.
- **A real Resend delivery was proven** (`sent: true` to marko@kortix.ai). ⚠️ **Deployment
  finding, affects EVERY email, not just this one:** the Resend account is still in test mode —
  `EMAIL_FROM` is `onboarding@resend.dev` and Resend 403s any recipient other than
  marko@kortix.ai ("verify a domain at resend.com/domains"). So `organizer@demo.sessionboard.dev`
  and every seeded speaker currently fail at the provider (logged as `[email:failed]`, never
  surfaced to the user). Verifying a domain + changing `EMAIL_FROM` is a one-time config step
  and is the only thing between this and real delivery.

## 2026-08-11 · Session: production deployment + CI/CD + the Trackstage rename

**Trackstage is live at https://trackstage.app.** What that took, and what was learned.

**Prod Convex is a separate deployment, not a promoted dev.** `convex deploy -y`
provisioned `keen-eagle-41` (dashboard: `.../sessionboard/keen-eagle-41`) alongside dev
`neat-sparrow-926`. First push failed typecheck on an in-flight `convex/apiV1.ts` that
used `internal.webhooks.deliver` without importing `internal` — a one-line fix, but the
useful part is the shape of the failure: **`convex deploy` typechecks the whole `convex/`
tree, so any agent's half-written file blocks everyone's deploy.** Env set on prod: a
NEW `BETTER_AUTH_SECRET` (never dev's — a shared signing secret means a dev session is a
prod session), `RESEND_API_KEY` (copied), `EMAIL_FROM`, `OPENROUTER_API_KEY`,
a freshly generated `PUBLIC_API_TOKEN`, `SITE_URL`. Then `seed:setup --prod` — 18
submissions, 14 people, 18 tasks, 2 events.

**The copilot key is a WORKER secret, not a Convex one.** `src/routes/api/chat.ts` runs
in the Cloudflare Worker, so `OPENROUTER_API_KEY` had to go in via `wrangler secret put`;
setting it only on Convex would have produced a copilot that 500s in production and works
locally (`.dev.vars`, which the vite plugin generates from `.env.local`, is dev-only and
is never uploaded by `wrangler deploy`).

**Domain landed mid-session.** Marko registered trackstage.app while this was running, so
step 5 (domain-ready) became step-now: `routes: [{pattern, custom_domain: true}]` in
`wrangler.jsonc` → Cloudflare provisioned record + cert. Two gotchas worth remembering:
(1) **declaring `routes` disables workers.dev** unless you also set `"workers_dev": true`
— the deploy output warns, quietly; (2) the local macOS resolver cached the pre-registration
NXDOMAIN for the whole session — 1.1.1.1 answered correctly and `curl --resolve
trackstage.app:443:104.21.72.202` returned a valid-cert 200, which is how the domain was
verified. **A negative DNS cache on one machine is not a broken deploy.**

Origin rebind, in the order that keeps the app working: custom domain serves → Convex
`SITE_URL=https://trackstage.app` → rebuild (`.env.production` `VITE_SITE_URL`) → redeploy.
`convex/auth.ts` gained explicit `trustedOrigins` because Better Auth's `baseURL` trusts
exactly one origin, and moving it would otherwise have broken the workers.dev fallback and
localhost. Resend reported trackstage.app **verified** (DKIM + SPF), so prod `EMAIL_FROM`
is now `Trackstage <hello@trackstage.app>` — **the "Resend is in test mode" blocker that
has been in TODO.md all week is closed for production.**

**CI/CD.** `ci.yml` (typecheck · lint · unit, on push/PR to master) gates `deploy.yml`
via `workflow_run` on the exact validated SHA. Backend + e2e stay out of CI on purpose:
both mutate a live deployment's seeded data. Deploy runs convex → build → wrangler →
`scripts/smoke-production.mjs`, a new 9-check live crawl (5 SSR routes asserted on
*content* not just status, `/v1`, `/mcp` initialize, both OAuth discovery documents).
Cloudflare access is a **scoped** token minted through `POST /user/tokens` — the global
key never leaves the machine.

**Verified live before claiming done:** 6 routes 200 with real SSR HTML on trackstage.app
(`/`, `/login`, `/docs`, `/design-system`, `/submit/ai-summit-2026`, `/e/ai-summit-2026`);
sign-in 200 with the demo organizer through both the Convex site and the app's own
`/api/auth` proxy; `/v1/event/ai-summit-2026/sessions` 200 with the real bearer token;
`/mcp` returning the 401 + `resource_metadata` challenge that IS the OAuth contract; both
discovery documents advertising `issuer: https://trackstage.app`.

**One-command domain path for next time:** `scripts/attach-domain.mjs` (attach → wait for
200 → move `SITE_URL` → move `EMAIL_FROM` once Resend verifies), idempotent, paired with
the existing `scripts/configure-domain.mjs`. Documented in README → Deploy.

## 2026-08-11 — learn.sessionboard.com fully ingested (rule 29)

Crawled **177 in-scope help-centre pages** (226-URL sitemap, minus `/apps` `/marketing`
`/sponsors-exhibitors` `/speaker-crm` `/awards`), resolved all **26 Guidde walkthrough videos** to
direct MP4s via headless-Chromium network capture and ran each through `google/gemini-3.6-flash`
into `docs/video/learn/` (+ a README index), and did a **frame-by-frame visual pass** (768 frames
at 1/6 fps, tiled into contact sheets, key screens read with vision). Synthesised into
**`docs/reference/sessionboard-product-map.md`** — organizer journey end-to-end, participant
journey, ~94 findings labelled NEW/CONFIRMS, and a severity-ranked DELTA section verified against
our actual routes/schema. 23 new deltas appended to TODO.md under "Learn-site deltas"; the
top five are custom session statuses, Portal Username ≠ Email, an audit log (closes sbek CNT-11),
per-participant `is_public`, and agenda settings (interval + per-format default duration). Three
videos are YouTube/Loom embeds with no transcript and were covered from prose instead. Also
recorded five places we are already **ahead** of the real product — live conflict recomputation,
decisions that actually send their emails, the brief's Track view, one-click auto-place, and an
embeddable form + public API.

## 2026-08-11 — Landing trim pass: less yap, same page (rule 25 TRIM)

Marko on the Trackstage landing: *"remove all the slop, also from the navigation bar… a lot
of yap yap yap… should be a little less yappy"* — but also *"it also is pretty good, it
already looks quite nice, so it's not bad."* So this was a **copy trim, not a rebuild**:
structure, Attio language, real screenshots and the agenda GIF all stayed exactly where
they were; only words came out.

**Nav** is now Logo · Docs · GitHub · Log in (ghost) · Get started (primary). The five
anchor links (Product / Live demo / Developers / Open source / Pricing) are gone — the page
scrolls, and a nav full of jump links is slop. The mobile sheet mirrors it exactly (Docs,
Log in, Get started, GitHub); `SECTION_IDS` still exist for the footer's "On this page"
column and for `scroll-mt` anchoring.

**Per section:** hero lost its three-item proof row (the chip and the pricing band already
said it) and its sub-line is one shorter sentence · demo cards cut to one clause each,
the "nothing you can break" line halved, "Curious what attendees see?" → "Attendee view:" ·
proof strip lost the apologetic no-customer-logos paragraph (one line + the marquee now) ·
feature rows are one line of body each, showcase pillars ≤8 words · **the platform section
is one tight row** — the copilot prompt-chip panel and the `Keys, not scraping` cell went,
MCP became the third cell (`POST /mcp`, tool count, "anything destructive asks first") and
"Read the docs" now points at our own `/docs` instead of the README · foundations are
title + ≤6 words · pricing summaries halved and bullets 4 → 3 per card (the $10k joke and
its footnote stay) · story band down to two sentences · closing CTA lost the redundant
"Or sign in" line · footer keeps every link, lost its descriptive paragraph and half its
legal line.

**Whitespace** was rebalanced rather than left as holes: platform endpoints align on
`mt-auto`, the pricing and stats grids drop to the standard `mt-12`, and the closing band
went asymmetric (`pt-20 pb-16 sm:pt-24 sm:pb-20`) so the gap above the footer rule reads
deliberate.

**Measured:** 1447 → 816 words at 1440px (**−44%**), page height 9800 → 8762px. Zero
console errors and no horizontal overflow at 1440 and 360; all six product shots + the GIF
load; typecheck and lint clean on the marketing files. Verification ran against a dedicated
`vite dev --port 3100` — the long-running shared dev server was throwing SSR
"invalid hook call" errors on untouched routes (LoginPage, OrganizerLayout) from stale
dep-optimization, and a clean server has none.

## Session — API parity with Sessionboard's public API (rule 28)

Crawled their whole reference (`apidocs.sessionboard.com/api-reference/openapi.yaml`, 131
paths / 177 operations) and mapped it endpoint-by-endpoint against ours. 61 of their 177
are program-side; the rest is CRM, sponsors, exhibitors, Insights/SbQL, dashboards and
GDPR, all explicitly struck. Full matrix with verdicts:
[`docs/reference/api-parity.md`](../reference/api-parity.md).

**We went from 4 read-only endpoints to 80.** New modules: `convex/apiRoutes.ts` (the
route manifest — pure data, the single source of truth), `convex/apiHttp.ts` (routing,
auth, scopes, rate limiting, serialization), `convex/apiV1.ts` (the data layer),
`convex/webhooks.ts` (outbound deliveries), `convex/lib/apiIcs.ts` (the calendar writer,
lifted verbatim out of `http.ts` so the feed stayed byte-identical). `http.ts` is now just
a route table.

**Nothing was degraded.** The four pre-parity endpoints keep their auth, their envelope
keys and their field names; every parity field is additive, so a session now carries both
`starts_at` (ISO) and `startTime` (epoch ms), both `track{}` and `trackColor`. Paginated
responses carry `data` AND `results` — the same array under both names — and every
pagination key in camelCase and snake_case, so a client written against either of
Sessionboard's two conventions works without checking which endpoint it is on. Error
bodies carry `error` (the message, where ours has always put it), `code` (the name, where
theirs puts it) and `message`, so neither contract breaks.

**Custom fields are real, not a shim.** A custom field IS a CFP form question:
`forms.questions[]` are the definitions, `submissions.answers{}` are the values.
`GET /fields` assembles definitions from every form (type, options, required, `contains_pii`,
`scope: session|contact`); sessions carry `custom_fields[]` labelled and keyed by
`internal_name` **plus `value_raw`**, the untouched JSON, so a multi-select is never lossily
stringified; `POST /fields/create` appends a question — so a field created over the API
appears in the form builder and on the public submission form, which their API cannot do.
The same trick makes tags/formats/levels/languages writable: they have no table, they are
the options on a form question, so metadata writes edit that question.

**Webhooks are ours-better.** Sessionboard has webhooks but only manages them from the
dashboard — there is no endpoint for them in their public API. Ours are fully API-managed
(CRUD + test + secret rotation + delivery log) and every delivery is **HMAC-SHA256 signed**
(`Trackstage-Signature: t=…,v1=…` over `"{t}.{body}"`), where theirs offers only a static
shared header that cannot detect tampering or replay. Five retries with exponential
backoff. Emission is a one-line `emitWebhook(ctx, eventId, type, payload)` hooked
surgically into the existing mutation points (submit, status changes, queue commit, manual
add, detail edit, schedule/unschedule, publish, speaker writes) — fire-and-forget, so a
customer's unreachable endpoint can never slow or fail an organizer's action.

**Auth**: both `x-access-token` and `Authorization: Bearer` accepted, interchangeably. A
key resolves to a user and every request re-runs the same workspace-membership check the
app uses, so a leaked key is bounded by a real permission model rather than an org
boundary. Scopes were added as a *narrowing* only — an unscoped key keeps its owner's full
permissions, which is what every existing key and the MCP server rely on. Rate limiting
matches theirs exactly: 100 / 15 min per credential per category, `RateLimit-*` headers,
429 + `Retry-After`.

**Deliberate non-mirrors, with reasons in the doc:** agenda drafts / scheduling rules /
personas (22 ops — a scenario-planning subsystem that exists because their board is slow;
ours is live and instantly reversible, which is the differentiator), custom session
statuses (our pipeline is the judged domain language), media upload + transcriptions +
recordings (22 ops of media processing), subsessions/composition, translated fields.

### OpenAPI: generated, not hand-written

`public/docs/api/openapi.json` documented 4 endpoints against an API that now serves 80.
Fixed properly rather than by hand: `scripts/generate-openapi.mjs` **generates** the spec
from `convex/apiRoutes.ts`, so the published reference cannot drift from the manifest.
Three checks, each catching a different failure:

- `--check` — every served route is documented and no documented route is orphaned
  (proven by deliberately corrupting the file: it reports MISSING/ORPHANED and exits 1).
- source scan — every manifest route's literals must still appear in the dispatcher, so
  deleting a route without deleting its docs fails.
- `--check --live` — sends a real request per route against the deployment and fails on
  any that answers "unknown endpoint" or 405. **All 80 verified.**

Examples are captured from live seeded data (15 of them), depth-capped so the reference
stays readable, and cached in `x-captured-examples` so a regeneration without a deployment
does not strip it bare. Shared error responses and rate-limit headers live in
`components.responses`/`headers` rather than being inlined 80 × 5 times.

Scripts: `pnpm openapi:regen`, `pnpm openapi:check`, `pnpm openapi:verify`.
**CI step to add to `.github/workflows/ci.yml`** (the deploy agent owns that file), after
"Lint": `- name: OpenAPI spec up to date` / `run: pnpm openapi:check`.

### Verification

`scripts/verify-backend.mjs` gained an **API parity** section: **83 live assertions, 83
passing** —
both auth headers, demo-token read-only, scoped-key narrowing, error envelope, pagination
in both spellings, filters/sort, create → read → update → 409 → soft-delete → 404 →
restore, custom-field definitions + values + lossless `value_raw`, metadata and value-list
writes, speakers, both file-upload paths, bulk with mixed success/failure, agenda, and a
real signed webhook delivery verified end to end (the echo sink answers 200 only when the
HMAC verifies; a forged signature is rejected).

One operational note for whoever runs the suite next: the full run kept being truncated
mid-flight by *other agents reseeding the shared dev deployment* — `seed:setup` purges and
rebuilds the demo events, so any section that captured ids at startup then throws
"Event not found". It landed on a different section each time (evaluation, dashboard) and
never on a `✗`. The parity section is immune by construction because it addresses
everything by slug, and it was verified standalone at 83/83 by slicing the section out of
the suite and running it against the live deployment. If the full suite needs to be green
in one pass, run it when no other agent is reseeding.

### Feature census → UI work order

Rule 28's extension: their API is also a list of product surfaces. `api-parity.md` ends
with a census of all 26 capabilities against our actual routes/components. Four **P0**
gaps, all with working backends already — **UI-only builds**: session delete + restore
(no delete exists in the product at all), editable custom-field answers (organizers can
see form answers but not fix a typo), value-list management (formats/levels/languages are
hardcoded constants — an organizer cannot add a session format), and a webhooks settings
card (full backend, zero UI). Then P1: scheduling fields in the submission drawer, bulk
edit beyond status, file rename/re-assign, organizer-side headshot upload, key scopes in
the new-key dialog.

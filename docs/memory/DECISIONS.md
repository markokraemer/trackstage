# Decision log (semantic memory)

Format: date · decision · why · status.

- **2026-08-11 · TanStack Start over Next.js** — 100× faster builds (~400ms vs ~60s),
  native Cloudflare Workers via `@cloudflare/vite-plugin` (no OpenNext adapter risk).
  Evaluated in depth; Next 16.2.0 had a Workers crash history. ✅
- **2026-08-11 · Convex over InstantDB/Supabase** — scheduled functions (reminders),
  reactive queries (live dashboard), file storage, HTTP actions (API). ✅
- **2026-08-11 · Base UI preset `b7BYM32MS` (base-vega, remixicon)** — Marko's preset;
  Base UI is the new shadcn standard. No react-hook-form `form`; use `field.tsx`. ✅
- **2026-08-11 · Single app, no monorepo** — Marko's call after trying a workspace. ✅
- **2026-08-11 · Flattened organizer sidebar** (7 items vs Sessionboard's nesting) —
  video shows swyx getting lost in `Collect & Review`; master-pass guidance says flatten. ✅
- **2026-08-11 · No passwords in public flow; magic links everywhere** — swyx explicitly
  disliked the password wall; demo mode shows links inline so sbek's browser agent and
  judges never need an inbox. Organizer keeps seeded email+password (sbek config format). ✅
- **2026-08-11 · Accepted submissions ARE agenda sessions** — one `submissions` table
  with schedule fields; matches "abstracts become sessions"; makes the accepted→agenda→
  public handoff (a judged rubric type) trivial. ✅
- **2026-08-11 · sbek rubric amends the brief** — Public Widgets are a REQUIRED area
  (20%), Content Management (file versions + approvals) 15%, multi-event scoping judged
  (11%), AI agenda 10%. Build them despite the brief striking embeds. ✅
- **2026-08-11 · Private repo until submission** — competitor research stays private;
  flip public at submission time (rules require open source). ⏳ flip pending
- **2026-08-11 · Agenda views: List/Day/Rooms/Conflicts** (Week/Month cut) — Day+Rooms
  cover the job-to-be-done; conflicts get a dedicated view. ✅
- **2026-08-11 · Email via Resend if key present, else preview-in-outbox** — demo-safe,
  judges can verify content without delivery; .ics always downloadable. ✅
- **2026-08-11 · Design language E "De-blued" SHIPPED; Petrol/teal accent REJECTED** —
  the revamp landed the Attio-derived NEUTRAL system (chrome chroma ≤ 2, near-white
  #FAFAFA sidebar, hairline borders, no tinted banners, status as dot + label, 40px
  controls / 44px rows) but kept `--primary: #2F5CE0`. Marko reviewed Petrol `#0F6E70`
  — which won every measured axis in design-references.md §10 — and preferred the
  original blue: "i don't like the teal color or the turquoise… i even preferred the
  blue that we had before." The complaint was never the hue, it was how much chrome
  was wearing it. Colour policy (Stripe's, verbatim in /design-system): the accent is
  permitted in FIVE places — primary button, links, focus ring, active nav item,
  `--chart-1`. Consequences: the emerald→true-green status nudge is NOT needed (it was
  a petrol-adjacency fix) and is reverted; brand assets stay blue. ✅
- **2026-08-11 · /design-system Explorations is a record, not a chooser** — the six
  candidate palettes, four type pairings and their six variable webfonts were deleted
  from the page. Six fonts loading behind the app's longest page, plus ~45 self-driving
  interaction demos running `setInterval`/rAF forever off-screen, is what Marko saw as
  "flickering". Demos now mount only within 600px of the viewport. ✅
- **2026-08-11 · Toasts are pinned to `theme="light"`** — Sonner was following the OS
  theme on a light-mode-only app, so its dark rule painted the description line
  `hsl(0 0% 91%)` — near-white on white. Every toast colour now comes from a token. ✅
- **2026-08-11 · Right-click the logo opens a MENU, never a redirect** — RULES #20d's
  "right-click → /design-system" shipped as an auto-navigate and felt like a hijack.
  The affordance is a context menu that *offers* the design system alongside SVG/PNG
  download and copy-as-SVG (Vercel/Linear). New `ui/context-menu.tsx` on Base UI. ✅

- **2026-08-11 · Docs built natively in Fumadocs' style, not on Fumadocs itself** —
  rule 27 named Fumadocs; the docs agent verified TanStack Start support exists but
  requires 4 new deps + RootProvider/global-CSS changes it was barred from making
  mid-flight. Shipped: native /docs (14 routes) matching Fumadocs' look on our tokens,
  Scalar embedded, MCP tool table generated from convex/mcp.ts (drift-proof, --check
  in place). Converting to real Fumadocs remains possible post-deadline (NEEDS-DEPS
  in BUILD-LOG); the user-visible outcome — simple docs w/ screenshots + accurate
  API/MCP references — is delivered. ⏳ optional swap

- **2026-08-11 · Production topology: Convex `keen-eagle-41` + Cloudflare Worker
  `trackstage` on trackstage.app** — the app and the backend deploy as two artifacts in
  a fixed order (Convex first, Worker second) because the Worker bundle assumes the
  functions and schema it calls already exist. The Worker keeps its workers.dev URL
  alive alongside the custom domain (`workers_dev: true` — declaring `routes` silently
  turns it off), so there is always a second working origin when DNS or a cert is
  mid-change. ✅
- **2026-08-11 · `.env.production` is COMMITTED (public values only)** — `VITE_*` config
  is compiled into the client bundle, so it is public by construction; the only question
  is whether a production build reliably picks the production values up. Vite loads
  `.env.production` after `.env.local`, so committing it makes "build → deploy" correct
  by default instead of correct-if-you-remember-the-env-prefix, and CI needs no secrets
  to produce a correct bundle. Trade-off accepted: `pnpm preview` (vite build + wrangler
  dev) now talks to PROD Convex — `pnpm dev` is the dev-deployment path. Every real
  secret stays in `convex env … --prod` or `wrangler secret put`. ✅
- **2026-08-11 · CI gates deploy via `workflow_run`, not a single workflow** — CI
  (typecheck · lint · unit) and Deploy are separate files so a PR runs the gate without
  ever touching the deploy path; Deploy checks out `workflow_run.head_sha`, i.e. the
  exact commit CI validated, never "whatever master is now". Backend/e2e suites are
  deliberately NOT in CI: both drive a live deployment and mutate seeded data, so
  concurrent runs would fight over the same rows. ✅
- **2026-08-11 · CI uses a SCOPED Cloudflare token, never the global key** — minted via
  `POST /user/tokens` with the global key: Workers Scripts R/W, Workers KV R/W, Workers
  Observability Write, Account Settings Read (account-scoped) + Workers Routes Write and
  DNS Write (all zones, for custom-domain attach). A leaked global key owns every zone
  and every product on the account; this one can only redeploy a Worker. ✅
- **2026-08-11 · A deploy is not green until the live origin renders** — `wrangler
  deploy` only proves an upload, and an SSR crash still returns a 200 shell. The deploy
  job ends in `scripts/smoke-production.mjs`, which asserts 200 **plus expected content**
  on five routes, plus `/v1`, plus the `/mcp` 401+`resource_metadata` challenge, plus
  both OAuth discovery documents. It fails the job on the first miss. ✅
- **2026-08-11 · Better Auth gains explicit `trustedOrigins`** — `baseURL` alone trusts a
  single origin, so moving `SITE_URL` to the custom domain would have broken sign-in on
  the workers.dev fallback and on localhost. `trustedOrigins` now lists SITE_URL +
  trackstage.app + the workers.dev URL + localhost, with `EXTRA_TRUSTED_ORIGINS`
  (comma-separated deployment env var) for preview origins — no code change to add one. ✅
- **2026-08-11 · Staged queues are the ONE status the speaker portal does not mirror** —
  AGENTS.md says statuses use identical wording in both UIs, and that rule stands for
  every committed status. But `accept_queue`/`decline_queue` exist precisely so the
  organizer can stage a decision that has not been announced; showing "Decline Queue" to
  the speaker before the commit email destroys the feature. `convex/portal.ts` maps both
  to `pending` in ONE place (`submissionSummary`), so the portal card, the drawer pill and
  every future speaker surface agree, and no organizer surface changes. ✅
- **2026-08-11 · One server-side verdict decides whether a speaker may edit** — the portal
  used to re-derive "can I edit?" in three places (`portal-utils.canEdit` on status, the
  drawer on the event switch, the mutation on both) and knew nothing about the CFP's close
  date. `portal.ts::editLockFor` now returns `{code, title, message} | null`; the mutation
  throws `message`, the payload ships the object, the UI only picks an icon and a tone. A
  save can no longer fail with a rule the screen never showed. Accepted talks are exempt
  from the close date — swyx's clarification was about acceptance-locking, not deadlines. ✅
- **2026-08-11 · Public-semantics API endpoints filter; organizer endpoints flag** — a
  hidden session must vanish from the published-programme reads (`GET /sessions` with no
  filter, `schedule.ics`) exactly as it does from `/e/{slug}`, but must stay VISIBLE and
  honestly labelled `is_public: false` on the organizer's own reads. Hardcoding
  `is_public: status === "accepted"` broke both halves at once. The same rule applies per
  speaker via their eye toggle, and `?public=true|false` makes either view explicit. ✅

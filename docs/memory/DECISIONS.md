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
- **2026-08-11 · Public URL scheme is hierarchical: form slugs are unique PER EVENT** —
  Marko created a form called "Call for Speakers" and got `/submit/call-for-speakers`;
  the next organizer to want that obvious name would have been silently pushed to `-2`,
  because form slugs lived in ONE GLOBAL namespace across every workspace. The dev
  database had already grown five `devcon-berlin-call-for-speakers`, `-2`, `-3`, `-4`,
  `-5` rows in five different events — cross-tenant blocking, exactly what a multi-tenant
  product must never do. The scheme is now:
  `/e/:eventSlug` (event, globally unique — one segment) ·
  `/submit/:eventSlug/:formSlug` (CANONICAL public CFP) ·
  `/portal/t/:token` (already unique by construction, unchanged).
  Uniqueness moved to the `forms.by_eventId_slug` index; `by_slug` survives only to
  resolve legacy links, so nothing that reads it may use `.unique()` any more. Every link
  producer (form builder, forms list, dashboard, comms `{{formLink}}`, MCP `publicUrl`,
  seed output, README, docs, e2e) emits the two-segment address, all of them through the
  single scheme module — `src/lib/public-links.ts` on the client,
  `convex/lib/publicLinks.ts` on the server. ✅
- **2026-08-11 · Legacy `/submit/:slug` resolves to the OLDEST claimant, not an
  "ambiguous link" page** — every one-segment link an organizer ever printed still
  works: the route resolves the slug across all events and 307s to the canonical
  address. Several forms may now legitimately share a slug, and the obvious tie-break —
  refuse to guess, show a "this link is ambiguous" page — was rejected: it would hand
  every organizer a way to KILL someone else's printed link merely by naming a form the
  same thing, re-creating the cross-tenant blocking this change exists to remove.
  Creation-ordered resolution is deterministic and monotonic: the form that held the
  address when the link was printed keeps it forever, and a newcomer can never take an
  address it never had — it just uses its own canonical link, which is what every
  surface in the product now hands it. ✅
- **2026-08-11 · Event slugs never block; form slugs refuse with a suggestion** — the two
  levels get deliberately different failure modes. An EVENT slug clash used to throw
  `An event with the slug "x" already exists.` and stop event creation dead; it now
  auto-suffixes with a short readable id (`kortix-con` → `kortix-con-x3f2`) and the UI
  says "that web address was taken — yours is …", because nothing may stand between an
  organizer and their first event. A FORM slug clash inside one event is refused with
  `That address is already taken for this event. Try "ds-cfp-2" instead.` — the organizer
  is looking straight at the link they may already have printed, so silently moving it
  would be worse than one inline sentence. `events.create`/`events.update` and
  `forms.update` all return the slug that is actually live so the UI never guesses. ✅
- **2026-08-11 · Slug inputs tidy on submit, not on every keystroke** — the settings slug
  field re-slugified on each `onChange`, and `slugify` strips trailing dashes, so typing
  "ai-summit-2026" produced "aisummit2026", one swallowed dash at a time. `slugifyInput`
  keeps the dash the user just typed (strips only leading dashes and invalid characters);
  `slugify` runs on submit, and the server normalises whatever arrives. ✅
- **2026-08-11 · Typing an email is not proof of owning it — a known address gets a
  MAILED sign-in link, never a token** (Marko spotted the flaw). `submit.identify`
  returned the person's `portalToken` for ANY typed address, so entering a real
  speaker's email opened their portal: submissions, drafts, tasks, files, profile. The
  fix keeps the no-password UX exactly where it is free of risk and pays for it only
  where something is at stake. A **new** address (never seen for this event) still gets
  a token instantly — the account it opens is empty, there is nothing to steal, and the
  wizard needs the credential to save drafts, so the common path and every fresh-email
  eval run are unchanged. An address with **any history** — a submission (drafts
  included), a co-speaker credit, a task, an upload, or a filled-in profile — gets an
  outbox email ("Continue as {email} on {event}", ≤3/hour) carrying
  `/submit/{event}/{form}?t={portalToken}`, and the mutation answers with the same
  payload no matter what is behind the address: no token, no name, no draft list, no
  submission counts, no cap errors. The page says only "we've sent a secure link to
  {email}", which is the standard, acceptable disclosure. Three deliberate carve-outs:
  a caller that PRESENTS the matching token continues straight through (same-browser
  sessionStorage resume, and the emailed link itself); a bare person row younger than 30
  minutes with nothing attached counts as new, so re-entering an address mid-wizard is
  not punished; and `submit.submit` no longer echoes the token back, since the caller
  had to present it to get there. `submit.resume` (token-authenticated) is what the
  `?t=` landing reads — the token is consumed into sessionStorage and stripped from the
  URL immediately, so the credential never lives in an address bar. Rejected: hashing
  emails, silent "we found nothing" responses (they leak by timing and break resume),
  and a password wall (the one thing swyx's video was angriest about). ✅
- **2026-08-11 · URL architecture is fully hierarchical: workspace → event → form —
  everywhere, including the organizer app** (Marko, second insistence: "all the
  URLs/links are not unique enough — ONE HARD PASS"). SUPERSEDES today's "Public URL
  scheme is hierarchical" pass, which only namespaced form slugs under events and left
  event slugs global and the organizer app context-implicit. The final scheme:
  `/e/:workspaceSlug/:eventSlug` (public program) ·
  `/submit/:workspaceSlug/:eventSlug/:formSlug` (CFP) ·
  `/app/:workspaceSlug/:eventSlug/{dashboard|submissions|forms|evaluation|agenda|
  speakers|files|communications|embeds|settings/*}` (organizer app) ·
  `/app/:workspaceSlug/workspace` (workspace hub) · `/app/account`, `/app/copilot`,
  `/app/events` (personal/global) · `/portal/t/:token`, `/review/:token` (unchanged —
  already globally unique by construction). Slug namespaces nest the same way:
  WORKSPACE slugs are globally unique (they were already on `organizations`, so no
  backfill was needed — every row has one); EVENT slugs became unique PER WORKSPACE
  (`events.by_organizationId_slug` is the new uniqueness index; `by_slug` survives for
  legacy resolution and may never be read with `.unique()` again); FORM slugs stay
  unique per event. Reserved-word lists keep a workspace from slugging itself
  "submissions" (which the static legacy route would shadow) and an event from
  slugging itself "workspace" (the hub's static segment) —
  `RESERVED_WORKSPACE_SLUGS` / `RESERVED_EVENT_SLUGS` in `convex/lib/publicLinks.ts`.
  Workspace slugs get the exact collision UX event slugs got: auto-suffix
  (`kortix-con-x3f2` style), never refuse, report what was claimed; editable in
  Workspace settings with `slugifyInput` while typing. ✅
- **2026-08-11 · The URL is the source of truth for organizer context; localStorage is
  only the legacy-path fallback** — the old model kept "which event am I on?" in a
  shared localStorage pointer, so two tabs on two events silently fought over one
  pointer (the exact conflict Marko wanted dead). Now `useCurrentEvent` resolves the
  `$workspaceSlug/$eventSlug` params against the access-filtered `events.list` and the
  URL OUTRANKS both stored pointers; when the URL names an event that doesn't resolve
  there is NO fallback — the layout renders "Event not found.", which by construction
  is identical for a nonexistent event and one the member is scoped out of (rule 23).
  The event switcher and workspace switcher now NAVIGATE (same section under the new
  event via `eventScopedPath`; detail pages fall back to their section index because a
  formId belongs to the event it was opened on; switching from a global page like
  /app/account only moves the pointer). The stored pointer survives for exactly two
  jobs: resolving BARE legacy paths (`/app/submissions` → the event you last touched,
  via `LegacyAppRedirect`) and giving global pages a context. Visiting a canonical
  address is what now writes the pointer (the event layout syncs it). ✅
- **2026-08-11 · Legacy compatibility is sacred: every previously-valid shape resolves
  and 307s to canonical, oldest claimant first** — `/e/:eventSlug` (+ any subpage
  depth, via a splat under the canonical tree), `/submit/:eventSlug/:formSlug`,
  `/submit/:formSlug`, and every bare `/app/*` path all keep working: seeded demo
  printouts, sbek's stored notes, every email ever sent, every bookmark. Resolution is
  canonical-first (workspace lookup wins), then the first segment is re-read as a
  legacy event slug; ambiguity is settled creation-ordered (the row that held the
  address when the link was printed keeps it forever — same reasoning as the form-slug
  pass: an "ambiguous link" page would let a newcomer kill someone else's printed
  link). Same rule serves API/MCP refs by bare slug (`oldestEventBySlug`); ids remain
  the unambiguous handle. One accepted trade-off: renaming a workspace slug moves that
  workspace's canonical URLs with no redirect from the old workspace slug (only
  event/form-level legacy shapes are guaranteed) — the settings card says so before
  you do it. Every link producer flows through the extended single modules:
  `convex/lib/publicLinks.ts` (server: emails' {{formLink}}, MCP publicUrl, REST
  public_url, seed output) and `src/lib/public-links.ts` + `src/lib/app-links.ts`
  (client: nav, switchers, drawers, copy buttons). Nothing may hand-build `/app/`,
  `/e/` or `/submit/` strings. Prod rollout: `convex deploy` adds the index; no data
  backfill exists because organization slugs already existed on every row. ✅

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

## CFP-16 reversal: the close date locks editing for EVERYONE (2026-08-11)
The earlier decision exempted accepted talks from the CFP-close edit lock,
reading swyx's "accepted speakers can still edit" clarification as
deadline-related. The official eval kit hard-fails that reading (CFP-16, w2:
editing locks when the CFP closes — no exemption). The kit is the judge:
exemption removed. Swyx's clarification still holds where it was actually
aimed — ACCEPTANCE itself never locks editing while the CFP is open.
Organizers can still reopen editing anytime via portalSettings
(allowSubmissionEdits) — that's the escape hatch for post-deadline fixes.

## Prod region: already US East — migration verified as a no-op (2026-08-12)
Directive: migrate prod (`keen-eagle-41`) from eu-west-1 to US East before judging.
Investigation found the premise stale: the platform API reports `keen-eagle-41` as
`aws-us-east-1` (it was provisioned 2026-08-11 02:53 UTC, AFTER Marko flipped the
team default region to US East), confirmed by a control test (dev
`neat-sparrow-926` correctly reports `aws-eu-west-1`) and by latency signature
(min TTFB from EU: prod ~181ms vs EU dev ~113ms — a transatlantic gap). A full
rehearsal migration WAS performed to be sure the path works (new us-east prod
`colorful-oriole-432`: snapshot import incl. file storage + betterAuth component
tables (jwks/sessions), env vars, functions, seed:setup — full parity verified),
then deleted as redundant; cutting over would only have invalidated post-export
writes for zero region gain. `keen-eagle-41` stays canonical prod. Speed action
taken instead: Cloudflare Smart Placement on the prod Worker (wrangler.jsonc) so
SSR runs near the us-east backend. Only the DEV deployment remains in eu-west-1
(later phase).

## Settings IA: account + workspace are MODALS, event stays the only settings PAGE (2026-08-12)
Marko hated `/app/:ws/workspace` ("it just redirects you to the workspace
settings page and you have no fucking idea what to do there") and the
Account | Workspace | Event sibling-tab row on settings pages. New IA:
- ONE settings page — the event's (sidebar → Settings). Account and workspace
  settings open as wide modals over whatever page you're on, Linear-style,
  driven by shell-level search params validated on the `/app` route:
  `?settings=account|workspace`, `settingsTab`, `invite`, `inviteEvent`
  (namespaced — several pages already own `tab`). Host:
  `src/components/shell/settings-dialogs.tsx`; entries: avatar menu (both).
- Every legacy address resolves into the modals, no dead links: `/app/account`
  (+`?tab=`) and `/app/:ws/workspace` (+`?invite=1&event=`) redirect to the best
  real page (event dashboard, else the no-events screen in place) with the right
  modal open; `settings/api-mcp` lands on event settings + account modal.
- Team is a FIRST-CLASS TAB, never a scroll-to card (Marko: "just have a Team
  tab instead … such an important screen"): workspace modal = General / Team /
  Events; event settings gets the same Team tab (`settings/team` route) —
  ONE component (`MembersCard`, optional `scopeEvent`) in both hosts, same
  mutations, invite CTA pre-scoping the event. `EventTeamCard` and the
  redirect-y "teammates live in Workspace settings" copy are gone.
- Member rows show email verification as a quiet tooltip dot, consumed
  optionally from `workspaces.members.emailVerified` (auth work, separate).
- Switching workspace INSIDE the modal keeps the modal open on the new
  workspace; the sidebar/avatar switchers still navigate plainly.

## REVERSAL — settings modals flipped back to standalone pages (2026-08-12)
The settings-modal IA above lasted hours: Marko hit dialog-over-dialog twice
(invite over the workspace modal, Connect-a-client over the account modal) and
called it — "instead of being a modal just make it a standalone page again."
Everything the modal era built carries over 1:1 into page shells:
`/app/account` (Profile / Security / API & MCP, `?tab=`) and
`/app/:ws/workspace` (General / Team / Events, `?tab=`, `?invite=1&event=`
deep link) are full pages again; Team stays first-class in both hosts;
verified dots, per-event access editing and invite pre-scoping unchanged; the
member table's invite + access editors became IN-PLACE card panels (back
arrow), so nothing ever stacks — rule recorded in DESIGN-REVAMP.md. Legacy
`?settings=…` URLs from the modal window rewrite to the pages via the shell
host (`settings-dialogs.tsx`, now just an interpreter). Also: Branding lifted
beside Event details (identity block above the fold) on event settings.

## Sidebar IA re-derived from first principles (2026-08-12)
Marko: "evaluate from first principles the structure of the left sidebar
including this program's topic header." Problems with the old shape: only ONE
group was labelled (PROGRAM), so Speakers/Files/Communications read as
orphans; PROGRAM mixed four jobs (collect, review, schedule, publish);
Submissions sat above Forms, inverting the lifecycle; and the public page —
the single most important external artifact — hid behind a small top-bar
icon. New shape, every group labelled: PROGRAM = Forms → Submissions →
Evaluation → Agenda (the pipeline in the order the work happens) · SPEAKERS =
Speakers, Files, Communications (the people and everything about them) ·
SHARE = Public page (external, new tab, ↗ glyph) + Embeds ("closely linked
but separate" — Marko) · Settings terminal, Dashboard/Copilot label-less on
top. Top-bar public-page icon stays (quick affordance; hover copy now "Open
public event page"). Implemented in navGroupsFor (src/routes/app/route.tsx) +
src/components/shell/sidebar-nav.tsx (external-item support).

## Event settings pinned to the sidebar's true bottom, renamed (2026-08-12)
Marko: the settings entry "under Share … is a bit confusing … maybe just
separate at the complete bottom of the left sidebar no matter what / and also
do we specifically want to call it event settings?" The old shape had
Settings as a trailing UNLABELLED group directly below the labelled SHARE
group — group labels read as section headers, so Settings looked like a Share
item. Now it is pinned at the physical bottom of the sidebar (desktop aside
AND the phone drawer), behind its own top border, outside the scrolling group
list — the Linear/Notion pattern for workspace settings. Label is "Event
settings", not "Settings": account + workspace settings live in the avatar
menu, and this is the one sidebar entry where the bare word collides with
them (copilot surfaces already said "Event settings"). Implemented as
settingsNavFor + a pinned footer SidebarNav (mt-auto) in
src/routes/app/route.tsx and src/components/shell/mobile-nav.tsx;
SidebarNav grew className/ariaLabel props for the tighter footer rhythm.

## Inline status picker applies on one click; no Save, no Cancel (2026-08-12)
Marko, on the submissions-table status popover: "FIX THE UX/UI here — you see
this, with the Edit statuses fucking it up." The footer crammed three actions
(a navigation link styled as a button, Cancel, a half-disabled Save) under a
"New status: Accepted" recap that repeated what the checkmark already said —
a modal confirmation ritual around a one-word decision. Now: clicking a status
writes it immediately (optimistic pill, popover closes) and the toast is the
receipt. Save/Cancel/Reset and the recap line are gone; Escape or click-away
is the cancel; re-picking is one click.
Safe *because* the two-phase decision model is untouched: picking "Accept
Queue" still only stages — `submissions.setStatus` writes a status and emails
nobody; `commitQueue` from the banner is the real confirm, and it is where
sbek CFP-12's "staging is silent" contract lives. The queue caveat moved into
the toast ("Staged as Accept Queue. Nothing emailed yet — send the queue when
you're ready.", `statusSavedMessage`, shared with the drawer and the row's
✓ Accept / ✕ Decline quick actions) plus one quiet footnote in the popover.
"Edit statuses" is configuration, not picking: it is a gear icon in the
popover header (tooltip, links to Settings → Statuses), so the footer holds
nothing. Opening the popover focuses the *current* status, not the gear.
Note this deliberately diverges from Sessionboard's own picker
(docs/ux/03-…md: "confirming this status change requires an explicit save") —
their extra step is the sluggishness swyx complained about.
tests/e2e/flows/triage-decisions.spec.ts follows the new interaction (no Save
click; asserts the popover closes and the toast repeats the caveat).

## Platform transactional email is a durable mini-outbox (2026-08-12)
Workspace invites, password reset/verification, form-notification addresses and
evaluators are not event `people`, so they cannot honestly appear in the speaker
outbox. They also cannot stay scheduler + console-only: rule 18e says nothing may
silently not-send. `platformEmailDeliveries` is therefore the smaller durable
counterpart: payload + safe scope, pending/retrying/sent/preview/failed state,
provider receipt, five bounded attempts (1s → 5s → 25s → 125s), ten-minute stuck
recovery, 90-day retention, and a stable per-delivery Resend idempotency key.
Event/workspace organizers see only safe failure metadata and can retry an
exhausted row; account-lifecycle rows never leak into organizer UI. Speaker comms
stay in `messages` because they need per-person merge fields, `.ics`, preview and
delivery refresh. Two outboxes, one explicit recipient-domain boundary.

## A bare CFP segment is form-first, then event-primary (2026-08-12)
The canonical public URL remains `/submit/:workspace/:event/:form`. Compatibility
links are resolved deterministically: `/submit/:segment` first honors an exact
form slug (so old shared links never change meaning); only when no form owns it is
the segment treated as an event slug. The event's primary form is the open abstract,
then any open form, then a closed abstract, then the oldest remaining form. This
closes the judge path `/submit/ai-summit-2026` without introducing ambiguous redirects.

## REST session pages preload their joins (2026-08-12)
`POST /v1/event/:event/sessions` returns the full session resource, including
participants, submitter and both modern/legacy headshot URL aliases. Shaping a page
must preload participant rows concurrently and hydrate each distinct person once;
serial per-session/per-person reads crossed Convex's one-second query limit on an
ordinary 22-row abstract page. A headshot storage URL is also resolved once per shaped
person and reused for both aliases. The API contract is unchanged; the measured local
five-probe range after the fix was 23–242ms with every returned row still satisfying
`is_abstract=true`.

## E2E event context is explicit, never list-order dependent (2026-08-12)
A workspace switch intentionally lands on that workspace's first reachable event; it
does not promise a particular seeded event. Any browser test asserting event-scoped
data must therefore navigate to the canonical event URL or select the target through
the event level of the switcher. This keeps tests valid when a workspace has additional
legitimate events and directly exercises the two-level workspace/event hierarchy.

## Webhook authorization follows the hook's own scope (2026-08-12)
An event-scoped webhook is event data: every hook-id read/write/delivery operation
must pass `requireEventAccess` for that hook's event. Plain workspace membership is
insufficient because limited members belong to the workspace yet must receive
“Event not found” for events outside their grant. Workspace-wide hooks still use
workspace membership. The same helper controls every operation, with a negative
two-event regression.

## Dark mode ships, and it stops at the organizer app's door (2026-08-12)
Marko: "end-to-end add a dark/light mode switcher as part of the account
settings." This REVERSES the "light mode only" half of RULES.md #3 (and
DESIGN-REVAMP.md §3's "the `dark` variant stays neutered") — light stays the
DEFAULT and the design language is still authored light-first, but a `.dark`
token block now exists and organizers can choose Light / Dark / System in
`/app/account` (Profile tab, `AppearanceCard`) or flip it from the avatar menu.

**Scope: `/app/*` only** (`isThemeableRoute`, src/lib/theme.ts). Marketing, the
public event page, the CFP wizard, the speaker portal, /docs, /login and
/design-system stay light for every visitor, always. Two reasons, in order of
weight: (1) sbek's browser agent judges the public surfaces, and those pages
carry organizer cover images, embed previews and email previews composed
against white — a half-dark public page is a worse outcome than a light one,
and the absence of a leak cannot be proven in one night; (2) the preference is
an ACCOUNT setting, and a speaker opening a portal link has no account, so the
public surfaces would need their own switcher to be coherent. Because the class
is simply never on the document outside `/app`, no `dark:` utility anywhere in
the tree can fire there — the guarantee is structural, not a sweep.

**Palette rules** (`.dark` in src/styles.css): chrome stays neutral (a
barely-cool near-black, chroma still tiny — the "de-blued" rule survives the
inversion); elevation reads upward exactly as in light, so the page is the
DARKEST surface and cards/popovers step up; colour still carries data, with
status and tag tints becoming deep fills with light ink at 8–10:1; and the
accent is LIFTED, not changed — #2F5CE0 → #3D6BE5, same hue one step brighter.
That last number is a deliberate trade: white on #3D6BE5 is 4.74:1 (AA) so
primary buttons keep white text, and it reads 4.1:1 against the page so links
and the focus ring are legible. Brightening further would win link contrast
and lose the button's white text — buttons win.

Agenda blocks were the one recipe that could not be a palette: a track colour
is an arbitrary organizer-chosen hex, so the block is a `color-mix`. Both ends
of every mix are now `--track-*` tokens (`trackTint`, agenda-model.ts), and
dark raises the mix amounts because 9% of any hue over a near-black card is
invisible.

**No flash** is owned by an inline boot script in the document head
(`THEME_BOOT_SCRIPT`), not by React — React is too late to be the one that
decides, so it only ever confirms. The choice is stored twice on purpose:
localStorage plus a cookie, the cookie being what the server can read so the
Appearance control renders pre-selected in the SSR HTML. `<html>` carries
`suppressHydrationWarning` and no `className` prop, so React never fights the
script for the attribute. "System" is a live `matchMedia` subscription, not a
one-time read.

## The CFP stepper fits one line, or degrades on purpose (2026-08-12)
Marko, on the public wizard's Account step: "you see how ugly the break is? it
just breaks for the five Review step, it's quite weird." The tracker was
`flex-wrap`, and five labels + four chevrons need ~647px against the card's
608px of content — so "Review" orphan-wrapped. The card is capped at 42rem, so
no viewport can widen that budget; the fix has to come out of the row itself.
Three tiers now, and wrapping is structurally impossible (`flex-nowrap`,
`whitespace-nowrap`): `< sm` collapses to "Account · Step 2 of 5" + a progress
bar; `sm…md` is compact — numbered circles joined by a rule that tints once
traversed, only the CURRENT step labelled; `≥ md` is the full breadcrumb on one
line with 27px of measured slack (gap-1.5/px-1 buttons, 14px chevrons, no
chevron margin). Compact hides labels with `sr-only`, never `hidden`, so every
step keeps its accessible name — the judge is a browser agent.
Completed steps use the house "done" language (green check disc), the same one
`WizardShell`'s rail and the portal's `ProfileMeter` use; current stays solid
primary, which is what docs/ux/01 §7 recorded from the reference screenshots.

## "Powered by Trackstage" is a component, not a phrase (2026-08-12)
Marko: "make sure every 'Trackstage' mention like that uses the actual
Trackstage logo correctly, 100%." It was three different things — a plain blue
text link on the CFP wizard, a bare wordmark on the portal footer, a 22px full
lockup on public event pages. Now one `<PoweredByTrackstage />`
(src/components/brand/powered-by.tsx): the real 16px boxed mark + wordmark,
muted, warming on hover, one link target. It points at `/` rather than an
absolute trackstage.app URL so dev/staging/preview attribution doesn't send
people to production, and it renders a plain `<a>` so it works outside the
router. Sites: CFP wizard footer, speaker portal footer, public event page and
embed frames (`EmbedAttribution`).

## Required asterisks sit on the word (2026-08-12)
`Label` is a flex row with `gap-2`, so `Name<span>*</span>` put 8px between the
label and its asterisk — it read as its own word — and five places used a raw
`text-destructive` span with a literal space on top of that, with no
screen-reader equivalent. One rule now: `label .required-asterisk` pulls back
0.375rem, scoped to labels so running prose ("fields marked with * are
required") keeps its space; the raw spans became `.required-asterisk` +
`aria-hidden` + an `(required)` sr-only, matching the CFP wizard.

## The Track question is sourced from the event's tracks, and a required dropdown with no options is not shippable (2026-08-12)
Marko, on a screenshot of a FRESH event's live public form: the required "Track"
dropdown rendered "Select an option…" with nothing in it — a required field
nobody could satisfy, so the CFP was a dead end from the first minute. Then:
"you shouldn't even be able to create and SAVE/RELEASE the form if you have no
track."

Root cause: `forms.create` **snapshotted** track names into the question's
`options` array. On an event with no tracks that snapshot was `[]`, and tracks
added later never reached the form either.

Three layers, all in `convex/lib/formQuestions.ts`:

1. **Sync, not snapshot.** A question with `isTrackQuestion` does not own its
   answers — they ARE `tracks` for that event. `syncTrackOptions` re-derives
   them on every read (`forms.get`, `submit.getForm`, the REST `formShape`, MCP
   `get_form`) and every write (`forms.create/update/duplicate`, the REST form
   + field endpoints), and `roomsTracks` writes through to the stored copy so
   the API and MCP see the truth too. A track rename carries into the answers
   already given, exactly as `valueLists.rename` does for Format/Level/Language.
   The per-form override is unchanged and is where it always was: switch "Route
   answers to tracks" off and it becomes an ordinary dropdown with its own
   options. Format/Level/Language/Tags keep the value-list model (they ship with
   defaults, so they cannot be empty by accident).
2. **Never render an unanswerable field.** With zero tracks the question is
   dropped from the public form entirely (`publicQuestions`) rather than shown
   empty or silently relaxed — the submission simply arrives trackless and the
   organizer assigns one later. `saveDraft`/`submit` validate against that same
   set (`formAsSubmitted`), so the server can't demand an answer the speaker was
   never asked for. This is the fallback that keeps ALREADY-live forms working
   when the last track is deleted.
3. **You cannot release a form nobody can fill in.** `assertReleasable` refuses
   to open a form while any enabled + required choice question has nothing to
   offer, in `forms.update`, the REST form/field writes, MCP
   `update_form_settings` and `valueLists` — with one deliberate asymmetry:
   opening refuses on ANY blocker, but a form that is already open refuses only
   blockers the write would ADD, or an organizer who inherited a broken form
   would be locked out of the screen where the fix lives. The builder mirrors
   the same verdict (`releaseBlockers` in `forms-builder/model.ts`): a warning
   on the offending question row, a banner in the Questions step, and the
   "This form is open" switch disabled while it's closed and blocked.

Because a new form is born open, `forms.create` (and the REST/MCP equivalents)
now create the Track question **optional** when the event has no tracks yet —
required is a choice the organizer makes once there is something to choose from.

## The custom auth proxy owns the trusted client-IP bridge (2026-08-12)

Better Auth's durable rate limiter reads only the application-owned
`x-trackstage-client-ip` header. The app-origin proxy must derive that header
from Cloudflare's canonical `cf-connecting-ip` on every request; it must never
trust a browser-supplied bridge value. Therefore every auth forwarder follows
one rule: overwrite the bridge from `cf-connecting-ip` when present, otherwise
delete it. This applies to the hand-written `/api/auth/*` forwarder as well as
any future library wrapper. A full browser E2E asserts preservation and spoof
rejection so replacing the proxy implementation cannot silently drop the rate-
limit identity again.

## "Am I signed in?" means "can Convex serve an authed query", not "has Better Auth answered" (2026-08-12)

`useSession().status` gates every authed Convex query in the app. It used to be
derived from Better Auth's browser `/api/auth/get-session` fetch, which is
neither necessary nor sufficient:

- **Not necessary** — the Convex client is already authenticated on a cold load
  from the `initialToken` the server resolved in the root `beforeLoad`. Waiting
  on the browser's own round trip only adds latency.
- **Not sufficient** — right after a sign-in the Better Auth store has a session
  a beat before the Convex client has a token, and queries fired in that gap
  come back `Unauthenticated`.

And it could hang: Better Auth gives that fetch no timeout, and its refresh
manager only re-drives it once a session exists — never for the first one.
Safari parks in-flight fetches in the background tab a mail client opens, so
clicking the confirmation email's link left the whole app pending forever
(BUILD-LOG 2026-08-12). `status` now comes from `useConvexAuth()`. The Better
Auth session is still read for the user's name and email — the things no token
carries — and re-asked on a bounded schedule plus on visibility/focus/online.

**Corollary: a first-run arrival must be legible in the URL.** Web storage
cannot tell the server anything, and `sessionStorage` cannot cross tabs — so
neither can help the one arrival that is guaranteed to be first-run and
guaranteed to be a new tab. Signup mints its confirmation link with
`callbackURL=/app?welcome=1`, and the server renders the onboarding frame
directly for that address. Storage remains a backup, never the only signal.

## Reconnecting Airtable starts a new mirror authority (2026-08-12)

Disconnect preserves the user's Airtable tables and rows but deletes the saved
credential. A later connect may point at the same base or a different one, so
the new connection must not inherit the previous connection's opt-in write-back
flag, sync cursor, counts, inbound result, or per-submission status baselines.
`airtable.saveConnection` therefore resets two-way sync to off, clears those
connection fields, and deletes the event's `airtableRecordSync` rows before the
first outbound mirror establishes a fresh baseline. Status can come back only
after the organizer explicitly opts in again.

## Demo surfaces are a build flag, not a birthright (2026-08-12)

The demo credentials card on `/login`, the demo entry points on the homepage,
the demo speaker shortcut on `/portal` and the demo links in the feature tour
all assume a seeded demo world — which only our hosted deployments have.
Seeding was already an explicit step (`seed:setup`, never run on deploy), but
the UI advertised the credentials unconditionally, so a self-hosted build
showed a login pair that either didn't exist or, worse after seeding, was the
publicly known `demo2026`.

Now: `src/lib/demo-mode.ts` exports `DEMO_MODE = import.meta.env.DEV ||
VITE_DEMO_MODE === "1"`. Off by default in production builds; our committed
`.env.production`/`.env.staging` set `VITE_DEMO_MODE=1`; local dev always
shows the entrances (dev talks to a seeded playground, and e2e runs `vite
dev`). `seed:setup` additionally takes an optional `password` so a
self-hoster can keep the sample data without the well-known credential.

Same day, `/get` copy: dropped "goes public automatically on {date} — this
page becomes a straight redirect", because flipping the repo public is a
manual act, not a scheduled one. The countdown stays; the live GitHub check
that redirects once the repo *is* public also stays (that part is true).

## The e2e gate moved to the promote (2026-08-12)

Running the ~35-minute Playwright flows suite on every dev commit gated every
push and every staging deploy behind it. Per Marko: dev velocity wins. Now
`verify` (typecheck · lint · OpenAPI drift · unit tests, ~4 min) is the gate
for `main`/`master`/PRs and is what auto-deploys dev.trackstage.app; the full
e2e suite runs on promotes to `prod` and on manual workflow_dispatch. A
promote can additionally carry `[skip-gate]` in its head commit message to
skip e2e for that release (verify still gates it) — for copy tweaks and other
low-risk changes. Manual dispatch on Deploy remains the skip-everything
emergency hatch. Docs card fix rode along: the "4 endpoints"/"N tools" counts
on /docs were wrong and are now plain CTA labels.

## Light is the default; dark is a choice, never an inference (2026-08-12)

Amendment to "Dark mode ships, and it stops at the organizer app's door": the
unset fallback moved `system` → `light`. A dark-OS organizer with no stored
preference used to land in a dark /app straight off the light-only marketing
pages — a jarring flip they never asked for, reading as a glitch. Now nobody
gets dark (or OS-following) without picking it in Account settings →
Appearance; only a STORED "system" subscribes to `prefers-color-scheme`.
Enforced in all three layers with matching fallbacks — `readStoredTheme`, the
inline boot script, and the root route's server cookie read — and pinned by
`tests/unit/theme-default.test.ts`. The /app-only scoping is unchanged.

## The public endpoints are ours, the auth plumbing stays put (2026-08-12)

`api.trackstage.app` (prod, keen-eagle-41) and `dev-api.trackstage.app`
(dev, neat-sparrow-926) are Convex custom domains on the HTTP-action surface.
One env var — `VITE_PUBLIC_API_URL` — drives every ADVERTISED URL through
`apiBaseUrl()`/`mcpEndpoint()`: the MCP address in the docs and Connect
dialog, the REST base, embed URLs, and the `.ics` subscription feeds. Nothing
hardcodes a hostname; the two places that string-replaced `.convex.cloud` →
`.convex.site` (public/ics.ts, the embeds route) now route through the helper
as well.

Deliberately NOT moved: `VITE_CONVEX_SITE_URL`. The auth proxy, SSR session
resolution and the copilot's tool calls are wired to the raw deployment host,
and branding is not a reason to move a working auth origin.

Discovery follows the host the caller actually used — the MCP 401 challenge
and the protected-resource document both name the requested origin rather
than `CONVEX_SITE_URL`. A client that added the branded domain compares the
resource it asked for against the one we name; a mismatch reads as somebody
else's resource and the connection is refused. The raw `*.convex.site` host
keeps working identically for anyone already connected there.

Also: the deployment serves the Trackstage favicon at `/favicon.ico|png|svg`
(convex/lib/favicon.ts). MCP clients brand a connector with the favicon of
the ENDPOINT's origin, which 404'd and fell back to Convex's own mark.

## Two-way Airtable is a field-level opt-in, not a switch (2026-08-13)

"Two-way sync" as one boolean is wrong in both directions at once: too timid
for the organizer who wants to bulk-fix twelve speaker bios in a grid, too
reckless for the one who only wants Airtable to triage Status and would be
horrified to learn a spreadsheet typo can rewrite an abstract. The unit an
organizer reasons about is the COLUMN, so that is the unit we store, check and
render — a master switch (off by default; one-way is the only provably harmless
shape) plus a checklist of the 20 columns in `convex/lib/airtableFields.ts`.
Enabling the switch selects Status alone, which is exactly what it meant
before, so connections made under the old shape keep behaving identically.

The registry is deliberately a code change per field: each needs a parser, a
clearing rule and a place to land. Three things are permanently out of reach —
`Email` (the identity a speaker's portal token, tasks and comms hang off),
derived columns (`Name`, `Ends At`), and record creation/deletion. Draft and
Withdrawn remain unsettable because they are the speaker's own state.

**One `parse` per field, run at all three sites.** The Airtable cell we read,
the value we hold in Convex, and the baseline we stored all go through the same
function, so "did this change?" is one string comparison that cannot drift.
Baselines are derived from the exact cell objects we pushed (and never for a
column Airtable told us it doesn't have), which is what makes echo detection
reliable and clearing safe: an empty cell can only mean "delete this" once we
know we put something there.

**Nothing inbound patches a document.** Status goes through
`submissions.setStatusInternal`, wording through `updateDetailsInternal`,
profiles through `speakersAdmin.updateProfileInternal`, slots through
`agenda.rescheduleInternal` — so a spreadsheet edit fires the same webhooks and
keeps the same version history as a click in the UI, attributed to "Airtable
sync" rather than to a person.

**Silence must read as silence** (found by the live run, not by unit tests).
The guard originally refused Draft/Withdrawn before checking whether the value
had changed at all. But we WRITE "Draft" for every draft submission, so it came
back on every pull and the card reported four permanent refusals nobody could
act on or clear. `unchanged` and `echo` now precede `not_allowed`: a cell that
already agrees with us is asking for nothing, so it is neither a refusal nor a
conflict. `unchanged`/`echo` are also excluded from the "left alone" count for
the same reason — with twelve columns over two hundred rows they would bury the
number that matters.

---

- **2026-08-13 · The API reference prints one address, and the token it prints
  can only read the demo.** Two things were false on `trackstage.app/docs/api`.

**The base URL.** `scripts/generate-openapi.mjs` still read
`VITE_CONVEX_SITE_URL`, so the committed spec advertised
`keen-eagle-41.convex.site` months after `api.trackstage.app` went up. It now
follows the same precedence as `publicApiOrigin()` — `VITE_PUBLIC_API_URL`
first — and rewrites the dev hosts that live example capture bakes into file
and headshot URLs to prod's, so a reader never meets two bases in one document.
The API's own `upload.url` follows the host the caller actually used, the rule
MCP discovery already keeps: a client that came in on the branded domain is not
bounced to `*.convex.site` for the follow-up PUT.

**The demo token.** The reference has always told readers to explore with
`demo-api-token`. On prod that 401'd (prod sets a real `PUBLIC_API_TOKEN`), and
the "fix" of publishing prod's token would have handed every reader read access
to every organizer's submissions, speaker addresses and files — the legacy
token reads the whole database by design. So the constant is now accepted on
every deployment as a *smaller* credential: read-only, and confined to the
seeded demo workspace, checked once at the dispatcher door on the event
reference every scoped path carries (`convex/apiHttp.ts`, `apiV1.eventIsDemo`).
An operator's own `PUBLIC_API_TOKEN` keeps the full read-only view, so a
self-host that sets nothing behaves exactly as before. CI now sets an operator
token on the hermetic backend so the flows suite proves the scoping against a
stranger's event created seconds earlier.

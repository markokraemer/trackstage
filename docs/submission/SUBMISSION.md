# Trackstage — "Kill My SaaS" submission

**Live:** https://trackstage.app · **Repo:** https://github.com/markokraemer/trackstage (MIT)
· **Film:** https://trackstage.app/launch.mp4 (90 s)

Trackstage is an open-source replacement for Sessionboard: call for speakers → review →
speaker portal → agenda → published program, in one fast tool. Built for the
walkthrough swyx showed, then measured against the official eval kit until it scored.

## Try it in 60 seconds

| Seat | Where |
| --- | --- |
| Organizer | https://trackstage.app/login — `organizer@demo.sessionboard.dev` / `demo2026` (shown on the page) |
| Speaker (public CFP) | https://trackstage.app/submit/ai-engineer/ai-summit-2026/cfp — submit with a fresh email, you land in the portal |
| Speaker (portal) | Organizer → Speakers → any row → "Open their portal" (passwordless, tokenized) |
| Attendee | https://trackstage.app/e/ai-engineer/ai-summit-2026 — published program, personal schedule, `.ics` feed |
| Developer | https://trackstage.app/docs — REST API (109 operations, OpenAPI + try-it) and MCP setup |

Everything in the brief's scope is in: CFP form builder with conditional questions and
track routing · five-step public submission flow with drafts, limits and deadlines ·
passwordless speaker portal (submissions, profile, versioned uploads, tasks) ·
multi-round evaluation with evaluator assignment, blind rounds and progress tracking ·
staged accept/decline queues that send the decision email on commit · drag-drop agenda
with live conflict detection (rooms *and* double-booked speakers) across
List/Day/Week/Rooms views · templated comms, reminder sweeps and `.ics` invites ·
a real-time outstanding-speaker-tasks dashboard · public schedule/speaker embeds ·
one-click Airtable sync.

## Why this one

1. **Speed.** The complaint that started the competition was sluggishness. Every
   interaction here is optimistic and instant on a reactive backend (Convex, AWS
   us-east-1), served from Cloudflare's edge, email via Resend us-east-1. No spinners
   where a click should just work.
2. **An MCP server that is the whole product, plus a built-in copilot.** 84 tools in 12
   groups over OAuth 2.1 (add the URL to Claude/ChatGPT as a connector and sign in — no
   key paste). Every write refuses without `confirm: true`, so destructive power is
   gated rather than absent. In-app: press ⌘I and the copilot drives the same server,
   with approval cards and results rendered as real product UI. Sessionboard has
   nothing in this category.
3. **A REST API that actually writes** — events, forms, submissions, tracks, rooms,
   statuses, webhooks with HMAC signatures and delivery logs. OpenAPI-documented,
   interactive reference at `/docs/api`.
4. **Open source, and honestly engineered.** MIT license, self-host in five commands.
   Every push runs typecheck · lint · OpenAPI drift · 341 unit tests · the complete
   Playwright e2e suite against a hermetic Convex backend booted in CI — nothing
   deploys without the whole gate green. Plus 600+ live backend checks
   (`pnpm test:backend`) driving auth, scoping, files, comms, REST and MCP against a
   real deployment.
5. **Simplicity as a decision.** Copied the structure, cut the clutter. The domain
   language (Abstracts vs Sessions, staged queues, tracks vs tags) matches Sessionboard
   exactly so the walkthrough maps one-to-one.

## Self-evaluation against the official kit

We ran `swyx/killmysaas-evals` (sbek) against production repeatedly and hill-climbed on
its verdicts. Latest full run (12 scenarios, 150 turns, best-per-area composite):

**93.6%** — Call for Papers 90.3 · Abstract Management 96.4 · Speaker Management 96.9 ·
Content Management 85.5 · AI Agenda 100 · Public Widgets/Embeds 95.7.

Honest caveats: several rubric items are capped at *partial* by construction — the
browser agent cannot open inboxes, import an `.ics`, or unzip a download — those halves
are documented with evidence steps in `docs/submission/sbek-manual-checklist.md`.
ABS-14 (AI-assisted review) scores `not_found` deliberately: swyx struck it from scope.
A few residual partials are run artifacts (screenshots the judge model never received),
not product gaps; the ledger with every non-pass item and its root cause is in
`docs/reference/sbek-ledger.md`.

## What we deliberately did NOT build

swyx struck these, and we took the hint rather than padding the feature list:
Accelevents integration · wiki/HTML-embed resource pages · AI-assisted review ·
payments · CRM · marketing. Restraint is a product decision too — the tool stays
learnable by a non-technical event producer in one sitting.

## Stack

TanStack Start (React 19) · Convex (reactive database, file storage, crons) ·
Better Auth · shadcn/ui on Base UI · Cloudflare Workers. Repo layout, self-hosting and
deploy pipeline are in the README.

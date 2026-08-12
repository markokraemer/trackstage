<p align="center">
  <img src="public/favicon.svg" width="56" alt="Trackstage logo" />
</p>

<h1 align="center">Trackstage</h1>

<p align="center">
  <b>Call for papers, agenda and speaker management — in one fast, simple tool.</b><br/>
  The open-source Sessionboard alternative.
</p>

<p align="center">
  <a href="https://trackstage.app">trackstage.app</a> ·
  <a href="#try-it-now">Try it now</a> ·
  <a href="#what-it-does">Features</a> ·
  <a href="#self-host">Self-host</a> ·
  <a href="#for-developers">API &amp; MCP</a> ·
  <a href="LICENSE">MIT</a>
</p>

Trackstage runs the whole speaker side of a conference: you collect talk submissions
through a call-for-papers form, review and decide on them, send the acceptance and
decline emails, give every speaker a portal to finish their profile and their to-dos,
and drag the accepted talks onto a schedule that catches clashes as you build it. It is
free, MIT-licensed, and you can self-host it.

## Try it now

Nothing to install — the live demo is seeded and open.

| I want to… | Go to |
| --- | --- |
| **Run an event** (organizer) | [trackstage.app/login](https://trackstage.app/login) → `organizer@demo.sessionboard.dev` / `demo2026` (also printed on the page) |
| **Submit a talk** (public CFP) | [trackstage.app/submit/ai-engineer/ai-summit-2026/cfp](https://trackstage.app/submit/ai-engineer/ai-summit-2026/cfp) — use any email, you land in the speaker portal |
| **See what a speaker sees** | Organizer → Speakers → any row → *Open their portal* (passwordless link) |
| **Browse a published program** | [trackstage.app/e/ai-engineer/ai-summit-2026](https://trackstage.app/e/ai-engineer/ai-summit-2026) |
| **Read the docs** | [trackstage.app/docs](https://trackstage.app/docs) |
| **Watch the 90-second film** | [trackstage.app/launch.mp4](https://trackstage.app/launch.mp4) |

![The organizer dashboard — live submission counts, the decision pipeline, and which speakers to chase first](public/screenshots/dashboard.png)

## What it does

**Call for papers.** Build the form in a wizard: your own questions, conditional
questions that only appear when they're relevant, and track routing. Turn fields on and
off, mark them required, set a close date and a per-person submission limit. Speakers
submit through a five-step public flow with drafts.

**Review and decide.** All submissions in one table with status tabs. Stage your
accepts and declines into queues, then commit once — that is what sends the decision
emails, creates each new speaker's onboarding tasks, and flips every screen at the same
time. Nothing is announced before you press the button.

**Evaluation rounds.** Bundle evaluators, submissions and rounds into a plan, distribute
the work, and track who has finished. Evaluators only see "My evaluations".

**Agenda.** Drag talks onto a day × room grid. Room clashes *and* double-booked speakers
flag in red as you drag, not after a refresh. Auto-place the leftovers, then publish the
public schedule when you're ready.

**Speaker portal.** Passwordless — speakers arrive from an emailed link. They edit their
talk, fill in their bio, upload a headshot and slides (versioned, and you approve them),
and tick off their tasks. You watch the outstanding ones on the dashboard in real time.

**Emails and calendar invites.** Templated emails with placeholders, reminder sweeps, and
`.ics` invites that carry the room once you've assigned one. There's a public `.ics` feed
for the whole program too.

**Embeds.** Build a schedule or speaker widget for your event website in a visual editor
and copy the snippet.

**Dark mode**, light mode, or follow the system — set it in account settings.

Also in the box: multi-tenant workspaces with roles and email invites, one-click Airtable
sync, a REST API, an MCP server, and an in-app AI copilot — see
[For developers](#for-developers).

<details>
<summary><b>More screenshots</b></summary>

| | |
| --- | --- |
| ![Submissions triage table with staged accept and decline queues](public/screenshots/submissions.png) | ![Form builder — the questions step](public/screenshots/form-builder.png) |
| ![Agenda day view with rooms as columns](public/screenshots/agenda.png) | ![Speaker portal](public/screenshots/portal.png) |

![Dragging a session onto the agenda grid — it snaps to a 15-minute slot and conflicts flag in red the moment they exist](public/screenshots/agenda-flow.gif)

</details>

## For developers

**REST API** — Bearer-authenticated, paginated, 110 operations. Events, forms,
submissions, speakers, tasks, evaluations, tracks, rooms, statuses, and webhooks with
HMAC signatures and a delivery log. OpenAPI spec and an interactive reference at
[`/docs/api`](https://trackstage.app/docs/api).

```sh
curl -H "Authorization: Bearer <key>" \
  https://<your-convex-site>/v1/event/ai-summit-2026/sessions
```

The `/v1/event/{slug}/schedule.ics` feed needs no credential.

**MCP server** — 84 tools in 12 groups (workspaces & events · CFP forms · submissions &
decisions · agenda · speakers · speaker tasks · files & review · email · evaluation ·
event setup · webhooks & embeds · activity). Every tool that writes refuses without
`confirm: true`, so destructive operations are gated rather than missing;
`delete_event` also demands the event's exact name. The current list renders at
[`/docs/mcp`](https://trackstage.app/docs/mcp).

```sh
claude mcp add trackstage --transport http https://<your-convex-site>/mcp \
  --header "Authorization: Bearer <key from Settings → API & MCP>"
```

Claude and ChatGPT connectors need no key: add the `/mcp` URL and sign in — it is a real
OAuth 2.1 authorization server (dynamic client registration + PKCE). A key is an
*identity*, not a bypass: every call runs the same workspace-membership checks as the web
app. Keys are stored hashed, shown once, and revoke instantly.

**AI copilot** — press <kbd>⌘I</kbd> anywhere in the app. It drives that same MCP server,
so it can answer questions ("who hasn't finished onboarding?") or do the work ("schedule
the unscheduled talks"). Anything destructive stops at an approval card first, and
results render as real product UI instead of prose.

## Stack

[TanStack Start](https://tanstack.com/start) (React 19) for routing and SSR ·
[Convex](https://convex.dev) as the backend — reactive database, file storage, crons, and
the HTTP endpoints that serve `/v1` and `/mcp` · [Better Auth](https://better-auth.com)
for accounts · [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) ·
[Cloudflare Workers](https://workers.cloudflare.com) for hosting.

The Worker serves SSR with Smart Placement so it sits next to the Convex deployment;
every screen subscribes to Convex queries, which is why counts and statuses update
everywhere at once without a refresh. Application code lives in `src/routes` (file-based;
never edit `routeTree.gen.ts`) and `convex/`.

## Self-host

```sh
git clone https://github.com/markokraemer/trackstage && cd trackstage
pnpm install
pnpm dev:setup                    # provisions a free Convex backend (interactive login)
pnpm dev                          # http://localhost:3000
pnpm exec convex run seed:setup   # demo event, organizer account, sample data
```

Sign in with `organizer@demo.sessionboard.dev` / `demo2026`.

### Deploy

```sh
pnpm deploy   # convex deploy → vite build → wrangler deploy → smoke test
```

The build reads `.env.production` (committed — public values only), so a production build
always points at the production Convex deployment. Secrets live outside the repo:

| Where | What |
| --- | --- |
| `convex env set … --prod` | `BETTER_AUTH_SECRET` · `RESEND_API_KEY` · `EMAIL_FROM` · `SITE_URL` (your app origin — required for MCP OAuth and every emailed link) · `PUBLIC_API_TOKEN` · optional `EXTRA_TRUSTED_ORIGINS`, `REQUIRE_EMAIL_VERIFICATION` |
| `wrangler secret put …` | `OPENROUTER_API_KEY` (the copilot runs in the Worker) |

Signup always sends a confirmation email, but verification is **soft** by default:
unverified accounts work fully and see a dismissible banner.
`convex env set REQUIRE_EMAIL_VERIFICATION true` turns on the hard gate (sign-in refused
until the link is opened) with no code change.

Check any deploy:

```sh
node scripts/smoke-production.mjs                                   # SSR routes + /v1 + /mcp + OAuth discovery
APP_URL=https://your-app.workers.dev node scripts/smoke-production.mjs
```

### Custom domain

Two idempotent scripts, in this order — re-run either safely:

```sh
export CLOUDFLARE_EMAIL=… CLOUDFLARE_GLOBAL_API_KEY=…
node scripts/configure-domain.mjs yourdomain.com                    # Resend domain + SPF/DKIM/MX
RESEND_API_KEY=… node scripts/attach-domain.mjs yourdomain.com trackstage
```

`attach-domain.mjs` attaches the domain to the Worker, waits for it to serve, then moves
Convex `SITE_URL` and `EMAIL_FROM` onto it. It also accepts a scoped
`CLOUDFLARE_API_TOKEN` instead of the global key (that is what CI uses). Finish by
setting `VITE_SITE_URL` in `.env.production`, adding the `routes` entry to
`wrangler.jsonc`, and redeploying so the client bundle agrees.

## Tests and CI

```sh
pnpm test          # 353 unit tests (vitest)
pnpm test:e2e      # Playwright — 12 flow suites through the real UI
pnpm test:backend  # 585 live checks across 36 sections against a real Convex deployment
```

`main` is the dev branch (`master` mirrors it); `prod` is the release branch. Every push
runs the full CI gate — typecheck · lint · OpenAPI drift · unit tests, then the complete
Playwright flow suite against a Convex backend booted inside the runner, so it is
hermetic: no cloud data, no secrets, no mail. A green run on `main` auto-deploys staging
to **https://dev.trackstage.app**.

```sh
git push origin main:prod   # promote to production
```

That re-runs the same full gate and only then ships Convex → build → Worker → smoke test.
Nothing reaches production without the whole suite green. Actions → Deploy → *Run
workflow* is the manual escape hatch. See `.github/workflows/`.

## License

[MIT](LICENSE). Use it, fork it, run it for your conference.

## Where this came from

Trackstage was built for [swyx's "$10,000 Kill My SaaS"](https://luma.com/ls-06v7)
competition: clone an enterprise SaaS in a weekend, open source it, and let the team that
actually uses the original judge the result. The target was
[Sessionboard](https://www.sessionboard.com) — event teams pay a lot for it, and the
walkthrough that kicked off the competition was mostly complaints about how slow it is.
So the two things we optimized for were speed and simplicity: copy the structure, cut the
clutter, make every click instant.

The competition ships an LLM browser-agent eval kit,
[`swyx/killmysaas-evals`](https://github.com/swyx/killmysaas-evals), which drives real
user flows and scores them. We ran it against production and fixed what it found. Our own
latest run scores **93.6%** overall (Call for Papers 90.3 · Abstract Management 96.4 ·
Speaker Management 96.9 · Content Management 85.5 · AI Agenda 100 · Public Widgets 95.7).
That is a self-reported number from our own runs, not an official result — every non-pass
item, its root cause, and what we did about it is written up in
[`docs/reference/sbek-ledger.md`](docs/reference/sbek-ledger.md).

The design system is at [`/design-system`](https://trackstage.app/design-system) —
right-click the logo anywhere in the app.

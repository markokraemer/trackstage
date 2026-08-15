<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Sessionboard OSS — Agent Context Hub

Open-source replacement for [Sessionboard](https://www.sessionboard.com), built for swyx's
"$10,000 Kill My SaaS" competition. **Deadline: Wed Aug 12, 2026, 10PM PT.** Judged by the
AIE team plus an LLM browser-agent eval kit ("sbek") driving real user flows, with a
tiebreaker on product judgment. End users are **non-technical event-production
professionals** — simple, clear, organizer-friendly UI wins.

This file is the centralized project memory. Keep it updated as decisions land.

## Project memory (read FIRST, keep updated)

| Doc | Memory type |
| --- | --- |
| `docs/memory/RULES.md` | Procedural — Marko's standing directives; binding |
| `docs/memory/DECISIONS.md` | Semantic — every decision + why |
| `docs/memory/BUILD-LOG.md` | Episodic — what actually happened, append per session |

Add to these the moment something new is decided, learned, or directed. Nothing here is
sacred — anything may be refactored toward the best possible product, following best
engineering and UX/UI practices.

## Source-of-truth documents (read before building anything)

| Doc | What it is |
| --- | --- |
| `docs/SPEC.md` | **The build spec** — IA, screens, acceptance criteria, data model |
| `docs/reference/sbek-rubric.md` | Digest of the official eval rubric (hill-climb target) |
| `docs/reference/design-references.md` | **Design evidence base for the rule-19 reconciliation pass** — Attio/Stripe/Luma/Notion Calendar/Cal.com/Linear/Vercel/Sessionize/Juicebox teardowns, the accent-colour analysis (Petrol `#0F6E70`), and the ranked 10-change shortlist |
| `docs/video/transcript.md` | Full timestamped transcript of swyx's walkthrough video |
| `docs/video/actions.md` | Chronological screen/action/requirement analysis of the video |
| `docs/video/ui_fidelity.md` | Extra pass: layout geometry, micro-style, usability cues |
| `docs/ux/01…05-*.md` | Forensic UI specs of all 42 brief screenshots, per product area |
| `docs/reference/brief.md` | The competition brief (Gene Kim's cleaned copy) |
| `docs/reference/swyx-clarifications.md` | swyx's Discord answers — these AMEND the spec |
| `docs/initial-brief/` | Original brief HTML + all 42 screenshots |
| `…Brief/kill-my-saas-submissions.md` | Research on all ~15 competing submissions |

## Scope (per brief + amendments)

**In:** CFP form builder with conditional logic + track routing · public submission flow ·
speaker portal (submissions, profile, tasks) · templated comms/reminders + `.ics` invites
(room details when known) · multi-round evaluation/scoring with evaluator assignment ·
drag-drop agenda with conflict detection (List/Day/Week/Rooms/Conflicts views) · real-time
outstanding-speaker-tasks dashboard.

**Struck by swyx — do NOT build:** Accelevents integration, wiki/HTML-embed resource pages,
embeddable gallery/itinerary widgets, AI-assisted review, payments, CRM, marketing.

**Clarified:** `.ics` is enough (no Gmail/Outlook APIs). Single CFP form with track options
is fine. Accepted speakers can still edit submissions (no locking needed). Co-speaker
portal accounts are nice-to-have. Airtable read-only is fine (bonus, not core) — we ship the mirror plus an opt-in, per-column write-back.

## Canonical domain language (match Sessionboard exactly)

- **Abstracts** = applications to speak (came through a form). **Sessions** = confirmed
  program items (e.g. sponsors, added manually). One pipeline, two origins.
- **Status pipeline:** `Draft → Pending → Accept Queue / Decline Queue → Accepted /
  Declined`, plus `Withdrawn` (speaker-initiated). Queues are staged decisions — the email
  goes out when the organizer commits the queue, not when the status is picked.
- **Statuses use identical wording in organizer and speaker UIs.** Colors: green =
  Accepted/Accept Queue, amber = Pending/Decline Queue, red = Declined.
  **ONE EXCEPTION — the two staged queues are never speaker-facing:** the speaker portal
  renders `accept_queue` / `decline_queue` as **Pending** (same word, same amber pill),
  because the whole point of a queue is that nothing is announced until the organizer
  commits it. Masked once, server-side, in `convex/portal.ts::submissionSummary`; every
  organizer surface keeps the real queue status.
- **Editing a submission from the portal closes when the CFP closes — for everyone,
  accepted included** (sbek CFP-16 hard-fails any exemption; reversal recorded in
  DECISIONS.md 2026-08-11). Acceptance itself never locks editing while the CFP is
  open, and `events.portalSettings.allowSubmissionEdits` is the organizer's escape
  hatch after the deadline. One verdict, `convex/portal.ts::editLockFor`, drives both
  the greyed-out drawer and the mutation's refusal sentence.
- **Track** = colored single-select (drives routing + agenda columns). **Tags** = gray
  multi-select. **Format / Level / Language** = plain dropdowns.
- **Evaluation** happens via **Evaluation Plans**: a plan bundles evaluators + assigned
  submissions + rounds; evaluators see "My Evaluations"; progress is tracked per evaluator.
- **Session Submitter ≠ Speaker(s)** — a submission has a submitter plus 1..n participants
  with roles (Speaker / Chairperson / Moderator).

## The product surfaces

1. **Organizer app** — left sidebar: Dashboard · Copilot · Program (Forms,
   Submissions, Evaluation, Agenda) · Speakers (Speakers, Files, Communications) ·
   Share (Public page, Embeds), with Event settings pinned separately at the bottom.
2. **Public CFP** (`/submit/:workspaceSlug/:eventSlug/:formSlug`) — de-chromed,
   centered card, 5-step tracker. Legacy event/form and single-segment form links
   resolve to the same canonical CFP; a bare event slug opens that event's primary form:
   Welcome → Account → Submission → Participants → Review; then "Continue to portal".
3. **Speaker portal** (`/portal`, entered through `/portal/t/:token`) — tabs: Home,
   Submissions, Profile, Tasks.
4. **Form builder** — 6-step wizard (Submission Setup → Welcome Screen → Abstract
   Information → Participant Information → Form Settings → Notifications) with
   per-field Required/Enabled toggles, locked system fields
   (First/Last/Email), participant-role min/max, close date, submission limits.

### Speaker identity — how a portal token is earned (security-critical)

The `portalToken` is a bearer credential: whoever holds it reads that speaker's
submissions, drafts, tasks, files and profile. No passwords, ever — but **typing an email
address is not proof of owning it**, so `submit.identify` hands a token to exactly two
callers:

- a **brand-new address** for that event (nothing behind it to steal — this is the common
  path and it is unchanged: straight through, no inbox trip); or
- a caller that **already presents the matching token** (same-browser sessionStorage
  resume, or the emailed link).

Everything else — any address with a submission, a co-speaker credit, a task, an upload or
a filled-in profile — gets a sign-in link mailed to it through the ordinary outbox
(`portal_link`, ≤3/hour, `/submit/{event}/{form}?t={token}`), and the response says
*nothing* else: no token, no name, no drafts, no counts, no cap errors. The wizard shows
"we've sent a secure link to {email}" with resend + use-a-different-address. `?t=` is
consumed into sessionStorage and stripped from the URL on arrival; `/portal/t/{token}`
works as it always has. Full reasoning in `docs/memory/DECISIONS.md` ("Typing an email is
not proof of owning it"); the code comment lives at the top of `convex/submit.ts`.

## Design system (from screenshots + video)

Light mode only. Primary blue `#2F5CE0`, page bg `#F8FAFC`, cards white with `1px`
border + subtle shadow, navy text `#1B1E27`, muted `#64748B`. Radius: 8px inputs/buttons,
12px cards. Status badges: soft-tinted pills (amber `#FEF3C7`/`#92400E`, green
`#D1FAE5`/`#065F46`). Left sidebar ~240px with grouped sections. Right slide-over drawers
(~480px) for create/detail flows. Tables: checkbox column, sticky header, status pills,
`...` row actions. Wizards: left step rail with checkmarks, dark active step, Back/Next
footer. Labels above inputs, red asterisk for required, "(i)" tooltips on non-obvious
fields. Proper component pickers everywhere (real date pickers, dropdowns) — no raw text
inputs for structured data.

**Our differentiators (from swyx's complaints): speed — Sessionboard is sluggish and he
said so repeatedly — plus simplicity. Copy the structure, cut the clutter.**

## Verify before claiming done

```sh
pnpm typecheck && pnpm lint && pnpm build
```

`pnpm preview` builds and serves the real Worker via Wrangler — a passing build does NOT
prove the Worker boots; check both. Every flow must work via ordinary links/forms/buttons
(the judge is a browser agent).

## CI/CD (release model)

- **`main` is the canonical dev branch; `master` mirrors it for now** (local sessions
  may keep pushing `master` — CI triggers on both; push both when convenient:
  `git push origin master master:main`). `prod` is the release branch.
- **CI (`.github/workflows/ci.yml`) on every push/PR runs `verify`:** typecheck ·
  lint · OpenAPI drift · unit tests (~4 min). The complete Playwright **e2e flows
  suite** (hermetic: anonymous local Convex backend on 127.0.0.1:3210, seeded via
  `seed:setup`, no cloud data touched, no mail ever sent — no RESEND key) runs only
  on promotes to `prod` and on manual `workflow_dispatch` — not on every commit.
- **Green verify on `main`/`master` auto-deploys staging → https://dev.trackstage.app**
  (`deploy-dev.yml`, Worker `trackstage-dev`, built from `.env.staging` against the
  dev Convex deployment — a separate environment from prod's Convex; the backend
  itself is pushed by local `convex dev` sessions, staging deploys the Worker).
- **Promote to production:** `git push origin main:prod` (or `master:prod`). The push
  runs verify + the full e2e suite, and only then `deploy.yml` ships Convex prod →
  build → Worker → smoke. To release without the ~35-min e2e wait, put
  `[skip-gate]` in the promote's head commit message (verify still gates); manual
  `workflow_dispatch` on Deploy skips CI entirely and is the emergency escape hatch.

## Stack facts

TanStack Start v1 + Convex + shadcn/ui on **Base UI (not Radix — no react-hook-form
`form` component; use `field.tsx`)** + Cloudflare Workers via `@cloudflare/vite-plugin`.
Routes in `src/routes` (file-based; never edit `routeTree.gen.ts`). Convex wired through
`@convex-dev/react-query` in `src/router.tsx`. Add UI components with
`pnpm dlx shadcn@latest add <name>`.

## Working agreements

- Commit and push incrementally to GitHub (`main` is canonical; `master` mirrors it —
  `git push origin master master:main`). **Never add a Claude co-author trailer.**
- Keep this file updated when decisions, learnings, or scope changes land.
- Deep specs live in `docs/`; this file holds only the always-needed facts.
- **`pnpm prompts` after any stretch of work with Marko.** It discovers every Claude Code
  and Codex session belonging to this repo (project dir, worktree dirs, scratchpad dirs,
  `~/.codex/sessions` by cwd — no ids to register), regenerates `docs/memory/PROMPTS.md`
  (the verbatim corpus of every human prompt) and `docs/memory/SESSIONS.md` (the session
  inventory), then commits + pushes only if they changed. It **refuses to write** if any
  credential shape survives redaction or an unreviewed high-entropy run appears — that
  gate is the reason the corpus is safe in a public repo, so never bypass it.
  `pnpm prompts:check` = no-write drift check, `pnpm prompts:audit` = same plus a
  credential sweep of past revisions of those files. Both docs are GENERATED — edit
  `docs/memory/sessions.overrides.json` (notes/exclusions), never the docs themselves.

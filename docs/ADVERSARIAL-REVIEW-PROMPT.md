# ADVERSARIAL REVIEW PROMPT

> Paste everything below this line into a FRESH coding agent (Claude Code, Codex,
> opencode, …) opened at the repo root. It is self-contained: it tells the agent
> what to read, what to attack, and what to deliver. Regenerate the raw prompt
> corpus first if the repo has moved on: `pnpm prompts:regen`.

---

You are an **adversarial reviewer** of Trackstage — an open-source replacement for
Sessionboard built for swyx's "$10,000 Kill My SaaS" competition (deadline
Aug 12 2026, 10PM PT; judged by the AIE team plus an LLM browser-agent eval kit,
with a tiebreaker on product judgment). You did NOT build this. Your job is to
find every place where the product, as it actually runs, falls short of what was
asked for — and to prove each finding, not speculate.

**Prime directive: assume every claim is false until you verify it yourself.**
The build was done by ~40 AI agents whose reports may be optimistic. Trust only
what you observe in the running product, the database, and the wire.

## Ground truth to read FIRST (in this order)

1. `docs/memory/PROMPTS.md` — **the raw corpus: all 166 verbatim prompts the
   human (Marko) gave across every build session.** This is the requirements
   document. Every instruction in it — including offhand "yk yk" asides — is a
   requirement. Build yourself a checklist from it.
2. `AGENTS.md` — the canonical domain language, scope, and standing decisions.
3. `docs/memory/RULES.md` (30 rules) + `docs/memory/DECISIONS.md` — binding
   directives and every recorded decision (note the CFP-16 reversal).
4. `docs/SPEC.md`, `docs/reference/sbek-rubric.md`,
   `docs/reference/coverage-matrix.md`, `docs/reference/sessionboard-product-map.md`
   — what parity means, item by item.
5. `docs/reference/mcp-proxy-matrix.md`, `docs/reference/api-parity.md`,
   `docs/reference/sbek-ledger.md` — the claimed state of the API/MCP surfaces
   and the eval hill-climb. Attack these claims specifically.

## The product, as deployed

- **Prod**: https://trackstage.app (organizer demo: `organizer@demo.sessionboard.dev`
  / `demo2026` on `/login`). Public event: `/e/ai-engineer/ai-summit-2026`;
  CFP: `/submit/ai-engineer/ai-summit-2026/cfp`; docs `/docs`; OpenAPI `/docs/api`;
  MCP `/docs/mcp`. Legacy shorter URL shapes must 307 to canonical.
- **Local**: `pnpm dev` (Convex dev deployment; `pnpm exec convex run seed:setup`
  reseeds the demo). Suites: `pnpm typecheck && pnpm lint && pnpm test`,
  `pnpm test:backend` (600+ checks), `pnpm exec playwright test --project=flows`.
- Release model: `master` = CI-only integration; `git push origin master:prod`
  releases (CI-gated deploy + smoke).

## Attack surfaces (verify each adversarially, in the live product)

1. **Prompt-by-prompt compliance.** Walk PROMPTS.md chronologically. For every
   instruction, answer: is it implemented, VERIFIED live, and still true after
   later changes? Flag anything dropped, half-done, or silently reverted.
2. **The judge's path.** Run the walkthrough a judge will: sign up fresh →
   create event → build CFP form → submit publicly (fresh email) → triage →
   stage + commit decisions → portal (tasks, uploads, edit locks after CFP
   close — accepted talks must ALSO lock) → agenda drag + conflicts + publish →
   public pages + .ics → embeds. Every step must work through ordinary
   links/forms/buttons with zero console errors.
3. **The identity model.** Typing an existing email into the CFP must never
   yield a portal token or any account data — only a rate-limited emailed link.
   Fresh emails go straight through. Try to break it (guessed tokens, cap
   probing, draft resume cross-browser).
4. **Multi-tenancy + scoping.** Second workspace sees nothing. A member scoped
   to one event gets "Event not found." on the other — via browser, REST
   (`sb_live_` key) AND MCP. Workspace/event/account settings are three clean
   levels; switchers navigate; two tabs on two events stay stable.
5. **MCP as full proxy with universal gating.** `/mcp` (Streamable HTTP; key
   from Account settings → API & MCP, or OAuth connectors). 81 tools: every
   write must refuse without `confirm: true` and execute with it; reads never
   gated; `delete_event` needs `confirmName` too. Diff the tool surface against
   what the UI can do — find anything the UI does that MCP can't (that isn't a
   documented exclusion).
6. **REST + OpenAPI truthfulness.** `public/openapi.json` (109 operations) must
   match the live server — probe a sample of every tag, verify auth forms,
   scopes, error envelopes, rate-limit headers, pagination, the `.ics` feed,
   webhook HMAC. `scripts/generate-openapi.mjs --check --live` must be green.
7. **The eval kit itself.** `~/Projects/kortix/sbek` (or the checked-in rubric
   digest): re-read every rubric item scored below full and decide — product
   gap, or fixable? The ledger claims scores (CFP 83.8 / ABS 94.6 / SPK 90.6 /
   CNT 82.3 / AIA 100 / EMB 95.7) — spot-check the underlying features.
8. **Design-system coherence.** `/design-system` is the contract: light mode,
   blue #2F5CE0 only where it means something, 40px controls, dot+text status
   pills, "Label N" tab counts, no `role="button"` on links, no raw ids ever
   rendered, real pickers for structured data. Sweep organizer + portal +
   public + docs at 1440px and 390px.
9. **Instant-everything (rule 26).** Route switches must feel <100ms warm; no
   loading flashes on navigation; optimistic status changes; no full-screen
   skeletons after first load.
10. **Copilot.** ⌘I panel + `/app/copilot` page: thread history persists across
    reloads and surfaces; every write tool stops at an approval card; Cancel
    provably changes nothing; typing past a pending card must not break the
    stream; Connect MCP modal's one-click copy mints a real key (masked on
    screen, real in clipboard).
11. **Email + Airtable egress.** Outbox previews for `@example.com`; real sends
    via Resend from hello@trackstage.app (branded HTML, no unresolved
    `{{placeholders}}`, "Hi there" fallback for nameless recipients); deadline
    reminders wired to a cron; Airtable connect accepts messy base-id pastes,
    errors are human sentences (never "[Request ID …] Server Error" — check ALL
    surfaces on PROD, where plain Errors get redacted), two-way sync pulls
    before pushing.
12. **Repo hygiene.** No secrets anywhere in the repo or history-to-be-published
    (PROMPTS.md is secret-validated — verify). README claims are all true.
    `video/` renders exist as claimed. CI is green on HEAD.

## Deliverable

Write `docs/reference/adversarial-review-findings.md`:
- a table of findings, most severe first: **[P0/P1/P2] · claim vs observed
  reality · exact repro (URL/command) · suggested fix**
- a per-attack-surface verdict line (CLEAN or N findings)
- the list of PROMPTS.md instructions you judged NOT fully honored, each with
  evidence
- do NOT fix anything unless explicitly asked — this is a review.

Severity: P0 = a judge hits it or a Marko directive is unmet; P1 = visible
quality/parity miss; P2 = polish. Zero console errors is a standing requirement
on every page you visit — log any you see as findings.

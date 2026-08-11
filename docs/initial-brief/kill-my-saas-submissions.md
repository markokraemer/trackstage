# Kill My SaaS 1 — In-Depth Submissions Research

## The hackathon, in one paragraph

**Kill My SaaS 1** is a remote hackathon run by **swyx** (Shawn Wang — Latent.Space / AI.Engineer). The premise: his conference team was quoted **>$40k/year for Sessionboard**, an enterprise speaker/CFP/content-management SaaS they've never used and can't customize. As a small business owner, that felt shitty — so he put up **$10,000 cash** (plus a Latent.Space writeup) for whoever builds the best open-source replacement in a weekend. Any coding agent, any model, any stack; up to $500 in token reimbursement for valid attempts. Window: **Aug 8 → Wed Aug 12, 2026, 10PM PT**. ~645 "going" on Luma; 50+ actually started per swyx. Marko Kraemer (Kortix) was invited via the Luma link. Submissions are evaluated independently by the AIE team (not swyx), with a tiebreaker on subjective product judgment calls they'd actually use.

### Official materials (verified)

| What | URL |
|---|---|
| Luma event | https://luma.com/ls-06v7 |
| Competition brief (Google Doc) | https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/ |
| Walkthrough video | https://youtu.be/vUuK4Knl7oc |
| Contest Discord | https://discord.gg/XYXaapF4q |
| Official eval kit — swyx's "sbek" (llm-as-judge) | https://forge.smol.ai/swyx/killmysaas-evals |
| swyx launch tweet | https://x.com/swyx/status/2085995879966921177 |
| swyx idea tweet | https://x.com/swyx/status/2085517544795079014 |
| swyx eval-kit tweet | https://x.com/swyx/status/2086348591518585026 |
| Organized reference repo (Gene Kim) | https://github.com/realgenekim/kill-my-saas-reference |

### Required features (verbatim from the brief)

Primary features swyx wants from "an open source clone that YOU make (and keep)":

1. Custom call-for-speakers submission forms with conditional logic and category-based routing
2. Self-service speaker portal for bios, headshots, slides, and supporting documents
3. Automated, templated speaker communications, including reminders and calendar invites delivered directly to each speaker's own calendar (Gmail, Outlook, iCal) — swyx later clarified **.ics is sufficient**
4. Submission evaluation and scoring workflows — ~~optional AI-assisted review across multiple rounds~~ (AI-assisted review was struck)
5. Drag-and-drop schedule and agenda building, with automatic conflict detection across rooms and tracks, viewable by list, day, week, track, or room
6. Real-time dashboard showing which speakers still have outstanding onboarding tasks

Struck/optional (items 7–9, crossed out by swyx in the brief):
7. ~~Native one-way integration with Accelevents~~
8. ~~Resource and wiki pages within the speaker portal, including HTML embed support~~
9. ~~Embeddable, mobile-friendly speaker gallery and schedule itinerary~~

Bonus points: Cloudflare infra, Airtable persistence, speed/performance, an API, hosting on Forge instead of GitHub.

### swyx's Discord clarifications (collected by Gene Kim)

- **Calendar invites:** `.ics` good enough; include room details if known (usually no details on the initial invite, room assigned later).
- **Airtable:** read-only fine for now; read/write comes "for free" since you poll the source-of-truth anyway.
- **Users:** the team is non-technical event-production professionals — polish and real usability matter; the eval is partly "I put it in front of them and they actually use it."
- **Forms:** one CFP form with track options is fine; can create more after.
- **Accepted speakers:** may edit submissions after acceptance; lock-at-time is nice-to-have, not used.
- **General vs AIE-specific:** use common sense / product sense, but ask for specific flows and swyx will record a follow-up video.
- **Volume:** swyx expects "a lot of ppl will not put in serious submissions."

---

## The target SaaS: Sessionboard

[sessionboard.com](https://www.sessionboard.com/) — conference speaker, session, and content management. The brief points participants at these product lines: Call for Papers, Speaker Management, Abstract Management, Content Management, Conference Speaker Management, AI Agenda (basics only), Sessions List (sessions, speakers, agenda, schedule itinerary, speaker gallery), and optionally Speaker CRM. Public sandbox CFP page cited in the brief: `appv2.sessionboard.com/submit/ai-engineer-sandbox-event/b7d4d7cd-3012-45c2-9c08-a8ee9185182f`.

---

## All public submissions found

I searched GitHub (repo search across "kill my saas", "sessionboard", "sessionboard alternative", "killmysaas", "cfp killer", plus topic and date-filtered queries), X/Twitter, YouTube, and the official reference repo. **16 distinct public repos** were created in the hackathon window (Aug 7–13, 2026) that target this competition. They fall into four tiers: shipped product with live demo, substantial code but no public demo, planning/spec only, and a reference/eval-kit cluster. There is no public master submission list — swyx said a form would be sent via Discord, and the Discord itself is not publicly indexable — so this list is reconstructed from public GitHub activity and social posts.

### Tier 1 — Shipped products with live demos (the real contenders)

#### 1. CFP Killer — Gene Kim (`realgenekim`)
- **Product repo:** `cfp-sched-killer` — **appears private/not publicly listed** under realgenekim's account (only `kill-my-saas-reference` and `clj-surgeon` show as public). Gene's gist references the repo by name with 205 commits, 334 files, +118,926 / −12,923 lines.
- **Public reference repo:** https://github.com/realgenekim/kill-my-saas-reference — the brief, all 40 Sessionboard screenshots, walkthrough transcript, swyx's Discord clarifications.
- **Activity report (the gist you sent):** https://gist.github.com/realgenekim/863f20b8ea515ed8858a298f8e470e9d
- **Demo video (2:00 AM Mon Aug 10 checkpoint):** https://us02web.zoom.us/clips/share/OWmDtCWmQB2irAH_mh7Vpg — event + CFP creation, then review-committee judging.
- **Stack:** Clojure 1.12 on http-kit / Ring / Reitit, Hiccup server-rendered HTML, Datastar for reactive signals/SSE fragments (not an SPA), Malli validation, Guardrails function-boundary checks, append-only domain events, PostgreSQL via next.jdbc/HoneySQL/HikariCP, Cloud SQL IAM auth, GCS for recovery, Jib → Cloud Run. REPL/nREPL-driven dev, Kaocha + Ring mock tests, Python browser drivers for E2E.
- **Footprint at cutoff:** 18,217 lines runtime source (70 files) + 10,115 lines tests (32 files) + 5,530 lines resources + 28,111 lines docs (318 screenshots/PDFs/videos). 205 commits.
- **Weekend scale (per his gist):** 48.9 hrs, 38 main coding conversations + 25 Claude subagents, 3.84B model-usage tokens (1.84B Codex + 2.00B Claude), 307 commits / 627 files / +149,059 −19,992 across 19 repos. Live Dictation (Groq, "Marvin") was used as a hands-free steering device: 397 finalized utterances, ~4h10m active recording. He ran a parallel agent fleet with call signs CFP1/CFP2/CFP3C/CD1/CLJ-SURGEON.
- **Differentiator:** by far the most documented build — a full activity report with method-and-honesty-boundaries, instrumented telemetry, and a verifiable commit ledger. The product spans the whole loop: form → speaker submission → evaluation → decision → schedule → public program, with event-scoped committees, speaker ownership, cross-event authz fences, API keys, append-only history/replay, Postgres durability, GCS recovery, live Cloud Run deploys.
- **Status:** serious contender; product repo not yet public at time of research.

#### 2. conference-engine — agrim singh (`agrimsingh`)
- **Repo:** https://github.com/agrimsingh/conference-engine — TypeScript, 3,811 KB, last commit Aug 10.
- **Live product:** https://conference-engine.65labs.org — create a real event from the homepage.
- **Read-only demo:** /demo · **Compare/self-host:** /compare (vs Sessionboard/Sessionize, what they skip, deploy sketch) · **Parity map:** PARITY.md (brief requirements → live routes).
- **Description:** "Program tool: CFP → review → speakers → schedule. Sessionboard alternative on Cloudflare." Flow: Event → CFP → Submission → Review → Decision → Notify → Speaker tasks → Agenda slot → Published schedule. Staging a decision is separate from emailing it; the submissions board keeps "to notify" apart from "notified." Admin "program cockpit" surfaces unreviewed work, undecided proposals, people waiting on email, incomplete speaker tasks.
- **Differentiator:** built for organisers mid-cycle with hundreds of submissions; explicit Sessionboard/Sessionize comparison page; one of the more product-minded entries.
- **Status:** swyx confirmed agrim as a participant (`@SherryYanJiang and i are on it`). Shipped, live, Cloudflare-native.

#### 3. OpenRostrum — `openrostrum`
- **Repo:** https://github.com/openrostrum/openrostrum — TypeScript, 5,960 KB, last commit Aug 10. CI badge, MIT license.
- **Site:** https://openrostrum.com
- **Description:** "The open-source Sessionboard alternative. Conference speaker, session, and program management — free, self-hostable, and yours to keep."
- **Coverage:** CFP (multi-step form builder with conditional logic, participant roles, close dates), submission review (approve/maybe/deny, reviewer routing), agenda builder (drag sessions onto day × room grid, conflict detection, one-action auto-place), speaker portal, comms. The README leads with the agenda-builder screenshot.
- **Differentiator:** strongest "branded product" framing of the field — own domain, logo, CI, MIT license, deploy-your-own docs. Reads like it intends to outlive the hackathon.
- **Status:** shipped, live, self-hostable.

#### 4. Greenroom — farishussain (`farishussain`)
- **Repo:** https://github.com/farishussain/greenroom — TypeScript, 2,116 KB, last commit Aug 9.
- **Live demo:** https://greenroom.greenroom.workers.dev — no sign-in, real event loaded. Guided 7-min walkthrough at docs/walkthrough.md.
- **Stack:** Next.js on Cloudflare Workers, D1 database. "Built for the edge — every schema decision is made for indexed, paginated, edge-cached reads."
- **Coverage:** CFP, review, schedule, with a notable conflicts view that catches speaker double-bookings (room clashes + speaker clashes), and "(assumed)" markers for inferred end times.
- **Differentiator:** explicitly performance/speed-focused (the product it replaces "is slow, and that is the whole reason it is replaceable"); the conflicts view is the hero feature.
- **Status:** shipped, live, Cloudflare-native. The original "Greenroom" — 4 other entrants independently chose the same name (see below).

#### 5. Greenroom — brendanhogan (`brendanhogan`)
- **Repo:** https://github.com/brendanhogan/greenroom — TypeScript, 441 KB, last commit Aug 10.
- **Live demo:** https://greenroomplanner.com
- **Coverage:** CFP form builder (6-section wizard: submission setup, welcome, abstract Qs, participant Qs, form settings, notifications; custom fields, locked system fields, library fields, conditional visibility, close dates, per-user submission limits, custom success pages, per-form confirmation emails, admin alerts, duplicate & copy-link), public submission flow (Welcome → Account → Submission → Participants → Review; server-side validation, drafts, withdraw), abstracts queue with status pipeline.
- **Differentiator:** most detailed form-builder coverage of any entry; named the challenge explicitly (links swyx's tweet).
- **Status:** shipped, live, own domain.

#### 6. Greenroom — Viraj0518 (`Viraj0518`)
- **Repo:** https://github.com/Viraj0518/greenroom — TypeScript, 458 KB, last commit Aug 8.
- **Live demo:** https://greenroom-dev.pages.dev — Organizer login `demo@greenroom.dev` / `greenroom-demo`; magic-link speaker portal; public CFP form; speaker embed; schedule embed.
- **Coverage:** all 9 requirements explicitly mapped to routes — form builder with JSON `showIf` conditions, category auto-routing to tracks, magic-link portal, file uploads, task checklist.
- **Differentiator:** only entry that ships both speaker-gallery and schedule **embeds** (one of the struck/optional requirements) on a live demo.
- **Status:** shipped, live, Cloudflare Pages.

#### 7. Greenroom — kirin765 (`kirin765`)
- **Repo:** https://github.com/kirin765/greenroom — TypeScript, 346 KB, last commit Aug 9.
- **Live demo:** https://greenroom.kwan765.workers.dev — admin `admin@greenroom.demo` (magic link shown on-screen in demo mode).
- **Stack:** Cloudflare + Airtable (the two bonus-point picks).
- **Coverage:** full 9-row requirements table mapped to features (multi-step form builder with show-when logic, close date + submission limits; passwordless portal with R2 uploads + file requests; templated comms + calendar invites; etc.).
- **Differentiator:** the only entry that explicitly hits the Airtable bonus and the Cloudflare bonus together and maps all 9 requirements publicly.
- **Status:** shipped, live, Cloudflare + Airtable.

#### 8. Greenroom — yogesh-dhande (`yogesh-dhande`)
- **Repo:** https://github.com/yogesh-dhande/greenroom — TypeScript, 908 KB, last commit Aug 9. No public demo homepage listed.
- **Coverage:** public CFP forms (form builder with short/long text, choice, file, co-speaker fields, `showIf` conditional logic), track-based review routing (reviewers own tracks), review & decisions (approve/maybe/deny, request changes mid-review, personal feedback attached to accept/waitlist/decline email), automatic accept… Full spec at spec.md, decisions at decisions.md.
- **Differentiator:** most explicit about the review-routing model (reviewers own tracks → scoped queues, no separate routing engine) and the "request changes mid-review" loop.
- **Status:** substantial code, no public demo found.

#### 9. SpeakerOps — SteveMLC (`SteveMLC`)
- **Repo:** https://github.com/SteveMLC/speakerops — TypeScript, 735 KB, last commit Aug 10. Topics: call-for-papers, cfp, cloudflare-d1, cloudflare-workers, conference, event-management, hono, open-source-alternative, speaker-management.
- **Live demo:** https://speakerops.speakerops-go7.workers.dev — public demo passcode `speakerops-judge-2026` (deliberately public, not a credential).
- **Stack:** Cloudflare-native — one Worker serves API + app, D1 for operational data, R2 for speaker assets, idempotent Airtable mirror pushes the operational record into the organizer's base.
- **Coverage:** "CFP to published agenda, without the enterprise tax." CFP forms with conditional logic, proposal decisions, acceptance-to-session flow, drag-and-drop agenda with live conflict detection, speaker portal with real file uploads, templated comms with calendar invites, embeddable public schedule/session/speaker pages. README includes a 5-minute guided tour table.
- **Differentiator:** only entry that hits Cloudflare + R2 + D1 + Airtable mirror + embeds in one cohesive deploy, with a deliberate public-judge passcode design.
- **Status:** shipped, live, Cloudflare-native, hosted on Forge (the listed target is forge.smol.ai).

#### 10. OpenSession — remorses (`remorses`)
- **Repo:** https://github.com/remorses/opensession — TypeScript, 21,288 KB (large — includes assets/OG images), last commit Aug 10. **2 stars** — the only entry with any stars.
- **Description:** "Open-source SessionBoard alternative: CFP forms, abstract review, agenda builder, speaker portal. Runs on Cloudflare Workers + D1."
- **Status:** shipped; README 404s on main/master so the public surface is thin, but the repo is large and active. Worth a direct look.

#### 11. sie-sessionboard — superlinked (`superlinked`)
- **Repo:** https://github.com/superlinked/sie-sessionboard — JavaScript, 38 KB, last commit Aug 10.
- **Stack:** built on [SIE](https://github.com/superlinked/sie) (superlinked's encode/score/extract/generate primitives). Server-rendered on purpose ("real links, real `<form>`s, real `<button>`s — the eval kit's browser agent can drive every flow without synthetic-handler guessing").
- **SIE integration:** auto-tagging abstracts (extract, `urchade/gliner_multi-v2.1`), similar-submission detection for reviewers (encode+cosine, `all-MiniLM-L6-v2`), semantic session search (planned, MiniLM + bge-reranker), AI agenda assistant (planned, deterministic packer + optional generate). Degrades gracefully without the SIE server.
- **Differentiator:** the only entry that integrates a retrieval/semantic-search stack and explicitly targets swyx's `sbek` eval-kit browser agent ("graded with swyx's sbek eval kit"). Reads like a superlinked team demo of SIE applied to a real product.
- **Status:** shipped, runnable (`npm install && npm start` → :3050), eval-kit integrated.

### Tier 2 — Substantial code, no/unclear public demo

#### 12. ManageMyConference — adityak6798 (`adityak6798`)
- **Repo:** https://github.com/adityak6798/ManageMyConference — TypeScript, 182 KB, last commit Aug 10 ("Merge pull request #11... identity-events-foundation"). Internally named "Project Greenroom" (yet another Greenroom).
- **Stack:** React + Hono, Zod validation, D1 persistence, correlation-aware error envelope. Repo "organized as an agent-readable context graph" (AGENTS.md, docs/README.md, prototype.html).
- **Coverage:** first vertical slice proven — "authenticated organizer creates an event through React and Hono, Zod validates the contract, D1 persists it." Full lifecycle claimed: CFP, review, speakers, agenda, comms, CRM, public publishing.
- **Status:** in progress; vertical slice shipped, full lifecycle not yet.

#### 13. Open Speaker Operations — ChaiWithJai (`ChaiWithJai`)
- **Repo:** https://github.com/ChaiWithJai/open-speaker-operations — Python, 2,772 KB, last commit Aug 10 ("Accept both valid reviewer smoke states (#71)"). 71 PRs — high activity.
- **Approach:** "Open-source planning and implementation baseline for replacing the speaker/program-management subset of Sessionboard." Architecture = a Pretalx plugin + a disclosed modular monolith; PostgreSQL authoritative, Redis for cache/queue, external writes via explicit integration adapters.
- **North star:** "win with a demoable journey." Protected path: CFP → review → acceptance → onboarding → conflict-aware release → public output → synchronization proof. "Subordination rule: demoable journey first. Anything not reachable in the seeded judge journey does not count as complete."
- **Differentiator:** the only entry built as a Pretalx plugin, and the most process-disciplined (decisions/failures/recovery visible through git, logs, tests, context graph).
- **Status:** heavy planning + architecture; smoke tests shipping (reviewer smoke states).

### Tier 3 — Planning/spec only

#### 14. Kill My SaaS — VasuBansal7576 (`VasuBansal7576`)
- **Repo:** https://github.com/VasuBansal7576/kill-my-saas — 0 KB, last commit Aug 9 ("Add project README"). Only a README.
- **Content:** "Open-source, production-grade conference-program operating system covering the complete lifecycle from call for speakers to a published agenda." Status: "Product research and architecture are complete. Application implementation has not started yet." Planned V1: event setup → CFP → submissions → reviews → decisions → speaker onboarding → content collection → scheduling → public program.
- **Status:** spec only; no code. Counts as an "attempt" for reimbursement purposes per the rules, but not a competitive submission.

#### 15. KMS — premhiru (`premhiru`)
- **Repo:** https://github.com/premhiru/KMS — 0 KB, last commit Aug 8 ("Initial commit"). README: "KMS — Kill my SaaS".
- **Status:** placeholder only; no code.

### Reference / eval-kit cluster (not submissions, but part of the ecosystem)

- **realgenekim/kill-my-saas-reference** — Gene Kim's organized reference: brief.md, video-walkthrough.md, swyx-clarifications.md, 40 screenshots. Not a submission; a participant aid for everyone.
- **swyx/killmysaas-evals** (on SmolForge, not GitHub) — swyx's official "sbek" eval kit: "llm as judge smoke test for killmysaas competitors to validate user flows." Shipped Aug 9 per swyx's tweet. superlinked's sie-sessionboard is the only submission that explicitly integrates with it.

---

## Notable context from the social trail

- **swyx (Aug 9):** "i still think @AnthropicAI ultracode is one of the most important coding mode innovations ever invented… just met a Kill My SaaS competitor who did a pretty good submission in 3 ultracode prompts." — implies at least one strong submission was made very quickly with Anthropic's Ultracode mode; identity not disclosed publicly.
- **swyx (Aug 9):** shipped the first llm-as-judge evals ("people can run this to check if their solutions at least pass the sniff test").
- **Alex Lazar (YouTube, Aug 9):** "Swyx's 'Kill My SaaS' Hackathon, Day 2" — a build-in-public vlog; notes "some have already had real output, even submissions. Kinda crazy imho." He was working on his own entry, favoring fewer features but a more reliable product. (Day 2 video: https://www.youtube.com/watch?v=5BV6b8y3dTY)
- **agrim singh (Aug 8, reply to swyx):** "@SherryYanJiang and i are on it" — confirms agrimsingh/conference-engine is a real entry.
- **Digg coverage:** "Swyx Proposes Hackathon to Clone Enterprise SaaS" — combined 38K views on the two swyx posts.
- **The "Greenroom" name cluster:** 5 independent repos (farishussain, brendanhogan, Viraj0518, kirin765, yogesh-dhande) plus adityak6798's internal "Project Greenroom" name — striking convergence on the same name, none are forks of each other (all `fork: False`, no parent/source).

---

## How to read this list

- There is **no public master submission list** — swyx said a form would be sent via Discord, and the Discord (`discord.gg/XYXaapF4q`) is not publicly indexable. This list is reconstructed from public GitHub repo search (date-filtered to Aug 7–13, 2026), X/Twitter, YouTube, and the official reference repo. Submissions that exist only as a filled-out form + private repo + private deploy would not appear here.
- "Shipped with live demo" (Tier 1) is the strongest signal of a real, evaluable submission. Tier 2 has real code but no public demo. Tier 3 is intent-only.
- Gene Kim's CFP Killer is the most-documented build but its product repo (`cfp-sched-killer`) is not publicly listed under his account at research time — only his reference repo and the activity-report gist are public. The demo video and the gist are the public surface.
- The 5 Greenroom repos are independent submissions that happen to share a name — they are not forks and have different stacks, demos, and feature emphasis.
- swyx's eval kit (sbek) is the sniff test; superlinked's sie-sessionboard is the only entry that publicly integrates with it.

---

## Summary table

| # | Name | Author | Repo | Live demo | Stack | Status |
|---|---|---|---|---|---|---|
| 1 | CFP Killer | realgenekim (Gene Kim) | cfp-sched-killer (private) + kill-my-saas-reference (public) | Zoom clip | Clojure, http-kit/Ring/Reitit, Datastar, Postgres, Cloud Run | Shipped, heavily documented; product repo not public |
| 2 | conference-engine | agrimsingh | agrimsingh/conference-engine | conference-engine.65labs.org | TypeScript, Cloudflare | Shipped, live |
| 3 | OpenRostrum | openrostrum | openrostrum/openrostrum | openrostrum.com | TypeScript, MIT | Shipped, live, branded product |
| 4 | Greenroom | farishussain | farishussain/greenroom | greenroom.greenroom.workers.dev | Next.js, CF Workers, D1 | Shipped, live |
| 5 | Greenroom | brendanhogan | brendanhogan/greenroom | greenroomplanner.com | TypeScript | Shipped, live |
| 6 | Greenroom | Viraj0518 | Viraj0518/greenroom | greenroom-dev.pages.dev | TypeScript, CF Pages | Shipped, live + embeds |
| 7 | Greenroom | kirin765 | kirin765/greenroom | greenroom.kwan765.workers.dev | TypeScript, CF + Airtable | Shipped, live |
| 8 | Greenroom | yogesh-dhande | yogesh-dhande/greenroom | none found | TypeScript | Substantial code, no demo |
| 9 | SpeakerOps | SteveMLC | SteveMLC/speakerops | speakerops.speakerops-go7.workers.dev | TypeScript, CF Workers + D1 + R2 + Airtable | Shipped, live, Forge-hosted |
| 10 | OpenSession | remorses | remorses/opensession | unclear | TypeScript, CF Workers + D1 | Shipped, 2 stars |
| 11 | sie-sessionboard | superlinked | superlinked/sie-sessionboard | local :3050 | JS, SIE (semantic search) | Shipped, sbek-integrated |
| 12 | ManageMyConference ("Project Greenroom") | adityak6798 | adityak6798/ManageMyConference | none | React + Hono + Zod + D1 | Vertical slice, in progress |
| 13 | Open Speaker Operations | ChaiWithJai | ChaiWithJai/open-speaker-operations | none | Python, Pretalx plugin + monolith, PG + Redis | Heavy planning + smoke tests |
| 14 | Kill My SaaS | VasuBansal7576 | VasuBansal7576/kill-my-saas | none | — | Spec only, no code |
| 15 | KMS | premhiru | premhiru/KMS | none | — | Placeholder only |
| — | kill-my-saas-reference | realgenekim | realgenekim/kill-my-saas-reference | — | — | Reference aid (not a submission) |
| — | killmysaas-evals (sbek) | swyx | forge.smol.ai/swyx/killmysaas-evals | — | llm-as-judge | Official eval kit (not a submission) |

**Total: 15 distinct public submissions + 2 ecosystem repos.** swyx's undisclosed "3 ultracode prompts" submission and any private-repo entries are not in this list.

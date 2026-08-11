# Standing rules from Marko (procedural memory)

Directives given during development. These are binding until changed. Newest last.
Agents: read this before working; add new directives the moment Marko states them.

1. **Stack**: TanStack Start + Convex + shadcn/ui — confirmed "full CONVEX", "CONVEX,
   NEXTJS, SHADCN UI" then switched Next.js → TanStack Start after in-depth evaluation.
   Use latest stable everything. Base UI is the shadcn base (not Radix).
2. **Monorepo verdict**: no monorepo — one full-stack app ("it's all just one full-stack
   app anyhow"). (He generally likes monorepos; this project is the exception.)
3. **UX/UI is the top priority**: non-technical, organizer-friendly, very simple,
   understandable, clear user flows. "Less is more." Match Sessionboard's structure,
   indentation, style from the 42 screenshots ~1:1. **Light mode by default.**
   Proper component pickers everywhere (real calendar/date pickers, selects, etc.).
4. **Functionality completeness**: "we can't miss a single thing" — cover the full spec;
   form builder matched "in great capacity".
5. **Video is source of truth**: processed via OpenRouter `google/gemini-3.6-flash`
   (Marko chose the model) — full transcript + visual cues + usability. Re-run passes
   through the same route when deeper video context is needed.
6. **Git flow**: GitHub repo, commit + push incrementally ("so we have incremental
   progress"). **Never add a Claude co-author trailer.** Repo: markokraemer/sessionboard.
7. **AGENTS.md + docs/ are the centralized project memory** — episodic (build log),
   semantic (specs, domain facts), procedural (rules, workflows). Keep continuously
   updated; "it becomes a normal part of the development flow, also interacting back
   with the human."
8. **Orchestration**: be a hardcore orchestrator — use Workflow tool AND subagents,
   combined, heavily parallel ("let's move hard"). Opus + Sonnet 5 as workers, Fable
   for final passes / where needed.
9. **Hill-climb against sbek**: clone swyx's eval kit (done → `~/Projects/kortix/sbek`)
   and evaluate our build against it once a first pass is ready; iterate on score.
10. **Landing page**: build a really good, simple marketing landing for the project.
    CTAs: open source (GitHub), sign up / try demo, and a joke "Declare the winner"
    button that redirects to a $10k Stripe checkout link (Marko will supply the link;
    keep it a config constant). Landing is LESS important than product UX.
11. **Architecture**: "a perfect architectural sound project" — clean, well-structured
    code throughout; no shortcuts that compromise structure.
12. **Interaction style**: act and recommend rather than blocking on questions; surface
    judgment calls for veto; keep him posted at natural checkpoints.
13. **Nothing is sacred**: everything — data structures, UX/UI structure, components,
    architecture — can be refactored/revamped at any time. Always follow best
    engineering and UX/UI design practices; always aim for the best possible thing.
14. **The git repo is THE source of truth**: all context, rules, specs, learnings, todos
    live in the repo and are kept in constant sync. Anything Marko says that matters
    gets digested into the repo (RULES/TODO/DECISIONS/BUILD-LOG) immediately.
15. **Airtable sync is on the roadmap** (bonus points, can come at the end): one-click
    connect (API key + base) with one-way near-real-time mirror of submissions/
    speakers/sessions into the organizer's Airtable base — swyx's team fires Airtable
    automations "once a new row lands"; read-only mirror is explicitly enough per his
    Discord clarification. Idempotent upserts, cron + on-write.
16. **Work style**: ultra-think, ultra-work — divide across many subagents (Task tool)
    and Workflow runs in parallel; push many frontiers simultaneously. Track all of
    Marko's asks in TODO.md at repo root.
17. **shadcn-first components, always**: strictly adhere to Base UI + shadcn standards.
    ALWAYS import the shadcn component from `src/components/ui/*` as the base and
    modify/extend it in depth — never hand-roll a UI primitive that shadcn already
    provides. Applies to every agent working on UI; include it in every UI subagent
    prompt.
18a. **Opus 5 for all subagents** on this project (Fable for final passes where needed).
18b. **Shell structure matches the screenshots**: organizer app uses Sessionboard's
    3-tier structure — top bar (search + avatar), left sidebar with event context +
    grouped nav sections (section labels like "Program"), tinted page-header banner
    (~#EEF1FC lavender) per docs/ux/01 — while keeping our flattened, simplified item
    set. Homepage, organizer app, and speaker portal must each be proper, complete,
    and match the reference images' structure.
18c. **Better Auth end-to-end + enterprise multi-tenancy**: authentication is Better
    Auth via the official `@convex-dev/better-auth` component (TanStack Start guide) —
    email/password + the organization plugin. Organizations own events; members have
    roles (owner/admin/member); every organizer function authorizes via the authed
    user's org membership, never ad-hoc tokens. Speaker portal + evaluator magic links
    stay token-based by design (passwordless personas). Must be "100% enterprise-ready":
    full authn, multi-tenancy, roles, proper authz stack.
18d. **Launch-ready product, not a demo**: the goal is to actually kill Sessionboard —
    go way beyond what the video pitched. Follow swyx's requirements for structure and
    scope priorities, but authentication, multi-tenancy, platform architecture, and
    polish must be end-to-end launch-ready in every regard. Build like real customers
    sign up tomorrow.
18. **Design system is a first-class artifact**: maintain it properly and centralize the
    full brand in it. There must be a `/design-system` page laying out ALL components
    (every variant/state), the design tokens, and the brand: a custom logo (create one),
    colors, type. Everything brand-related lives centralized there.
    Brand section must include the complete asset kit: every logo variant (mark-only,
    full lockup, wordmark-only, mono/inverse), DOWNLOAD buttons for each as SVG and PNG,
    social-media profile asset (1:1), OG/banner asset, favicon sizes — everything we
    could potentially need, all generated from the single source component.
    **Font: Inter, deliberately** ("the boring font" — Marko's words, keep it). Headings
    may use tighter tracking/weight for character, but no font swap without his say-so.
18e. **All emails via Resend, perfectly handled** (key provided by Marko, set as
    RESEND_API_KEY on the Convex deployment): speaker comms (decisions, confirmations,
    reminders, .ics invites), workspace/member invites, and every email the full
    multi-tenant lifecycle requires (password reset etc.). Nothing may silently not-send:
    real recipients get real Resend emails; seeded @example.com demo recipients render
    as outbox previews (Resend would bounce them and pollute the demo). This is part of
    the spec — do not forget any email surface.
18f. **Landing page, enterprise grade**: rip sessionboard.com's landing structure and
    cover the same aspects at the utmost quality — custom graphics, platform screenshots
    (placeholders until real ones exist), clearly open source, Log in CTA, and "Buy now"
    as a $10k ONE-TIME fee — a joke/voluntary thing, copy should wink at it.
19. **Mandatory final reconciliation pass**: slice-per-agent parallelism will drift —
    different layouts, spacing, and interaction patterns per slice. Before ship, ONE
    agent reads and reworks the whole app end to end for coherent, standardized,
    top-notch UX/UI. Marko, up front: "you might end up with different ux/ui and
    layouts and things… one agent that does a final reconciliation pass that is just
    going to read and rework through everything." `/design-system` is the contract that
    pass audits against: every screen must reuse `src/components/shared/*` primitives
    (PageHeader, EmptyState, DataToolbar, StatusPill, DrawerShell, WizardShell), shadcn
    `src/components/ui/*` bases, and the tokens in `src/styles.css` — no bespoke
    one-off headers, pills, drawers, toolbars, or hardcoded hexes.

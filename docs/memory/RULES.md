# Things Marko circled as important (procedural memory)

Not hardcore laws — a distillation of the directives and preferences he flagged along
the way, kept current so agents work the way he wants. The full narrative of every ask
in order lives in [HISTORY.md](HISTORY.md). Newest last; amend the moment he says
something that matters, and soften/reverse entries when he changes his mind (keep the
trail visible).

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
    ~~Font: Inter, deliberately~~ **REVERSED 2026-08-11 (rule 20): Marko now hates
    Inter ("so super fucking basic… makes everything look boring"). New distinctive
    type system required.**
18e. **All emails via Resend, perfectly handled** (key provided by Marko, set as
    RESEND_API_KEY on the Convex deployment): speaker comms (decisions, confirmations,
    reminders, .ics invites), workspace/member invites, and every email the full
    multi-tenant lifecycle requires (password reset etc.). Nothing may silently not-send:
    real recipients get real Resend emails; seeded @example.com demo recipients render
    as outbox previews (Resend would bounce them and pollute the demo). This is part of
    the spec — do not forget any email surface.
18f. **Landing page, high quality but NOT too "enterprise-y"**: rip sessionboard.com's
    landing structure and cover the same aspects at the utmost quality — custom
    graphics, platform screenshots (placeholders until real ones exist), clearly open
    source, Log in CTA, and "Buy now" as a $10k ONE-TIME fee — a joke/voluntary thing,
    copy should wink at it. Keep the tone human and simple, not corporate; the LIVE
    DEMO entry points must stay prominent (organizer demo, speaker portal, submit a
    talk).
18g. **Full multi-tenant management UI — everything**: complete account settings,
    organization settings, user management, member management. Easy switching between
    organizations you belong to (workspace switcher in the shell, Better Auth session
    stays), manage everything for the active organization: rename it, invite/remove
    members, change roles, personal profile (name/password) via Better Auth. The whole
    spiel — nothing missing.
20. **New design language — distinctive, not "vibe-coded", chosen by Marko**: Marko:
    everything looks "very vibe-coding and very chatzian style"; he dislikes Inter. BUT
    (amended): stay corporate-standard, matching the software's vibe, and **KEEP the
    current design language for now** — build an EXPLORATION of a few concrete
    candidate languages (type pairings + feel) on /design-system for Marko to choose
    from; only after he picks do we roll it out. Components still adopted now:
    (a) exploration of distinctive type systems (no app-wide swap yet);
    **LEADING HYPOTHESIS (from his Luma screenshots): the current UX/UI is actually
    liked — it's just TOO BLUE ("maybe it's just too blue… that's why it's a bit too
    sassy"). Luma's direction resonates: simple, neutral-first, minimal chrome, accent
    used sparingly — but less playful, "boring business sauce". The exploration must
    star a "De-blued" candidate: identical structure, neutral gray chrome, blue
    reserved for primary actions/links/focus only.**
    **REFERENCE DECISION (final): ATTIO is the gold standard to heavily inspire from
    ("attio is the right company to take"), alongside Stripe; Juicebox is fine as a
    secondary; Mercury is OUT. Caveat: Attio can be "too minuscule in a lot of
    aspects" — take its calm neutral system and table craft, not its density. Unique
    accent still wanted (turquoise-adjacent family). Mobbin MCP is connected
    (mcp__mobbin__search_screens/flows/sections via ToolSearch) for pulling real
    Attio/Juicebox screens.**
    (b) **adopt interior.dev components/animations end-to-end** (https://www.interior.dev/docs
    — press-depth etc., "top tier, making the web less boring and more interactive") —
    go through ALL offered components and take over the core ones + their animations
    "to add some pep"; (c) landing page gets a really, really creative UX/UI pass
    (Fable-grade) using these; (d) **right-click on the logo anywhere → /design-system**
    (the classic "download the logo" affordance); (e) **fix the inconsistent container
    widths across the site** — one consistent width system.
21. **Full MCP server + API — top-notch** ("quite important"; upgraded): a PERFECT MCP
    and API. Use all the latest AI-agent capabilities Better Auth offers (MCP/OAuth
    provider plugin, API-key plugin if it composes with the Convex component). MCP
    setup must be super simple and integrated for Claude, ChatGPT (connectors), Codex —
    "connect and it just works perfectly", edit everything from wherever. Counts toward
    the brief's API bonus.
22. **Attio revamp is a GO** (upgraded from exploration): "revamp the full design
    system to match it closely and make sure we are doing the same thing." From the
    real Mobbin screens: neutral near-white chrome (sidebar ~#FAFAFA, hairline
    borders), COLOR CARRIES DATA not chrome (soft multi-tint tag pills, status dots
    with labels), blue only on links/primary saves, quiet muted hierarchy. THE one
    caveat: Attio's items/clickables are too little — make everything A BIT LARGER
    (non-technical organizers use this). Rollout via the design-revamp step +
    reconciliation pass; exploration page still shows the candidates for the record.
23. **Correct hierarchy + three-level settings, top-notch UX for each**:
    User → member of → Workspace (organization; Better Auth user, our members/orgs
    tables) → owns → Events → contain everything else. Concretely:
    (a) MULTIPLE EVENTS are first-class: create "AI Engineer Summit", then another,
    switch between and manage them all — an EVENT SWITCHER in the shell's event
    context block (list + create), pages follow the selected event;
    (b) ACCOUNT/user settings live in the avatar menu next to Sign out (profile,
    password, personal API keys);
    (c) WORKSPACE/organization settings separate (rename, members, roles, switching
    between workspaces you belong to);
    (d) EVENT settings one level beneath (details, rooms & tracks) — clearly labeled
    as event-scoped. Never mix the levels; optimize how you manage everything.
    REFINEMENT (Marko): ACCOUNT settings render as a little MODAL (user-settings
    profile modal from the avatar menu — tabs: Profile / Security / API & MCP, which
    also resolves the api-mcp relocation); WORKSPACE and EVENT settings stay separate
    regular pages — more visual separation between the personal and org/event levels.
24. **AI copilot chat — the MCP's home** ("do whatever the fuck you want" surface):
    full AI chat built with the Vercel AI SDK + shadcn AI Elements chat components
    (state of the art), using OUR MCP server as its tool source — new session per
    user, query anything, control/steer everything. Available BOTH as a chat page and
    as a copilot side panel next to any screen in the app. Generative UI for tool
    results; PROPER APPROVAL FLOWS for every destructive MCP action (commit queues,
    deletes, bulk changes — confirm cards before execution). Fast model by default
    (OpenRouter, configurable later). Same component library as everything else.
25. **Landing = Attio's landing, 1:1 — THE core deliverable** ("one really good
    landing page and that should be the core thing"): "the attio landing page is
    beautiful. we can one-to-one take it over." Match the whole Attio vibe; SHOW THE
    ACTUAL PRODUCT: literally capture real product screenshots and GIFs via the
    Chromium browser MCP (drive the seeded app, record) and put them on the landing.
    Use the Mobbin MCP EXTENSIVELY for component references (look at screens visually,
    recreate as needed for the new design language). The AI chat surfaces there too.
26. **Hardcore real-time, everything instant**: latency must be perfect across the
    board. Convex reactive queries everywhere (no polling), OPTIMISTIC UPDATES on every
    mutation a user watches (status pills, drag-drop scheduling, toggles, autosave —
    UI echoes immediately, server confirms), route-loader preloading so navigation
    never flashes (skeletons only on true cold loads), instant input echo with
    debounced persistence. This is also the judged differentiator — swyx's #1
    complaint about Sessionboard is slowness. Measured at reconciliation: no visible
    wait on any common interaction.
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

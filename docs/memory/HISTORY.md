# Prompt history — everything Marko asked, in order

A distillation of every individual ask from the very beginning, top to bottom. This is
the narrative memory; RULES.md is the things circled as important along the way.

1. **Kickoff**: set up the base scaffold; check the competition brief for tech-stack
   guidance.
2. **Stack question**: is Cloudflare required, or can we use InstantDB / Convex /
   Supabase? Also: initialize with shadcn.
3. **"Yea let's go full CONVEX"** → then confirmed the trio: **Convex, Next.js, shadcn**.
4. **Proper shadcn init** with his preset (`b7BYM32MS`); asked which base is current —
   Base UI vs Radix vs Aria; he guessed (correctly) Base UI is the new standard.
5. **Monorepo**: he generally wants monorepos going forward, set up properly ("but
   sure") → later reversed: single full-stack app, no monorepo.
6. **Use latest everything** — whatever is up-to-date and best (thought Next 17 existed;
   16.3 was latest).
7. **Convex agent tooling**: read docs.convex.dev/ai pages; install ALL plugins —
   Claude Code, Codex, and the general ai-files — "make the way of working together the
   best possible".
8. Ran `pnpm dev:setup` himself (interactive Convex login); asked "are we all done now?"
9. **Pushback**: the assumed data structures felt premature ("we didn't even start
   development"); wanted `pnpm dev` running to try the frontend.
10. **Full ingestion directive**: watch the walkthrough video end-to-end via OpenRouter
    with **Gemini 3.6 Flash** (his model choice), read the brief HTML + all images in
    depth, build a complete project plan/map, then recreate the UX/UI matching the
    screenshots. Confirmed twice: must be gemini-3.6-flash via OpenRouter with visual
    cues; then asked for ONE big combined prompt (transcript + everything).
11. **Hardcore focus**: full video, full spec, miss nothing functionally; UX/UI is THE
    priority — non-technical, organizer-friendly, simple, clear flows, less is more,
    same structure as Sessionboard.
12. **1:1 UX copy**: same indentations, style, light mode default; proper component
    pickers (real calendars etc.); this organizer-friendliness is our differentiator
    (competitors aren't).
13. **Git flow**: init GitHub repo, commit+push continuously, never a Claude co-author;
    AGENTS.md as centralized continuously-updated context; create spec artifacts.
14. **Build everything end-to-end**: use Workflow tool + subagents (Opus/Sonnet 5
    inside, Fable for final passes), be a hardcore orchestrator; after first pass,
    hill-climb against swyx's eval kit; clone the Forge repo (sbek) preemptively.
15. **Landing page**: really good and simple; CTAs: open source, sign up/demo, and a
    joke "Declare the winner" → $10k Stripe checkout link (he supplies the link).
16. **Airtable sync** (from brief/clarifications): one-click connect, near-real-time
    one-way mirror; requirement ticked, fine to do at the end.
17. **Process**: ultra-think/ultra-work, many subagents + workflows in parallel; track
    everything in TODO.md; **git repo = source of truth for all context/rules/specs**.
18. **Nothing is sacred**: refactor anything anytime; best engineering + UX practices.
19. **shadcn-first strictly**: always import the shadcn component and modify it in
    depth; push this rule into all running subagents.
20. **Design system as artifact**: /design-system page with ALL components; custom
    logo; full brand centralized (later expanded: every variant, SVG/PNG downloads,
    social/OG/favicon assets).
21. **Screens must match images**: proper homepage, organizer app, speaker portal;
    shell structure per screenshots; **Opus 5 for all subagents**.
22. **Backend completeness + deterministic testing**: finish everything, verify all of
    it deterministically and fast (no manual web testing at that stage); let running
    agents complete.
23. **Better Auth pivot** (after a login hiccup): use Better Auth via the official
    Convex integration for EVERYTHING; full multi-tenancy, roles, proper authz —
    "100% enterprise-ready"; hardcore refactor. Asked why TanStack over React Router
    (satisfied: deliberate choice, Better Auth supports it).
24. **Launch-ready ambition**: actually kill Sessionboard — way beyond the video pitch;
    not a demo.
25. **Reconciliation rule** (added by him directly): one agent does a final
    read-and-rework pass over everything before ship; /design-system is the contract.
26. **UI e2e testing strategy** (after a MenuGroupContext crash): full deterministic
    `pnpm test` variants covering every flow top-to-bottom, deepest parts; combine with
    the sbek hill-climb; mirror the eval kit so it can't disappear.
27. **Resend everywhere**: his API key; ALL emails perfect — speaker comms, account/
    workspace invites, the full multi-tenant lifecycle; persist as spec.
28. **Landing v2**: rip sessionboard.com's structure, custom graphics, placeholder
    platform screenshots, log in + "buy now $10k one-time" (voluntary/joke), open
    source stated. Then amended: **not too enterprise-y**, human tone, live demo
    entries stay prominent.
29. **Housekeeping**: rename the brief folder into docs/ as the initial scrape.
30. **Multi-tenant completeness**: full account settings, org settings, user/member
    management, easy org switching — "everything, everything, everything". Then:
    reassurance that all core basics (create events etc.) work correctly.
31. **Design language evolution**: right-click logo → /design-system (brand-assets
    affordance); fix inconsistent container widths; he now dislikes Inter ("super
    basic"); adopt **interior.dev** components end-to-end (all of them, in depth,
    "top tier… less boring, more interactive") incl. press-depth on a really creative
    landing. Then amended: stay corporate-standard, **keep current language for now,
    build an exploration of candidates he picks from**.
32. **This document**: keep a full prompt history from A to Z (docs/memory/HISTORY.md);
    RULES.md stays but reframed — not hardcore rules, a distillation of what was
    circled as important.
33. **Design language convergence**: shared Luma screenshots — likes its simplicity
    but it's too playful; realized "maybe it's just too blue" about our current UI
    (which he otherwise likes). Briefly floated Mercury and Juicebox ("rip the entire
    feel in the deepest form") + a unique turquoise-adjacent accent. **FINAL: Attio is
    the gold standard to heavily inspire from** (with Stripe); Juicebox fine as
    secondary; Mercury out; Attio caveat — "too minuscule", take the system not the
    density. Mobbin MCP connected for real screen references.
34. **Full MCP server requirement**: complete MCP functionality for Sessionboard —
    operate everything from Claude/Codex/anywhere, auth via Better Auth, "connect and
    it will just work perfectly".
35. **Attio revamp GO + sizing**: shared the Attio Mobbin flows link — "revamp the
    full design system to match it closely… doing the same thing"; only dislike:
    items/clickables too little → make everything a bit larger (non-technical
    organizers). Mobbin MCP used for real screen extraction.
36. **MCP/API top-notch**: perfect MCP + API via Better Auth's latest AI-agent
    capabilities; super simple integrated setup for Claude, ChatGPT, Codex —
    connect from anywhere and edit everything.
37. **Hierarchy + settings IA**: multiple events must be first-class (create AI
    Engineer Summit, then another, manage/switch all); account settings live where
    sign-out is; differentiate User vs Organization vs Event settings levels with
    top-notch UX each; correct organizational structure throughout.
38. **Adversarial coverage audit**: keep rewatching the video + initial spec; take the
    stored full transcript and go through EVERYTHING adversarially — every single thing
    mentioned in the video, spec documents, and all public material must be covered
    flawlessly. Use Gemini 3.6 Flash as the evaluator — specifically via an opencode
    CLI agent configured with OpenRouter — comparing the video/spec against the actual
    live platform. Base requirements met perfectly.
39. **100% parity loop**: run in a loop until COMPLETE parity with the video + all
    criteria is verified — fully scalable, ready-to-launch Sessionboard competitor.
    Visually: remove clutter but don't overdo it — "things are already looking pretty
    good, stick to a lot of the things", keep pushing.
40. **Airtable sync promoted from stretch to build** (one-click connect, one-way
    idempotent mirror per swyx's clarification). And: sidebar hierarchy critique —
    "Setup > Events + Event settings" is entangled; refactor smooth and clean (event
    switching lives in the switcher; one clean Settings entry).
41. **Name: Trackstage (trackstage.app)** — Marko leaned trackstage ("that's the main
    point of it right?"), delegated final call; decided. Buy on Cloudflare, roll out
    everywhere (brand, Resend domain, OAuth issuer, README). Resend stays for outbound
    (Cloudflare has no sending service); CF handles DNS; infra config as scripts, no
    terraform (low demand is fine).
42. **Press-depth 3D button: optional, not forced** — "not really necessary… looks a
    bit odd" but "gives the whole thing a bit of depth on the landing". Keep on landing
    hero only where it works; don't force elsewhere.
43. **Copilot generative UI**: after first live use (listed + created a form) — every
    MCP tool call needs its own nice UX/UI using our actual components; panel draggable
    wider; research AI SDK generative-UI best practices; e2e in-chat experiences.
44. **shadcn official chat components**: pointed at the June 2026 shadcn chat
    changelog after seeing a bare composer — adopt the official chat set end-to-end
    as the copilot's foundation (with AI Elements only for AI-specific parts).
45. **Convex-max file storage**: beautiful file handling utilizing everything Convex
    file storage offers (upload/store/serve/delete/metadata) — seen via the empty
    Files tab; top-notch on top of the Better Auth stack.
46. **Instant everything**: hardcore real-time functionality — the whole latency
    story must be perfect; everything feels instant.
47. **Agenda drag-and-drop, as good as it gets**: works now — make it exceptional.
    Snapping into the grid in the best-designable way, visible snap targets, the lot.
48. **Account settings as modal**: user/profile settings become a small modal;
    workspace + event settings remain full pages — visual separation between levels.
49. **Copilot SOTA maxing**: research pure-play copilot libraries (assistant-ui,
    CopilotKit) and max/use them — sent down to the copilot agent.
50. **Workspace settings = org hub** (events listed inside, click-through to event
    settings) + **everything end-to-end tested**: multi-tenant invites, email arrival,
    submissions, forms, evaluation, agenda, speakers, all flows in depth, hill climb —
    "every single thing that comes to mind, done properly".
51. **Docs mandate**: Fumadocs docs site — hyper-simple user docs w/ screenshots,
    OpenAPI + Scalar API reference, MCP docs showing everything; every API action
    available via MCP too. Task-type dropdown confusion + full-page modal flagged
    (behavior explanations + dead "form" kind removal + proper dialog sizing).
52. **Landing trim + logo context menu**: landing still too complex ("way too much
    blah blah") — simplify and beautify; right-click logo should open a context menu
    (design system, downloads), not auto-redirect. Rename lands with the domain.
53. **Deterministic error hardening**: after a second MenuGroupContext crash — fix all
    client-side errors, add lint/strict enforcement to catch the whole class.
    (Shipped: DropdownMenuLabel hardened to plain div — crash class eliminated;
    nativeButton lint guard added + 37 violations fixed across 20 files.)
54. **API parity mandate**: dedicated agent to map Sessionboard's full API reference
    in depth and reach 100% parity on the program-side core (incl. custom fields,
    scopes); never degraded, improve where possible; feed structure into Fumadocs.
55. **API-implied UI parity**: re-emphasized end-to-end API parity AND full UI/UX
    implementation matching everything Sessionboard does in depth — the API reference
    treated as a feature census driving UI coverage, not just endpoint coverage.
56. **learn.sessionboard.com ingestion**: swyx posted more product walkthroughs
    (learn.sessionboard.com/videos/overview) + participant POV (/participants/overview)
    + organizer POV (/get-started/overview). Directive: run ALL walkthrough videos
    through the usual Gemini 3.6 Flash/OpenRouter analysis path (full transcripts +
    UX analysis), deep-crawl the product onboarding docs, and build an in-depth
    map of the actual software being cloned — full UX/UI understanding beyond the
    API reference. Feeds the parity loop.
57. **Loop + goal confirmed; frame-by-frame vision**: self-paced completion loop
    running with the 100%-parity goal as its stop condition; continuous product
    learning (API reference + all videos via Gemini 3.6 Flash) upgraded with
    frame-by-frame vision analysis of walkthrough videos. End state restated:
    full product-parity clone that just works — very UX-friendly, simple,
    intuitive, whole flow very clear.
58. **Landing trim (re-raised) + self-host docs**: remove slop incl. from the nav
    bar; less yap ("it already looks quite nice, so it's not bad" — trim, don't
    rebuild). Docs are important: keep them clear, and add a SELF-HOST page as the
    final, smallest docs item — docs stay mostly product docs + one how-to-self-host.

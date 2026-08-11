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

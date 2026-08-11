# Build log (episodic memory)

Newest entries at the bottom. Every work session appends what actually happened.

## 2026-08-11 ~01:00–01:45 — Scaffold
- Evaluated stacks (Next.js+OpenNext vs TanStack Start on Workers; Convex vs
  InstantDB/Supabase). Scaffolded TanStack Start via `pnpm dlx shadcn@latest init
  --preset b7BYM32MS --template start`; pinned floating `latest` deps.
- Wired Convex ↔ TanStack Query in `src/router.tsx`; Cloudflare via vite plugin;
  verified: build 400ms, worker serves SSR at 91ms TTFB (`wrangler dev` + curl).
- Convex dev deployment provisioned by Marko: `neat-sparrow-926` (eu-west-1).
- Convex agent tooling installed: Claude Code plugin, Codex plugin, `convex ai-files`
  (guidelines caught wrong index naming — all fields must be in index name).

## 2026-08-11 ~01:45–02:15 — Ingestion
- Video walkthrough processed 4× via OpenRouter `google/gemini-3.6-flash` (~54k video
  tokens/pass): transcript, actions, ui_fidelity, master (combined). → `docs/video/`
- 42 screenshots forensically spec'd by 5 Sonnet agents → `docs/ux/01…05`.
- Gene Kim's reference repo cloned; swyx clarifications + brief → `docs/reference/`.
- Wrote `docs/SPEC.md` (IA, screens, acceptance criteria, data model, build order).
- GitHub repo created (private): markokraemer/sessionboard; pushed.

## 2026-08-11 ~02:15 — Eval kit + build kickoff
- Cloned sbek eval kit from Forge → `~/Projects/kortix/sbek`. 98 rubric items,
  20 scenarios, 7 areas. Key insight: Public Widgets required (20%), Content Mgmt 15%,
  scoping/rule/handoff item types are the discriminators.
- Created docs/memory (RULES, DECISIONS, BUILD-LOG).
- Rewrote `convex/schema.ts` to SPEC §5 + rubric amendments (file versions/approvals,
  organizer auth tables, evaluators with magic tokens).
- Next: backend function contract inline → foundation UI agent → workflow slice fan-out
  → sbek hill-climb.

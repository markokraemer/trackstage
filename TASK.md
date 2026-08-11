# TASK.md — the live completion board + the loop itself

Single view of everything left open, and the loop that drives it to 100%.
Regenerate Marko's raw inputs anytime: `pnpm prompts:regen` → docs/memory/PROMPTS.md.
Detail lives in TODO.md; criteria in docs/memory/RULES.md (29 rules); this file is
the control panel.

## THE LOOP (running now, self-paced — pseudocode)

```
GOAL = every criterion in RULES.md + TODO.md + coverage-matrix.md + sbek-rubric.md
       verified · typecheck 0 · lint 0 · unit + backend + e2e green 3× consecutively
       · zero console errors on every route · deployed on trackstage.app · sbek run
       + findings fixed · docs/README current · only Marko-blocked items remain

while not GOAL:
    on agent_landed(work):            # task-notifications wake the loop instantly
        integrate(work)               # commit + push, reconcile TODO/TASK/BUILD-LOG
        relaunch_if_incomplete(work)
    if all_builders_landed():
        run_integration_gate()        # typecheck, lint, unit, seed+backend, e2e
        fix_failures()                # inline or spawn fix agents
        run_parity_workflow()         # Workflow tool: fan-out verify vs video +
                                      #   API reference + learn-site product map +
                                      #   sbek rubric → gap list → fix wave → rerun
        run_reconciliation()          # rule 19: one agent, whole-app coherence,
                                      #   instant-everything (rule 26), named backlog
        deploy_and_sbek()             # prod deploy verified → sbek eval → fix → rerun
    sleep(fallback_heartbeat=25min)   # events wake earlier
```

## RUNNING NOW (8 agents)

| Agent | Delivers |
| --- | --- |
| Deploy/CI-CD/rename | prod Convex+Workers on trackstage.app, GitHub Actions, Trackstage rename |
| Docs fixes | standalone API reference, fresh-account walkthrough shots, self-host page, clarity pass |
| Landing trim | nav cut to essentials, copy halved, less yap (structure/shots stay) |
| Copilot | shadcn chat foundation, 27+ generative tool views, draggable panel, SOTA patterns |
| e2e flows | 10-flow Playwright suite green 3× |
| API parity | Sessionboard API matrix + missing endpoints + custom fields + webhooks + UI census |
| Learn-site ingestion | all walkthrough videos (Gemini + frame-by-frame vision) + POV docs → product map + deltas |
| (watcher) | Resend verify done — hello@trackstage.app live |

## QUEUED (fires as dependencies land)

1. **UI fix wave** — from API-parity's "UI implications" census + learn-site deltas
2. **Integration gate** (task #1) — after all builders land
3. **Parity verification workflow** — Workflow-tool fan-out: independent verifiers per
   source (video claims, API reference, learn-site map, rubric areas) each checking the
   LIVE app; adversarial (assume uncovered until proven); merged gap list → fix wave;
   loop until dry
4. **Reconciliation pass** (task #3) — carries: account-settings modal, workspace hub,
   inline ✓/✕ approve-decline in submission rows, column-footer aggregations,
   At-a-Glance dashboard block, instant-everything measurement, copilot accent tiles,
   submissions right-column clip, SSR useRef fix, api-mcp→account move, stricter TS
5. **sbek hill-climb** (task #4) — on live trackstage.app; pilot run then full; fix;
   rerun until score stops improving
6. **Submission prep** (task #5) — README final, repo public flip, swyx's form,
   manual-verification checklist (.ics imports, email evidence)

## BLOCKED ON MARKO (only these)

- Airtable personal-access token + base ID → live sync e2e test
- Stripe checkout link → "Declare the winner" button
- At ship: flip repo public · fill submission form · go/no-go on paid full sbek run

## DONE (this session)

Scaffold+stack · full ingestion (video ×5 Gemini passes, 42 screenshots, brief,
clarifications, competitor research) · SPEC + memory system + PROMPTS corpus ·
backend (273-check suite) · Better Auth + multi-tenancy + hierarchy/settings ·
MCP server (31 tools, OAuth, live-fire tested) · AI copilot w/ approvals ·
interior.dev (45) · design language E shipped (de-blued + original blue, AA-verified,
flicker fixed) · Attio landing w/ real shots + GIF · Airtable sync built · file
storage maxed (orphan-free) · docs site (14 routes) · password reset e2e · email
stack complete on verified hello@trackstage.app · parity wave 1 (6 gaps) · audit
gaps 1–3 · agenda publish gate · error-class hardening + nativeButton lint guard ·
width system · brand kit + right-click context menu · README · CI/CD + prod deploy
(in flight) · trackstage.app configured · **agenda drag-and-drop excellence** (one
drag machine across Day/Week/Track/Rooms: snapped ghost, live time+column chip,
conflict pre-warning, keyboard DnD, edge auto-scroll, optimistic spring settle,
edge resize; 9/9 agenda e2e; GIF recaptured)

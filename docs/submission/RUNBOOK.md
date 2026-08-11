# Final-hours runbook — submission day (Wed Aug 12, deadline 10PM PT)

Ordered. Do them top to bottom; each step assumes the ones above it. Times are
suggestions — the hard constraint is the reseed → smoke → submit sequence happening
with nothing landing in between.

## 1. Decide the Convex plan (do this early — it changes behavior under load)

- The dev deployment has already brushed Free-tier limits during agent waves; the
  judging window will hammer **prod** (browser agents + MCP + the reactive websockets).
- Free tier throttles on function calls/bandwidth once exceeded — a throttled demo
  during judging is the worst-case failure and costs more than the plan does.
- **Recommendation: upgrade the prod deployment's team to Convex Pro before the
  judging window.** Dashboard → team settings → billing. Verify afterwards that
  `prod:keen-eagle-41` shows the Pro limits.
- If staying on Free: check the dashboard usage graphs NOW and again right after
  reseed; know the throttle risk is accepted.

## 2. Freeze and land (afternoon)

- [ ] Tell all agent sessions to land or stop. No pushes after the freeze except
      emergency fixes.
- [ ] `git status` clean on the working tree; everything committed and pushed to
      `master` + `main` (`git push origin master master:main`).
- [ ] CI green on `main`/`master` (e2e gate included): `gh run list --limit 5`.
- [ ] Promote: `git push origin main:prod` → wait for the full gate + Deploy to
      finish → prod is current.
- [ ] Note: https://dev.trackstage.app (staging) was not resolving as of Aug 11 —
      Deploy Dev kept skipping on cancelled CI runs. Either let one green run deploy
      it, or ignore it; it is not judge-facing. The README mentions it, so ideally
      one green run provisions the DNS before the repo flip.

## 3. Fresh prod reseed (RIGHT before the judging window / submission)

Exactly this, from the repo root:

```sh
pnpm exec convex run seed:setup --prod
```

- Purges agent/e2e residue and rebuilds the demo workspace, forms, submissions,
  agenda, portal tokens, outbox previews.
- **After this, nothing touches prod** — no agents, no manual poking beyond the
  smoke and evidence checks below.

## 4. Smoke + spot checks (immediately after reseed)

```sh
node scripts/smoke-production.mjs
```

- [ ] All checks green (SSR routes + /v1 + /mcp + OAuth discovery).
- [ ] https://trackstage.app/login — demo creds shown; sign in works
      (organizer@demo.sessionboard.dev / demo2026); dashboard has sane counts.
- [ ] https://trackstage.app/e/ai-engineer/ai-summit-2026 — first session card is
      "Opening keynote: the year AI engineering grew up"; no nameless speaker tiles.
- [ ] https://trackstage.app/submit/ai-engineer/ai-summit-2026/cfp loads step 1.
- [ ] ⌘I copilot answers one read-only question ("how many submissions are pending?").
- [ ] Run the real-inbox items you want evidence for — see
      `docs/submission/manual-verification.md` (they create data; do them from a
      throwaway address AND remember the judges see the outbox — keep it tidy, or
      reseed once more after evidence capture and re-smoke).

## 5. Repo public flip (Marko only)

Pre-flip, in this order:

- [ ] Secret scan the full history one last time:
      `gitleaks git . 2>/dev/null || pnpm dlx trufflehog git file://. --only-verified`
      (keys were only ever pasted in chat, never committed — verify that stays true).
- [ ] `.env.production` is intentionally committed (public values only) — confirm
      nothing secret crept into it or `wrangler.jsonc`.
- [ ] GitHub → repo Settings → Actions: set "Require approval for all external
      contributors" so fork PRs can't run workflows against the repo secrets once
      public.
- [ ] Flip: GitHub → Settings → General → Danger Zone → Change visibility → Public.

Post-flip:

- [ ] Open https://github.com/markokraemer/trackstage logged OUT (or incognito):
      README renders, screenshots + agenda GIF load, LICENSE shows MIT, Actions
      history looks sane.
- [ ] Click 3–4 README links (live app, film, docs, CFP) from the public page.

## 6. Submit the form (before 10PM PT — aim for hours earlier)

- Form link: **TBD — swyx posts it in Discord** (https://discord.gg/XYXaapF4q).
  <!-- PLACEHOLDER: paste the form URL here the moment it appears -->
- [ ] Repo URL: https://github.com/markokraemer/trackstage
- [ ] Live URL: https://trackstage.app (demo creds on /login; also paste them into
      the form: organizer@demo.sessionboard.dev / demo2026)
- [ ] Submission text: `docs/submission/SUBMISSION.md` (long form) and the sbek
      `evalconfig.json` submissionNotes (URL cheat-sheet for the browser agent).
- [ ] Mention: MCP connector URL is on /docs/mcp; API keys mint in Settings → API & MCP.
- [ ] Screenshot the submitted form confirmation.

## 7. Post-submission key rotation (same night — these were pasted in chats)

None of these are in the repo, but all of them transited chat sessions and agent
context windows. Rotate all four after submitting (the app must keep working —
update the stores listed):

| Key | Rotate where | Then update |
| --- | --- | --- |
| Cloudflare **global API key** | CF dashboard → My Profile → API Tokens → roll global key | Nothing in CI uses it (CI uses the scoped token) — used only by `scripts/configure-domain.mjs` locally |
| **Resend** API key | Resend dashboard → API Keys → create new, delete old | `pnpm exec convex env set RESEND_API_KEY <new> --prod` (and dev) |
| **Anthropic** API key (sbek runs) | console.anthropic.com → API keys | Local sbek env only (`~/Projects/kortix/sbek`) |
| **Airtable PAT** | airtable.com/create/tokens → regenerate | Re-connect the Airtable integration in-app if the demo connection should keep syncing |

Also worth rotating since they live in local envs that agents read:
`OPENROUTER_API_KEY` (Worker secret: `wrangler secret put OPENROUTER_API_KEY`, plus
the GH Actions secret) and the scoped `CLOUDFLARE_API_TOKEN` GH secret if paranoid.

## 8. Token-cost export (the $500 reimbursement — "will ask for proof")

- [ ] Anthropic: console.anthropic.com → Usage/Billing → export the date range
      (Aug 8–12) as CSV/screenshots — this covers Claude Code sessions + the sbek
      eval runs.
- [ ] Claude subscription (if Max was used for sessions): screenshot the plan — the
      brief explicitly counts codex/claude subscriptions as claimable.
- [ ] OpenRouter: openrouter.ai → Activity → export same range (copilot serving +
      the Gemini video-analysis pipeline).
- [ ] Sum into one line-item note (provider · period · $) and keep the artifacts in
      one folder — do NOT commit them.
- [ ] Reply to swyx's reimbursement thread with proof when asked.

## 9. Afterwards

- Leave prod untouched through the judging window. Watch Convex logs
  (dashboard → prod → logs) and Resend deliveries read-only.
- If something breaks mid-judging: `workflow_dispatch` on Deploy is the escape
  hatch (Actions → Deploy → Run workflow), and `seed:setup --prod` is the reset
  button — but a reseed mid-judging wipes whatever state the judge built. Last
  resort only.

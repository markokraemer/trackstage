# Manual verification checklist (pre-submission)

Things a browser agent cannot verify — do these by hand before submitting, and keep
the evidence (screenshots / forwarded emails) for the judges' manual-checklist pass.
Ordering and the full final-hours sequence live in `docs/submission/RUNBOOK.md`;
the rubric-item mapping lives in `docs/submission/sbek-manual-checklist.md`.

Everything UI-side is now auto-verified continuously: CI runs the complete Playwright
e2e flows suite hermetically on every push, and sbek rerun-2 (`2026-08-11T18-41-41`,
composite 93.6) auto-verified 8 of the original 21 manual rubric items. What's left
below is the out-of-band evidence: real inboxes, calendar imports, second accounts.

## Release gate (do this FIRST, right before submission + before any sbek run)

- [ ] `pnpm exec convex run seed:setup --prod` — purges any agent/e2e residue and
      rebuilds the demo. Let nothing touch the deployment afterwards.
- [ ] `node scripts/smoke-production.mjs` — all checks green.
- [ ] Open https://trackstage.app/e/ai-engineer/ai-summit-2026 — first session card is
      "Opening keynote: the year AI engineering grew up", speakers list has no
      duplicate/nameless tiles.
- [ ] https://trackstage.app/login shows the demo credentials
      (organizer@demo.sessionboard.dev / demo2026) and they sign in.

## Email egress (real inbox required)

- [ ] Submit a talk at https://trackstage.app/submit/ai-engineer/ai-summit-2026/cfp
      with a real email you control → submission confirmation arrives from
      hello@trackstage.app.
- [ ] Organizer → stage that submission to Accept Queue → commit the queue →
      acceptance email arrives, contains the portal link, portal link works.
      (Also run one through the Decline Queue — CFP-14 wants both captured.)
- [ ] Communications → pick a template → "Send myself a test" → arrives.
- [ ] Sign up a fresh account with a real email → the "confirm your email" banner
      shows in-app, the confirmation email arrives, and the link clears the banner
      (soft verification — signing in is never gated).
- [ ] Password reset from /login ("Forgot password") → email arrives, link resets,
      old password dead.
- [ ] Workspace → invite a second email → invite arrives → claim flow works.

## Calendar (.ics)

- [ ] Schedule the accepted talk (room + time) → speaker email with .ics attached →
      open the .ics in Apple Calendar or Google Calendar: correct title, time,
      timezone, room in location.
- [ ] Subscribe to https://trackstage.app/e/ai-engineer/ai-summit-2026/schedule.ics
      (or the /v1 feed) in a calendar app: all published sessions appear.

## Multi-account effects

- [ ] Two browsers: organizer commits a decision in one; the speaker portal in the
      other flips status without a reload.
- [ ] Second workspace account sees zero data from the demo workspace.

## Connectors

- [ ] Claude (or ChatGPT) → add custom connector → https://keen-eagle-41.convex.site/mcp
      (prod: the convex.site URL in Settings → API & MCP) → OAuth sign-in completes →
      "list my events" works. (Judges get this from /docs/mcp.)

## Submission form assets

- [ ] Repo public on GitHub (markokraemer/trackstage) — Marko flips (see RUNBOOK).
- [ ] README screenshots/GIF render on the public repo page; LICENSE (MIT) visible.
- [ ] submissionNotes text (sbek evalconfig.json) pasted into the form — and
      `docs/submission/SUBMISSION.md` is the long-form submission text.
- [ ] Live demo URL: https://trackstage.app · organizer demo login on /login.

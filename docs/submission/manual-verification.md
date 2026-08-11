# Manual verification checklist (pre-submission)

Things a browser agent cannot verify — do these by hand before submitting, and keep
the evidence (screenshots / forwarded emails) for the judges' manual-checklist pass.

## Release gate (do this FIRST, right before submission + before any sbek run)

- [ ] `pnpm exec convex run seed:setup --prod` — purges any agent/e2e residue and
      rebuilds the demo. Let nothing touch the deployment afterwards.
- [ ] `node scripts/smoke-production.mjs` — 9/9.
- [ ] Open https://trackstage.app/e/ai-summit-2026 — first session card is
      "Opening keynote: the year AI engineering grew up", speakers list has no
      duplicate/nameless tiles.

## Email egress (real inbox required)

- [ ] Submit a talk at https://trackstage.app/submit/ai-summit-2026/cfp with a real email you
      control → submission confirmation arrives from hello@trackstage.app.
- [ ] Organizer → stage that submission to Accept Queue → commit the queue →
      acceptance email arrives, contains the portal link, portal link works.
- [ ] Communications → pick a template → "Send myself a test" → arrives.
- [ ] Password reset from /login → email arrives, link resets, old password dead.
- [ ] Workspace → invite a second email → invite arrives → claim flow works.

## Calendar (.ics)

- [ ] Schedule the accepted talk (room + time) → speaker email with .ics attached →
      open the .ics in Apple Calendar or Google Calendar: correct title, time,
      timezone, room in location.
- [ ] Subscribe to https://trackstage.app/e/ai-summit-2026/schedule.ics (or the
      /v1 feed) in a calendar app: all published sessions appear.

## Multi-account effects

- [ ] Two browsers: organizer commits a decision in one; the speaker portal in the
      other flips status without a reload.
- [ ] Second workspace account sees zero data from the demo workspace.

## Connectors

- [ ] Claude (or ChatGPT) → add custom connector → https://keen-eagle-41.convex.site/mcp
      (prod: the convex.site URL in Settings → API & MCP) → OAuth sign-in completes →
      "list my events" works. (Judges get this from /docs/mcp.)

## Submission form assets

- [ ] Repo public on GitHub (markokraemer/trackstage) — Marko flips.
- [ ] README screenshots/GIF render on the public repo page.
- [ ] submissionNotes text (see sbek evalconfig.json) pasted into the form.
- [ ] Live demo URL: https://trackstage.app · organizer demo login on /login.

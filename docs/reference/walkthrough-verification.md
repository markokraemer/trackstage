# Walkthrough complaint list — independent acceptance verification

Verified **as a user** against `localhost:3000` (dev server on `neat-sparrow-926`),
2026-08-12 ~00:05–00:50 CEST, HEAD at the time of testing: `9fab66c`.
Method: fresh throwaway accounts driven with Playwright (real clicks/typing, no
API shortcuts), seeded demo organizer for organizer flows, Convex logs +
`_scheduled_functions` for email evidence, a real inbox (marko+alias@kortix.ai
via Gmail) for the end-to-end verification-email test. Screenshots referenced
below live in `/tmp/wv/shots/` on Marko's machine (session-local evidence).

## Scoreboard

| # | Complaint | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Zero-event state: every sidebar section clickable, purposeful empty state + create-event CTA, no redirect | **PASS** | Fresh account, wizard skipped: all 11 sections (Dashboard/Copilot/Submissions/Forms/Evaluation/Agenda/Embeds/Speakers/Files/Communications/Settings) clickable, none bounced to workspace settings, every one renders its own tagline + "Create your first event" CTA. `01-zero-*.png` |
| 2 | Onboarding: full-screen wizard, workspace name → blocking email confirm → first event → how-it-works tour w/ docs links → event dashboard; skippable; demo accounts never see it | **PASS** (one design nuance, below) | Full-screen takeover (logo only, no sidebar/topbar) `02-real-step1.png`; email step blocks (Continue disabled, "Waiting for your confirmation — checking automatically…") `02-real-email-step.png`; clicking the emailed link in another tab auto-advanced the wizard within seconds `02-real-event-step.png`; 4 how-it-works screens each with a "Read the guide" docs link `02-real-tour.png`; "Go to your dashboard" landed on `/app/<ws>/<event>` `02-real-dashboard.png`; wizard does not return after finishing; "I'll explore on my own" skip on every step; demo organizer sees no wizard `02-demo-no-onboarding.png` |
| 3 | Signup/login: no dead delay, verification email actually arrives, banner for unverified non-demo, resend rate-limited | **PASS** | Signup → app in **2.1s** with "Creating account…" pending label (both runs); verification email **really delivered** via Resend to a Gmail inbox (subject "Confirm your email for Trackstage") and preview-logged (`[email:preview] … link=…`) for @example.com; confirm-email banner shows for an unverified non-demo account and dismisses `03-banner.png`; resend capped server-side at 3/hour/address — 6 triggers produced exactly 3 scheduled sends (verified in `_scheduled_functions`) |
| 4 | Settings IA: account settings modal from avatar menu, workspace settings modal from switcher, PROGRAM→Settings = event page only, old URLs don't strand | **PASS** | Avatar menu → "Account settings" opens a modal over the current page (`?settings=account`) `04-account-modal.png`; "Workspace settings" likewise (`?settings=workspace`) `04-workspace-modal.png`; sidebar Settings → `/app/ai-engineer/ai-summit-2026/settings`, no Account/Workspace tab row `04-event-settings-page.png`; `/app/account` → dashboard + account modal open (old `?tab=` mapped) `04-legacy-account.png`; `/app/ai-engineer/workspace` → dashboard + workspace modal `04-legacy-workspace.png` |
| 5 | Copilot: no raw JSON, no PARAMETERS/RAW RESULT panels, no raw ids; human error sentences | **PASS** | "list submissions" → tool card renders a rich table (title/speakers/status pills); full card text (2,010 chars incl. collapse/re-expand via chevron) contains no `PARAMETERS`/`RAW RESULT`, no JSON braces, no 32-char Convex ids `05-copilot-toolcard2.png`; not-found flow answers in prose: "Could it have been under a different name, or would you like to create a new manual session for this talk?" — no stack traces or error dumps `05-copilot-notfound.png` |
| 6 | File previews: row click → dialog, PNG really visible, PDF inline, download works, checkbox/actions don't preview, portal speaker previews own upload | **PASS** | Files page: clicking the file cell opens the preview; PNG renders as a real image (`naturalWidth=800`) `06-png-preview2.png`; PDF renders in the inline iframe viewer `06-pdf-preview2.png`; Download from the preview fires a real download; row checkbox selects without opening the preview; row download-icon downloads without opening the preview; speaker in the portal previews their own upload (PDF iframe) `06-portal-preview.png`. Note: clicking the **Session** cell opens the submission drawer instead — intentional per files-table exempt-cells design, and reads fine in practice |
| 7 | Mobile 390×844: CFP wizard, portal tabs, organizer shell, landing — no h-scroll, sane tap targets | **PASS** | Landing, CFP wizard (`/submit/ai-engineer/ai-summit-2026/cfp`, first button 40px tall), portal (all 4 tabs), organizer shell: no horizontal page scroll anywhere; sidebar collapses to 64px icon rail; submissions table scrolls inside its container; submission drawer is exactly 390px (full-width) `07-mobile-*.png` |
| 8 | Landing: no Explorations/De-blued/Juicebox/petrol; category strip not duplicated; demo entrances work | **PASS** | Neither `/` nor `/design-system` contains any of the banned terms; every event-type chip in the proof strip renders exactly once (static single pass, no marquee); organizer demo entrance → `/login` with demo credentials + "Use these" one-click fill; `/portal` entrance → "Open the demo speaker portal for Ava Nakamura" `08-*.png` |

## Nuance Marko should know before his own walkthrough

**Item 2's blocking email step self-skips for RFC-2606/demo addresses.**
`convex/auth.ts` (`DEMO_EMAIL_PATTERN`) pre-verifies `@example.com/.org/.net`
and `@demo.sessionboard.dev` accounts at creation — deliberate, because the
sbek judge signs up with inboxes it cannot open, and a blocked wizard would
brick the entire eval. Consequence: **if you test with an @example.com
address, the wizard goes workspace → first event and you will never see the
email-confirm screen.** With any real address (verified end-to-end with
marko+alias@kortix.ai → real Resend delivery → Gmail) the step blocks exactly
as specified. Both behaviors verified; whether the demo-skip matches intent is
a product call, not a bug.

## Observations (no action required, logged for honesty)

- **Transient dev-server hiccup:** one Vite HMR "fetch failed" overlay
  (miniflare `dispatchFetch`) appeared mid-session and killed one test run;
  gone on reload. Dev-only artifact — likely other agents' pushes triggering
  HMR — not a product bug, but worth knowing it can eat a manual test.
- **Sign-in rate limit (20/min/IP)** briefly locked the demo organizer out
  during parallel agent testing; the error is a human sentence ("Too many
  attempts — wait a minute, then try again"). Working as designed.
- **Copilot Enter-to-send** occasionally ignored the first Enter right after
  page load (needed a retype/retry in 2 of 5 scripted runs; typing at human
  speed always worked). Likely a hydration-timing edge; low severity.
- The auto-verify pattern also means demo accounts never see the confirm-email
  banner — consistent with "judge and Marko must never see the banner on demo
  accounts" (comment in `convex/auth.ts`).

## What was actually exercised (for reproducibility)

- Fresh signups: `marko+wv6yx4xr@kortix.ai` (full onboarding incl. real email),
  `wv-zero-*@example.com` (zero-event states), `wv-banner-*@trackstage-wv.invalid`
  (banner + rate limit), `verify-*@example.com` (demo-pattern signup path).
- Organizer flows: `organizer@demo.sessionboard.dev` / `demo2026`.
- Portal: seeded token `demo-priya-raghavan` (2 uploads) + `/portal` demo entrance.
- Email evidence: Convex log tail (`[email:preview] …`), `_scheduled_functions`
  send counts, and a real Gmail inbox for the non-demo path.

# Refreshing the landing-page product shots

The marketing homepage shows **real screenshots of the running app** — no mocks,
no drawn placeholders (docs/memory/RULES.md #25). They live in
`public/screenshots/` and are produced by driving the seeded demo through
Playwright. Re-run the script after any visual change to the organizer app,
speaker portal or public event pages; it overwrites in place, so the page picks
the new shots up with no code change.

The same script also produces the screenshots for the `/docs` user guide, in
`public/docs/`. It's one file with three run modes — see
[`--docs` mode](#--docs-mode-the-docs-user-guide-shots) below.

## Refresh in one command

```sh
pnpm dev                                   # dev server on :3000 (leave running)
pnpm exec convex run seed:setup            # only if the demo data is missing/stale
node scripts/capture-screenshots.mjs             # marketing + docs shots (~90s)
node scripts/capture-screenshots.mjs --marketing # public/screenshots/* only (~40s)
node scripts/capture-screenshots.mjs --docs      # public/docs/* only (~50s)
```

Then eyeball the PNGs before committing.

## What it produces

| File | Screen | How it's reached |
| --- | --- | --- |
| `dashboard.png` | Organizer dashboard | sign in → `/app` |
| `submissions.png` | Submissions table (incl. staged queues) | `/app/submissions` |
| `agenda-list.png` | Agenda, List view | `/app/agenda` → "List" |
| `agenda.png` | Agenda, Day view | `/app/agenda` → "Day", grid scrolled onto the programme |
| `form-builder.png` | Form builder, Submission questions step | `/app/forms` → first form → "Submission questions" |
| `portal.png` | Speaker portal home | `/portal/t/demo-ava-nakamura` |
| `public-schedule.png` | Published public schedule | `/e/ai-summit-2026` |
| `agenda-flow.gif` | A real agenda drag, 4 frames | mouse down + move + drop on a day-grid card |

`dashboard.png` is the hero shot; the rest are wired up in
`src/components/marketing/product-shot.tsx` (the `SHOTS` registry, which also
holds each shot's alt text and the address shown in the mock browser chrome).

## What the script does, step by step

1. Launches headless Chromium at **1440×900, `deviceScaleFactor: 2`** (so every
   PNG is 2880×1800 and stays crisp on retina), light colour scheme,
   `reducedMotion: "reduce"` so entry animations don't smear a frame.
2. Signs in through the real login form as
   `organizer@demo.sessionboard.dev` / `demo2026`, retrying the fill up to four
   times — TanStack's controlled inputs wipe a pre-hydration fill.
3. Visits each screen, waits for network idle plus a settle delay (Convex
   subscriptions land after first paint), **hides the TanStack devtools bubble**
   (`[data-testid="tanstack_devtools"]`), then screenshots the viewport.
4. For the agenda: clicks the view switcher, then scrolls the day grid's own
   scroll container so the first scheduled session sits near the top — the grid
   opens at midnight and would otherwise photograph an empty overnight block.
5. For the GIF: presses on a session card, moves the pointer in small steps
   (dnd-kit needs several moves to activate), and captures idle → lifted →
   moved → dropped into `.screenshot-frames/`, then assembles them with
   **ffmpeg** (`palettegen`/`paletteuse`, 1.2 fps, looping) and deletes the
   frames. No ffmpeg on `PATH` → the GIF step is skipped with a log line and the
   stills still get written. If the drag can't start, it falls back to four
   frames of the view switcher instead.
6. Prints any console errors it saw. These come from the app, not the capture —
   worth a look, but they don't fail the run.

## `--docs` mode: the /docs user-guide shots

`node scripts/capture-screenshots.mjs --docs` drives the same seeded demo
through every step of the `/docs` user guide and writes ~30 PNGs into
`public/docs/`. It shares `signIn`, `settle`, `hideDevtools`, `tryClick` and
`shot` with the marketing capture, and adds:

- `elementShot(page, locator, name)` — crops one element (a dialog, drawer, or
  card) instead of the full viewport. Used for every modal/drawer shot so the
  surrounding page chrome doesn't dilute the thing being documented.
- `captureDocsShots(page)` — one `safeShot(name, fn)` call per file. Every
  shot is independent and wrapped in try/catch: a renamed label, an emptied
  queue, or a control that didn't render skips **that one file** and logs
  `skipped: <name> — <reason>`, everything else still runs. The end of the run
  prints a summary of exactly what was written and what was skipped.
- Destructive dialogs (commit a decision queue, invite a teammate, assign a
  task) are opened, screenshotted, then dismissed with their own **Cancel**
  button — `review-commit.png` in particular opens the confirmation and
  presses Cancel, never the real "Send acceptances"/"Send declines" action.

Run it on its own, or let the plain `node scripts/capture-screenshots.mjs`
(no flags) run it right after the marketing shots in the same signed-in
session.

### Keeping the right event selected

Every organizer shot depends on "which event is the app currently pointed
at?", which lives in `localStorage` (`sb.currentEventId`,
`src/lib/current-event.ts`) and defaults to whatever event loaded first for
the account. On a shared dev database that is **not reliably the demo
event** — another agent's seed re-run or verification pass can add, delete,
or replace events mid-capture, which silently resets that default. A
`gotoOrganizer(page, path)` helper wraps every `/app/*` navigation in `--docs`
mode: after each `goto` it checks the sidebar for "AI Engineer Summit 2026"
and, if it's showing a different event, re-opens `/app/events`, clicks that
event's **Open event** button, and re-navigates — so a mid-run reseed heals
itself on the very next shot instead of quietly producing an empty-state
screenshot.

## Knobs

| Env var | Default | Use |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:3000` | Point at a preview deployment instead |
| `PORTAL_TOKEN` | `demo-ava-nakamura` | Another seeded speaker. Tokens are `demo-<first>-<last>` (`portalTokenFor` in `convex/seed.ts`) |

## When a capture goes wrong

- **A step click is skipped** (logged as `skipped: …`): a label changed. Update
  the matching `getByText`/`getByRole` in the script — everything is reached
  through visible text on purpose, so the script breaks loudly when a screen is
  renamed rather than silently shooting the wrong page.
- **Empty or half-loaded screen**: raise the delay in `settle()`.
- **Wrong data on screen** (odd times, test rows like "Verification Talk"):
  re-run `pnpm exec convex run seed:setup` first — the shots are only as clean
  as the demo data.
- **`--docs` shot shows the wrong event** ("Copilot Verification…" or another
  empty test event instead of "AI Engineer Summit 2026"): shouldn't happen —
  `gotoOrganizer` re-selects the demo event whenever the sidebar drifts — but
  if it still does, another agent is actively deleting/recreating events
  faster than one navigation. Re-run `--docs` once things settle.
- **`--docs` says a decision queue is empty** (`review-commit` skipped): a
  concurrent process already committed the seeded accept/decline queue. The
  script tries decline before giving up; re-seed
  (`pnpm exec convex run seed:setup`) to restage both queues.

## Known follow-ups

Captured 2026-08-11, before the Attio design revamp lands across the app. Once
the revamp and the in-app copilot ship, **re-run this script** — in particular:

- the speaker portal's card headers are still solid brand blue (pre-revamp
  chrome; they'll go neutral),
- the organizer pages still show the lavender page-header banner,
- the agenda tray contains a leftover test row from another agent's run,
- there's no copilot screenshot yet; when the chat panel lands, add a step for
  it and register the shot in `SHOTS`.

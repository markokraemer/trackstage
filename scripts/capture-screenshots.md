# Refreshing the landing-page product shots

The marketing homepage shows **real screenshots of the running app** — no mocks,
no drawn placeholders (docs/memory/RULES.md #25). They live in
`public/screenshots/` and are produced by driving the seeded demo through
Playwright. Re-run the script after any visual change to the organizer app,
speaker portal or public event pages; it overwrites in place, so the page picks
the new shots up with no code change.

## Refresh in one command

```sh
pnpm dev                                # dev server on :3000 (leave running)
pnpm exec convex run seed:setup         # only if the demo data is missing/stale
node scripts/capture-screenshots.mjs    # ~40s
```

Then eyeball `public/screenshots/*.png` before committing.

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

## Known follow-ups

Captured 2026-08-11, before the Attio design revamp lands across the app. Once
the revamp and the in-app copilot ship, **re-run this script** — in particular:

- the speaker portal's card headers are still solid brand blue (pre-revamp
  chrome; they'll go neutral),
- the organizer pages still show the lavender page-header banner,
- the agenda tray contains a leftover test row from another agent's run,
- there's no copilot screenshot yet; when the chat panel lands, add a step for
  it and register the shot in `SHOTS`.

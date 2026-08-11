# Refreshing the landing-page product shots

The marketing homepage shows **real screenshots of the running app** — no mocks,
no drawn placeholders (docs/memory/RULES.md #25). They live in
`public/screenshots/` and are produced by driving the seeded demo through
Playwright. Re-run the script after any visual change to the organizer app,
speaker portal or public event pages; it overwrites in place, so the page picks
the new shots up with no code change.

The `/docs` user guide is narrated by a **different** script —
[`capture-walkthrough.mjs`](#the-docs-user-guide-capture-walkthroughmjs), which
builds a brand-new account and shoots one organizer's whole journey. This script
still produces the handful of `public/docs/*.png` that a fresh account cannot
show, because they only exist at scale — see
[`--docs` mode](#--docs-mode-the-at-scale-docs-shots) below.

## Refresh in one command

```sh
pnpm dev                                   # dev server on :3000 (leave running)
pnpm exec convex run seed:setup            # only if the demo data is missing/stale
node scripts/capture-screenshots.mjs             # marketing + at-scale docs shots (~70s)
node scripts/capture-screenshots.mjs --marketing # public/screenshots/* only (~40s)
node scripts/capture-screenshots.mjs --docs      # public/docs/*.png only (~25s)

node scripts/capture-walkthrough.mjs             # public/docs/walkthrough/* (~6 min)
```

Then eyeball the PNGs before committing.

## What it produces

| File | Screen | How it's reached |
| --- | --- | --- |
| `dashboard.png` | Organizer dashboard | sign in → `/app` |
| `submissions.png` | Submissions table (incl. staged queues) | `/app/submissions` |
| `agenda.png` | Agenda, Day view | `/app/agenda` → "Day", grid scrolled onto the programme |
| `form-builder.png` | Form builder, Submission questions step | `/app/forms` → first form → "Submission questions" |
| `portal.png` | Speaker portal home | `/portal/t/demo-ava-nakamura` |
| `public-schedule.png` | Published public schedule | `/e/ai-summit-2026` |
| `agenda-flow.gif` | A real agenda drag, 4 frames | mouse down + move + drop on a day-grid card |

`agenda-list.png` was retired on 2026-08-11: nothing referenced it, and the List
view's **Room** cell renders the raw Convex room id instead of the room name
(`SelectValue` in `src/components/agenda/list-view.tsx` has no matching item to
label the value), so every capture of it photographed a defect. Re-add the shot
once that renders a room name.

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

## `--docs` mode: the at-scale docs shots

`node scripts/capture-screenshots.mjs --docs` writes twelve PNGs into
`public/docs/`. They are deliberately the *only* seeded-demo shots left in the
user guide: a dashboard with real numbers on it, a submissions table hundreds of
rows deep, a conflicting agenda, a filled-in speaker profile, the workspace and
integration screens. Everything else in the guide comes from
`capture-walkthrough.mjs` (below), because a new organizer needs to see their
own empty screens, not somebody else's full ones.

It shares `signIn`, `settle`, `hideDevtools`, `tryClick` and `shot` with the
marketing capture, and adds:

- `elementShot(page, locator, name)` — crops one element (a dialog, drawer, or
  card) instead of the full viewport, so surrounding page chrome doesn't dilute
  the thing being documented.
- `captureDocsShots(page)` — one `safeShot(name, fn)` call per file. Every shot
  is independent and wrapped in try/catch: a renamed label or a control that
  didn't render skips **that one file** and logs `skipped: <name> — <reason>`,
  everything else still runs. The run ends with a written/skipped summary.
- Destructive dialogs (invite a teammate) are opened, screenshotted, then
  dismissed with their own **Cancel** button — never the real action.

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


## The /docs user guide: `capture-walkthrough.mjs`

```sh
pnpm dev                                  # dev server on :3000 (leave running)
node scripts/capture-walkthrough.mjs      # writes public/docs/walkthrough/*.png (~6 min)
```

Where this script drives the *seeded* demo, `capture-walkthrough.mjs` **signs up
a brand-new account on every run** and drives one organizer's whole journey
through the real UI, shooting all 31 steps in order:

> sign up → empty workspace → create "Devcon Berlin 2026" → event details →
> rooms & tracks → build the CFP form → copy the public link → submit one talk
> as a speaker → it lands in the inbox → open it → stage it to the Accept Queue
> → commit the queue → speaker portal → assign a task → schedule the talk →
> publish → the public page is live.

That is what a first-time reader actually needs: the **empty states** a new
organizer meets on day one, and one story they can follow from page to page
instead of eleven disconnected screenshots of somebody else's finished
conference. Files are numbered (`01-sign-up.png` … `31-public-page.png`) so the
reading order is visible on disk.

The account is disposable and additive — a unique email every run, and a free
event slug chosen up front via `convex run events:getBySlug`, so re-running
never collides with a previous run on the shared dev database.

Two things worth knowing:

- **The public CFP wizard is driven as a state machine**, not a straight line.
  It is server-rendered, so a Continue click that lands before React hydrates
  submits natively and the wizard silently resets to Welcome. The script looks
  at which step is on screen, does the next right thing, and shoots each step
  the first time it sees it — the same approach as
  `tests/e2e/flows/cfp-submit.spec.ts`.
- **`--resume <email> <event-slug>`** re-shoots only the agenda/publish tail
  (shots 29–31) on an account a previous run already built, so one flaky
  navigation at the end doesn't cost a whole six-minute run. Shots 27 and 28
  show the agenda *before* anything is scheduled and can only come from the
  original run, so resume deliberately skips them.

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

## The shared dev database will pollute a capture

The e2e `flows` project and the sbek eval kit both drive the same dev
deployment, and **their fixtures are never cleaned up** — rows called
`Copilot Guard cg-…`, `Outbox Proof t-…`, `Agenda One ag-…` / `Aggie Enda`, or a
second `Capped CFP f-…` form pile up in the demo event. If a gate is running you
cannot fix this with `seed:setup` either (you would yank the data out from under
it). Two things that work:

- **Submissions**: click the **Score** header once so the table sorts by score
  descending. Every seeded submission carries a score and no fixture does, so
  the real programme rises to the top and the shot is clean.
- **Agenda / dashboard / public page**: nothing sorts the unscheduled tray, so
  either wait for the gate to finish and re-seed, or take the still from the
  launch-video captures (see below).

## The launch-video captures are a second source

`video/public/captures/*.png` (3200×2000) and `video/public/clips/*.mp4`
(1600×1000) are shot by the launch-video pipeline at a calm moment, and several
of them are homepage-grade. They are 16:10 like everything here, so they drop
straight into `public/screenshots/` with no layout change. `agenda-flow.gif` is
built from `video/public/clips/agenda.mp4` rather than from this script's drag
frames — it is a real 9.5s drag with the conflict pre-warning in it:

```sh
ffmpeg -i video/public/clips/agenda.mp4 \
  -lavfi "fps=12,scale=1200:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" \
  -loop 0 public/screenshots/agenda-flow.gif   # ≈1.6 MB
```

## Known follow-ups

Refreshed 2026-08-11 (post-revamp, post URL-architecture). Still open:

- there is no copilot screenshot; when one is wanted, add a step here and
  register the shot in `SHOTS`.
